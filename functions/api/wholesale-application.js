// Cloudflare Pages Function — POST /api/wholesale-application
//
// "Подать заявку на оптовый доступ" — a simple lead-capture form, reachable
// from the personal cabinet (logged in) or on its own (login is not
// required to apply). Never grants wholesale pricing itself: a manager
// reviews the application and flips it to approved from the admin panel
// (see admin/ — not built in this MVP pass beyond a visible queue).
//
// Access model: identical posture to functions/api/orders.js — writes via
// the SERVICE ROLE key server-side only. No new anon RLS policy; see
// supabase/migrations/0004_customer_roles_wholesale.sql.

import { str, digitsOnly } from "./orders.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// Pure: validate + normalize the incoming application.
export function normalizeWholesaleApplication(payload) {
  if (!payload || typeof payload !== "object") return { error: "invalid_json" };
  const name = str(payload.name, 200);
  const phoneDigits = digitsOnly(payload.phone);
  if (!name) return { error: "missing_name" };
  if (phoneDigits.length < 6) return { error: "invalid_phone" };
  return {
    application: {
      name,
      phone: str(payload.phone, 60),
      shop_name: str(payload.shop_name, 200),
      city: str(payload.city, 200),
      comment: str(payload.comment, 2000),
      status: "pending",
    },
    phoneDigits,
  };
}

async function findCustomerId(env, phoneDigits) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/customers?select=id&phone_digits=eq.${phoneDigits}&limit=1`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`Supabase customers select failed: ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].id : null;
}

async function markCustomerPending(env, customerId) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/customers?id=eq.${customerId}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ wholesale_status: "pending" }),
  }).catch(() => {});
}

async function insertApplication(env, row) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/wholesale_applications`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase wholesale_applications insert failed: ${res.status} ${detail}`);
  }
  return res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "backend_not_configured" }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const normalized = normalizeWholesaleApplication(payload);
  if (normalized.error) {
    return json({ ok: false, error: normalized.error }, 400);
  }

  try {
    // Best-effort: if this phone is already a known customer, link the
    // application and flag them as pending. An application from a phone
    // that never logged in still saves fine, just without that link.
    let customerId = null;
    try {
      customerId = await findCustomerId(env, normalized.phoneDigits);
    } catch {
      customerId = null;
    }
    if (customerId) {
      await markCustomerPending(env, customerId);
    }

    await insertApplication(env, { ...normalized.application, customer_id: customerId });

    return json({ ok: true });
  } catch (error) {
    // Not 502/504: Cloudflare's proxied custom domain intercepts gateway-class
    // status codes and replaces the body with its own generic error page
    // (see docs/api-orders.md).
    return json({ ok: false, error: String((error && error.message) || error) }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  return onRequestPost(context);
}
