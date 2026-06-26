// Storefront layout / responsive contract — no network, no heavy browser.
// Asserts the structural order and the fixed-header offset so the mobile header
// can't overlap the banner, and that nav/cart/search controls exist.
// Run: node --test tests/storefront-layout.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const html = read("index.html");
const css = read("styles.css");
const appJs = read("app.js");

const at = (needle) => html.indexOf(needle);

test("section order: header → banner(hero) → category strip → product grid", () => {
  const header = at('class="site-header"') >= 0 ? at('class="site-header"') : at('id="toggleMenu"');
  const hero = at('class="hero"');
  const strip = at('id="quickCategoryGrid"');
  const grid = at('id="productGrid"');
  for (const [name, pos] of [["header", header], ["hero", hero], ["strip", strip], ["grid", grid]]) {
    assert.ok(pos >= 0, `missing ${name} in index.html`);
  }
  assert.ok(header < hero, "header must come before the banner");
  assert.ok(hero < strip, "category strip must be under the banner");
  assert.ok(strip < grid, "product grid must come after the category strip");
});

test("category strip section is present under the banner", () => {
  assert.match(html, /class="quick-categories"/);
  assert.ok(at('class="quick-categories"') > at('class="hero"'));
});

test("fixed header + body offset prevents header overlapping the banner", () => {
  // Header is fixed; body is padded by the header height so content isn't hidden.
  assert.match(css, /\.site-header\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /body\s*\{[^}]*padding-top:\s*var\(--site-header-height/s);
  // A mobile breakpoint re-tunes the header.
  assert.match(css, /@media[^{]*max-width[^{]*\{[\s\S]*\.site-header/);
});

test("menu opens and closes", () => {
  assert.match(appJs, /function setMenuOpen\(isOpen\)/);
  assert.match(appJs, /categoryMenu\.hidden = !isOpen/);
  assert.match(appJs, /toggleMenuButton\?\.addEventListener\("click"/);
  assert.match(appJs, /setMenuOpen\(false\)/); // a close path exists
});

test("cart and search controls stay available in the header", () => {
  assert.match(html, /id="openCart"/);
  assert.ok(/id="toggleSearch"/.test(html) || /class="header-search"/.test(html), "search control missing");
});
