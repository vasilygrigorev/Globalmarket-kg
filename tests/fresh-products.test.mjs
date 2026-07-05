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
  assert.match(appJs, /freshProducts\(limit = \d+\)\s*\{\s*const eligible = products\.filter/);
});

test("selection logic prefers real photos and caps per-category/brand concentration", () => {
  const match = appJs.match(/function freshProducts\(limit[\s\S]*?\n\}/);
  assert.ok(match, "freshProducts() body not found");
  const body = match[0];
  assert.match(body, /hasProductImage/, "must prefer products with real images");
  assert.match(body, /productBadges\(.*\)\.includes\("Новинка"\)/, "must prefer the Новинка badge");
  // Documented diversity cap: at most 2 per category and 2 per brand.
  assert.match(body, /maxPerCategory\s*=\s*2/);
  assert.match(body, /maxPerBrand\s*=\s*2/);
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

test("CSS hides category tiles on mobile while keeping the catalog directory and showing fresh products", () => {
  const mobileBlock = css.match(/@media \(max-width: 680px\) \{[\s\S]*/);
  assert.ok(mobileBlock, "mobile breakpoint not found");
  const mobile = mobileBlock[0];
  assert.match(mobile, /\.quick-category-grid\s*\{[^}]*display:\s*none/s, "category tiles must not take vertical space on mobile");
  assert.doesNotMatch(mobile, /\.catalog-directory\s*\{[^}]*display:\s*none/s, "the compact catalog directory breadcrumb must stay reachable");
  assert.match(mobile, /\.fresh-products(-heading|-row)?\s*\{/, "fresh-products mobile styling missing");
});

test("category access remains available through the header menu (unchanged by this task)", () => {
  // Guards against accidentally removing category access altogether when tiles
  // are hidden on mobile — the menu must still exist and still be openable.
  assert.match(html, /id="categoryMenu"/);
  assert.match(html, /id="toggleMenu"/);
  assert.match(appJs, /function renderCategoryMenu\(/);
});
