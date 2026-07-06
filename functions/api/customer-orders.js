// Cloudflare Pages Function — POST /api/customer-orders
//
// "Мои заказы" — lets a customer see their own order history two ways:
//
// 1. No login: phone number + the short lookup_code generated client-side at
//    checkout (see app.js generateOrderLookupCode), delivered for free inside
//    the WhatsApp message the customer already sends to the manager, plus in
//    the manager's WhatsApp confirmation reply. Scoped to orders matching
//    BOTH the phone and the code; a wrong guess on either gets the same
//    generic "not_found" so this endpoint never confirms whether a phone
//    number placed any orders at all.
// 2. Logged in: a signed session cookie (functions/api/session.js), minted by
//    functions/api/auth/verify-otp.js after a real SMS OTP check. A valid
//    session already proves phone ownership more strongly than the
//    lookup_code, so no code is required and an empty order list is a
//    legitimate answer (not "not_found", which stays reserved for guesses).
//
// Access model: reads Supabase via the SERVICE ROLE key (server-side only),
// exactly like functions/api/orders.js writes. This endpoint does NOT add any
// anon RLS policy — public.orders/order_items stay unreadable by the anon key
// (see supabase/migrations/0001_init_orders_customers.sql,
// 0002_customer_order_lookup.sql).
//
// Known limitation (documented, not solved here): Cloudflare Pages Functions
// have no built-in rate limiting without Workers KV/Durable Objects, so the
// no-login path is not brute-force-hardened beyond requiring phone+code
// together. Fine for a first version; revisit if abuse is observed.
//
// Pure helpers are exported for unit testing — see customer-orders.test.mjs.

import { str, digitsOnly, normalizeLookupCode } from "./orders.js";
import { statusLabel } from "../../admin/admin.logic.js";
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

// Pure: validate + normalize the incoming lookup request.
export function normalizeLookupRequest(payload) {
  if (!payload || typeof payload !== "object") return { error: "invalid_json" };
  const phoneDigits = digitsOnly(payload.phone);
  const code = normalizeLookupCode(payload.code);
  if (phoneDigits.length < 6) return { error: "invalid_phone" };
  if (!code) return { error: "invalid_code" };
  return { phoneDigits, code };
}

// Pure: does this order prove the customer knows the right code? The
// generated-column customer_phone_digits already did the phone match in the
// Supabase filter — this only checks the code, with a defensive fallback to
// the order id's own prefix for the (expected to be rare/absent) orders
// placed before lookup_code existed.
export function matchesLookupCode(order, code) {
  if (!order) return false;
  if (order.lookup_code && normalizeLookupCode(order.lookup_code) === code) return true;
  const idPrefix = String(order.id || "").replace(/-/g, "").toUpperCase();
  return idPrefix.length > 0 && idPrefix.startsWith(code);
}

// Pure: the customer-facing shape of one order — deliberately excludes
// internal-only fields (manager_comment, whatsapp_message, sent_to_whatsapp,
// customer_phone/customer_phone_digits — the customer already knows their
// own phone, no need to echo it back).
export function sanitizeOrderForCustomer(order, items) {
  return {
    id: order.id,
    code: order.lookup_code || String(order.id || "").replace(/-/g, "").slice(0, 8).toUpperCase(),
    created_at: order.created_at,
    status: order.status,
    status_label: statusLabel(order.status),
    total_kgs: order.total_kgs,
    customer_name: order.customer_name,
    city: order.city,
    region: order.region,
    address: order.address,
    customer_comment: order.customer_comment,
    promo_code: order.promo_code,
    items: (items || []).map((item) => ({
      title: item.title_snapshot,
      brand: item.brand_snapshot,
      unit: item.unit_snapshot,
      qty: item.qty,
      price_kgs: item.price_kgs,
      line_total_kgs: item.line_total_kgs,
      image: item.image_snapshot,
    })),
  };
}

// Groups a flat order_items result by order_id — pure, no network.
export function groupItemsByOrderId(items) {
  const byOrder = new Map();
  for (const item of items || []) {
    const list = byOrder.get(item.order_id) || [];
    list.push(item);
    byOrder.set(item.order_id, list);
  }
  return byOrder;
}

async function supabaseSelect(env, table, query) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
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

async function resolveSession(request, env) {
  if (!env.SESSION_SIGNING_SECRET) return null;
  const cookieToken = parseSessionCookie(request.headers.get("cookie"));
  if (!cookieToken) return null;
  return verifySession(cookieToken, env.SESSION_SIGNING_SECRET);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "backend_not_configured" }, 503);
  }

  const session = await resolveSession(request, env);

  let phoneDigits;
  let code = null;
  if (session) {
    phoneDigits = session.phone;
  } else {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    const normalized = normalizeLookupRequest(payload);
    if (normalized.error) {
      return json({ ok: false, error: normalized.error }, 400);
    }
    phoneDigits = normalized.phoneDigits;
    code = normalized.code;
  }

  try {
    const candidates = await supabaseSelect(
      env,
      "orders",
      `select=id,created_at,status,total_kgs,customer_name,city,region,address,customer_comment,promo_code,lookup_code&customer_phone_digits=eq.${phoneDigits}&order=created_at.desc&limit=200`,
    );

    let matchedOrders;
    if (session) {
      // A verified SMS-OTP session already proves phone ownership — no code
      // needed, and zero orders is a legitimate answer for a logged-in user.
      matchedOrders = Array.isArray(candidates) ? candidates : [];
    } else {
      const verified = Array.isArray(candidates) && candidates.some((order) => matchesLookupCode(order, code));
      if (!verified) {
        // Same generic response whether the phone has zero orders or the code
        // was simply wrong — never confirm which.
        return json({ ok: false, error: "not_found" }, 404);
      }
      matchedOrders = candidates;
    }

    const orderIds = matchedOrders.map((order) => order.id);
    const items = orderIds.length
      ? await supabaseSelect(
          env,
          "order_items",
          `select=order_id,title_snapshot,brand_snapshot,unit_snapshot,qty,price_kgs,line_total_kgs,image_snapshot&order_id=in.(${orderIds.join(",")})`,
        )
      : [];
    const itemsByOrder = groupItemsByOrderId(items);

    return json({
      ok: true,
      orders: matchedOrders.map((order) => sanitizeOrderForCustomer(order, itemsByOrder.get(order.id))),
    });
  } catch (error) {
    // Not 502/504: Cloudflare's proxied custom domain intercepts gateway-class
    // status codes and replaces the body with its own generic error page,
    // discarding this JSON entirely (confirmed in production — see
    // docs/api-orders.md "Customer order lookup" section).
    return json({ ok: false, error: String((error && error.message) || error) }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  return onRequestPost(context);
}
