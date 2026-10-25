// Append-only URL contract for product and landing pages.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(ROOT, relativePath), "utf8");
const json = (relativePath) => JSON.parse(read(relativePath));

function redirectRows() {
  return read("_redirects")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .map(([source, target, status = "302"]) => ({ source, target, status }));
}

test("every product URL alias is one permanent redirect to a current page", () => {
  const aliases = json("data/product-url-aliases.json").aliases || [];
  const currentPaths = new Set((json("data/product-pages.json").pages || []).map((page) => page.path));
  const redirects = redirectRows();
  const redirectMap = new Map();
  for (const row of redirects) {
    if (!redirectMap.has(row.source)) redirectMap.set(row.source, []);
    redirectMap.get(row.source).push(row);
  }

  const errors = [];
  for (const alias of aliases) {
    const rows = redirectMap.get(alias.from) || [];
    if (rows.length !== 1) errors.push(`${alias.from}: redirects=${rows.length}`);
    else if (rows[0].target !== alias.to || rows[0].status !== "301") {
      errors.push(`${alias.from}: ${rows[0].target} ${rows[0].status}`);
    }
    if (currentPaths.has(alias.from)) errors.push(`${alias.from}: shadows current page`);
    if (!currentPaths.has(alias.to)) errors.push(`${alias.from}: missing target ${alias.to}`);
  }
  assert.deepEqual(errors, [], errors.slice(0, 12).join("\n"));
});

test("known Search Console 404 product URLs stay protected", () => {
  const aliases = new Map((json("data/product-url-aliases.json").aliases || []).map((row) => [row.from, row.to]));
  const expected = [
    "/product/dove-oil-therapy-shampun-600-ml-58bb16/",
    "/product/dove-moisture-shampun-600-ml-5c5726/",
    "/product/rexona-men-football-fanatics-sprey-dezodorant-200-ml-ce23a5/",
    "/product/rexona-men-antibacterial-sprey-dezodorant-200-ml-e23d8f/",
    "/product/felce-azzurra-deo-spray-150ml-fresco-c_3097/",
    "/product/felce-azzurra-deo-spray-150ml-original-c_3096/",
    "/product/felce-azzurra-deo-spray-150ml-invisible-c_3098/",
    "/product/felce-azzurra-men-s-deo-spray-150ml-cool-blue-c_3103/",
    "/product/felce-azzurra-men-s-deo-spray-150ml-power-fresh-c_3104/",
    "/product/jif-lemon-chistyashchiy-krem-500-ml-118ed3/",
  ];
  assert.deepEqual(expected.filter((path) => !aliases.has(path)), []);
});

test("landing registry survives zero stock and is fully generated", () => {
  const registry = json("data/landing-page-registry.json").pages || [];
  const manifest = json("data/landing-pages.json").pages || [];
  const generated = new Set(manifest.map((page) => `${page.type}:${page.slug}`));
  const missing = registry
    .map((page) => `${page.type}:${page.slug}`)
    .filter((key) => !generated.has(key));
  assert.deepEqual(missing, []);

  const requiredBrands = ["sunsilk", "l-oreal-men-expert", "cussons-creations", "degree", "vatika"];
  const brands = new Set(registry.filter((page) => page.type === "brand").map((page) => page.slug));
  assert.deepEqual(requiredBrands.filter((slug) => !brands.has(slug)), []);
});

test("visible email links opt out of Cloudflare email obfuscation", () => {
  for (const relativePath of ["privacy.html", "delivery-and-returns/index.html", "opt/index.html"]) {
    const source = read(relativePath);
    const mailto = source.indexOf('href="mailto:');
    assert.ok(mailto >= 0, `${relativePath}: mailto missing`);
    const begin = source.lastIndexOf("<!--email_off-->", mailto);
    const end = source.indexOf("<!--/email_off-->", mailto);
    assert.ok(begin >= 0 && end > mailto, `${relativePath}: email_off wrapper missing`);
    assert.doesNotMatch(source, /\/cdn-cgi\/l\/email-protection/);
  }
});
