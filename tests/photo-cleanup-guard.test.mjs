// Regression guard for the c4e3a27 photo-loss incident — no network, no browser.
// c4e3a27 deleted raw Telegram photos that report_photo_coverage.py flagged as
// "unused" because it only checked products currently visible in
// data/public-catalog.json. A product that is temporarily out of stock drops out
// of that catalog even though data/product_overrides.json still holds its real,
// correct photo — that photo must never look deletable.
// Run: node --test tests/photo-cleanup-guard.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function py(code) {
  const result = spawnSync("python3", ["-c", code], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("an out-of-stock product's real photo is never reported as an unused raw leftover", () => {
  const output = py(`
import sys
sys.path.insert(0, "scripts")
import report_photo_coverage as m

# Simulate the exact regression: product is out of stock, so it is absent from
# public-catalog.json's "products" list, but its override still references a
# raw-named Telegram photo (the only file shape the "unused leftover" scan
# matches). find_unused_raw_leftovers must not flag it.
fixture_name = "telegram-photo-cleanup-guard-test-front.jpg"
m.override_referenced_paths = lambda: {f"assets/products/{fixture_name}"}

fixture_path = m.PRODUCTS_DIR / fixture_name
try:
    fixture_path.write_bytes(b"x")
    unused = m.find_unused_raw_leftovers([])  # empty visible-products list = out of stock
    print(fixture_name in [p.rsplit("/", 1)[-1] for p in unused])
finally:
    fixture_path.unlink(missing_ok=True)
`);
  assert.equal(output, "False");
});
