// Integration tests for onRequestPost in functions/api/orders.js
// Run: node --test functions/api/orders.integration.test.mjs
// Mocks global fetch + a fake Pages context — no real Supabase, no network.

import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequest } from "./orders.js";

function makeContext(body, env) {
  return {
    request: { method: "POST", json: async () => body },
    env,
  };
}

const FULL_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  MANAGER_WHATSAPP: "996700000000",
};

// Install a fetch mock that records calls and returns canned responses.
// `tableBehavior` maps table name -> { ok, body }.
function installFetchMock(tableBehavior) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const table = String(url).split("/rest/v1/")[1] || "";
    const payload = JSON.parse(options.body);
    calls.push({ url: String(url), table, options, payload });
    const beh = tableBehavior[table] || { ok: true, body: [{ id: "uuid-order-1" }] };
    return {
      ok: beh.ok !== false,
      status: beh.status || (beh.ok === false ? 500 : 200),
      json: async () => beh.body ?? [{ id: "uuid-order-1" }],
      text: async () => JSON.stringify(beh.body ?? {}),
    };
  };
  return calls;
}

const goodOrder = {
  customer: { name: "Иван", phone: "996700123456", city: "Бишкек" },
  items: [{ product_id: "p1", title: "A", qty: 2, price_kgs: 550 }],
  whatsapp_message: "Заказ",
};

test("503 fallback when env not configured", async () => {
  const res = await onRequestPost(makeContext(goodOrder, {}));
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.fallback, true);
});

test("400 on empty cart", async () => {
  installFetchMock({});
  const res = await onRequestPost(makeContext({ customer: { name: "A", phone: "1" }, items: [] }, FULL_ENV));
  assert.equal(res.status, 400);
});

test("happy path inserts orders then order_items and returns order_id + wa url", async () => {
  const calls = installFetchMock({
    orders: { ok: true, body: [{ id: "uuid-order-42" }] },
    order_items: { ok: true, body: [] },
  });
  const res = await onRequestPost(makeContext(goodOrder, FULL_ENV));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.order_id, "uuid-order-42");
  assert.equal(data.status, "new");
  assert.match(data.manager_whatsapp_url, /^https:\/\/wa\.me\/996700000000\?text=/);

  const tables = calls.map((c) => c.table);
  assert.equal(tables[0], "orders", "orders inserted first");
  assert.ok(tables.includes("order_items"), "order_items inserted");
  // order_items carry the parent order_id and recomputed line totals
  const itemsCall = calls.find((c) => c.table === "order_items");
  assert.equal(itemsCall.payload[0].order_id, "uuid-order-42");
  assert.equal(itemsCall.payload[0].line_total_kgs, 1100);
  // service role key is used server-side
  assert.equal(calls[0].options.headers.apikey, "service-role-test-key");
});

test("sends optional manager email when Resend is configured", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    const payload = JSON.parse(options.body);
    if (href.includes("/rest/v1/")) {
      const table = href.split("/rest/v1/")[1] || "";
      calls.push({ type: "supabase", table, options, payload });
      return {
        ok: true,
        status: 200,
        json: async () => (table === "orders" ? [{ id: "uuid-order-email" }] : []),
        text: async () => "{}",
      };
    }
    calls.push({ type: "email", url: href, options, payload });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "email-1" }),
      text: async () => "{}",
    };
  };

  const res = await onRequestPost(makeContext(goodOrder, {
    ...FULL_ENV,
    RESEND_API_KEY: "re_test_key",
    ORDER_EMAIL_TO: "orders@globalmarket.kg",
    ORDER_EMAIL_FROM: "Global Market KG <orders@globalmarket.kg>",
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.email_notification.sent, true);

  const emailCall = calls.find((c) => c.type === "email");
  assert.equal(emailCall.url, "https://api.resend.com/emails");
  assert.equal(emailCall.options.headers.authorization, "Bearer re_test_key");
  assert.deepEqual(emailCall.payload.to, ["orders@globalmarket.kg"]);
  assert.match(emailCall.payload.subject, /Новый заказ Global Market KG/);
  assert.match(emailCall.payload.text, /Итого: 1 100 с/);
});

test("email failure does not block saved order or WhatsApp response", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    const payload = JSON.parse(options.body);
    if (href.includes("/rest/v1/")) {
      const table = href.split("/rest/v1/")[1] || "";
      calls.push({ type: "supabase", table, options, payload });
      return {
        ok: true,
        status: 200,
        json: async () => (table === "orders" ? [{ id: "uuid-order-email-fail" }] : []),
        text: async () => "{}",
      };
    }
    calls.push({ type: "email", url: href, options, payload });
    return {
      ok: false,
      status: 500,
      json: async () => ({ message: "mail down" }),
      text: async () => "mail down",
    };
  };

  const res = await onRequestPost(makeContext(goodOrder, {
    ...FULL_ENV,
    RESEND_API_KEY: "re_test_key",
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.email_notification.attempted, true);
  assert.equal(data.email_notification.sent, false);
  assert.equal(data.email_notification.reason, "send_failed");
  assert.match(data.manager_whatsapp_url, /^https:\/\/wa\.me\//);
});

test("attribution + consent inserted when provided", async () => {
  const calls = installFetchMock({ orders: { ok: true, body: [{ id: "o1" }] } });
  const body = {
    ...goodOrder,
    attribution: { utm_source: "instagram", utm_campaign: "june" },
    consent: { is_granted: true },
  };
  const res = await onRequestPost(makeContext(body, FULL_ENV));
  assert.equal(res.status, 200);
  const tables = calls.map((c) => c.table);
  assert.ok(tables.includes("marketing_attribution"));
  assert.ok(tables.includes("customer_consents"));
});

test("502 fallback when orders insert fails", async () => {
  installFetchMock({ orders: { ok: false, status: 500, body: { message: "boom" } } });
  const res = await onRequestPost(makeContext(goodOrder, FULL_ENV));
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.fallback, true);
});

test("onRequest rejects non-POST methods with 405", async () => {
  const res = await onRequest({ request: { method: "GET" }, env: FULL_ENV });
  assert.equal(res.status, 405);
  const data = await res.json();
  assert.equal(data.error, "method_not_allowed");
});

test("400 on invalid JSON body", async () => {
  installFetchMock({});
  const ctx = { request: { method: "POST", json: async () => { throw new Error("bad json"); } }, env: FULL_ENV };
  const res = await onRequestPost(ctx);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "invalid_json");
});
