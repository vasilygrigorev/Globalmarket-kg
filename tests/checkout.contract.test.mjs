// Fixture/contract test for the storefront checkout — no network, no secrets.
// Reads app.js + index.html as text and checks the checkout form and the order
// payload builder stay in sync, and that the backend save degrades safely.
// Run: node --test tests/checkout.contract.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const html = read("index.html");
const appJs = read("app.js");

// Every form field app.js reads via formData.get("X") must exist as name="X".
test("checkout form fields match formData.get() usage in app.js", () => {
  const used = [...appJs.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]);
  const declared = new Set([...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...new Set(used)].filter((f) => !declared.has(f));
  assert.deepEqual(missing, [], `app.js reads form fields not present in index.html: ${missing.join(", ")}`);
});

test("checkout has the contact + attribution fields the payload needs", () => {
  for (const field of ["name", "phone", "city", "region", "address", "comment", "customerSource", "promoCode", "marketingConsent"]) {
    assert.match(html, new RegExp(`name="${field}"`), `index.html missing checkout field name="${field}"`);
  }
});

test("backend save is flag-gated and falls back to WhatsApp", () => {
  assert.match(appJs, /function buildOrderPayload\(/);
  assert.match(appJs, /async function saveOrderViaApi\(/);
  // Reads the site-config flag (does not hardcode enabled).
  assert.match(appJs, /siteConfig\.ordersApi/);
  // Default endpoint and WhatsApp fallback navigation are present.
  assert.match(appJs, /\/api\/orders/);
  assert.match(appJs, /window\.location\.href = whatsapp/);
});

test("storefront browser code carries no service_role key", () => {
  assert.ok(!/service_role/i.test(appJs), "app.js must not reference service_role");
  assert.ok(!/service_role/i.test(html), "index.html must not reference service_role");
});
