#!/usr/bin/env python3
from __future__ import annotations

import re
import sqlite3
import os
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "store.db"
NOTES_DIR = ROOT / "docs" / "products"
INDEX_PATH = NOTES_DIR / "index.md"

FEATURED_PRODUCT_IDS = [
    "prd_bfda1a27b81e",
    "prd_83037f3d35df",
    "prd_8d15b250f536",
    "prd_e9b3349a68aa",
    "prd_71d2d567002b",
    "prd_4180ad019486",
    "prd_060cfccd22d3",
]


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9а-яё]+", "-", value, flags=re.IGNORECASE)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "product"


def rel(path: str | None, from_dir: Path = NOTES_DIR) -> str:
    if not path:
        return ""
    target = ROOT / path
    return os.path.relpath(target, from_dir)


def related_images(image_id: str | None) -> list[str]:
    if not image_id:
        return []
    image_path = ROOT / image_id
    if not image_path.exists():
        return [image_id]
    stem = image_path.stem
    if stem.endswith("-front"):
        base = stem[: -len("-front")]
    else:
        base = stem
    return [path.relative_to(ROOT).as_posix() for path in sorted(image_path.parent.glob(f"{base}*.png"))]


def source_links(product_id: str) -> list[tuple[str, str]]:
    clear_root = ROOT / "assets" / "document_inbox" / "extracted" / "clear_3_products_images_and_descriptions-069f2765f1"
    downy_root = ROOT / "assets" / "document_inbox" / "extracted" / "downy_10_photos_clean_white_square_ORIGINAL_PIXELS_FINAL-d674d349e3"
    final_root = ROOT / "assets" / "document_inbox" / "extracted" / "shopfoto2-final"
    final_clear = final_root / "clear_beautified"
    final_downy = final_root / "downy_beautified"
    final_text = ROOT / "assets" / "document_inbox" / "extracted" / "shopfoto2-final" / "downy_beautified" / "downy_5_products_descriptions_from_original_photos.txt"
    shop_text = Path("/Users/macmini/shopfoto2/product_photos_final_package/products_text_descriptions_for_shop.txt")
    mapping = {
        "prd_bfda1a27b81e": [
            ("Исходное описание", clear_root / "clear_01_hair_fall_defence_coffee_description.txt"),
            ("Final package description", shop_text),
            ("Final front source", final_clear / "clear_product01_front.png"),
            ("Final back source", final_clear / "clear_product01_back.png"),
        ],
        "prd_83037f3d35df": [
            ("Исходное описание", clear_root / "clear_02_cool_sport_menthol_description.txt"),
            ("Final package description", shop_text),
            ("Final front source", final_clear / "clear_product02_front.png"),
            ("Final back source", final_clear / "clear_product02_back.png"),
        ],
        "prd_8d15b250f536": [
            ("Исходное описание", clear_root / "clear_03_legend_cr7_sea_salt_description.txt"),
            ("Final package description", shop_text),
            ("Final front source", final_clear / "clear_product03_front.png"),
            ("Final back source", final_clear / "clear_product03_back.png"),
        ],
        "prd_e9b3349a68aa": [
            ("Исходные описания Downy", clear_root / "downy_old_5_products_descriptions_from_original_photos.txt"),
            ("Final Downy descriptions", final_text),
            ("Final package description", shop_text),
            ("Final front source", final_downy / "downy_product01_front.png"),
            ("Final back source", final_downy / "downy_product01_back.png"),
            ("Final alt front source", final_downy / "downy_product02_front.png"),
            ("Final alt back source", final_downy / "downy_product02_back.png"),
        ],
        "prd_71d2d567002b": [
            ("Исходные описания Downy", clear_root / "downy_old_5_products_descriptions_from_original_photos.txt"),
            ("Final Downy descriptions", final_text),
            ("Final package description", shop_text),
            ("Final front source", final_downy / "downy_product03_front.png"),
            ("Final back source", final_downy / "downy_product03_back.png"),
        ],
        "prd_4180ad019486": [
            ("Исходные описания Downy", clear_root / "downy_old_5_products_descriptions_from_original_photos.txt"),
            ("Final Downy descriptions", final_text),
            ("Final package description", shop_text),
            ("Final front source", final_downy / "downy_product04_front.png"),
            ("Final back source", final_downy / "downy_product04_back.png"),
        ],
        "prd_060cfccd22d3": [
            ("Исходные описания Downy", clear_root / "downy_old_5_products_descriptions_from_original_photos.txt"),
            ("Final Downy descriptions", final_text),
            ("Final package description", shop_text),
            ("Final front source", final_downy / "downy_product05_front.png"),
            ("Final back source", final_downy / "downy_product05_back.png"),
        ],
    }
    links: list[tuple[str, str]] = []
    for label, path in mapping.get(product_id, []):
        if path.exists():
            links.append((label, os.path.relpath(path, NOTES_DIR)))
    return links


def note_text(row: sqlite3.Row, filename_by_id: dict[str, str]) -> str:
    images = related_images(row["image_id"])
    links = source_links(row["product_id"])
    brand_link = f"[[Бренд: {row['brand']}]]" if row["brand"] else ""
    category_link = f"[[Категория: {row['category_title']}]]" if row["category_title"] else ""
    related = []
    for other_id, filename in filename_by_id.items():
        if other_id == row["product_id"]:
            continue
        if row["brand"] and row["brand"].lower() in filename.lower():
            related.append(filename[:-3])

    lines = [
        "---",
        f"product_id: {row['product_id']}",
        f"source_id: {row['source_id']}",
        f"source_code: {row['source_code'] or ''}",
        f"brand: {row['brand'] or ''}",
        f"category: {row['category_title'] or ''}",
        f"status: {row['status']}",
        f"stock_quantity: {row['stock_quantity']}",
        f"base_price_usd: {row['base_price_usd']}",
        "---",
        "",
        f"# {row['clean_title']}",
        "",
        f"Связи: {brand_link} {category_link}".strip(),
        "",
        "## Карточка магазина",
        "",
        f"- Product ID: `{row['product_id']}`",
        f"- Код 1С: `{row['source_code'] or ''}`",
        f"- Сырьё 1С: `{row['raw_name']}`",
        f"- Группа 1С: `{row['raw_group']}`",
        f"- Бренд: `{row['brand'] or ''}`",
        f"- Тип: `{row['product_type'] or ''}`",
        f"- Остаток для менеджера: `{row['stock_quantity']}`",
        f"- Себестоимость USD: `{row['base_price_usd']}`",
        "",
        "## Описание",
        "",
        row["description"] or "",
        "",
    ]
    if images:
        lines.extend(["## Фото", ""])
        for image in images:
            path = rel(image)
            lines.append(f"- [{Path(image).name}]({path})")
        lines.append("")
        main_image = rel(row["image_id"])
        if main_image:
            lines.append(f"![Основное фото]({main_image})")
            lines.append("")
    if row["notes"]:
        lines.extend(["## Исходное распознавание", "", row["notes"], ""])
    if links:
        lines.extend(["## Источники", ""])
        for label, path in links:
            lines.append(f"- [{label}]({path})")
        lines.append("")
    if related:
        lines.extend(["## Связанные товары", ""])
        for title in sorted(related):
            lines.append(f"- [[{title}]]")
        lines.append("")
    lines.extend(
        [
            "## Статус проверки",
            "",
            "- [x] Фото добавлено",
            "- [x] Клиентское описание заполнено",
            "- [x] Исходное распознавание сохранено",
            "- [ ] Страна/batch/мелкий состав проверены вручную",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    NOTES_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    placeholders = ",".join("?" for _ in FEATURED_PRODUCT_IDS)
    rows = conn.execute(
        f"""
        select
          p.product_id, p.source_id, sp.source_code, sp.raw_name, sp.raw_group,
          p.status, p.clean_title, p.short_title, p.description, p.brand, p.product_type,
          p.image_id, p.notes, sp.base_price_usd, sp.stock_quantity, c.title as category_title
        from products p
        join source_products sp on sp.source_id = p.source_id
        left join product_categories pc on pc.product_id = p.product_id and pc.is_primary = 1
        left join categories c on c.category_id = pc.category_id
        where p.product_id in ({placeholders})
        order by p.brand, p.clean_title
        """,
        FEATURED_PRODUCT_IDS,
    ).fetchall()
    filename_by_id = {row["product_id"]: f"{slugify(row['clean_title'])}.md" for row in rows}

    written: list[tuple[str, str, str]] = []
    for row in rows:
        filename = filename_by_id[row["product_id"]]
        path = NOTES_DIR / filename
        path.write_text(note_text(row, filename_by_id), encoding="utf-8")
        written.append((row["brand"] or "", row["clean_title"], filename))

    index_lines = [
        "# Product Notes Index",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Прокачанные товары",
        "",
    ]
    for brand, title, filename in written:
        index_lines.append(f"- [[{filename[:-3]}]] - {brand} - {title}")
    index_lines.extend(
        [
            "",
            "## Отчёты",
            "",
            "- [Document inbox report](../../outputs/document_inbox_report.md)",
            "- [Shop photo inbox report](../../outputs/shop_photo_inbox_report.md)",
            "- [Catalog review CSV](../../outputs/catalog_review.csv)",
            "- [Catalog review XLSX](../../outputs/catalog_review.xlsx)",
            "",
        ]
    )
    INDEX_PATH.write_text("\n".join(index_lines), encoding="utf-8")
    print(f"wrote {len(written)} product notes to {NOTES_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
