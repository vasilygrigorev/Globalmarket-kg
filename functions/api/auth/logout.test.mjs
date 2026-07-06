import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequest } from "./logout.js";

test("clears the session cookie", async () => {
  const res = await onRequestPost();
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, /^gmk_session=;/);
  assert.match(cookie, /Max-Age=0/);
});

test("onRequest rejects non-POST methods with 405", async () => {
  const res = await onRequest({ request: { method: "GET" } });
  assert.equal(res.status, 405);
});
