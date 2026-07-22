import test from "node:test";
import assert from "node:assert/strict";
import { buildWholesaleEmail, normalizeWholesaleApplication } from "./wholesale-application.js";

test("requires name and a plausible phone", () => {
  assert.deepEqual(normalizeWholesaleApplication({ phone: "996700000000" }), { error: "missing_name" });
  assert.deepEqual(normalizeWholesaleApplication({ name: "Иван", phone: "1" }), { error: "invalid_phone" });
});

test("rejects non-object payloads", () => {
  assert.deepEqual(normalizeWholesaleApplication(null), { error: "invalid_json" });
  assert.deepEqual(normalizeWholesaleApplication("x"), { error: "invalid_json" });
});

test("normalizes a full application", () => {
  const result = normalizeWholesaleApplication({
    name: "Иван",
    phone: "+996 700 123456",
    shop_name: "Магазин Радуга",
    address: "Бишкек, ул. Киевская, 10",
  });
  assert.equal(result.phoneDigits, "996700123456");
  assert.deepEqual(result.application, {
    name: "Иван",
    phone: "+996 700 123456",
    shop_name: "Магазин Радуга",
    city: "Бишкек, ул. Киевская, 10",
    comment: null,
    status: "pending",
  });
});

test("builds a concise manager email with the visible cabinet fields", () => {
  const email = buildWholesaleEmail({
    name: "Иван",
    phone: "+996 700 123456",
    shop_name: "Магазин Радуга",
    city: "Бишкек, ул. Киевская, 10",
  });
  assert.match(email.subject, /Магазин Радуга/);
  assert.match(email.text, /Адрес: Бишкек, ул\. Киевская, 10/);
  assert.match(email.text, /Телефон: \+996 700 123456/);
});

test("optional fields can be blank", () => {
  const result = normalizeWholesaleApplication({ name: "Иван", phone: "996700123456" });
  assert.equal(result.application.shop_name, null);
  assert.equal(result.application.city, null);
  assert.equal(result.application.comment, null);
  assert.equal(result.application.status, "pending");
});
