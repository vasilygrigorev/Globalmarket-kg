# Claude Next Task

## Goal

Do one focused photo-quality cleanup pass: review the remaining documented
incomplete galleries and produce a practical next shooting/import priority list.

Project:

```bash
cd /Users/macmini/Documents/Codex/2026-05-28-new-chat-2
```

## Start

1. Read:
   - `AGENTS.md`
   - `docs/product-photo-rules.md`
   - `docs/pending-photo-review.md`
   - `/Users/macmini/.codex/shared-state/handoff.md`
   - `/Users/macmini/.codex/memories/cross-chat-memory/current-focus.md`
2. Run:

```bash
git status --short --branch
```

Do not touch Supabase, Cloudflare, secrets, deploy, push, or `admin/config.js`.
Do not publish uncertain photos.

Known harmless dirty/generated files:

- `docs/project-stage-map.md`
- `sitemap.xml`

Do not commit those unless this task intentionally regenerates final public
outputs and the diff is reviewed.

## Context

Latest relevant commit:

- `2e0b0a6 Add Petya raw photo triage guardrail`

Current photo baseline:

- 529 total products.
- 122 products with real photos.
- 23.1% photo coverage.
- Current Dove raw leftovers are documented in `docs/pending-photo-review.md`;
  do not publish them until Petya/user supplies missing card-front photos or
  explicitly approves a 2-photo exception.

The known incomplete-gallery exceptions are listed in:

- `AGENTS.md`
- `docs/product-photo-rules.md`
- `scripts/verify_product_galleries.py`
- `scripts/report_photo_coverage.py`

Known exception ids:

- `prd_432b62d4b317` / `TRESemmé Clean & Replenish шампунь 828 мл`
- `prd_1f1557a2acbb` / `Pantene Damage Repair шампунь 600 мл`
- `prd_296bd01a7c1f` / `Pantene Sheer Volume шампунь 600 мл`

## Task A — Re-audit the 3 documented incomplete-gallery exceptions

For each of the 3 known exceptions:

1. Check `data/public-catalog.json` and `data/product_overrides.json`.
2. Check whether a plausible missing back photo now exists anywhere under:
   - `assets/products/`
   - any brand subfolder
   - documented Petya/raw leftovers
3. If a missing back photo is found with high confidence:
   - move/copy it into the correct brand folder using a stable semantic name;
   - update `galleryImages` so the normal 3-image contract is restored;
   - remove that product from all exception lists consistently.
4. If not found:
   - leave the exception in place;
   - update a concise review note with exactly what is missing.

Do not guess. A wrong back photo is worse than a known exception.

## Task B — Produce a photo priority list

Create or update a concise markdown report, for example:

```text
docs/photo-priority-list.md
```

It should help the owner decide what to photograph next.

Include:

- photo coverage by category;
- top 20 in-stock products without photos that are likely most valuable to
  photograph next;
- obvious category gaps, e.g. oral care / food / cleaning if coverage is low;
- products waiting on exactly one missing side/photo;
- Petya/user request wording in Russian.

Keep it practical and short. Do not generate hundreds of rows.

## Task C — Optional guardrail only if small

If easy and stable, add a test that ensures the known exception list stays
synced across:

- `AGENTS.md`
- `docs/product-photo-rules.md`
- `scripts/verify_product_galleries.py`
- `scripts/report_photo_coverage.py`

If this is already covered, do not duplicate it.

## Rebuild / Verification

If you changed product photo mappings, run:

```bash
python3 scripts/apply_product_overrides.py
python3 scripts/build_public_catalog.py
PYTHONPYCACHEPREFIX=/tmp/gm-pycache python3 scripts/build_static_site.py
```

Always run:

```bash
python3 scripts/verify_product_galleries.py
PYTHONPYCACHEPREFIX=/tmp/gm-pycache python3 scripts/verify_backend_mvp.py --skip-package
python3 scripts/check_no_secrets.py
git diff --check
```

## Commit Rules

If everything is green, make one local commit for this task only.

Commit only relevant docs/tests/scripts/product mapping/photo files.
Do not commit:

- `docs/project-stage-map.md`
- `sitemap.xml` unless deliberately regenerated and reviewed
- raw `assets/products/telegram-*` files
- secrets/config/env/admin live config

Suggested commit message:

```text
Audit incomplete galleries and add photo priority list
```

## Final Report

Report back:

- whether any of the 3 exceptions were resolved;
- what remains missing;
- photo coverage after the task;
- what files changed;
- test results;
- commit hash if committed;
- next recommended task for Codex or Claude.
