# Pending photo review

Raw Petya photos that were investigated but deliberately **not** published,
because either identity or photo-count could not be confirmed with
confidence. Nothing here has been added to `data/product_overrides.json`
or moved into a published `assets/products/<brand>/` folder. Raw files are
left in place under `assets/products/` — do not delete.

## PARTIALLY RESOLVED 2026-07-06 — `telegram-8767964230-20260706-*` (two live batches)

Two fresh batches landed on disk **during local sessions** (~10:28-10:40 and
~12:40, same day), while working on unrelated tasks — not something either
session went looking for. 13 complete-by-filename card-front/front/back
groups, 39 files total, across two drops:

```text
telegram-8767964230-20260706-102856-{01,02,03,04,05}-{card-front,front,back}.jpg  (5 groups)
telegram-8767964230-20260706-103856-{01,02,03}-{card-front,front,back}.jpg        (3 groups)
telegram-8767964230-20260706-104056-{card-front,front,back}.jpg                   (1 group)
telegram-8767964230-20260706-124023-{01,02,03,04}-{card-front,front,back}.jpg     (4 groups)
```

**8 of the 13 groups were identified and published** (dedicated
photo-identification pass, same pattern as the YC sunscreen batch in
`290c609`/`b1ca708` or the Pantene/Lenor/TRESemmé batch in `b26262c` —
cross-referenced brand/barcode/label text against `data/store.db`
`source_products` by 1C `source_code`, not by name):

| Group | Product | 1C code | product_id |
|---|---|---|---|
| `102856-05` | Colgate MaxWhite зубная щётка | 1241 | `prd_1cb756e99bac` |
| `103856-02` | Colgate ZigZag зубная щётка 3 шт | 2938 | `prd_66dd4882eecf` |
| `103856-03` | Colgate ZigZag Charcoal зубная щётка | 2939 | `prd_f3ed12b53668` |
| `104056` | Colgate Double Action Charcoal зубная щётка | 2937 | `prd_773d5cd63456` |
| `124023-01` | Dove go fresh Cucumber & Green Tea стик 40 г | 1699 | `prd_cdc989a294f9` |
| `124023-02` | Dove Original стик 40 г | 122 | `prd_f7a9d836005f` |
| `124023-03` | Dove Beauty Finish стик 40 г | 2706 | `prd_21c8c8aa3e5d` |
| `124023-04` | Dove go fresh Pomegranate & Lemon Verbena стик 40 г | 2948 | `prd_23e1645a6a85` |

Moved to `assets/products/colgate/` and `assets/products/dove/`
respectively, added to `data/product_overrides.json`. Photo coverage
142/529 → 150/529.

**5 groups still NOT published** — real problems found, not just
unopened files:

- **`102856-01` (Colgate 360 Optic White, Medium)** — front/card-front are
  clear and consistent, but its **back photo is wrong**: byte-different
  from, but textually identical to, `102856-03`'s own back (both say "360
  Charcoal Gold... Medium"), while `102856-01`'s front clearly shows white/
  blue bristles, not the black charcoal bristles the back describes. No
  matching 1C stock line for "360 Optic White" either. Needs a correct back
  photo and a stock-code confirmation before it can be considered.
- **`103856-01` (Colgate Max Fresh)** — front/card-front confidently match
  1C code 1075 (`Colgate з/щ MaxFresh`, `prd_b61ba7c4268e`), **but its back
  photo is byte-identical to `102856-05`'s MaxWhite back** (confirmed via
  md5) — a real duplicate/mixup, not this product's actual back. Needs a
  correct back photo; the 1C match itself is solid once that exists.
- **`102856-02` (Colgate 360 Charcoal, Medium)**, **`102856-03` (Colgate 360
  Charcoal Gold, Soft)**, **`102856-04` (Colgate 360 Whole Mouth Clean,
  Medium)** — all three are internally consistent (card-front/front/back
  agree with each other) and clearly branded, but **no matching "360 ..."
  line exists anywhere in the current `data/store.db` stock** (checked
  every Colgate row). Either a new SKU not yet in any 1C export, or listed
  under a name too different to match with confidence. Needs Petya/owner
  confirmation of the 1C code before publishing — do not guess.

Raw files for all 5 remain at `assets/products/` root, untouched.

## RESOLVED 2026-07-05 — `telegram-8767964230-20260626-142813-next-2-03-*`

Was ambiguous (back-label barcode read "YC852"/SPF50, but the tube design
showed UV60+ — see reasoning below, kept for the record). User confirmed
directly: **UV50 = YC852, UV60 = YC853**. Published as YC Sunscreen SPF60
100g (`prd_8f967f2becb0`, source_code 2912), moved/renamed to
`assets/products/yc/yc-sunscreen-spf60-100g-*.jpg`, added to
`data/product_overrides.json`.

Original reasoning while unresolved: front tube design showed "WITH UV
60+ UVA+UVB", but the back photo's printed code "YC852" and barcode digits
`8859362511882` were byte-for-byte identical to the already-published
YC-852 SPF50 back photo (same MFD/EXP stamp, differing only in the last
batch digits). The back label was apparently not a reliable per-SKU photo
(looked reused/templated), so identity had to come from the user rather
than the barcode.

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

## Что нужно от Пети/владельца (по-русски)

Два товара Dove не публикуются — не хватает третьего фото:

1. **Dove Go Fresh Apple & White Tea, 250 мл** (спрей-дезодорант, красная
   крышка). Сейчас есть только фото лицевой этикетки и фото с составом на
   обороте — нужно ещё одно нормальное "витринное" фото товара (как
   `card-front` у других товаров), либо явное разрешение опубликовать
   всего с 2 фото как исключение.
2. **Dove Advanced Care Original, 250 мл** (спрей-дезодорант, синяя
   крышка). Та же ситуация — 2 фото есть, третьего (`card-front`) нет.

Третий товар с этих же фото — **Dove Pear & Aloe Vera** — уже опубликован
на сайте, эти 2 фото для него не нужны, можно не пересъёмывать.

Пока не пришлют третье фото (или явное "публикуй как есть"), эти два
товара останутся в статусе "review", без фото на сайте.
