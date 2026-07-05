// 1C import identity contract — no network, no browser.
// MXL rows carry a numeric 1C item code. That code must be the stable identity
// so renamed products keep their existing photo/title overrides.
// Run: node --test tests/import-stock-identity.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function py(code) {
  const result = spawnSync("python3", ["-c", code], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("source_id prefers the 1C source_code over mutable product name", () => {
  const output = py(`
import sys
sys.path.insert(0, "scripts")
import import_stock as m
print(m.source_id("Old name", " 1267 "))
print(m.source_id("New fragrance name", "1267"))
print(m.source_id("Old name", "1268"))
print(m.source_id("Old name"))
print(m.source_id("New name"))
`);
  const [sameA, sameB, differentCode, rawA, rawB] = output.split("\n");
  assert.equal(sameA, "src_1c_1267");
  assert.equal(sameA, sameB);
  assert.notEqual(sameA, differentCode);
  assert.notEqual(rawA, rawB);
});

test("stock import reconciles known source_code rows before inserting products", () => {
  const src = readFileSync(join(ROOT, "scripts/import_stock.py"), "utf8");
  assert.match(src, /def resolve_import_source_id\(/);
  assert.match(src, /where sp\.source_code = \?/);
  assert.match(src, /item\["source_id"\] = resolve_import_source_id\(conn, item\)/);
});
