// Docs consistency — no network, no secrets.
// Catches go-live runbook rot: broken script references and a missing orders-API
// smoke in the release path.
// Run: node --test tests/docs-consistency.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");

function docFiles() {
  return readdirSync(DOCS).filter((n) => n.endsWith(".md")).map((n) => join(DOCS, n));
}

test("every scripts/<name> referenced in docs exists on disk", () => {
  const missing = [];
  for (const file of docFiles()) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/scripts\/[A-Za-z0-9_]+\.(?:py|mjs)/g)) {
      const rel = m[0];
      if (!existsSync(join(ROOT, rel))) missing.push(`${rel} (in docs/${file.split("/").pop()})`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], `docs reference missing scripts: ${missing.join(", ")}`);
});

test("release + readiness docs both keep the production orders-API smoke", () => {
  for (const doc of ["release-checklist.md", "production-readiness.md"]) {
    const text = readFileSync(join(DOCS, doc), "utf8");
    assert.match(text, /smoke_orders_api\.mjs/, `${doc} must reference the orders-API smoke`);
  }
});

test("env var names are consistent across go-live docs", () => {
  for (const doc of ["production-readiness.md", "backend-go-live-checklist.md", "api-orders.md"]) {
    const text = readFileSync(join(DOCS, doc), "utf8");
    assert.match(text, /SUPABASE_URL/);
    assert.match(text, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});
