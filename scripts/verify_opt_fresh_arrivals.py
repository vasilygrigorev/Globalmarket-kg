#!/usr/bin/env python3
"""Fail a release when the opt fresh-arrivals contract is absent or stale."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import opt_fresh_arrivals as fresh  # noqa: E402


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--baseline-catalog", required=True, type=Path)
    parser.add_argument("--receipt-report", required=True, type=Path)
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--expected-base-group-count", type=int, default=16)
    parser.add_argument("--expected-fresh-count", type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    catalog = read_json(args.catalog)
    baseline = read_json(args.baseline_catalog)
    audit = read_json(args.audit)
    manifest = read_json(args.manifest)

    require(catalog.get("release") == args.release_id, "Catalog release ID is stale")
    require(audit.get("release") == args.release_id, "Fresh-arrivals audit is stale")
    require(manifest.get("release") == args.release_id, "Build manifest release ID is stale")
    require(catalog.get("products") == baseline.get("products"), "Product records changed")

    baseline_groups = [
        group for group in baseline["groups"] if group.get("id") != fresh.GROUP_ID
    ]
    base_groups = [
        group for group in catalog["groups"] if group.get("id") != fresh.GROUP_ID
    ]
    require(
        len(base_groups) == args.expected_base_group_count,
        "Unexpected number of base 1C groups",
    )
    require(base_groups == baseline_groups, "Base 1C groups or their order changed")
    require(len(catalog["groups"]) == len(base_groups) + 1, "Fresh group count is invalid")

    fresh_group = catalog["groups"][0]
    require(fresh_group.get("id") == fresh.GROUP_ID, "Fresh arrivals is not the first group")
    require(fresh_group.get("title") == fresh.GROUP_TITLE, "Fresh group title changed")
    require(fresh_group.get("virtual") is True, "Fresh group must be virtual")
    require(fresh_group.get("position") == -1, "Fresh group position must be -1")
    product_ids = fresh_group.get("productIds", [])
    require(bool(product_ids), "Fresh-arrivals group is empty")
    require(len(product_ids) == len(set(product_ids)), "Fresh-arrivals IDs are duplicated")
    if args.expected_fresh_count is not None:
        require(
            len(product_ids) == args.expected_fresh_count,
            f"Expected {args.expected_fresh_count} fresh products, found {len(product_ids)}",
        )

    all_product_ids = {product["id"] for product in catalog["products"]}
    base_product_ids = {
        product_id for group in base_groups for product_id in group.get("productIds", [])
    }
    require(set(product_ids) <= all_product_ids, "Fresh group references a missing product")
    require(
        set(product_ids) <= base_product_ids,
        "A fresh product was removed from its original 1C group",
    )
    products_by_id = {product["id"]: product for product in catalog["products"]}
    require(
        all(float(products_by_id[item].get("stockQuantity") or 0) > 0 for item in product_ids),
        "Fresh group contains a zero-stock product",
    )

    documents, report_period = fresh.parse_receipt_documents(args.receipt_report)
    selected, boundary = fresh.select_receipts(documents, report_period)
    expected_ids, expected_missing = fresh.expected_fresh_product_ids(catalog, selected)
    require(product_ids == expected_ids, "Fresh-arrivals set or order differs from the 1C rule")
    require(
        audit.get("activeProductIds") == expected_ids,
        "Fresh-arrivals audit IDs differ from the catalog",
    )
    require(
        audit.get("missingFromCurrentStock") == expected_missing,
        "Fresh-arrivals audit has stale missing-stock data",
    )
    require(
        audit.get("sourceReportSha256") == fresh.sha256(args.receipt_report),
        "Fresh-arrivals source hash is stale",
    )
    require(
        catalog.get("freshArrivals", {}).get("sourceReportSha256")
        == fresh.sha256(args.receipt_report),
        "Catalog fresh-arrivals metadata is stale",
    )
    require(
        catalog.get("freshArrivals", {}).get("activeProductCount") == len(expected_ids),
        "Catalog fresh-arrivals count is stale",
    )
    require(
        manifest.get("freshArrivalProductCount") == len(expected_ids),
        "Build manifest fresh-arrivals count is stale",
    )
    require(
        manifest.get("groupCount") == len(catalog["groups"]),
        "Build manifest group count is stale",
    )
    require(
        manifest.get("base1CGroupCount") == len(base_groups),
        "Build manifest base group count is stale",
    )
    photo_backed_products = sum(bool(product.get("image")) for product in catalog["products"])
    gallery_image_references = sum(
        len(product.get("galleryImages", [])) for product in catalog["products"]
    )
    require(
        manifest.get("productCount") == len(catalog["products"]),
        "Build manifest product count is stale",
    )
    require(
        manifest.get("photoBackedProducts") == photo_backed_products,
        "Build manifest photo-backed count is stale",
    )
    require(
        manifest.get("missingPhotoProducts")
        == len(catalog["products"]) - photo_backed_products,
        "Build manifest missing-photo count is stale",
    )
    require(
        manifest.get("galleryImageReferenceCount") == gallery_image_references,
        "Build manifest gallery-reference count is stale",
    )
    require(
        audit.get("algorithm", {}).get("largeReceiptUsd") == fresh.LARGE_RECEIPT_USD,
        "Large-receipt threshold changed",
    )
    require(
        audit.get("algorithm", {}).get("largeClusterGapDays")
        == fresh.LARGE_CLUSTER_GAP_DAYS,
        "Large-receipt cluster window changed",
    )
    require(
        audit.get("algorithm", {}).get("firstVirtualGroupRequired") is True,
        "Mandatory-first-group release gate is absent",
    )
    require(boundary is not None, "Expected an excluded large-receipt boundary")
    require(
        audit.get("previousExcludedLargeReceipt", {}).get("number") == boundary["number"],
        "Boundary document in audit is stale",
    )

    protected_top_level = set(baseline) - {"release", "generatedAt", "groups"}
    for key in protected_top_level:
        require(catalog.get(key) == baseline.get(key), f"Protected catalog field changed: {key}")

    print(
        json.dumps(
            {
                "verified": True,
                "release": args.release_id,
                "productCount": len(catalog["products"]),
                "baseGroupCount": len(base_groups),
                "freshProductCount": len(product_ids),
                "selectedDocuments": [
                    f"{item['date']} {item['number']}" for item in selected
                ],
                "boundary": f"{boundary['date']} {boundary['number']}",
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
