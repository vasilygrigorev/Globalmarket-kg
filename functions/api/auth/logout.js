// Cloudflare Pages Function — POST /api/auth/logout
//
// Clears the "Мои заказы" session cookie (functions/api/session.js). The
// session is stateless (no server-side session table), so logging out is
// just expiring the cookie client-side — nothing to delete server-side.

import { buildLogoutCookie } from "../session.js";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function onRequestPost() {
  return json({ ok: true }, 200, { "set-cookie": buildLogoutCookie() });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  return onRequestPost();
}
