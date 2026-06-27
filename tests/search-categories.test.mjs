// Search + categories contract — no network, no browser.
// Verifies the search UI exists and toggles, search uses data/search-synonyms.json,
// synonyms target only real catalog categories/brands/collections, and the menu /
// quick-category tiles stay in sync and point at valid targets.
// Run: node --test tests/search-categories.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const indexHtml = read("index.html");
const appJs = read("app.js");
const synonyms = JSON.parse(read("data/search-synonyms.json"));
const config = JSON.parse(read("data/site-config.json"));
const products = JSON.parse(read("data/public-catalog.json")).products || [];

const cats = new Set(products.map((p) => p.category).filter(Boolean));
const cids = new Set(products.map((p) => p.categoryId).filter(Boolean));
const brands = new Set(products.map((p) => p.brand).filter(Boolean));
const colls = new Set(products.flatMap((p) => p.collections || []));

test("homepage has a search field and a search toggle", () => {
  assert.match(indexHtml, /id="toggleSearch"/);
  assert.ok(/class="header-search"/.test(indexHtml) || /id="search"/.test(indexHtml), "search field missing");
});

test("search opens and closes (aria-expanded toggled)", () => {
  assert.match(appJs, /toggleSearchButton(\?\.)?.?addEventListener\("click"/);
  assert.match(appJs, /toggleSearchButton\.setAttribute\("aria-expanded", String\(isOpen\)\)/);
  assert.match(appJs, /toggleSearchButton\.setAttribute\("aria-expanded", "false"\)/);
});

test("search uses data/search-synonyms.json", () => {
  assert.match(appJs, /loadSearchSynonyms/);
  assert.match(appJs, /fetch\("data\/search-synonyms\.json"/);
  assert.match(appJs, /searchSynonymGroups/);
});

test("synonyms target only real catalog categories/categoryIds/collections/brands", () => {
  const bad = [];
  for (const g of synonyms.groups || []) {
    for (const [key, set] of [["categories", cats], ["categoryIds", cids], ["collections", colls], ["brands", brands]]) {
      for (const v of g[key] || []) if (!set.has(v)) bad.push(`${g.id}.${key}=${v}`);
    }
  }
  assert.deepEqual(bad, [], `synonyms with broken targets: ${bad.join(", ")}`);
});

const menuSections = (config.menu || []).filter((m) => m.category || m.collection || m.query);
const tileBlock = appJs.match(/let quickCategoryCards = \[([\s\S]*?)\];/)[1];
const tiles = tileBlock.split("\n").filter((l) => l.includes("{")).map((l) => ({
  title: (l.match(/title:\s*"([^"]+)"/) || [])[1],
  category: (l.match(/category:\s*"([^"]+)"/) || [])[1],
  collection: (l.match(/collection:\s*"([^"]+)"/) || [])[1],
}));

test("menu and category tiles do not diverge by name", () => {
  assert.deepEqual(tiles.map((t) => t.title).sort(), menuSections.map((m) => m.label).sort());
});

test("menu/tile category & collection targets exist in the catalog", () => {
  const bad = [];
  for (const m of [...menuSections, ...tiles]) {
    if (m.category && !cats.has(m.category)) bad.push(`category:${m.category}`);
    if (m.collection && !colls.has(m.collection)) bad.push(`collection:${m.collection}`);
  }
  assert.deepEqual([...new Set(bad)], [], `nav targets not in catalog: ${[...new Set(bad)].join(", ")}`);
});
