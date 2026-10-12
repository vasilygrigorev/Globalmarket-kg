import assert from "node:assert/strict";
import test from "node:test";
import { onRequest, onRequestGet, secretsMatch } from "./supabase-heartbeat.js";

const FULL_ENV = {
  SUPABASE_HEARTBEAT_SECRET: "heartbeat-test-secret",
  SUPABASE_URL: "https://example.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
};

function makeContext({ secret = FULL_ENV.SUPABASE_HEARTBEAT_SECRET, env = FULL_ENV, method = "GET" } = {}) {
  return {
    request: {
      method,
      headers: new Headers(secret === null ? {} : { "x-supabase-heartbeat-secret": secret }),
    },
    env,
  };
}

test("secret comparison rejects missing, empty, wrong and different-length values", () => {
  assert.equal(secretsMatch("expected", null), false);
  assert.equal(secretsMatch("", ""), false);
  assert.equal(secretsMatch("expected", "wrong"), false);
  assert.equal(secretsMatch("expected", "expectee"), false);
  assert.equal(secretsMatch("expected", "expected"), true);
});

test("unauthenticated requests are hidden with 404 and do not touch Supabase", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("must not be called");
  };

  const response = await onRequestGet(makeContext({ secret: "wrong" }));
  assert.equal(response.status, 404);
  assert.equal(called, false);
});

test("valid heartbeat performs one protected read and returns ok", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200 };
  };

  const response = await onRequestGet(makeContext());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/orders?select=id&limit=1");
  assert.equal(calls[0].options.headers.apikey, "service-role-test-key");
  assert.equal(calls[0].options.headers.authorization, "Bearer service-role-test-key");
});

test("missing database configuration returns 503", async () => {
  const response = await onRequestGet(makeContext({
    env: { SUPABASE_HEARTBEAT_SECRET: FULL_ENV.SUPABASE_HEARTBEAT_SECRET },
  }));
  assert.equal(response.status, 503);
});

test("Supabase errors are returned without leaking provider details", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  const response = await onRequestGet(makeContext());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, error: "database_unavailable" });
});

test("non-GET methods are rejected", async () => {
  const response = await onRequest(makeContext({ method: "POST" }));
  assert.equal(response.status, 405);
});
