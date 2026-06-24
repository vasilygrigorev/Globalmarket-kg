# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A static e-commerce storefront for `globalmarket.kg`, a household goods shop in Kyrgyzstan. The site is hosted on Cloudflare Pages. There is no backend server — orders flow through WhatsApp, and the cart/favorites/recently-viewed state lives in browser `localStorage`.

## Commands

```bash
# Rebuild public-catalog.json from the private catalog.json (run after any stock import)
python3 scripts/build_public_catalog.py

# Import a new 1C stock file (XLS or MXL format) into the local SQLite DB and regenerate catalog.json
python3 scripts/import_stock.py /path/to/stock.xls

# Verify photo gallery contract before any deployment that touches product photos or the catalog
python3 scripts/verify_product_galleries.py

# Generate a single static SEO product page under product/<slug>/
python3 scripts/generate_product_pages.py

# Regenerate placeholder SVG assets
python3 scripts/generate_placeholder_assets.py
```

The scripts require `xlrd` for XLS parsing (`pip install xlrd`). No other dependencies are needed for `build_public_catalog.py` or `verify_product_galleries.py`.

## Data Flow Architecture

```
1C ERP export (XLS or MXL)
    ↓
scripts/import_stock.py
    ↓ reads stock, detects brands/categories, prices in KGS
    ↓ merges data/manual_products.json
    ↓
data/store.db (SQLite, gitignored) + data/catalog.json (gitignored)
    ↓
scripts/build_public_catalog.py
    ↓ strips internal fields (stock quantities, USD prices, wholesale)
    ↓
data/public-catalog.json  ← the only file the browser reads
    ↓
index.html + app.js
    ↓ cart → WhatsApp message → manager confirms order
```

**Private files (gitignored):** `data/catalog.json`, `data/store.db`, `data/*.xls`, `data/*.mxl`, `data/*.csv`, `outputs/`

**Public files (committed):** `data/public-catalog.json`, `data/manual_products.json`

## Frontend Architecture

The entire frontend is three files — no bundler, no framework, no modules:
- `index.html` — Single-page storefront. All UI sections are in one document; JavaScript shows/hides them.
- `app.js` — ~1800 lines of vanilla JS. All state lives in the global `state` object. DOM references are queried once at the top. Event delegation is used on container elements (e.g., `productGrid`, `cartItems`).
- `styles.css` — All styles. Uses CSS custom properties for product card tone colors (`--tone-a`, `--tone-b`).

**Rendering pattern:** `renderProducts()`, `renderCart()`, `renderCategories()`, etc. are imperative functions that write `innerHTML`. They are called explicitly when state changes. There is no virtual DOM or reactive system.

**Product display decomposition:** `productDisplayParts(product)` separates a raw title into `{ brand, type, size, variant }` for display in cards and modals. This logic is non-trivial — `displayProductType()` maps raw `productType` strings to Russian display labels.

**Pricing:** `productPrice(product)` returns `registeredPriceKgs` for registered customers, `retailPriceKgs` otherwise. The registered state is determined by `isRegisteredCustomer()`, which checks `state.customer`.

**Featured sort (`diversifyFeaturedProducts`):** Products are bucketed by `categoryId`, then interleaved round-robin to show diversity across categories. Within each bucket, it prefers products from brands not yet shown in the current pass.

## Product Data Model

Fields present in `public-catalog.json` products:

| Field | Description |
|---|---|
| `id` | Stable ID (e.g. `prd_432b62d4b317`) |
| `categoryId` | Internal key: `laundry`, `hair`, `body`, `oral`, `deodorants`, `shaving`, `perfume`, `food`, `germany`, `other` |
| `category` | Russian display name (e.g. `Стирка и уход за бельем`) |
| `collections` | Array of marketing collection keys, e.g. `["europe"]` |
| `brand` | Brand name |
| `productType` | Russian product type (e.g. `гель для стирки`) |
| `title` | Full product title |
| `description` | Short Russian description |
| `unit` | Unit string (e.g. `шт`, `5 мл`) |
| `retailPriceKgs` | Retail price in Kyrgyz som |
| `registeredPriceKgs` | Discounted price for registered users |
| `image` | Path to primary image (must equal `galleryImages[0]`) |
| `galleryImages` | Ordered image paths — see photo contract below |
| `tones` | `[colorA, colorB]` — two hex colors for gradient card background |
| `status` | `active` or `review` |
| `searchText` | Pre-built search haystack string |

## Photo Contract (Critical)

Every photographed product in `assets/products/` must follow this gallery order exactly:

1. `card-front` — designed product card (main catalog image)
2. `front` — front photo of the product
3. `back` — back photo of the product

**Rules:**
- `product.image` must always equal `galleryImages[0]`
- Do not add extra images (`alt-front`, `alt-back`, Telegram screenshots) to `galleryImages`
- Perfume products (`categoryId: "perfume"`) use **exactly one** image — the card only, no front/back
- Telegram albums from Petya arrive in groups of 3 (card, front, back); if count is not divisible by 3, do not auto-map without manual review

Run `python3 scripts/verify_product_galleries.py` before any deployment after photo or catalog changes.

**Known exceptions** (products with only 2 photos, documented in `verify_product_galleries.py` and `AGENTS.md`):
- `prd_432b62d4b317` / TRESemmé Clean & Replenish — missing back photo
- `prd_1f1557a2acbb` / Pantene Damage Repair 600 мл — missing back photo
- `prd_296bd01a7c1f` / Pantene Sheer Volume 600 мл — missing back photo

## Manual Products

`data/manual_products.json` holds products not in the 1C stock system (perfumes, special items). They are merged into the catalog by `import_stock.py` at output generation time. Manually set all fields: `id`, `categoryId`, `retailPriceKgs`, `registeredPriceKgs`, `image`, `galleryImages`, `status: "active"`, `visibility: "storefront"`.

## Catalog Taxonomy

Three separate product axes — do not conflate them:
- **`category`** — product purpose (Стирка, Уход за волосами, etc.)
- **`brand`** — manufacturer (Dalli, Dash, Pantene, etc.)
- **`collection`** — marketing group (`europe`, etc.)

`europe` is a collection, not a category. The legacy `germany` ID remains as an internal alias for old data compatibility; the public UI displays `Европа`.

European brands automatically get `collections: ["europe"]`: Dalli, G.Dalli, Dash, G.DASH, Kamill, The Pink Stuff.

## Pricing Logic

Prices are calculated in `import_stock.py`:
- **Wholesale KGS** = `base_price_usd × usd_rate`
- **Retail KGS** = `wholesale × (1 + retail_markup_percent / 100)`, then "beautifully rounded" (endings like 90, 95, 990 within 5% deviation)
- **Registered KGS** = `floor(retail × (1 - default_registered_discount_percent / 100))`

Settings are stored in `data/settings.json` (gitignored). Current defaults: `usd_rate: 89`, `retail_markup_percent: 30`, `registered_discount: 3%`, `free_delivery_threshold: 10000 KGS`.

## Static Product Pages

`scripts/generate_product_pages.py` generates one SEO product page at a time under `product/<slug>/index.html`. The slug is built from the Russian title (transliterated) + last 6 chars of the product ID. The script selects the best candidate product (has photos, active, has price; prefers Europe collection). These pages link back to `/#catalog` and use WhatsApp for ordering.
