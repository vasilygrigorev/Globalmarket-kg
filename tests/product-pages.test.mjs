// Generated product pages — deploy-shape contract (no network).
// Complements scripts/validate_product_pages.py (which checks JSON-LD/SEO/header/
// actions) by covering the gaps: social meta, favicon/manifest/theme-color, the
// WhatsApp order + question actions, Product + BreadcrumbList JSON-LD, the shared
// menu source, and that product pages stay indexable.
// Run: node --test tests/product-pages.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCT_DIR = join(ROOT, "product");

function pages() {
  if (!existsSync(PRODUCT_DIR)) return [];
  return readdirSync(PRODUCT_DIR)
    .filter((slug) => existsSync(join(PRODUCT_DIR, slug, "index.html")))
    .map((slug) => ({ slug, html: readFileSync(join(PRODUCT_DIR, slug, "index.html"), "utf8") }));
}

const all = pages();

test("there are generated product pages to check", () => {
  assert.ok(all.length >= 50, `expected many product pages, found ${all.length}`);
});

test("every product page carries social meta (og + twitter)", () => {
  const bad = all.filter((p) => !/property="og:title"/.test(p.html) || !/name="twitter:card"/.test(p.html)).map((p) => p.slug);
  assert.deepEqual(bad, [], `pages missing og/twitter: ${bad.slice(0, 5).join(", ")}`);
});

test("every product page has favicon + manifest + theme-color", () => {
  const bad = all.filter((p) =>
    !/rel="icon"/.test(p.html) || !/rel="manifest"/.test(p.html) || !/name="theme-color"/.test(p.html)
  ).map((p) => p.slug);
  assert.deepEqual(bad, [], `pages missing favicon/manifest/theme-color: ${bad.slice(0, 5).join(", ")}`);
});

test("every product page has Product + BreadcrumbList JSON-LD", () => {
  const bad = all.filter((p) => (p.html.match(/application\/ld\+json/g) || []).length < 2).map((p) => p.slug);
  assert.deepEqual(bad, [], `pages with <2 JSON-LD blocks: ${bad.slice(0, 5).join(", ")}`);
});

test("every product page offers WhatsApp question; in-stock pages also offer order", () => {
  const noQuestion = all.filter((p) => !p.html.includes("Спросить в WhatsApp")).map((p) => p.slug);
  assert.deepEqual(noQuestion, [], `pages missing WhatsApp question: ${noQuestion.slice(0, 5).join(", ")}`);
  // In-stock pages (have add-to-cart) must also have the order link.
  const badOrder = all
    .filter((p) => p.html.includes("data-add-cart") && !p.html.includes("Заказать сразу в WhatsApp"))
    .map((p) => p.slug);
  assert.deepEqual(badOrder, [], `in-stock pages missing order link: ${badOrder.slice(0, 5).join(", ")}`);
});

test("every product page sources the shared menu and stays indexable", () => {
  const bad = all.filter((p) => !p.html.includes("/data/site-config.json")).map((p) => p.slug);
  assert.deepEqual(bad, [], `pages not using shared menu: ${bad.slice(0, 5).join(", ")}`);
  const noindex = all.filter((p) => /name="robots"[^>]*noindex/i.test(p.html)).map((p) => p.slug);
  assert.deepEqual(noindex, [], `product pages must be indexable (noindex found): ${noindex.slice(0, 5).join(", ")}`);
});
