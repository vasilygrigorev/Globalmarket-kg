# Pending photo review

Raw Petya photos that were investigated but deliberately **not** published,
because either identity or photo-count could not be confirmed with
confidence. Nothing here has been added to `data/product_overrides.json`
or moved into a published `assets/products/<brand>/` folder. Raw files are
left in place under `assets/products/` — do not delete.

## 2026-07-05 — `telegram-8767964230-20260626-142813-next-2-03-*`

3 files: `-card-front.jpg`, `-front.jpg`, `-back.jpg`.

- Front (`-front.jpg` / `-card-front.jpg`, same tube design): YC blue-design
  tube, "WITH UV 60+ UVA+UVB", "NET WT. 100 g."
- Back (`-back.jpg`): printed code "YC852", barcode digits
  `8859362511882` — **byte-for-byte identical code/barcode** to the
  already-published `assets/products/yc/yc-sunscreen-spf50-100g-back.jpg`
  (YC-852, confirmed SPF50, source_code 2913), including the same
  "MFD.08/2024 002 / EXP.08/2029" stamp (only the last batch digits differ:
  1908 vs 1938). But the surrounding ingredient/description text differs
  between the two "YC852" back photos, and the SPF50 tube design (green)
  looks nothing like this SPF60/blue tube.
- **Conclusion: internally inconsistent.** The back label of this file
  cannot be trusted as the real barcode for this specific tube — it appears
  to reuse the YC-852 back-label asset while the front shows a UV60+
  design. By elimination this is most likely **YC-853 SPF60 100g**
  (1C source_code 2912, `С/З YC (YC-853)SPF60 (100gr)`, stock qty 286,
  currently no photo) since that is the only other 100g YC item in stock
  with a matching SPF/format and no existing photo — but this is a guess,
  not a confirmed barcode read.
- **Action: not published.** Needs either a clearer/legible barcode photo
  or manual confirmation before it can be mapped to `prd_8f967f2becb0`
  (source_code 2912).

## 2026-07-05 — `telegram-989425384-20260703-160531-{01,02}-*`

6 files total, re-examined individually (cap color + label text), not by
their `01`/`02` filename grouping (which mixes products):

| File | Cap | Product identified | Notes |
|---|---|---|---|
| `01-card-front.jpg` | Teal | Dove Advanced Care Pear & Aloe Vera goFresh 250ml | |
| `01-front.jpg` | Teal | Same bottle, back label, barcode `7709081559204` | pair with above |
| `01-back.jpg` | Red | Dove go fresh Apple & White Tea, 250ml | |
| `02-card-front.jpg` | Red | Same bottle back label, mentions "parfum Pomme & Thé blanc" | pair with above |
| `02-front.jpg` | Blue | Dove Advanced Care Original, 250ml | |
| `02-back.jpg` | Blue | Same bottle, back label (generic Advanced Care text) | pair with above |

So the 6 photos are really **3 products × 2 photos each** (front-label +
back-label), not 3×3 or 2×3 as the folder names suggest.

- **Teal (Pear & Aloe Vera):** this exact variant is **already published**
  as `prd_d3c195668843` / `Dove Advanced Care Pear & Aloe Vera` with a full
  3-image gallery from a prior batch. These 2 photos are redundant —
  no action needed.
- **Red (Apple & White Tea):** matches stock item `Dove Body Spray (250)
  Go Fresh Apple` (source_code 120, product_id `prd_f23090eb2627`, stock
  qty 96, currently no photo). Identity is fairly confident (scent name on
  can + French ingredient text match), **but only 2 of the required 3
  photos exist** (no separate card/main image, just front-label and
  back-label shelf photos). Per the 3-photo contract, not published.
- **Blue (Original):** matches stock item `Dove Body Spray (250) Original`
  (source_code 806, product_id `prd_b8b5bfec07e5`, stock qty 90, currently
  no photo). Same situation — 2 of 3 photos only, not published.

**Action needed from Petya/owner:** for the Original and Apple & White Tea
variants, either take/send a proper third photo (a clean product-forward
shot to serve as `card-front`), or explicitly approve publishing with only
2 images as a documented exception (like the existing card+front-only
exceptions in `docs/product-photo-rules.md`).
