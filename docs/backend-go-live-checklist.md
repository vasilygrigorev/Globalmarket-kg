# Backend MVP — go-live checklist

Step-by-step to bring the order-capture backend online for Global Market KG.
This is the privileged sequence (Supabase project, secrets, deploy) — run by
Codex / the user. **No secrets belong in git.** Boundaries: no production deploy
and no GitHub push without an explicit user request.

Related: [`backend-mvp-plan.md`](backend-mvp-plan.md) ·
[`supabase-setup.md`](supabase-setup.md) · [`api-orders.md`](api-orders.md).

Current state (HEAD `c3246c1`): schema migration, `functions/api/orders.js`
(+ unit & integration tests, 14/14), deploy-package support for `functions/`,
disabled checkout wiring, and the static admin skeleton are committed. The
checkout flag is still off, so WhatsApp-only behavior remains unchanged. The
endpoint returns `503 backend_not_configured` until the env vars below are set.

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

## Safety: secret scan (run before any commit and before deploy)

```bash
python3 scripts/check_no_secrets.py                      # git-tracked files
python3 scripts/check_no_secrets.py --package /private/tmp/globalmarket-static-build
```

Catches accidentally committed/shipped secrets: JWT/Supabase keys, `.env`
files, a git-committed `admin/config.js`, or a `service_role` value. The PUBLIC
anon key inside a deployed `admin/config.js` is allowed (package mode only);
the service_role key is never allowed anywhere. Exit code 1 = stop and fix.

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

## 5. Enable the checkout flag (only after steps 1-4 pass)

The checkout is already wired in `app.js` behind a disabled flag — no code change
needed, just flip it:

- [ ] In `data/site-config.json` set `ordersApi.enabled` to `true`.
- [ ] Bump the asset cache version (`?v=`) so clients pick up the new config/app.
- [ ] Rebuild + preview deploy + place a real test order from the preview site;
  confirm it saves to Supabase AND WhatsApp still opens. Delete the test row.
- [ ] If anything misbehaves, set the flag back to `false` (instant rollback to
  WhatsApp-only). Details: [`api-orders.md`](api-orders.md).

This is a normal storefront change; Claude Code can do the wiring once the
endpoint is confirmed working on preview.

## 6. Admin orders page

The admin page is already built (static files, gated at runtime by Supabase auth
+ RLS): `admin/index.html` + `admin/admin.js`. It ships in the deploy package and
is `noindex` + `Disallow: /admin/`. Until configured it shows a "not configured"
banner. To enable:

- [ ] In Supabase, create a manager/owner user and set
  `app_metadata.is_admin = true` (Auth admin API).
- [ ] Copy `admin/config.example.js` → `admin/config.js` (git-ignored) and fill
  `GM_SUPABASE_URL` + the **anon** (publishable) key. Never the service_role key.
- [ ] Rebuild + preview deploy; open `/admin/`, sign in, confirm the orders list
  loads and a status change saves. A non-admin must see no order data.

Full blueprint (queries, auth model, acceptance):
[`admin-orders-spec.md`](admin-orders-spec.md).

## Rollback

Preview only; production untouched. To revert, redeploy the previous preview
package or `git checkout` the previous commit. Removing the Cloudflare env vars
makes the endpoint return `503` and the site falls back to WhatsApp-only.
