// Search relevance/ranking contract — no network, no browser.
// scripts/validate_search_synonyms.py mirrors this scoring logic in Python and
// runs the real "first result has the expected productKind/brand" checks
// against the live catalog (see RANKING_EXPECTATIONS there, and
// `python3 scripts/validate_search_synonyms.py`). This file guards the JS side
// stays wired up: the scoring functions exist and getVisibleProducts() actually
// uses them, and the synonyms data has the productKind/brand hints the scorer
// depends on for the reported bug class (a broad word like "spray"/"стик"
// leading to the wrong category first).
// Run: node --test tests/search-quality.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const appJs = read("app.js");
const synonyms = readJson("data/search-synonyms.json");
const groups = synonyms.groups || [];
const groupById = new Map(groups.map((g) => [g.id, g]));

test("app.js implements query-relevance scoring, not just boolean matching", () => {
  for (const fn of [
    "function resolveBrandFromQuery",
    "function resolveExpectedKinds",
    "function buildSearchContext",
    "function searchRelevanceScore",
    "function compareBySearchRelevance",
  ]) {
    assert.match(appJs, new RegExp(fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${fn}`);
  }
});

test("getVisibleProducts sorts by search relevance when there is a query", () => {
  const fnMatch = appJs.match(/function getVisibleProducts\(\)[\s\S]*?\n}\n/);
  assert.ok(fnMatch, "getVisibleProducts not found");
  assert.match(fnMatch[0], /compareBySearchRelevance/, "getVisibleProducts must rank by search relevance, not just featured order");
});

test("app.js loads brandAliases from the synonyms config", () => {
  assert.match(appJs, /searchBrandAliases/);
  assert.match(appJs, /config\.brandAliases/);
});

test("brandAliases covers the required Cyrillic/Latin brand variants", () => {
  const brandAliases = synonyms.brandAliases || {};
  const flat = Object.entries(brandAliases).flatMap(([brand, aliases]) => [brand, ...(aliases || [])]).map((v) => v.toLowerCase());
  for (const required of ["ariel", "ариель", "ариэл", "clear", "клир"]) {
    assert.ok(flat.includes(required), `brandAliases missing required variant: ${required}`);
  }
});

test("category-scoped synonym groups declare productKinds so ranking can prioritize the specific kind", () => {
  const mustHaveKind = [
    "hair-shampoo",
    "shaving-refills",
    "shaving-razors",
    "shaving-foam",
    "shaving-gel",
    "oral-toothpaste",
    "oral-toothbrush",
    "sunscreen",
    "body-showergel",
    "laundry-capsules",
    "laundry-powder",
    "laundry-gel",
    "dishwashing",
    "deodorants",
  ];
  const missing = mustHaveKind.filter((id) => !(groupById.get(id)?.productKinds || []).length);
  assert.deepEqual(missing, [], `groups missing productKinds: ${missing.join(", ")}`);
});

test("regression guard: deodorants group no longer carries an unscoped generic form word (the sunscreen leak)", () => {
  const deodorants = groupById.get("deodorants");
  assert.ok(deodorants, "deodorants group missing");
  const terms = (deodorants.terms || []).map((t) => t.toLowerCase());
  for (const leaky of ["spray", "стик", "део", "deo", "axe"]) {
    assert.ok(!terms.includes(leaky), `deodorants.terms still contains unscoped word "${leaky}" (matches ANY product, not just deodorants)`);
  }
  // "стик" must still resolve to deodorant_stick specifically via aliasKinds.
  assert.deepEqual(deodorants.aliasKinds?.["стик"], ["deodorant_stick"]);
});
