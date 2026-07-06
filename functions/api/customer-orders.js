// Cloudflare Pages Function — POST /api/customer-orders
//
// "Мои заказы" — lets a customer see their own order history without any
// account/login. Proof of ownership is phone number + the short lookup_code
// generated client-side at checkout (see app.js generateOrderLookupCode) and
// delivered for free inside the WhatsApp message the customer already sends
// to the manager, plus in the manager's WhatsApp confirmation reply.
//
// Access model: reads Supabase via the SERVICE ROLE key (server-side only),
// exactly like functions/api/orders.js writes. This endpoint does NOT add any
// anon RLS policy — public.orders/order_items stay unreadable by the anon key
// (see supabase/migrations/0001_init_orders_customers.sql,
// 0002_customer_order_lookup.sql). Every response is scoped to rows matching
// BOTH the phone and the code; a wrong guess on either gets the same generic
// "not_found" so this endpoint never confirms whether a phone number placed
// any orders at all.
//
// Known limitation (documented, not solved here): Cloudflare Pages Functions
// have no built-in rate limiting without Workers KV/Durable Objects, so this
// is not brute-force-hardened beyond requiring phone+code together. Fine for
// a first version; revisit if abuse is observed.
//
// Pure helpers are exported for unit testing — see customer-orders.test.mjs.

import { str, digitsOnly, normalizeLookupCode } from "./orders.js";
import { statusLabel } from "../../admin/admin.logic.js";

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

export async function onRequestPost(context) {
  // TEMPORARY diagnostics (2026-07-06): tracking down a raw edge 502 that
  // only reproduces once this handler reaches the Supabase fetch. Remove
  // once root-caused — see docs/api-orders.md.
  try {
    const { request, env } = context;
    console.log("customer-orders: start");

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "backend_not_configured" }, 503);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    console.log("customer-orders: payload parsed");

    const normalized = normalizeLookupRequest(payload);
    if (normalized.error) {
      return json({ ok: false, error: normalized.error }, 400);
    }
    console.log("customer-orders: request normalized, calling supabase orders select");

    let candidates;
    try {
      candidates = await supabaseSelect(
        env,
        "orders",
        `select=id,created_at,status,total_kgs,customer_name,city,region,address,customer_comment,promo_code,lookup_code&customer_phone_digits=eq.${normalized.phoneDigits}&order=created_at.desc&limit=200`,
      );
      console.log("customer-orders: orders select ok, count=" + (Array.isArray(candidates) ? candidates.length : typeof candidates));
    } catch (error) {
      console.log("customer-orders: orders select threw: " + String((error && error.stack) || error));
      return json({ ok: false, error: String((error && error.message) || error) }, 502);
    }

    const verified = Array.isArray(candidates) && candidates.some((order) => matchesLookupCode(order, normalized.code));
    if (!verified) {
      console.log("customer-orders: not verified, returning 404");
      // Same generic response whether the phone has zero orders or the code
      // was simply wrong — never confirm which.
      return json({ ok: false, error: "not_found" }, 404);
    }

    const orderIds = candidates.map((order) => order.id);
    let items;
    try {
      items = orderIds.length
        ? await supabaseSelect(
            env,
            "order_items",
            `select=order_id,title_snapshot,brand_snapshot,unit_snapshot,qty,price_kgs,line_total_kgs,image_snapshot&order_id=in.(${orderIds.join(",")})`,
          )
        : [];
      console.log("customer-orders: items select ok, count=" + (Array.isArray(items) ? items.length : typeof items));
    } catch (error) {
      console.log("customer-orders: items select threw: " + String((error && error.stack) || error));
      return json({ ok: false, error: String((error && error.message) || error) }, 502);
    }
    const itemsByOrder = groupItemsByOrderId(items);

    console.log("customer-orders: building final response");
    const responseBody = {
      ok: true,
      orders: candidates.map((order) => sanitizeOrderForCustomer(order, itemsByOrder.get(order.id))),
    };
    console.log("customer-orders: returning final response");
    return json(responseBody);
  } catch (error) {
    console.log("customer-orders: TOP LEVEL threw: " + String((error && error.stack) || error));
    return json({ ok: false, error: "unexpected_error" }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  return onRequestPost(context);
}
