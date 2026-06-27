// Banner carousel contract — no network, no browser.
// Verifies editable banners from data/site-config.json use real assets, point
// to live catalog results, and keep homepage carousel controls wired.
// Run: node --test tests/banner-carousel.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const indexHtml = read("index.html");
const appJs = read("app.js");
const config = JSON.parse(read("data/site-config.json"));
const products = JSON.parse(read("data/public-catalog.json")).products || [];
const activeBanners = (config.banners || []).filter((banner) => banner.active !== false);

function lower(value) {
  return String(value || "").toLowerCase();
}

function repoPath(urlPath) {
  return String(urlPath || "").replace(/^\/+/, "");
}

function paramsFromHref(href) {
  const value = String(href || "");
  const question = value.indexOf("?");
  if (question < 0) return new URLSearchParams();
  const hash = value.indexOf("#", question);
  return new URLSearchParams(value.slice(question + 1, hash >= 0 ? hash : undefined));
}

function productSearchText(product) {
  return lower([
    product.title,
    product.name,
    product.brand,
    product.category,
    product.productType,
    product.description,
    product.shortDescription,
    product.searchText,
  ].join(" "));
}

function bannerMatchesProducts(banner) {
  const params = paramsFromHref(banner.href);
  const category = params.get("category");
  const collection = params.get("collection");
  const query = lower(params.get("query") || params.get("q"));

  return products.filter((product) => {
    if (product.inStock === false) return false;
    if (category && product.category !== category) return false;
    if (collection && !(product.collections || []).includes(collection)) return false;
    if (query && !productSearchText(product).includes(query)) return false;
    return true;
  });
}

test("homepage has banner carousel mount points", () => {
  for (const id of ['id="heroTrack"', 'id="heroDots"', 'id="heroPrev"', 'id="heroNext"']) {
    assert.ok(indexHtml.includes(id), `homepage missing ${id}`);
  }
});

test("site-config has active editable banners with real images", () => {
  assert.ok(activeBanners.length >= 3, `expected at least 3 active banners, found ${activeBanners.length}`);
  const bad = [];

  for (const banner of activeBanners) {
    for (const key of ["image", "alt", "eyebrow", "title", "href"]) {
      if (!banner[key]) bad.push(`${banner.title || "banner"}.${key}`);
    }
    if (banner.image && !existsSync(join(ROOT, repoPath(banner.image)))) {
      bad.push(`${banner.title || banner.image}.image-missing`);
    }
  }

  assert.deepEqual(bad, []);
});

test("banner links resolve to at least one in-stock catalog product", () => {
  const bad = activeBanners
    .filter((banner) => bannerMatchesProducts(banner).length === 0)
    .map((banner) => `${banner.title}: ${banner.href}`);

  assert.deepEqual(bad, [], `banners without catalog matches: ${bad.join(", ")}`);
});

test("app renders banners from site-config and keeps banner cards clickable", () => {
  assert.match(appJs, /siteConfig\.banners/);
  assert.match(appJs, /isConfigItemActive\(banner\)/);
  assert.match(appJs, /function renderHeroBanners\(\)/);
  assert.match(appJs, /href="\$\{escapeHtml\(banner\.href\)\}"/);
  assert.match(appJs, /data-hero-slide/);
});

test("carousel controls support dots, arrows, and mobile swipe", () => {
  assert.match(appJs, /heroDots\?\.addEventListener\("click"/);
  assert.match(appJs, /heroPrevButton\?\.addEventListener\("click"/);
  assert.match(appJs, /heroNextButton\?\.addEventListener\("click"/);
  assert.match(appJs, /hero\?\.addEventListener\("pointerdown"/);
  assert.match(appJs, /hero\?\.addEventListener\("pointerup"/);
});
