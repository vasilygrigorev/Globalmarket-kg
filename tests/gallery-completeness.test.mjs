// Product gallery completeness contract — no network, no browser.
// Enforces the AGENTS.md photo contract at the catalog level so an incomplete
// gallery (card+front, missing back) or a drifted product.image can't ship
// silently. Complements product-consistency.test.mjs, which only validates the
// card/front/back ORDER once a product already has 3+ images.
// Run: node --test tests/gallery-completeness.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const products = JSON.parse(read("data/public-catalog.json")).products || [];
const isPerfume = (p) => p.categoryId === "perfume" || p.category === "Парфюм 5 мл";
const gallery = (p) => p.galleryImages || [];

// Same documented card+front-only exceptions as scripts/verify_product_galleries.py
// (single source of truth for the id list — see tests/photo-coverage.test.mjs for
// the cross-file id-sync check). Without this, a fixed/newly-applied 2-image
// override for a known exception fails here even though it is the intended,
// documented state.
const KNOWN_EXCEPTIONS = new Set(
  (read("scripts/verify_product_galleries.py").match(/prd_[0-9a-f]{12}/g) || [])
);

test("non-perfume products have either no gallery or a full card/front/back set", () => {
  // Length 1 or 2 means a photographed product is missing front and/or back —
  // exactly the silent-incomplete case the AGENTS contract forbids, unless it
  // is a documented exception.
  const bad = products
    .filter((p) => !isPerfume(p))
    .filter((p) => !KNOWN_EXCEPTIONS.has(p.id))
    .filter((p) => {
      const n = gallery(p).length;
      return n === 1 || n === 2;
    })
    .map((p) => `${p.id} (${gallery(p).length} img)`);
  assert.deepEqual(bad, [], `incomplete non-perfume galleries: ${bad.slice(0, 8).join(", ")}`);
});

test("perfume products carry exactly one card image", () => {
  const perfume = products.filter(isPerfume);
  assert.ok(perfume.length >= 1, "expected perfume products in catalog");
  const bad = perfume
    .filter((p) => {
      const g = gallery(p).length ? gallery(p) : (p.image ? [p.image] : []);
      return g.length !== 1 || !/card/i.test(g[0] || "");
    })
    .map((p) => p.id);
  assert.deepEqual(bad, [], `perfume not single card image: ${bad.join(", ")}`);
});

test("product.image matches the first gallery image (the card-front)", () => {
  const norm = (s) => String(s || "").replace(/^\/+/, "");
  const bad = products
    .filter((p) => gallery(p).length > 0)
    .filter((p) => norm(p.image) !== norm(gallery(p)[0]))
    .map((p) => p.id);
  assert.deepEqual(bad, [], `product.image != galleryImages[0]: ${bad.slice(0, 8).join(", ")}`);
});

test("multi-image galleries lead with the designed card image", () => {
  const bad = products
    .filter((p) => gallery(p).length >= 2)
    .filter((p) => !/card/i.test(gallery(p)[0] || ""))
    .map((p) => p.id);
  assert.deepEqual(bad, [], `gallery first image not a card: ${bad.slice(0, 8).join(", ")}`);
});
