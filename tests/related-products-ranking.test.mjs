// "Похожие товары" ranking contract — no network, no browser.
// classify_taxonomy_test.py already unit-tests related_rank_key() on synthetic
// products. This test exercises the REAL wiring end-to-end: for generated
// product pages whose source product has a productKind and real same-kind
// candidates exist, the first related-product-card in the actual generated
// HTML must be the same productKind (not just "same category").
// Run: node --test tests/related-products-ranking.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const catalog = readJson("data/public-catalog.json");
const products = catalog.products || [];
const byId = new Map(products.map((p) => [p.id, p]));

const manifest = readJson("data/product-pages.json");
const pages = manifest.pages || [];
const pageById = new Map(pages.map((p) => [p.id, p]));

function firstRelatedProductId(pagePath) {
  const filePath = join(ROOT, pagePath.replace(/^\//, ""), "index.html");
  if (!existsSync(filePath)) return null;
  const html = readFileSync(filePath, "utf8");
  const relatedSection = html.match(/<div class="related-grid">([\s\S]*?)<\/div>\s*<\/section>/);
  if (!relatedSection) return null;
  const match = relatedSection[1].match(/data-favorite="([^"]+)"/);
  return match ? match[1] : null;
}

test("productKind field is present on a meaningful share of the catalog", () => {
  const withKind = products.filter((p) => p.productKind).length;
  assert.ok(withKind > products.length * 0.3, `expected >30% productKind coverage, got ${withKind}/${products.length}`);
});

test("every catalog product carries the derived taxonomy fields (additive, not just some)", () => {
  const missingFields = products.filter(
    (p) => !("productKind" in p) || !("audience" in p) || !("form" in p) || !("useArea" in p) || !("searchTerms" in p),
  );
  assert.deepEqual(missingFields.length, 0, `${missingFields.length} products are missing a taxonomy field`);
});

test("first related-product card matches the source product's productKind when same-kind candidates exist", () => {
  const kindCounts = new Map();
  for (const p of products) {
    if (!p.productKind) continue;
    kindCounts.set(p.productKind, (kindCounts.get(p.productKind) || 0) + 1);
  }

  const samples = products.filter((p) => p.productKind && kindCounts.get(p.productKind) >= 3 && pageById.has(p.id)).slice(0, 40);

  assert.ok(samples.length > 5, "not enough sample products with same-kind siblings to check");

  const mismatches = [];
  for (const product of samples) {
    const page = pageById.get(product.id);
    const firstId = firstRelatedProductId(page.path);
    if (!firstId) continue;
    const firstRelated = byId.get(firstId);
    if (!firstRelated) continue;
    if (firstRelated.productKind !== product.productKind) {
      mismatches.push(`${product.title} (${product.productKind}) -> first related is ${firstRelated.title} (${firstRelated.productKind})`);
    }
  }

  assert.deepEqual(mismatches, [], `related-card kind mismatches:\n${mismatches.join("\n")}`);
});
