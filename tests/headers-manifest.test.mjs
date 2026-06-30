// Deploy config contract: _headers security headers + PWA web manifest.
// No network. Guards the Cloudflare security headers and the installable PWA
// manifest/icons from silent regression.
// Run: node --test tests/headers-manifest.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

test("_headers sets the baseline security headers for all routes", () => {
  const h = read("_headers");
  assert.match(h, /^\/\*/m);
  assert.match(h, /X-Content-Type-Options:\s*nosniff/i);
  assert.match(h, /Referrer-Policy:\s*strict-origin-when-cross-origin/i);
  assert.match(h, /X-Frame-Options:\s*SAMEORIGIN/i);
  assert.match(h, /Permissions-Policy:/i);
});

test("site.webmanifest is valid JSON with required PWA fields", () => {
  const m = JSON.parse(read("site.webmanifest"));
  assert.ok(m.name, "manifest name");
  assert.ok(m.short_name, "manifest short_name");
  assert.equal(typeof m.theme_color, "string");
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, "manifest needs >=2 icons");
});

test("every manifest icon file exists on disk", () => {
  const m = JSON.parse(read("site.webmanifest"));
  const missing = (m.icons || [])
    .map((i) => i.src)
    .filter((src) => !existsSync(join(ROOT, String(src).replace(/^\/+/, ""))));
  assert.deepEqual(missing, [], `manifest icons missing: ${missing.join(", ")}`);
});
