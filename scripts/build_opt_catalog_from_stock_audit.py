#!/usr/bin/env python3
"""Build the protected opt catalog from an audited XLSX stock import."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path


RETAIL_ORIGIN = "https://globalmarket.kg"
KGS_USD_DIVISOR = 0.0111
EXPECTED_BASE_GROUPS = 16


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize_spaces(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def absolute_asset(value: object) -> str:
    path = str(value or "").strip()
    if not path:
        return ""
    if path.startswith(("https://", "http://", "data:")):
        return path
    return f"{RETAIL_ORIGIN}/{path.lstrip('/')}"


def write_json(path: Path, payload: object, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":") if compact else None,
            indent=None if compact else 2,
        )
        + "\n",
        encoding="utf-8",
    )


def build_catalog(audit: dict, master: dict, release_id: str) -> tuple[dict, dict]:
    stock_date = audit["stockDate"]
    stock_rows = audit["products"]
    master_products = master.get("products") or []
    master_by_code = {
        str(product["sourceCode"]): product
        for product in master_products
        if product.get("sourceCode") not in (None, "")
    }
    if len(master_by_code) != sum(
        product.get("sourceCode") not in (None, "") for product in master_products
    ):
        raise RuntimeError("Persistent catalog master contains duplicate sourceCode values")

    stock_codes = [str(row["sourceCode"]) for row in stock_rows]
    if len(stock_codes) != len(set(stock_codes)):
        raise RuntimeError("Audited stock contains duplicate stable sourceCode values")
    missing_master = [code for code in stock_codes if code not in master_by_code]
    if missing_master:
        raise RuntimeError(f"Stock codes missing from persistent master: {missing_master}")

    groups: list[dict] = []
    group_by_title: dict[str, dict] = {}
    products: list[dict] = []
    for position, stock in enumerate(stock_rows):
        code = str(stock["sourceCode"])
        source = master_by_code[code]
        if source.get("status") != "active" or source.get("inStock") is not True:
            raise RuntimeError(f"Active stock row is inactive in master: {code}")
        if float(source.get("stockQuantity") or 0) != float(stock["stockQuantity"]):
            raise RuntimeError(f"Stock quantity differs from master: {code}")

        group_title = stock["group1C"]
        if group_title not in group_by_title:
            group = {
                "id": f"group-{len(groups) + 1:02d}",
                "title": group_title,
                "position": len(groups),
                "productIds": [],
            }
            groups.append(group)
            group_by_title[group_title] = group

        image = absolute_asset(source.get("image"))
        gallery = [
            absolute_asset(item)
            for item in source.get("galleryImages") or []
            if absolute_asset(item)
        ]
        if image and image not in gallery:
            gallery.insert(0, image)
        title = source.get("title") or stock["name1C"]
        description = source.get("description") or f"{title}. Товар из актуальных остатков 1С."
        product_id = f"1c-{code}"
        price_usd = round(float(stock["costUsd"]), 4)
        product = {
            "id": product_id,
            "sourceCode": code,
            "position": position,
            "groupId": group_by_title[group_title]["id"],
            "group1C": group_title,
            "name1C": stock["name1C"],
            "rawName1C": stock["rawName1C"],
            "title": title,
            "description": description,
            "brand": source.get("brand") or "",
            "productType": source.get("productType") or "",
            "unit": stock.get("unit") or source.get("unit") or "шт",
            "stockQuantity": stock["stockQuantity"],
            "priceUsd": price_usd,
            "priceKgs": round(price_usd / KGS_USD_DIVISOR, 2),
            "image": image,
            "galleryImages": gallery,
            "isNew": source.get("firstSeenAt") == stock_date,
            "firstSeenAt": source.get("firstSeenAt"),
            "searchText": normalize_spaces(
                " ".join(
                    str(value or "")
                    for value in (
                        code,
                        stock["name1C"],
                        stock["rawName1C"],
                        title,
                        source.get("brand"),
                        source.get("productType"),
                        group_title,
                    )
                )
            ).lower(),
        }
        products.append(product)
        group_by_title[group_title]["productIds"].append(product_id)

    if len(groups) != EXPECTED_BASE_GROUPS:
        raise RuntimeError(f"Expected {EXPECTED_BASE_GROUPS} base groups, found {len(groups)}")
    base_ids = [product_id for group in groups for product_id in group["productIds"]]
    if base_ids != [product["id"] for product in products]:
        raise RuntimeError("Base group order differs from the audited 1C order")

    generated_at = datetime.now(timezone.utc).isoformat()
    catalog = {
        "release": release_id,
        "generatedAt": generated_at,
        "stockDate": stock_date,
        "priceMode": "account-scoped-exact-1c-usd-or-usd-divided-by-0.0111-kgs",
        "inventoryPolicy": "positive-stock-only-from-append-only-master",
        "groups": groups,
        "products": products,
    }
    manifest = {
        "release": release_id,
        "generatedAt": generated_at,
        "stockDate": stock_date,
        "productCount": len(products),
        "base1CGroupCount": len(groups),
        "groupCount": len(groups),
        "catalogMasterRecords": len(master_products),
        "catalogMasterInactiveRecords": sum(
            bool(product.get("sourceCode")) and product.get("status") != "active"
            for product in master_products
        ),
        "photoBackedProducts": sum(bool(product.get("image")) for product in products),
        "missingPhotoProducts": sum(not bool(product.get("image")) for product in products),
        "galleryImageReferenceCount": sum(len(product["galleryImages"]) for product in products),
        "newProducts": sum(bool(product.get("isNew")) for product in products),
        "stockAuditSha256": None,
        "pricing": {
            "sourceUsd": "exact 1C USD",
            "defaultKgs": "source USD divided by 0.0111 with no markup",
            "accountOverrides": "enforced by the existing authenticated Worker",
        },
        "ordering": "Exact positive-stock product and group order from the audited 1C XLSX",
        "excludedServiceSourceCodes": ["2322"],
        "inventoryLifecycle": (
            "Only positive-stock rows are published. Missing cards remain in the append-only "
            "master and recover their saved presentation on the next positive stock import."
        ),
        "productionRetailTouched": False,
    }
    return catalog, manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stock-audit", required=True, type=Path)
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--catalog-output", required=True, type=Path)
    parser.add_argument("--manifest-output", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    args = parser.parse_args()

    audit = json.loads(args.stock_audit.read_text(encoding="utf-8"))
    master = json.loads(args.master.read_text(encoding="utf-8"))
    catalog, manifest = build_catalog(audit, master, args.release_id)
    manifest["stockAuditSha256"] = sha256(args.stock_audit)
    write_json(args.catalog_output, catalog, compact=True)
    write_json(args.manifest_output, manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
