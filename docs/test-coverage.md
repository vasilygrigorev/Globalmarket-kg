# Test coverage — Global Market KG

Local, no-network safety net for the storefront + backend/admin MVP. One command
runs everything:

```bash
python3 scripts/verify_backend_mvp.py
```

It runs the Node contract tests below, `node --check` on the admin/scripts JS,
`py_compile` on the backend/admin Python, the secret scan (tracked + package),
and the static package build/verify. `tests/runner-coverage.test.mjs` enforces
that every `*.test.mjs` is wired into this runner, so nothing is silently skipped.

All tests are contract / DOM / CSS / data checks over committed files — no
browser, no Supabase, no Cloudflare, no secrets.

## Backend / API (functions/api)

- `orders.test.mjs` — pure order logic: validation, server-side total recompute,
  attribution/consent normalization, WhatsApp URL building.
- `orders.integration.test.mjs` — `onRequestPost`/`onRequest` with mocked fetch:
  503 unconfigured, 400 empty/invalid, insert orchestration, 405, 502 fallback.

## Admin (admin/)

- `admin.logic.test.mjs` — pure helpers (esc/money/when, config + admin-session,
  search sanitization, status labels, consent/source text, detail render, states,
  CSV export: field quoting + formula-injection guard, ordersToCsv, csvFilename;
  pagination: pageRange, hasMore, moreButtonText;
  sorting: sortColumn whitelist + safe fallback; amount filter: parseMinAmount,
  parseMaxAmount; statusClass colour mapping (distinct class per status, unknown
  falls back to "new"); orderAddressText (shared address join, empty when none)).
- `admin.dom.test.mjs` — required ids, HTML↔JS id contract, dynamic detail ids,
  anon-only (no service_role), CSS state classes, CSS status-colour classes.
- `admin-mobile.test.mjs` — phone/daily-use readiness: responsive viewport, title
  + noindex, wrapping control rows, ≥40px tap targets, horizontally scrollable
  orders table with a min width, and mobile keyboard hints on the filter inputs.
- `admin-resilience.test.mjs` — manager-facing robustness + accessibility:
  order rows are keyboard-operable (focusable, `role="button"`, labelled, opened
  with Enter/Space); `refreshSessionUI` reads the session inside try/catch and
  fails safe to the login view; `init` subscribes to `onAuthStateChange` to
  re-route on expiry/sign-out (skipping INITIAL_SESSION to avoid a double load);
  the list query requests an exact server-side match count so the "Всего N
  заказов" total reflects the whole filtered set, not just the loaded page;
  when the backend IS configured, `init()` proceeds past the not-configured
  gate to create a real Supabase client and load the session/orders (protects
  "orders list loads with a configured backend" — not just the not-configured
  banner path).
- `admin-package-hygiene.test.mjs` — the deploy packager excludes admin
  example/test/spec files and the package verifier forbids config templates and
  requires the three admin runtime files.
- `admin-workflow.test.mjs` — manager flow: saving updates only status +
  manager_comment (no data loss) scoped to one order; list query selects every
  field the table/CSV render; save button disables during save; order detail
  shows customer/WhatsApp/all item rows/total/address/source/manager note; a
  copy-summary button copies a plain-text order summary via the clipboard;
  detail offers WhatsApp + tel: call links and a positions/quantity summary
  ("N позиций · M шт"); a copy-address button (only when an address exists) uses
  the shared `orderAddressText`; the list query supports a max-amount filter
  (`.lte("total_kgs", maxAmount)`) alongside min-amount; reset-filters clears
  every control (incl. maxAmount) and reloads; status set stays the stable
  Russian 5 and all are selectable; every active filter (status/period/min/max
  amount/search) reassigns `query = query.<method>(...)` onto the SAME query
  object, so filters compose as AND instead of a later branch silently
  discarding earlier ones.

## Storefront contracts (tests/)

- `checkout.contract.test.mjs` — checkout fields ↔ payload, flag-gated save +
  WhatsApp fallback, no service_role; checkout submit does not gate on
  `state.customer` (works without registration — only pricing changes); a
  `checkoutSubmitting` guard + disabled submit button prevent a duplicate
  `/api/orders` POST from a quick double-click/tap, reset in a `finally` even
  if saving throws; `buildOrderPayload`'s customer/item field names are each
  read by `functions/api/orders.js` (`customer.<field>` / `raw.<field>`),
  locking the client payload shape to the server contract; `docs/api-orders.md`
  no longer documents the unused `customer.whatsapp` field (phone doubles as
  the WhatsApp contact — see the doc's "Known gap" note on the `customers`
  table not being written yet).
- `rollback.contract.test.mjs` — flag boolean, WhatsApp fallback, rollback docs,
  function 503 fallback.
- `home-cards-checkout.test.mjs` — home card price/brand/type/volume/image/cart/
  favorite, product open/details + registration discount text; checkout without
  registration; UTM/customer fields sent.
- `category-tiles.test.mjs` — 11 tiles, images exist, real catalog categories.
- `header-menu.test.mjs` — 11 menu sections = 11 tiles by name; shared menu source.
- `shared-layout.test.mjs` — header/footer from shared partials (not diverged);
  footer links; product-page action set; header home/catalog/delivery/checkout
  links are absolute (`/#top` etc, not a bare `#top`) both in the partial and
  on sampled product/category/catalog pages, so "go home" keeps working from a
  page nested under `/product/`, `/category/`, `/catalog/`; the `data-back`
  button's generated JS falls back to an absolute `/#catalog` when there is no
  browser history to go back to.
- `storefront-layout.test.mjs` — section order (header→banner→strip→grid), fixed
  header + body offset (no overlap), menu open/close, cart/search present.
- `storefront-a11y.test.mjs` — card images have alt text + lazy loading;
  favorite/open/add controls carry aria labels; every product page declares
  lang=ru and gives every image an alt attribute.
- `banner-carousel.test.mjs` — hero/banner carousel contract.
- `search-categories.test.mjs` — search UI + synonyms source; synonyms target only
  real catalog categories/brands/collections; nav targets valid.

## Product pages + SEO (tests/)

- `product-pages.test.mjs` — every product page: og/twitter, favicon/manifest/
  theme-color, Product + Breadcrumb JSON-LD, WhatsApp order/question, shared menu,
  indexable.
- `product-consistency.test.mjs` — manifest ↔ catalog data, page price ↔ catalog,
  gallery card/front/back, perfume single card image, page essentials; every
  related-product card (`render_related()` in
  `scripts/generate_product_pages.py`) links to a product page that actually
  exists on disk AND references an image that actually exists on disk — a
  text-only "related section is present" check would miss a related card
  pointing at a deleted product or image.
- `gallery-completeness.test.mjs` — catalog-level AGENTS photo contract: no
  incomplete non-perfume gallery (1–2 images), perfume single card, product.image
  equals galleryImages[0], multi-image galleries lead with the card image.
- `catalog-data-quality.test.mjs` — product data invariants: unique prd_ ids,
  real (non-placeholder) titles, sane retail prices, registered ≤ retail and a
  real discount within a 1–10% band, every referenced image exists on disk,
  categoryId↔category 1:1, perfume 5 ml wording.
- `catalog-image-hygiene.test.mjs` — gallery filenames end with an approved
  card-front/front/back (or perfume card-front-vN) suffix, allowed extension, and
  expose no temp/contact-sheet/OCR/dup/**telegram-** filenames (raw bot exports);
  every gallery path lives inside a subfolder of `assets/products/` (never loose
  at the root); every perfume product image lives under
  `assets/products/perfume/`.
- `landing-counts.test.mjs` — category/collection landing `count` equals the
  catalog count for that facet; brand landing pages non-empty with shown ≤ count.
- `catalog-fields.test.mjs` — per-product field validity: known status
  (active/review), non-empty searchText/description/brand, rating in 0..5, units
  non-empty and perfume sold in ml; searchText is findable by brand, product
  name, and category (protects catalog search).
- `search-synonyms-terms.test.mjs` — documented customer-language brainstorm
  terms stay present, every synonym group is usable, no repeated word in a list.
- `photo-coverage.test.mjs` — photo coverage math is sane; every photographed
  product has a valid gallery (perfume=1, others=3 or a known exception); the
  card+front-only exception list is identical across the gallery verifier, the
  report script, `docs/product-photo-rules.md`, and `AGENTS.md`; exception ids
  exist in the catalog.
- `seo-consistency.test.mjs` — product+landing canonical/og:url/title vs manifest
  and sitemap; unique product canonicals.
- `home-seo.test.mjs` — homepage canonical/description, social meta, PWA bits,
  Organization + WebSite/SearchAction JSON-LD.
- `robots-sitemap.test.mjs` — robots.txt (Allow, Disallow /admin/, Sitemap) and
  sitemap.xml shape (urlset + image namespace, homepage/catalog/privacy, URL count).
- `landing-pages.test.mjs` — landing manifest shape: known type + matching path
  prefix (category/collection/brand), path ends /<slug>/, url = base + path, unique
  slugs, title/seoTerms/count present, each page generated on disk; category slugs
  resolve to catalog categoryIds and collection slugs to catalog collections.
- `site-integrity.test.mjs` — no orphan product pages (disk ↔ manifest both ways),
  404.html exists + noindex + title, homepage favicon/apple-touch-icon files exist.
- `settings-contract.test.mjs` — public-catalog `settings` carries the fields the
  storefront uses (manager_whatsapp, registration discount, free-delivery
  threshold), values are sane, and agree with data/settings.json.

## Guards (tests/ + scripts/)

- `runner-coverage.test.mjs` — all test files are wired into the preflight.
- `docs-consistency.test.mjs` — doc script references exist; release/readiness keep
  the orders-API smoke; env var names consistent.
- `scripts/check_no_secrets.py` — JWT/.env/service_role / committed admin config.
- `scripts/check_backend_env_shape.py` — env/config shape, no values printed.
- `scripts/verify_static_package.py` — deploy package: required files, no test/dev
  leaks, functions + admin runtime present, secret scan, and data/ allowlist (only
  the five public data files ship — no store.db/products.csv/raw sources leak).
- `scripts/verify_product_galleries.py` — product gallery contract (card/front/back
  order, perfume single card, known exceptions), now wired into the preflight.
  Also enforces path hygiene on every photographed product regardless of
  exception status: no raw/temp filename marker (`telegram-`/`ocr`/`contact`/
  `sheet`/`dup`), image must live inside a subfolder of `assets/products/`
  (never loose at the root), and perfume images must live under
  `assets/products/perfume/`.
- `scripts/report_photo_coverage.py` — deterministic photo-coverage report
  (total, with photos, %, by category, perfume, non-perfume complete-gallery
  count, known exceptions); run manually or `--json`. Also reports
  `unused_raw_leftovers`: files under `assets/products/` that look like raw
  Telegram/OCR/contact-sheet leftovers (same marker set as the gallery
  verifier) and are not referenced by any product — report-only, nothing is
  ever deleted automatically. Syntax-checked in the preflight.
