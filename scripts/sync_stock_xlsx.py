#!/usr/bin/env python3
"""Synchronize the persistent catalog master from a 1C XLSX stock export.

The numeric prefix printed by 1C in the XLSX is an article, not the stable
``sourceCode`` used by the storefronts.  Identity is therefore resolved from
the append-only master by article/name, with a small audited alias table for
known renamed rows.  The script fails closed on every unresolved or ambiguous
priced row and never deletes a retained product card.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook


SERVICE_SOURCE_CODES = {"2322"}
KGS_USD_DIVISOR = 0.0111
DEFAULT_MARKUP_PERCENT = 30
BRAND_MARKUP_PERCENT = {
    "The Pink Stuff": 40,
    "Felce Azzurra": 40,
    "Kamill": 40,
}
REGISTERED_DISCOUNT_PERCENT = 3
EXPECTED_GROUPS = 16
EXPECTED_PRICED_PRODUCTS = 665

# These aliases are identity evidence, not fuzzy guesses.  Each value is the
# stable 1C sourceCode already used by historical URLs, photos and account
# scopes.  Keep the source spelling so future imports remain reproducible.
MANUAL_NAME_ALIASES = {
    "colgate з/щ 360* gold": "1077",
    "colgate з/щ 360* charcoal щсп": "824",
    "colgate з/щ 360* optic white щкд": "2940",
    "colgate з/щ 360* whole mouth щкд": "2941",
    "felce azzurra air diffuser (125ml) bamboo & lotus": "3302",
    "felce azzurra laundry fragrance (220ml) orchid": "3268",
    "the pink stuff (850ml) window cleaning kit": "3092",
    "the pink stuff toilet rim block (2x40g)": "3260",
}

NEW_PRODUCT_PRESENTATION = {
    "3268": {
        "title": "Felce Azzurra Orchid парфюм для белья, 220 мл",
        "description": (
            "Концентрированный парфюм для белья Felce Azzurra Orchid придаёт "
            "ткани выразительный цветочный аромат. Добавляйте средство при стирке "
            "согласно дозировке и рекомендациям на упаковке. Объём 220 мл."
        ),
        "brand": "Felce Azzurra",
        "productType": "парфюм для белья",
        "category": "Стирка и уход за бельем",
        "categoryId": "laundry",
        "collections": ["europe"],
        "collectionLabels": ["Европа"],
        "sectionIds": ["laundry", "perfume"],
        "sectionLabels": ["Стирка", "Парфюм"],
        "productKind": "laundry_fragrance",
        "useArea": "laundry",
        "form": "liquid",
        "attributes": ["orchid"],
        "tones": ["#d7c6e5", "#81598f"],
        "icon": "",
    },
    "3302": {
        "title": "Felce Azzurra Bamboo & Lotus аромадиффузор, 125 мл",
        "description": (
            "Аромадиффузор Felce Azzurra Bamboo & Lotus для дома сочетает свежие "
            "ноты бамбука и лотоса. Интенсивность аромата регулируется количеством "
            "палочек; используйте согласно инструкции на упаковке. Объём 125 мл."
        ),
        "brand": "Felce Azzurra",
        "productType": "аромадиффузор",
        "category": "Разное",
        "categoryId": "other",
        "collections": ["europe"],
        "collectionLabels": ["Европа"],
        "sectionIds": ["home", "perfume"],
        "sectionLabels": ["Дом и уют", "Парфюм"],
        "productKind": "home_fragrance",
        "useArea": "home",
        "form": "diffuser",
        "attributes": ["bamboo", "lotus"],
        "tones": ["#d6ece8", "#579b91"],
        "icon": "",
    },
}

ARTICLE_RE = re.compile(r"^\s*(\d{7,9})\s*_\s*(.+?)\s*$")
DATE_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{2,4})")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize_spaces(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_name(value: object) -> str:
    text = normalize_spaces(value).replace("’", "'").casefold()
    match = ARTICLE_RE.match(text)
    if match:
        text = match.group(2)
    return normalize_spaces(text).strip(" _-")


def parse_stock_date(value: object) -> str:
    match = DATE_RE.search(str(value or ""))
    if not match:
        raise RuntimeError(f"Cannot parse stock date from {value!r}")
    day, month, year = match.groups()
    year_number = int(year)
    if year_number < 100:
        year_number += 2000
    return f"{year_number:04d}-{int(month):02d}-{int(day):02d}"


def number(value: object) -> float | None:
    if value in (None, "", " "):
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("'", "").replace(",", ".").strip()
    return float(text) if text else None


def parse_stock(path: Path) -> tuple[str, list[dict], list[dict]]:
    workbook = load_workbook(path, data_only=True, read_only=True)
    sheet = workbook[workbook.sheetnames[0]]
    rows = list(sheet.iter_rows(values_only=True))
    if len(rows) < 9 or "Остатки ТМЦ" not in str(rows[3][0] or ""):
        raise RuntimeError("Unexpected 1C XLSX structure")
    stock_date = parse_stock_date(rows[4][0])
    current_group = ""
    priced: list[dict] = []
    excluded: list[dict] = []

    for row_number, row in enumerate(rows[8:], start=9):
        values = list(row) + [None] * (6 - len(row))
        raw_name = normalize_spaces(values[0])
        unit = normalize_spaces(values[2])
        price = number(values[3])
        quantity = number(values[4])
        amount = number(values[5])
        match = ARTICLE_RE.match(raw_name)

        if not match:
            if raw_name and raw_name != "Итого:":
                current_group = raw_name
            continue
        if unit != "шт" or quantity is None or quantity <= 0:
            continue

        article, name = match.groups()
        record = {
            "row": row_number,
            "article": article,
            "name1C": normalize_spaces(name),
            "rawName1C": raw_name,
            "group1C": current_group,
            "unit": unit,
            "costUsd": None if price is None else round(price, 4),
            "stockQuantity": quantity,
            "amountUsd": None if amount is None else round(amount, 2),
        }
        if price is None:
            if not normalize_name(name).startswith("ao12 "):
                raise RuntimeError(f"Unexpected unpriced merchandise row {row_number}: {raw_name}")
            excluded.append({**record, "reason": "unpriced-perfume-packaging-component"})
            continue
        expected_amount = round(price * quantity, 2)
        tolerance = max(0.05, abs(expected_amount) * 0.001)
        if amount is None or abs(expected_amount - amount) > tolerance:
            raise RuntimeError(
                f"1C amount mismatch at row {row_number}: {raw_name}; "
                f"expected {expected_amount}, found {amount}"
            )
        priced.append(record)

    if len(priced) != EXPECTED_PRICED_PRODUCTS:
        raise RuntimeError(f"Expected {EXPECTED_PRICED_PRODUCTS} priced products, found {len(priced)}")
    groups = list(dict.fromkeys(row["group1C"] for row in priced))
    if len(groups) != EXPECTED_GROUPS:
        raise RuntimeError(f"Expected {EXPECTED_GROUPS} priced groups, found {len(groups)}")
    return stock_date, priced, excluded


def source_code(product: dict) -> str:
    return str(product.get("sourceCode") or "").strip()


def article_from_product(product: dict) -> str:
    for field in ("sourceRawName1C", "rawName1C"):
        match = ARTICLE_RE.match(str(product.get(field) or ""))
        if match:
            return match.group(1)
    return ""


def product_names(product: dict) -> set[str]:
    values = {
        normalize_name(product.get(field))
        for field in ("sourceName1C", "name1C", "sourceRawName1C", "rawName1C", "title")
    }
    return {value for value in values if value}


def resolve_stock_rows(stock_rows: list[dict], master: dict) -> tuple[list[dict], dict]:
    products = [row for row in master.get("products", []) if source_code(row)]
    codes = [source_code(row) for row in products]
    if len(codes) != len(set(codes)):
        raise RuntimeError("Persistent master contains duplicate sourceCode values")

    article_index: dict[str, set[str]] = {}
    name_index: dict[str, set[str]] = {}
    for product in products:
        code = source_code(product)
        article = article_from_product(product)
        if article:
            article_index.setdefault(article, set()).add(code)
        for name in product_names(product):
            name_index.setdefault(name, set()).add(code)

    resolved: list[dict] = []
    unresolved: list[dict] = []
    ambiguous: list[dict] = []
    method_counts: dict[str, int] = {}
    for stock in stock_rows:
        candidates = article_index.get(stock["article"], set())
        method = "article-exact"
        if len(candidates) != 1:
            candidates = name_index.get(normalize_name(stock["name1C"]), set())
            method = "name-exact"
        if len(candidates) != 1:
            alias = MANUAL_NAME_ALIASES.get(normalize_name(stock["name1C"]))
            candidates = {alias} if alias else set()
            method = "approved-alias"
        if len(candidates) == 1:
            code = next(iter(candidates))
            resolved.append({**stock, "sourceCode": code, "identityMethod": method})
            method_counts[method] = method_counts.get(method, 0) + 1
        elif candidates:
            ambiguous.append({**stock, "candidateSourceCodes": sorted(candidates)})
        else:
            unresolved.append(copy.deepcopy(stock))

    duplicate_codes: dict[str, list[int]] = {}
    for row in resolved:
        duplicate_codes.setdefault(row["sourceCode"], []).append(row["row"])
    duplicate_codes = {code: rows for code, rows in duplicate_codes.items() if len(rows) > 1}
    if unresolved or ambiguous or duplicate_codes:
        raise RuntimeError(
            json.dumps(
                {
                    "unresolved": unresolved,
                    "ambiguous": ambiguous,
                    "duplicateSourceCodes": duplicate_codes,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    return resolved, {"methods": method_counts, "unresolved": 0, "ambiguous": 0}


def beautiful_round(value: float, max_deviation_percent: float = 5.0) -> int:
    if value <= 0:
        return 0
    endings = [90, 95]
    if value >= 3000:
        endings = [900, 950, 990]
        base_step = 1000
    else:
        base_step = 100
    candidates = set()
    lower_base = math.floor(value / base_step) * base_step
    for base in range(int(lower_base - base_step * 2), int(lower_base + base_step * 4), base_step):
        if base >= 0:
            candidates.update(base + ending for ending in endings if base + ending > 0)
    allowed = value * (max_deviation_percent / 100)
    valid = [candidate for candidate in candidates if abs(candidate - value) <= allowed]
    if valid:
        return int(min(valid, key=lambda candidate: (abs(candidate - value), candidate)))
    if value < 300:
        return int(round(value / 10) * 10)
    if value < 3000:
        return int(round(value / 50) * 50)
    return int(round(value / 100) * 100)


def retail_prices(cost_usd: float, brand: str) -> tuple[int, int]:
    markup = BRAND_MARKUP_PERCENT.get(brand, DEFAULT_MARKUP_PERCENT)
    retail = beautiful_round(cost_usd / KGS_USD_DIVISOR * (1 + markup / 100))
    registered = math.floor(retail * (1 - REGISTERED_DISCOUNT_PERCENT / 100))
    return retail, registered


def active_registry_gallery(registry: dict, code: str) -> list[str]:
    record = (registry.get("products") or {}).get(str(code))
    if not record:
        return []
    active_id = record.get("activeGalleryVersion")
    gallery = next(
        (row for row in record.get("galleries", []) if row.get("versionId") == active_id),
        None,
    )
    if not gallery:
        return []
    return [item["publicPath"] for item in gallery.get("files", []) if item.get("publicPath")]


def make_new_product(stock: dict, stock_date: str) -> dict:
    code = stock["sourceCode"]
    presentation = NEW_PRODUCT_PRESENTATION.get(code)
    if not presentation:
        raise RuntimeError(f"No approved presentation for new sourceCode {code}: {stock['name1C']}")
    retail, registered = retail_prices(stock["costUsd"], presentation["brand"])
    result = {
        "id": f"prd_1c_{code}",
        "sourceCode": code,
        "firstSeenAt": stock_date,
        "restockedAt": stock_date,
        "unit": stock["unit"],
        "badge": presentation["brand"],
        "galleryImages": [],
        "image": "",
        "rating": 4.8,
        "audience": "family",
        "status": "active",
        "inStock": True,
        "retailPriceKgs": retail,
        "registeredPriceKgs": registered,
    }
    result.update(copy.deepcopy(presentation))
    return result


def synchronize_master(
    master: dict,
    registry: dict,
    stock_date: str,
    stock_rows: list[dict],
    release_id: str,
) -> tuple[dict, dict, dict]:
    updated = copy.deepcopy(master)
    updated_registry = copy.deepcopy(registry)
    products = updated.get("products") or []
    by_code = {source_code(product): product for product in products if source_code(product)}
    stock_by_code = {row["sourceCode"]: row for row in stock_rows}
    added: list[str] = []
    retired: list[str] = []
    restocked: list[str] = []
    price_changes: list[dict] = []

    for code, stock in stock_by_code.items():
        if code not in by_code:
            product = make_new_product(stock, stock_date)
            products.append(product)
            by_code[code] = product
            added.append(code)

    for product in products:
        code = source_code(product)
        if not code:
            # The 22 manual perfume cards are intentionally independent from
            # the 1C stock export and retain their established visibility.
            continue
        product.pop("freshArrival", None)
        product.pop("freshArrivalRank", None)
        stock = stock_by_code.get(code)
        was_active = product.get("status") == "active" and product.get("inStock") is not False
        if not stock:
            if was_active:
                retired.append(code)
            product["status"] = "inactive"
            product["inStock"] = False
            product["stockQuantity"] = 0
        else:
            if not was_active:
                restocked.append(code)
                product["restockedAt"] = stock_date
            old_prices = (product.get("retailPriceKgs"), product.get("registeredPriceKgs"))
            retail, registered = retail_prices(stock["costUsd"], str(product.get("brand") or ""))
            product.update(
                {
                    "sourceName1C": stock["name1C"],
                    "name1C": stock["name1C"],
                    "sourceRawName1C": stock["rawName1C"],
                    "rawName1C": stock["rawName1C"],
                    "sourceGroup1C": stock["group1C"],
                    "group1C": stock["group1C"],
                    "sourceCostUsd": stock["costUsd"],
                    "costUsd": stock["costUsd"],
                    "unit": stock["unit"] or product.get("unit") or "шт",
                    "stockQuantity": stock["stockQuantity"],
                    "lastStockDate": stock_date,
                    "status": "active",
                    "inStock": True,
                    "retailPriceKgs": retail,
                    "registeredPriceKgs": registered,
                }
            )
            if old_prices != (retail, registered):
                price_changes.append(
                    {
                        "sourceCode": code,
                        "from": list(old_prices),
                        "to": [retail, registered],
                    }
                )

        gallery = active_registry_gallery(updated_registry, code)
        if gallery:
            product["galleryImages"] = gallery
            product["image"] = gallery[0]
        record = (updated_registry.get("products") or {}).get(code)
        if record:
            record["productId"] = product.get("id")
            record["titleSnapshot"] = product.get("title")
            record["currentlyInStock"] = code in stock_by_code
            record["lastSeenStockDate"] = stock_date if code in stock_by_code else record.get("lastSeenStockDate")

    now = utc_now()
    updated["updatedAt"] = now
    updated["sourceRelease"] = release_id
    updated["latestStockDate"] = stock_date
    updated["products"] = products
    source_products = [row for row in products if source_code(row)]
    updated["stats"] = {
        "productRecords": len(products),
        "sourceCodedRecords": len(source_products),
        "manualRecords": len(products) - len(source_products),
        "active1CRecords": sum(row.get("status") == "active" for row in source_products),
        "inactive1CRecords": sum(row.get("status") != "active" for row in source_products),
        "picturedProducts": sum(bool(row.get("image") or row.get("galleryImages")) for row in products),
    }
    updated_registry["updatedAt"] = now
    updated_registry["latestStockDate"] = stock_date
    updated_registry.setdefault("stats", {})["currentlyInStock"] = sum(
        bool(row.get("currentlyInStock")) for row in (updated_registry.get("products") or {}).values()
    )
    changes = {
        "added": added,
        "retired": retired,
        "restocked": restocked,
        "priceChanges": price_changes,
    }
    return updated, updated_registry, changes


def write_json(path: Path, payload: object, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":") if compact else None, indent=None if compact else 2)
        + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stock", required=True, type=Path)
    parser.add_argument("--master-input", required=True, type=Path)
    parser.add_argument("--registry-input", required=True, type=Path)
    parser.add_argument("--master-output", required=True, type=Path)
    parser.add_argument("--registry-output", required=True, type=Path)
    parser.add_argument("--audit-output", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    args = parser.parse_args()

    stock_date, parsed_rows, excluded = parse_stock(args.stock)
    master = json.loads(args.master_input.read_text(encoding="utf-8"))
    registry = json.loads(args.registry_input.read_text(encoding="utf-8"))
    resolved_rows, matching = resolve_stock_rows(parsed_rows, master)
    service_rows = [
        row for row in resolved_rows if row["sourceCode"] in SERVICE_SOURCE_CODES
    ]
    storefront_rows = [
        row for row in resolved_rows if row["sourceCode"] not in SERVICE_SOURCE_CODES
    ]
    updated, updated_registry, changes = synchronize_master(
        master, registry, stock_date, storefront_rows, args.release_id
    )

    write_json(args.master_output, updated)
    write_json(args.registry_output, updated_registry)
    audit = {
        "schemaVersion": 1,
        "release": args.release_id,
        "generatedAt": utc_now(),
        "stockDate": stock_date,
        "source": {"path": str(args.stock), "sha256": sha256(args.stock)},
        "counts": {
            "pricedPositiveStockRows": len(resolved_rows),
            "publishedPositiveStockRows": len(storefront_rows),
            "excludedServiceRows": len(service_rows),
            "excludedUnpricedComponents": len(excluded),
            "groups": len(list(dict.fromkeys(row["group1C"] for row in resolved_rows))),
            "masterRecordsBefore": len(master.get("products") or []),
            "masterRecordsAfter": len(updated.get("products") or []),
            "active1CRecords": updated["stats"]["active1CRecords"],
            "inactive1CRecords": updated["stats"]["inactive1CRecords"],
            "manualRecords": updated["stats"]["manualRecords"],
        },
        "matching": matching,
        "changes": {
            "addedSourceCodes": changes["added"],
            "retiredSourceCodes": changes["retired"],
            "restockedSourceCodes": changes["restocked"],
            "priceChangeCount": len(changes["priceChanges"]),
            "priceChanges": changes["priceChanges"],
        },
        "excluded": excluded,
        "excludedServiceProducts": service_rows,
        "products": storefront_rows,
        "invariants": {
            "identity": "stable sourceCode, never XLSX article prefix",
            "missingStock": "retained in master as inactive with zero stock",
            "presentation": "title, description, taxonomy, gallery and stable id preserved",
            "retailPricing": "USD / 0.0111 with 30 percent default markup; Pink Stuff, Felce Azzurra and Kamill 40 percent",
            "optPricing": "exact source USD and USD / 0.0111 KGS",
        },
    }
    write_json(args.audit_output, audit)
    print(
        json.dumps(
            {
                "stockDate": stock_date,
                "parsedPricedRows": len(resolved_rows),
                "activeStorefrontRows": len(storefront_rows),
                "excluded": len(excluded) + len(service_rows),
                "mappingMethods": matching["methods"],
                "masterRecords": len(updated.get("products") or []),
                "added": changes["added"],
                "retired": len(changes["retired"]),
                "restocked": len(changes["restocked"]),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
