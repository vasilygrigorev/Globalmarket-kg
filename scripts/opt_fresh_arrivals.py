#!/usr/bin/env python3
"""Build the mandatory first ``Свежие поступления`` group for opt.

The input catalog remains the source of truth for products, prices, stock,
photos, roles and the sixteen 1C groups. This script only prepends a virtual
group that references those same product IDs and writes auditable metadata.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mmap
import re
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


GROUP_ID = "group-fresh-arrivals"
GROUP_TITLE = "Свежие поступления"
LARGE_RECEIPT_USD = 10_000.0
LARGE_CLUSTER_GAP_DAYS = 14

ANCHOR = "Оприходование ТМЦ".encode("cp1251")
DOC_RE = re.compile(r"[А-Яа-яЁё]-\d{6,}")
DATE_RE = re.compile(r"\d{2}\.\d{2}\.\d{2}")
QTY_RE = re.compile(r"(-?\d[\d']*(?:\.\d+)?)\s+(шт)")
PRICE_BYTES_RE = re.compile(rb"-?\d[\d']*(?:\.\d+)?")
CODE_RE = re.compile(r'"84","0","0","\s*(\d+)\s*')
PARTY_RE = re.compile(r'"214","0","0","\s*(\d+)\s*')
REPORT_START_RE = re.compile(r'"(20\d{6})"\},"ДатаНачала"')
REPORT_END_RE = re.compile(r'"(20\d{6})"\},"ДатаКонца"')


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, value: dict[str, Any], *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    if compact:
        text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(path)


def parse_number(value: str) -> float:
    return float(value.replace("'", ""))


def parse_short_date(value: str) -> str:
    day, month, year = (int(part) for part in value.split("."))
    return date(2000 + year, month, day).isoformat()


def compact_date(value: str) -> str:
    return f"{value[:4]}-{value[4:6]}-{value[6:]}"


def positions(data: mmap.mmap, needle: bytes):
    offset = 0
    while True:
        found = data.find(needle, offset)
        if found < 0:
            return
        yield found
        offset = found + 1


def price_after(data: mmap.mmap, start: int, stop: int) -> float | None:
    block = data[start:stop]
    for match in PRICE_BYTES_RE.finditer(block):
        absolute = start + match.start()
        raw = match.group()
        if absolute > 0 and data[absolute - 1] == len(raw):
            return parse_number(raw.decode("ascii"))
    return None


def parse_receipt_documents(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    raw_text = path.read_bytes().decode("cp1251", errors="ignore")
    starts = set(REPORT_START_RE.findall(raw_text))
    ends = set(REPORT_END_RE.findall(raw_text))
    report_period = {
        "start": compact_date(starts.pop()) if len(starts) == 1 else None,
        "end": compact_date(ends.pop()) if len(ends) == 1 else None,
    }

    documents: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"signatures": set(), "sourceCodes": [], "observedLineValueUsd": 0.0}
    )
    invalid_rows = 0

    with path.open("rb") as handle, mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as data:
        for anchor_at in positions(data, ANCHOR):
            low = max(0, anchor_at - 180)
            high = min(len(data), anchor_at + 1200)
            region = data[low:high].decode("cp1251", errors="replace")
            relative = anchor_at - low

            document_match = DOC_RE.search(region, relative, min(len(region), relative + 280))
            dates = list(
                DATE_RE.finditer(region, max(0, relative - 100), min(len(region), relative + 400))
            )
            dates_after = [item for item in dates if item.start() >= relative]
            date_match = dates_after[0] if dates_after else (dates[-1] if dates else None)
            quantity_match = QTY_RE.search(region, relative, min(len(region), relative + 650))
            code_match = CODE_RE.search(region, relative, min(len(region), relative + 1150))
            party_match = PARTY_RE.search(region, relative, min(len(region), relative + 1150))
            party_price = None
            if quantity_match:
                quantity_end = low + quantity_match.end()
                party_price = price_after(data, quantity_end, min(len(data), quantity_end + 220))

            if not all((document_match, date_match, quantity_match, code_match, party_price is not None)):
                invalid_rows += 1
                continue

            document_date = parse_short_date(date_match.group())
            document_number = document_match.group()
            source_code = code_match.group(1).strip()
            quantity = abs(parse_number(quantity_match.group(1)))
            party_code = party_match.group(1).strip() if party_match else ""
            signature = (source_code, quantity, party_price, party_code)
            document = documents[(document_date, document_number)]
            if signature in document["signatures"]:
                continue
            document["signatures"].add(signature)
            document["observedLineValueUsd"] += quantity * party_price
            if source_code not in document["sourceCodes"]:
                document["sourceCodes"].append(source_code)

    parsed = []
    for (document_date, document_number), values in documents.items():
        parsed.append(
            {
                "date": document_date,
                "number": document_number,
                "observedLineValueUsd": round(values["observedLineValueUsd"], 2),
                "isLarge": values["observedLineValueUsd"] > LARGE_RECEIPT_USD,
                "sourceCodes": values["sourceCodes"],
            }
        )
    parsed.sort(key=lambda item: (item["date"], item["number"]), reverse=True)
    report_period["invalidReceiptRows"] = invalid_rows
    return parsed, report_period


def select_receipts(
    documents: list[dict[str, Any]], report_period: dict[str, Any]
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    large = [item for item in documents if item["isLarge"]]
    if not large:
        raise RuntimeError("No 1C receipt over USD 10,000 was found")

    included_large = [large[0]]
    previous_included = large[0]
    boundary = None
    for candidate in large[1:]:
        gap = (
            date.fromisoformat(previous_included["date"])
            - date.fromisoformat(candidate["date"])
        ).days
        if gap <= LARGE_CLUSTER_GAP_DAYS:
            included_large.append(candidate)
            previous_included = candidate
            continue
        boundary = candidate
        break

    if boundary:
        selected = [item.copy() for item in documents if item["date"] > boundary["date"]]
    else:
        period_start = report_period.get("start")
        selected = [
            item.copy()
            for item in documents
            if not period_start or item["date"] >= period_start
        ]

    included_keys = {(item["date"], item["number"]) for item in included_large}
    for item in selected:
        item["includedLargeReceipt"] = (item["date"], item["number"]) in included_keys
    return selected, boundary


def public_document(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "date": document["date"],
        "number": document["number"],
        "observedLineValueUsd": document["observedLineValueUsd"],
        "isLarge": document["isLarge"],
        "includedLargeReceipt": document["includedLargeReceipt"],
        "sourceCodeCount": len(document["sourceCodes"]),
    }


def expected_fresh_product_ids(
    catalog: dict[str, Any], selected: list[dict[str, Any]]
) -> tuple[list[str], list[str]]:
    product_by_code = {
        str(product["sourceCode"]): product
        for product in catalog["products"]
        if float(product.get("stockQuantity") or 0) > 0
    }
    receipt_rank: dict[str, int] = {}
    for document_rank, document in enumerate(selected):
        for source_code in document["sourceCodes"]:
            receipt_rank.setdefault(source_code, document_rank)

    matched = [product_by_code[code] for code in receipt_rank if code in product_by_code]
    matched.sort(
        key=lambda product: (
            receipt_rank[str(product["sourceCode"])],
            int(product["position"]),
        )
    )
    missing = sorted(
        set(receipt_rank) - set(product_by_code),
        key=lambda value: (len(value), value),
    )
    return [product["id"] for product in matched], missing


def apply(
    *,
    catalog_path: Path,
    receipt_report: Path,
    audit_path: Path,
    manifest_path: Path,
    release_id: str,
    parent_release_id: str,
    expected_base_group_count: int,
) -> dict[str, Any]:
    catalog = read_json(catalog_path)
    base_groups = [group for group in catalog["groups"] if group.get("id") != GROUP_ID]
    if len(base_groups) != expected_base_group_count:
        raise RuntimeError(
            f"Expected {expected_base_group_count} base 1C groups, found {len(base_groups)}"
        )

    documents, report_period = parse_receipt_documents(receipt_report)
    selected, boundary = select_receipts(documents, report_period)
    product_ids, missing_codes = expected_fresh_product_ids(catalog, selected)
    if not product_ids:
        raise RuntimeError("Fresh-arrivals selection is empty after current-stock filtering")

    base_product_ids = {
        product_id for group in base_groups for product_id in group.get("productIds", [])
    }
    if not set(product_ids) <= base_product_ids:
        raise RuntimeError("A fresh product is missing from its original 1C group")

    now = datetime.now(timezone.utc).isoformat()
    fresh_group = {
        "id": GROUP_ID,
        "title": GROUP_TITLE,
        "position": -1,
        "virtual": True,
        "productIds": product_ids,
    }
    selected_documents = [public_document(item) for item in selected]
    boundary_data = (
        {
            "date": boundary["date"],
            "number": boundary["number"],
            "observedLineValueUsd": boundary["observedLineValueUsd"],
        }
        if boundary
        else None
    )
    metadata = {
        "title": GROUP_TITLE,
        "sourceReport": str(receipt_report),
        "sourceReportSha256": sha256(receipt_report),
        "reportPeriod": report_period,
        "largeReceiptThresholdUsd": LARGE_RECEIPT_USD,
        "largeReceiptClusterGapDays": LARGE_CLUSTER_GAP_DAYS,
        "largeReceiptGapInclusive": True,
        "selectedFrom": min(item["date"] for item in selected),
        "selectedThrough": max(item["date"] for item in selected),
        "selectedReceiptDocuments": selected_documents,
        "previousExcludedLargeReceipt": boundary_data,
        "receiptSourceCodeCount": len(
            {code for item in selected for code in item["sourceCodes"]}
        ),
        "activeProductCount": len(product_ids),
        "missingFromCurrentStock": missing_codes,
    }

    catalog["release"] = release_id
    catalog["generatedAt"] = now
    catalog["groups"] = [fresh_group, *base_groups]
    catalog["freshArrivals"] = metadata
    write_json_atomic(catalog_path, catalog, compact=True)

    manifest = read_json(manifest_path)
    photo_backed_products = sum(bool(product.get("image")) for product in catalog["products"])
    gallery_image_references = sum(
        len(product.get("galleryImages", [])) for product in catalog["products"]
    )
    manifest.update(
        {
            "release": release_id,
            "generatedAt": now,
            "parentRelease": parent_release_id,
            "groupCount": len(catalog["groups"]),
            "base1CGroupCount": len(base_groups),
            "freshArrivalProductCount": len(product_ids),
            "productCount": len(catalog["products"]),
            "photoBackedProducts": photo_backed_products,
            "missingPhotoProducts": len(catalog["products"]) - photo_backed_products,
            "galleryImageReferenceCount": gallery_image_references,
            "freshArrivals": metadata,
            "newProductsPresentation": (
                "The first virtual catalog section is Fresh Arrivals. Its products also "
                "remain in their original 1C groups and share the same stock and cart state."
            ),
        }
    )
    write_json_atomic(manifest_path, manifest)

    audit = {
        "release": release_id,
        "parentRelease": parent_release_id,
        "generatedAt": now,
        "algorithm": {
            "largeReceiptUsd": LARGE_RECEIPT_USD,
            "largeClusterGapDays": LARGE_CLUSTER_GAP_DAYS,
            "gapInclusive": True,
            "boundaryExcluded": True,
            "smallReceiptsInsideWindowIncluded": True,
            "currentPositiveStockOnly": True,
            "firstVirtualGroupRequired": True,
        },
        "sourceReport": str(receipt_report),
        "sourceReportSha256": metadata["sourceReportSha256"],
        "reportPeriod": report_period,
        "selectedDocuments": selected_documents,
        "previousExcludedLargeReceipt": boundary_data,
        "activeProductIds": product_ids,
        "missingFromCurrentStock": missing_codes,
    }
    write_json_atomic(audit_path, audit)
    return {
        "release": release_id,
        "baseGroupCount": len(base_groups),
        "freshProductCount": len(product_ids),
        "selectedDocuments": [
            f"{item['date']} {item['number']}" for item in selected_documents
        ],
        "boundary": boundary_data,
        "missingFromCurrentStock": missing_codes,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--receipt-report", required=True, type=Path)
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--parent-release-id", required=True)
    parser.add_argument("--expected-base-group-count", type=int, default=16)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = apply(
        catalog_path=args.catalog,
        receipt_report=args.receipt_report,
        audit_path=args.audit,
        manifest_path=args.manifest,
        release_id=args.release_id,
        parent_release_id=args.parent_release_id,
        expected_base_group_count=args.expected_base_group_count,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
