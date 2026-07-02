// Storefront accessibility / SEO contract — no network, no browser.
// Reads app.js and the generated product pages as text to keep the a11y + SEO
// affordances from silently regressing: card images carry alt text and lazy
// loading, interactive controls have aria labels, and every product page
// declares its language and gives every image alt text.
// Run: node --test tests/storefront-a11y.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const appJs = read("app.js");

function block(re) {
  const m = appJs.match(re);
  return m ? m[0] : "";
}
const renderProducts = block(/function renderProducts\(\)[\s\S]*?\n}/);

test("product card image has alt text and lazy loading", () => {
  assert.ok(renderProducts, "renderProducts not found");
  assert.match(renderProducts, /<img[^>]*alt="\$\{escapeHtml\(product\.title\)\}"/);
  assert.match(renderProducts, /<img[^>]*loading="lazy"/);
});

test("interactive card controls carry aria labels", () => {
  assert.match(renderProducts, /favorite-button[\s\S]*?aria-label=/);   // favorite
  assert.match(renderProducts, /favorite-button[\s\S]*?aria-pressed=/); // favorite state
  assert.match(renderProducts, /product-image-link[\s\S]*?aria-label=/); // open product
  assert.match(renderProducts, /add-button[\s\S]*?aria-label="Добавить в корзину"/); // add to cart
});

const productDirs = existsSync(join(ROOT, "product"))
  ? readdirSync(join(ROOT, "product")).filter((d) => existsSync(join(ROOT, "product", d, "index.html")))
  : [];

test("every product page declares lang=ru", () => {
  const bad = productDirs
    .filter((d) => !/<html[^>]*lang="ru"/i.test(read(join("product", d, "index.html"))))
    .slice(0, 8);
  assert.deepEqual(bad, [], `product pages missing lang=ru: ${bad.join(", ")}`);
});

test("every image on every product page has an alt attribute", () => {
  const bad = [];
  for (const d of productDirs) {
    const html = read(join("product", d, "index.html"));
    for (const img of html.match(/<img\b[^>]*>/gi) || []) {
      if (!/\balt=/.test(img)) { bad.push(d); break; }
    }
  }
  assert.deepEqual(bad, [], `product pages with an image missing alt: ${bad.slice(0, 8).join(", ")}`);
});
