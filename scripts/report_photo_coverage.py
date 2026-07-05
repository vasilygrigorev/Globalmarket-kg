#!/usr/bin/env python3
"""Deterministic product-photo coverage report for Global Market KG.

Read-only, no network. Prints how much of the catalog has real product photos so
the owner and Codex can see progress after each Petya upload / 1C stock refresh.

Usage:
    python3 scripts/report_photo_coverage.py            # human-readable report
    python3 scripts/report_photo_coverage.py --json      # machine-readable JSON

"Real photo" = image or any galleryImages entry under assets/products/.
"""

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "public-catalog.json"
OVERRIDES_PATH = ROOT / "data" / "product_overrides.json"
MANUAL_PRODUCTS_PATH = ROOT / "data" / "manual_products.json"
PRODUCTS_DIR = ROOT / "assets" / "products"

# Card+front-only products deliberately published without a back photo.
KNOWN_EXCEPTIONS = {
    "prd_432b62d4b317",
    "prd_1f1557a2acbb",
    "prd_296bd01a7c1f",
}

# Filename markers that mean "raw/temporary Telegram upload or derived working
# file" rather than a finished, publishable product photo (contact sheets, OCR
# scratch files, duplicate exports). Mirrors the marker list documented in
# docs/product-photo-rules.md and enforced on published paths by
# scripts/verify_product_galleries.py / tests/catalog-image-hygiene.test.mjs.
RAW_LEFTOVER_MARKER = re.compile(r"telegram-|ocr|contact|sheet|dup", re.IGNORECASE)


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def override_referenced_paths():
    """Every image/galleryImages path in data/product_overrides.json and
    data/manual_products.json, regardless of whether that product is currently
    visible in public-catalog.json. A stock refresh can zero out a product's
    quantity and drop it from the public catalog while its override still holds
    the real, correct photo — that product must not look "unused" just because
    it is temporarily out of stock or hidden."""
    referenced = set()

    overrides = load_json(OVERRIDES_PATH, {})
    entries = overrides.get("products", overrides) if isinstance(overrides, dict) else overrides
    if isinstance(entries, dict):
        entries = entries.values()
    for entry in entries or []:
        for src in [entry.get("image"), *(entry.get("galleryImages") or [])]:
            if src:
                referenced.add(str(src))

    manual = load_json(MANUAL_PRODUCTS_PATH, {})
    manual_products = manual.get("products", manual if isinstance(manual, list) else [])
    for entry in manual_products or []:
        for src in [entry.get("image"), *(entry.get("galleryImages") or [])]:
            if src:
                referenced.add(str(src))

    return referenced


def find_unused_raw_leftovers(products):
    """Files under assets/products/ that look like raw Telegram/OCR/contact-sheet
    leftovers and are not referenced by any product's image/galleryImages,
    including products currently hidden or out of stock. Report only — nothing
    here is ever deleted automatically."""
    referenced = set()
    for p in products:
        for src in [p.get("image"), *(p.get("galleryImages") or [])]:
            if src:
                referenced.add(str(src))
    referenced |= override_referenced_paths()

    if not PRODUCTS_DIR.exists():
        return []

    unused = []
    for path in sorted(PRODUCTS_DIR.rglob("*")):
        if not path.is_file():
            continue
        rel = str(path.relative_to(ROOT))
        if rel in referenced:
            continue
        if RAW_LEFTOVER_MARKER.search(path.name):
            unused.append(rel)
    return unused


def has_real_photo(product):
    image = product.get("image") or ""
    gallery = product.get("galleryImages") or []
    return image.startswith("assets/products/") or any(
        str(src).startswith("assets/products/") for src in gallery
    )


def build_report(products):
    total = len(products)
    photographed = [p for p in products if has_real_photo(p)]
    with_photos = len(photographed)

    by_category = {}
    for p in products:
        cat = p.get("category") or "(no category)"
        entry = by_category.setdefault(cat, {"total": 0, "with_photos": 0})
        entry["total"] += 1
        if has_real_photo(p):
            entry["with_photos"] += 1

    perfume = [p for p in products if p.get("categoryId") == "perfume"]
    non_perfume = [p for p in products if p.get("categoryId") != "perfume"]
    non_perfume_photographed = [p for p in photographed if p.get("categoryId") != "perfume"]
    non_perfume_complete = [
        p for p in non_perfume_photographed if len(p.get("galleryImages") or []) == 3
    ]
    incomplete = []  # non-perfume photographed products without a full 3-image gallery
    for p in non_perfume_photographed:
        gallery = p.get("galleryImages") or []
        if len(gallery) != 3 and p.get("id") not in KNOWN_EXCEPTIONS:
            incomplete.append(p.get("id"))

    unused_leftovers = find_unused_raw_leftovers(products)

    return {
        "total_products": total,
        "with_photos": with_photos,
        "without_photos": total - with_photos,
        "coverage_percent": round(100 * with_photos / total, 1) if total else 0.0,
        "perfume_total": len(perfume),
        "perfume_with_photos": sum(1 for p in perfume if has_real_photo(p)),
        "non_perfume_total": len(non_perfume),
        "non_perfume_with_photos": len(non_perfume_photographed),
        "non_perfume_with_complete_gallery": len(non_perfume_complete),
        "known_exceptions": sorted(KNOWN_EXCEPTIONS),
        "incomplete_non_perfume_galleries": sorted(incomplete),
        "unused_raw_leftover_count": len(unused_leftovers),
        "unused_raw_leftovers": unused_leftovers,
        "by_category": {
            cat: by_category[cat] for cat in sorted(by_category)
        },
    }


def print_human(report):
    print("Global Market KG — product photo coverage")
    print(f"  Total products:        {report['total_products']}")
    print(f"  With real photos:      {report['with_photos']}")
    print(f"  Without photos:        {report['without_photos']}")
    print(f"  Coverage:              {report['coverage_percent']}%")
    print(f"  Perfume (card only):   {report['perfume_with_photos']}/{report['perfume_total']}")
    print(
        "  Non-perfume complete:  "
        f"{report['non_perfume_with_complete_gallery']}/{report['non_perfume_with_photos']}"
        f" photographed (of {report['non_perfume_total']} total)"
    )
    print(f"  Known exceptions:      {len(report['known_exceptions'])}")
    print(f"  Incomplete galleries:  {len(report['incomplete_non_perfume_galleries'])}")
    print(f"  Unused raw leftovers:  {report['unused_raw_leftover_count']} (assets/products/, not in catalog)")
    if report["unused_raw_leftovers"]:
        sample = report["unused_raw_leftovers"][:10]
        print(f"    sample: {', '.join(sample)}" + (" …" if report["unused_raw_leftover_count"] > 10 else ""))
    print("  By category (with/total):")
    for cat, entry in report["by_category"].items():
        print(f"    {cat}: {entry['with_photos']}/{entry['total']}")


def main():
    parser = argparse.ArgumentParser(description="Report product photo coverage.")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text.")
    args = parser.parse_args()

    products = json.loads(CATALOG.read_text(encoding="utf-8")).get("products", [])
    report = build_report(products)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_human(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
