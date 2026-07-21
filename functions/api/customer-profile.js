// Cloudflare Pages Function — GET/POST /api/customer-profile
//
// The personal cabinet's profile: name, city, region, address, and a derived
// customer role (retail/registered/wholesale_pending/wholesale). Requires a
// valid SMS-login session (functions/api/auth/verify-otp.js) — there is no
// separate "registration" step; logging in via SMS is what creates the
// public.customers row this profile reads/writes (see verify-otp.js, which
// upserts that row on first successful login).
//
// Secrets (Cloudflare Pages env, never in git): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, SESSION_SIGNING_SECRET — same as the other
// functions/api/auth/*.js files.

import { str } from "./orders.js";
import { parseSessionCookie, verifySession } from "./session.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// Pure: role is derived, never stored as a single column — see
// supabase/migrations/0004_customer_roles_wholesale.sql for the full model.
export function deriveRole(customer) {
  if (!customer) return "retail";
  if (customer.customer_type === "wholesale") return "wholesale";
  if (customer.wholesale_status === "pending") return "wholesale_pending";
  return "registered";
}

// Pure: the customer-facing shape of a profile — never echoes internal-only
// fields (id, default_discount_percent, notes).
export function sanitizeProfile(customer) {
  return {
    name: customer?.name || "",
    phone: customer?.phone || "",
    city: customer?.city || "",
    region: customer?.region || "",
    address: customer?.address || "",
    role: deriveRole(customer),
  };
}

// Pure: validate + normalize a profile update request. Phone is never
// editable here — it's the SMS-verified session identity, not a form field.
export function normalizeProfileUpdate(payload) {
  if (!payload || typeof payload !== "object") return { error: "invalid_json" };
  const normalized = {
    name: str(payload.name, 200),
    address: str(payload.address, 300),
  };
  // Legacy clients may still submit these fields. New clients omit them, so
  // preserve any existing database values instead of clearing them.
  if (Object.hasOwn(payload, "city")) normalized.city = str(payload.city, 120);
  if (Object.hasOwn(payload, "region")) normalized.region = str(payload.region, 120);
  return normalized;
}

async function resolveSession(request, env) {
  if (!env.SESSION_SIGNING_SECRET) return null;
  const cookieToken = parseSessionCookie(request.headers.get("cookie"));
  if (!cookieToken) return null;
  return verifySession(cookieToken, env.SESSION_SIGNING_SECRET);
}

async function supabaseSelect(env, table, query) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase ${table} select failed: ${res.status} ${detail}`);
  }
  return res.json();
}

async function supabaseUpdate(env, table, query, body) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase ${table} update failed: ${res.status} ${detail}`);
  }
  return res.json();
}

async function supabaseInsert(env, table, body) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase ${table} insert failed: ${res.status} ${detail}`);
  }
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SESSION_SIGNING_SECRET) {
    return json({ ok: false, error: "backend_not_configured" }, 503);
  }
  const session = await resolveSession(request, env);
  if (!session) {
    return json({ ok: false, error: "not_authenticated" }, 401);
  }
  try {
    const rows = await supabaseSelect(
      env,
      "customers",
      `select=id,name,phone,city,region,address,customer_type,wholesale_status&phone_digits=eq.${session.phone}&limit=1`,
    );
    return json({ ok: true, profile: sanitizeProfile(rows[0] || null) });
  } catch (error) {
    return json({ ok: false, error: String((error && error.message) || error) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SESSION_SIGNING_SECRET) {
    return json({ ok: false, error: "backend_not_configured" }, 503);
  }
  const session = await resolveSession(request, env);
  if (!session) {
    return json({ ok: false, error: "not_authenticated" }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const normalized = normalizeProfileUpdate(payload);
  if (normalized.error) {
    return json({ ok: false, error: normalized.error }, 400);
  }

  try {
    let rows = await supabaseUpdate(env, "customers", `phone_digits=eq.${session.phone}`, normalized);
    if (!rows.length) {
      // Defensive fallback — verify-otp.js already creates this row on first
      // login, so this only fires if that step somehow didn't run.
      rows = await supabaseInsert(env, "customers", { ...normalized, phone: session.phone });
    }
    return json({ ok: true, profile: sanitizeProfile(rows[0] || null) });
  } catch (error) {
    return json({ ok: false, error: String((error && error.message) || error) }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return context.request.method === "GET" ? onRequestGet(context) : onRequestPost(context);
}
