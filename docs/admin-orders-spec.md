# Admin Orders Page — implementation spec

Blueprint for the first admin screen of Global Market KG: view and manage
orders captured by `POST /api/orders`. Build this only after the
[go-live checklist](backend-go-live-checklist.md) steps 1-4 pass (Supabase
project + migration + Cloudflare env + a verified test order).

Boundaries: no service-role key in the browser; admin access enforced by RLS
(`public.is_admin()`); no production deploy / push without user sign-off.

## Auth & access model

- The admin page is a static page served by Cloudflare Pages, using the Supabase
  JS client (`@supabase/supabase-js` from CDN) with the **anon** key only.
- Admin signs in with email + password via Supabase Auth (owner creates the user
  in Supabase; set `app_metadata.is_admin = true`).
- RLS does the enforcement: the existing policies allow `select` on all tables
  and `update` on `orders`/`customers` only when `public.is_admin()` is true.
  A non-admin authenticated user (or anon) sees nothing — so even if the page
  loads, no data leaks.
- The anon key is publishable (safe in client code), but it is project-specific.
  Store it in a git-ignored `admin/config.js`; commit `admin/config.example.js`.

## Files (proposed)

```text
admin/
  index.html              # login + orders UI (single file, vanilla JS + supabase-js CDN)
  config.example.js       # window.GM_SUPABASE_URL / GM_SUPABASE_ANON_KEY placeholders (committed)
  config.js               # real values (GIT-IGNORED, owner-filled)
```

Add to `.gitignore`: `admin/config.js`. The packager should ship `admin/` (incl.
`config.js` when present) but never the example as the live config. If
`config.js` is absent at build time, ship `index.html` + a clear "not configured"
message rather than failing the build.

## Data queries (via supabase-js, anon key + admin session)

- List (newest first, paged):
  `from('orders').select('id,created_at,status,total_kgs,customer_name,customer_phone,city,customer_source').order('created_at',{ascending:false}).range(a,b)`
- Filter by status: `.eq('status', <status>)`
- Search by phone/name: `.or('customer_phone.ilike.%q%,customer_name.ilike.%q%')`
- Order detail: order row + `from('order_items').select('*').eq('order_id',id)`
  + `from('marketing_attribution').select('*').eq('order_id',id)`.
- Update status: `from('orders').update({status}).eq('id',id)` (RLS-gated).
- Update manager comment: `from('orders').update({manager_comment}).eq('id',id)`.

Statuses: `new`, `contacted`, `confirmed`, `completed`, `cancelled` (matches the
DB CHECK constraint).

## Screens (MVP)

1. **Login** — email/password; on success, verify `is_admin` by attempting a
   1-row `orders` select (empty/allowed = admin; error/empty due to RLS = not
   admin → show "no access").
2. **Orders list** — table: date, customer, phone, city, total, status badge,
   source. Controls: status filter, search box, pagination, refresh.
3. **Order card** — contact + address, line items (title/qty/price/line total),
   attribution (utm/referrer/manual/promo), totals; editable status dropdown and
   manager comment with Save.

Keep it plain and fast (no framework needed). Mobile-friendly.

## Security checklist

- [ ] Only the anon key in the browser; never the service role key.
- [ ] All reads/writes rely on RLS + `is_admin()`; no RLS bypass in the client.
- [ ] `admin/config.js` git-ignored; no keys committed.
- [ ] Sign-out clears the session; the page shows nothing when logged out.
- [ ] Consider gating `/admin` behind Cloudflare Access later for defense-in-depth.

## Acceptance criteria

- [ ] Admin can log in; non-admin/anon sees no order data.
- [ ] List shows orders newest-first with status filter + phone/name search.
- [ ] Order card shows items + attribution and allows status change + manager
      comment, persisted (verify in Supabase).
- [ ] Page is static, deployed on preview, no secrets in git, WhatsApp order flow
      unaffected.

## Build order

1. Owner creates an admin user (+ `is_admin` flag) in Supabase.
2. Add `admin/` files; fill `admin/config.js` locally (git-ignored).
3. Build + preview deploy; test login + list + status change against preview.
4. Then iterate (filters, pagination polish).
