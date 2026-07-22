import assert from "node:assert/strict";
import test from "node:test";
import { buildContactEmail, normalizeContactRequest } from "./contact-request.js";

test("contact request requires name, phone and message", () => {
  assert.equal(normalizeContactRequest({ phone: "996700000000", message: "Привет" }).error, "missing_name");
  assert.equal(normalizeContactRequest({ name: "Иван", phone: "1", message: "Привет" }).error, "invalid_phone");
  assert.equal(normalizeContactRequest({ name: "Иван", phone: "996700000000" }).error, "missing_message");
});

test("contact request validates optional email", () => {
  assert.equal(normalizeContactRequest({ name: "Иван", phone: "996700000000", email: "bad", message: "Привет" }).error, "invalid_email");
});

test("contact email contains all customer fields", () => {
  const normalized = normalizeContactRequest({
    name: "Иван",
    phone: "+996 700 000000",
    email: "ivan@example.com",
    message: "Нужна консультация",
  });
  const email = buildContactEmail(normalized.request);
  assert.match(email.subject, /Новое обращение/);
  assert.match(email.text, /\+996 700 000000/);
  assert.match(email.text, /ivan@example\.com/);
  assert.match(email.text, /Нужна консультация/);
});
