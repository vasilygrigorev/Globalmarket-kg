// Product share attribution contract — no network, no browser.
// Guards customer referral UTM links and the mobile admin-only Instagram share action.
// Run: node --test tests/product-share-attribution.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const appJs = read("app.js");
const productGenerator = read("scripts/generate_product_pages.py");

test("catalog product shares use stable referral UTM parameters", () => {
  assert.match(appJs, /function trackedProductShareUrl\(product, attribution = \{\}\)/);
  assert.match(appJs, /url\.searchParams\.set\("utm_source", attribution\.source \|\| "share"\)/);
  assert.match(appJs, /url\.searchParams\.set\("utm_medium", attribution\.medium \|\| "referral"\)/);
  assert.match(appJs, /url\.searchParams\.set\("utm_campaign", attribution\.campaign \|\| "product_share"\)/);
  assert.match(appJs, /url\.searchParams\.set\("utm_content", product\.sourceCode \|\| product\.id\)/);
  assert.match(appJs, /url: trackedProductShareUrl\(product\)/);
});

test("generated product pages share customer and Instagram links with separate UTM campaigns", () => {
  assert.match(productGenerator, /trackedShareUrl\("share", "referral", "product_share"\)/);
  assert.match(productGenerator, /trackedShareUrl\("instagram", "organic_social", "smm_product"\)/);
  assert.match(productGenerator, /url\.searchParams\.set\("utm_content", product\.code \|\| product\.id\)/);
});

test("Instagram share action is mobile-only and hidden unless an admin or SMM session exists", () => {
  assert.match(productGenerator, /data-smm-share[^>]*hidden/);
  assert.match(productGenerator, /\.icon-action\.smm-share\s*\{\{\s*display:\s*none/);
  assert.match(productGenerator, /@media \(max-width: 720px\)[\s\S]*?\.icon-action\.smm-share:not\(\[hidden\]\)/);
  assert.match(productGenerator, /class="top-share-stack"[\s\S]*?data-share[\s\S]*?data-smm-share/);
  assert.doesNotMatch(productGenerator, /class="bottom-page-action smm-share"/);
  assert.match(productGenerator, /user\?\.app_metadata\?\.is_admin === true/);
  assert.match(productGenerator, /user\?\.app_metadata\?\.is_smm === true/);
  assert.match(productGenerator, /browserSmmSession\(\)/);
  assert.match(productGenerator, /smmShareButton\.hidden = false/);
});

test("product sharing falls back to visible clipboard feedback when native sharing fails", () => {
  assert.match(productGenerator, /typeof navigator\.share === "function"/);
  assert.match(productGenerator, /error\?\.name === "AbortError"/);
  assert.match(productGenerator, /await copyShareText\(shareData\)/);
  assert.match(productGenerator, /document\.execCommand\("copy"\)/);
  assert.match(productGenerator, /data-share-feedback[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(productGenerator, /showShareFeedback\("Текст и ссылка скопированы"\)/);
});

test("product share buttons handle direct mobile pointer gestures", () => {
  assert.match(productGenerator, /touch-action: manipulation/);
  assert.match(productGenerator, /button\.addEventListener\("pointerup"/);
  assert.match(productGenerator, /lastTouchShareAt < 800/);
  assert.match(productGenerator, /bindShareButton\(document\.querySelector\("\[data-share\]"\)/);
  assert.match(productGenerator, /bindShareButton\(smmShareButton/);
});

test("product canonical URL remains clean and is not replaced by a tracked URL", () => {
  assert.match(productGenerator, /<link rel="canonical" href="\{escape\(canonical\)\}"/);
  assert.doesNotMatch(productGenerator, /<link rel="canonical"[^>]*utm_/);
});
