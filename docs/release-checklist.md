# Release Checklist

Use this checklist before committing and deploying Global Market KG production changes.

## 1. Review Scope

Read `docs/AI-HANDOFF-RULES.md`. Confirm Petya did not edit or deploy the site and confirm the working branch starts from the currently verified production baseline.

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
python3 scripts/verify_release_invariants.py --site-root /private/tmp/globalmarket-static-build
```

Expected:

- `Build OK`;
- `Package OK`;
- product pages count is not unexpectedly lower than before;
- gallery verification reports zero contract errors.
- all previous production slugs still exist;
- every active product has a generated `productPagePath` and a real static page, including products using a neutral placeholder;
- no approved gallery shrank;
- inactive products retain informative pages without purchase controls;
- service code `2322` is absent from public output.

## 3. Preview

Never deploy an indexable preview. First copy the immutable package to a separate
preview directory, add `X-Robots-Tag: noindex, nofollow, noarchive`, add an HTML
noindex meta tag to every page, and use preview-only `robots.txt` with
`Disallow: /`. Do not apply those changes to the production package.

```bash
python3 scripts/make_noindex_preview.py \
  /private/tmp/globalmarket-static-build \
  /private/tmp/globalmarket-static-preview
```

```bash
/Users/macmini/.npm/_npx/d77349f55c2be1c0/node_modules/.bin/wrangler pages deploy /private/tmp/globalmarket-static-preview --project-name globalmarket-kg --branch shared-layout-preview --commit-dirty=true
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

Also verify with `curl -I` that the preview returns `X-Robots-Tag`, while the
production homepage does not return that header.

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
