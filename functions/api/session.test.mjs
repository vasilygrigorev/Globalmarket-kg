import test from "node:test";
import assert from "node:assert/strict";
import {
  signSession,
  verifySession,
  buildSessionCookie,
  buildLogoutCookie,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
} from "./session.js";

const SECRET = "test-secret-do-not-use-in-prod";

test("signSession + verifySession round-trips a valid payload", async () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = await signSession({ phone: "996700000000", exp }, SECRET);
  const payload = await verifySession(token, SECRET);
  assert.deepEqual(payload, { phone: "996700000000", exp });
});

test("verifySession rejects a token signed with a different secret", async () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = await signSession({ phone: "996700000000", exp }, SECRET);
  const payload = await verifySession(token, "wrong-secret");
  assert.equal(payload, null);
});

test("verifySession rejects an expired payload", async () => {
  const exp = Math.floor(Date.now() / 1000) - 10;
  const token = await signSession({ phone: "996700000000", exp }, SECRET);
  const payload = await verifySession(token, SECRET);
  assert.equal(payload, null);
});

test("verifySession rejects a tampered payload", async () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = await signSession({ phone: "996700000000", exp }, SECRET);
  const [dataB64, sigB64] = token.split(".");
  const tamperedData = Buffer.from(JSON.stringify({ phone: "000000000000", exp })).toString("base64url");
  const tampered = `${tamperedData}.${sigB64}`;
  const payload = await verifySession(tampered, SECRET);
  assert.equal(payload, null);
});

test("verifySession rejects malformed tokens", async () => {
  assert.equal(await verifySession("", SECRET), null);
  assert.equal(await verifySession("not-a-token", SECRET), null);
  assert.equal(await verifySession("a.b.c", SECRET), null);
  assert.equal(await verifySession(null, SECRET), null);
});

test("buildSessionCookie sets HttpOnly/Secure/SameSite and the token value", () => {
  const cookie = buildSessionCookie("abc.def");
  assert.match(cookie, /^gmk_session=abc\.def;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});

test("buildLogoutCookie expires the cookie immediately", () => {
  const cookie = buildLogoutCookie();
  assert.match(cookie, /^gmk_session=;/);
  assert.match(cookie, /Max-Age=0/);
});

test("parseSessionCookie extracts the session value from a Cookie header", () => {
  assert.equal(parseSessionCookie(`${SESSION_COOKIE_NAME}=abc.def; other=1`), "abc.def");
  assert.equal(parseSessionCookie(`other=1; ${SESSION_COOKIE_NAME}=xyz`), "xyz");
  assert.equal(parseSessionCookie("other=1"), null);
  assert.equal(parseSessionCookie(null), null);
  assert.equal(parseSessionCookie(""), null);
});
