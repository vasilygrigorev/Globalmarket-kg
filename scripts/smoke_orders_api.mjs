#!/usr/bin/env node
// Smoke test for POST /api/orders against a deployed (preview) URL.
//
// Contains NO keys/secrets — it only calls the public endpoint.
//
// Usage:
//   node scripts/smoke_orders_api.mjs --base-url https://<preview>.pages.dev
//   node scripts/smoke_orders_api.mjs --base-url https://<preview>.pages.dev --full
//
// Modes:
//   probe (default): sends an empty cart and expects HTTP 400 (empty_cart).
//                    Proves the route is alive and validating WITHOUT creating
//                    any order row. If env vars are not set yet, the function
//                    returns 503 backend_not_configured first — reported as
//                    "route alive, backend not configured yet".
//   --full:          sends one clearly-marked TEST order and expects 200 with
//                    an order_id. Use only against preview, and clean up the
//                    test row afterwards. Creates a real row.
//
// Exit code 0 = pass, 1 = fail.

function parseArgs(argv) {
  const args = { full: false, baseUrl: process.env.SMOKE_BASE_URL || "" };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--full") args.full = true;
    else if (a === "--base-url") args.baseUrl = argv[++i];
    else if (a.startsWith("--base-url=")) args.baseUrl = a.split("=").slice(1).join("=");
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function log(ok, msg) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${msg}`);
}

async function postOrders(baseUrl, body) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/orders`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, data };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.baseUrl) {
    console.log("Usage: node scripts/smoke_orders_api.mjs --base-url <url> [--full]");
    process.exit(args.help ? 0 : 1);
  }

  const failures = [];

  // 1) Probe: empty cart -> 400 (or 503 if backend not configured yet).
  try {
    const { status, data } = await postOrders(args.baseUrl, {
      customer: { name: "SMOKE PROBE", phone: "000" },
      items: [],
    });
    if (status === 400) {
      log(true, `probe: route alive and validating (400 ${data && data.error})`);
    } else if (status === 503 && data && data.error === "backend_not_configured") {
      log(true, "probe: route alive, backend env NOT configured yet (503 backend_not_configured)");
    } else {
      failures.push(`probe: unexpected status ${status} ${JSON.stringify(data)}`);
      log(false, `probe: unexpected status ${status}`);
    }
  } catch (err) {
    failures.push(`probe: request failed ${err.message}`);
    log(false, `probe: request failed (${err.message})`);
  }

  // 2) Full: real test order -> 200 ok with order_id. Opt-in.
  if (args.full) {
    try {
      const { status, data } = await postOrders(args.baseUrl, {
        customer: { name: "SMOKE TEST — delete me", phone: "996700000000", city: "Бишкек" },
        items: [
          { product_id: "smoke-1", title: "SMOKE TEST item", qty: 1, price_kgs: 1 },
        ],
        whatsapp_message: "SMOKE TEST order — safe to delete",
      });
      if (status === 200 && data && data.ok && data.order_id) {
        log(true, `full: order saved (order_id=${data.order_id}). Remember to delete this test row.`);
      } else if (status === 503) {
        failures.push("full: backend not configured (set Cloudflare env vars first)");
        log(false, "full: backend not configured (503) — set env vars first");
      } else {
        failures.push(`full: unexpected status ${status} ${JSON.stringify(data)}`);
        log(false, `full: unexpected status ${status}`);
      }
    } catch (err) {
      failures.push(`full: request failed ${err.message}`);
      log(false, `full: request failed (${err.message})`);
    }
  }

  console.log("");
  if (failures.length) {
    console.log(`Smoke FAILED (${failures.length} issue(s)).`);
    process.exit(1);
  }
  console.log("Smoke OK.");
  process.exit(0);
}

main();
