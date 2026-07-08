import test from "node:test";
import assert from "node:assert/strict";
import { deriveRole, sanitizeProfile, normalizeProfileUpdate } from "./customer-profile.js";

test("deriveRole: no customer row means retail (guest, never logged in)", () => {
  assert.equal(deriveRole(null), "retail");
});

test("deriveRole: customer row with customer_type wholesale", () => {
  assert.equal(deriveRole({ customer_type: "wholesale", wholesale_status: "approved" }), "wholesale");
});

test("deriveRole: wholesale_status pending, not yet approved", () => {
  assert.equal(deriveRole({ customer_type: "retail", wholesale_status: "pending" }), "wholesale_pending");
});

test("deriveRole: plain logged-in customer is registered", () => {
  assert.equal(deriveRole({ customer_type: "retail", wholesale_status: "none" }), "registered");
});

test("sanitizeProfile: null customer returns empty fields with retail role", () => {
  assert.deepEqual(sanitizeProfile(null), {
    name: "",
    phone: "",
    city: "",
    region: "",
    address: "",
    role: "retail",
  });
});

test("sanitizeProfile: maps customer fields and never leaks internal-only ones", () => {
  const profile = sanitizeProfile({
    id: "uuid-1",
    name: "Иван",
    phone: "996700123456",
    city: "Бишкек",
    region: "Чуйская",
    address: "ул. Ленина 1",
    customer_type: "retail",
    wholesale_status: "none",
    default_discount_percent: 3,
    notes: "internal note",
  });
  assert.deepEqual(profile, {
    name: "Иван",
    phone: "996700123456",
    city: "Бишкек",
    region: "Чуйская",
    address: "ул. Ленина 1",
    role: "registered",
  });
  assert.ok(!("id" in profile));
  assert.ok(!("notes" in profile));
  assert.ok(!("default_discount_percent" in profile));
});

test("normalizeProfileUpdate rejects non-object payloads", () => {
  assert.deepEqual(normalizeProfileUpdate(null), { error: "invalid_json" });
  assert.deepEqual(normalizeProfileUpdate("x"), { error: "invalid_json" });
});

test("normalizeProfileUpdate trims/truncates fields, phone is never accepted", () => {
  const result = normalizeProfileUpdate({
    name: "  Иван  ",
    city: "Бишкек",
    region: "Чуйская",
    address: "ул. Ленина 1",
    phone: "996700000000",
  });
  assert.equal(result.name, "Иван");
  assert.equal(result.city, "Бишкек");
  assert.ok(!("phone" in result));
});

test("normalizeProfileUpdate allows blank optional fields", () => {
  const result = normalizeProfileUpdate({});
  assert.deepEqual(result, { name: null, city: null, region: null, address: null });
});
