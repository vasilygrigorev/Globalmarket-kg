// Whole-site integrity contract — no network, no browser.
// Catches orphan generated product pages (on disk but not in the manifest, so
// unlinked/unindexed), and guards the 404 page and homepage favicon references.
// Run: node --test tests/site-integrity.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const manifestSlugs = new Set((JSON.parse(read("data/product-pages.json")).pages || []).map((p) => p.slug));

function diskProductSlugs() {
  const dir = join(ROOT, "product");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    const idx = join(dir, name, "index.html");
    return existsSync(idx) && statSync(idx).isFile();
  });
}

test("every generated product page directory has a manifest entry (no orphans)", () => {
  const orphans = diskProductSlugs().filter((slug) => !manifestSlugs.has(slug));
  assert.deepEqual(orphans, [], `orphan product pages on disk: ${orphans.slice(0, 8).join(", ")}`);
});

test("every manifest product page exists on disk", () => {
  const disk = new Set(diskProductSlugs());
  const missing = [...manifestSlugs].filter((slug) => !disk.has(slug));
  assert.deepEqual(missing, [], `manifest pages missing on disk: ${missing.slice(0, 8).join(", ")}`);
});

test("404.html exists, is noindex, and has a title", () => {
  assert.ok(existsSync(join(ROOT, "404.html")), "404.html missing");
  const html = read("404.html");
  assert.match(html, /<meta name="robots" content="noindex/i);
  assert.match(html, /<title>[^<]+<\/title>/);
});

test("homepage favicon/apple-touch-icon files exist on disk", () => {
  const html = read("index.html");
  const refs = [...html.matchAll(/rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 1, "no favicon references found in index.html");
  const missing = refs
    .filter((href) => !/^https?:\/\//.test(href))
    .filter((href) => !existsSync(join(ROOT, href.replace(/^\/+/, ""))))
    .map((href) => href);
  assert.deepEqual(missing, [], `favicon files missing: ${missing.join(", ")}`);
});
