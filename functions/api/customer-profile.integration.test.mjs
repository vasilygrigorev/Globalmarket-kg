// Integration tests for onRequestGet/onRequestPost in functions/api/customer-profile.js
// Mocks global fetch (Supabase REST) — no real network.

import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost, onRequest } from "./customer-profile.js";
import { signSession, buildSessionCookie } from "./session.js";

function makeContext({ body, cookie, method = "POST", env }) {
  return {
    request: {
      method,
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

async function sessionCookieFor(phone) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = await signSession({ phone, exp }, FULL_ENV.SESSION_SIGNING_SECRET);
  return buildSessionCookie(token).split(";")[0];
}

function installFetchMock({ selectRows, updateRows, insertRows } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    calls.push({ url: href, options });
    if (options.method === "PATCH") {
      const rows = updateRows ?? [];
      return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
    }
    if (options.method === "POST") {
      const rows = insertRows ?? [{ name: null, phone: "996700123456", city: null, region: null, address: null, customer_type: "retail", wholesale_status: "none" }];
      return { ok: true, status: 201, json: async () => rows, text: async () => JSON.stringify(rows) };
    }
    const rows = selectRows ?? [];
    return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
  };
  return calls;
}

test("GET: 503 when env not configured", async () => {
  const res = await onRequestGet(makeContext({ method: "GET", env: {} }));
  assert.equal(res.status, 503);
});

test("GET: 401 when no session cookie", async () => {
  installFetchMock();
  const res = await onRequestGet(makeContext({ method: "GET", env: FULL_ENV }));
  assert.equal(res.status, 401);
});

test("GET: returns sanitized profile for a logged-in customer", async () => {
  installFetchMock({
    selectRows: [
      { name: "Иван", phone: "996700123456", city: "Бишкек", region: null, address: null, customer_type: "retail", wholesale_status: "none" },
    ],
  });
  const cookie = await sessionCookieFor("996700123456");
  const res = await onRequestGet(makeContext({ method: "GET", cookie, env: FULL_ENV }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.profile.name, "Иван");
  assert.equal(data.profile.role, "registered");
});

test("GET: no customers row yet returns retail role, not an error", async () => {
  installFetchMock({ selectRows: [] });
  const cookie = await sessionCookieFor("996700123456");
  const res = await onRequestGet(makeContext({ method: "GET", cookie, env: FULL_ENV }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.profile.role, "retail");
});

test("POST: 401 when no session cookie", async () => {
  installFetchMock();
  const res = await onRequestPost(makeContext({ body: { name: "Иван" }, env: FULL_ENV }));
  assert.equal(res.status, 401);
});

test("POST: updates the existing customers row via PATCH", async () => {
  const calls = installFetchMock({
    updateRows: [{ name: "Иван", phone: "996700123456", city: "Ош", region: null, address: null, customer_type: "retail", wholesale_status: "none" }],
  });
  const cookie = await sessionCookieFor("996700123456");
  const res = await onRequestPost(makeContext({ body: { name: "Иван", city: "Ош" }, cookie, env: FULL_ENV }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.profile.city, "Ош");
  const patchCall = calls.find((c) => c.options.method === "PATCH");
  assert.ok(patchCall, "expected a PATCH call");
  assert.match(patchCall.url, /phone_digits=eq\.996700123456/);
});

test("POST: falls back to insert when no row matched the update", async () => {
  const calls = installFetchMock({ updateRows: [] });
  const cookie = await sessionCookieFor("996700123456");
  const res = await onRequestPost(makeContext({ body: { name: "Иван" }, cookie, env: FULL_ENV }));
  assert.equal(res.status, 200);
  const insertCall = calls.find((c) => c.options.method === "POST");
  assert.ok(insertCall, "expected a fallback INSERT call");
});

test("onRequest dispatches GET/POST and rejects other methods", async () => {
  installFetchMock({ selectRows: [] });
  const cookie = await sessionCookieFor("996700123456");
  const getRes = await onRequest(makeContext({ method: "GET", cookie, env: FULL_ENV }));
  assert.equal(getRes.status, 200);
  const badRes = await onRequest(makeContext({ method: "DELETE", cookie, env: FULL_ENV }));
  assert.equal(badRes.status, 405);
});
