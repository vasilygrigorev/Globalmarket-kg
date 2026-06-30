// Homepage SEO contract — no network.
// The homepage must keep its canonical, meta description, social meta, PWA bits,
// and Organization + WebSite/SearchAction JSON-LD.
// Run: node --test tests/home-seo.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

test("homepage has canonical + meta description", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/globalmarket\.kg\/"/);
  assert.match(html, /name="description"/);
});

test("homepage has social meta (og + twitter)", () => {
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /name="twitter:card"/);
});

test("homepage has PWA bits (favicon + manifest + theme-color)", () => {
  assert.match(html, /rel="icon"/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /name="theme-color"/);
});

test("homepage has Organization + WebSite JSON-LD", () => {
  assert.match(html, /"@type":\s*"Organization"/);
  assert.match(html, /"@type":\s*"WebSite"/);
  assert.match(html, /"@type":\s*"SearchAction"/);
});
