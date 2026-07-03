# Manual promo-discount system

How to put a product on sale (a "-XX%" badge + crossed-out original price),
change the percentage, or turn it off — quickly, without touching pricing
logic or any dashboard.

## Add / change / remove a discount

Edit `data/discounts.json`:

```json
{
  "_readme": "...",
  "discounts": {
    "prd_c5f3a1dce862": 20
  }
}
```

- **Add a discount:** add a line `"prd_xxxxxxxxxxxx": 15` (percent, 1-89).
- **Change a discount:** edit the number.
- **Remove a discount:** delete the line (or set to `0` — either works).

Then regenerate the site:

```bash
python3 -c "import sys; sys.path.insert(0, 'scripts'); import import_stock as m; m.generate_outputs(m.connect_db(), m.load_settings())"
python3 scripts/build_public_catalog.py
python3 scripts/build_static_site.py
```

The first command re-derives `data/catalog.json` from the existing local
stock database (`data/store.db`) and applies `data/discounts.json` on top —
it does **not** need a fresh 1C export; run it any time you only changed
`discounts.json`. If you also just imported fresh stock, `scripts/import_stock.py
<path-to-xls>` already does this step for you.

## How it works (no price logic is touched)

- `retailPriceKgs` / `registeredPriceKgs` are **never changed** by a discount.
  They stay whatever the real pricing pipeline (1C cost × markup, or a manual
  product's own price) says.
- A discount only adds two **derived, display-only** fields:
  - `discountPercent` — the percent from `data/discounts.json`.
  - `originalPriceKgs` — a "was" price computed backwards from the current
    price: `round(retailPriceKgs / (1 - discountPercent / 100))`, always
    strictly higher than `retailPriceKgs`.
- Both fields are computed once in `scripts/import_stock.py`
  (`load_discounts()` / `apply_discount()`, run for both 1C/DB products and
  `data/manual_products.json` entries) and carried through to the public
  catalog by `scripts/build_public_catalog.py`.
- Removing a product's id from `discounts.json` and regenerating removes both
  fields — nothing lingers.

## Where it shows up

A product with a discount gets, everywhere it appears as a tile:

- a red **`-XX%`** badge in the tile's bottom-right corner (the one corner not
  already used by the brand pill top-left, the like button top-right, or the
  Новинка/Хит/Выгодно badges bottom-left);
- the current price, with the "was" price shown crossed out next to it.

This is identical on:

- the home page catalog grid (`renderProducts()` in `app.js`);
- the "Похожие товары" section on every product page
  (`product_tile_html()` in `scripts/generate_product_pages.py`);
- category/brand/collection landing-page grids
  (`product_tile_html()` in `scripts/generate_landing_pages.py`);
- the product's own price box on its own page;
- the home page's quick-view modal.

All of these reuse the same `styles.css` classes (`.product-card`,
`.discount-badge`, `.price-group`, `.price-original`, …), so a tile looks the
same no matter which page renders it — that was the whole point: before this
system, the home page and the "Похожие товары" grid had visibly different
card styles (no like button, no badges, plain text price) because they were
built from separate, drifted code paths.

## Keeping the three renderers in sync

Because static pages can't share a live JS module, the same tile logic exists
in three places: `app.js` (JS, browser), `scripts/generate_product_pages.py`
and `scripts/generate_landing_pages.py` (Python, build time). Each has its own
copy of `productBadges`/`product_badges`, `hasDiscount`/`has_discount`,
`discountBadgeHtml`/`discount_badge_html`, and
`priceWithDiscountHtml`/`price_with_discount_html` — deliberately duplicated
(matching this project's convention of self-contained generator scripts)
rather than cross-imported. `tests/catalog-badges-parity.test.mjs` locks all
three copies to the same rules, so an edit to only one of them fails a test
instead of silently drifting apart again.

## Tests

- `tests/catalog-discount-system.test.mjs` — `data/discounts.json` shape,
  every discounted id exists in the catalog, the discount math
  (`originalPriceKgs` vs `retailPriceKgs`/`discountPercent`) is internally
  consistent, a product with no entry carries no stale discount fields, the
  current Persil Rose discount is present, and the data pipeline
  (`import_stock.py` / `build_public_catalog.py`) is wired correctly.
- `tests/catalog-badges-parity.test.mjs` — the badge/discount rules stay
  identical across all three renderers.
- `tests/product-consistency.test.mjs` — every related-product card links to
  a real page and references an image that exists on disk.

Run `python3 scripts/verify_backend_mvp.py` before committing any change here
— it runs all of the above plus the full storefront/backend suite.
