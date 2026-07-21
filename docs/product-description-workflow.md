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
