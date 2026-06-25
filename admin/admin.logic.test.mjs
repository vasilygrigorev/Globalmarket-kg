// Unit tests for admin/admin.logic.js
// Run: node --test admin/admin.logic.test.mjs   (no DOM, no network)

import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUSES,
  esc,
  money,
  when,
  isConfigured,
  buildSearchOr,
  isValidStatus,
  friendlyError,
  emptyOrdersMessage,
  renderStatusOptions,
  renderOrderRow,
} from "./admin.logic.js";

test("esc neutralizes HTML", () => {
  assert.equal(esc(`<script>"&'`), "&lt;script&gt;&quot;&amp;&#039;");
  assert.equal(esc(null), "");
});

test("money formats integers with сом", () => {
  assert.match(money(1100), /1\D?100 сом/); // ru-RU may use NBSP/space grouping
  assert.equal(money("abc"), "0 сом");
});

test("when handles bad input", () => {
  assert.equal(when(""), "");
  assert.equal(when("not-a-date"), "not-a-date");
});

test("isConfigured requires real url + key", () => {
  assert.equal(isConfigured({ url: "https://x.supabase.co", key: "anonkey" }), true);
  assert.equal(isConfigured({ url: "https://YOUR-PROJECT.supabase.co", key: "anonkey" }), false);
  assert.equal(isConfigured({ url: "https://x.supabase.co", key: "YOUR-ANON-PUBLIC-KEY" }), false);
  assert.equal(isConfigured({ url: "https://x", key: "k", missing: true }), false);
  assert.equal(isConfigured({}), false);
});

test("buildSearchOr sanitizes and returns null when empty", () => {
  assert.equal(buildSearchOr("  "), null);
  assert.equal(buildSearchOr("0700"), "customer_phone.ilike.%0700%,customer_name.ilike.%0700%");
  // strips grammar-breaking chars
  assert.equal(buildSearchOr("a(),%b"), "customer_phone.ilike.%ab%,customer_name.ilike.%ab%");
});

test("isValidStatus matches the DB CHECK set", () => {
  assert.deepEqual(STATUSES, ["new", "contacted", "confirmed", "completed", "cancelled"]);
  assert.equal(isValidStatus("new"), true);
  assert.equal(isValidStatus("deleted"), false);
});

test("friendlyError maps common cases", () => {
  assert.match(friendlyError({ message: "JWT expired" }), /Сессия истекла/);
  assert.match(friendlyError({ message: "permission denied for table orders" }), /прав администратора/);
  assert.match(friendlyError({ message: "Failed to fetch" }), /связи с сервером/);
  assert.equal(friendlyError(null), "");
  assert.equal(friendlyError({ message: "weird" }), "weird");
});

test("emptyOrdersMessage distinguishes filtered vs empty", () => {
  assert.match(emptyOrdersMessage({}), /Заказов пока нет/);
  assert.match(emptyOrdersMessage({ status: "new" }), /фильтру/);
  assert.match(emptyOrdersMessage({ q: "077" }), /фильтру/);
});

test("renderStatusOptions marks current selected", () => {
  const html = renderStatusOptions("confirmed");
  assert.match(html, /<option value="confirmed" selected>confirmed<\/option>/);
  assert.equal((html.match(/selected/g) || []).length, 1);
});

test("renderOrderRow escapes content and carries data-id", () => {
  const row = renderOrderRow({
    id: "o1", created_at: "", customer_name: "<b>Иван</b>", customer_phone: "077",
    city: "Бишкек", total_kgs: 500, status: "new", customer_source: "instagram",
  });
  assert.match(row, /data-id="o1"/);
  assert.match(row, /&lt;b&gt;Иван&lt;\/b&gt;/);
  assert.match(row, /500 сом/);
});
