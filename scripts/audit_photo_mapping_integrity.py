#!/usr/bin/env python3
"""Audit product photo mappings after stock imports.

The store keeps polished photo/title overrides in data/product_overrides.json.
Those overrides are keyed by product_id. Regular 1C product_id values are
derived from the raw 1C product name, so a name change can create a new visible
product while the old photographed product becomes hidden with stock=0. This
script reports that situation before it reaches the storefront unnoticed.
"""

import argparse
import difflib
import json
import re
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "public-catalog.json"
DB_PATH = ROOT / "data" / "store.db"
MANUAL_PRODUCTS_PATH = ROOT / "data" / "manual_products.json"
OVERRIDES_PATH = ROOT / "data" / "product_overrides.json"
ALLOWLIST_PATH = ROOT / "data" / "photo_mapping_allowlist.json"


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(text):
    text = str(text or "").lower().replace("ё", "е")
    text = re.sub(r"[^a-zа-я0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def has_photo(payload):
    gallery = payload.get("galleryImages") or []
    return bool(payload.get("image") or gallery)


def override_entries():
    payload = load_json(OVERRIDES_PATH, {})
    if isinstance(payload, dict) and "products" not in payload:
        return [dict(values, product_id=product_id) for product_id, values in payload.items()]
    if isinstance(payload, dict):
        return payload.get("products", [])
    return payload


def public_products():
    return load_json(CATALOG_PATH, {}).get("products", [])


def manual_product_ids():
    return {product.get("id") for product in load_json(MANUAL_PRODUCTS_PATH, {}).get("products", []) if product.get("id")}


def db_product_ids():
    if not DB_PATH.exists():
        return set()
    conn = sqlite3.connect(DB_PATH)
    try:
        return {row[0] for row in conn.execute("select product_id from products")}
    finally:
        conn.close()


def title_of(payload):
    return (
        payload.get("clean_title")
        or payload.get("title")
        or payload.get("short_title")
        or payload.get("rawName")
        or payload.get("raw_name")
        or ""
    )


def searchable_text(payload):
    return " ".join(
        str(part or "")
        for part in (
            title_of(payload),
            payload.get("brand"),
            payload.get("productType") or payload.get("product_type"),
            payload.get("category") or payload.get("category_id"),
            payload.get("searchText") or payload.get("search_text"),
        )
    )


def candidate_score(left, right):
    left_brand = normalize(left.get("brand"))
    right_brand = normalize(right.get("brand"))
    if left_brand and right_brand and left_brand not in right_brand and right_brand not in left_brand:
        return 0
    brand_bonus = 0.12 if left_brand and left_brand == right_brand else 0
    type_left = normalize(left.get("product_type") or left.get("productType"))
    type_right = normalize(right.get("productType") or right.get("product_type"))
    type_bonus = 0.08 if type_left and type_right and (type_left in type_right or type_right in type_left) else 0
    title_ratio = difflib.SequenceMatcher(None, normalize(title_of(left)), normalize(title_of(right))).ratio()
    search_ratio = difflib.SequenceMatcher(None, normalize(searchable_text(left)), normalize(searchable_text(right))).ratio()
    return min(1.0, max(title_ratio, search_ratio) + brand_bonus + type_bonus)


def best_candidates(override, products, limit=3):
    candidates = []
    for product in products:
        if has_photo(product):
            continue
        score = candidate_score(override, product)
        if score >= 0.48:
            candidates.append(
                {
                    "product_id": product.get("id"),
                    "title": product.get("title"),
                    "brand": product.get("brand"),
                    "category_id": product.get("categoryId"),
                    "score": round(score, 3),
                }
            )
    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:limit]


def audit():
    products = public_products()
    public_ids = {product.get("id") for product in products}
    active_ids = db_product_ids() | manual_product_ids() | public_ids
    allowlist = load_json(ALLOWLIST_PATH, {})
    allowed_hidden = set((allowlist.get("known_hidden_photo_overrides") or {}).keys())
    allowed_external = set((allowlist.get("known_external_override_ids") or {}).keys())

    hidden_photo_overrides = []
    missing_photo_overrides = []
    suspected_lost_mappings = []
    unexpected_missing = []

    for override in override_entries():
        product_id = override.get("product_id") or override.get("id")
        if not product_id or not has_photo(override):
            continue

        entry = {
            "product_id": product_id,
            "title": title_of(override),
            "image": override.get("image") or (override.get("galleryImages") or [""])[0],
            "candidates": [],
        }

        if product_id not in active_ids:
            missing_photo_overrides.append(entry)
            if product_id not in allowed_external:
                unexpected_missing.append(entry)
            continue

        if product_id not in public_ids:
            entry["candidates"] = best_candidates(override, products)
            hidden_photo_overrides.append(entry)
            if product_id not in allowed_hidden and entry["candidates"]:
                suspected_lost_mappings.append(entry)

    return {
        "public_products": len(products),
        "photo_overrides": sum(1 for entry in override_entries() if has_photo(entry)),
        "hidden_photo_overrides": hidden_photo_overrides,
        "missing_photo_overrides": missing_photo_overrides,
        "suspected_lost_photo_mappings": suspected_lost_mappings,
        "unexpected_missing_photo_overrides": unexpected_missing,
    }


def print_report(report):
    print(f"Public products: {report['public_products']}")
    print(f"Photo overrides: {report['photo_overrides']}")
    print(f"Hidden photographed overrides: {len(report['hidden_photo_overrides'])}")
    print(f"Missing photographed overrides: {len(report['missing_photo_overrides'])}")
    print(f"Suspected lost photo mappings: {len(report['suspected_lost_photo_mappings'])}")
    print(f"Unexpected missing photographed overrides: {len(report['unexpected_missing_photo_overrides'])}")

    for section in ("suspected_lost_photo_mappings", "unexpected_missing_photo_overrides"):
        if not report[section]:
            continue
        print(f"\n{section}:")
        for item in report[section]:
            print(f"- {item['product_id']} {item['title']} -> {item['image']}")
            for candidate in item.get("candidates") or []:
                print(f"  candidate {candidate['score']}: {candidate['product_id']} {candidate['title']}")


def main():
    parser = argparse.ArgumentParser(description="Audit photo override mappings after 1C stock imports.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    parser.add_argument("--strict", action="store_true", help="Fail when unallowlisted photo mapping issues exist.")
    args = parser.parse_args()

    report = audit()
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_report(report)

    if args.strict and (report["suspected_lost_photo_mappings"] or report["unexpected_missing_photo_overrides"]):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
