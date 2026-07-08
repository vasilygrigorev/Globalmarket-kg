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
  "ordersBody", "statusFilter", "periodFilter", "search", "refresh", "signOut",
  "ordersCount", "ordersTotal",
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

test("status filter options use Russian labels (values stay English)", () => {
  assert.match(html, /<option value="new">Новый<\/option>/);
  assert.match(html, /<option value="cancelled">Отменён<\/option>/);
});

test("period filter offers all/today/7d/30d", () => {
  for (const v of ["", "today", "7d", "30d"]) {
    assert.match(html, new RegExp(`<option value="${v}"`));
  }
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

test("list view declares the new dashboard/auto-refresh/feedback controls", () => {
  for (const id of ["dashboard", "autoRefresh", "listMsg"]) {
    assert.ok(declared.has(id), `missing #${id} in admin/index.html`);
  }
});

test("CSS styles the dashboard, new-order highlight, and inline row status select", () => {
  for (const sel of [".stat", ".stat-alert", ".stats-breakdown", "tr.row-new", "select.row-status"]) {
    assert.ok(html.includes(sel), `admin/index.html CSS missing ${sel}`);
  }
});

test("CSS defines a colour for every status class emitted by admin.logic.js", () => {
  // statusClass() in admin.logic.js maps each status to "status-<name>";
  // every one of those classes must actually be styled, or badges render as
  // plain default buttons/text with no visual differentiation.
  for (const cls of [".status-new", ".status-contacted", ".status-confirmed", ".status-completed", ".status-cancelled"]) {
    assert.ok(html.includes(cls), `admin/index.html CSS missing ${cls}`);
  }
});

// --- Wholesale applications queue ---

test("list view declares the wholesale applications table", () => {
  for (const id of ["wholesaleApplications", "wholesaleApplicationsCount", "wholesaleApplicationsBody"]) {
    assert.ok(declared.has(id), `missing #${id} in admin/index.html`);
  }
});

test("loading the list view also loads the wholesale applications queue", () => {
  assert.match(adminJs, /if \(view === "list"\) \{ loadOrders\(\); loadStats\(\); loadWholesaleApplications\(\); \}/);
});

test("approve/reject both update the application AND, when linked, the customer's row", () => {
  const fn = adminJs.match(/async function reviewWholesaleApplication\([\s\S]*?\n\}/)[0];
  assert.match(fn, /wholesale_applications["'][\s\S]*?\.update\(\{ status: decision/);
  assert.match(fn, /customer_type: "wholesale", wholesale_status: "approved"/);
  assert.match(fn, /wholesale_status: "rejected"/);
  assert.match(fn, /if \(!error && customerId\)/);
});
