// Cloudflare Pages Function — POST /api/orders
//
// Backend MVP order capture for Global Market KG.
// Saves an order to Supabase using the SERVICE ROLE key (server-side only),
// then returns a manager WhatsApp URL. The browser still opens WhatsApp as
// today; this endpoint only persists the order. If anything fails, the
// frontend must fall back to the current WhatsApp-only flow.
//
// Secrets come from Cloudflare Pages environment bindings (NEVER in git):
//   SUPABASE_URL                e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   service role key (bypasses RLS) — server only
//   MANAGER_WHATSAPP            optional, digits only, e.g. 996706771103
//   RESEND_API_KEY              optional; when set, sends manager email copy
//   ORDER_EMAIL_TO              optional; defaults to orders@globalmarket.kg
//   ORDER_EMAIL_FROM            optional; defaults to Global Market KG <orders@globalmarket.kg>
//
// Pure helpers (normalizeOrderPayload, buildManagerUrl, …) are exported for
// unit testing — see functions/api/orders.test.mjs. See docs/api-orders.md.
//
// If the customer is logged in (SESSION_SIGNING_SECRET cookie from
// functions/api/auth/verify-otp.js), the order is linked to their
// public.customers row via customer_id. This is best-effort and never
// blocks a guest checkout — an order always saves even if this lookup
// fails or the customer isn't logged in.

import { parseSessionCookie, verifySession } from "./session.js";

export const DEFAULT_MANAGER_WHATSAPP = "996706771103";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function str(value, max = 2000) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

// The customer-generated lookup code (see app.js generateOrderLookupCode) —
// stored as-is aside from trimming/case/length so functions/api/customer-orders.js
// can match it back exactly. Never trust it for anything but a lookup key.
export function normalizeLookupCode(value) {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return cleaned || null;
}

export function buildManagerUrl(managerWhatsapp, message) {
  const phone = digitsOnly(managerWhatsapp) || DEFAULT_MANAGER_WHATSAPP;
  return message
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${phone}`;
}

function formatKgs(value) {
  return `${Math.round(num(value)).toLocaleString("ru-RU").replace(/\u00a0/g, " ")} с`;
}

export function buildOrderEmail(normalized, orderId) {
  const order = normalized.order;
  const lines = [
    `Новый заказ Global Market KG${orderId ? ` #${orderId}` : ""}`,
    ...(order.lookup_code ? [`Код заказа для клиента: ${order.lookup_code}`] : []),
    "",
    "Клиент:",
    `Имя: ${order.customer_name || "не указано"}`,
    `Телефон/WhatsApp: ${order.customer_phone || "не указано"}`,
    `Город: ${order.city || "не указано"}`,
    `Регион: ${order.region || "не указано"}`,
    `Адрес: ${order.address || "не указано"}`,
    `Комментарий: ${order.customer_comment || "не указано"}`,
    "",
    "Товары:",
    ...normalized.items.map((item, index) => {
      const title = item.title_snapshot || item.product_id || `Товар ${index + 1}`;
      return `${index + 1}. ${title} — ${item.qty} x ${formatKgs(item.price_kgs)} = ${formatKgs(item.line_total_kgs)}`;
    }),
    "",
    `Итого: ${formatKgs(order.total_kgs)}`,
    "",
    "Маркетинг:",
    `Откуда узнали: ${order.customer_source || "не указано"}`,
    `Промокод/код: ${order.promo_code || "не указано"}`,
  ];

  if (normalized.attribution) {
    lines.push(
      `utm_source: ${normalized.attribution.utm_source || "не указано"}`,
      `utm_medium: ${normalized.attribution.utm_medium || "не указано"}`,
      `utm_campaign: ${normalized.attribution.utm_campaign || "не указано"}`,
      `utm_content: ${normalized.attribution.utm_content || "не указано"}`,
      `referrer: ${normalized.attribution.referrer || "не указано"}`,
    );
  }

  if (normalized.consent) {
    lines.push("", `Согласие на обратную связь: ${normalized.consent.is_granted ? "да" : "нет"}`);
  }

  if (order.whatsapp_message) {
    lines.push("", "WhatsApp-сообщение:", order.whatsapp_message);
  }

  return {
    subject: `Новый заказ Global Market KG — ${formatKgs(order.total_kgs)}`,
    text: lines.join("\n"),
  };
}

async function sendOrderEmail(env, normalized, orderId) {
  if (!env.RESEND_API_KEY) {
    return { attempted: false, sent: false, reason: "email_not_configured" };
  }

  const to = str(env.ORDER_EMAIL_TO, 300) || "orders@globalmarket.kg";
  const from = str(env.ORDER_EMAIL_FROM, 300) || "Global Market KG <orders@globalmarket.kg>";
  const email = buildOrderEmail(normalized, orderId);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      text: email.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email send failed: ${res.status} ${detail}`);
  }

  return { attempted: true, sent: true };
}

// Pure: validate + normalize an incoming order payload.
// Returns { error } on invalid input, or { order, items, attribution, consent, total }.
// Totals are always recomputed here — the client total is never trusted.
export function normalizeOrderPayload(payload) {
  if (!payload || typeof payload !== "object") return { error: "invalid_json" };

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return { error: "empty_cart" };

  const customer = payload.customer || {};
  const customerName = str(customer.name, 200);
  const customerPhone = str(customer.phone, 60);
  if (!customerName || !customerPhone) return { error: "missing_contact" };

  const normalizedItems = [];
  let total = 0;
  for (const raw of items) {
    const qty = Math.max(1, Math.round(num(raw.qty)));
    const price = num(raw.price_kgs ?? raw.price);
    const lineTotal = Math.round(qty * price);
    total += lineTotal;
    normalizedItems.push({
      product_id: str(raw.product_id, 120),
      product_slug: str(raw.product_slug, 200),
      title_snapshot: str(raw.title ?? raw.title_snapshot, 400),
      brand_snapshot: str(raw.brand ?? raw.brand_snapshot, 200),
      unit_snapshot: str(raw.unit ?? raw.unit_snapshot, 60),
      qty,
      price_kgs: price,
      line_total_kgs: lineTotal,
      image_snapshot: str(raw.image ?? raw.image_snapshot, 500),
    });
  }

  const order = {
    status: "new",
    total_kgs: total,
    customer_name: customerName,
    customer_phone: customerPhone,
    city: str(customer.city, 200),
    region: str(customer.region, 200),
    address: str(customer.address, 500),
    customer_comment: str(customer.comment ?? payload.comment, 2000),
    customer_source: str(payload.customer_source, 200),
    promo_code: str(payload.promo_code, 120),
    lookup_code: normalizeLookupCode(payload.lookup_code),
    whatsapp_message: str(payload.whatsapp_message, 4000),
    sent_to_whatsapp: false,
  };

  const a = payload.attribution || {};
  const attribution = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "referrer", "manual_source", "promo_code",
  ].some((k) => str(a[k]) || (k === "manual_source" && str(payload.customer_source)) || (k === "promo_code" && str(payload.promo_code)))
    ? {
        utm_source: str(a.utm_source, 200),
        utm_medium: str(a.utm_medium, 200),
        utm_campaign: str(a.utm_campaign, 200),
        utm_content: str(a.utm_content, 200),
        utm_term: str(a.utm_term, 200),
        referrer: str(a.referrer, 500),
        manual_source: str(payload.customer_source, 200),
        promo_code: str(payload.promo_code, 120),
      }
    : null;

  const consent =
    payload.consent && payload.consent.is_granted !== undefined
      ? {
          consent_type: str(payload.consent.consent_type, 120) || "marketing",
          is_granted: Boolean(payload.consent.is_granted),
          source: "checkout",
          text_version: str(payload.consent.text_version, 120),
        }
      : null;

  return { order, items: normalizedItems, attribution, consent, total };
}

// Insert one or more rows into a Supabase table via the REST API.
async function supabaseInsert(env, table, rows, { returning = false } = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: returning ? "return=representation" : "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase ${table} insert failed: ${res.status} ${detail}`);
  }
  return returning ? res.json() : null;
}

// Best-effort: resolve the logged-in customer's id from their session
// cookie, so a placed-while-logged-in order links straight to their
// customers row (no need to wait for the retroactive backfill that
// verify-otp.js does at next login).
async function resolveSessionCustomerId(request, env) {
  try {
    if (!env.SESSION_SIGNING_SECRET) return null;
    const cookieToken = parseSessionCookie(request.headers.get("cookie"));
    if (!cookieToken) return null;
    const session = await verifySession(cookieToken, env.SESSION_SIGNING_SECRET);
    if (!session) return null;
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/customers?select=id&phone_digits=eq.${session.phone}&limit=1`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0].id : null;
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, fallback: true, error: "backend_not_configured" }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const normalized = normalizeOrderPayload(payload);
  if (normalized.error) {
    return json({ ok: false, error: normalized.error }, 400);
  }

  const sessionCustomerId = await resolveSessionCustomerId(request, env);
  if (sessionCustomerId) {
    normalized.order.customer_id = sessionCustomerId;
  }

  try {
    const orderRows = await supabaseInsert(env, "orders", normalized.order, { returning: true });
    const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;
    const orderId = order && order.id;
    if (!orderId) throw new Error("no order id returned");

    await supabaseInsert(
      env,
      "order_items",
      normalized.items.map((item) => ({ ...item, order_id: orderId })),
    );

    if (normalized.attribution) {
      await supabaseInsert(env, "marketing_attribution", { ...normalized.attribution, order_id: orderId });
    }
    if (normalized.consent) {
      await supabaseInsert(env, "customer_consents", { ...normalized.consent, order_id: orderId });
    }

    let emailNotification = { attempted: false, sent: false, reason: "email_not_configured" };
    try {
      emailNotification = await sendOrderEmail(env, normalized, orderId);
    } catch (emailError) {
      // Email is a manager convenience copy. It must never block saved orders
      // or the customer's WhatsApp flow.
      console.error("Order email notification failed", emailError);
      emailNotification = { attempted: true, sent: false, reason: "send_failed" };
    }

    return json({
      ok: true,
      order_id: orderId,
      status: "new",
      manager_whatsapp_url: buildManagerUrl(env.MANAGER_WHATSAPP, normalized.order.whatsapp_message),
      email_notification: emailNotification,
    });
  } catch (error) {
    // Not 502/504: Cloudflare's proxied custom domain intercepts gateway-class
    // status codes and replaces the body with its own generic error page,
    // discarding this JSON entirely (confirmed in production — see
    // docs/api-orders.md).
    return json(
      { ok: false, fallback: true, error: String((error && error.message) || error) },
      500,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  return onRequestPost(context);
}
