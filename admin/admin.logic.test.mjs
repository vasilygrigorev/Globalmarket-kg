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
  isAdminSession,
  buildSearchOr,
  isValidStatus,
  friendlyError,
  emptyOrdersMessage,
  renderStatusOptions,
  renderOrderRow,
  nextView,
  renderItemsRows,
  renderOrderDetail,
  loadingRowHtml,
  loginButtonLabel,
  saveFeedback,
  customerWaLink,
  ordersCountText,
  statusLabel,
  consentText,
  sourceText,
  sinceForPeriod,
  ordersTotalText,
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

test("isAdminSession requires explicit app_metadata.is_admin", () => {
  assert.equal(isAdminSession({ user: { app_metadata: { is_admin: true } } }), true);
  assert.equal(isAdminSession({ user: { app_metadata: { is_admin: false } } }), false);
  assert.equal(isAdminSession({ user: { app_metadata: { role: "admin" } } }), false);
  assert.equal(isAdminSession({ user: {} }), false);
  assert.equal(isAdminSession(null), false);
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
  assert.match(html, /<option value="confirmed" selected>Подтверждён<\/option>/);
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

test("loadingRowHtml uses given colspan and loading text", () => {
  assert.match(loadingRowHtml(7), /colspan="7"/);
  assert.match(loadingRowHtml(), /Загрузка/);
});

test("loginButtonLabel reflects busy state", () => {
  assert.equal(loginButtonLabel(false), "Войти");
  assert.equal(loginButtonLabel(true), "Входим…");
});

test("saveFeedback returns text + ok per state", () => {
  assert.deepEqual(saveFeedback("saving"), { text: "Сохранение…", ok: false });
  assert.deepEqual(saveFeedback("done"), { text: "Сохранено ✓", ok: true });
  const err = saveFeedback("error", { message: "permission denied" });
  assert.equal(err.ok, false);
  assert.match(err.text, /прав администратора/);
  assert.equal(saveFeedback("error").text, "Не удалось сохранить.");
});

test("sinceForPeriod returns null for all, ISO for ranges", () => {
  const now = new Date("2026-06-26T12:00:00Z");
  assert.equal(sinceForPeriod("", now), null);
  assert.equal(sinceForPeriod("all", now), null);
  const d7 = sinceForPeriod("7d", now);
  assert.equal(d7, new Date("2026-06-19T12:00:00Z").toISOString());
  const d30 = sinceForPeriod("30d", now);
  assert.ok(new Date(d30) < new Date(d7));
  const today = sinceForPeriod("today", now);
  assert.ok(new Date(today) <= now); // midnight of that day, not in the future
});

test("ordersTotalText sums total_kgs of shown orders", () => {
  assert.match(ordersTotalText([{ total_kgs: 100 }, { total_kgs: 250 }]), /350 сом/);
  assert.match(ordersTotalText([]), /0 сом/);
  assert.match(ordersTotalText([{ total_kgs: "x" }, { total_kgs: 50 }]), /50 сом/);
});

test("statusLabel maps to Russian, falls back to raw", () => {
  assert.equal(statusLabel("new"), "Новый");
  assert.equal(statusLabel("cancelled"), "Отменён");
  assert.equal(statusLabel("weird"), "weird");
  assert.equal(statusLabel(""), "");
});

test("consentText summarizes consents", () => {
  assert.equal(consentText([]), "—");
  assert.equal(consentText(null), "—");
  assert.equal(consentText([{ is_granted: true }]), "да");
  assert.equal(consentText([{ is_granted: false }]), "нет");
});

test("sourceText shows present parts or 'не указан'", () => {
  assert.equal(sourceText({}, []), "не указан");
  assert.match(sourceText({}, [{ utm_source: "instagram" }]), /utm_source=instagram/);
  assert.match(sourceText({ customer_source: "друзья" }, []), /ручной=друзья/);
});

test("renderOrderDetail shows address, promo, consent, RU status", () => {
  const html = renderOrderDetail(
    { customer_name: "A", customer_phone: "0700", status: "confirmed", total_kgs: 100,
      city: "Бишкек", region: "Чуй", address: "ул. 1", promo_code: "SALE10", customer_comment: "" },
    [], [{ utm_source: "ig" }], [{ is_granted: true }],
  );
  assert.match(html, /Бишкек, Чуй, ул\. 1/);   // joined address
  assert.match(html, /SALE10/);                 // promo
  assert.match(html, /Согласие на акции<\/dt><dd>да/); // consent
  assert.match(html, /class="status">Подтверждён</); // RU status badge
});

test("customerWaLink builds wa.me from digits or returns empty", () => {
  assert.equal(customerWaLink("+996 700 12-34-56"), "https://wa.me/996700123456");
  assert.equal(customerWaLink("0700123456"), "https://wa.me/0700123456");
  assert.equal(customerWaLink(""), "");
  assert.equal(customerWaLink(null), "");
});

test("ordersCountText uses correct Russian plural", () => {
  assert.equal(ordersCountText(1), "Показано 1 заказ");
  assert.equal(ordersCountText(2), "Показано 2 заказа");
  assert.equal(ordersCountText(5), "Показано 5 заказов");
  assert.equal(ordersCountText(11), "Показано 11 заказов");
  assert.equal(ordersCountText(21), "Показано 21 заказ");
  assert.equal(ordersCountText(0), "Показано 0 заказов");
});

test("renderOrderDetail includes a customer WhatsApp link when phone present", () => {
  const withPhone = renderOrderDetail(
    { customer_name: "A", customer_phone: "0700123456", status: "new", total_kgs: 1 },
    [], [],
  );
  assert.match(withPhone, /wa\.me\/0700123456/);
  assert.match(withPhone, /Написать клиенту в WhatsApp/);
  const noPhone = renderOrderDetail(
    { customer_name: "A", customer_phone: "", status: "new", total_kgs: 1 },
    [], [],
  );
  assert.ok(!noPhone.includes("Написать клиенту в WhatsApp"));
});

test("nextView routes by session + admin flag", () => {
  assert.equal(nextView(null), "login");
  assert.equal(nextView({ user: { app_metadata: {} } }), "access");
  assert.equal(nextView({ user: { app_metadata: { is_admin: false } } }), "access");
  assert.equal(nextView({ user: { app_metadata: { is_admin: true } } }), "list");
});

test("renderItemsRows shows empty placeholder or escaped rows", () => {
  assert.match(renderItemsRows([]), /Нет строк/);
  const rows = renderItemsRows([{ title_snapshot: "<x>", qty: 2, price_kgs: 100, line_total_kgs: 200 }]);
  assert.match(rows, /&lt;x&gt;/);
  assert.match(rows, /200 сом/);
});

test("renderOrderDetail escapes, totals, status select, empty items", () => {
  const html = renderOrderDetail(
    { customer_name: "<i>A</i>", customer_phone: "077", status: "confirmed", total_kgs: 1400,
      city: "Бишкек", region: "", address: "", customer_comment: "", manager_comment: "x\"y",
      customer_source: "ig", promo_code: "" },
    [],
    [{ utm_source: "instagram" }],
  );
  assert.match(html, /&lt;i&gt;A&lt;\/i&gt;/);          // name escaped
  assert.match(html, /1\D?400 сом/);                    // total
  assert.match(html, /<option value="confirmed" selected>/); // current status selected
  assert.match(html, /Нет строк/);                      // empty items
  assert.match(html, /instagram/);                      // attribution
  assert.match(html, /id="saveOrder"/);                 // save button present
  assert.ok(!html.includes('x"y'), "manager_comment must be HTML-escaped");
});
