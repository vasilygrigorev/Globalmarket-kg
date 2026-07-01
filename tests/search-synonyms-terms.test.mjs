// Search synonyms customer-language contract — no network, no browser.
// search-categories.test.mjs already checks that synonym TARGETS resolve to real
// catalog facets. This guards the opposite risk: that the known customer-language
// brainstorm terms stay present, so real shopper queries keep matching, and that
// each synonym group is structurally usable.
// Run: node --test tests/search-synonyms-terms.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const synonyms = JSON.parse(read("data/search-synonyms.json"));
const groups = synonyms.groups || [];

const allWords = new Set();
for (const g of groups) {
  for (const key of ["aliases", "terms"]) {
    for (const w of g[key] || []) allWords.add(String(w).toLowerCase());
  }
}

// Customer-language terms documented in the collaboration notes; these are the
// non-obvious shopper words the store deliberately maps.
const REQUIRED_TERMS = ["мыломойка", "дезик", "запаски", "кассеты", "посудомойка", "германия"];

test("synonyms include the documented customer-language brainstorm terms", () => {
  const missing = REQUIRED_TERMS.filter((t) => !allWords.has(t));
  assert.deepEqual(missing, [], `missing brainstorm terms: ${missing.join(", ")}`);
});

test("every synonym group is structurally usable", () => {
  assert.ok(groups.length > 0, "no synonym groups");
  const bad = [];
  for (const [i, g] of groups.entries()) {
    if (!g.id) bad.push(`group ${i}: missing id`);
    const hasWords = (g.aliases && g.aliases.length) || (g.terms && g.terms.length);
    if (!hasWords) bad.push(`${g.id || i}: no aliases/terms`);
  }
  assert.deepEqual(bad, [], `unusable synonym groups: ${bad.join(", ")}`);
});

test("no synonym list repeats a word within itself", () => {
  // aliases and terms may legitimately overlap; guard only against a word
  // repeated inside the same list.
  const bad = [];
  for (const g of groups) {
    for (const key of ["aliases", "terms"]) {
      const words = (g[key] || []).map((w) => String(w).toLowerCase());
      const seen = new Set();
      for (const w of words) {
        if (seen.has(w)) bad.push(`${g.id}.${key}: ${w}`);
        seen.add(w);
      }
    }
  }
  assert.deepEqual(bad, [], `duplicate words within a list: ${bad.slice(0, 8).join(", ")}`);
});
