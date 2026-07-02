// Catalog field validity contract — no network, no browser.
// Guards the per-product fields the storefront relies on for sorting, search,
// card rendering, and badges, so a future import can't ship products that break
// filtering/search or render blank cards.
// Run: node --test tests/catalog-fields.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const products = JSON.parse(read("data/public-catalog.json")).products || [];
const ALLOWED_STATUS = new Set(["active", "review"]);

test("every product status is a known value (active/review)", () => {
  // app.js sorts active-first on `status === "active"`; an unknown status would
  // silently mis-sort the grid.
  const bad = products
    .filter((p) => !ALLOWED_STATUS.has(String(p.status)))
    .map((p) => `${p.id}:${p.status}`);
  assert.deepEqual(bad, [], `unknown statuses: ${bad.slice(0, 8).join(", ")}`);
});

test("searchText, description, and brand are non-empty", () => {
  const bad = [];
  for (const p of products) {
    if (!String(p.searchText || "").trim()) bad.push(`${p.id}: searchText`);
    if (!String(p.description || "").trim()) bad.push(`${p.id}: description`);
    if (!String(p.brand || "").trim()) bad.push(`${p.id}: brand`);
  }
  assert.deepEqual(bad, [], `empty fields: ${bad.slice(0, 8).join(", ")}`);
});

test("searchText is findable by brand, product name, and category", () => {
  // The storefront search matches against searchText; if a future import drops
  // the brand/title/category from it, that facet silently stops matching.
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const bad = [];
  for (const p of products) {
    const st = norm(p.searchText);
    const brand = norm(p.brand);
    const category = norm(p.category);
    const titleWords = norm(p.title).split(" ").filter((w) => w.length > 2).slice(0, 2);
    if (brand && !st.includes(brand)) bad.push(`${p.id}: brand`);
    if (category && !st.includes(category)) bad.push(`${p.id}: category`);
    if (titleWords.length && !titleWords.every((w) => st.includes(w))) bad.push(`${p.id}: title`);
  }
  assert.deepEqual(bad, [], `searchText not findable: ${bad.slice(0, 8).join(", ")}`);
});

test("rating is a finite number within 0..5", () => {
  const bad = products
    .filter((p) => {
      const r = Number(p.rating);
      return !Number.isFinite(r) || r < 0 || r > 5;
    })
    .map((p) => `${p.id}:${p.rating}`);
  assert.deepEqual(bad, [], `bad ratings: ${bad.slice(0, 8).join(", ")}`);
});

test("units are non-empty and perfume is sold in ml", () => {
  const bad = [];
  for (const p of products) {
    const unit = String(p.unit || "").trim();
    if (!unit) { bad.push(`${p.id}: empty unit`); continue; }
    if (p.categoryId === "perfume" && !/мл/i.test(unit)) bad.push(`${p.id}: perfume unit ${unit}`);
  }
  assert.deepEqual(bad, [], `unit issues: ${bad.slice(0, 8).join(", ")}`);
});
