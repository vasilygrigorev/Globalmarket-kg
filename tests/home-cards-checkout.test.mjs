// Home product card + checkout UX contract — no network, no browser.
// Reads app.js as text to keep the storefront card and the checkout flow intact:
// cards carry price/brand/type/volume/image/cart/favorite; checkout works without
// registration, keeps the WhatsApp fallback, and the customer/UTM fields are sent.
// Run: node --test tests/home-cards-checkout.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(ROOT, "app.js"), "utf8");

function block(re) {
  const m = appJs.match(re);
  return m ? m[0] : "";
}
const renderProducts = block(/function renderProducts\(\)[\s\S]*?\n}/);
const submitHandler = block(/checkoutForm\.addEventListener\("submit",[\s\S]*?\n}\);/);
const payload = block(/function buildOrderPayload\([\s\S]*?\n}/);
const saveApi = block(/async function saveOrderViaApi\([\s\S]*?\n}/);

test("home product card carries price, brand/type/volume, image, cart, favorite", () => {
  assert.ok(renderProducts, "renderProducts not found");
  assert.match(renderProducts, /formatPriceHtml\(productPrice\(product\)\)/); // price
  assert.match(renderProducts, /productDisplayParts|display\.(brand|type|size)/); // brand/type/volume
  assert.match(renderProducts, /productCardImage\(product\)/); // image
  assert.match(renderProducts, /data-add="\$\{product\.id\}"/); // add-to-cart
  assert.match(renderProducts, /data-favorite="\$\{product\.id\}"/); // favorite
});

test("home product card keeps open/details + registration discount text", () => {
  assert.ok(renderProducts, "renderProducts not found");
  // Product opens: either a real product page link or an in-app open handler.
  assert.match(renderProducts, /data-product-link="\$\{product\.id\}"|data-open-product="\$\{product\.id\}"/);
  // "Подробнее" details control opens the product.
  assert.match(renderProducts, /data-open-product="\$\{product\.id\}"[^>]*>Подробнее</);
  // Registration discount note shows both registered and not-yet-registered text.
  assert.match(renderProducts, /registered-price-note/);
  assert.match(renderProducts, /Скидка регистрации/);
  assert.match(renderProducts, /После регистрации/);
});

test("checkout can be submitted without registration", () => {
  assert.ok(submitHandler, "submit handler not found");
  // Only guard is an empty cart; no registration/login gate blocks submit.
  assert.match(submitHandler, /if \(!state\.cart\.size\)/);
  assert.ok(!/isRegisteredCustomer\(\)/.test(submitHandler), "submit must not require registration");
});

test("checkout keeps the WhatsApp fallback (backend optional)", () => {
  assert.match(submitHandler, /buildOrderPayload\(/);
  assert.match(submitHandler, /saveOrderViaApi\(/);
  assert.match(submitHandler, /window\.location\.href = whatsapp/);
  // saveOrderViaApi degrades to null when the flag is off or on any error.
  assert.match(saveApi, /if \(!cfg\.enabled\) return null;/);
  assert.match(saveApi, /return null;/);
});

test("checkout sends customer + UTM/attribution fields without breaking", () => {
  assert.ok(payload, "buildOrderPayload not found");
  assert.match(payload, /attribution:/);
  assert.match(payload, /utm_source/);
  assert.match(payload, /customer_source:/);
  assert.match(payload, /promo_code:/);
  assert.match(payload, /consent:/);
  // Core contact fields are still included.
  for (const f of ["name", "phone", "city", "region", "address"]) {
    assert.match(payload, new RegExp(`formData\\.get\\("${f}"\\)`));
  }
});
