# Project Rules: Global Market KG

Use the parent Codex memory policy in `../AGENTS.md` before work that depends on prior context.

## Product Photo Contract

For every storefront product that has real product photos, the public gallery must use exactly three base images in this order:

1. `card-front`: designed product card used as the main catalog image.
2. `front`: ordinary front/face photo of the product.
3. `back`: ordinary back-side photo of the product.

Rules:

- `product.image` must match the first gallery image, the `card-front`.
- Do not publish a photographed product with only card/front or card/back unless the missing side is explicitly recorded as an exception.
- Do not place extra `alt-front`, `alt-back`, contact sheets, OCR screenshots, or temporary Telegram files in the public gallery. Keep extra files on disk or in notes, but not in `galleryImages`.
- Telegram albums from Petya are expected in groups of three photos: card, front, back. If count is not divisible by 3, do not auto-map without manual review.
- Perfume sold by decant/travel format is different: `categoryId: perfume` products use exactly one public image, a designed product card. They do not need front/back gallery photos.
- Before deployment after photo/catalog work, run `python3 scripts/verify_product_galleries.py`.

Current known exception:

- `prd_432b62d4b317` / `TRESemmé Clean & Replenish шампунь 828 мл` has card + front only. The back photo was not found locally and should be requested/reshot.
- `prd_1f1557a2acbb` / `Pantene Damage Repair шампунь 600 мл` has card + front only. The 2026-06-10 Petya album had no confident back photo for this variant.
- `prd_296bd01a7c1f` / `Pantene Sheer Volume шампунь 600 мл` has card + front only. The 2026-06-10 Petya album had no confident back photo for this variant.
- `prd_e8a318ef10d2` / `Colgate 360 Optic White зубная щётка` has card + front only. Its own back photo from the 2026-07-06 Petya batch is a mismatch (matches a different variant's back).
- `prd_b61ba7c4268e` / `Colgate MaxFresh зубная щётка` has card + front only. Its own back photo from the 2026-07-06 Petya batch is byte-identical (md5) to a different product's back — a photographer duplicate.
- `prd_e165f2a765a7` / `Dove Straight & Silky шампунь 680 мл` has card + back only (the plain front photo doubles as the card; no separate front). A 2026-07-05 gallery restore rotated photo roles across a Dove/Head & Shoulders chain; this variant's own stylized card was never found.
- `prd_f724e0973fa5` / `Dove Nourishing Oil Care шампунь 680 мл` has card + back only (the plain front photo doubles as the card; no separate front). Same 2026-07-05 restore rotation; this variant's own stylized card was never found.
