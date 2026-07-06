import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRequestOtpPayload, mapSmsProSendStatus } from "./request-otp.js";

test("normalizeRequestOtpPayload requires a phone with at least 6 digits", () => {
  assert.deepEqual(normalizeRequestOtpPayload({ phone: "123" }), { error: "invalid_phone" });
  assert.deepEqual(normalizeRequestOtpPayload({}), { error: "invalid_phone" });
});

test("normalizeRequestOtpPayload normalizes phone to digits only", () => {
  assert.deepEqual(normalizeRequestOtpPayload({ phone: "+996 (700) 12-34-56" }), {
    phoneDigits: "996700123456",
  });
});

test("normalizeRequestOtpPayload rejects non-object payloads", () => {
  assert.deepEqual(normalizeRequestOtpPayload(null), { error: "invalid_json" });
  assert.deepEqual(normalizeRequestOtpPayload("phone"), { error: "invalid_json" });
});

test("mapSmsProSendStatus: 0 means success (null)", () => {
  assert.equal(mapSmsProSendStatus(0), null);
});

test("mapSmsProSendStatus: 7 (invalid phone) maps to 400", () => {
  assert.deepEqual(mapSmsProSendStatus(7), { error: "invalid_phone", httpStatus: 400 });
});

test("mapSmsProSendStatus: 4/5 (provider account issues) map to 503, not 502/504", () => {
  assert.deepEqual(mapSmsProSendStatus(4), { error: "sms_provider_unavailable", httpStatus: 503 });
  assert.deepEqual(mapSmsProSendStatus(5), { error: "sms_provider_unavailable", httpStatus: 503 });
});

test("mapSmsProSendStatus: unknown codes fall back to a generic 500", () => {
  assert.deepEqual(mapSmsProSendStatus(99), { error: "sms_provider_error", httpStatus: 500 });
});
