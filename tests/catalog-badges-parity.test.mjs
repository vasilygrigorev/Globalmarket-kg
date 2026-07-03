// Badge/discount rule parity across app.js, scripts/generate_product_pages.py,
// and scripts/generate_landing_pages.py — no network, no browser.
//
// The home page, "Похожие товары", and category/brand/collection landing
// grids each render a product tile from a DIFFERENT source file (one JS, two
// Python) because static pages can't share a JS module. That duplication is
// exactly what let the tiles drift apart before (this test file exists
// because of that bug). This locks the three copies of the badge/discount
// rules to the same literal conditions, so a future edit to only one copy
// fails here instead of silently drifting again.
// Run: node --test tests/catalog-badges-parity.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const appJs = read("app.js");
const productPagesPy = read("scripts/generate_product_pages.py");
const landingPagesPy = read("scripts/generate_landing_pages.py");

function block(source, re) {
  const m = source.match(re);
  return m ? m[0] : "";
}

// Strips a leading triple-quoted docstring so two copies of a function can be
// compared on logic alone — wording in the explanatory comment is allowed to
// differ between files, the executable rule must not.
function withoutDocstring(source) {
  return source.replace(/"""[\s\S]*?"""\n/, "");
}

const jsBadges = block(appJs, /function productBadges\(product\) \{[\s\S]*?\n\}/);
const pyBadges1 = block(productPagesPy, /def product_badges\(product\):[\s\S]*?\n    return badges\[:2\]/);
const pyBadges2 = block(landingPagesPy, /def product_badges\(product\):[\s\S]*?\n    return badges\[:2\]/);

test("productBadges()/product_badges() exist in all three renderers", () => {
  assert.ok(jsBadges, "app.js productBadges not found");
  assert.ok(pyBadges1, "generate_product_pages.py product_badges not found");
  assert.ok(pyBadges2, "generate_landing_pages.py product_badges not found");
});

test("the two Python product_badges() copies have identical logic", () => {
  // These two files intentionally duplicate small helpers (project
  // convention: each generator script is self-contained). Comparing the code
  // with docstrings stripped is the cheapest possible drift check for that
  // duplication — wording in the explanatory comment may differ, the rule
  // itself must not.
  assert.equal(
    withoutDocstring(pyBadges2),
    withoutDocstring(pyBadges1),
    "generate_landing_pages.py product_badges() logic diverged from generate_product_pages.py",
  );
});

test("all three copies agree on the Новинка/Хит/Выгодно conditions", () => {
  const rules = [
    /categoryId.*===.*perfume|categoryId"\)\s*==\s*"perfume/, // perfume -> Новинка
    /Concord/, // Concord brand -> Новинка
    /4\.8/, // rating threshold -> Хит
    /500/, // price ceiling -> Выгодно
    /Новинка/,
    /Хит/,
    /Выгодно/,
  ];
  for (const source of [jsBadges, pyBadges1, pyBadges2]) {
    for (const rule of rules) {
      assert.match(source, rule, `badge rule ${rule} missing from: ${source.slice(0, 60)}...`);
    }
  }
});

const jsDiscount = block(appJs, /function hasDiscount\(product\) \{[\s\S]*?\n\}/);
const pyDiscount1 = block(productPagesPy, /def has_discount\(product\):[\s\S]*?\n    return discount_percent > 0 and original > retail/);
const pyDiscount2 = block(landingPagesPy, /def has_discount\(product\):[\s\S]*?\n    return discount_percent > 0 and original > retail/);

test("hasDiscount()/has_discount() exist and agree across all three renderers", () => {
  assert.ok(jsDiscount, "app.js hasDiscount not found");
  assert.ok(pyDiscount1, "generate_product_pages.py has_discount not found");
  assert.ok(pyDiscount2, "generate_landing_pages.py has_discount not found");
  assert.equal(pyDiscount2, pyDiscount1, "generate_landing_pages.py has_discount() diverged from generate_product_pages.py");
  // All three require BOTH a positive percent AND originalPriceKgs strictly
  // greater than the current price — never a badge with a bogus/equal "was"
  // price.
  for (const source of [jsDiscount, pyDiscount1, pyDiscount2]) {
    assert.match(source, /discountPercent|discount_percent/i);
    assert.match(source, /originalPriceKgs|original/i);
  }
});

test("discount badge markup is the same '-XX%' shape in JS and Python", () => {
  assert.match(appJs, /discount-badge">-\$\{Math\.round\(product\.discountPercent\)\}%/);
  assert.match(productPagesPy, /discount-badge">-\{int\(product\["discountPercent"\]\)\}%/);
  assert.match(landingPagesPy, /discount-badge">-\{int\(product\["discountPercent"\]\)\}%/);
});
