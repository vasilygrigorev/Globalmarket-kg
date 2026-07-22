#!/usr/bin/env python3
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from import_stock import generate_outputs, load_settings


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "store.db"
OVERRIDES_PATH = ROOT / "data" / "product_overrides.json"


def main():
    overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    now = datetime.now(timezone.utc).isoformat()
    applied = 0
    missing = []

    for product_id, values in overrides.items():
        required = ("clean_title", "description", "brand", "product_type")
        if any(key not in values for key in required):
            continue

        notes_value = values.get("notes")
        if isinstance(notes_value, list):
            notes_text = "\n".join(str(item) for item in notes_value)
        elif notes_value is None:
            notes_text = ""
        else:
            notes_text = str(notes_value)

        product = conn.execute("select product_id from products where product_id = ?", (product_id,)).fetchone()
        if not product:
            missing.append(product_id)
            continue

        visibility = values.get("visibility")
        if visibility not in {None, "storefront", "hidden"}:
            raise SystemExit(f"{product_id}: unsupported visibility override {visibility!r}")

        conn.execute(
            """
            update products
            set clean_title = ?,
                short_title = ?,
                description = ?,
                brand = ?,
                product_type = ?,
                image_id = ?,
                notes = ?,
                status = 'active',
                visibility = coalesce(?, visibility),
                search_text = lower(?),
                updated_at = ?
            where product_id = ?
            """,
            (
                values["clean_title"],
                values.get("short_title") or values["clean_title"],
                values["description"],
                values["brand"],
                values["product_type"],
                values.get("image"),
                notes_text,
                visibility,
                " ".join(
                    [
                        values["clean_title"],
                        values.get("short_title") or "",
                        values["brand"],
                        values["product_type"],
                        values["description"],
                        notes_text,
                    ]
                ),
                now,
                product_id,
            ),
        )

        category_id = values.get("category_id")
        if category_id:
            conn.execute("update product_categories set is_primary = 0 where product_id = ?", (product_id,))
            conn.execute(
                """
                insert into product_categories(product_id, category_id, is_primary, sort_order)
                values(?, ?, 1, 0)
                on conflict(product_id, category_id) do update set is_primary = 1
                """,
                (product_id, category_id),
            )
        applied += 1

    conn.commit()
    output_summary = generate_outputs(conn, load_settings())
    print(json.dumps({"applied": applied, "missing": missing, **output_summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
