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

Known exception as of 2026-06-10:

- `prd_432b62d4b317` / `TRESemmé Clean & Replenish шампунь 828 мл`: missing back photo; currently card + front only.
- `prd_1f1557a2acbb` / `Pantene Damage Repair шампунь 600 мл`: missing back photo; currently card + front only.
- `prd_296bd01a7c1f` / `Pantene Sheer Volume шампунь 600 мл`: missing back photo; currently card + front only.

Run before deployment after product-photo changes:

```bash
python3 scripts/verify_product_galleries.py
```
