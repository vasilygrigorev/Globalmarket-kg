// Fixture/contract test for the admin page — no network, no jsdom.
// Reads the HTML + JS as text and checks the page and code stay in sync.
// Run: node --test admin/admin.dom.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(DIR, name), "utf8");

const html = read("index.html");
const adminJs = read("admin.js");
const logicJs = read("admin.logic.js");

// Collect element ids declared in the HTML (id="...").
function htmlIds(source) {
  const ids = new Set();
  for (const m of source.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}
// Collect ids the JS looks up via the $("...") helper.
function referencedIds(source) {
  const ids = new Set();
  for (const m of source.matchAll(/\$\("([^"]+)"\)/g)) ids.add(m[1]);
  return ids;
}
// Ids the JS creates dynamically (via id="..." inside template strings).
function dynamicIds(source) {
  return htmlIds(source); // same id="..." pattern inside admin.logic.js templates
}

const declared = htmlIds(html);
const dynamic = dynamicIds(logicJs);
const referenced = referencedIds(adminJs);

const REQUIRED = [
  "loginView", "accessView", "listView", "detailView",
  "ordersBody", "statusFilter", "search", "refresh", "signOut", "ordersCount",
];

test("required view/control ids exist in admin/index.html", () => {
  for (const id of REQUIRED) {
    assert.ok(declared.has(id), `missing #${id} in admin/index.html`);
  }
});

test("every id admin.js uses is declared in HTML or created in admin.logic.js", () => {
  const missing = [...referenced].filter((id) => !declared.has(id) && !dynamic.has(id));
  assert.deepEqual(missing, [], `admin.js references ids not present anywhere: ${missing.join(", ")}`);
});

test("dynamic detail ids come from admin.logic.js, not index.html", () => {
  // These are built by renderOrderDetail() at runtime, so they must NOT be
  // hard-coded in index.html but MUST exist in admin.logic.js templates.
  for (const id of ["editStatus", "editComment", "saveOrder", "saveMsg"]) {
    assert.ok(dynamic.has(id), `#${id} should be created in admin.logic.js`);
    assert.ok(!declared.has(id), `#${id} should not be hard-coded in index.html`);
  }
});

test("admin page loads config.js (optional) then admin.js as a module", () => {
  assert.match(html, /<script src="config\.js" onerror="window\.__gmConfigMissing=true"><\/script>/);
  assert.match(html, /<script type="module" src="admin\.js"><\/script>/);
});

test("admin page is noindex (must not be crawled)", () => {
  assert.match(html, /<meta name="robots" content="noindex/i);
});

test("admin runtime files never contain a service_role reference (anon-only)", () => {
  // The browser/admin must only ever use the publishable anon key. The service
  // role key must never appear in any shipped admin file.
  for (const [name, src] of [["index.html", html], ["admin.js", adminJs], ["admin.logic.js", logicJs]]) {
    assert.ok(!/service_role/i.test(src), `${name} must not reference service_role`);
  }
});

test("admin.js uses the anon key (not a service role) for the Supabase client", () => {
  assert.match(adminJs, /createClient\(\s*window\.GM_SUPABASE_URL\s*,\s*window\.GM_SUPABASE_ANON_KEY/);
});

test("CSS defines state classes used by JS (.banner, .ok, .hidden)", () => {
  // saveFeedback() toggles `.ok`; views toggle `.hidden`; errors use `.banner`.
  for (const cls of [".banner", ".ok", ".hidden"]) {
    assert.ok(html.includes(cls), `admin/index.html CSS missing ${cls}`);
  }
});
