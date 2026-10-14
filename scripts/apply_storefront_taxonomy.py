#!/usr/bin/env python3
"""Apply canonical brands and storefront sections without touching inventory.

This migration is intentionally narrow: stock, prices, freshness, photos,
stable URLs and product identity are protected by a field-level diff guard.
It can be rerun after every 1C recovery and against the persistent Dropbox
master so future restocks keep the same taxonomy.
"""

import argparse
import copy
import json
from datetime import datetime, timezone
from pathlib import Path

from classify_taxonomy import canonical_brand, enrich


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MASTER = Path(
    "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/catalog-master.json"
)
DEFAULT_CATALOGS = [ROOT / "data/page-catalog.json", ROOT / "data/public-catalog.json"]
TAXONOMY_VERSION = "2026-10-14-storefront-sections-v1"
ALLOWED_PRODUCT_FIELDS = {
    "brand",
    "productKind",
    "audience",
    "attributes",
    "form",
    "useArea",
    "searchTerms",
    "searchText",
    "sectionIds",
    "sectionLabels",
}


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path, payload):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def search_text(product):
    fields = (
        "title",
        "brand",
        "productType",
        "category",
        "description",
        "sourceName1C",
        "sourceRawName1C",
    )
    return " ".join(str(product.get(field)) for field in fields if product.get(field)).lower()


def migrate_product(product):
    before = copy.deepcopy(product)
    result = copy.deepcopy(product)
    result["brand"] = canonical_brand(result)
    result.update(enrich(result))
    result["searchText"] = search_text(result)

    changed_fields = {
        key
        for key in set(before) | set(result)
        if before.get(key) != result.get(key)
    }
    forbidden = changed_fields - ALLOWED_PRODUCT_FIELDS
    if forbidden:
        identity = result.get("sourceCode") or result.get("id") or "unknown"
        raise RuntimeError(f"taxonomy migration changed protected fields for {identity}: {sorted(forbidden)}")
    return result, changed_fields


def migrate_document(path):
    document = load_json(path)
    brand_changes = 0
    section_changes = 0
    changed_products = 0
    products = []

    for product in document.get("products") or []:
        migrated, changed_fields = migrate_product(product)
        products.append(migrated)
        if changed_fields:
            changed_products += 1
        if "brand" in changed_fields:
            brand_changes += 1
        if {"sectionIds", "sectionLabels"} & changed_fields:
            section_changes += 1

    document["products"] = products
    now = datetime.now(timezone.utc).isoformat()
    if path.name == "catalog-master.json":
        document["updatedAt"] = now
    else:
        document["generatedAt"] = now
    document["taxonomyVersion"] = TAXONOMY_VERSION
    write_json_atomic(path, document)
    return changed_products, brand_changes, section_changes


def main():
    parser = argparse.ArgumentParser(description="Apply durable retail storefront taxonomy.")
    parser.add_argument(
        "--catalog",
        action="append",
        dest="catalogs",
        help="Catalog JSON to migrate. Repeat for multiple files; defaults to page + public catalogs.",
    )
    parser.add_argument(
        "--master",
        nargs="?",
        const=str(DEFAULT_MASTER),
        help="Also migrate the persistent catalog master (optional path).",
    )
    args = parser.parse_args()

    paths = [Path(value).expanduser().resolve() for value in (args.catalogs or DEFAULT_CATALOGS)]
    if args.master:
        paths.append(Path(args.master).expanduser().resolve())

    for path in paths:
        if not path.exists():
            raise SystemExit(f"Catalog not found: {path}")
        changed, brands, sections = migrate_document(path)
        print(f"{path}: products={changed}, brands={brands}, sections={sections}")


if __name__ == "__main__":
    main()
