# Static Build Workflow

This project is still a static storefront. The build workflow exists to make static changes safer until the Supabase/backend stage starts.

## Main Commands

Build everything locally:

```bash
python3 scripts/build_static_site.py
```

Build and package a preview deploy:

```bash
python3 scripts/package_static_site.py --include-reports
```

Check a deployed preview:

```bash
python3 scripts/check_deployment.py --base-url https://shared-layout-preview.globalmarket-kg.pages.dev --require-reports
```

Run a real-browser smoke test for key mobile/desktop flows:

```bash
PLAYWRIGHT_RUNTIME_DIR=/private/tmp/globalmarket-playwright-runtime npx --yes --package playwright node scripts/smoke_preview.mjs --base-url https://shared-layout-preview.globalmarket-kg.pages.dev
```

Check production:

```bash
python3 scripts/check_deployment.py --base-url https://globalmarket.kg
```

## Script Responsibilities

- `scripts/validate_site_config.py`: checks `data/site-config.json`, banner/menu/category targets, and image paths.
- `scripts/sync_layout_partials.py`: rebuilds `partials/header.html` and `partials/footer.html`, then injects them into `index.html`.
- `scripts/generate_product_pages.py`: generates static `product/<slug>/index.html` pages and `data/product-pages.json`.
- `scripts/generate_landing_pages.py`: generates static `category/<slug>/index.html` and `collection/<slug>/index.html` landing pages plus `data/landing-pages.json`.
- `scripts/validate_product_pages.py`: checks generated product pages for SEO tags, Product JSON-LD, local images, related links, and shared header/footer.
- `scripts/validate_structured_data.py`: checks homepage and product-page JSON-LD for Organization, WebSite, Product, and BreadcrumbList.
- `scripts/generate_sitemap.py`: creates `sitemap.xml` and `robots.txt`.
- `scripts/validate_internal_links.py`: checks local `href`, `src`, and `srcset` references across homepage, privacy page, and generated product pages.
- `scripts/generate_build_manifest.py`: writes a public-safe build manifest with key file hashes and product/page/sitemap counts.
- `scripts/generate_project_stage_report.py`: writes the current approximate project-stage map for orientation in ongoing reports.
- `scripts/build_static_site.py`: runs the local build and verification sequence.
- `scripts/package_static_site.py`: creates `/private/tmp/globalmarket-static-build` with only public deploy files.
- `scripts/verify_static_package.py`: checks that the deploy package has required files and no private/raw artifacts.
- `scripts/check_deployment.py`: checks a published URL after Cloudflare deploy.
- `scripts/smoke_preview.mjs`: optional Playwright browser smoke test for homepage/product rendering, menu, cart drawer, and add-to-cart.

## Public Deploy Package

The package includes:

- root public files;
- `data/public-catalog.json`;
- `data/site-config.json`;
- `data/product-pages.json`;
- public assets;
- generated product pages.

The package excludes:

- raw Telegram/photo inboxes;
- document inbox and 1C source files;
- local DBs;
- screenshots and design drafts;
- scripts and docs.

## Current Static Limits

Static pages can support:

- SEO product URLs;
- shared header/footer/menu;
- banner links into catalog sections;
- localStorage cart/favorites/recently viewed;
- WhatsApp checkout.

Static pages cannot safely support:

- real customer accounts;
- authenticated reviews;
- manager admin editing;
- server-side order history;
- reliable analytics events;
- inventory transactions.

Those belong to the future backend/Supabase stage.
