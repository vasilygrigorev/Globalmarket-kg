# Product Photo Rules

Every product with real product photography should have three public images:

1. Card image: beautiful product card for the catalog grid.
2. Front image: plain front side of the real product.
3. Back image: plain back side of the real product.

The gallery order is strict:

```text
galleryImages[0] = card-front
galleryImages[1] = front
galleryImages[2] = back
image = galleryImages[0]
```

Extra photos can be stored in `assets/products/...` or product notes, but they should not be shown in the public gallery by default.

Perfume decant products are a separate format:

```text
categoryId = perfume
galleryImages[0] = card-front
image = galleryImages[0]
```

They use one designed product card only and do not require front/back gallery photos.

Known exception as of 2026-06-10:

- `prd_432b62d4b317` / `TRESemmé Clean & Replenish шампунь 828 мл`: missing back photo; currently card + front only.
- `prd_1f1557a2acbb` / `Pantene Damage Repair шампунь 600 мл`: missing back photo; currently card + front only.
- `prd_296bd01a7c1f` / `Pantene Sheer Volume шампунь 600 мл`: missing back photo; currently card + front only.

Known exception as of 2026-07-08 (mismatched back, not just missing):

- `prd_e8a318ef10d2` / `Colgate 360 Optic White зубная щётка`: its own back photo is a mismatch (text/branding matches a different "360" variant); currently card + front only.
- `prd_b61ba7c4268e` / `Colgate MaxFresh зубная щётка`: its own back photo is byte-identical (md5) to Colgate MaxWhite's back — a photographer duplicate; currently card + front only.

Run before deployment after product-photo changes:

```bash
python3 scripts/verify_product_galleries.py
```

## Stock import photo-mapping guard

1C stock imports can change the raw product name. Regular imported
`product_id` values are derived from that raw name, so a renamed 1C row can
create a new storefront product while the older product with finished photos
falls out of the public catalog. The image files are not deleted, but the photo
mapping can look "lost" on the site.

After every stock import, run:

```bash
python3 scripts/audit_photo_mapping_integrity.py --strict
```

The script checks `data/product_overrides.json` against the current product
database, manual perfume products, and the public catalog. Existing historical
hidden photo mappings are documented in `data/photo_mapping_allowlist.json`;
new suspected lost mappings fail in strict mode when a hidden photographed
override has a similar current storefront product without photos. Missing
photographed overrides also fail unless they are known external/manual products.
Review, remap, or explicitly allowlist each case with a reason.

If the guard fails, do not blindly copy photos to the newest similar product.
First compare brand, product type, volume/weight/count, fragrance/variant, and
front/back/card photos. Products like razors vs replacement cartridges or
different bottle sizes must be treated as separate products.

Do not delete old Telegram/product image files only because they are not
referenced by the current rebuilt catalog. Before cleanup, compare against
`data/product_overrides.json`, manual products, and previously published
catalog/photo mappings. A stock refresh or title change can temporarily hide a
photographed product while the photos are still the correct source of truth for
that item. If unsure, move files to a reviewed archive or leave them in place;
never remove historical card/front/back assets until
`scripts/audit_photo_mapping_integrity.py --strict` and
`scripts/verify_product_galleries.py` are both clean after the remap.

`scripts/report_photo_coverage.py`'s "unused raw leftover" scan (the report a
prior cleanup, commit `c4e3a27`, used to justify deleting 273 files) now
cross-checks `data/product_overrides.json` and `data/manual_products.json` in
addition to the live public catalog, so a product that is merely out of stock
no longer makes its real photo look unused. `tests/photo-cleanup-guard.test.mjs`
locks this in — it reproduces the exact out-of-stock scenario and fails if the
cross-check regresses. Still: `unused_raw_leftovers` is a report, not a
deletion tool. Never pipe it into `rm` without a human review pass first.

## Petya import rules (path + publish hygiene)

These rules exist because the Telegram photo bot drops raw uploads as loose
files directly under `assets/products/` (e.g. `telegram-<chat_id>-<timestamp>-
front.jpg`), and Petya sometimes leaves working files (contact sheets, OCR
scratch exports) mixed into a brand folder. None of that is ever a finished,
publishable product photo:

- A published `image` / `galleryImages` path must never contain a raw/temp
  marker: `telegram-`, `ocr`, `contact`, `sheet`, `dup`. Enforced by
  `scripts/verify_product_galleries.py` (preflight-gated) and
  `tests/catalog-image-hygiene.test.mjs`.
- A published image path must live inside a subfolder of `assets/products/`
  (e.g. `assets/products/<brand>/...` or `assets/products/perfume/...`) —
  never loose directly at the `assets/products/` root, which is reserved for
  unsorted raw uploads awaiting review.
- Every perfume product image must live specifically under
  `assets/products/perfume/`.
- If the user marks a perfume as sold, skip it — do not add or keep it active
  in the public catalog.
- If the user gives a perfume price but no matching card image exists yet, do
  not add an active product. Wait for the card image.
- `product.image` must always equal `galleryImages[0]`.
- After each import, run `python3 scripts/report_photo_coverage.py` — the
  `unused_raw_leftovers` section lists files under `assets/products/` that
  look like raw Telegram/OCR/contact-sheet leftovers and are not referenced by
  any product. These are reported only, never deleted automatically; review
  and clean them up manually once you're sure nothing needs them.
- Old 1C product names carry weight/volume/wash-count hints in parentheses
  (e.g. `Dalli (100)` means about 100 washes, not 100 pieces) — see
  [`import-workflow.md`](import-workflow.md) for the full parsing rule before
  turning a parenthesized number into a published quantity.

## Photo coverage report

After each Petya upload or 1C stock refresh, check how much of the catalog now
has real product photos:

```bash
python3 scripts/report_photo_coverage.py          # human-readable
python3 scripts/report_photo_coverage.py --json    # machine-readable
```

It prints total products, products with real photos, coverage %, a per-category
breakdown, the perfume card-only count, the non-perfume complete-gallery count,
the known card+front-only exceptions, and unused raw-leftover files under
`assets/products/` (see "Petya import rules" above). As of the latest local
run: 92/460 products have real photos (20.0%); perfume is 22/22; non-perfume
photographed is 70/70 with a complete 3-image gallery. The gallery contract
(`scripts/verify_product_galleries.py`) and the coverage assumptions
(`tests/photo-coverage.test.mjs`) are both wired into
`scripts/verify_backend_mvp.py`, so a future import that breaks them fails the
preflight. The card+front-only exception list must stay identical in this doc,
`AGENTS.md`, `scripts/verify_product_galleries.py`, and
`scripts/report_photo_coverage.py`.
