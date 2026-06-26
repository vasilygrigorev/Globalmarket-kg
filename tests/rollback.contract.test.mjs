// Rollback contract test — no network, no secrets.
// Verifies the WhatsApp-only rollback path stays real in code AND documented,
// so production can always fall back safely.
// Run: node --test tests/rollback.contract.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

test("site-config has an ordersApi block with a boolean flag", () => {
  const cfg = JSON.parse(read("data/site-config.json"));
  assert.ok(cfg.ordersApi && typeof cfg.ordersApi === "object", "ordersApi block missing");
  assert.equal(typeof cfg.ordersApi.enabled, "boolean", "ordersApi.enabled must be boolean");
  assert.equal(cfg.ordersApi.endpoint, "/api/orders");
});

test("checkout always falls back to WhatsApp (code-level rollback)", () => {
  const appJs = read("app.js");
  // saveOrderViaApi returns null when the flag is off → caller keeps WhatsApp URL.
  assert.match(appJs, /const cfg = siteConfig\.ordersApi \|\| \{\};/);
  assert.match(appJs, /if \(!cfg\.enabled\) return null;/);
  // The submit handler navigates to the WhatsApp URL unconditionally at the end.
  assert.match(appJs, /window\.location\.href = whatsapp/);
});

test("rollback is documented consistently across go-live docs", () => {
  for (const doc of [
    "docs/production-readiness.md",
    "docs/api-orders.md",
    "docs/backend-go-live-checklist.md",
    "docs/backend-go-live-dry-run.md",
  ]) {
    const text = read(doc);
    assert.match(text, /ordersApi\.enabled\s*=?\s*false/i, `${doc} must document the flag=false rollback`);
  }
});

test("server endpoint returns a fallback signal when unconfigured", () => {
  // The function tells the client to fall back (503) instead of hard-failing.
  const fn = read("functions/api/orders.js");
  assert.match(fn, /backend_not_configured/);
  assert.match(fn, /fallback: true/);
});
