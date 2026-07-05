# Claude Next Task

> **STATUS: LEGACY OVERRIDE SCHEMA NORMALIZED. Guardrail added.**
>
> All 23 flagged `data/product_overrides.json` entries were normalized.
> Codex: replace this file's body with the next task when there is one.

## Outcome (2026-07-05)

- **Task A:** normalized all 23 entries — added `clean_title` (from
  `title`), `product_type` (from `productType`), `category_id` (from
  `categoryId`, where present); kept `description`/`brand`/`galleryImages`/
  `image` exactly as-is; appended a dated note. No new photo matching, no
  guessing, no image path changes.
- **Task B:** rebuilt (`apply_product_overrides.py` -> `build_public_catalog.py`
  -> `build_static_site.py`). Photo coverage **125/529 (23.6%) -> 142/529
  (26.8%)**. 17 of the 23 became visible/photographed (positive stock).
  6 remain hidden because current 1C stock is 0 (TRESemmé Color,
  TRESemmé Rich Moisture, Sunsilk Smooth & Manageable / Soft & Smooth /
  Anti-Dandruff Healthy Strong / Black Shine) — left hidden, not forced,
  per the task's explicit instruction. These 6 already had override notes
  from prior sessions saying the user wanted them shown despite 0 stock;
  that would require changing the stock>0 storefront filter itself, which
  is a separate, bigger decision — not done here.
- **Task C:** added `scripts/check_override_schema.py` +
  `tests/override-schema-guard.test.mjs`, wired into
  `scripts/verify_backend_mvp.py` (node test list, py_compile list, and a
  new non-strict preflight step). Fails only when a `product_overrides.json`
  entry that actually carries a photo (`image`/`galleryImages`) is missing
  `clean_title`/`description`/`brand`/`product_type` — a photo-less entry
  missing fields has nothing to silently lose, so it's not flagged; manual
  perfume entries (`prd_perfume_*`) are exempt (different schema, applied
  via `data/manual_products.json` instead).

Verification: `verify_product_galleries.py` OK (142/529, 3 known
exceptions unchanged); `verify_backend_mvp.py --skip-package` OK;
`check_no_secrets.py` clean; `git diff --check` clean.

## Context carried forward

- 3 known incomplete-gallery exceptions remain documented (unchanged by
  this task): `prd_432b62d4b317`, `prd_1f1557a2acbb`, `prd_296bd01a7c1f`.
- 6 Dove raw leftovers remain in `docs/pending-photo-review.md`, untouched,
  waiting on Petya for one more card-front photo each (or explicit 2-photo
  approval): `assets/products/telegram-989425384-20260703-160531-{01,02}-*`.

## Next candidate tasks (pick one, or wait for a new user goal)

1. **Business decision, not Claude-safe alone**: 6 photographed products
   (TRESemmé x2, Sunsilk x4) are hidden because 1C reports 0 stock, but
   past session notes say the user explicitly wanted them shown anyway.
   Needs a decision: either confirm current 1C stock is simply stale/wrong
   for these SKUs (re-check with the owner/Petya), or deliberately design a
   "show despite 0 stock" override mechanism (a real feature change to
   `scripts/import_stock.py`'s `stock_quantity > 0` filter, not a quick fix).
2. **Waiting on Petya/user**: the 2 remaining Dove variants need one more
   card-front photo (or an explicit 2-photo exception approval) — see
   `docs/pending-photo-review.md`.
3. **Optional Claude-safe**: revisit `docs/photo-priority-list.md`'s
   Priority 1/2 (oral care and food categories at 0% coverage, top
   in-stock products by value with no photo) — this is now genuinely
   *new* photography, not another schema bug.
4. **Codex/user-only**: GitHub push/merge decision for
   `collab/preview-baseline`, and the standing Supabase
   `SUPABASE_SERVICE_ROLE_KEY` production-secret item from earlier
   sessions — unrelated to photo work.

Do not restart an open-ended improvement cycle without a specific new goal
from the user.
