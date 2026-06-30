// SEO consistency — no network.
// Product + landing pages must agree with their manifests and the sitemap on
// canonical / og:url / title, and every page URL must be in sitemap.xml.
// Run: node --test tests/seo-consistency.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const productPages = JSON.parse(read("data/product-pages.json")).pages || [];
const landingPages = JSON.parse(read("data/landing-pages.json")).pages || [];
const sitemap = read("sitemap.xml");
const sitemapLocs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

const fileFor = (p) => join(ROOT, p.path.replace(/^\/+/, "").replace(/\/$/, ""), "index.html");
const canonical = (html) => (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
const ogUrl = (html) => (html.match(/property="og:url" content="([^"]+)"/) || [])[1];
const title = (html) => (html.match(/<title>([^<]+)<\/title>/) || [])[1];

test("every product URL is in the sitemap", () => {
  const missing = productPages.filter((p) => !sitemapLocs.has(p.url)).map((p) => p.url);
  assert.deepEqual(missing, [], `product URLs missing from sitemap: ${missing.slice(0, 5).join(", ")}`);
});

test("every landing URL is in the sitemap", () => {
  const missing = landingPages.filter((p) => !sitemapLocs.has(p.url)).map((p) => p.url);
  assert.deepEqual(missing, [], `landing URLs missing from sitemap: ${missing.slice(0, 5).join(", ")}`);
});

test("product page canonical + og:url match the manifest URL, with a title", () => {
  const bad = [];
  for (const p of productPages) {
    const file = join(ROOT, "product", p.slug, "index.html");
    if (!existsSync(file)) { bad.push(`${p.slug}: missing`); continue; }
    const html = readFileSync(file, "utf8");
    if (canonical(html) !== p.url) bad.push(`${p.slug}: canonical`);
    if (ogUrl(html) !== p.url) bad.push(`${p.slug}: og:url`);
    if (!title(html)) bad.push(`${p.slug}: title`);
  }
  assert.deepEqual(bad, [], `product SEO mismatches: ${bad.slice(0, 6).join(", ")}`);
});

test("landing page canonical matches the manifest URL, with a title", () => {
  const bad = [];
  for (const p of landingPages) {
    const file = fileFor(p);
    if (!existsSync(file)) { bad.push(`${p.path}: missing`); continue; }
    const html = readFileSync(file, "utf8");
    if (canonical(html) !== p.url) bad.push(`${p.path}: canonical`);
    if (!title(html)) bad.push(`${p.path}: title`);
  }
  assert.deepEqual(bad, [], `landing SEO mismatches: ${bad.slice(0, 6).join(", ")}`);
});

test("product canonicals are unique (no duplicate URLs)", () => {
  const seen = new Map();
  for (const p of productPages) seen.set(p.url, (seen.get(p.url) || 0) + 1);
  const dups = [...seen].filter(([, n]) => n > 1).map(([u]) => u);
  assert.deepEqual(dups, [], `duplicate product URLs: ${dups.join(", ")}`);
});
