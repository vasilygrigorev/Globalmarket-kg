# Product Description Workflow

## Purpose

Product descriptions are stored in `data/product_overrides.json`. The 1C source
code remains the stable product identity; descriptions survive stock, price, and
name updates.

## Source Priority

1. The exact front and back packaging photos published in the product gallery.
2. The manufacturer's official page for the same product family and market.
3. Supplier catalog or price list with matching EAN and pack size.
4. Other stores only as a discovery lead, never as the final source.

Do not transfer claims from a similar fragrance, size, formula, or regional
version. If a property cannot be verified, omit it.

## Writing Rules

- Use 2-4 useful sentences in Russian.
- State what the product is for, its verified distinguishing properties, and
  the exact size or count.
- Include brief usage guidance only when it is visible on the label or confirmed
  by the manufacturer.
- Avoid unsupported superlatives, medical promises, and copied marketplace text.
- Keep EAN, internal 1C codes, source notes, and AI/OCR commentary out of the
  public description.

## First Batch: 2026-07-21

Thirty products were selected using 1C sales from 2025-07-11 through 2026-07-10,
current stock, and availability of real product photos. The batch covers Persil,
Dalli, Dash, Head & Shoulders, Lenor, Gillette, Jif, Ariel, and Clear.

Primary local evidence is each product's `card-front`, `front`, and `back` gallery
under `assets/products/`. Official family-level references used for claims and
usage checks:

- Gillette ProGlide refills: https://gillette.com/en-us/products/razors-trimmers-and-blades/proglide-razor-refills
- Gillette Venus Smooth refills: https://www.gillettevenus.com/en-us/products/refills/smooth-refills/
- Lenor in-wash scent boosters: https://www.lenor.co.uk/en-gb/fabric-conditioner-tips/how-to-do-laundry/what-are-inwash-scent-boosters
- Dash Color Frische liquid: https://dash.de/color-frische/color-frische-fluessig/
- Persil product-family guidance: https://www.persil.com/uk/laundry/detergent.html

Regional Persil, Dalli, Dash, Head & Shoulders, Ariel, Clear, and Jif wording was
kept within claims visible on the exact local packaging photos.

Run the curated batch with:

```bash
python3 scripts/enrich_top_product_descriptions.py
python3 scripts/apply_product_overrides.py
python3 scripts/build_public_catalog.py
python3 scripts/generate_product_pages.py
```

## Second Batch: 2026-07-22

Thirty more photographed products were selected from the remaining weak-copy
pages by net 1C sales quantity from 2025-07-11 through 2026-07-10. This batch
covers Gillette, Head & Shoulders, Lenor, Dove, Ariel, Dash, Comfort, Colgate,
Rexona, Fairy, and TRESemmé.

Each exact local front/back package was checked before writing. Family-level
claims and usage guidance were cross-checked against official manufacturer
pages for Gillette Venus, Colgate Extra Clean, Head & Shoulders Menthol Fresh,
Lenor scent boosters, Ariel All-in-1 PODS, Dove hair care and antiperspirants,
Rexona Antibacterial + Invisible, and TRESemmé Volume. Where no exact regional
official page was available, wording was limited to what is visible on the
local package; no adjacent variant claims were imported.

## Remaining Photographed Pages: 2026-07-22

The remaining 68 weak-copy generated product pages were completed as a final
photographed-page batch. Exact front/back assets were reviewed in contact
sheets and individually where the product format was ambiguous. The batch
covers Pantene and Herbal Essences shampoos, TRESemmé, sun protection, baby
oil, Colgate toothbrushes, deodorant sticks, Gillette and BIC shaving products,
Dash and Dalli laundry care, Concord tools, and Banduff plasters.

Descriptions stay within the exact pack and product-family evidence, separate
breakage-related hair fall from medical hair loss, avoid treatment claims for
plasters, and include conservative use guidance for sun protection, aerosols,
razors, and laundry capsules. With this batch, every one of the 186 generated
photographed product pages passes the description quality heuristic. Catalog
rows without generated photo pages remain a separate future workflow.
