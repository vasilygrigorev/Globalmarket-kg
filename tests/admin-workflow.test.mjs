// Admin manager-workflow contract — no network, no browser, no Supabase.
// Reads admin.js as text and exercises the pure render helpers to protect the
// day-to-day manager flow: saving a status/comment must not clobber other order
// data, the list query must select every field the table/CSV render, the order
// detail must show everything a manager needs, and status handling stays stable.
// Run: node --test tests/admin-workflow.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { STATUSES, STATUS_LABELS, renderOrderDetail, renderStatusOptions, CSV_COLUMNS, orderSummaryText, orderAddressText } from "../admin/admin.logic.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const adminJs = readFileSync(join(ROOT, "admin", "admin.js"), "utf8");

function block(re) {
  const m = adminJs.match(re);
  return m ? m[0] : "";
}
const saveOrder = block(/async function saveOrder\([\s\S]*?\n}/);
const loadOrders = block(/async function loadOrders\([\s\S]*?\n}/);
const resetFilters = block(/function resetFilters\([\s\S]*?\n}/);
const indexHtml = readFileSync(join(ROOT, "admin", "index.html"), "utf8");

test("saving an order updates ONLY status and manager_comment (no data loss)", () => {
  assert.ok(saveOrder, "saveOrder not found");
  const update = saveOrder.match(/\.update\(\{([\s\S]*?)\}\)/);
  assert.ok(update, "no .update({...}) in saveOrder");
  const body = update[1];
  assert.match(body, /status:/);
  assert.match(body, /manager_comment:/);
  // Must not touch customer/total/attribution fields.
  for (const forbidden of ["customer_name", "customer_phone", "total_kgs", "city", "address", "customer_source"]) {
    assert.ok(!new RegExp(`\\b${forbidden}\\b`).test(body), `saveOrder update must not write ${forbidden}`);
  }
  assert.match(saveOrder, /\.eq\("id", id\)/); // scoped to the one order
});

test("the orders list query selects every field the table and CSV export render", () => {
  assert.ok(loadOrders, "loadOrders not found");
  // Tolerates an optional second arg, e.g. .select("cols", { count: "exact" }).
  const sel = loadOrders.match(/\.select\("([^"]+)"(?:,\s*\{[^}]*\})?\)/);
  assert.ok(sel, "no .select in loadOrders");
  const columns = new Set(sel[1].split(",").map((c) => c.trim()));
  for (const [key] of CSV_COLUMNS) {
    assert.ok(columns.has(key), `list query missing column used by table/CSV: ${key}`);
  }
});

test("save button is disabled during save to prevent double submit", () => {
  assert.match(saveOrder, /btn\.disabled = true/);
  assert.match(saveOrder, /btn\.disabled = false/);
});

test("order detail shows customer, WhatsApp, every item row, total, address, and manager note", () => {
  const html = renderOrderDetail(
    {
      customer_name: "Иван", customer_phone: "+996700123456", status: "confirmed", total_kgs: 1400,
      city: "Бишкек", region: "Чуйская", address: "ул. Ленина 1", customer_comment: "звонить после 18",
      customer_source: "instagram", promo_code: "SALE10", manager_comment: "перезвонить",
    },
    [
      { title_snapshot: "Persil гель", qty: 2, price_kgs: 500, line_total_kgs: 1000 },
      { title_snapshot: "Fairy", qty: 1, price_kgs: 400, line_total_kgs: 400 },
    ],
    [{ utm_source: "instagram", utm_campaign: "june" }],
    [{ is_granted: true }],
  );
  assert.match(html, /Иван/);
  assert.match(html, /\+996700123456/);
  assert.match(html, /wa\.me\/996700123456/);        // WhatsApp link
  assert.match(html, /Persil гель/);                  // item 1
  assert.match(html, /Fairy/);                        // item 2
  assert.match(html, /Бишкек, Чуйская, ул\. Ленина 1/); // joined delivery address
  assert.match(html, /instagram/);                    // attribution/source
  assert.match(html, /перезвонить/);                  // manager comment prefilled
  assert.match(html, /id="editComment"/);             // editable manager note
  assert.match(html, /id="saveOrder"/);               // save control
});

test("order detail offers a copy-summary button that copies plain text via clipboard", () => {
  const html = renderOrderDetail({ customer_name: "A", status: "new", total_kgs: 100 }, [], [], []);
  assert.match(html, /id="copySummary"/);              // button exists in detail
  assert.match(adminJs, /copySummary"\)\.addEventListener/); // wired
  assert.match(adminJs, /orderSummaryText\(/);          // uses the pure summary helper
  assert.match(adminJs, /navigator\.clipboard\.writeText/); // copies to clipboard
  // The summary is read-only plain text — no DB write, no HTML.
  const summary = orderSummaryText({ customer_name: "A", status: "new", total_kgs: 100 }, []);
  assert.ok(!/</.test(summary), "summary must be plain text");
});

test("order detail offers a copy-phone button wired to the clipboard", () => {
  const html = renderOrderDetail({ customer_name: "A", customer_phone: "+996700123456", status: "new", total_kgs: 100 }, [], [], []);
  assert.match(html, /id="copyPhone"/);                  // button present when phone exists
  assert.match(adminJs, /copyPhone/);                    // wired in admin.js
  assert.match(adminJs, /navigator\.clipboard\.writeText/); // copies via clipboard
});

test("reset-filters button clears every filter control and reloads", () => {
  assert.match(indexHtml, /id="resetFilters"/);            // button exists
  assert.match(adminJs, /resetFilters"\)\.addEventListener/); // wired
  assert.ok(resetFilters, "resetFilters() not found");
  for (const id of ["statusFilter", "periodFilter", "sortBy", "minAmount", "maxAmount", "search"]) {
    assert.ok(resetFilters.includes(`$("${id}")`), `resetFilters must clear ${id}`);
  }
  assert.match(resetFilters, /loadOrders\(\)/); // reloads the list
});

test("the orders list query supports a max-amount filter alongside min-amount", () => {
  assert.match(loadOrders, /parseMaxAmount\(/);
  assert.match(loadOrders, /\.lte\("total_kgs", *maxAmount\)/);
  assert.match(indexHtml, /id="maxAmount"/); // input exists in the filter row
});

test("every active filter chains onto the same query, so filters combine instead of overriding each other", () => {
  // Each branch must reassign `query = query.<method>(...)`. If a future edit
  // ever built a fresh `supabase.from("orders")...` inside one of these
  // branches instead of extending `query`, that filter would silently drop
  // every filter applied before it (e.g. status + search would stop combining).
  const branches = [
    /if \(status\) query = query\.eq\("status", status\);/,
    /if \(since\) query = query\.gte\("created_at", since\);/,
    /if \(minAmount != null\) query = query\.gte\("total_kgs", minAmount\);/,
    /if \(maxAmount != null\) query = query\.lte\("total_kgs", maxAmount\);/,
    /if \(orFilter\) query = query\.or\(orFilter\);/,
  ];
  for (const re of branches) {
    assert.match(loadOrders, re, `filter branch not chained onto the shared query: ${re}`);
  }
});

test("order detail offers a copy-address button wired to the clipboard", () => {
  const html = renderOrderDetail(
    { customer_name: "A", status: "new", total_kgs: 100, city: "Ош", address: "ул. Мира 5" }, [], [], [],
  );
  assert.match(html, /id="copyAddress"/);                  // button present when address exists
  assert.match(adminJs, /copyAddress/);                    // wired in admin.js
  assert.match(adminJs, /orderAddressText\(order\)/);       // reuses the shared address helper
  // No button when there is no address to copy.
  const noAddress = renderOrderDetail({ customer_name: "A", status: "new", total_kgs: 100 }, [], [], []);
  assert.ok(!noAddress.includes('id="copyAddress"'));
});

test("orderAddressText is the single source of truth for the joined address", () => {
  const order = { city: "Ош", region: "Ошская", address: "ул. Мира 5" };
  const html = renderOrderDetail({ ...order, customer_name: "A", status: "new", total_kgs: 100 }, [], [], []);
  assert.match(html, new RegExp(orderAddressText(order).replace(/\./g, "\\.")));
});

test("status set is the stable Russian 5 and all are offered in the detail select", () => {
  assert.deepEqual(STATUSES, ["new", "contacted", "confirmed", "completed", "cancelled"]);
  assert.equal(STATUS_LABELS.new, "Новый");
  assert.equal(STATUS_LABELS.cancelled, "Отменён");
  const options = renderStatusOptions("new");
  for (const s of STATUSES) assert.ok(options.includes(`value="${s}"`), `status ${s} not selectable`);
  // The currently-selected status is preselected exactly once.
  assert.equal((options.match(/selected/g) || []).length, 1);
});
