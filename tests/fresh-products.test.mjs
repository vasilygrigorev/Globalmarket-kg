// "Свежие товары" (fresh products) storefront strip contract — no network, no browser.
// Mobile removes/reduces category tiles under the banner and replaces them with a
// small horizontal strip of fresh/new products sourced from the catalog, while
// category access stays reachable through the header menu. This locks the mount
// points, selection-logic guardrails, and mobile CSS so a future redesign can't
// silently drop the mobile category-access story or reintroduce a 10-of-one-brand
// strip.
// Run: node --test tests/fresh-products.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const html = read("index.html");
const appJs = read("app.js");
const css = read("styles.css");

test("index.html has the fresh-products mount point between the category strip and the product grid", () => {
  assert.match(html, /id="freshProducts"/);
  assert.match(html, /id="freshProductsRow"/);
  const strip = html.indexOf('id="quickCategoryGrid"');
  const fresh = html.indexOf('id="freshProducts"');
  const grid = html.indexOf('id="productGrid"');
  assert.ok(strip >= 0 && fresh >= 0 && grid >= 0, "missing a mount point");
  assert.ok(strip < fresh, "fresh products section must come after the category strip");
  assert.ok(fresh < grid, "fresh products section must come before the product grid");
});

test("app.js renders a fresh-products section from the catalog, not localStorage", () => {
  assert.match(appJs, /function renderFreshProducts\(/);
  assert.match(appJs, /function freshProducts\(/);
  assert.match(appJs, /freshProductsSection\.hidden = items\.length === 0/);
  // Sourced from the in-memory catalog (`products`), not a recently-viewed-style
  // localStorage id list.
  assert.match(appJs, /freshProducts\(limit = \d+\)[\s\S]*?const eligible = products\.filter/);
});

test("selection uses only first-seen products from the latest 1C export", () => {
  const match = appJs.match(/function freshProducts\(limit[\s\S]*?\n\}/);
  assert.ok(match, "freshProducts() body not found");
  const body = match[0];
  assert.match(body, /firstSeenAt/);
  assert.match(body, /latestStockDate/);
  assert.doesNotMatch(body, /restockedAt/, "a restock must not make an existing product fresh");
  assert.doesNotMatch(body, /productBadges/, "placeholder badges must not define freshness");
});

test("fresh products are round-robin diversified by useful product types", () => {
  assert.match(appJs, /function freshProductGroup\(/);
  assert.match(appJs, /порош/);
  assert.match(appJs, /шампун/);
  assert.match(appJs, /дезодорант\|антиперспирант/);
  assert.match(appJs, /зубн\.\*щ/);
  assert.match(appJs, /buckets\.get\(key\)\?\.shift\(\)/);
  assert.match(appJs, /<div class="fresh-product-badge">Новинка<\/div>/);
});

test("fresh cards add to cart without opening the cart drawer", () => {
  assert.match(appJs, /freshProductsRow\?\.addEventListener\("click"/);
  const match = appJs.match(/freshProductsRow\?\.addEventListener\("click"[\s\S]*?\n\}\);/);
  assert.ok(match, "fresh products click handler not found");
  const handler = match[0];
  assert.match(handler, /data-fresh-add/);
  assert.match(handler, /addToCart\(addButton\.dataset\.freshAdd\)/);
  assert.doesNotMatch(handler, /setCartOpen\(true\)/, "adding from a fresh card must not force-open the cart drawer");
});

test("CSS renders the marketplace category rail and fresh products on the mobile home", () => {
  const mobileBlock = css.match(/@media \(max-width: 680px\) \{[\s\S]*/);
  assert.ok(mobileBlock, "mobile breakpoint not found");
  const mobile = mobileBlock[0];
  assert.match(
    mobile,
    /body\.home-page\s+\.quick-category-grid\s*\{[^}]*display:\s*flex\s*!important/s,
    "the mobile marketplace home must expose the horizontal category rail",
  );
  assert.match(
    mobile,
    /body\.home-page\s+\.catalog-directory\s*\{[^}]*display:\s*none/s,
    "the redundant breadcrumb stays hidden on the redesigned home; category access is the rail plus header menu",
  );
  assert.match(mobile, /\.fresh-products(-heading|-row)?\s*\{/, "fresh-products mobile styling missing");
});

test("category access remains available through the header menu (unchanged by this task)", () => {
  // Guards against accidentally removing category access altogether when tiles
  // are hidden on mobile — the menu must still exist and still be openable.
  assert.match(html, /id="categoryMenu"/);
  assert.match(html, /id="toggleMenu"/);
  assert.match(appJs, /function renderCategoryMenu\(/);
});
