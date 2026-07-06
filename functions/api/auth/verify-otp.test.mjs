import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeVerifyOtpPayload,
  isOtpRequestExpired,
  mapSmsProVerifyStatus,
  OTP_REQUEST_MAX_AGE_SECONDS,
} from "./verify-otp.js";

test("normalizeVerifyOtpPayload requires both token and code", () => {
  assert.deepEqual(normalizeVerifyOtpPayload({ code: "1234" }), { error: "invalid_token" });
  assert.deepEqual(normalizeVerifyOtpPayload({ token: "tok" }), { error: "invalid_code" });
  assert.deepEqual(normalizeVerifyOtpPayload({ token: "tok", code: "1234" }), { token: "tok", code: "1234" });
});

test("normalizeVerifyOtpPayload rejects non-object payloads", () => {
  assert.deepEqual(normalizeVerifyOtpPayload(null), { error: "invalid_json" });
});

test("normalizeVerifyOtpPayload trims whitespace", () => {
  assert.deepEqual(normalizeVerifyOtpPayload({ token: "  tok  ", code: " 1234 " }), { token: "tok", code: "1234" });
});

test("isOtpRequestExpired: fresh row is not expired", () => {
  const now = Date.now();
  assert.equal(isOtpRequestExpired(new Date(now - 1000).toISOString(), now), false);
});

test("isOtpRequestExpired: row older than the max age is expired", () => {
  const now = Date.now();
  const old = new Date(now - (OTP_REQUEST_MAX_AGE_SECONDS + 60) * 1000).toISOString();
  assert.equal(isOtpRequestExpired(old, now), true);
});

test("isOtpRequestExpired: unparsable timestamp is treated as expired", () => {
  assert.equal(isOtpRequestExpired("not-a-date"), true);
  assert.equal(isOtpRequestExpired(null), true);
});

test("mapSmsProVerifyStatus: 0 means valid (null)", () => {
  assert.equal(mapSmsProVerifyStatus(0), null);
  assert.equal(mapSmsProVerifyStatus("0"), null);
});

test("mapSmsProVerifyStatus: known error codes map to 400", () => {
  assert.deepEqual(mapSmsProVerifyStatus(14), { error: "invalid_code", httpStatus: 400 });
  assert.deepEqual(mapSmsProVerifyStatus(13), { error: "code_expired", httpStatus: 400 });
  assert.deepEqual(mapSmsProVerifyStatus(12), { error: "invalid_token", httpStatus: 400 });
});

test("mapSmsProVerifyStatus: unknown codes fall back to a generic 500", () => {
  assert.deepEqual(mapSmsProVerifyStatus(99), { error: "sms_provider_error", httpStatus: 500 });
});
