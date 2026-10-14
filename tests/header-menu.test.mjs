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

// Purpose sections and protected brand shortcuts, excluding plain links.
const menuShortcuts = (config.menu || []).filter((m) => m.section || m.query);

// Quick-category tiles from app.js.
const tileBlock = appJs.match(/let quickCategoryCards = \[([\s\S]*?)\];/)[1];
const tiles = tileBlock.split("\n").filter((l) => l.includes("{")).map((l) => ({
  title: (l.match(/title:\s*"([^"]+)"/) || [])[1],
  section: (l.match(/section:\s*"([^"]+)"/) || [])[1],
  category: (l.match(/category:\s*"([^"]+)"/) || [])[1],
  audience: (l.match(/audience:\s*"([^"]+)"/) || [])[1],
  collection: (l.match(/collection:\s*"([^"]+)"/) || [])[1],
  query: (l.match(/query:\s*"([^"]+)"/) || [])[1],
  groupStart: /groupStart:\s*true/.test(l),
}));

test("menu has the 16 approved purpose and brand shortcuts", () => {
  assert.equal(menuShortcuts.length, 16);
  for (const m of menuShortcuts) {
    assert.ok(m.label, "menu section missing label");
    assert.ok(m.section || m.query, `menu "${m.label}" has no target`);
  }
});

test("quick-category strip has 16 tiles, each with a target", () => {
  assert.equal(tiles.length, 16);
  for (const t of tiles) {
    assert.ok(t.title, "tile missing title");
    assert.ok(t.section || t.query, `tile "${t.title}" has no target`);
  }
});

test("menu and quick-category strip are in sync by name", () => {
  const menuNames = menuShortcuts.map((m) => m.label).sort();
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
  assert.match(productGen, /if \(item\.section\) params\.set\("section", item\.section\)/);
  assert.match(productGen, /if \(item\.query\) params\.set\("query", item\.query\)/);
  assert.match(productGen, /item\.groupStart/);
});

test("purpose and brand groups have one break before Dalli / Dash", () => {
  const menuBreaks = menuShortcuts.filter((item) => item.groupStart);
  const tileBreaks = tiles.filter((item) => item.groupStart);
  assert.deepEqual(menuBreaks.map((item) => item.label), ["Dalli / Dash"]);
  assert.deepEqual(tileBreaks.map((item) => item.title), ["Dalli / Dash"]);
  assert.match(appJs, /category-menu-group-start/);
});

test("supplemental Детское and Европа links remain available without duplicating the primary rail", () => {
  const supplemental = new Map((config.menu || []).filter((item) => item.href).map((item) => [item.label, item.href]));
  assert.match(supplemental.get("Детское") || "", /audience=kids/);
  assert.equal(supplemental.get("Европа"), "/collection/europe/");
});
