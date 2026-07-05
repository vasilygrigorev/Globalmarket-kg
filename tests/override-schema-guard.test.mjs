// Guard against the 2026-07-05 legacy-override incident — no network, no browser.
// A data/product_overrides.json entry that carries a photo (image or
// galleryImages) but is missing clean_title/description/brand/product_type
// (snake_case) is silently skipped by scripts/apply_product_overrides.py —
// the photo never reaches the storefront and nothing errors. 23 entries sat
// like that until found by hand. scripts/check_override_schema.py catches
// this going forward.
// Run: node --test tests/override-schema-guard.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function runCheck() {
  return spawnSync("python3", ["scripts/check_override_schema.py", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

test("the current data/product_overrides.json has no photographed entry missing required fields", () => {
  const result = runCheck();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.issues, []);
});

test("a camelCase-only photographed entry is flagged, and manual perfume entries are exempt", () => {
  const py = `
import sys, json
sys.path.insert(0, "scripts")
import check_override_schema as m

real = m.OVERRIDES_PATH.read_text(encoding="utf-8")
data = json.loads(real)
data["prd_fixture_camelcase_only"] = {
    "brand": "Fixture",
    "title": "Fixture product",
    "productType": "test",
    "image": "assets/products/fixture/fixture-card-front.jpg",
}
data["prd_perfume_fixture_5ml"] = {
    "brand": "Fixture",
    "title": "Fixture perfume",
    "productType": "perfume",
    "image": "assets/products/perfume/fixture-card.jpg",
}
m.OVERRIDES_PATH.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
try:
    issues = {i["product_id"] for i in m.find_schema_issues()}
    print("camelcase_flagged", "prd_fixture_camelcase_only" in issues)
    print("perfume_exempt", "prd_perfume_fixture_5ml" not in issues)
finally:
    m.OVERRIDES_PATH.write_text(real, encoding="utf-8")
`;
  const result = spawnSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const lines = Object.fromEntries(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => line.split(" "))
  );
  assert.equal(lines.camelcase_flagged, "True");
  assert.equal(lines.perfume_exempt, "True");
});

test("a photo-less override missing required fields is not flagged (nothing to silently lose)", () => {
  const py = `
import sys, json
sys.path.insert(0, "scripts")
import check_override_schema as m

real = m.OVERRIDES_PATH.read_text(encoding="utf-8")
data = json.loads(real)
data["prd_fixture_no_photo"] = {"brand": "Fixture", "title": "Fixture no photo"}
m.OVERRIDES_PATH.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
try:
    issues = {i["product_id"] for i in m.find_schema_issues()}
    print("no_photo_flagged", "prd_fixture_no_photo" in issues)
finally:
    m.OVERRIDES_PATH.write_text(real, encoding="utf-8")
`;
  const result = spawnSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), "no_photo_flagged False");
});
