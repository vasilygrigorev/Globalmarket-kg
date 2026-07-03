# Production readiness — Global Market KG

Status: 2026-07-03, branch `collab/preview-baseline`.

Preview backend/admin is working. Production is not deployed from this branch
yet. `origin/main` is 66+ commits behind this branch — nothing has been pushed
to GitHub either. Both a production deploy and a `git push` are privileged,
user-gated steps; neither has happened.

## Current committed baseline

- `c140340` — documented the release-readiness sweep tests below.
- `52c3f88` — storefront SEO/shared-block consistency guardrails (release-
  readiness sweep, part C: absolute header nav links, related-product link/
  image integrity).
- `5a817e8` — admin + checkout release-readiness guardrails (release-readiness
  sweep, parts A+B: filter composition, configured-backend load path,
  duplicate-submit guard, payload/doc contract).
- `d38e7a1` — refreshed this document for the earlier go-live handoff.
- `c4e3a27` — removed 273 unused raw Telegram/contact-sheet leftovers.
- `569e747` — Petya photo/perfume import guardrails (path hygiene, coverage
  report, docs).
- `d8444fa` — admin status colour-coding, max-amount filter, copy-address.
- `18878ba` — admin keyboard access, session resilience, exact order count.

### Release-readiness sweep (this baseline) — what's now safer

A local-only sweep from `docs/claude-next-task.md` hardened four areas without
touching architecture, secrets, or the WhatsApp fallback:

- **Admin acceptance:** a new contract test locks that every active list
  filter (status/period/min-amount/max-amount/search) chains onto the SAME
  Supabase query, so combining filters can't silently drop an earlier one; a
  second test locks that `init()` actually proceeds past the not-configured
  banner to create a real client and load orders once the backend IS
  configured (previously only the "not configured" path was tested).
- **Checkout/orders API:** the checkout submit now guards against a duplicate
  `/api/orders` POST from a quick double-click/tap (a `checkoutSubmitting`
  flag + disabled submit button, reset in a `finally` so a thrown error can't
  leave the button stuck); a new test locks that every field
  `buildOrderPayload` sends is actually read by
  `functions/api/orders.js`(`normalizeOrderPayload`), and `docs/api-orders.md`
  no longer documents a `customer.whatsapp` field the server never read
  (phone doubles as the WhatsApp contact) — that doc also now flags, as a
  known gap, that the `customers` table exists in the schema but nothing
  upserts into it yet.
- **Storefront polish:** header home/catalog/delivery/checkout links are now
  guarded to stay absolute (`/#top`, not a bare `#top`) on product/category/
  catalog pages, so "go home" can't silently break from a nested page; a new
  test walks every generated related-products section and confirms each card
  links to a product page AND an image that both actually exist on disk.
- **Petya/1C continuity:** cross-linked the existing 1C-parentheses-means-
  wash-count rule (`docs/import-workflow.md`) from `docs/product-photo-rules.md`
  so a future photo-import session finds it without already knowing it exists.

Full local suite is now 240/240 (was 213 before this sweep). Local preflight
(`python3 scripts/verify_backend_mvp.py`) is green: node suite passes,
package/secret scans clean (738 tracked files), `git diff --check` clean.
`python3 scripts/check_backend_env_shape.py` confirms `admin/config.js` is
present locally (anon key only) but `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` are not set in this shell's env — that's expected;
they live in Cloudflare, not here.

Known content gap, independent of the technical launch: only 92/460 products
(20.0%) have real photos (`python3 scripts/report_photo_coverage.py`). This
does not block a technical go-live — it's a separate, ongoing content task.

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
