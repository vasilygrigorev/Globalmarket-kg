// Integration tests for onRequestPost in functions/api/auth/request-otp.js
// Mocks global fetch (SMS PRO + Supabase REST) — no real network.

import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequest } from "./request-otp.js";

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
};

function installFetchMock({ smsPro, supabase } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    calls.push({ url: href, options });
    if (href.includes("smspro.nikita.kg")) {
      const beh = smsPro || { status: 0, description: "Code Sent", token: "tok-123" };
      return { ok: true, status: 200, json: async () => beh, text: async () => JSON.stringify(beh) };
    }
    const beh = supabase || { ok: true };
    return {
      ok: beh.ok !== false,
      status: beh.status || (beh.ok === false ? 500 : 201),
      json: async () => beh.body ?? {},
      text: async () => JSON.stringify(beh.body ?? {}),
    };
  };
  return calls;
}

test("503 when env not configured", async () => {
  const res = await onRequestPost(makeContext({ phone: "996700000000" }, {}));
  assert.equal(res.status, 503);
});

test("400 on invalid phone, never reaches SMS PRO", async () => {
  const calls = installFetchMock();
  const res = await onRequestPost(makeContext({ phone: "12" }, FULL_ENV));
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test("happy path calls SMS PRO then remembers token->phone in Supabase", async () => {
  const calls = installFetchMock();
  const res = await onRequestPost(makeContext({ phone: "+996 700 123456" }, FULL_ENV));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.token, "tok-123");

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /smspro\.nikita\.kg\/api\/otp\/send/);
  assert.equal(calls[0].options.headers["X-API-KEY"], "test-smspro-key");
  const sentBody = JSON.parse(calls[0].options.body);
  assert.equal(sentBody.phone, "996700123456");
  assert.ok(sentBody.transaction_id.length <= 32);

  assert.match(calls[1].url, /\/rest\/v1\/otp_requests/);
  const storedBody = JSON.parse(calls[1].options.body);
  assert.equal(storedBody.token, "tok-123");
  assert.equal(storedBody.phone_digits, "996700123456");
});

test("maps a non-zero SMS PRO status to a controlled JSON error, not 502/504", async () => {
  installFetchMock({ smsPro: { status: 4, description: "Not Enough Money" } });
  const res = await onRequestPost(makeContext({ phone: "996700000000" }, FULL_ENV));
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, "sms_provider_unavailable");
});

test("500 (not 502/504) when the Supabase insert fails", async () => {
  installFetchMock({ supabase: { ok: false, status: 500 } });
  const res = await onRequestPost(makeContext({ phone: "996700000000" }, FULL_ENV));
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.ok, false);
});

test("onRequest rejects non-POST methods with 405", async () => {
  const res = await onRequest({ request: { method: "GET" }, env: FULL_ENV });
  assert.equal(res.status, 405);
});
