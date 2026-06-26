# Admin / backend MVP — next steps

Snapshot of where the order backend + admin stand and what is left. Preview is
live; production is untouched.

## Done (local, no secrets)

- Supabase schema migration (`supabase/migrations/0001_init_orders_customers.sql`)
  with RLS; orders API Pages Function (`functions/api/orders.js`) + tests.
- Checkout wired behind `ordersApi.enabled` (WhatsApp fallback on any failure).
- Admin page (`admin/`): login, no-access screen, orders list (RU statuses,
  count, manager hint), order detail (items, total, address, client comment,
  ad source, promo, consent, customer WhatsApp link), loading/empty/error/save
  states. Pure logic in `admin/admin.logic.js`, covered by
  `admin/admin.logic.test.mjs` + `admin/admin.dom.test.mjs`.
- Guards: `check_no_secrets.py`, `check_backend_env_shape.py`,
  `verify_static_package.py` (admin/functions/secret checks),
  `verify_backend_mvp.py` (single local preflight). Admin runtime is anon-only
  (a test asserts no `service_role` in shipped admin files).
- Go-live docs: checklist, worksheet, dry-run, manual-check, supabase-setup,
  api-orders.

## What the user/operator should verify (preview)

- Run through `docs/admin-manual-check.md` on the preview admin: login as the
  admin user, list/filter/search, open an order, change status + save, contact
  link, sign out. Confirm a non-admin sees no data.
- Place a real preview test order (checkout) → confirm it saves AND WhatsApp
  opens; then check it appears in the admin and delete any test rows.

## What stays for Codex / user (privileged)

- Commit the working-tree groups (preview flag/asset-version + admin UX) per the
  handoff.
- Decide on production go-live: set Production env vars, production deploy, flip
  the flag on production — only on explicit user command. Until then, production
  stays WhatsApp-only.
- Optional later: pagination for large order lists, CSV export, order search by
  date range, reviews tables (`backend-mvp-plan.md`).

## Stop point for Claude Code

Everything above the "privileged" line is done locally and verified with
`python3 scripts/verify_backend_mvp.py`. Anything requiring Supabase/Cloudflare
dashboards, secrets, deploy, or production is handed to Codex/user.
