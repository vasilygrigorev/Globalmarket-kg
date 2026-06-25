# Admin Orders Page — implementation spec

> STATUS (2026-06-25): BUILT as static files `admin/index.html` + `admin/admin.js`
> (+ `admin/config.example.js`; real `admin/config.js` is git-ignored). Shipped by
> the packager, `noindex` + `Disallow: /admin/`. Not functional until a Supabase
> project exists and `admin/config.js` is filled with the URL + anon key, and an
> admin user has `app_metadata.is_admin = true`. See go-live checklist §6.


Blueprint for the first admin screen of Global Market KG: view and manage
orders captured by `POST /api/orders`. Build this only after the
[go-live checklist](backend-go-live-checklist.md) steps 1-4 pass (Supabase
project + migration + Cloudflare env + a verified test order).

Boundaries: no service-role key in the browser; admin access enforced by RLS
(`public.is_admin()`); no production deploy / push without user sign-off.

## DOM contract (enforced by tests)

`admin/index.html` must declare these element ids (the admin JS depends on them):
`who`, `signOut`, `notConfigured`, `loginView`, `loginForm`, `email`,
`password`, `loginError`, `accessView`, `accessEmail`, `listView`,
`statusFilter`, `search`, `refresh`, `ordersBody`, `detailView`, `backToList`,
`detailBody`. The order-detail ids (`editStatus`, `editComment`, `saveOrder`,
`saveMsg`) are created at runtime by `renderOrderDetail()` in `admin.logic.js`
and must NOT be hard-coded in the HTML.

`admin/admin.dom.test.mjs` checks this non-network contract: required ids exist,
every id `admin.js` looks up via `$("…")` is either declared in the HTML or
created in `admin.logic.js`, the page loads `config.js` then `admin.js` (module),
and the page is `noindex`. Run with the rest:
`node --test functions/api/orders.test.mjs functions/api/orders.integration.test.mjs admin/admin.logic.test.mjs admin/admin.dom.test.mjs`.

## UX states (practical, not decorative)

The admin handles these states with clear text (pure helpers in
`admin.logic.js`, tested in `admin.logic.test.mjs`):

- **Loading** — orders table shows `loadingRowHtml()` ("Загрузка…") while
  fetching; order detail shows "Загрузка…".
- **Login in progress** — submit button shows `loginButtonLabel(true)`
  ("Входим…") and is disabled during the auth request.
- **Login error** — `friendlyError()` maps JWT/permission/network errors to
  readable RU text in the login banner.
- **Empty list** — `emptyOrdersMessage()` distinguishes "no orders yet / no
  admin rights" from "nothing matches this filter".
- **No access** — `nextView()` routes a non-admin session to the access screen
  (RLS is still the real guard).
- **Save feedback** — `saveFeedback("saving"|"done"|"error")` returns
  `{text, ok}`; the save button is disabled during the request and the message
  turns green (`.ok`) on success.

## Local preflight

`python3 scripts/verify_backend_mvp.py` is the single local preflight: it runs
the node tests (orders API + admin logic + admin DOM contract), `node --check`
on the admin JS + smoke script, `py_compile` on the backend/admin Python
scripts, the git-tracked secret scan, then the static package build + package
secret scan. Use `--skip-package` for a quick code-only pass. Run it before
asking Codex to commit. No network/secrets required.

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

1. **Login** — email/password; on success, the client performs a fast UX guard
   by checking `session.user.app_metadata.is_admin === true`. If the flag is
   missing, the page shows "no access" before loading orders. This is only a
   usability guard; RLS remains the real protection and must still block all
   reads/writes for non-admin users.
2. **Orders list** — table: date, customer, phone, city, total, status badge,
   source. Controls: status filter, search box, pagination, refresh.
3. **Order card** — contact + address, line items (title/qty/price/line total),
   attribution (utm/referrer/manual/promo), totals; editable status dropdown and
   manager comment with Save.

Keep it plain and fast (no framework needed). Mobile-friendly.

## Security checklist

- [ ] Only the anon key in the browser; never the service role key.
- [ ] All reads/writes rely on RLS + `is_admin()`; no RLS bypass in the client.
- [ ] Admin users have `app_metadata.is_admin = true` in Supabase Auth, so the
      static UI can show a clear no-access state before querying orders.
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
