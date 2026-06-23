# Site Config Guide

`data/site-config.json` is the editable storefront configuration for shared layout blocks.

It controls:

- top navigation labels and links;
- dropdown menu items;
- rotating homepage banners;
- quick category tiles;
- footer links and footer text.

Search synonyms live separately in `data/search-synonyms.json`. Use it for customer-language words such as `дезик`, `део`, `запаски`, `кассеты`, `посудомойка`, `стиральная машина`, and legacy marketing terms such as `Германия` -> `Европа`.

The goal is to change common storefront blocks in one place, then regenerate pages instead of editing every product page by hand.

## Edit Flow

1. Edit `data/site-config.json`.
2. Run:

```bash
python3 scripts/build_static_site.py
```

3. Package a clean preview/deploy folder:

```bash
python3 scripts/package_static_site.py --include-reports
```

4. Deploy preview from `/private/tmp/globalmarket-static-build`.

Do not deploy production until the preview is reviewed.

The package command also verifies that required public files are present, raw/private folders are absent, catalog image references exist, and `sitemap.xml` matches the generated product pages.

The build command runs:

- `scripts/validate_site_config.py`;
- `scripts/sync_layout_partials.py`;
- `scripts/generate_product_pages.py --all --report`;
- `scripts/generate_landing_pages.py --report`;
- `scripts/validate_product_pages.py`;
- `scripts/generate_sitemap.py`;
- `scripts/validate_internal_links.py`;
- `scripts/verify_product_galleries.py`;
- JavaScript and Python syntax checks.

For targeted debugging, the individual commands can still be run separately.

## Banners

Banner fields:

- `image`: public image path under `assets/`;
- `alt`: image alt text;
- `eyebrow`: small banner label;
- `title`: large banner text;
- `href`: where the banner opens;
- `active`: set `false` to hide the banner without deleting it;
- `startsAt`: optional ISO date/time for scheduled start;
- `endsAt`: optional ISO date/time for scheduled end.

Examples:

```json
{
  "image": "/assets/hero-promo-dalli-autumn.jpg",
  "alt": "Средства Dalli на осеннем фоне",
  "eyebrow": "Dalli",
  "title": "Стирка для всей семьи",
  "href": "/?collection=europe&query=Dalli&label=Dalli#catalog",
  "active": true
}
```

Supported catalog link parameters:

- `category`: exact public category name;
- `collection`: marketing collection, for example `europe`;
- `query` or `q`: search text;
- `label`: readable breadcrumb label.

Use `collection + query` for brand campaigns inside a collection, such as Dalli or Dash inside Europe.

## Menu

Menu item fields:

- `label`;
- `href`, or
- `category`, or
- `collection`, or
- `query`.

The homepage and generated product pages use the same menu config.

## Quick Categories

Quick category card fields:

- `title`;
- `image`;
- `category`, `collection`, and/or `query`.

The validator checks that each card points to at least one active product.

## Search Synonyms

`data/search-synonyms.json` groups rough customer words by intent:

- `aliases`: words or phrases the customer may type;
- `terms`: words expected inside matching product data;
- `landingTerms`: safe public SEO chips for generated category/collection pages;
- `categories`, `categoryIds`, `collections`, `brands`: optional targeting hints.

Keep uncertain brainstorm words out of matching by putting them into `ignoredDraftTerms`. Example: `сергей` is currently ignored because it looks like dictation noise, not a product term.

Before preview/deploy, run:

```bash
python3 scripts/validate_search_synonyms.py
python3 scripts/validate_landing_pages.py
```

The validator writes `outputs/search-synonyms-report.md` and checks customer-language queries such as `дезик`, `кассеты`, `пена для бритья`, `посудомойка`, `Германия`, and `стиральная машина` against the current public catalog.
Landing validation writes `outputs/landing-pages-validation-report.md` and confirms that generated category/collection pages contain their SEO terms in visible text and meta descriptions.

## Footer

Footer fields:

- `footerLinks`: list of visible links;
- `footerText`: short shared footer text.

The footer is injected into the homepage and generated product pages from `partials/footer.html`.

## Generated Files

Do not edit these by hand unless needed for debugging:

- `partials/header.html`;
- `partials/footer.html`;
- `product/<slug>/index.html`.
- `catalog/index.html`;
- `category/<slug>/index.html`;
- `collection/<slug>/index.html`;
- `brand/<slug>/index.html`;
- `sitemap.xml`;
- `robots.txt`.
- `data/product-pages.json`.
- `data/landing-pages.json`.

Regenerate them from `data/site-config.json` and `scripts/generate_product_pages.py`.

## Packaging

Use `scripts/package_static_site.py` before Cloudflare Pages deploys.

The package script copies only the public storefront files:

- `index.html`;
- `app.js`;
- `styles.css`;
- `privacy.html`;
- `catalog/`;
- `sitemap.xml`;
- `robots.txt`;
- `data/public-catalog.json`;
- `data/site-config.json`;
- `data/product-pages.json`;
- `assets/`, excluding raw intake folders;
- generated `product/` pages.
- generated `catalog/` map page.
- generated `category/` and `collection/` landing pages.
- generated `brand/` landing pages.

This avoids accidentally deploying local screenshots, source spreadsheets, Telegram inbox files, private working outputs, or old experiment files.

## Current Limits

- This is still a static/build-time setup.
- No backend, Supabase, SQL, admin panel, Pixel, or Analytics is required for this layer.
- Reviews, real customer accounts, order history, and admin editing should be added later through the backend stage.
