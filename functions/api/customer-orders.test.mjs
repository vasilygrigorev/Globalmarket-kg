// Unit tests for the pure logic in functions/api/customer-orders.js
// Run: node --test functions/api/customer-orders.test.mjs
// No network, no secrets — request validation, code matching, and the
// customer-facing sanitized shape only.

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLookupRequest,
  matchesLookupCode,
  sanitizeOrderForCustomer,
  groupItemsByOrderId,
} from "./customer-orders.js";

test("normalizeLookupRequest requires a phone with at least 6 digits", () => {
  assert.equal(normalizeLookupRequest({ phone: "12345", code: "GM7K9X" }).error, "invalid_phone");
  assert.equal(normalizeLookupRequest({ phone: "", code: "GM7K9X" }).error, "invalid_phone");
});

test("normalizeLookupRequest requires a non-empty code", () => {
  assert.equal(normalizeLookupRequest({ phone: "996700000000", code: "" }).error, "invalid_code");
  assert.equal(normalizeLookupRequest({ phone: "996700000000" }).error, "invalid_code");
});

test("normalizeLookupRequest normalizes phone to digits and code to uppercase", () => {
  const r = normalizeLookupRequest({ phone: "+996 700-11-22-33", code: "gm-7k9x" });
  assert.equal(r.phoneDigits, "996700112233");
  assert.equal(r.code, "GM7K9X");
});

test("normalizeLookupRequest rejects non-object payloads", () => {
  assert.equal(normalizeLookupRequest(null).error, "invalid_json");
  assert.equal(normalizeLookupRequest("x").error, "invalid_json");
});

test("matchesLookupCode matches the order's own lookup_code, case/format-insensitively", () => {
  assert.equal(matchesLookupCode({ id: "irrelevant", lookup_code: "GM7K9X" }, "GM7K9X"), true);
  assert.equal(matchesLookupCode({ id: "irrelevant", lookup_code: "gm-7k9x" }, "GM7K9X"), true);
  assert.equal(matchesLookupCode({ id: "irrelevant", lookup_code: "OTHERCODE" }, "GM7K9X"), false);
});

test("matchesLookupCode falls back to the order id prefix when lookup_code is absent", () => {
  const order = { id: "ab12cd34-0000-0000-0000-000000000000", lookup_code: null };
  assert.equal(matchesLookupCode(order, "AB12CD34"), true);
  assert.equal(matchesLookupCode(order, "WRONGCODE"), false);
});

test("matchesLookupCode is false for a missing order", () => {
  assert.equal(matchesLookupCode(null, "GM7K9X"), false);
});

test("sanitizeOrderForCustomer excludes internal-only fields", () => {
  const order = {
    id: "order-1",
    lookup_code: "GM7K9X",
    created_at: "2026-07-06T10:00:00Z",
    status: "confirmed",
    total_kgs: 1400,
    customer_name: "Айгуль",
    customer_phone: "996700000000",
    customer_phone_digits: "996700000000",
    city: "Бишкек",
    region: "Чуй",
    address: "ул. Тестовая 1",
    customer_comment: "Позвоните заранее",
    manager_comment: "internal note, must not leak",
    whatsapp_message: "internal message text, must not leak",
    sent_to_whatsapp: true,
    promo_code: "STORY10",
  };
  const sanitized = sanitizeOrderForCustomer(order, []);
  assert.equal(sanitized.code, "GM7K9X");
  assert.equal(sanitized.status_label, "Подтверждён");
  assert.equal(sanitized.customer_name, "Айгуль");
  assert.equal(sanitized.promo_code, "STORY10");
  assert.equal("manager_comment" in sanitized, false);
  assert.equal("whatsapp_message" in sanitized, false);
  assert.equal("sent_to_whatsapp" in sanitized, false);
  assert.equal("customer_phone" in sanitized, false);
  assert.equal("customer_phone_digits" in sanitized, false);
});

test("sanitizeOrderForCustomer falls back to an id-derived code when lookup_code is absent", () => {
  const order = { id: "ab12cd34-0000-0000-0000-000000000000", lookup_code: null, status: "new" };
  const sanitized = sanitizeOrderForCustomer(order, []);
  assert.equal(sanitized.code, "AB12CD34");
});

test("sanitizeOrderForCustomer maps item snapshots to a customer-friendly shape", () => {
  const order = { id: "order-1", status: "new" };
  const items = [
    { order_id: "order-1", title_snapshot: "Dove дезодорант", brand_snapshot: "Dove", unit_snapshot: "шт", qty: 2, price_kgs: 395, line_total_kgs: 790, image_snapshot: "assets/products/dove/x.jpg" },
  ];
  const sanitized = sanitizeOrderForCustomer(order, items);
  assert.deepEqual(sanitized.items, [
    { title: "Dove дезодорант", brand: "Dove", unit: "шт", qty: 2, price_kgs: 395, line_total_kgs: 790, image: "assets/products/dove/x.jpg" },
  ]);
});

test("groupItemsByOrderId buckets a flat list by order_id", () => {
  const items = [
    { order_id: "o1", title_snapshot: "A" },
    { order_id: "o2", title_snapshot: "B" },
    { order_id: "o1", title_snapshot: "C" },
  ];
  const grouped = groupItemsByOrderId(items);
  assert.deepEqual(grouped.get("o1").map((i) => i.title_snapshot), ["A", "C"]);
  assert.deepEqual(grouped.get("o2").map((i) => i.title_snapshot), ["B"]);
});

test("groupItemsByOrderId handles empty/absent input", () => {
  assert.equal(groupItemsByOrderId([]).size, 0);
  assert.equal(groupItemsByOrderId(undefined).size, 0);
});
