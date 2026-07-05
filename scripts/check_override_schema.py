#!/usr/bin/env python3
"""Guard against legacy camelCase-only entries in data/product_overrides.json.

scripts/apply_product_overrides.py silently SKIPS any entry missing
clean_title/description/brand/product_type (it only reads those exact
snake_case keys). A past batch of entries used productType/categoryId/title
instead and sat with real, already-taken photos that never made it onto the
storefront until this was noticed by hand (2026-07-05).

This script fails only for entries that actually carry a photo (image or
galleryImages) — a photo-less override missing these fields is not silently
losing anything, so it is not flagged.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERRIDES_PATH = ROOT / "data" / "product_overrides.json"
REQUIRED_FIELDS = ("clean_title", "description", "brand", "product_type")

# Manual perfume entries live in data/manual_products.json, not the 1C
# products table — apply_product_overrides.py never touches prd_perfume_*
# keys here, so the snake_case requirement doesn't apply to them.
MANUAL_PREFIX = "prd_perfume_"


def has_photo(values):
    return bool(values.get("image") or values.get("galleryImages"))


def find_schema_issues():
    if not OVERRIDES_PATH.exists():
        return []
    data = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    issues = []
    for product_id, values in data.items():
        if product_id.startswith(MANUAL_PREFIX):
            continue
        if not has_photo(values):
            continue
        missing = [field for field in REQUIRED_FIELDS if field not in values]
        if missing:
            issues.append({"product_id": product_id, "missing_fields": missing})
    return issues


def main():
    parser = argparse.ArgumentParser(
        description="Check data/product_overrides.json for photographed entries missing required snake_case fields."
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    issues = find_schema_issues()
    if args.json:
        print(json.dumps({"issues": issues}, ensure_ascii=False, indent=2))
    else:
        if not issues:
            print("All photographed product_overrides.json entries carry the required snake_case fields.")
        else:
            print(f"{len(issues)} photographed override entr{'y' if len(issues) == 1 else 'ies'} missing required fields:")
            for issue in issues:
                print(f"  - {issue['product_id']}: missing {', '.join(issue['missing_fields'])}")
            print(
                "\napply_product_overrides.py silently skips these — add the missing "
                f"{', '.join(REQUIRED_FIELDS)} keys (snake_case) so the entry actually applies."
            )

    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
