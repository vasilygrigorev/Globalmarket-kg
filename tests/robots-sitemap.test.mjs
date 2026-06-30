// robots.txt + sitemap.xml structural contract — no network.
// Guards crawl directives and sitemap shape so SEO/indexing stays correct.
// Run: node --test tests/robots-sitemap.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const robots = read("robots.txt");
const sitemap = read("sitemap.xml");

test("robots.txt allows crawl, blocks /admin/, and points to the sitemap", () => {
  assert.match(robots, /User-agent:\s*\*/);
  assert.match(robots, /Allow:\s*\//);
  assert.match(robots, /Disallow:\s*\/admin\//);
  assert.match(robots, /Sitemap:\s*https:\/\/globalmarket\.kg\/sitemap\.xml/);
});

test("sitemap.xml is well-formed urlset with the image namespace", () => {
  assert.match(sitemap, /^<\?xml/);
  assert.match(sitemap, /<urlset[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.match(sitemap, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
});

test("sitemap includes homepage, catalog and privacy, with many URLs", () => {
  assert.match(sitemap, /<loc>https:\/\/globalmarket\.kg\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/globalmarket\.kg\/catalog\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/globalmarket\.kg\/privacy\.html<\/loc>/);
  const locs = (sitemap.match(/<loc>/g) || []).length;
  assert.ok(locs >= 100, `expected many sitemap URLs, found ${locs}`);
});
