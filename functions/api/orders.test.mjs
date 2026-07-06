// Unit tests for the pure logic in functions/api/orders.js
// Run: node --test functions/api/orders.test.mjs
// No network, no secrets — validation + server-side total recompute only.

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrderPayload,
  buildManagerUrl,
  buildOrderEmail,
  num,
  str,
  digitsOnly,
  DEFAULT_MANAGER_WHATSAPP,
} from "./orders.js";

test("rejects empty cart", () => {
  const r = normalizeOrderPayload({ customer: { name: "A", phone: "1" }, items: [] });
  assert.equal(r.error, "empty_cart");
});

test("rejects missing contact", () => {
  const r = normalizeOrderPayload({ customer: {}, items: [{ qty: 1, price_kgs: 10 }] });
  assert.equal(r.error, "missing_contact");
});

test("recomputes total server-side and ignores client total", () => {
  const r = normalizeOrderPayload({
    customer: { name: "Иван", phone: "996700000000" },
    total_kgs: 999999, // attacker-supplied, must be ignored
    items: [
      { product_id: "p1", title: "A", qty: 2, price_kgs: 550 },
      { product_id: "p2", title: "B", qty: 3, price_kgs: 100 },
    ],
  });
  assert.equal(r.error, undefined);
  assert.equal(r.total, 2 * 550 + 3 * 100); // 1400
  assert.equal(r.order.total_kgs, 1400);
  assert.equal(r.items[0].line_total_kgs, 1100);
  assert.equal(r.items[1].line_total_kgs, 300);
});

test("qty is floored to >= 1 integer", () => {
  const r = normalizeOrderPayload({
    customer: { name: "A", phone: "1" },
    items: [{ title: "X", qty: 0, price_kgs: 50 }],
  });
  assert.equal(r.items[0].qty, 1);
});

test("status is always 'new' and sent_to_whatsapp false", () => {
  const r = normalizeOrderPayload({
    customer: { name: "A", phone: "1" },
    items: [{ title: "X", qty: 1, price_kgs: 50 }],
  });
  assert.equal(r.order.status, "new");
  assert.equal(r.order.sent_to_whatsapp, false);
});

test("attribution included only when present", () => {
  const without = normalizeOrderPayload({
    customer: { name: "A", phone: "1" },
    items: [{ title: "X", qty: 1, price_kgs: 50 }],
  });
  assert.equal(without.attribution, null);

  const withUtm = normalizeOrderPayload({
    customer: { name: "A", phone: "1" },
    items: [{ title: "X", qty: 1, price_kgs: 50 }],
    attribution: { utm_source: "instagram" },
  });
  assert.equal(withUtm.attribution.utm_source, "instagram");
});

test("consent normalized when provided", () => {
  const r = normalizeOrderPayload({
    customer: { name: "A", phone: "1" },
    items: [{ title: "X", qty: 1, price_kgs: 50 }],
    consent: { is_granted: true },
  });
  assert.equal(r.consent.is_granted, true);
  assert.equal(r.consent.consent_type, "marketing");
  assert.equal(r.consent.source, "checkout");
});

test("buildManagerUrl uses default phone and encodes message", () => {
  const url = buildManagerUrl(undefined, "привет мир");
  assert.ok(url.startsWith(`https://wa.me/${DEFAULT_MANAGER_WHATSAPP}?text=`));
  assert.ok(url.includes(encodeURIComponent("привет мир")));
});

test("buildOrderEmail creates readable manager copy", () => {
  const normalized = normalizeOrderPayload({
    customer: { name: "Айгуль", phone: "996700000000", city: "Бишкек" },
    items: [{ title: "Dove дезодорант", qty: 2, price_kgs: 395 }],
    customer_source: "Instagram",
    promo_code: "STORY10",
    attribution: { utm_source: "instagram", utm_campaign: "dove" },
    consent: { is_granted: false },
  });
  const email = buildOrderEmail(normalized, "order-1");
  assert.match(email.subject, /Новый заказ Global Market KG/);
  assert.match(email.text, /Имя: Айгуль/);
  assert.match(email.text, /Dove дезодорант/);
  assert.match(email.text, /Итого: 790 с/);
  assert.match(email.text, /utm_source: instagram/);
  assert.match(email.text, /Согласие на обратную связь: нет/);
});

test("helpers: num/str/digitsOnly", () => {
  assert.equal(num("abc"), 0);
  assert.equal(num("12.5"), 12.5);
  assert.equal(str("  hi  "), "hi");
  assert.equal(str(""), null);
  assert.equal(digitsOnly("+996 706-77-11-03"), "996706771103");
});
