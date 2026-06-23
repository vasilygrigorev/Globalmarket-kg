# Agent Runbook

This runbook is for Codex and Claude Code when working on Global Market KG.

Project path:

```bash
/Users/macmini/Documents/Codex/2026-05-28-new-chat-2
```

Before making changes, read:

- `/Users/macmini/.codex/shared-state/COLLAB-PROTOCOL.md`
- `/Users/macmini/.codex/shared-state/handoff.md`
- `/Users/macmini/.codex/shared-state/tasks.md`
- `/Users/macmini/.codex/shared-state/decisions.md`
- `/Users/macmini/.codex/memories/cross-chat-memory/current-focus.md`
- `AGENTS.md`

Do not production-deploy or push to GitHub unless the user explicitly asks.

## Environment

Known local environment used for the current preview baseline:

- Python: `python3` -> `Python 3.9.6`
- Node: `node` -> `v24.15.0`
- Wrangler: `npx --yes wrangler --version` -> `4.103.0`
- `xlrd`: `2.0.1`
- Playwright Python module: not installed locally
- Browser smoke uses Node Playwright through `npx --yes --package playwright`
- Playwright runtime directory used by smoke tests:

```bash
PLAYWRIGHT_RUNTIME_DIR=/private/tmp/globalmarket-playwright-runtime
```

## Core Build Flow

Use this before any preview deploy:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/pycache-globalmarket python3 scripts/package_static_site.py --include-reports
```

This command runs the static build and package verification. It writes a clean deploy package to:

```bash
/private/tmp/globalmarket-static-build
```

## Preview Deploy Only

Preview deploy command:

```bash
npx --yes wrangler pages deploy /private/tmp/globalmarket-static-build \
  --project-name globalmarket-kg \
  --branch shared-layout-preview \
  --commit-dirty=true \
  --skip-caching
```

Preview alias:

```text
https://shared-layout-preview.globalmarket-kg.pages.dev
```

Do not deploy production without explicit user instruction.

## Verification Commands

Post-deploy checker:

```bash
python3 scripts/check_deployment.py \
  --base-url https://shared-layout-preview.globalmarket-kg.pages.dev \
  --require-reports
```

Browser smoke:

```bash
PLAYWRIGHT_RUNTIME_DIR=/private/tmp/globalmarket-playwright-runtime \
  npx --yes --package playwright node scripts/smoke_preview.mjs \
  --base-url https://shared-layout-preview.globalmarket-kg.pages.dev
```

## Script Map

### `scripts/build_static_site.py`

Runs the full local build pipeline:

- validates `data/site-config.json`;
- syncs shared layout partials;
- regenerates product pages;
- regenerates landing pages;
- regenerates catalog map;
- validates landing/product/search/structured data/internal links;
- regenerates sitemap, robots, build manifest, project stage report;
- verifies product galleries;
- checks JS/Python syntax.

Run:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/pycache-globalmarket python3 scripts/build_static_site.py
```

### `scripts/package_static_site.py`

Builds and copies only public-safe files into `/private/tmp/globalmarket-static-build`.
It excludes raw Telegram/document intake, local DBs, source spreadsheets, screenshots, and private working folders.

Run:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/pycache-globalmarket python3 scripts/package_static_site.py --include-reports
```

Output:

- `/private/tmp/globalmarket-static-build`
- report files under `outputs/` if `--include-reports` is used

### `scripts/verify_static_package.py`

Validates the clean deploy package:

- required public files;
- required data files;
- required generated directories;
- no forbidden raw/private paths;
- catalog image references exist;
- sitemap count matches generated pages;
- manifests match generated files;
- optional report files exist.

Run:

```bash
python3 scripts/verify_static_package.py --package /private/tmp/globalmarket-static-build --require-reports
```

### `scripts/check_deployment.py`

Checks a deployed preview:

- homepage;
- `/catalog/`;
- public JSON data;
- sitemap/robots;
- known product page;
- preview reports;
- active banner targets resolve to non-empty product sets.

Run:

```bash
python3 scripts/check_deployment.py --base-url https://shared-layout-preview.globalmarket-kg.pages.dev --require-reports
```

### `scripts/generate_product_pages.py`

Generates static product pages under:

```text
product/<slug>/index.html
```

It uses `data/public-catalog.json`, product images, related products, shared header/footer, Product JSON-LD, breadcrumbs, and product-to-brand/category/collection links.

Run all:

```bash
python3 scripts/generate_product_pages.py --all --report
```

Run one product:

```bash
python3 scripts/generate_product_pages.py --product-id <product_id> --report
```

Outputs:

- `product/<slug>/index.html`
- `data/product-pages.json`
- `outputs/product-pages-report.md`

### `scripts/generate_landing_pages.py`

Generates SEO landing pages:

- `/category/<slug>/`
- `/collection/europe/`
- `/brand/<slug>/`

It also renders contextual links between categories, brands, and collections.

Run:

```bash
python3 scripts/generate_landing_pages.py --report
```

Outputs:

- `category/*/index.html`
- `collection/*/index.html`
- `brand/*/index.html`
- `data/landing-pages.json`
- `outputs/landing-pages-report.md`

### `scripts/generate_catalog_index.py`

Generates the catalog map page:

```text
catalog/index.html
```

Public URL:

```text
/catalog/
```

Run:

```bash
python3 scripts/generate_catalog_index.py --report
```

Outputs:

- `catalog/index.html`
- `outputs/catalog-index-report.md`

### `scripts/import_stock.py`

Legacy/current stock import helper for 1C stock files. It supports the daily MXL/XLS stock workflow and preserves manual product overrides, images, titles, categories, promotions, and visibility where applicable.

Use carefully. Before importing, confirm the source file and expected effect with the user.

Typical input:

```text
*.mxl / *.xls / *.xlsx / *.csv
```

Expected outputs vary by import mode but generally update catalog/store data and write review reports under `outputs/`.

If the script is missing or replaced by a newer import script, search:

```bash
rg -n "import_stock|mxl|public-catalog|store.db" scripts docs
```

### `scripts/sync_layout_partials.py`

Generates shared layout partials from `data/site-config.json`:

- `partials/header.html`
- `partials/footer.html`

Homepage and generated pages share these blocks.

Run:

```bash
python3 scripts/sync_layout_partials.py
```

### `scripts/smoke_preview.mjs`

Runs a browser smoke test against preview:

- mobile/desktop homepage basics;
- header/menu/cart;
- product page gallery/actions/related products.

Run:

```bash
PLAYWRIGHT_RUNTIME_DIR=/private/tmp/globalmarket-playwright-runtime \
  npx --yes --package playwright node scripts/smoke_preview.mjs \
  --base-url https://shared-layout-preview.globalmarket-kg.pages.dev
```

Output:

- `outputs/browser-smoke-report.md`

### Validation Scripts

Run individually when debugging:

```bash
python3 scripts/validate_site_config.py
python3 scripts/validate_product_pages.py
python3 scripts/validate_landing_pages.py
python3 scripts/validate_search_synonyms.py
python3 scripts/validate_structured_data.py
python3 scripts/validate_internal_links.py
python3 scripts/verify_product_galleries.py
```

What they check:

- `validate_site_config.py`: banners, menu, quick categories, footer links.
- `validate_product_pages.py`: generated product page SEO tags, Product JSON-LD, shared blocks, actions, images, related links.
- `validate_landing_pages.py`: landing H1/canonical/meta/JSON-LD/SEO terms/contextual links.
- `validate_search_synonyms.py`: customer-language search terms against current catalog.
- `validate_structured_data.py`: JSON-LD presence and required schema types.
- `validate_internal_links.py`: local `href/src/srcset` references.
- `verify_product_galleries.py`: product photo contract.

## Product Photo Contract

For ordinary photographed products, the public gallery must be:

1. `card-front`
2. `front`
3. `back`

Perfume 5 ml uses one designed product card image and does not require front/back.

Before publishing photo/catalog work:

```bash
python3 scripts/verify_product_galleries.py
```

## Current Static Limits

This branch is still static/build-time:

- no Supabase backend yet;
- no admin panel yet;
- no customer accounts yet;
- no live database order history yet;
- no Pixel/Analytics unless the user explicitly asks.

Use the static pipeline until the backend migration starts.
