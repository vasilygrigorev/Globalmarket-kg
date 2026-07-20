// Header / menu / category-strip contract — no network, no secrets.
// Keeps the storefront nav coherent: the dropdown menu, the quick-category strip,
// and the site-config menu all stay in sync, and product pages read the menu from
// data/site-config.json (no per-page hand-editing).
// Run: node --test tests/header-menu.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const config = JSON.parse(read("data/site-config.json"));
const appJs = read("app.js");
const header = read("partials/header.html");
const indexHtml = read("index.html");
const productGen = read("scripts/generate_product_pages.py");

// Menu items that point at a product section (have a target), excluding plain links.
const menuSections = (config.menu || []).filter((m) => m.category || m.audience || m.collection || m.query);

// Quick-category tiles from app.js.
const tileBlock = appJs.match(/let quickCategoryCards = \[([\s\S]*?)\];/)[1];
const tiles = tileBlock.split("\n").filter((l) => l.includes("{")).map((l) => ({
  title: (l.match(/title:\s*"([^"]+)"/) || [])[1],
  category: (l.match(/category:\s*"([^"]+)"/) || [])[1],
  audience: (l.match(/audience:\s*"([^"]+)"/) || [])[1],
  collection: (l.match(/collection:\s*"([^"]+)"/) || [])[1],
  query: (l.match(/query:\s*"([^"]+)"/) || [])[1],
}));

test("menu has 11 product sections, each with a target", () => {
  assert.equal(menuSections.length, 11);
  for (const m of menuSections) {
    assert.ok(m.label, "menu section missing label");
    assert.ok(m.category || m.audience || m.collection || m.query, `menu "${m.label}" has no target`);
  }
});

test("quick-category strip has 11 tiles, each with a target", () => {
  assert.equal(tiles.length, 11);
  for (const t of tiles) {
    assert.ok(t.title, "tile missing title");
    assert.ok(t.category || t.audience || t.collection || t.query, `tile "${t.title}" has no target`);
  }
});

test("menu and quick-category strip are in sync by name", () => {
  const menuNames = menuSections.map((m) => m.label).sort();
  const tileNames = tiles.map((t) => t.title).sort();
  assert.deepEqual(tileNames, menuNames, "menu sections and category tiles must match by name");
});

test("header markup can open a menu (toggle + nav present)", () => {
  assert.match(header, /id="toggleMenu"/);
  assert.match(header, /id="categoryMenu"/);
  assert.match(indexHtml, /id="quickCategoryGrid"/);
});

test("product pages read the menu from data/site-config.json (no per-page edits)", () => {
  assert.match(productGen, /\/data\/site-config\.json/);
  assert.match(productGen, /config\.menu/);
  assert.match(productGen, /#categoryMenu/);
});
