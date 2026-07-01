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
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "public-catalog.json"

# Card+front-only products deliberately published without a back photo.
KNOWN_EXCEPTIONS = {
    "prd_432b62d4b317",
    "prd_1f1557a2acbb",
    "prd_296bd01a7c1f",
}


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
    incomplete = []  # non-perfume photographed products without a full 3-image gallery
    for p in photographed:
        if p.get("categoryId") == "perfume":
            continue
        gallery = p.get("galleryImages") or []
        if len(gallery) != 3 and p.get("id") not in KNOWN_EXCEPTIONS:
            incomplete.append(p.get("id"))

    return {
        "total_products": total,
        "with_photos": with_photos,
        "without_photos": total - with_photos,
        "coverage_percent": round(100 * with_photos / total, 1) if total else 0.0,
        "perfume_total": len(perfume),
        "perfume_with_photos": sum(1 for p in perfume if has_real_photo(p)),
        "known_exceptions": sorted(KNOWN_EXCEPTIONS),
        "incomplete_non_perfume_galleries": sorted(incomplete),
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
    print(f"  Known exceptions:      {len(report['known_exceptions'])}")
    print(f"  Incomplete galleries:  {len(report['incomplete_non_perfume_galleries'])}")
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
