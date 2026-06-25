# Backend go-live dry-run

A short checkpoint list for each phase. Detailed steps:
[`backend-go-live-checklist.md`](backend-go-live-checklist.md); fill-in form:
[`backend-go-live-worksheet.md`](backend-go-live-worksheet.md). No secrets in
any of these files — only set/not-set, URLs, order ids.

## A. Before Supabase (Claude-safe, no secrets)

- `python3 scripts/verify_backend_mvp.py` is green (node tests, scans, package).
- `python3 scripts/check_backend_env_shape.py` runs (env "missing" here is normal).
- `python3 scripts/check_no_secrets.py` clean; `admin/config.js` is NOT tracked
  (`git check-ignore admin/config.js`).
- `data/site-config.json` → `ordersApi.enabled` is `false`.
- Package ships `functions/api/orders.js` and `admin/{index.html,admin.js,admin.logic.js}`;
  no `*.test.*` / `*.example.*` in the package.

This phase is everything Claude Code can do. STOP here for the privileged work.

## B. After Supabase + Cloudflare (Codex / user, privileged)

- Supabase project created; migration `0001_init_orders_customers.sql` applied;
  5 tables visible; RLS enabled on all.
- Admin user created with `app_metadata.is_admin = true`.
- Cloudflare **Preview** env vars set: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only), `MANAGER_WHATSAPP` (optional).
- `admin/config.js` created locally with `GM_SUPABASE_URL` + **anon** key only
  (never service_role). `python3 scripts/check_backend_env_shape.py` shows no
  forbidden secret.
- Preview-deployed (NOT production). Probe:
  `node scripts/smoke_orders_api.mjs --base-url https://<preview>` → expects 400
  (or 503 if env not set yet), creates no data.

## C. Before enabling `ordersApi.enabled` (still preview)

- Full smoke: `node scripts/smoke_orders_api.mjs --base-url https://<preview> --full`
  → 200 + `order_id`; confirm the row in Supabase, then delete the test row.
- Admin page at `/admin/`: sign in as the admin user → orders list loads; a
  status change saves; a non-admin/anon sees nothing.
- Only then set `ordersApi.enabled = true` (JSON boolean) in
  `data/site-config.json`, rebuild, preview-deploy, place a real test order →
  it saves AND WhatsApp still opens.

## D. Rollback (any time)

- Set `ordersApi.enabled = false` in `data/site-config.json`, rebuild,
  preview-deploy → checkout is WhatsApp-only again.
- Or remove the Cloudflare env vars → `/api/orders` returns `503` and the site
  falls back automatically (no order lost from the customer's side).
- Code rollback: `git checkout` the previous commit on `collab/preview-baseline`
  and redeploy preview. Production is never touched without an explicit command.
