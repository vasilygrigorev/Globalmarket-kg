#!/usr/bin/env python3
"""Copy the verified opt fresh-arrivals order into a retail public catalog."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


FRESH_GROUP_ID = "group-fresh-arrivals"
FRESH_FIELDS = ("freshArrival", "freshArrivalRank")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def fresh_source_codes(opt_catalog: dict) -> list[str]:
    group = next(
        (
            item
            for item in opt_catalog.get("groups", [])
            if item.get("id") == FRESH_GROUP_ID
        ),
        None,
    )
    if not group:
        raise RuntimeError(f"Opt catalog has no {FRESH_GROUP_ID} group")

    product_ids = group.get("productIds") or []
    expected_count = int(
        (opt_catalog.get("freshArrivals") or {}).get("activeProductCount") or 0
    )
    if expected_count <= 0:
        raise RuntimeError("Opt fresh-arrivals metadata has no active products")
    if len(product_ids) != expected_count or len(set(product_ids)) != expected_count:
        raise RuntimeError(
            f"Expected {expected_count} unique opt fresh products, got {len(product_ids)}"
        )

    codes: list[str] = []
    for product_id in product_ids:
        value = str(product_id)
        if not value.startswith("1c-"):
            raise RuntimeError(f"Unexpected opt product id: {value}")
        codes.append(value.removeprefix("1c-"))
    return codes


def apply(retail_catalog: dict, opt_catalog: dict) -> list[str]:
    codes = fresh_source_codes(opt_catalog)
    retail_by_code = {
        str(product.get("sourceCode")): product
        for product in retail_catalog.get("products", [])
        if product.get("sourceCode") not in (None, "")
    }

    missing = [code for code in codes if code not in retail_by_code]
    if missing:
        raise RuntimeError(f"Fresh products missing from retail catalog: {missing}")
    unavailable = []
    for code in codes:
        product = retail_by_code[code]
        quantity = product.get("stockQuantity")
        if (
            product.get("status") != "active"
            or product.get("inStock") is not True
            or (quantity is not None and float(quantity) <= 0)
        ):
            unavailable.append(code)
    if unavailable:
        raise RuntimeError(f"Fresh products are unavailable in retail: {unavailable}")

    for product in retail_catalog.get("products", []):
        for field in FRESH_FIELDS:
            product.pop(field, None)
    for rank, code in enumerate(codes):
        product = retail_by_code[code]
        product["freshArrival"] = True
        product["freshArrivalRank"] = rank
    return codes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("retail_catalog", type=Path)
    parser.add_argument("opt_catalog", type=Path)
    args = parser.parse_args()

    retail = load_json(args.retail_catalog)
    opt = load_json(args.opt_catalog)
    codes = apply(retail, opt)
    write_json(args.retail_catalog, retail)
    print(json.dumps({"updated": True, "freshProductCount": len(codes)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
