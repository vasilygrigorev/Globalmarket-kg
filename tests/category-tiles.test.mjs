// Category tiles QA — no network, no secrets.
// Validates the storefront quick-category tiles in app.js against real assets and
// catalog categories, so a redesign can't ship broken tile images or dead targets.
// Run: node --test tests/category-tiles.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const appJs = read("app.js");
const indexHtml = read("index.html");

// Extract the quickCategoryCards = [ ... ] block and parse one tile per line.
function parseTiles() {
  const block = appJs.match(/let quickCategoryCards = \[([\s\S]*?)\];/);
  assert.ok(block, "quickCategoryCards array not found in app.js");
  const tiles = [];
  for (const line of block[1].split("\n")) {
    if (!line.includes("{")) continue;
    const grab = (k) => (line.match(new RegExp(`${k}:\\s*"([^"]+)"`)) || [])[1];
    tiles.push({
      title: grab("title"),
      image: grab("image"),
      section: grab("section"),
      category: grab("category"),
      audience: grab("audience"),
      collection: grab("collection"),
      query: grab("query"),
    });
  }
  return tiles;
}

const tiles = parseTiles();
const catalog = JSON.parse(read("data/public-catalog.json"));
const products = catalog.products || [];
const categories = new Set((catalog.products || []).map((p) => p.category).filter(Boolean));

test("there are 10 approved primary category tiles", () => {
  assert.equal(tiles.length, 10);
});

test("every tile has a title and at least one target", () => {
  for (const t of tiles) {
    assert.ok(t.title, `tile missing title: ${JSON.stringify(t)}`);
    assert.ok(t.section || t.category || t.audience || t.collection || t.query, `tile "${t.title}" has no target`);
  }
});

test("every tile image exists on disk", () => {
  const missing = tiles
    .filter((t) => !t.image || !existsSync(join(ROOT, t.image.split("?")[0])))
    .map((t) => t.title);
  assert.deepEqual(missing, [], `tiles with missing images: ${missing.join(", ")}`);
});

test("every tile category is a real catalog category", () => {
  const bad = tiles.filter((t) => t.category && !categories.has(t.category)).map((t) => `${t.title}→${t.category}`);
  assert.deepEqual(bad, [], `tiles pointing at unknown categories: ${bad.join(", ")}`);
});

test("home page cache-busts the current category assets", () => {
  assert.match(indexHtml, /styles\.css\?v=20261011-retail-recovery-v1/);
  assert.match(indexHtml, /home-category-rail-v4\.css\?v=20261011-retail-recovery-v1/);
  assert.match(indexHtml, /app\.js\?v=20261011-retail-recovery-v1/);
  assert.ok(tiles.every((tile) => tile.image.endsWith("?v=20261011-retail-recovery-v1")));
  assert.match(appJs, /if \(event\.persisted\) window\.location\.reload\(\)/);
});

test("primary tiles use the approved storefront section order", () => {
  assert.deepEqual(
    tiles.map((tile) => [tile.title, tile.section]),
    [
      ["Стирка", "laundry"], ["Кухня", "kitchen"], ["Ванная", "bathroom"],
      ["Тело", "body"], ["Кремы", "creams"], ["Бритьё", "shaving"],
      ["Зубы", "oral"], ["Волосы", "hair"], ["Парфюм", "perfume"],
      ["Дом и уют", "home"],
    ],
  );
  for (const tile of tiles) {
    assert.ok(products.some((product) => (product.sectionIds || []).includes(tile.section)), `${tile.title}: empty section`);
  }
});
