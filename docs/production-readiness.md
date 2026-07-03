# Production readiness — Global Market KG

Status: 2026-07-03, branch `collab/preview-baseline`, commit `4d3e750`.

This is the short decision checklist. For exact commands, use
[`backend-go-live-checklist.md`](backend-go-live-checklist.md) (privileged
steps) and [`final-owner-handoff.md`](final-owner-handoff.md) (plain-language
summary for the owner).

## 1. Ready locally

- Branch: `collab/preview-baseline`. Latest commit: `4d3e750` (this file's
  status commit is the next one on top).
- Full local test suite: **240/240 green**
  (`python3 scripts/verify_backend_mvp.py`).
- Static package builds clean: 633 files, 0 build/package errors, internal
  links 0 errors/0 warnings (6226 links checked), every product page has
  valid Product + BreadcrumbList JSON-LD.
- Secret scans clean: tracked files (738) and the built package both scan
  clean (`python3 scripts/check_no_secrets.py`). `admin/config.js` is
  git-ignored, untracked, and contains only the public anon key — never
  `service_role`; it ships in the package on purpose (the browser needs the
  anon key), the service-role key never does.
- Product photo gallery contract: 0 violations
  (`python3 scripts/verify_product_galleries.py`); no raw Telegram/OCR/
  contact-sheet files can reach a published path (guarded by tests + the
  verifier).
- Checkout → WhatsApp fallback is real in code, not just in docs: the
  checkout submit always ends by opening WhatsApp, guarded against a
  duplicate submission on a quick double-click, and `saveOrderViaApi` returns
  `null` (never throws) if the backend is off, unreachable, or times out —
  enforced by `tests/checkout.contract.test.mjs` +
  `tests/rollback.contract.test.mjs`.
- `git diff --check`: clean (no trailing-whitespace/whitespace-error issues).

## 2. Requires user/Codex production action

Nothing further is Claude-safe here — every remaining item needs dashboard
access, secrets, or an explicit deploy/push decision:

1. **Cloudflare Pages Production environment variables** — `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` (secret), `MANAGER_WHATSAPP` (optional).
   Preview already has these; Production does not.
2. **Supabase admin user** — confirm an owner/manager user exists with
   `app_metadata.is_admin = true` for the Production admin login.
3. **Production deploy** (direct `wrangler` upload, not GitHub-triggered):
   ```bash
   python3 scripts/package_static_site.py
   wrangler pages deploy /private/tmp/globalmarket-static-build \
     --project-name globalmarket-kg --branch main --commit-dirty=true
   ```
4. **Production smoke test**:
   ```bash
   python3 scripts/check_deployment.py --base-url https://globalmarket.kg
   node scripts/smoke_orders_api.mjs --base-url https://globalmarket.kg
   ```
   Then one real manual checkout from a phone: WhatsApp opens, the order
   appears in Supabase, the order appears in `/admin/`, a status/comment save
   works. Delete the smoke-test row afterward.
5. **`git push` / merge decision** — separate from the deploy above (Cloudflare
   deploy is a direct file upload, not GitHub CI). `origin/main` is 66+
   commits behind `collab/preview-baseline`; nothing has been pushed. Decide
   how this branch reaches GitHub (fast-forward `main`, PR, squash) before
   pushing — this is a real decision, not a default action.

Full step-by-step with exact commands: `backend-go-live-checklist.md`.

## 3. Not blocking launch

These are real, known, and intentionally deferred — none of them stop a
technical go-live:

- **Photo coverage is 92/460 (20.0%)** — an ongoing content task (Petya
  uploads + manual review), independent of the backend/admin/checkout code
  path. `python3 scripts/report_photo_coverage.py` stays the source of truth;
  it also reports unused raw-leftover files for cleanup (currently 0).
- **The `customers` table is defined in the schema but nothing upserts into
  it yet** — every order still writes correctly (`orders`, `order_items`,
  `marketing_attribution`, `customer_consents`); a returning-customer
  history/profile feature would need that added later. See the "Known gap"
  note in `docs/api-orders.md`.
- **Reviews, a chatbot, or a CRM layer** are not built and are explicitly
  future phases, not part of this MVP.
- General visual/content polish can continue after launch without touching
  the backend contract.

## 4. Rollback

Fast, non-destructive, no code change needed:

- Cloudflare Pages dashboard → restore the previous Production deployment.
- Or set `ordersApi.enabled=false` in `data/site-config.json`, rebuild,
  redeploy → checkout becomes WhatsApp-only again immediately.
- Or remove the Production `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env
  vars → `/api/orders` returns `503` and the storefront falls back to
  WhatsApp automatically — no redeploy required.

## Claude-safe work from here

None identified as blocking. See `docs/claude-next-task.md` for the current
status line. If new Claude-safe work is wanted later (more photo coverage
guardrails, more docs polish), it should be scoped as its own task — this
document's job is the go/no-go checklist, not a backlog.

Claude must stop before: Cloudflare Production env changes, Supabase key/user/
SQL changes, production deploy, `git push`, writing or committing
`admin/config.js`.
