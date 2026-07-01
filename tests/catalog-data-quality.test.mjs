// Catalog data quality contract — no network, no browser.
// Guards core product-data invariants so a future Petya photo import or 1C stock
// refresh can't silently ship broken products: stable unique ids, real titles,
// sane prices, on-disk images, consistent taxonomy, and perfume wording.
// Run: node --test tests/catalog-data-quality.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const products = JSON.parse(read("data/public-catalog.json")).products || [];
const num = (x) => (typeof x === "number" ? x : Number(x));
const imgRefs = (p) => [p.image, ...(p.galleryImages || [])].filter(Boolean);

test("catalog is non-empty", () => {
  assert.ok(products.length > 0, "no products in public-catalog.json");
});

test("product ids are present, prd_-prefixed, and unique", () => {
  const seen = new Map();
  const badShape = [];
  for (const p of products) {
    const id = p.id;
    if (!id || !/^prd_[a-z0-9_]+$/i.test(String(id))) badShape.push(String(id));
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  const dups = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepEqual(badShape, [], `ids with bad shape: ${badShape.slice(0, 8).join(", ")}`);
  assert.deepEqual(dups, [], `duplicate ids: ${dups.slice(0, 8).join(", ")}`);
});

test("titles are non-empty and not placeholders", () => {
  const placeholder = /(?:placeholder|lorem|заглушка|\btbd\b|\bxxx\b|untitled|без названия)/i;
  const bad = products
    .filter((p) => !String(p.title || "").trim() || placeholder.test(String(p.title)))
    .map((p) => `${p.id}:${p.title || ""}`);
  assert.deepEqual(bad, [], `bad titles: ${bad.slice(0, 8).join(", ")}`);
});

test("retail prices are positive, finite, and within a sane range", () => {
  const bad = products
    .filter((p) => {
      const v = num(p.retailPriceKgs);
      return !Number.isFinite(v) || v <= 0 || v > 100000;
    })
    .map((p) => `${p.id}:${p.retailPriceKgs}`);
  assert.deepEqual(bad, [], `bad retail prices: ${bad.slice(0, 8).join(", ")}`);
});

test("registered prices are positive and never above retail", () => {
  const bad = products
    .filter((p) => {
      const reg = num(p.registeredPriceKgs);
      const retail = num(p.retailPriceKgs);
      if (!Number.isFinite(reg) || reg <= 0) return true;
      if (Number.isFinite(retail) && reg > retail) return true;
      return false;
    })
    .map((p) => `${p.id}:${p.registeredPriceKgs}/${p.retailPriceKgs}`);
  assert.deepEqual(bad, [], `bad registered prices: ${bad.slice(0, 8).join(", ")}`);
});

test("every referenced product image exists on disk", () => {
  const missing = [];
  for (const p of products) {
    for (const u of imgRefs(p)) {
      if (/^https?:\/\//.test(u)) continue;
      if (!existsSync(join(ROOT, String(u).replace(/^\/+/, "")))) missing.push(`${p.id}:${u}`);
    }
  }
  assert.deepEqual(missing, [], `missing image files: ${missing.slice(0, 8).join(", ")}`);
});

test("categoryId and category label form a consistent 1:1 mapping", () => {
  const idToLabel = new Map();
  const labelToId = new Map();
  const bad = [];
  for (const p of products) {
    const cid = p.categoryId;
    const label = p.category;
    if (!cid || !label) { bad.push(`${p.id}: missing categoryId/category`); continue; }
    if (idToLabel.has(cid) && idToLabel.get(cid) !== label) bad.push(`${cid} -> ${idToLabel.get(cid)} & ${label}`);
    if (labelToId.has(label) && labelToId.get(label) !== cid) bad.push(`${label} <- ${labelToId.get(label)} & ${cid}`);
    idToLabel.set(cid, label);
    labelToId.set(label, cid);
  }
  assert.deepEqual([...new Set(bad)], [], `taxonomy inconsistencies: ${[...new Set(bad)].slice(0, 8).join(", ")}`);
});

test("perfume products carry 5 ml wording in the title", () => {
  const perfume = products.filter((p) => p.categoryId === "perfume");
  assert.ok(perfume.length >= 1, "expected perfume products");
  const bad = perfume.filter((p) => !/5\s*мл/i.test(String(p.title || ""))).map((p) => `${p.id}:${p.title}`);
  assert.deepEqual(bad, [], `perfume missing 5 ml wording: ${bad.join(", ")}`);
});
