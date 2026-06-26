# Release Checklist

Use this checklist before committing and deploying Global Market KG production changes.

## 1. Review Scope

Check what changed:

```bash
git status --short --branch
git diff --stat
```

For the current shared-layout/product-page work, expected files include:

- `app.js`;
- `index.html`;
- `styles.css`;
- `data/site-config.json`;
- `data/product-pages.json`;
- `data/landing-pages.json`;
- `partials/header.html`;
- `partials/footer.html`;
- `scripts/generate_product_pages.py`;
- `scripts/generate_landing_pages.py`;
- `scripts/sync_layout_partials.py`;
- `scripts/validate_site_config.py`;
- `scripts/generate_sitemap.py`;
- `scripts/build_static_site.py`;
- `scripts/package_static_site.py`;
- `scripts/verify_static_package.py`;
- `scripts/check_deployment.py`;
- `scripts/smoke_preview.mjs`;
- `scripts/validate_product_pages.py`;
- `scripts/validate_structured_data.py`;
- `scripts/validate_internal_links.py`;
- `scripts/generate_build_manifest.py`;
- `scripts/generate_project_stage_report.py`;
- `docs/site-config-guide.md`;
- `docs/deploy-preview-and-production.md`;
- `docs/release-checklist.md`;
- `sitemap.xml`;
- `robots.txt`;
- generated `product/<slug>/index.html` pages.
- generated `category/<slug>/index.html` and `collection/<slug>/index.html` pages.

Do not include unrelated raw photo files, old screenshots, Telegram inbox files, 1C source exports, local databases, or private outputs.

## 2. Build

```bash
python3 scripts/package_static_site.py --include-reports
```

Expected:

- `Build OK`;
- `Package OK`;
- product pages count is not unexpectedly lower than before;
- gallery verification reports zero contract errors.

## 3. Preview

```bash
/Users/macmini/.npm/_npx/d77349f55c2be1c0/node_modules/.bin/wrangler pages deploy /private/tmp/globalmarket-static-build --project-name globalmarket-kg --branch shared-layout-preview --commit-dirty=true
```

Preview:

```text
https://shared-layout-preview.globalmarket-kg.pages.dev
```

Check at least:

```bash
python3 scripts/check_deployment.py --base-url https://shared-layout-preview.globalmarket-kg.pages.dev --require-reports
```

The script checks:

- homepage opens;
- config/catalog JSON parse;
- banner links open non-empty sections;
- known product page opens;
- `sitemap.xml` opens and parses;
- `robots.txt` opens;
- preview reports are present when requested.

Optional real-browser check:

```bash
PLAYWRIGHT_RUNTIME_DIR=/private/tmp/globalmarket-playwright-runtime npx --yes --package playwright node scripts/smoke_preview.mjs --base-url https://shared-layout-preview.globalmarket-kg.pages.dev
```

## 4. Commit

Only after preview review.

Stage deliberately, not with blind `git add .`.

Example:

```bash
git add app.js index.html styles.css data/site-config.json data/product-pages.json partials/header.html partials/footer.html
git add scripts/generate_product_pages.py scripts/generate_landing_pages.py scripts/sync_layout_partials.py scripts/validate_site_config.py scripts/validate_product_pages.py scripts/validate_structured_data.py scripts/validate_internal_links.py scripts/generate_build_manifest.py scripts/generate_project_stage_report.py scripts/generate_sitemap.py scripts/build_static_site.py scripts/package_static_site.py scripts/verify_static_package.py scripts/check_deployment.py scripts/smoke_preview.mjs
git add docs/site-config-guide.md docs/deploy-preview-and-production.md docs/release-checklist.md docs/static-build-workflow.md sitemap.xml robots.txt
git add product category collection data/landing-pages.json
git commit -m "Add shared layout and product page build workflow"
```

Before committing, inspect staged files:

```bash
git diff --cached --stat
git status --short
```

## 5. Production Deploy

Only after explicit user approval.
For backend/admin production, also complete:
[`production-readiness.md`](production-readiness.md).

```bash
python3 scripts/package_static_site.py
/Users/macmini/.npm/_npx/d77349f55c2be1c0/node_modules/.bin/wrangler pages deploy /private/tmp/globalmarket-static-build --project-name globalmarket-kg --branch main --commit-dirty=true
```

Verify production (static + orders API route):

```bash
python3 scripts/check_deployment.py --base-url https://globalmarket.kg
node scripts/smoke_orders_api.mjs --base-url https://globalmarket.kg
```

The `smoke_orders_api.mjs` probe creates no data (expects 400, or 503 if env is
not set). Full backend verification + the manual checkout test are in
[`production-readiness.md`](production-readiness.md) §5.

## 6. Rollback

If production breaks:

1. Use Cloudflare Pages dashboard to restore previous deployment, or
2. Redeploy the last known good commit/package.

Record the rollback action in shared state.
