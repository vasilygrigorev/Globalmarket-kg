# Catalog Taxonomy

## Core Rules

Global Market KG uses three separate product axes:

- `category` is the product purpose: laundry, hair care, body care, cleaning, kitchen, bathroom, shaving, baby care, deodorants, perfume, food, or other practical groups.
- `brand` is the manufacturer or commercial brand: Dalli, Dash, Kamill, The Pink Stuff, Clear, Downy, etc.
- `collection` is a marketing selection or landing-page layer. A collection must not replace the product purpose category.

Example:

- Dalli powder: `category = Стирка`, `collection = Европа`, `brand = Dalli`.
- Kamill cream: `category = Уход за телом`, `collection = Европа`, `brand = Kamill`.
- The Pink Stuff: `category = Уборка / Кухня / Ванная`, `collection = Европа`, `brand = The Pink Stuff`.

## Europe Collection

`Europe / Европа` is a collection, not a normal catalog category.

Current collection id:

- `europe`

Legacy alias:

- `germany`
- old public text: `Германия` / `Товары из Германии`

The legacy `germany` id can remain as an internal alias for old data, old links, and import compatibility. Public UI should show `Европа`.

Current migration rule:

- Existing former `germany` products are tagged with `collections: ["europe"]`.
- Their primary `categoryId` should be assigned by product purpose, for example `laundry` or `home_cleaning`.
- If a future import cannot safely detect the purpose, `categoryId: germany` may be used only as a temporary legacy fallback. It should be reviewed and moved to a real purpose category.

## Stable URLs

Product URLs must be stable and must not depend on category because a product can move between categories or belong to multiple category-like views.

Future URL shape:

- `/product/<slug>/`
- `/category/<slug>/`
- `/collections/europe/`
- `/brand/dalli/`

Do not use category-dependent product URLs such as:

- `/category/laundry/<slug>/`

## Current Static Storefront

The current storefront is static and reads `data/public-catalog.json`. It now supports the minimal collection field needed for the Europe selection:

- `collections: ["europe"]`
- `collectionLabels: ["Европа"]`

This does not require a backend rewrite. The main catalog, cart, WhatsApp order flow, local favorites, and recently viewed features can continue to work from the same JSON catalog.

## Product Page Generation

The first static product-page generator creates one page under:

- `/product/<slug>/`

After the MVP is checked, the same generator can be expanded to all active storefront products.

Before generating all pages, add:

- product URL list to sitemap;
- canonical URL checks;
- duplicate slug collision checks;
- redirect policy for changed slugs;
- review of products without real photos.
- optional reuse of the existing `globalMarketRecentlyViewed` localStorage logic on standalone product pages.

## Backend Later

When backend work starts, the same taxonomy can be stored in PostgreSQL, Supabase, or Cloudflare D1 with separate tables:

- products;
- categories;
- brands;
- collections;
- product_categories;
- product_collections.

The current static fields map directly to those tables later, so this taxonomy step does not require rewriting the storefront now.
