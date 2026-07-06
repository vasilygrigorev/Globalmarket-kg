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

// The two tests above only check source_id() in isolation and that
// resolve_import_source_id() exists with the right shape — neither actually
// exercises it against a database. That's the part that matters in practice
// (no real MXL import has hit a genuinely-new 1C code since this scheme
// shipped, so this path has only ever run against synthetic data). These
// tests build a real temp sqlite DB with import_stock.py's own schema and
// call the real function against it.
test("resolve_import_source_id reuses an existing legacy source_id when the 1C name changes, preferring the photographed row", () => {
  const output = py(`
import sys, tempfile, os
sys.path.insert(0, "scripts")
import import_stock as m

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
m.DB_PATH = __import__("pathlib").Path(path)
try:
    conn = m.connect_db()
    now = "2026-01-01T00:00:00+00:00"
    # Legacy row: imported before the 1C-code scheme, so its source_id is a
    # raw-name hash even though a source_code is already recorded.
    conn.execute(
        "insert into source_products(source_id, source_code, raw_name, unit, last_imported_at) values (?,?,?,?,?)",
        ("src_legacyhash1", "9001", "Old Product Name", "шт", now),
    )
    conn.execute(
        "insert into products(product_id, source_id, raw_name_snapshot, status, visibility, image_id, created_at, updated_at) values (?,?,?,?,?,?,?,?)",
        ("prd_legacyhash1", "src_legacyhash1", "Old Product Name", "active", "storefront", "assets/products/brand/old-card-front.jpg", now, now),
    )
    conn.commit()

    # Fresh MXL row for the SAME 1C code, but the name changed (scent/variant
    # update) — source_id() alone would compute a brand-new src_1c_9001 id.
    item = {"source_id": m.source_id("New Product Name", "9001"), "source_code": "9001"}
    resolved = m.resolve_import_source_id(conn, item)
    print("resolved_to_legacy", resolved == "src_legacyhash1")
    print("not_a_new_id", resolved != "src_1c_9001")
finally:
    conn.close()
    if os.path.exists(path):
        os.unlink(path)
`);
  const lines = Object.fromEntries(output.split("\n").map((line) => line.split(" ")));
  assert.equal(lines.resolved_to_legacy, "True");
  assert.equal(lines.not_a_new_id, "True");
});

test("resolve_import_source_id keeps the fresh src_1c_<code> id for a genuinely new 1C code", () => {
  const output = py(`
import sys, tempfile, os
sys.path.insert(0, "scripts")
import import_stock as m

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
m.DB_PATH = __import__("pathlib").Path(path)
try:
    conn = m.connect_db()
    item = {"source_id": m.source_id("Brand New Product", "424242"), "source_code": "424242"}
    resolved = m.resolve_import_source_id(conn, item)
    print(resolved)
finally:
    conn.close()
    if os.path.exists(path):
        os.unlink(path)
`);
  assert.equal(output, "src_1c_424242");
});

test("resolve_import_source_id prefers the photographed row when the same code exists under two legacy ids", () => {
  const output = py(`
import sys, tempfile, os
sys.path.insert(0, "scripts")
import import_stock as m

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
m.DB_PATH = __import__("pathlib").Path(path)
try:
    conn = m.connect_db()
    now = "2026-01-01T00:00:00+00:00"
    # Same source_code recorded under two different legacy source_ids (a
    # historical data-quality wrinkle) — one has a photo, one does not.
    conn.execute(
        "insert into source_products(source_id, source_code, raw_name, unit, last_imported_at) values (?,?,?,?,?)",
        ("src_nophoto", "7777", "Some Name", "шт", now),
    )
    conn.execute(
        "insert into products(product_id, source_id, raw_name_snapshot, status, visibility, image_id, created_at, updated_at) values (?,?,?,?,?,?,?,?)",
        ("prd_nophoto", "src_nophoto", "Some Name", "review", "storefront", None, now, now),
    )
    conn.execute(
        "insert into source_products(source_id, source_code, raw_name, unit, last_imported_at) values (?,?,?,?,?)",
        ("src_hasphoto", "7777", "Some Name Variant", "шт", now),
    )
    conn.execute(
        "insert into products(product_id, source_id, raw_name_snapshot, status, visibility, image_id, created_at, updated_at) values (?,?,?,?,?,?,?,?)",
        ("prd_hasphoto", "src_hasphoto", "Some Name Variant", "active", "storefront", "assets/products/brand/card-front.jpg", now, now),
    )
    conn.commit()

    item = {"source_id": m.source_id("Yet Another Name", "7777"), "source_code": "7777"}
    resolved = m.resolve_import_source_id(conn, item)
    print(resolved)
finally:
    conn.close()
    if os.path.exists(path):
        os.unlink(path)
`);
  assert.equal(output, "src_hasphoto");
});
