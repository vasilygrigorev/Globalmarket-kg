# Claude Next Task

> **STATUS: PHOTO PRIORITY DOCS REFRESHED, PETYA REQUEST DOC READY.**
>
> No photo data changed this pass — docs and one small report script only.
> Codex: replace this file's body with the next task when there is one.

## Outcome (2026-07-05)

- **Task A:** rewrote `docs/photo-priority-list.md` — updated to the
  current 142/529 (26.8%) coverage, removed the now-stale "Priority 0"
  section (that schema bug was fixed in `b26262c`), refreshed the
  category-gap table with live numbers, kept the top-20/single-missing-photo
  sections (unchanged, since nothing new was photographed this pass).
- **Task B:** added `docs/petya-shooting-request.md` — a standalone,
  forward-as-is Russian message: shooting rules (3-photo order, perfume
  exception, don't mix products in one triple, name+1C code helps),
  priority 1 (oral care/food at 0%), priority 2 (top 20 by stock value),
  priority 3 (3 products needing just a back photo), the 2 unresolved Dove
  variants (need a card-front or explicit 2-photo approval), and a short
  "how to send" section.
- **Task C:** added `scripts/report_photo_priority.py` — coverage summary +
  5 lowest-coverage categories + top-20 no-photo-by-value in one report,
  reusing `report_photo_coverage.py`'s catalog parsing plus a direct
  `store.db` query for the value ranking. It's a report, not a guardrail
  (always exits 0); wired into `verify_backend_mvp.py`'s syntax-check list
  only, per the task's own guidance not to overbuild it.

No product data, overrides, or generated site files changed this pass —
`data/product_overrides.json`, `data/public-catalog.json`, product/category
pages, and `sitemap.xml` are all untouched (git status confirms only docs +
1 new script + `docs/project-stage-map.md` noise).

Verification: `report_photo_coverage.py` OK (142/529, unchanged);
`verify_product_galleries.py` OK (3 known exceptions, unchanged);
`verify_backend_mvp.py --skip-package` OK; `check_no_secrets.py` clean;
`git diff --check` clean.

## Context carried forward

- 3 known incomplete-gallery exceptions remain documented, unchanged:
  `prd_432b62d4b317`, `prd_1f1557a2acbb`, `prd_296bd01a7c1f`.
- 6 Dove raw leftovers remain in `docs/pending-photo-review.md`, untouched:
  `assets/products/telegram-989425384-20260703-160531-{01,02}-*`.

## Next candidate tasks (pick one, or wait for a new user goal)

1. **User action**: forward `docs/petya-shooting-request.md` to
   Petya/Vlad/manager — this is the actual next step for closing the
   photo-coverage gap, not another Claude-safe code task.
2. **Business decision, not Claude-safe alone**: 6 photographed products
   (TRESemmé x2, Sunsilk x4) stay hidden because 1C reports 0 stock, even
   though a past session note says the user wanted them shown regardless.
   Needs either a stock re-check with the owner/Petya, or a deliberate
   decision to build a "show despite 0 stock" mechanism (a real feature
   change to `scripts/import_stock.py`'s filter — not a quick fix).
3. **Waiting on Petya/user**: once new photos arrive, wire them in the
   same way as the YC sunscreen / Pantene-Lenor-TRESemmé batches (commits
   `290c609`, `b1ca708`, `b26262c`) — confident id matches only, 3-photo
   contract, no guessing.
4. **Codex/user-only**: GitHub push/merge decision for
   `collab/preview-baseline`, and the standing Supabase
   `SUPABASE_SERVICE_ROLE_KEY` production-secret item — unrelated to photo
   work.

Do not restart an open-ended improvement cycle without a specific new goal
from the user.
