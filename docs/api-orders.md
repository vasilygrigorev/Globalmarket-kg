# Orders API (backend MVP step 2)

Server-side order capture for Global Market KG. Implemented as a Cloudflare
Pages Function so it runs on the same domain as the static site.

- Code: `functions/api/orders.js`
- Tests: `functions/api/orders.test.mjs` (pure logic) + `functions/api/orders.integration.test.mjs` (onRequestPost with mocked fetch/env). Run: `node --test functions/api/orders.test.mjs functions/api/orders.integration.test.mjs` (14/14, no network). Both excluded from the deploy package.
- Route: `POST /api/orders`
- Depends on the schema in `supabase/migrations/0001_init_orders_customers.sql`
- Plan: `docs/backend-mvp-plan.md` · Setup: `docs/supabase-setup.md`

The function uses the Supabase **service role** key (server-side only, bypasses
RLS) to insert rows. The browser never sees that key. WhatsApp ordering stays
the primary channel — this endpoint only persists the order.

**Known gap:** the migration defines a `customers` table (with its own
`whatsapp` column, separate from an order's `customer_phone`), but
`onRequestPost` in `functions/api/orders.js` never inserts or upserts into it —
today every order only writes `orders` + `order_items` (+ optional
`marketing_attribution` / `customer_consents`). There is no account/login
layer built on `customers` either. A returning-customer *order history* lookup
now exists a different way — see `/api/customer-orders` below, keyed to
`orders.customer_phone`/`lookup_code` directly, not the `customers` table.

## Customer order lookup ("Мои заказы") — `POST /api/customer-orders`

Lets a customer see their own order history with no account/login: proof of
ownership is phone number + a short `lookup_code`.

- Code: `functions/api/customer-orders.js`
- Tests: `functions/api/customer-orders.test.mjs` (pure logic, 12/12, no network)
- Route: `POST /api/customer-orders`, body `{ "phone": "...", "code": "..." }`
- Depends on `supabase/migrations/0002_customer_order_lookup.sql` (adds
  `orders.lookup_code` and the generated column `orders.customer_phone_digits`)

**Where the code comes from:** `app.js` generates a 6-character code
(`generateOrderLookupCode()`, unambiguous alphabet — no `0/O/1/I`) client-side
*before* the order exists in the DB, so it can be embedded directly in the
WhatsApp message the customer sends to the manager (`orderMessage()`) — the
customer sees it in their own sent-message bubble, no extra delivery channel
needed. It also rides along in `buildOrderPayload()` as `payload.lookup_code`
and in the manager's email copy (`buildOrderEmail`). Nothing about the
existing checkout flow changes visibly; this is additive.

**Access model:** identical posture to order inserts — reads Supabase via the
service role key server-side only. No new anon RLS policy; `public.orders`/
`public.order_items` remain unreadable by the anon key. A lookup is scoped to
rows matching *both* `customer_phone_digits` and `lookup_code`; a wrong phone
or wrong code gets the same generic `not_found`, so the endpoint never
confirms whether a given phone number placed any orders at all.

**Known limitation:** no rate limiting beyond requiring phone+code together —
Cloudflare Pages Functions have no built-in limiter without Workers KV/Durable
Objects. Acceptable for a first version; revisit if abuse is observed.

**Response shape** (`sanitizeOrderForCustomer`) excludes internal-only fields:
no `manager_comment`, `whatsapp_message`, `sent_to_whatsapp`, or the customer's
own phone/phone-digits echoed back. Includes `code`, `status`/`status_label`
(reused from `admin/admin.logic.js` `statusLabel()` — one source of truth, no
duplicated Russian status strings), totals, address, and item snapshots.

**UI:** a "Мои заказы" section on the homepage (`#myOrders` in `index.html`,
linked from the side menu and footer), a phone+code form, results rendered by
`renderMyOrders()`/`myOrderCardHtml()` in `app.js`.

**Verified locally the same way as `/api/orders`:** `node --check`, full pure
logic suite green, `npx wrangler pages functions build` compiles the bundle
(including the cross-directory import of `admin/admin.logic.js`) successfully.
`wrangler pages dev .` does not route *any* `/api/*` request in this sandbox
(confirmed `/api/orders` — already live in production — 404s identically
here), so end-to-end request testing needs an actual preview/production
deploy + `curl`, same as `/api/orders` needed before its own go-live.

**Privileged step remaining (Codex/user):** apply
`supabase/migrations/0002_customer_order_lookup.sql` (SQL editor or
`supabase db push`, see `docs/supabase-setup.md`) before this endpoint can
return real data — until then the Supabase query 400s (no such column) and
this handler's own catch block turns that into a controlled `500` JSON error.
Same "stop-and-handoff" boundary as the rest of the Supabase setup.

**Cloudflare gotcha (fixed 2026-07-06):** both this endpoint's and
`/api/orders`'s own error-catch responses originally used HTTP status `502`
for "the Supabase call itself failed" — but on the proxied custom domain
(`globalmarket.kg`, unlike a raw `*.pages.dev` deployment URL) Cloudflare's
edge intercepts gateway-class status codes (502/504/etc.) from the origin and
replaces the body with its own generic "error code: 502" page, discarding the
JSON entirely, regardless of `content-type`. Diagnosed via
`wrangler pages deployment tail` (which showed `outcome: "ok"`, no exception,
proving the Worker itself ran fine) plus a differential test against the raw
`*.pages.dev` URL for the same deployment, which returned the correct JSON
body untouched. Fix: both handlers now return `500` instead of `502` for
these recoverable, application-level errors. Lesson: never use `502`/`504` as
a deliberate application status code behind a Cloudflare-proxied custom
domain.

To bring this online, follow the step-by-step
[`backend-go-live-checklist.md`](backend-go-live-checklist.md) (Supabase →
Cloudflare env → preview deploy → smoke test → wire checkout), and track it in
[`backend-go-live-worksheet.md`](backend-go-live-worksheet.md).

**Rollback to WhatsApp-only:** set `ordersApi.enabled=false` in
`data/site-config.json` (rebuild + redeploy), or remove the Cloudflare env vars
so this endpoint returns `503` and the checkout falls back automatically.

## Environment bindings (set in Cloudflare Pages, NEVER in git)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key — server only |
| `MANAGER_WHATSAPP` | optional, digits only (defaults to `996706771103`) |
| `RESEND_API_KEY` | optional; when set, sends a manager email copy after the order is saved |
| `ORDER_EMAIL_TO` | optional; defaults to `orders@globalmarket.kg` |
| `ORDER_EMAIL_FROM` | optional; defaults to `Global Market KG <orders@globalmarket.kg>` |

Set these in Cloudflare Pages → project → Settings → Environment variables
(Production + Preview). Do not put them in the repo or in `.env` that is
committed.

If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing, the function
returns `503 {ok:false, fallback:true}` so the site keeps working
(WhatsApp-only).

Email notifications are intentionally optional and non-blocking. If
`RESEND_API_KEY` is missing, the order is saved and WhatsApp opens as usual. If
Resend returns an error, the API still returns `ok:true` for the saved order and
includes `email_notification.sent=false`; a manager email copy must never break
checkout.

Cloudflare Email Routing handles inbound mail for `orders@globalmarket.kg`.
Outbound order notifications require a sending provider. The current function
uses Resend's HTTPS API directly via `fetch`, with no SDK and no browser-visible
secret.

## Request

```jsonc
POST /api/orders
{
  // customer.phone doubles as the WhatsApp contact number (see admin
  // customerWaLink()/customerTelLink() in admin/admin.logic.js) — there is no
  // separate customer.whatsapp field; normalizeOrderPayload() in
  // functions/api/orders.js only reads name/phone/city/region/address/comment.
  "customer": { "name": "...", "phone": "...",
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
  "manager_whatsapp_url": "https://wa.me/996706771103?text=...",
  "email_notification": { "attempted": true, "sent": true } }
```

On failure: `{ "ok": false, "fallback": true, "error": "..." }` with a 5xx/503.
The frontend must treat any non-`ok` (or network error) as "open WhatsApp as
today".

## Frontend wiring — DONE, behind a disabled flag

The checkout is wired in `app.js` behind a site-config flag (`false` by default,
so live behaviour is unchanged until it is deliberately enabled). On this preview
branch it is currently `true` (preview go-live done):

- `data/site-config.json` → `"ordersApi": { "enabled": <bool>, "endpoint": "/api/orders" }`.
- On submit, `app.js` builds the order payload (`buildOrderPayload`) and, only if
  `ordersApi.enabled` is true, calls `saveOrderViaApi` (POST `/api/orders`, 6s
  timeout). It uses the returned `manager_whatsapp_url` if present, and on ANY
  failure (disabled, 503, network, non-ok) falls back to the current WhatsApp
  URL. WhatsApp always opens — no order is lost.

**To enable after go-live (Codex/owner), once Supabase + Cloudflare env are set
and the endpoint is verified on preview:** set `ordersApi.enabled` to `true` in
`data/site-config.json`, bump the asset `?v=` version, rebuild, preview-deploy,
place a real test order, confirm it saves AND WhatsApp opens. No code change
needed to flip it.

### Reference: the equivalent manual wiring (for context)

The current `checkoutForm` submit in `app.js` builds `message` and does:

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

The deploy package now includes the Pages Functions automatically.
`scripts/package_static_site.py` copies `functions/` into the deploy dir
(`/private/tmp/globalmarket-static-build/functions/...`), excluding test/spec
files. `scripts/verify_static_package.py` checks that
`functions/api/orders.js` ships and that no `*.test.*` / `*.spec.*` leaks in.

Because the deploy dir contains `functions/api/orders.js`, Cloudflare Pages
compiles it to the route `POST /api/orders` (directory-mode functions; no
`_worker.js` override and no `_routes.json` present, so all functions routes are
active). Deploying the same package dir as today is enough — no extra wiring.

Verified locally without deploying: package contains `functions/api/orders.js`,
`onRequestPost`/`onRequest` exports present, `node --check` passes, and the full
local suite (`python3 scripts/verify_backend_mvp.py`) is green.
`wrangler pages functions build` could not run in the sandbox (npm registry
blocked).

Privileged steps remaining (Codex, on the Mac — secrets + deploy). These follow
[`backend-go-live-checklist.md`](backend-go-live-checklist.md); use **preview**
first, not production:

1. Optionally validate the bundle: `npx wrangler pages functions build` from the
   package dir (or repo) to confirm it compiles for the Workers runtime.
2. Set the env vars above in Cloudflare Pages — **Preview** first (Production
   only at real go-live).
3. Preview-deploy the package (checklist §3, `--branch shared-layout-preview`);
   do not production-deploy without an explicit user command. Then
   `curl -i https://<preview>/api/orders` with a tiny JSON body to confirm the
   route responds (expect `503 backend_not_configured` until env is set, then a
   real `order_id`).
4. Only after that: enable the checkout flag (`ordersApi.enabled=true`,
   checklist §5). The checkout is already wired behind that flag — no code edit
   needed.
