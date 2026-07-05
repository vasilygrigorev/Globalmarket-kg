#!/usr/bin/env python3
"""Small photo-shooting priority report for Global Market KG.

Read-only, no network. Combines the existing coverage numbers from
report_photo_coverage.py with a simple "top in-stock, no-photo products by
stock value" query against data/store.db, so a human deciding what to shoot
next doesn't have to run two scripts and cross-reference by hand.

Usage:
    python3 scripts/report_photo_priority.py            # human-readable
    python3 scripts/report_photo_priority.py --json      # machine-readable
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import report_photo_coverage as coverage  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "store.db"


def lowest_coverage_categories(by_category, limit=5):
    ranked = []
    for name, entry in by_category.items():
        total = entry["total"]
        if not total:
            continue
        percent = round(100 * entry["with_photos"] / total, 1)
        ranked.append({"category": name, "with_photos": entry["with_photos"], "total": total, "percent": percent})
    ranked.sort(key=lambda item: (item["percent"], -item["total"]))
    return ranked[:limit]


def top_no_photo_by_value(limit=20):
    if not DB_PATH.exists():
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            select sp.raw_name, sp.stock_amount_usd, sp.source_code, c.title as category
            from products p
            join source_products sp on sp.source_id = p.source_id
            left join product_categories pc on pc.product_id = p.product_id and pc.is_primary = 1
            left join categories c on c.category_id = pc.category_id
            where p.visibility = 'storefront' and sp.stock_quantity > 0
              and (p.image_id is null or p.image_id = '')
            order by sp.stock_amount_usd desc
            limit ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def build_report():
    products = json.loads(coverage.CATALOG.read_text(encoding="utf-8")).get("products", [])
    coverage_report = coverage.build_report(products)
    return {
        "total_products": coverage_report["total_products"],
        "with_photos": coverage_report["with_photos"],
        "coverage_percent": coverage_report["coverage_percent"],
        "lowest_coverage_categories": lowest_coverage_categories(coverage_report["by_category"]),
        "top_no_photo_by_value": top_no_photo_by_value(),
    }


def print_report(report):
    print("Global Market KG — photo shooting priority")
    print(f"  Coverage: {report['with_photos']}/{report['total_products']} = {report['coverage_percent']}%")
    print("  Lowest-coverage categories:")
    for entry in report["lowest_coverage_categories"]:
        print(f"    {entry['category']}: {entry['with_photos']}/{entry['total']} ({entry['percent']}%)")
    print("  Top in-stock, no-photo products by stock value (USD):")
    for row in report["top_no_photo_by_value"]:
        amount = row["stock_amount_usd"] or 0.0
        print(f"    {amount:>10.2f}  {row['category'] or '(no category)':<25} {row['raw_name']} (code={row['source_code']})")


def main():
    parser = argparse.ArgumentParser(description="Photo shooting priority report.")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text.")
    args = parser.parse_args()

    report = build_report()
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
