// Landing-page manifest structural contract — no network, no browser.
// seo-consistency.test.mjs checks each landing page's canonical/sitemap; this
// guards the manifest SHAPE so a malformed entry (bad type, misaligned path/url,
// duplicate slug, empty title/seoTerms) can't slip in and generate broken pages.
// Run: node --test tests/landing-pages.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const BASE = "https://globalmarket.kg";
const pages = JSON.parse(read("data/landing-pages.json")).pages || [];
const TYPE_DIR = { category: "category", collection: "collection", brand: "brand" };

const products = JSON.parse(read("data/public-catalog.json")).products || [];
const categoryIds = new Set(products.map((p) => p.categoryId).filter(Boolean));
const collections = new Set(products.flatMap((p) => p.collections || []));

test("landing manifest is a non-empty list", () => {
  assert.ok(pages.length >= 1, "expected landing pages");
});

test("each landing page has a known type and matching path prefix", () => {
  const bad = pages
    .filter((p) => {
      const dir = TYPE_DIR[p.type];
      return !dir || p.path.split("/")[1] !== dir;
    })
    .map((p) => `${p.slug}:${p.type}`);
  assert.deepEqual(bad, [], `bad type/path prefix: ${bad.slice(0, 8).join(", ")}`);
});

test("path ends with /<slug>/ and url is base + path", () => {
  const bad = [];
  for (const p of pages) {
    if (!p.path.endsWith(`/${p.slug}/`)) bad.push(`${p.slug}: path ${p.path}`);
    if (p.url !== BASE + p.path) bad.push(`${p.slug}: url`);
  }
  assert.deepEqual(bad, [], `path/url mismatches: ${bad.slice(0, 8).join(", ")}`);
});

test("slugs are unique", () => {
  const seen = new Map();
  for (const p of pages) seen.set(p.slug, (seen.get(p.slug) || 0) + 1);
  const dups = [...seen].filter(([, n]) => n > 1).map(([s]) => s);
  assert.deepEqual(dups, [], `duplicate slugs: ${dups.join(", ")}`);
});

test("each landing page has a title, a seoTerms array, and a non-negative count", () => {
  const bad = [];
  for (const p of pages) {
    if (!p.title || !String(p.title).trim()) bad.push(`${p.slug}: title`);
    if (!Array.isArray(p.seoTerms)) bad.push(`${p.slug}: seoTerms`); // may be empty, must be an array
    if (!Number.isInteger(p.count) || p.count < 0) bad.push(`${p.slug}: count`);
  }
  assert.deepEqual(bad, [], `field issues: ${bad.slice(0, 8).join(", ")}`);
});

test("category landing slugs resolve to real catalog categoryIds", () => {
  const bad = pages
    .filter((p) => p.type === "category")
    .filter((p) => !categoryIds.has(p.slug))
    .map((p) => p.slug);
  assert.deepEqual(bad, [], `category landing slugs not in catalog: ${bad.join(", ")}`);
});

test("collection landing slugs resolve to real catalog collections", () => {
  const bad = pages
    .filter((p) => p.type === "collection")
    .filter((p) => !collections.has(p.slug))
    .map((p) => p.slug);
  assert.deepEqual(bad, [], `collection landing slugs not in catalog: ${bad.join(", ")}`);
});

test("each landing page directory is generated on disk", () => {
  const bad = pages
    .filter((p) => !existsSync(join(ROOT, p.path.replace(/^\/+/, ""), "index.html")))
    .map((p) => p.path);
  assert.deepEqual(bad, [], `landing pages missing on disk: ${bad.slice(0, 8).join(", ")}`);
});
