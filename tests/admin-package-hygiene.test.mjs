// Admin package hygiene contract — no network, no browser.
// Guards, at the source level, that the deploy packager never ships admin test
// files or the config template, and that the package verifier forbids the config
// templates. This complements the runtime verify_static_package check by locking
// the exclusion rules so a future refactor can't silently start shipping them.
// Run: node --test tests/admin-package-hygiene.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const packager = read("scripts/package_static_site.py");
const verifier = read("scripts/verify_static_package.py");

test("packager copies admin but excludes example/test/spec files", () => {
  // The admin copy_tree call must carry an exclude set for these globs.
  const adminCopy = packager.match(/copy_tree\(\s*ROOT \/ "admin"[\s\S]*?\)/);
  assert.ok(adminCopy, "admin copy_tree call not found in packager");
  const src = adminCopy[0];
  for (const glob of ["*.example.*", "*.test.*", "*.spec.*"]) {
    assert.ok(src.includes(glob), `admin copy must exclude ${glob}`);
  }
});

test("package verifier forbids admin config templates", () => {
  assert.match(verifier, /admin\/config\.example\.js/);
  assert.match(verifier, /Forbidden admin config\/template leaked/);
});

test("package verifier requires the three admin runtime files", () => {
  for (const rel of ["admin/index.html", "admin/admin.js", "admin/admin.logic.js"]) {
    assert.ok(verifier.includes(rel), `verifier must require ${rel}`);
  }
});
