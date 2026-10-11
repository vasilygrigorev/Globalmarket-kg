# Deploy Preview And Production

Global Market KG is currently a static storefront deployed through Cloudflare Pages.

Use a clean package folder for every deploy. Do not deploy the project root directly because the working tree can contain screenshots, raw Telegram files, local reports, and private import artifacts.

Before any stock/photo release, read [`AI-HANDOFF-RULES.md`](AI-HANDOFF-RULES.md). The newest 1C file is never a replacement for the persistent catalog master or the verified UI baseline.

## Preview Deploy

Build and package:

```bash
python3 scripts/package_static_site.py --include-reports
python3 scripts/verify_release_invariants.py --site-root /private/tmp/globalmarket-static-build
```

The package command runs the static build, validates product pages, checks internal local links/images, and then verifies the package with `scripts/verify_static_package.py`.

Deploy to the preview branch:

First make a separate copy of the package for preview. Add all three preview-only
controls to that copy: HTTP `X-Robots-Tag: noindex, nofollow, noarchive`, an HTML
robots noindex meta tag, and `robots.txt` with `Disallow: /`. Never edit the
production package in place.

Use the checked helper instead of editing the package manually:

```bash
python3 scripts/make_noindex_preview.py \
  /private/tmp/globalmarket-static-build \
  /private/tmp/globalmarket-static-preview
```

```bash
/Users/macmini/.npm/_npx/d77349f55c2be1c0/node_modules/.bin/wrangler pages deploy /private/tmp/globalmarket-static-preview --project-name globalmarket-kg --branch shared-layout-preview --commit-dirty=true
```

Preview URL:

```text
https://shared-layout-preview.globalmarket-kg.pages.dev
```

Check:

```bash
python3 scripts/check_deployment.py --base-url https://shared-layout-preview.globalmarket-kg.pages.dev --require-reports
```

Confirm preview indexing protection:

```bash
curl -I https://shared-layout-preview.globalmarket-kg.pages.dev/
curl https://shared-layout-preview.globalmarket-kg.pages.dev/robots.txt
```

Optional browser smoke check:

```bash
PLAYWRIGHT_RUNTIME_DIR=/private/tmp/globalmarket-playwright-runtime npx --yes --package playwright node scripts/smoke_preview.mjs --base-url https://shared-layout-preview.globalmarket-kg.pages.dev
```

## Production Deploy

Production should only happen after explicit approval.
Before production, use the focused gate checklist:
[`production-readiness.md`](production-readiness.md).

Build and package without reports:

```bash
python3 scripts/package_static_site.py
python3 scripts/verify_release_invariants.py --site-root /private/tmp/globalmarket-static-build
```

This verifies that required public files are present, raw/private folders are absent, catalog images exist in the package, and `sitemap.xml` matches the generated product pages.

Deploy the original production package. Do not deploy the preview copy containing
`noindex` or `Disallow: /`.

Deploy:

```bash
/Users/macmini/.npm/_npx/d77349f55c2be1c0/node_modules/.bin/wrangler pages deploy /private/tmp/globalmarket-static-build --project-name globalmarket-kg --branch main --commit-dirty=true
```

Verify:

```bash
python3 scripts/check_deployment.py --base-url https://globalmarket.kg
```

## What The Package Contains

- `index.html`;
- `app.js`;
- `styles.css`;
- `privacy.html`;
- `sitemap.xml`;
- `robots.txt`;
- `data/public-catalog.json`;
- `data/site-config.json`;
- `data/product-pages.json`;
- public `assets/`, excluding raw intake folders;
- generated `product/` pages.

## What The Package Excludes

- root screenshots and temporary design PNG/JPG files;
- raw Telegram upload folders;
- document inbox and 1C source files;
- local SQLite/store databases;
- private outputs unless `--include-reports` is used for preview;
- project docs and scripts.

## Rollback Note

Cloudflare Pages keeps previous deployments in the dashboard. If a production deploy is bad, restore the previous deployment from Cloudflare Pages or redeploy the last known good Git commit/package.

Archive the exact successful package, input/output master, deployment ID, rollback ID, and `SHA256SUMS` under the Dropbox `releases/` directory. Do not overwrite an older release.
