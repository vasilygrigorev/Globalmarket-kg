# Production readiness — Global Market KG

Status: 2026-06-26, branch `collab/preview-baseline`.

Preview backend/admin is working. Production is not deployed from this branch
yet.

## Current committed baseline

- `640ef49` — admin order details and manager workflow polish.
- `6915bbe` — orders API enabled in the Preview-ready static build.

## Do not skip

Before deploying to `https://globalmarket.kg`, confirm all items below.

1. Local verification:

   ```bash
   python3 scripts/verify_backend_mvp.py
   ```

   Required result: all tests pass, package OK, tracked-file secret scan OK,
   package secret scan OK. The node suite includes the checkout contract
   (`tests/checkout.contract.test.mjs`) and the rollback contract
   (`tests/rollback.contract.test.mjs`), which assert the WhatsApp-only fallback
   stays real in code and documented — rollback safe by construction.

2. Cloudflare Pages Production environment variables:

   - `SUPABASE_URL` is set.
   - `SUPABASE_SERVICE_ROLE_KEY` is set as a secret.
   - `MANAGER_WHATSAPP` is set or the default manager number is acceptable.

   Never write the actual values in this document, chat, git, or screenshots.

3. Browser admin config:

   - `admin/config.js` exists locally only.
   - It contains only `GM_SUPABASE_URL` and the anon/publishable key.
   - It never contains `service_role`.

4. Supabase:

   - Tables exist: `customers`, `orders`, `order_items`,
     `marketing_attribution`, `customer_consents`.
   - RLS is enabled on all five.
   - Owner/manager admin user has `app_metadata.is_admin = true`.
   - Smoke/test rows are deleted after checks.

5. Production smoke after deploy:

   ```bash
   python3 scripts/check_deployment.py --base-url https://globalmarket.kg
   node scripts/smoke_orders_api.mjs --base-url https://globalmarket.kg
   ```

   Then make one real manual checkout test from the phone:

   - WhatsApp opens.
   - Order appears in Supabase.
   - Order appears in `/admin/`.
   - Status/comment update works.

## Production rollback

Fast rollback options:

- Cloudflare Pages dashboard: restore previous production deployment.
- Or set `ordersApi.enabled=false`, rebuild, redeploy. Checkout becomes
  WhatsApp-only again.
- If only the API fails, removing Production env vars makes `/api/orders`
  return `503`, and the storefront falls back to WhatsApp.

## Claude-safe work from here

Claude can continue only on non-secret work:

- docs cleanup and consistency checks;
- fixture-based admin/checkout tests;
- improving local verification scripts;
- UI polish that does not require Cloudflare/Supabase dashboards;
- preparing a commit proposal after running verification.

Claude must stop before:

- Cloudflare Production env changes;
- Supabase key/user/SQL changes;
- production deploy;
- git push;
- writing or committing `admin/config.js`.
