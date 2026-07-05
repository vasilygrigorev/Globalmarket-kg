# Claude Next Task

> **STATUS: "Свежие товары" MOBILE STOREFRONT MVP DONE.**
>
> Verified live in a browser at mobile/tablet/desktop widths. Codex: replace
> this file's body with the next task when there is one.

## Outcome (2026-07-05)

- **Mobile**: category tiles (`.quick-category-grid`) no longer take vertical
  space — hidden via CSS in the existing `@media (max-width: 680px)` block.
  The compact catalog directory (`Главная / ...`) stays visible. Right below
  it, a new **"Свежие товары"** horizontal strip shows up to 16 products,
  sourced live from the catalog (not localStorage), reusing the
  `.recent-product` card family (image + brand pill + type/size + price + a
  small "+" add button), with a bottom-right `Новинка`/`Хит` badge when
  `productBadges()` returns one.
- **Desktop/tablet**: unchanged — category tiles stay fully visible, "Свежие
  товары" renders below them (same section, just not hidden by the mobile
  media query). Verified visually at 375px, 768px, and 1280px.
- **Selection logic**: new `freshProducts(limit = 16)` in `app.js` — starts
  from `product.status === "active"`, sorts by real-photo first, then
  `Новинка` badge, then rating, then title; caps at 2 per `categoryId` and 2
  per `brand`, backfilling with the next-best products if the cap leaves
  slots unfilled. No new catalog fields invented.
- **Add-to-cart**: `data-fresh-add` click delegation on `#freshProductsRow`
  mirrors the existing `data-recent-add` pattern exactly — `addToCart()` +
  `showAddFeedback()`, never opens the cart drawer. Verified live: clicking
  "+" on a fresh card bumped the header cart count without opening the
  drawer.
- **Bug found and fixed during browser verification**: the badge was
  initially positioned top-right, which overlapped the existing top-left
  brand pill on narrow (~82-104px) mobile cards, garbling both into
  unreadable overlapping text. Moved the badge to bottom-right — confirmed
  clean in a mobile screenshot afterward.
- **Category access**: the header menu (`#categoryMenu`, `#toggleMenu`) is
  completely unchanged and still lists all 11 category sections — verified
  live by opening it on a 375px viewport.

Changed files: `index.html` (new `#freshProducts`/`#freshProductsRow`
section), `app.js` (`freshProducts()`, `renderFreshProducts()`, DOM refs,
click delegation, one call in `loadCatalog()`), `styles.css` (`.fresh-products`
family + mobile `.quick-category-grid { display: none; }`),
`tests/fresh-products.test.mjs` (new, 6 tests), `tests/storefront-layout.test.mjs`
(+1 order assertion), `scripts/verify_backend_mvp.py` (wired the new test),
`docs/test-coverage.md`.

Verification: `node --check app.js` OK; 26 relevant node tests OK;
`verify_backend_mvp.py --skip-package` OK (hit one pre-existing, unrelated
test-isolation flake between `photo-cleanup-guard.test.mjs` and
`raw-photo-triage.test.mjs` sharing `assets/products/` during a fixture
write — passed clean on retry twice, not caused by this task);
`check_no_secrets.py` clean; `git diff --check` clean.

## Next candidate tasks (pick one, or wait for a new user goal)

1. **Optional Claude-safe follow-up**: the pre-existing flaky race between
   `tests/photo-cleanup-guard.test.mjs` and `tests/raw-photo-triage.test.mjs`
   (both briefly touch files directly under `assets/products/`) could be
   hardened by giving the cleanup-guard fixture a name that can never collide
   with a real/raw file group, or by having the triage scan ignore
   obviously-synthetic fixture names. Low priority — it self-resolves on
   retry and has never affected real data.
2. **Waiting on Petya/user**: the 2 remaining Dove variants
   (`docs/pending-photo-review.md`) still need one more card-front photo
   each, or an explicit 2-photo exception approval.
3. **Business decision, not Claude-safe alone**: 6 photographed products
   (TRESemmé x2, Sunsilk x4) stay hidden because 1C reports 0 stock, despite
   a past session note saying the user wanted them shown anyway — needs a
   stock re-check or a deliberate "show despite 0 stock" feature decision.
4. **Codex/user-only**: GitHub push/merge decision for
   `collab/preview-baseline`, and the standing Supabase
   `SUPABASE_SERVICE_ROLE_KEY` production-secret item — unrelated to this
   task.

Do not restart an open-ended improvement cycle without a specific new goal
from the user.
