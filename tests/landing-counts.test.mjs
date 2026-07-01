// Landing-page count consistency — no network, no browser.
// A landing page's `count` is the number of catalog products in that facet. This
// guards that category/collection landing counts stay in sync with the catalog
// (so a stale import can't leave "84 products" on a page that now has fewer), and
// that brand landing pages are non-empty.
// Run: node --test tests/landing-counts.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const products = JSON.parse(read("data/public-catalog.json")).products || [];
const pages = JSON.parse(read("data/landing-pages.json")).pages || [];

const countByCategoryId = new Map();
const countByCollection = new Map();
for (const p of products) {
  if (p.categoryId) countByCategoryId.set(p.categoryId, (countByCategoryId.get(p.categoryId) || 0) + 1);
  for (const c of p.collections || []) countByCollection.set(c, (countByCollection.get(c) || 0) + 1);
}

test("category landing counts equal the catalog count for that categoryId", () => {
  const bad = pages
    .filter((p) => p.type === "category")
    .filter((p) => p.count !== (countByCategoryId.get(p.slug) || 0))
    .map((p) => `${p.slug}: page=${p.count} catalog=${countByCategoryId.get(p.slug) || 0}`);
  assert.deepEqual(bad, [], `category count drift: ${bad.join(", ")}`);
});

test("collection landing counts equal the catalog count for that collection", () => {
  const bad = pages
    .filter((p) => p.type === "collection")
    .filter((p) => p.count !== (countByCollection.get(p.slug) || 0))
    .map((p) => `${p.slug}: page=${p.count} catalog=${countByCollection.get(p.slug) || 0}`);
  assert.deepEqual(bad, [], `collection count drift: ${bad.join(", ")}`);
});

test("brand landing pages are non-empty and count-consistent (shown <= count)", () => {
  const bad = pages
    .filter((p) => p.type === "brand")
    .filter((p) => !Number.isInteger(p.count) || p.count <= 0 || (Number.isInteger(p.shown) && p.shown > p.count))
    .map((p) => `${p.slug}: count=${p.count} shown=${p.shown}`);
  assert.deepEqual(bad, [], `brand count issues: ${bad.join(", ")}`);
});
