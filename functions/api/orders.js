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
//
// Pure helpers (normalizeOrderPayload, buildManagerUrl, …) are exported for
// unit testing — see functions/api/orders.test.mjs. See docs/api-orders.md.

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

export function buildManagerUrl(managerWhatsapp, message) {
  const phone = digitsOnly(managerWhatsapp) || DEFAULT_MANAGER_WHATSAPP;
  return message
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${phone}`;
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

    return json({
      ok: true,
      order_id: orderId,
      status: "new",
      manager_whatsapp_url: buildManagerUrl(env.MANAGER_WHATSAPP, normalized.order.whatsapp_message),
    });
  } catch (error) {
    return json(
      { ok: false, fallback: true, error: String((error && error.message) || error) },
      502,
    );
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  return onRequestPost(context);
}
