// Fresh-arrivals (restockedAt) wiring inside scripts/import_stock.py — no
// network, no browser. scripts/freshness.py's restock_date() is unit-tested on
// its own (scripts/freshness_test.py); this file proves import_to_db() actually
// calls it correctly against a real temp sqlite DB across multiple import runs,
// the same way tests/import-stock-identity.test.mjs exercises
// resolve_import_source_id().
// Run: node --test tests/import-stock-freshness.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

// Shared harness: a temp sqlite DB + a helper to run one import with one item,
// returning both the replenishment date and immutable first-seen date.
const HARNESS = `
import sys, tempfile, os, json
sys.path.insert(0, "scripts")
import import_stock as m

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
m.DB_PATH = __import__("pathlib").Path(path)
fd2, src_path = tempfile.mkstemp(suffix=".mxl")
os.close(fd2)
src_path = __import__("pathlib").Path(src_path)
_call_counter = {"n": 0}

def item(qty, code="9999", name="Test Product", stock_date=None):
    return {
        "source_id": m.source_id(name, code),
        "source_code": code,
        "raw_name": name,
        "raw_group": "Без группы",
        "unit": "шт",
        "base_price_usd": 1.0,
        "stock_quantity": qty,
        "stock_amount_usd": qty * 1.0,
        "warehouse": "main",
        "stock_date": stock_date,
        "category_id": "other",
        "brand": "Test",
        "product_type": "test",
        "clean_title": name,
        "description": "test",
    }

def run_import(conn, qty, stock_date, code="9999", name="Test Product"):
    data = {
        "report_title": "test",
        "stock_date": stock_date,
        "warehouse": "main",
        "products": [item(qty, code, name, stock_date)],
    }
    # Each import run must hash unique source bytes: import_run_id derives from
    # the file hash + current second, and two calls in the same test can land
    # in the same wall-clock second.
    _call_counter["n"] += 1
    src_path.write_bytes(f"synthetic-{_call_counter['n']}".encode())
    m.import_to_db(conn, data, {}, src_path)
    row = conn.execute(
        "select restocked_at, first_seen_at, stock_quantity from source_products where source_code = ?",
        (m.normalize_source_code(code),),
    ).fetchone()
    return row["restocked_at"], row["first_seen_at"], row["stock_quantity"]

conn = m.connect_db()
`;

test("brand-new product gets restockedAt = the import's stock_date", () => {
  const out = py(`${HARNESS}
restocked_at, first_seen_at, qty = run_import(conn, 10, "2026-06-01")
print(restocked_at)
conn.close()
`);
  assert.equal(out, "2026-06-01");
});

test("re-import with unchanged quantity keeps the original restockedAt", () => {
  const out = py(`${HARNESS}
run_import(conn, 10, "2026-06-01")
restocked_at, first_seen_at, qty = run_import(conn, 10, "2026-07-06")
print(restocked_at)
conn.close()
`);
  assert.equal(out, "2026-06-01");
});

test("quantity increase on a later import updates restockedAt to that import's date", () => {
  const out = py(`${HARNESS}
run_import(conn, 10, "2026-06-01")
restocked_at, first_seen_at, qty = run_import(conn, 25, "2026-07-10")
print(restocked_at)
conn.close()
`);
  assert.equal(out, "2026-07-10");
});

test("a product dropped to 0 (missing from an import) then coming back gets the come-back date", () => {
  const out = py(`${HARNESS}
# First import: product present with qty 8.
run_import(conn, 8, "2026-06-01")

# Second import: the product is NOT in this import's product list at all,
# which is how import_to_db zeroes out anything missing (bulk UPDATE ... where
# source_id not in (...)).
data_without_it = {
    "report_title": "test",
    "stock_date": "2026-06-20",
    "warehouse": "main",
    "products": [item(5, code="OTHER", name="Other Product", stock_date="2026-06-20")],
}
_call_counter["n"] += 1
src_path.write_bytes(f"synthetic-{_call_counter['n']}".encode())
m.import_to_db(conn, data_without_it, {}, src_path)
zeroed = conn.execute(
    "select restocked_at, stock_quantity from source_products where source_id = ?",
    (m.source_id("Test Product", "9999"),),
).fetchone()
print("after_zero", zeroed["stock_quantity"], zeroed["restocked_at"])

# Third import: back in stock -> restockedAt should become this import's date,
# not stay stuck on the original 2026-06-01.
restocked_at, first_seen_at, qty = run_import(conn, 12, "2026-07-15")
print("after_restock", qty, restocked_at)
conn.close()
`);
  const lines = Object.fromEntries(
    out.split("\n").map((line) => {
      const [, tag, ...rest] = line.match(/^(\w+)\s+(.*)$/);
      return [tag, rest.join(" ")];
    }),
  );
  assert.equal(lines.after_zero, "0.0 2026-06-01", "dropping to 0 must not touch restockedAt");
  assert.equal(lines.after_restock, "12.0 2026-07-15", "coming back from 0 is a fresh arrival");
});

test("stable 1C code keeps firstSeenAt through rename, stock change, and restock", () => {
  const out = py(`${HARNESS}
restocked_at, first_seen_at, qty = run_import(conn, 10, "2026-06-01", code="1C-42", name="Old name")
print("first", first_seen_at)

# Same 1C code with an updated display name must resolve to the existing row.
restocked_at, first_seen_at, qty = run_import(conn, 25, "2026-07-10", code="1C-42", name="New improved name")
row = conn.execute(
    "select first_seen_at, stock_date from source_products where source_code = ?",
    (m.normalize_source_code("1C-42"),),
).fetchone()
print("after", row["first_seen_at"], row["stock_date"])
conn.close()
`);
  const lines = out.split("\n");
  assert.equal(lines[0], "first 2026-06-01");
  assert.equal(lines[1], "after 2026-06-01 2026-07-10");
});

test("freshness columns survive a schema migration on a pre-existing DB", () => {
  const out = py(`
import sys, tempfile, os, sqlite3
sys.path.insert(0, "scripts")
import import_stock as m

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
m.DB_PATH = __import__("pathlib").Path(path)

# Simulate a pre-guard DB: create source_products WITHOUT restocked_at (and
# without source_code, mirroring the original pre-migration shape).
conn = sqlite3.connect(path)
conn.execute(
    """
    create table source_products (
        source_id text primary key,
        raw_name text not null,
        raw_group text,
        unit text,
        base_price_usd real,
        stock_quantity real,
        stock_amount_usd real,
        warehouse text,
        stock_date text,
        last_imported_at text,
        source_file text,
        source_hash text
    )
    """
)
conn.commit()
conn.close()

# connect_db() must migrate this old table in place (same pattern as the
# existing source_code migration) without raising.
conn = m.connect_db()
cols = {row[1] for row in conn.execute("pragma table_info(source_products)").fetchall()}
print("restocked_at" in cols)
print("first_seen_at" in cols)
conn.close()
`);
  assert.equal(out, "True\nTrue");
});

test("build_public_catalog.py exposes stock arrival metadata", () => {
  const src = spawnSync("cat", ["scripts/build_public_catalog.py"], { cwd: ROOT, encoding: "utf8" }).stdout;
  assert.match(src, /PUBLIC_PRODUCT_FIELDS\s*=\s*\[[\s\S]*?"restockedAt"/);
  assert.match(src, /PUBLIC_PRODUCT_FIELDS\s*=\s*\[[\s\S]*?"firstSeenAt"/);
  assert.match(src, /"latestStockDate": source\.get\("latestStockDate"\)/);
});
