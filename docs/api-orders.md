# Orders API (backend MVP step 2)

Server-side order capture for Global Market KG. Implemented as a Cloudflare
Pages Function so it runs on the same domain as the static site.

- Code: `functions/api/orders.js`
- Tests: `functions/api/orders.test.mjs` — `node --test functions/api/orders.test.mjs` (9/9, no network)
- Route: `POST /api/orders`
- Depends on the schema in `supabase/migrations/0001_init_orders_customers.sql`
- Plan: `docs/backend-mvp-plan.md` · Setup: `docs/supabase-setup.md`

The function uses the Supabase **service role** key (server-side only, bypasses
RLS) to insert rows. The browser never sees that key. WhatsApp ordering stays
the primary channel — this endpoint only persists the order.

## Environment bindings (set in Cloudflare Pages, NEVER in git)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key — server only |
| `MANAGER_WHATSAPP` | optional, digits only (defaults to `996706771103`) |

Set these in Cloudflare Pages → project → Settings → Environment variables
(Production + Preview). Do not put them in the repo or in `.env` that is
committed.

If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing, the function
returns `503 {ok:false, fallback:true}` so the site keeps working
(WhatsApp-only).

## Request

```jsonc
POST /api/orders
{
  "customer": { "name": "...", "phone": "...", "whatsapp": "...",
                "city": "...", "region": "...", "address": "...", "comment": "..." },
  "items": [
    { "product_id": "prd_…", "product_slug": "…", "title": "…", "brand": "…",
      "unit": "шт", "qty": 2, "price_kgs": 550, "image": "/assets/…" }
  ],
  "attribution": { "utm_source": "…", "utm_medium": "…", "utm_campaign": "…",
                   "utm_content": "…", "utm_term": "…", "referrer": "…" },
  "consent": { "consent_type": "marketing", "is_granted": true, "text_version": "v1" },
  "customer_source": "…",
  "promo_code": "…",
  "whatsapp_message": "…full text the site already builds…"
}
```

Server recomputes `total_kgs` and each `line_total_kgs` from `qty * price_kgs`
(the client total is never trusted). `name` and `phone` are required; cart must
be non-empty.

## Response

```json
{ "ok": true, "order_id": "uuid", "status": "new",
  "manager_whatsapp_url": "https://wa.me/996706771103?text=..." }
```

On failure: `{ "ok": false, "fallback": true, "error": "..." }` with a 5xx/503.
The frontend must treat any non-`ok` (or network error) as "open WhatsApp as
today".

## Frontend wiring — to be done by Codex AFTER deploy + test

Not wired yet, on purpose: this changes the live checkout, so it should land
only once the function is deployed and the env vars are set and tested. The
current `checkoutForm` submit in `app.js` builds `message` and does:

```js
const whatsapp = `https://wa.me/${...}?text=${encodeURIComponent(message)}`;
saveLastOrder();
window.location.href = whatsapp;
```

Replace the navigation with a save-then-WhatsApp attempt that always falls back:

```js
const order = {
  customer: {
    name: formData.get("name"), phone: formData.get("phone"),
    city: formData.get("city"), region: formData.get("region"),
    address: formData.get("address"), comment: formData.get("comment"),
  },
  items: cartEntries().map(({ product, qty }) => ({
    product_id: product.id, product_slug: product.slug, title: product.title,
    brand: product.brand, unit: product.unit, qty, price_kgs: productPrice(product),
    image: product.image,
  })),
  attribution,
  customer_source: formData.get("customerSource"),
  promo_code: formData.get("promoCode"),
  whatsapp_message: message,
};
let target = `https://wa.me/${catalogSettings.manager_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
try {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  if (res.ok) {
    const data = await res.json();
    if (data.ok && data.manager_whatsapp_url) target = data.manager_whatsapp_url;
  }
} catch (_) { /* fall back to WhatsApp-only */ }
saveLastOrder();
window.location.href = target;
```

Behavior guarantee: if the API is down/misconfigured, the customer still gets
the same WhatsApp flow — no order is lost from their side.

## Deploy note

Cloudflare Pages picks up `functions/` from the repo root. The current deploy
ships a prebuilt static dir (`scripts/package_static_site.py` →
`/private/tmp/globalmarket-static-build`), which does **not** include
`functions/`. Codex must adjust the deploy so the Pages Functions are included
(deploy from the repo with the static output, or copy `functions/` into the
deploy dir), then set the env vars above. This is the privileged step
(secrets + deploy) that Claude Code does not perform.
