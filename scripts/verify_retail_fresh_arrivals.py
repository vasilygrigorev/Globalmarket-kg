#!/usr/bin/env python3
"""Verify retail/opt fresh-arrivals parity without unrelated catalog drift."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

import apply_retail_fresh_arrivals as retail_fresh


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def without_fresh_fields(catalog: dict) -> dict:
    result = copy.deepcopy(catalog)
    for product in result.get("products", []):
        for field in retail_fresh.FRESH_FIELDS:
            product.pop(field, None)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("parent_catalog", type=Path)
    parser.add_argument("candidate_catalog", type=Path)
    parser.add_argument("opt_catalog", type=Path)
    parser.add_argument("app_js", type=Path)
    parser.add_argument("--expected-count", type=int)
    args = parser.parse_args()

    parent = load_json(args.parent_catalog)
    candidate = load_json(args.candidate_catalog)
    opt = load_json(args.opt_catalog)
    if without_fresh_fields(candidate) != without_fresh_fields(parent):
        raise SystemExit("Retail catalog changed outside fresh-arrival fields")

    expected_codes = retail_fresh.fresh_source_codes(opt)
    actual = sorted(
        (
            product
            for product in candidate.get("products", [])
            if product.get("freshArrival") is True
        ),
        key=lambda product: int(product.get("freshArrivalRank", 10**9)),
    )
    actual_codes = [str(product.get("sourceCode")) for product in actual]
    if actual_codes != expected_codes:
        raise SystemExit("Retail fresh-arrival set or order does not match opt")
    if args.expected_count is not None and len(actual_codes) != args.expected_count:
        raise SystemExit(
            f"Expected {args.expected_count} retail fresh products, got {len(actual_codes)}"
        )
    if any(
        product.get("status") != "active"
        or product.get("inStock") is not True
        or (
            product.get("stockQuantity") is not None
            and float(product.get("stockQuantity")) <= 0
        )
        for product in actual
    ):
        raise SystemExit("Retail fresh arrivals include unavailable products")

    app_source = args.app_js.read_text(encoding="utf-8")
    required = (
        "function freshProducts(limit = Number.POSITIVE_INFINITY)",
        'product.freshArrival === true',
        "freshArrivalRank",
    )
    missing = [fragment for fragment in required if fragment not in app_source]
    if missing:
        raise SystemExit(f"Retail app.js is missing fresh-arrival logic: {missing}")

    print(
        json.dumps(
            {
                "verified": True,
                "freshProductCount": len(actual_codes),
                "firstSourceCode": actual_codes[0],
                "lastSourceCode": actual_codes[-1],
                "retailProductCount": len(candidate.get("products", [])),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
