# Backend go-live worksheet

Fill this in as you run the go-live steps. **Do not write any secret values
here** — only yes/no, a URL, or an order id. Keys live only in Cloudflare env
and (anon key) in git-ignored `admin/config.js`.

Run the safe local preflight first: `python3 scripts/verify_backend_mvp.py`.
Shape check (no values): `python3 scripts/check_backend_env_shape.py`.

Full step-by-step: [`backend-go-live-checklist.md`](backend-go-live-checklist.md).

## Who does what

- **Claude Code (no secrets):** code, tests, docs, packaging, the disabled
  checkout flag, the admin static page. Stops at anything needing real
  Supabase/Cloudflare access.
- **Codex / user (privileged):** create the Supabase project, apply the
  migration, set Cloudflare env vars, create the admin user, deploy preview,
  flip the flag, run the live smoke test.

## Worksheet

Date started: ____________   Operator: ____________

| # | Step | Status |
|---|------|--------|
| 1 | Supabase project created | [ ] yes / [ ] no |
| 2 | Migration `0001_init_orders_customers.sql` applied | [ ] yes / [ ] no |
| 3 | Tables visible (customers, orders, order_items, marketing_attribution, customer_consents) | [ ] yes / [ ] no |
| 4 | RLS enabled on all 5 tables | [ ] yes / [ ] no |
| 5 | Admin user created in Supabase Auth | [ ] yes / [ ] no |
| 6 | `app_metadata.is_admin = true` on that user | [ ] yes / [ ] no |
| 7 | Cloudflare **Preview** env vars set (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MANAGER_WHATSAPP`) | [ ] set / [ ] not set |
| 8 | `admin/config.js` created locally (URL + **anon** key only) | [ ] set / [ ] not set |
| 9 | Preview deployed | URL: `__________________________` |
| 10 | Smoke probe passed (`check_backend_env_shape.py` + `smoke_orders_api.mjs --base-url …`) | [ ] yes / [ ] no |
| 11 | Smoke full order created | order id: `__________________` |
| 12 | Smoke test row deleted from Supabase | [ ] yes / [ ] no |
| 13 | `ordersApi.enabled = true` on **preview** (flag, not prod) | [ ] yes / [ ] no |
| 14 | Real test order on preview saved AND WhatsApp opened | [ ] yes / [ ] no |
| 15 | Admin page lists the order; status change saved | [ ] yes / [ ] no |
| 16 | Rollback confirmed (set flag back to `false` → WhatsApp-only) | [ ] yes / [ ] no |

## Rollback to WhatsApp-only

At any point, set `ordersApi.enabled` back to `false` in
`data/site-config.json`, rebuild, redeploy preview. The checkout then behaves
exactly as today (opens WhatsApp, no backend call). Removing the Cloudflare env
vars also makes `/api/orders` return `503` and the site falls back automatically.

## Notes (no secrets)

____________________________________________________________

____________________________________________________________
