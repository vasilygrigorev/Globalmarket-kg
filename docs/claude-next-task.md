# Claude Next Task

Use this file as the next large handoff prompt for Claude Code.

## Context

Project:

```text
/Users/macmini/Documents/Codex/2026-05-28-new-chat-2
```

Branch:

```text
collab/preview-baseline
```

Recent checkpoints:

- `731d2cb Add Petya perfume card batch`
- `41c6961 Add admin copy-phone and package hygiene guardrails`
- `7f5e910 Add catalog discount and searchText guardrails`
- `d370354 Update Claude Petya photo guardrails handoff`
- `18878ba Add admin keyboard access, session resilience, and exact order count`
- `d8444fa Add admin status colour-coding, max-amount filter, and copy-address`

Last Codex verification after `d8444fa`:

- `python3 scripts/verify_backend_mvp.py` OK.
- 228 tests pass.
- `python3 scripts/check_no_secrets.py` clean.
- `git diff --check` clean.

Current known harmless dirty files after verification:

- `docs/project-stage-map.md` generated stage report timestamp/change.
- `sitemap.xml` generated `lastmod` date-only refresh.

Note: the two unused telegram jpgs previously listed here (`telegram-8767964230-
20260626-142813-front.jpg` / `-back.jpg`) were removed with the rest of the raw
Telegram leftovers in `569e747` + the follow-up cleanup — see
`shared-state/handoff.md` / `cross-chat-memory/current-focus.md` for details.

## Important Direction

Do **not** continue admin UX work in this pass unless a failing test requires a tiny fix.

This task is specifically about Petya/photo/catalog import guardrails.

The goal is to make future photo batches safer and easier to review, especially:

- normal product galleries;
- perfume card-only items;
- unused Telegram image leftovers;
- photo coverage reporting;
- import rules documentation.

## Read First

Read these files before editing:

- `AGENTS.md`
- `docs/product-photo-rules.md`
- `docs/test-coverage.md`
- `data/manual_products.json`
- `data/public-catalog.json`
- `data/product-pages.json`
- `scripts/report_photo_coverage.py`
- `scripts/verify_product_galleries.py`
- `scripts/generate_product_pages.py`
- `scripts/build_public_catalog.py`
- `tests/photo-coverage.test.mjs`
- `tests/catalog-image-hygiene.test.mjs`
- `tests/catalog-data-quality.test.mjs`
- `tests/catalog-fields.test.mjs`
- `/Users/macmini/.codex/shared-state/COLLAB-PROTOCOL.md`
- `/Users/macmini/.codex/shared-state/handoff.md`
- `/Users/macmini/.codex/shared-state/tasks.md`
- `/Users/macmini/.codex/memories/cross-chat-memory/current-focus.md`

Then run:

```bash
git status --short --branch
git branch --show-current
```

If there are unrelated changes beyond the known harmless dirty files, stop and report them.

## Main Task — Petya Photo/Perfume Import Guardrails

Make one coherent local-only pass.

### Part A — Reporting

Improve `scripts/report_photo_coverage.py` so it can report, in JSON and human-readable mode if simple:

- total product count;
- products with photos;
- overall coverage percent;
- perfume total and perfume with photos;
- non-perfume total and non-perfume with complete 3-image galleries;
- incomplete non-perfume galleries;
- known exceptions;
- unused files under `assets/products/` that look like raw Telegram leftovers and are not referenced by the public catalog.

Do not delete unused files automatically. Report only.

### Part B — Guardrail Tests

Add or harden tests, preferably reusing existing test files unless a new focused file is cleaner:

- perfume products must have exactly one image;
- perfume image path must live under `assets/products/perfume/`;
- perfume public image should look like a card image (`card-front` naming);
- non-perfume photographed products must have either 0 images or exactly 3 gallery images unless they are documented exceptions;
- no public catalog image path may contain raw/temp words such as `telegram-`, `ocr`, `contact`, `sheet`, `dup`;
- no public catalog image path may point outside approved public product image folders;
- product pages must stay in sync with product manifest and no orphan product dirs remain.

If you add a new test file, wire it into `scripts/verify_backend_mvp.py`.

### Part C — Documentation

Update docs so future sessions remember the rule:

- `docs/product-photo-rules.md`
- `docs/test-coverage.md`

Document:

- Petya normal products: expected card/front/back.
- Petya perfume: card only.
- If user marks perfume sold, skip active catalog.
- If user gives a perfume price but no matching card image exists, do not add active product.
- Do not publish raw Telegram/OCR/contact-sheet files in `galleryImages`.
- `product.image` must equal the first gallery image.

## Boundaries

Do not:

- push to GitHub;
- deploy preview or production;
- change Cloudflare/Supabase settings;
- add secrets or `.env` values;
- commit `admin/config.js`;
- work on admin UX unless required by failing tests;
- change Telegram bot code;
- auto-delete product images;
- auto-map non-divisible Telegram albums;
- migrate catalog to SQL;
- change checkout/WhatsApp behavior;
- commit `docs/project-stage-map.md` unless explicitly asked.

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

## Commit Rule

If the work is coherent and verified, make one local commit.

Suggested message:

```bash
git add <only relevant files>
git commit -m "Add Petya photo import guardrails"
```

Do not commit the known generated/unused dirty files unless the work intentionally changes them.

## Handoff Back To Codex

Report:

- commit hash;
- files changed;
- checks run;
- photo coverage numbers;
- any unused Telegram files reported;
- dirty files intentionally left;
- whether next step is Claude-safe or Codex/user-only.
