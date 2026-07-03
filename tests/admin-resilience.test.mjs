// Admin resilience + accessibility contract — no network, no browser, no
// Supabase. Reads admin.js as text and exercises the pure render helpers to
// protect three manager-facing guarantees:
//   1. list rows are keyboard-operable (focusable, button role, Enter/Space);
//   2. the session UI fails safe (getSession wrapped; auth changes re-route);
//   3. the orders count reflects the whole filtered set, not just the page.
// Run: node --test tests/admin-resilience.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderOrderRow, ordersMatchingText, pluralOrders } from "../admin/admin.logic.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const adminJs = readFileSync(join(ROOT, "admin", "admin.js"), "utf8");

function block(re) {
  const m = adminJs.match(re);
  return m ? m[0] : "";
}
const loadOrders = block(/async function loadOrders\([\s\S]*?\n}/);
const refreshSessionUI = block(/async function refreshSessionUI\([\s\S]*?\n}/);
const init = block(/function init\([\s\S]*?\n}/);

// --- 1. Keyboard accessibility of the orders list ---

test("order rows are focusable, announced as buttons, and labelled", () => {
  const row = renderOrderRow({
    id: "o-1", created_at: "2026-06-01T10:00:00Z", customer_name: "Пётр",
    customer_phone: "+996700111222", city: "Бишкек", total_kgs: 1500,
    status: "new", customer_source: "instagram",
  });
  assert.match(row, /tabindex="0"/, "row must be keyboard-focusable");
  assert.match(row, /role="button"/, "row must be announced as a button");
  assert.match(row, /aria-label="[^"]*Пётр[^"]*"/, "aria-label must name the customer");
  assert.match(row, /aria-label="[^"]*Открыть заказ[^"]*"/, "aria-label must describe the action");
});

test("a nameless order still gets a usable row label", () => {
  const row = renderOrderRow({ id: "o-2", status: "new", total_kgs: 0 });
  assert.match(row, /aria-label="[^"]*без имени[^"]*"/);
});

test("loadOrders wires a keyboard handler that opens the focused row", () => {
  assert.ok(loadOrders, "loadOrders not found");
  assert.match(loadOrders, /addEventListener\("keydown"/, "rows need a keydown handler");
  assert.match(loadOrders, /e\.key === "Enter" \|\| e\.key === " "/, "Enter and Space must open a row");
  assert.match(loadOrders, /e\.preventDefault\(\)/, "Space must not scroll the page");
});

// --- 2. Session resilience ---

test("refreshSessionUI reads the session inside a try/catch (no blank screen)", () => {
  assert.ok(refreshSessionUI, "refreshSessionUI not found");
  const guarded = refreshSessionUI.match(/try\s*\{[\s\S]*?getSession\(\)[\s\S]*?\}\s*catch/);
  assert.ok(guarded, "getSession() must be wrapped in try/catch");
  // On failure it must fail safe to the login view, not leave the last view up.
  assert.match(refreshSessionUI, /catch[\s\S]*?setView\("login"\)/);
});

test("init subscribes to auth state changes to re-route on expiry/sign-out", () => {
  assert.ok(init, "init not found");
  assert.match(init, /onAuthStateChange\(/, "must subscribe to auth state changes");
  assert.match(init, /refreshSessionUI\(\)/, "auth changes must refresh the view");
  // INITIAL_SESSION is skipped so first render doesn't load the list twice.
  assert.match(init, /INITIAL_SESSION/, "initial event must be de-duplicated");
});

test("when the backend is configured, init() proceeds past the gate to a real client + session load", () => {
  const gate = init.match(/if \(!configured\) \{[\s\S]*?\n {2}\}/);
  assert.ok(gate, "not-configured gate not found");
  assert.match(gate[0], /return;/, "not-configured must return early so it never falls through");
  // Everything after the gate only runs when configured === true: a real
  // Supabase client is created and the session (which loads the orders list
  // via refreshSessionUI -> loadOrders) is fetched. If a future edit moved the
  // early return outside the `if`, this would catch the admin silently never
  // loading orders even when the backend IS configured.
  const afterGate = init.slice(init.indexOf(gate[0]) + gate[0].length);
  assert.match(afterGate, /createClient\(window\.GM_SUPABASE_URL, window\.GM_SUPABASE_ANON_KEY\)/);
  assert.match(afterGate, /refreshSessionUI\(\)/, "configured path must load the session/orders");
});

// --- 3. Accurate count across pagination ---

test("loadOrders asks the server for an exact match count", () => {
  assert.match(loadOrders, /count:\s*"exact"/, "select must request an exact count");
  assert.match(loadOrders, /ordersMatchingText\(/, "the count must render the server total");
});

test("ordersMatchingText and pluralOrders agree on Russian plurals", () => {
  assert.equal(pluralOrders(1), "заказ");
  assert.equal(pluralOrders(3), "заказа");
  assert.equal(pluralOrders(5), "заказов");
  assert.equal(pluralOrders(11), "заказов");
  assert.equal(pluralOrders(22), "заказа");
  assert.equal(ordersMatchingText(22), `Всего 22 ${pluralOrders(22)}`);
});
