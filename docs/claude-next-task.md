# Claude Next Task

Use this file as the next large handoff prompt for Claude Code.

## Context

Project:

```text
/Users/macmini/Documents/Codex/2026-05-28-new-chat-2
```

Current branch:

```text
collab/preview-baseline
```

Latest local checkpoints before this handoff:

- `731d2cb Add Petya perfume card batch`
- `41c6961 Add admin copy-phone and package hygiene guardrails`
- `7f5e910 Add catalog discount and searchText guardrails`

Current state:

- Public catalog has 460 products.
- Product pages generated: 92.
- Perfume is special: `categoryId: perfume` uses exactly one public card image, no front/back photos.
- Perfume coverage is complete: 22 / 22 with card images.
- Overall current photo coverage report: 92 / 460 = 20.0%.
- Backend/Supabase/Admin MVP groundwork exists, but production backend release is still user/Codex-gated.
- Checkout can save orders through `/api/orders` when enabled and still falls back to WhatsApp.
- Admin manager workflow has copy summary, copy phone, call link, reset filters, status/comment guardrails, package hygiene tests.
- Last full Codex verification after `7f5e910`: `python3 scripts/verify_backend_mvp.py` OK, 213 tests, package OK, secret scans clean.

Do not push or deploy production unless the user explicitly asks.

Known harmless dirty files after a full verification run:

- `docs/project-stage-map.md` may contain a generated timestamp/report refresh.
- `assets/products/telegram-8767964230-20260626-142813-front.jpg`
- `assets/products/telegram-8767964230-20260626-142813-back.jpg`

The two telegram jpgs are currently unused by `data/public-catalog.json`. Do not commit them unless you prove they are needed.

## Read First

Before editing, read:

- `AGENTS.md`
- `data/manual_products.json`
- `data/public-catalog.json`
- `data/product-pages.json`
- `docs/product-photo-rules.md`
- `docs/test-coverage.md`
- `scripts/report_photo_coverage.py`
- `scripts/verify_product_galleries.py`
- `scripts/generate_product_pages.py`
- `scripts/build_public_catalog.py`
- `tests/catalog-data-quality.test.mjs`
- `tests/catalog-fields.test.mjs`
- `tests/photo-coverage.test.mjs`
- `tests/catalog-image-hygiene.test.mjs`
- `/Users/macmini/.codex/shared-state/COLLAB-PROTOCOL.md`
- `/Users/macmini/.codex/shared-state/handoff.md`
- `/Users/macmini/.codex/shared-state/tasks.md`
- `/Users/macmini/.codex/shared-state/decisions.md`
- `/Users/macmini/.codex/memories/cross-chat-memory/current-focus.md`

Then run:

```bash
git status --short --branch
git branch --show-current
```

If there are unrelated or conflicting changes beyond generated-only `docs/project-stage-map.md` and the two unused telegram jpgs, stop and report them.

## Main Task — Petya Photo/Perfume Import Guardrails

Make one larger local-only pass that reduces future manual cleanup when the user sends product photos to Petya.

Focus on guardrails, reports, and documentation. Do not automate Telegram ingestion yet and do not redesign the site.

Work in this order:

1. Audit current photo/catalog rules:
   - normal products must be card/front/back;
   - perfume must be one card image only;
   - gallery images must not expose temporary Telegram/OCR/contact-sheet files;
   - `product.image` must equal the first gallery image;
   - new perfume prices must include travel-packaging logic only where documented.
2. Add or harden local tests/reports that catch mistakes from future Petya batches:
   - perfume items have exactly one `*-card-front.jpg` image;
   - non-perfume photographed items have exactly 3 gallery images unless documented exception;
   - no untracked or temporary Telegram image path is referenced in public catalog;
   - manual perfume products have `5 мл` wording, `unit: "мл"` or equivalent, and reasonable prices;
   - `registeredPriceKgs` remains a sane 1-10% discount below `retailPriceKgs`;
   - product pages and sitemap stay in sync after product generation.
3. If useful, improve `scripts/report_photo_coverage.py` output so it reports:
   - overall coverage;
   - perfume coverage;
   - non-perfume coverage;
   - incomplete non-perfume galleries;
   - unused public product images that look like raw Telegram leftovers.
4. Update docs:
   - `docs/product-photo-rules.md`
   - `docs/test-coverage.md`
   - optionally `docs/claude-next-task.md` only if handing off another task.
5. Keep changes test-only/report-only/docs-only unless a tiny generator hardening is clearly needed.

Good candidate improvements:

- Add a test that fails if any catalog image path contains `telegram-`, `ocr`, `contact`, `sheet`, `dup`, or lives outside the approved product image structure.
- Add a test that checks all perfume product images are under `assets/products/perfume/`.
- Add a test that every generated product page directory has a matching manifest entry and no orphan directories remain.
- Add a report section for "unused product images" but do not delete files automatically.
- Document the exact manual rule: if user says perfume is sold, skip; if price is supplied but no card image exists, do not add active product.

Avoid:

- new dependencies;
- Telegram bot code changes;
- broad catalog rewrite;
- runtime Supabase/network tests;
- touching Cloudflare/Supabase settings;
- production deploy;
- committing generated-only timestamp files;
- changing WhatsApp fallback behavior;
- adding real secrets or `.env` values;
- committing `admin/config.js`.

## Hard Boundaries

Do not:

- push to GitHub;
- deploy preview or production;
- change Cloudflare settings;
- change Supabase settings;
- add real secrets;
- rewrite the architecture;
- migrate product catalog to SQL;
- auto-delete product images;
- auto-map non-divisible Telegram photo groups;
- commit `docs/project-stage-map.md` unless explicitly refreshing the stage report.

## Verification

Before finishing, run:

```bash
node --check app.js
node --check admin/admin.js
node --check admin/admin.logic.js
python3 scripts/verify_product_galleries.py
python3 scripts/report_photo_coverage.py --json
python3 scripts/verify_backend_mvp.py
python3 scripts/check_no_secrets.py
git diff --check
git status --short --branch
```

If you add a new test, wire it into `scripts/verify_backend_mvp.py`.

## Commit Rule

If the changes are coherent and verified, make one local commit.

Suggested message:

```bash
git add <only relevant files>
git commit -m "Add Petya photo import guardrails"
```

If `.git/index.lock` or `.git/HEAD.lock` blocks commit and no git process is running, report the exact blocker for Codex to clear on the Mac. Do not keep retrying blindly.

## Handoff Back To Codex

Report clearly:

- commit hash if committed;
- files changed;
- checks run and whether they passed;
- dirty files left intentionally uncommitted;
- which photo/import/perfume rule was improved;
- what Codex should do next;
- whether the next step is Claude-safe or Codex/user-only.
