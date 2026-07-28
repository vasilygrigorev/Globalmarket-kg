// Product-page purchase placement and checkout navigation contract.
// Run: node --test tests/product-checkout-navigation.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const generator = fs.readFileSync("scripts/generate_product_pages.py", "utf8");
const appJs = fs.readFileSync("app.js", "utf8");

test("purchase buttons sit immediately after the product gallery", () => {
  assert.match(
    generator,
    /<section class="visual-panel">[\s\S]*?\{render_gallery\(images, title\)\}[\s\S]*?product-purchase-strip[\s\S]*?<\/section>/,
  );
  assert.match(generator, /product-purchase-actions[\s\S]*?data-add-cart[\s\S]*?data-checkout/);
  assert.doesNotMatch(
    generator,
    /<section class="product-detail-info">[\s\S]*?product-purchase-actions/,
  );
});

test("checkout action saves the product before leaving its page", () => {
  assert.match(generator, /href="\/\?checkout=1#checkoutForm" data-checkout/);
  assert.match(
    generator,
    /data-checkout[^]*?event\.preventDefault\(\);[^]*?addToCart\(\{\{ increment: false \}\}\);[^]*?window\.location\.href = event\.currentTarget\.href;/,
  );
});

test("homepage waits for catalog rendering before aligning the checkout form", () => {
  assert.match(appJs, /function applyProductCheckoutFromUrl\(\)/);
  assert.match(appJs, /params\.get\("checkout"\) !== "1"/);
  assert.match(
    appJs,
    /await loadCatalog\(\);[\s\S]*?await ensureSession\(\);[\s\S]*?refreshPricingViews\(\);[\s\S]*?applyProductCheckoutFromUrl\(\);/,
  );
  assert.match(appJs, /checkoutForm\.scrollIntoView\(\{ behavior: "auto", block: "start" \}\)/);
});
