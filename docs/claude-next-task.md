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
- `01b978c Update Claude catalog data quality handoff`
- `534fcb5 Add catalog field and synonym term guardrails`

Current state:

- Backend/Supabase/Admin MVP groundwork exists.
- Checkout can use the backend behind the configured flag and still falls back to WhatsApp.
- Admin page exists and is covered by local tests.
- Product pages, landing pages, sitemap, robots, shared header/footer, menu, category strip, SEO, checkout, settings, catalog fields, search synonyms, and site integrity are covered by `scripts/verify_backend_mvp.py`.
- Latest full verifier result from Codex after `534fcb5`: `Backend/admin MVP verification OK`; package OK; tracked/package secret scans clean.
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

If there are unrelated or conflicting changes beyond generated-only `docs/project-stage-map.md` / `sitemap.xml`, stop and report them.

## Main Task — Photo Coverage And Import Workflow Guardrails

Make one larger local-only pass that helps the owner and Codex understand what still lacks photos and prevents future Petya/1C workflow drift.

Work in this order:

1. Inspect existing photo/catalog/import tools and docs:
   - `scripts/verify_product_galleries.py`
   - `scripts/verify_backend_mvp.py`
   - `scripts/import_*` and `scripts/*stock*` if present
   - `docs/product-photo-rules.md`
   - `docs/import-workflow.md`
   - `docs/test-coverage.md`
   - `data/public-catalog.json`
2. Add a small deterministic report or test layer for catalog photo coverage:
   - total products;
   - products with real product photos;
   - percentage with photos;
   - count by main category;
   - products with placeholders;
   - products with incomplete galleries/exceptions;
   - perfume one-image exceptions handled separately.
3. Prefer a committed script/test over a generated output file. Generated reports under `outputs/` may be created by verification but should not be committed unless this repo already commits that class of report.
4. Wire any new test/check into `scripts/verify_backend_mvp.py`.
5. Update `docs/test-coverage.md` and, if needed, a short section in `docs/product-photo-rules.md` or `docs/import-workflow.md`.
6. Keep code changes small and deterministic. Do not attempt to remap many products or edit product data unless there is a tiny obvious bug revealed by the new guardrail.

Good candidate deliverables:

- `tests/photo-coverage-report.test.mjs` or similar no-network contract test;
- `scripts/report_photo_coverage.py` or `.mjs` if a reusable report is more useful than a test;
- a documented command for Codex/user to see current photo percentage after Petya uploads;
- verifier wiring so future batches catch broken image coverage assumptions.

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
- make visual redesigns;
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

If you add a new test or report check, wire it into `scripts/verify_backend_mvp.py`.

## Commit Rule

If the changes are coherent and verified, make one local commit.

Suggested message format:

```bash
git add <only relevant files>
git commit -m "Add photo coverage workflow guardrails"
```

If `.git/index.lock` or `.git/HEAD.lock` blocks commit and no git process is running, report the exact blocker for Codex to clear on the Mac. Do not keep retrying blindly.

## Handoff Back To Codex

Report clearly:

- commit hash if committed;
- files changed;
- checks run and whether they passed;
- dirty files left intentionally uncommitted;
- current photo coverage percent;
- what Codex should do next;
- whether the next step is Claude-safe or Codex/user-only.
