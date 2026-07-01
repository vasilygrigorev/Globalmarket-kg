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

Run before deployment after product-photo changes:

```bash
python3 scripts/verify_product_galleries.py
```

## Photo coverage report

After each Petya upload or 1C stock refresh, check how much of the catalog now
has real product photos:

```bash
python3 scripts/report_photo_coverage.py          # human-readable
python3 scripts/report_photo_coverage.py --json    # machine-readable
```

It prints total products, products with real photos, coverage %, a per-category
breakdown, the perfume card-only count, and the known card+front-only exceptions.
As of the latest local run: 97/441 products have real photos (~22%). The gallery
contract (`scripts/verify_product_galleries.py`) and the coverage assumptions
(`tests/photo-coverage.test.mjs`) are both wired into
`scripts/verify_backend_mvp.py`, so a future import that breaks them fails the
preflight. The card+front-only exception list must stay identical in this doc,
`AGENTS.md`, `scripts/verify_product_galleries.py`, and
`scripts/report_photo_coverage.py`.
