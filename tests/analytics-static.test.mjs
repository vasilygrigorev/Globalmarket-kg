import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function pageFiles() {
  const files = [
    "index.html",
    "privacy.html",
    "delivery-and-returns/index.html",
    "catalog/index.html",
  ];
  for (const dirname of ["brand", "category", "collection", "product"]) {
    const base = path.join(root, dirname);
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const relative = path.join(dirname, entry.name, "index.html");
      if (fs.existsSync(path.join(root, relative))) files.push(relative);
    }
  }
  return files;
}

test("every public storefront page has one consent-aware Google tag", () => {
  for (const relative of pageFiles()) {
    const html = fs.readFileSync(path.join(root, relative), "utf8");
    assert.equal((html.match(/id="gmk-google-tag-loader"/g) || []).length, 1, relative);
    assert.equal((html.match(/id="gmk-google-consent-script"/g) || []).length, 1, relative);
    assert.equal((html.match(/class="gmk-consent"/g) || []).length, 1, relative);
    assert.ok(html.indexOf("analytics_storage: 'denied'") < html.indexOf('id="gmk-google-tag-loader"'), relative);
  }
});

test("Google events remain free of customer-entered fields", () => {
  const script = fs.readFileSync(path.join(root, "assets/google-consent.js"), "utf8");
  assert.match(script, /AW-18474068233/);
  assert.match(script, /AW-18473846742/);
  assert.match(script, /AW-18473846742\/i7tRCJa62pwdENaPgulE/);
  assert.match(script, /order_submitted/);
  assert.match(script, /sms_code_requested/);
  assert.match(script, /sms_login_failed/);
  assert.doesNotMatch(script, /phone_digits|otpCode|lookupPhone|customerName|addressLine/);
});

test("Cloudflare invokes Pages Functions only for API routes", () => {
  const routes = JSON.parse(fs.readFileSync(path.join(root, "_routes.json"), "utf8"));
  assert.deepEqual(routes, { version: 1, include: ["/api/*"], exclude: [] });
});
