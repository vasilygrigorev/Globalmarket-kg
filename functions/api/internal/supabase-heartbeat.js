const SECRET_HEADER = "x-supabase-heartbeat-secret";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function secretsMatch(expected, supplied) {
  const left = new TextEncoder().encode(String(expected || ""));
  const right = new TextEncoder().encode(String(supplied || ""));
  if (left.length === 0 || left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const suppliedSecret = context.request.headers.get(SECRET_HEADER);

  // Hide this internal route from unauthenticated callers.
  if (!secretsMatch(env.SUPABASE_HEARTBEAT_SECRET, suppliedSecret)) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "service_unavailable" }, 503);
  }

  const supabaseUrl = String(env.SUPABASE_URL).replace(/\/+$/, "");
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/orders?select=id&limit=1`, {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      return json({ ok: false, error: "database_unavailable" }, 502);
    }
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "database_unavailable" }, 502);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  return onRequestGet(context);
}
