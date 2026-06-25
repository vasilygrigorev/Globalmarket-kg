# Backend MVP — go-live checklist

Step-by-step to bring the order-capture backend online for Global Market KG.
This is the privileged sequence (Supabase project, secrets, deploy) — run by
Codex / the user. **No secrets belong in git.** Boundaries: no production deploy
and no GitHub push without an explicit user request.

Related: [`backend-mvp-plan.md`](backend-mvp-plan.md) ·
[`supabase-setup.md`](supabase-setup.md) · [`api-orders.md`](api-orders.md).

Current state (HEAD `40899b3`): schema migration, `functions/api/orders.js`
(+ unit & integration tests, 14/14), and the packager that ships `functions/`
are all committed. Nothing is wired to live checkout yet. The endpoint returns
`503 backend_not_configured` until the env vars below are set.

---

## 1. Supabase project + migration

- [ ] Create a Supabase project (region near KG, e.g. EU). Note the Project ref.
- [ ] Apply the migration `supabase/migrations/0001_init_orders_customers.sql`:
  - SQL editor: paste the file contents and run; **or**
  - CLI:
    ```bash
    supabase link --project-ref <project-ref>
    supabase db push
    ```
- [ ] In Table Editor confirm the 5 tables exist and **RLS is enabled** on each:
  `customers`, `orders`, `order_items`, `marketing_attribution`,
  `customer_consents`.
- [ ] Grab keys from Project Settings → API:
  - `Project URL` → used as `SUPABASE_URL`
  - `service_role` secret → used as `SUPABASE_SERVICE_ROLE_KEY` (server only!)
- [ ] Optional: create an admin user and set `app_metadata.is_admin = true`
  (Auth admin API) for the future admin page.

## 2. Cloudflare Pages env vars (secrets — never in git)

Cloudflare dashboard → Pages → `globalmarket-kg` → Settings → Environment
variables. Add to **Preview** (and later Production) the following:

- [ ] `SUPABASE_URL` = `https://<project>.supabase.co`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `<service_role secret>`
- [ ] `MANAGER_WHATSAPP` = `996706771103` (digits only; optional, has a default)

Do not commit these. The browser must only ever see the `anon` key (not used by
the function); `service_role` stays server-side in the Pages Function env.

> Requires Supabase + Cloudflare dashboard access / secrets. If Claude Code is
> doing the work, this is the **stop-and-handoff** point — Codex/user set these.

## 3. Build + preview deploy

- [ ] Build & package (includes `functions/`, excludes tests):
  ```bash
  PYTHONPYCACHEPREFIX=/private/tmp/pycache-globalmarket \
    python3 scripts/package_static_site.py --include-reports
  ```
- [ ] (Optional) Validate the function bundle compiles for Workers:
  ```bash
  npx --yes wrangler pages functions build
  ```
- [ ] Preview deploy (NOT production):
  ```bash
  npx --yes wrangler pages deploy /private/tmp/globalmarket-static-build \
    --project-name globalmarket-kg \
    --branch shared-layout-preview \
    --commit-dirty=true --skip-caching
  ```
  Preview alias: `https://shared-layout-preview.globalmarket-kg.pages.dev`

## 4. Verify the endpoint

- [ ] Probe (creates no data — expects 400, or 503 if env not set yet):
  ```bash
  node scripts/smoke_orders_api.mjs --base-url https://shared-layout-preview.globalmarket-kg.pages.dev
  ```
- [ ] Full check (creates one TEST order — preview only):
  ```bash
  node scripts/smoke_orders_api.mjs --base-url https://shared-layout-preview.globalmarket-kg.pages.dev --full
  ```
- [ ] In Supabase Table Editor confirm a row appeared in `orders` + `order_items`,
  then **delete the SMOKE TEST row**.

## 5. Wire the checkout (only after steps 1-4 pass)

- [ ] Apply the `app.js` checkout snippet from [`api-orders.md`](api-orders.md)
  (save-then-WhatsApp, with fallback to WhatsApp-only on any failure).
- [ ] Rebuild + preview deploy + place a real test order from the preview site;
  confirm it saves AND WhatsApp still opens.
- [ ] Bump the asset cache version (`?v=`) so clients pick up the new `app.js`.

This is a normal storefront change; Claude Code can do the wiring once the
endpoint is confirmed working on preview.

## 6. Admin orders page (next milestone)

- [ ] Simple page: list orders, order card, status change, manager comment,
  search by phone/name, filter by status, view ad source — gated by
  `public.is_admin()` via Supabase Auth (anon key + signed-in admin).
  Full blueprint (queries, auth, files, acceptance):
  [`admin-orders-spec.md`](admin-orders-spec.md).

## Rollback

Preview only; production untouched. To revert, redeploy the previous preview
package or `git checkout` the previous commit. Removing the Cloudflare env vars
makes the endpoint return `503` and the site falls back to WhatsApp-only.
