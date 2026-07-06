# Claude Next Task

> **STATUS: RELEASE-CANDIDATE CLEANUP PASS DONE.**
>
> Flaky raw-photo test race fixed and proven (not just patched), package
> safety re-audited, RC facts recorded. Codex: replace this file's body with
> the next task when there is one.

## Outcome (2026-07-06)

- **Task A (flaky test fixed):** root cause was
  `tests/photo-cleanup-guard.test.mjs` writing its transient fixture
  directly at `assets/products/` root, where a concurrently-running
  `tests/raw-photo-triage.test.mjs` subprocess (`report_raw_photo_groups.py
  --strict`, which really does scan the real filesystem) could catch it
  mid-write and misreport it as a brand-new undocumented raw group.
  `report_raw_photo_groups.py`'s scan is intentionally non-recursive
  (`assets/products/` root only — matches where real Petya uploads land, not
  brand subfolders), so moving the fixture into a dedicated subfolder
  (`__test-fixture-photo-cleanup-guard__/`) makes it structurally invisible
  to that scan while `find_unused_raw_leftovers()` (the function actually
  under test, which scans recursively) still sees and correctly ignores it.
  **Proved causation, not just correlation**: reverted the fix and ran the
  two test files together 15x — failed 15/15. Reapplied the fix, ran 15x
  more (then 10x again after other changes) — passed 25/25. No leftover
  fixture files/dirs after any run. The real guardrail is unweakened: a
  genuinely new undocumented `telegram-*` group still fails `--strict`
  (test 2 in `raw-photo-triage.test.mjs`, unchanged), and documented Dove
  leftovers still pass (test 1, unchanged).
- **Task B (package safety):** ran the full `verify_backend_mvp.py`
  (package build included, not `--skip-package`) — green, 795-file package.
  Directly confirmed: zero `telegram-*` files in the built package; admin
  runtime (`admin.js`, `admin.logic.js`, `config.js`, `index.html`) and
  Cloudflare Pages Function (`orders.js`) present; no `.env`/`store.db`/
  `*.test.mjs` leaked; secret scan of both tracked files and the package
  clean. The package build itself regenerates the static site (product
  pages, sitemap) as a side effect — reverted those regenerated files since
  this task didn't ask for a catalog/site change (same lastmod-only /
  incidental-crosslink diffs seen in prior sessions); nothing about the
  audit result depends on committing them.
- **Task C (RC note):** added a "Current release candidate (2026-07-06)"
  section to the top of `docs/production-readiness.md` (left the existing
  2026-07-03 checklist below it as historical reference rather than
  rewriting it) and a short note in `docs/test-coverage.md` explaining the
  non-recursive-scan/subfolder-fixture relationship so a future editor
  doesn't reintroduce the race.

Verification: `node --test tests/photo-cleanup-guard.test.mjs
tests/raw-photo-triage.test.mjs` OK (and stress-tested well beyond a single
run, see above); `verify_backend_mvp.py` (full, with package) OK;
`check_no_secrets.py` clean; `git diff --check` clean.

## Context carried forward

- 3 known incomplete-gallery exceptions remain documented, unchanged:
  `prd_432b62d4b317`, `prd_1f1557a2acbb`, `prd_296bd01a7c1f`.
- 6 Dove raw leftovers remain in `docs/pending-photo-review.md`, untouched:
  `assets/products/telegram-989425384-20260703-160531-{01,02}-*`.
- Photo coverage: 142/529 = 26.8% (unchanged by this pass — no photo/catalog
  data was touched).

## Next candidate tasks (pick one, or wait for a new user goal)

1. **Waiting on Petya/user**: the 2 remaining Dove variants
   (`docs/pending-photo-review.md`) still need one more card-front photo
   each, or an explicit 2-photo exception approval.
2. **Business decision, not Claude-safe alone**: 6 photographed products
   (TRESemmé x2, Sunsilk x4) stay hidden because 1C reports 0 stock, despite
   a past session note saying the user wanted them shown anyway.
3. **Codex/user-only**: this RC is otherwise ready for a push/deploy
   decision whenever Codex/the user wants to make it — GitHub push/merge for
   `collab/preview-baseline`, and the standing Supabase
   `SUPABASE_SERVICE_ROLE_KEY` production-secret item, remain explicitly
   outside Claude's authority.

Do not restart an open-ended improvement cycle without a specific new goal
from the user.
