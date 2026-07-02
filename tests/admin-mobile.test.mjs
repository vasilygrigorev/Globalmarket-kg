// Admin mobile / daily-use readiness contract — no network, no browser.
// Reads admin/index.html as text to lock the affordances that let a manager use
// /admin/ from a phone or small laptop: a mobile viewport, wrapping control rows,
// tap-sized buttons, a horizontally scrollable orders table, and sensible mobile
// keyboard hints — plus the crawl/security basics.
// Run: node --test tests/admin-mobile.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "admin", "index.html"), "utf8");

test("admin page declares a responsive mobile viewport", () => {
  assert.match(html, /<meta name="viewport" content="[^"]*width=device-width[^"]*"/);
});

test("admin page has a title and stays noindex", () => {
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex/i);
});

test("control rows wrap and buttons are tap-sized on small screens", () => {
  assert.match(html, /\.row\s*\{[^}]*flex-wrap:\s*wrap/);       // filters/actions wrap
  assert.match(html, /button\s*\{[^}]*min-height:\s*(4[0-9]|[5-9][0-9])px/); // >=40px tap target
});

test("the orders table scrolls horizontally instead of crushing on mobile", () => {
  assert.match(html, /overflow-x:\s*auto/);                     // scroll container
  assert.match(html, /table\s*\{[^}]*min-width:\s*\d{3,}px/);   // table keeps a readable min width
});

test("filter inputs give mobile keyboards sensible action hints", () => {
  assert.match(html, /id="search"[^>]*enterkeyhint="search"/);
  assert.match(html, /id="minAmount"[^>]*enterkeyhint="done"/);
});

test("admin loads config.js (optional) then admin.js as a module", () => {
  assert.match(html, /<script src="config\.js" onerror="window\.__gmConfigMissing=true"><\/script>/);
  assert.match(html, /<script type="module" src="admin\.js"><\/script>/);
});
