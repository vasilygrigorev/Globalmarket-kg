// Integration tests for onRequestPost in functions/api/wholesale-application.js
// Mocks global fetch (Supabase REST) — no real network.

import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequest } from "./wholesale-application.js";

function makeContext(body, env) {
  return {
    request: { method: "POST", json: async () => body },
    env,
  };
}

const FULL_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
};

const goodApplication = {
  name: "Иван",
  phone: "996700123456",
  shop_name: "Магазин Радуга",
  city: "Бишкек",
  comment: "Хотим оптовые цены",
};

function installFetchMock({ existingCustomerId = null } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    calls.push({ url: href, options });
    if (href.includes("/rest/v1/customers")) {
      if (options.method === "PATCH") {
        return { ok: true, status: 200, json: async () => [], text: async () => "[]" };
      }
      const rows = existingCustomerId ? [{ id: existingCustomerId }] : [];
      return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
    }
    if (href.includes("/rest/v1/wholesale_applications")) {
      return { ok: true, status: 201, json: async () => [{ id: "app-1" }], text: async () => "[]" };
    }
    throw new Error(`unexpected fetch to ${href}`);
  };
  return calls;
}

test("503 when env not configured", async () => {
  const res = await onRequestPost(makeContext(goodApplication, {}));
  assert.equal(res.status, 503);
});

test("400 on invalid application, never reaches Supabase", async () => {
  const calls = installFetchMock();
  const res = await onRequestPost(makeContext({ phone: "996700123456" }, FULL_ENV));
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test("happy path with no matching customer: inserts application without a customer_id link", async () => {
  const calls = installFetchMock({ existingCustomerId: null });
  const res = await onRequestPost(makeContext(goodApplication, FULL_ENV));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);

  const insertCall = calls.find((c) => c.url.includes("/rest/v1/wholesale_applications"));
  const body = JSON.parse(insertCall.options.body);
  assert.equal(body.customer_id, null);
  assert.equal(body.status, "pending");

  assert.ok(!calls.some((c) => c.options.method === "PATCH"), "no customer to mark pending");
});

test("happy path with a matching customer: links application and flags customer wholesale_status pending", async () => {
  const calls = installFetchMock({ existingCustomerId: "cust-1" });
  const res = await onRequestPost(makeContext(goodApplication, FULL_ENV));
  assert.equal(res.status, 200);

  const insertCall = calls.find((c) => c.url.includes("/rest/v1/wholesale_applications"));
  const body = JSON.parse(insertCall.options.body);
  assert.equal(body.customer_id, "cust-1");

  const patchCall = calls.find((c) => c.options.method === "PATCH");
  assert.ok(patchCall, "expected a customers PATCH to mark wholesale_status pending");
  assert.match(patchCall.url, /customers\?id=eq\.cust-1/);
  const patchBody = JSON.parse(patchCall.options.body);
  assert.equal(patchBody.wholesale_status, "pending");
});

test("500 (not 502/504) when the insert fails", async () => {
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    if (href.includes("/rest/v1/customers")) {
      return { ok: true, status: 200, json: async () => [], text: async () => "[]" };
    }
    return { ok: false, status: 500, json: async () => ({}), text: async () => "boom" };
  };
  const res = await onRequestPost(makeContext(goodApplication, FULL_ENV));
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.ok, false);
});

test("onRequest rejects non-POST methods with 405", async () => {
  const res = await onRequest({ request: { method: "GET" }, env: FULL_ENV });
  assert.equal(res.status, 405);
});
