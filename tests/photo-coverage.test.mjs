// Photo coverage + exceptions-registry contract — no network, no browser.
// Guards the photo-coverage assumptions and keeps the "card+front only" exception
// list identical across the three places that record it, so a Petya import can't
// leave the registry, the gallery verifier, and the docs out of sync.
// Run: node --test tests/photo-coverage.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const products = JSON.parse(read("data/public-catalog.json")).products || [];
const hasRealPhoto = (p) =>
  String(p.image || "").startsWith("assets/products/") ||
  (p.galleryImages || []).some((s) => String(s).startsWith("assets/products/"));

const idsIn = (text) => new Set((text.match(/prd_[0-9a-f]{12}/g) || []));
const exceptionIdsFrom = (rel) => {
  // Only the exception ids: they appear in a KNOWN_EXCEPTIONS block / exception list.
  return idsIn(read(rel));
};

test("catalog has photographed products and coverage math is sane", () => {
  const total = products.length;
  const withPhotos = products.filter(hasRealPhoto).length;
  assert.ok(total > 0, "no products");
  assert.ok(withPhotos > 0, "no photographed products");
  const pct = (100 * withPhotos) / total;
  assert.ok(pct > 0 && pct <= 100, `coverage % out of range: ${pct}`);
});

test("every photographed product has a valid gallery (perfume=1, others=3 or a known exception)", () => {
  const gallerySrc = read("scripts/verify_product_galleries.py");
  const exceptions = idsIn(gallerySrc);
  const bad = [];
  for (const p of products) {
    if (!hasRealPhoto(p)) continue;
    const g = p.galleryImages || [];
    if (p.categoryId === "perfume") {
      if (g.length !== 1) bad.push(`${p.id}: perfume ${g.length} imgs`);
    } else if (g.length !== 3 && !exceptions.has(p.id)) {
      bad.push(`${p.id}: ${g.length} imgs`);
    }
  }
  assert.deepEqual(bad, [], `invalid photographed galleries: ${bad.slice(0, 8).join(", ")}`);
});

test("the card+front-only exception list is identical across verifier, rules doc, and AGENTS", () => {
  const verifier = exceptionIdsFrom("scripts/verify_product_galleries.py");
  const rules = exceptionIdsFrom("docs/product-photo-rules.md");
  const agents = exceptionIdsFrom("AGENTS.md");
  const report = exceptionIdsFrom("scripts/report_photo_coverage.py");
  const sorted = (s) => [...s].sort();
  assert.deepEqual(sorted(rules), sorted(verifier), "rules doc vs verifier exception ids differ");
  assert.deepEqual(sorted(agents), sorted(verifier), "AGENTS vs verifier exception ids differ");
  assert.deepEqual(sorted(report), sorted(verifier), "report script vs verifier exception ids differ");
  assert.ok(verifier.size >= 1, "expected at least one documented exception");
});

test("every documented exception id exists in the catalog", () => {
  const ids = new Set(products.map((p) => p.id));
  const exceptions = exceptionIdsFrom("scripts/verify_product_galleries.py");
  const missing = [...exceptions].filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `exception ids not in catalog: ${missing.join(", ")}`);
});
