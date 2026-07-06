// Integration tests for onRequestPost in functions/api/customer-orders.js
// Mocks global fetch (Supabase REST) — no real network.

import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "./customer-orders.js";
import { signSession, buildSessionCookie } from "./session.js";

function makeContext({ body, cookie, env }) {
  return {
    request: {
      method: "POST",
      json: async () => body ?? {},
      headers: { get: (name) => (name.toLowerCase() === "cookie" ? cookie || null : null) },
    },
    env,
  };
}

const FULL_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  SESSION_SIGNING_SECRET: "test-session-secret",
};

function installFetchMock({ orders, orderItems } = {}) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push({ url: href });
    if (href.includes("/rest/v1/orders")) {
      const rows = orders ?? [];
      return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
    }
    if (href.includes("/rest/v1/order_items")) {
      const rows = orderItems ?? [];
      return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
    }
    throw new Error(`unexpected fetch to ${href}`);
  };
  return calls;
}

test("no cookie: falls back to phone+code, 404 when nothing matches", async () => {
  installFetchMock({ orders: [] });
  const res = await onRequestPost(makeContext({ body: { phone: "996700000000", code: "ABCDEF" }, env: FULL_ENV }));
  assert.equal(res.status, 404);
});

test("no cookie: 400 on invalid phone/code, same as before this feature existed", async () => {
  installFetchMock();
  const res = await onRequestPost(makeContext({ body: { phone: "1", code: "" }, env: FULL_ENV }));
  assert.equal(res.status, 400);
});

test("valid session cookie: returns all orders for that phone without needing a code", async () => {
  installFetchMock({
    orders: [{ id: "o1", created_at: "2026-01-01T00:00:00Z", status: "new", total_kgs: 500 }],
    orderItems: [],
  });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sessionToken = await signSession({ phone: "996700123456", exp }, FULL_ENV.SESSION_SIGNING_SECRET);
  const res = await onRequestPost(
    makeContext({ cookie: buildSessionCookie(sessionToken).split(";")[0], env: FULL_ENV }),
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.orders.length, 1);
  assert.equal(data.orders[0].id, "o1");
});

test("valid session cookie with zero orders returns ok:true, empty list — not 404", async () => {
  installFetchMock({ orders: [] });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sessionToken = await signSession({ phone: "996700123456", exp }, FULL_ENV.SESSION_SIGNING_SECRET);
  const res = await onRequestPost(
    makeContext({ cookie: buildSessionCookie(sessionToken).split(";")[0], env: FULL_ENV }),
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.deepEqual(data.orders, []);
});

test("expired session cookie is ignored, falls back to requiring phone+code", async () => {
  installFetchMock({ orders: [] });
  const exp = Math.floor(Date.now() / 1000) - 10;
  const sessionToken = await signSession({ phone: "996700123456", exp }, FULL_ENV.SESSION_SIGNING_SECRET);
  const res = await onRequestPost(
    makeContext({
      cookie: buildSessionCookie(sessionToken).split(";")[0],
      body: { phone: "1", code: "" },
      env: FULL_ENV,
    }),
  );
  assert.equal(res.status, 400);
});

test("session signed with a different secret is ignored", async () => {
  installFetchMock({ orders: [] });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sessionToken = await signSession({ phone: "996700123456", exp }, "other-secret");
  const res = await onRequestPost(
    makeContext({
      cookie: buildSessionCookie(sessionToken).split(";")[0],
      body: { phone: "1", code: "" },
      env: FULL_ENV,
    }),
  );
  assert.equal(res.status, 400);
});
