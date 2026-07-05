// Raw Petya photo triage guardrail — no network, no browser.
// scripts/report_raw_photo_groups.py must flag new loose/incomplete photo
// groups under assets/products/ root, while tolerating leftovers already
// written up in docs/pending-photo-review.md (e.g. the current Dove batch).
// Run: node --test tests/raw-photo-triage.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function runReport(args = []) {
  return spawnSync("python3", ["scripts/report_raw_photo_groups.py", "--json", ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

test("current documented Dove leftovers pass --strict (known, already triaged)", () => {
  const result = runReport(["--strict"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.undocumented_incomplete_groups, []);
  assert.deepEqual(report.undocumented_complete_groups, []);
});

test("a brand-new undocumented loose photo group fails --strict and is never deleted", () => {
  const py = `
import sys
sys.path.insert(0, "scripts")
import report_raw_photo_groups as m

fixture_names = [
    "telegram-0000000000-99999999-999999-fixture-card-front.jpg",
    "telegram-0000000000-99999999-999999-fixture-front.jpg",
]
paths = [m.PRODUCTS_DIR / name for name in fixture_names]
try:
    for path in paths:
        path.write_bytes(b"x")
    report = m.build_report()
    undocumented = [g["prefix"] for g in report["incomplete_groups"] if not g["documented"]]
    print("undocumented_prefix_found", any("fixture" in p for p in undocumented))
    print("files_still_exist", all(path.exists() for path in paths))
finally:
    for path in paths:
        path.unlink(missing_ok=True)
`;
  const result = spawnSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const lines = Object.fromEntries(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [key, value] = line.split(" ");
        return [key, value];
      })
  );
  assert.equal(lines.undocumented_prefix_found, "True");
  assert.equal(lines.files_still_exist, "True");
});

test("a group documented in pending-photo-review.md (by batch prefix) does not need every exact filename listed", () => {
  const py = `
import sys
sys.path.insert(0, "scripts")
import report_raw_photo_groups as m

review_text = "See telegram-1111111111-22222222-333333-{01,02}-* for details."
files = ["telegram-1111111111-22222222-333333-01-card-front.jpg"]
print(m.is_documented("telegram-1111111111-22222222-333333-01", files, review_text))
`;
  const result = spawnSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), "True");
});
