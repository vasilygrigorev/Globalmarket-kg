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
const ordersFn = read("functions/api/orders.js");
const apiDoc = read("docs/api-orders.md");

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

const submitHandler = (appJs.match(/checkoutForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*?\n\}\);/) || [""])[0];

test("checkout does not require a registered customer to submit", () => {
  assert.ok(submitHandler, "checkout submit handler not found");
  // The only submit-blocking guard must be an empty cart, never state.customer —
  // registration only affects pricing (isRegisteredCustomer), not eligibility
  // to check out.
  assert.match(submitHandler, /if \(!state\.cart\.size\)/);
  assert.ok(!/state\.customer/.test(submitHandler), "submit handler must not gate on state.customer");
});

test("checkout guards against a duplicate submission from a quick double-click", () => {
  assert.match(appJs, /let checkoutSubmitting = false;/);
  assert.match(submitHandler, /if \(checkoutSubmitting\) return;/, "a second submit while one is in flight must be a no-op");
  assert.match(submitHandler, /checkoutSubmitting = true;/);
  assert.match(submitHandler, /finally\s*\{[\s\S]*?checkoutSubmitting = false;/, "the guard must reset even if saving/navigation throws");
  // The submit button is disabled for the same window, giving visible feedback.
  assert.match(submitHandler, /submitButton\.disabled = true/);
  assert.match(submitHandler, /finally\s*\{[\s\S]*?submitButton\.disabled = false;/);
});

test("buildOrderPayload's customer/item field names match what functions/api/orders.js reads", () => {
  // Locks the payload shape to the server contract: every customer.<field> the
  // client sends has a matching customer.<field> read in normalizeOrderPayload,
  // and every item field the client sends has a matching raw.<field> read.
  // Catches drift where the client renames/adds a field the server silently
  // ignores (data loss) or docs/api-orders.md describes a field neither side
  // actually uses.
  const payloadFn = appJs.match(/function buildOrderPayload\([\s\S]*?\n\}/)[0];
  const customerBlock = payloadFn.match(/customer:\s*\{([\s\S]*?)\},/)[1];
  const customerFields = customerBlock
    .match(/(\w+): formData\.get/g)
    .map((m) => m.split(":")[0].trim());
  for (const field of customerFields) {
    assert.match(ordersFn, new RegExp(`customer\\.${field}\\b`), `server does not read customer.${field}`);
  }

  const itemsBlock = payloadFn.match(/items: cartEntries\(\)\.map\(\(\{[\s\S]*?\}\)\),/)[0];
  const itemFields = itemsBlock
    .match(/(\w+):\s*(?:product\.|qty\b|productPrice)/g)
    .map((m) => m.split(":")[0].trim());
  for (const field of itemFields) {
    assert.match(ordersFn, new RegExp(`raw\\.${field}\\b`), `server does not read item field raw.${field}`);
  }
});

test("docs/api-orders.md no longer documents the unused customer.whatsapp field", () => {
  // customer.phone IS the WhatsApp contact number server-side; a separate
  // customer.whatsapp in the example payload was never read by
  // normalizeOrderPayload() and would silently do nothing if a client sent it.
  assert.ok(!/"customer":\s*\{[^}]*"whatsapp"/.test(apiDoc), "docs/api-orders.md still shows a phantom customer.whatsapp field");
});
