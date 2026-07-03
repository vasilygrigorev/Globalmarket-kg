// Manual promo-discount system contract — no network, no browser.
// data/discounts.json is the single, easy-to-edit source of truth for
// per-product discounts (see docs/discount-system.md); scripts/import_stock.py
// merges it into data/catalog.json (discountPercent + a derived, crossed-out
// originalPriceKgs), and scripts/build_public_catalog.py carries both fields
// into the public catalog. This locks that pipeline's math and wiring so a
// future edit can't silently break "add a discount to any product."
// Run: node --test tests/catalog-discount-system.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const discountsFile = JSON.parse(read("data/discounts.json"));
const products = JSON.parse(read("data/public-catalog.json")).products || [];
const byId = new Map(products.map((p) => [p.id, p]));

test("data/discounts.json has the expected shape", () => {
  assert.ok(discountsFile.discounts && typeof discountsFile.discounts === "object", "discounts.json must have a 'discounts' map");
  for (const [id, pct] of Object.entries(discountsFile.discounts)) {
    assert.match(id, /^prd_[a-z0-9]+$/i, `bad product id in discounts.json: ${id}`);
    assert.ok(Number.isInteger(pct) && pct > 0 && pct < 90, `discounts.json percent out of range for ${id}: ${pct}`);
  }
});

test("every id in data/discounts.json exists in the public catalog", () => {
  const missing = Object.keys(discountsFile.discounts).filter((id) => !byId.has(id));
  assert.deepEqual(missing, [], `discounts.json references products not in the catalog: ${missing.join(", ")}`);
});

test("every discounted product's originalPriceKgs is math-consistent with discountPercent", () => {
  const bad = [];
  for (const [id, pct] of Object.entries(discountsFile.discounts)) {
    const p = byId.get(id);
    if (!p) continue; // caught by the previous test
    const retail = Number(p.retailPriceKgs) || 0;
    const original = Number(p.originalPriceKgs) || 0;
    if (p.discountPercent !== pct) bad.push(`${id}: discountPercent ${p.discountPercent} != discounts.json ${pct}`);
    if (original <= retail) bad.push(`${id}: originalPriceKgs ${original} must be > retailPriceKgs ${retail}`);
    const expected = Math.round(retail / (1 - pct / 100));
    if (Math.abs(original - expected) > 1) bad.push(`${id}: originalPriceKgs ${original} != expected ~${expected}`);
  }
  assert.deepEqual(bad, [], `discount math inconsistencies: ${bad.join(", ")}`);
});

test("a product with no entry in discounts.json carries no discount fields", () => {
  const discountedIds = new Set(Object.keys(discountsFile.discounts));
  const bad = products
    .filter((p) => !discountedIds.has(p.id) && (p.discountPercent || p.originalPriceKgs))
    .map((p) => p.id);
  assert.deepEqual(bad, [], `products carry stale discount fields without a discounts.json entry: ${bad.slice(0, 5).join(", ")}`);
});

test("Persil Rose гель для стирки 3 л + 1 л carries the -20% promo discount", () => {
  const p = byId.get("prd_c5f3a1dce862");
  assert.ok(p, "product not found in catalog");
  assert.equal(p.discountPercent, 20);
  assert.ok(p.originalPriceKgs > p.retailPriceKgs);
});

test("import_stock.py loads data/discounts.json and applies it to both DB and manual products", () => {
  const src = read("scripts/import_stock.py");
  assert.match(src, /def load_discounts\(\):/);
  assert.match(src, /def apply_discount\(product, discounts\):/);
  // Both product-construction loops must run every product through
  // apply_discount() before appending it — not just the 1C/DB loop or just
  // the manual-products loop.
  const appendCalls = [...src.matchAll(/products\.append\(([^)]*)\)/g)].map((m) => m[1]);
  const applyCalls = appendCalls.filter((call) => call.includes("apply_discount"));
  assert.ok(applyCalls.length >= 2, `expected apply_discount() on both product loops, found ${applyCalls.length}`);
});

test("build_public_catalog.py carries discountPercent/originalPriceKgs to the public catalog", () => {
  const src = read("scripts/build_public_catalog.py");
  assert.match(src, /"discountPercent"/);
  assert.match(src, /"originalPriceKgs"/);
});
