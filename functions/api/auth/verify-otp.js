// Cloudflare Pages Function — POST /api/auth/verify-otp
//
// Step 2 of the "Мои заказы" SMS-OTP login: checks the code the customer
// typed against SMS PRO (smspro.nikita.kg), resolves which phone requested
// this token from public.otp_requests (never the client-supplied phone —
// see supabase/migrations/0003_otp_login.sql), and on success mints a
// signed session cookie (functions/api/session.js) so
// functions/api/customer-orders.js can recognize this browser as logged in
// on later requests without re-sending phone+code.
//
// Secrets (Cloudflare Pages env, never in git):
//   SMSPRO_API_KEY               from the SMS PRO personal cabinet, "OTP-сервис" tab
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   same as functions/api/orders.js
//   SESSION_SIGNING_SECRET       random string, only ever known server-side

import { signSession, buildSessionCookie, SESSION_TTL_SECONDS } from "../session.js";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

const SMSPRO_VERIFY_URL = "https://smspro.nikita.kg/api/otp/verify";

// An otp_requests row older than this is treated as gone even if SMS PRO's
// own OTP hasn't technically expired yet — defense in depth, independent of
// whatever TTL is configured in the SMS PRO dashboard.
export const OTP_REQUEST_MAX_AGE_SECONDS = 15 * 60;

// Pure: validate + normalize the incoming request.
export function normalizeVerifyOtpPayload(payload) {
  if (!payload || typeof payload !== "object") return { error: "invalid_json" };
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  if (!token) return { error: "invalid_token" };
  if (!code) return { error: "invalid_code" };
  return { token, code };
}

// Pure: is this otp_requests row too old to trust, independent of SMS PRO's
// own OTP expiry?
export function isOtpRequestExpired(createdAtIso, nowMs = Date.now()) {
  const createdMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdMs)) return true;
  return nowMs - createdMs > OTP_REQUEST_MAX_AGE_SECONDS * 1000;
}

// Pure: map SMS PRO's numeric status codes (see
// smspro.nikita.kg-OTP-api.pdf §4) to our own stable error strings + HTTP
// status — never 502/504 (see docs/api-orders.md).
export function mapSmsProVerifyStatus(status) {
  const code = Number(status);
  if (code === 0) return null;
  if (code === 14) return { error: "invalid_code", httpStatus: 400 };
  if (code === 13) return { error: "code_expired", httpStatus: 400 };
  if (code === 12) return { error: "invalid_token", httpStatus: 400 };
  return { error: "sms_provider_error", httpStatus: 500 };
}

async function lookupOtpRequest(env, token) {
  const url = `${env.SUPABASE_URL}/rest/v1/otp_requests?token=eq.${encodeURIComponent(token)}&select=phone_digits,created_at`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase otp_requests select failed: ${res.status} ${detail}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function deleteOtpRequest(env, token) {
  const url = `${env.SUPABASE_URL}/rest/v1/otp_requests?token=eq.${encodeURIComponent(token)}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }).catch(() => {});
}

async function verifyOtpViaSmsPro(env, token, code) {
  const res = await fetch(SMSPRO_VERIFY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-KEY": env.SMSPRO_API_KEY,
    },
    body: JSON.stringify({ token, code }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`SMS PRO verify failed: ${res.status} ${detail}`);
  }
  return body;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SMSPRO_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SESSION_SIGNING_SECRET) {
    return json({ ok: false, error: "backend_not_configured" }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const normalized = normalizeVerifyOtpPayload(payload);
  if (normalized.error) {
    return json({ ok: false, error: normalized.error }, 400);
  }

  try {
    const otpRequest = await lookupOtpRequest(env, normalized.token);
    if (!otpRequest) {
      return json({ ok: false, error: "invalid_token" }, 400);
    }
    if (isOtpRequestExpired(otpRequest.created_at)) {
      await deleteOtpRequest(env, normalized.token);
      return json({ ok: false, error: "code_expired" }, 400);
    }

    const smsProResponse = await verifyOtpViaSmsPro(env, normalized.token, normalized.code);
    const mapped = mapSmsProVerifyStatus(smsProResponse.status);
    if (mapped) {
      return json({ ok: false, error: mapped.error }, mapped.httpStatus);
    }

    await deleteOtpRequest(env, normalized.token);

    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const sessionToken = await signSession({ phone: otpRequest.phone_digits, exp }, env.SESSION_SIGNING_SECRET);

    return json({ ok: true }, 200, { "set-cookie": buildSessionCookie(sessionToken) });
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
