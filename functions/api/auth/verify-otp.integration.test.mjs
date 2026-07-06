// Integration tests for onRequestPost in functions/api/auth/verify-otp.js
// Mocks global fetch (Supabase REST + SMS PRO) — no real network.

import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequest } from "./verify-otp.js";
import { verifySession } from "../session.js";

function makeContext(body, env) {
  return {
    request: { method: "POST", json: async () => body },
    env,
  };
}

const FULL_ENV = {
  SMSPRO_API_KEY: "test-smspro-key",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  SESSION_SIGNING_SECRET: "test-session-secret",
};

function installFetchMock({ otpRequestRow, smsProVerify, deleteOk = true } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    calls.push({ url: href, options });

    if (href.includes("smspro.nikita.kg")) {
      const beh = smsProVerify || { status: 0, description: "Code Valid" };
      return { ok: true, status: 200, json: async () => beh, text: async () => JSON.stringify(beh) };
    }

    if (href.includes("/rest/v1/otp_requests")) {
      if (options.method === "DELETE") {
        return { ok: deleteOk, status: deleteOk ? 204 : 500, json: async () => ({}), text: async () => "" };
      }
      const row = otpRequestRow === undefined
        ? { phone_digits: "996700123456", created_at: new Date().toISOString() }
        : otpRequestRow;
      const rows = row ? [row] : [];
      return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
    }

    throw new Error(`unexpected fetch to ${href}`);
  };
  return calls;
}

test("503 when env not configured", async () => {
  const res = await onRequestPost(makeContext({ token: "t", code: "1234" }, {}));
  assert.equal(res.status, 503);
});

test("400 on missing token/code, never reaches Supabase or SMS PRO", async () => {
  const calls = installFetchMock();
  const res = await onRequestPost(makeContext({ token: "", code: "1234" }, FULL_ENV));
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test("400 invalid_token when the token has no matching otp_requests row", async () => {
  installFetchMock({ otpRequestRow: null });
  const res = await onRequestPost(makeContext({ token: "unknown", code: "1234" }, FULL_ENV));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "invalid_token");
});

test("400 code_expired for a stale otp_requests row, without calling SMS PRO", async () => {
  const calls = installFetchMock({
    otpRequestRow: { phone_digits: "996700123456", created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
  });
  const res = await onRequestPost(makeContext({ token: "t", code: "1234" }, FULL_ENV));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "code_expired");
  assert.ok(!calls.some((c) => c.url.includes("smspro.nikita.kg")), "must not call SMS PRO for an already-stale row");
});

test("400 invalid_code when SMS PRO rejects the code", async () => {
  installFetchMock({ smsProVerify: { status: 14, description: "Invalid Code" } });
  const res = await onRequestPost(makeContext({ token: "t", code: "0000" }, FULL_ENV));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "invalid_code");
});

test("happy path mints a session cookie bound to the phone from otp_requests, ignoring any client phone", async () => {
  installFetchMock({ otpRequestRow: { phone_digits: "996700123456", created_at: new Date().toISOString() } });
  const res = await onRequestPost(
    makeContext({ token: "t", code: "1234", phone: "000000000000" }, FULL_ENV),
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);

  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, /^gmk_session=/);
  const tokenValue = cookie.split(";")[0].split("=").slice(1).join("=");
  const session = await verifySession(tokenValue, FULL_ENV.SESSION_SIGNING_SECRET);
  assert.equal(session.phone, "996700123456");
});

test("otp_requests row is deleted (single-use) after a successful verify", async () => {
  const calls = installFetchMock();
  await onRequestPost(makeContext({ token: "t", code: "1234" }, FULL_ENV));
  const deleteCall = calls.find((c) => c.options.method === "DELETE");
  assert.ok(deleteCall, "expected a DELETE call against otp_requests");
});

test("onRequest rejects non-POST methods with 405", async () => {
  const res = await onRequest({ request: { method: "GET" }, env: FULL_ENV });
  assert.equal(res.status, 405);
});
