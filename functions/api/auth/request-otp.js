// Cloudflare Pages Function — POST /api/auth/request-otp
//
// Step 1 of the "Мои заказы" SMS-OTP login: sends a one-time code to the
// customer's phone via SMS PRO (smspro.nikita.kg) and records which phone
// the resulting token belongs to (see
// supabase/migrations/0003_otp_login.sql for why — SMS PRO's own API never
// echoes the phone back on verify, so without this record a client could
// verify a token they requested for their own number while claiming a
// different phone).
//
// Secrets (Cloudflare Pages env, never in git):
//   SMSPRO_API_KEY               from the SMS PRO personal cabinet, "OTP-сервис" tab
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   same as functions/api/orders.js
//
// Known limitation (documented, not solved here): no rate limiting beyond
// requiring a plausible phone number — same "no Workers KV/Durable Objects"
// gap as functions/api/customer-orders.js. Each request costs real money at
// the SMS PRO account, so abuse would be a billing problem before it's a
// security one; revisit if abuse is observed.

import { digitsOnly } from "../orders.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

const SMSPRO_SEND_URL = "https://smspro.nikita.kg/api/otp/send";

// Pure: validate + normalize the incoming request.
export function normalizeRequestOtpPayload(payload) {
  if (!payload || typeof payload !== "object") return { error: "invalid_json" };
  const phoneDigits = digitsOnly(payload.phone);
  if (phoneDigits.length < 6) return { error: "invalid_phone" };
  return { phoneDigits };
}

// Pure: map SMS PRO's numeric status codes (see
// smspro.nikita.kg-OTP-api.pdf §4) to our own stable error strings + the
// HTTP status we should answer with — never leak their raw wording to the
// client, and never use 502/504 (Cloudflare's proxied custom domain
// intercepts those and swaps in its own generic error page — see
// docs/api-orders.md).
export function mapSmsProSendStatus(status) {
  if (status === 0) return null;
  if (status === 7) return { error: "invalid_phone", httpStatus: 400 };
  if (status === 4 || status === 5) return { error: "sms_provider_unavailable", httpStatus: 503 };
  return { error: "sms_provider_error", httpStatus: 500 };
}

async function sendOtpViaSmsPro(env, phoneDigits, transactionId) {
  const res = await fetch(SMSPRO_SEND_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-KEY": env.SMSPRO_API_KEY,
    },
    body: JSON.stringify({ transaction_id: transactionId, phone: phoneDigits }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`SMS PRO send failed: ${res.status} ${detail}`);
  }
  return body;
}

async function rememberOtpToken(env, token, phoneDigits) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/otp_requests`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({ token, phone_digits: phoneDigits }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase otp_requests insert failed: ${res.status} ${detail}`);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SMSPRO_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "backend_not_configured" }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const normalized = normalizeRequestOtpPayload(payload);
  if (normalized.error) {
    return json({ ok: false, error: normalized.error }, 400);
  }

  try {
    const transactionId = crypto.randomUUID().replace(/-/g, "");
    const smsProResponse = await sendOtpViaSmsPro(env, normalized.phoneDigits, transactionId);
    const mapped = mapSmsProSendStatus(smsProResponse.status);
    if (mapped) {
      return json({ ok: false, error: mapped.error }, mapped.httpStatus);
    }
    await rememberOtpToken(env, smsProResponse.token, normalized.phoneDigits);
    return json({ ok: true, token: smsProResponse.token });
  } catch (error) {
    return json({ ok: false, error: String((error && error.message) || error) }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  return onRequestPost(context);
}
