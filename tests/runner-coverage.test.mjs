// Meta-test: every Node test file is wired into scripts/verify_backend_mvp.py
// so a new test can't be silently left out of the preflight. No network.
// Run: node --test tests/runner-coverage.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const runner = readFileSync(join(ROOT, "scripts/verify_backend_mvp.py"), "utf8");

function testFiles(relDir) {
  let names = [];
  try {
    names = readdirSync(join(ROOT, relDir));
  } catch {
    return [];
  }
  return names.filter((n) => n.endsWith(".test.mjs")).map((n) => `${relDir}/${n}`);
}

const allTests = [
  ...testFiles("functions/api"),
  ...testFiles("admin"),
  ...testFiles("tests"),
];

test("there is at least one test file to check", () => {
  assert.ok(allTests.length >= 6, `expected several test files, found ${allTests.length}`);
});

test("every test file is referenced in verify_backend_mvp.py", () => {
  const missing = allTests.filter((rel) => !runner.includes(rel));
  assert.deepEqual(missing, [], `test files not wired into the preflight runner: ${missing.join(", ")}`);
});
