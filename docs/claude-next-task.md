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

- `6d66c08 Add storefront consistency guardrails`
- `7059ed7 Add landing-page settings and site-integrity guardrails`

Current state:

- Backend/Supabase/Admin MVP groundwork exists.
- Checkout can use the backend behind the configured flag and still falls back to WhatsApp.
- Admin page exists and is covered by local tests.
- Product pages, landing pages, sitemap, robots, shared header/footer, menu, category strip, SEO, checkout, settings, and site integrity are covered by `scripts/verify_backend_mvp.py`.
- Latest full verifier result from Codex: 158/158 tests passed, static package OK, tracked/package secret scans clean.
- Do not push or deploy production unless the user explicitly asks.

Known harmless dirty files after a full verification run:

- `docs/project-stage-map.md` may contain a generated timestamp-only change.
- `sitemap.xml` may contain generated `lastmod` date-only changes.

Do not commit those two unless the task explicitly needs them.

## Read First

Before editing, read:

- `AGENTS.md`
- `docs/test-coverage.md`
- `docs/product-photo-rules.md`
- `docs/import-workflow.md`
- `docs/catalog-taxonomy.md`
- `docs/current-tech-improvements.md`
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

If there are unrelated or conflicting changes, stop and report them.

## Main Task — Catalog Data Quality Guardrails

Make one larger local-only pass over catalog/product data quality so future Petya photo imports and 1C stock refreshes are less likely to silently break the storefront.

Work in this order:

1. Inspect existing catalog/data tests:
   - `tests/product-consistency.test.mjs`
   - `tests/gallery-completeness.test.mjs`
   - `tests/search-categories.test.mjs`
   - `tests/settings-contract.test.mjs`
   - `tests/landing-pages.test.mjs`
2. Find 2-4 real catalog risks that are not already protected.
3. Add focused no-network tests and wire them into `scripts/verify_backend_mvp.py`.
4. Add or update a short doc section only if it helps future Codex/Claude/Petya work.
5. Keep any code changes tiny and directly tied to a failing or newly protected contract.

Good candidate areas:

- product IDs are unique and stable-looking;
- product titles are non-empty and not obvious placeholders;
- retail prices are positive, finite, and within a sane range;
- active/in-stock products have either a real image/card or are explicitly allowed as placeholder products;
- every referenced image path in `image`/`galleryImages` exists on disk;
- product category/categoryId/brand fields are internally consistent enough for filters and landing pages;
- perfume products follow the one-card-image rule and have 5 ml/travel wording;
- products with multiple images do not accidentally expose temporary Telegram/contact-sheet/OCR filenames;
- category/collection/brand landing counts are consistent with the catalog;
- search synonyms include the user brainstorm terms where appropriate and never point to missing targets.

Do not try to perfectly fix all catalog content. The goal is guardrails and small obvious fixes, not full merchandising cleanup.

## Hard Boundaries

Do not:

- push to GitHub;
- deploy preview or production;
- change Cloudflare settings;
- change Supabase settings;
- add real secrets or `.env` values;
- commit `admin/config.js`;
- commit service-role keys or screenshots;
- rewrite the architecture;
- migrate product catalog to SQL;
- run Petya import automation unless explicitly asked;
- remap product photos manually unless the task reveals a clear, tiny, safe correction;
- make large visual redesigns;
- commit timestamp-only `docs/project-stage-map.md` or date-only `sitemap.xml`.

## Verification

Before finishing, run:

```bash
node --check app.js
python3 scripts/verify_backend_mvp.py
python3 scripts/check_no_secrets.py
git diff --check
git status --short --branch
```

If you add a new test, wire it into `scripts/verify_backend_mvp.py`.

## Commit Rule

If the changes are coherent and verified, make one local commit.

Suggested message format:

```bash
git add <only relevant files>
git commit -m "Add catalog data quality guardrails"
```

If `.git/index.lock` or `.git/HEAD.lock` blocks commit and no git process is running, report the exact blocker for Codex to clear on the Mac. Do not keep retrying blindly.

## Handoff Back To Codex

Report clearly:

- commit hash if committed;
- files changed;
- checks run and whether they passed;
- dirty files left intentionally uncommitted;
- what Codex should do next;
- whether the next step is Claude-safe or Codex/user-only.

