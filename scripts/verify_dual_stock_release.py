#!/usr/bin/env python3
"""Verify one stock refresh across retail, opt and the persistent master."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from sync_stock_xlsx import retail_prices


SERVICE_CODES = {"2322"}
PRESENTATION_FIELDS = {
    "id",
    "title",
    "description",
    "brand",
    "productType",
    "category",
    "categoryId",
    "collections",
    "collectionLabels",
    "sectionIds",
    "sectionLabels",
    "productKind",
    "useArea",
    "form",
    "audience",
    "attributes",
    "tones",
    "image",
    "galleryImages",
    "firstSeenAt",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def by_code(products: list[dict]) -> dict[str, dict]:
    return {
        str(product["sourceCode"]): product
        for product in products
        if product.get("sourceCode") not in (None, "")
    }


def fresh_codes(catalog: dict, opt: bool) -> list[str]:
    if opt:
        group = next(row for row in catalog["groups"] if row["id"] == "group-fresh-arrivals")
        id_to_code = {row["id"]: str(row["sourceCode"]) for row in catalog["products"]}
        return [id_to_code[product_id] for product_id in group["productIds"]]
    return [
        str(row["sourceCode"])
        for row in sorted(
            (
                row
                for row in catalog["products"]
                if row.get("sourceCode") and row.get("freshArrivalRank") is not None
            ),
            key=lambda row: int(row["freshArrivalRank"]),
        )
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stock-audit", required=True, type=Path)
    parser.add_argument("--old-master", required=True, type=Path)
    parser.add_argument("--new-master", required=True, type=Path)
    parser.add_argument("--retail-public", required=True, type=Path)
    parser.add_argument("--retail-pages", required=True, type=Path)
    parser.add_argument("--opt-catalog", required=True, type=Path)
    args = parser.parse_args()

    audit = load(args.stock_audit)
    old_master = load(args.old_master)
    new_master = load(args.new_master)
    retail = load(args.retail_public)
    pages = load(args.retail_pages)
    opt = load(args.opt_catalog)

    stock_rows = audit["products"]
    stock_codes = [str(row["sourceCode"]) for row in stock_rows]
    stock_by_code = {str(row["sourceCode"]): row for row in stock_rows}
    assert len(stock_codes) == len(set(stock_codes))
    assert not set(stock_codes) & SERVICE_CODES
    assert audit["counts"]["pricedPositiveStockRows"] == len(stock_codes) + 1
    assert audit["counts"]["publishedPositiveStockRows"] == len(stock_codes)
    assert audit["counts"]["excludedServiceRows"] == 1
    assert audit["matching"]["unresolved"] == 0
    assert audit["matching"]["ambiguous"] == 0

    old_by_code = by_code(old_master["products"])
    master_by_code = by_code(new_master["products"])
    assert set(old_by_code) <= set(master_by_code)
    assert set(stock_codes) <= set(master_by_code)
    active_master_codes = {
        code
        for code, product in master_by_code.items()
        if product.get("status") == "active" and product.get("inStock") is True
    }
    assert active_master_codes == set(stock_codes)
    for code, product in master_by_code.items():
        if code not in stock_by_code:
            assert product.get("status") == "inactive"
            assert product.get("inStock") is False
            assert float(product.get("stockQuantity") or 0) == 0
    for code in SERVICE_CODES:
        assert master_by_code[code]["status"] == "inactive"
        assert master_by_code[code]["inStock"] is False

    # A stock refresh may change only source/inventory/pricing/freshness fields
    # for an existing card.  Curated identity and gallery are immutable here.
    for product in old_master["products"]:
        key = str(product.get("sourceCode") or product.get("id"))
        candidate = master_by_code.get(key) if product.get("sourceCode") else next(
            (row for row in new_master["products"] if row.get("id") == product.get("id")), None
        )
        assert candidate is not None, f"Retained product disappeared: {key}"
        for field in PRESENTATION_FIELDS:
            assert candidate.get(field) == product.get(field), f"Presentation drift {key}: {field}"
        old_gallery = product.get("galleryImages") or []
        new_gallery = candidate.get("galleryImages") or []
        assert len(new_gallery) >= len(old_gallery)
        assert set(old_gallery) <= set(new_gallery)

    retail_by_code = by_code(retail["products"])
    page_by_code = by_code(pages["products"])
    assert set(retail_by_code) == set(stock_codes)
    assert set(page_by_code) == set(master_by_code) - SERVICE_CODES
    manual_retail = [row for row in retail["products"] if not row.get("sourceCode")]
    manual_pages = [row for row in pages["products"] if not row.get("sourceCode")]
    assert len(manual_retail) == len(manual_pages) == 22
    for code, source in stock_by_code.items():
        product = master_by_code[code]
        expected_retail, expected_registered = retail_prices(
            float(source["costUsd"]), str(product.get("brand") or "")
        )
        assert product["retailPriceKgs"] == expected_retail
        assert product["registeredPriceKgs"] == expected_registered
        assert retail_by_code[code]["retailPriceKgs"] == expected_retail
        assert retail_by_code[code]["registeredPriceKgs"] == expected_registered

    opt_codes = [str(row["sourceCode"]) for row in opt["products"]]
    assert opt_codes == stock_codes
    opt_by_code = by_code(opt["products"])
    base_groups = [row for row in opt["groups"] if row["id"] != "group-fresh-arrivals"]
    assert len(base_groups) == 16
    assert [product_id for group in base_groups for product_id in group["productIds"]] == [
        row["id"] for row in opt["products"]
    ]
    for code, source in stock_by_code.items():
        product = opt_by_code[code]
        assert product["stockQuantity"] == source["stockQuantity"]
        assert product["priceUsd"] == source["costUsd"]
        assert product["priceKgs"] == round(float(source["costUsd"]) / 0.0111, 2)

    opt_fresh = fresh_codes(opt, True)
    retail_fresh = fresh_codes(retail, False)
    page_fresh = fresh_codes(pages, False)
    assert opt_fresh
    assert retail_fresh == page_fresh == opt_fresh

    print(
        json.dumps(
            {
                "ok": True,
                "stockDate": audit["stockDate"],
                "pricedRows": audit["counts"]["pricedPositiveStockRows"],
                "publishedStockProducts": len(stock_codes),
                "retailVisibleProducts": len(retail["products"]),
                "optVisibleProducts": len(opt["products"]),
                "freshProducts": len(opt_fresh),
                "persistentCards": len(new_master["products"]),
                "inactiveCards": sum(
                    bool(row.get("sourceCode")) and row.get("status") != "active"
                    for row in new_master["products"]
                ),
                "photosRetained": True,
                "stableUrlsRetained": True,
                "serviceProductsHidden": sorted(SERVICE_CODES),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
