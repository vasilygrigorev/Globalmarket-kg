#!/usr/bin/env python3
"""Mirror the second verified 2026-10-20 photo batch into opt."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


PUBLISHED_CODES = {
    "3296", "3297", "3295", "3292", "3291", "3302",
    "3304", "3305", "3306", "3308", "3307",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, payload: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def by_code(document: dict) -> dict[str, dict]:
    rows = {
        str(row["sourceCode"]): row
        for row in document.get("products", [])
        if row.get("sourceCode") not in (None, "")
    }
    expected = sum(
        row.get("sourceCode") not in (None, "")
        for row in document.get("products", [])
    )
    assert len(rows) == expected
    return rows


def absolute(path: str) -> str:
    return f"https://globalmarket.kg/{path.lstrip('/')}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--opt-root", required=True, type=Path)
    parser.add_argument("--retail-catalog", required=True, type=Path)
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--registry", required=True, type=Path)
    parser.add_argument("--photo-audit", required=True, type=Path)
    args = parser.parse_args()

    catalog_path = args.opt_root / "public/data/catalog.json"
    catalog = load(catalog_path)
    retail = load(args.retail_catalog)
    audit = load(args.photo_audit)
    opt_by_code = by_code(catalog)
    retail_by_code = by_code(retail)
    codes = [row["sourceCode"] for row in audit["publishedProducts"]]
    assert set(codes) == PUBLISHED_CODES

    before_hash = sha256(catalog_path)
    changed = []
    for code in codes:
        product = opt_by_code[code]
        retail_product = retail_by_code[code]
        assert not (product.get("galleryImages") or []), f"opt target already pictured: {code}"
        relative_gallery = retail_product.get("galleryImages") or []
        assert len(relative_gallery) == 3, f"retail gallery is incomplete: {code}"
        gallery = [absolute(path) for path in relative_gallery]
        product["image"] = gallery[0]
        product["galleryImages"] = gallery
        changed.append(
            {
                "sourceCode": code,
                "title": product["title"],
                "galleryImages": gallery,
            }
        )

    write(catalog_path, catalog)
    shutil.copy2(args.master, args.opt_root / "inventory/catalog-master.json")
    shutil.copy2(args.registry, args.opt_root / "inventory/product-photo-registry.json")
    result = {
        "release": "20261020-opt-petya-photo-update-v2",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourcePhotoRelease": audit["release"],
        "catalogSha256Before": before_hash,
        "catalogSha256After": sha256(catalog_path),
        "publishedProducts": changed,
        "publishedProductCount": len(changed),
        "publishedImageCount": len(changed) * 3,
        "pricesStockOrderGroupsAndAccountsIntendedUnchanged": True,
    }
    write(args.opt_root / "petya-photo-update-20261020-part2-audit.json", result)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
