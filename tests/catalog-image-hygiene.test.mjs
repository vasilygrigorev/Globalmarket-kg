// Catalog image hygiene contract — no network, no browser.
// The AGENTS photo contract forbids exposing temporary Telegram/contact-sheet/OCR
// or alt-* files in the public gallery. This locks the gallery filename shape:
// every gallery image ends with an approved suffix (-card-front / -front / -back,
// or a perfume card-front-vN), uses an allowed extension, and carries no
// temp/contact-sheet/OCR/dup markers.
// Run: node --test tests/catalog-image-hygiene.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const products = JSON.parse(read("data/public-catalog.json")).products || [];
const galleryNames = products.flatMap((p) => (p.galleryImages || []).map((u) => String(u).split("/").pop().toLowerCase()));

const ALLOWED_SUFFIX = /(?:-card-front|-front|-back|card-front-v\d+)\.(?:jpg|jpeg|png|webp)$/;
// Markers that indicate a raw/temporary/derived file that must not be published.
const FORBIDDEN_MARKER = /(?:alt-front|alt-back|contact[-_]?sheet|\bsheet\b|ocr|screenshot|\bdup\b|\bcopy\b|untitled|без-названия|\.heic)/i;

test("there are gallery images to check", () => {
  assert.ok(galleryNames.length > 0, "no gallery images found");
});

test("every gallery image ends with an approved card/front/back suffix", () => {
  const bad = [...new Set(galleryNames.filter((n) => !ALLOWED_SUFFIX.test(n)))];
  assert.deepEqual(bad, [], `gallery files with unexpected suffix: ${bad.slice(0, 10).join(", ")}`);
});

test("no gallery image exposes a temp/contact-sheet/OCR/dup filename", () => {
  const bad = [...new Set(galleryNames.filter((n) => FORBIDDEN_MARKER.test(n)))];
  assert.deepEqual(bad, [], `forbidden temp/derived files in gallery: ${bad.slice(0, 10).join(", ")}`);
});

test("gallery images use an allowed raster extension", () => {
  const bad = [...new Set(galleryNames.filter((n) => !/\.(?:jpg|jpeg|png|webp)$/.test(n)))];
  assert.deepEqual(bad, [], `gallery files with disallowed extension: ${bad.slice(0, 10).join(", ")}`);
});
