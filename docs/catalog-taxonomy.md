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

## Fine-grained taxonomy for recommendations (2026-07)

The broad categories (laundry, hair, shaving, …) are too coarse for the
"Похожие товары" block: a shampoo can end up next to a hair mask, and in laundry
a powder can mix with a fabric softener. Three optional, derived fields make the
recommendation ordering tighter. They are **additive** — existing fields, URLs,
and behaviour are unchanged, and any field is left empty/`unknown` when it can't
be told confidently.

- **`productKind`** — fine-grained type. Examples: laundry → `washing_powder`,
  `laundry_gel`, `fabric_softener`, `laundry_capsules`; hair → `shampoo`,
  `conditioner`, `hair_mask`; shaving → `razor`, `blade_cartridge`,
  `shaving_gel`, `shaving_foam`; body → `shower_gel`, `soap`, `body_lotion`,
  `bath_foam`; deodorants → `deodorant_spray`, `deodorant_stick`,
  `deodorant_rollon`; perfume → `perfume_decant`; cleaning →
  `dishwashing_liquid`, `cleaning_cream`, `surface_cleaner`, `toilet_cleaner`.
  `""` when unknown.
- **`audience`** — `men` / `women` / `kids` / `unisex` / `family` / `unknown`.
  Household categories (laundry, cleaning, food) default to `family`; personal
  care is left `unknown` unless the name/brand clearly signals men/women/kids.
- **`attributes`** — a de-duplicated list of extra tags such as `rose`, `fresh`,
  `sensitive`, `anti_dandruff`, `color`, `white`, `for_black_clothes`, `spf`,
  `moisturising`, `capsules`, `concentrate`, `lavender`.

### Classifier

`scripts/classify_taxonomy.py` is a pure, deterministic classifier over a
product's existing data (title, brand, category/categoryId, productType,
description). It never guesses; when unsure it returns `""` / `unknown`. Unit
tests live in `scripts/classify_taxonomy_test.py` (run
`python3 scripts/classify_taxonomy_test.py`) and cover the tricky cases: VENUS
запаски → `blade_cartridge` (not just "shaving"), Gillette gel/foam →
`shaving_gel` / `shaving_foam`, and laundry powder/gel/capsules/softener staying
distinct.

Observed coverage on the current catalog (report-only): shaving 54/55 and
laundry 46/53 products get a `productKind`; the laundry gaps are abbreviated
Ariel titles (e.g. "Ariel (6kg) Color") with no form word — intentionally left
`""` rather than guessed.

### Related-products ranking

`related_rank_key(target, candidate)` in the same module gives the recommendation
order (smaller = more relevant): **1)** same `productKind` → **2)** same
category → **3)** same `audience` (when known) → **4)** shared brand or attribute
→ **5)** fallback by title. This keeps laundry forms from mixing, keeps razors
apart from cartridges, and — within the same kind and category — ranks a men's
product's male analogues above female ones.

### Wiring (apply when the working tree is clean — do not regenerate mid-batch)

1. In `scripts/build_public_catalog.py`, after `item["searchText"] = …`, merge
   the derived fields: `item.update(classify_taxonomy.enrich(product))`, and add
   `productKind` / `audience` / `attributes` to `PUBLIC_PRODUCT_FIELDS` if you
   prefer to carry them through from the source instead. Then regenerate
   `data/public-catalog.json`.
2. In `scripts/generate_product_pages.py` `related_products()`, replace the
   `related.sort(...)` europe/title key with
   `related.sort(key=lambda c: classify_taxonomy.related_rank_key(product, c))`
   (keep the existing same-category + in-stock + has-images filters and the
   fallback). Regenerate product pages.
3. Add real-catalog guardrails (once the fields exist): every laundry product
   whose title contains a form word has a non-empty `productKind`; recommendation
   output for a product leads with the same `productKind` when such products
   exist.

`scripts/classify_taxonomy_test.py` is already wired into
`scripts/verify_backend_mvp.py` so the classifier stays correct.
