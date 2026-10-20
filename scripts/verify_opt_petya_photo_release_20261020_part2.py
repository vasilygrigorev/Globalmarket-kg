#!/usr/bin/env python3
"""Fail-closed checks for the second 2026-10-20 opt photo update."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path


PUBLISHED_CODES = {
    "3296", "3297", "3295", "3292", "3291", "3302",
    "3304", "3305", "3306", "3308", "3307",
}
PHOTO_FIELDS = {"image", "galleryImages"}
PROTECTED_FILES = (
    "src/worker.js",
    "src/account-product-scope.js",
    "public/data/contractors.json",
    "public/app.js",
    "public/index.html",
    "public/styles.css",
    "wrangler.toml",
)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def by_code(document: dict) -> dict[str, dict]:
    rows = {str(row["sourceCode"]): row for row in document["products"]}
    assert len(rows) == len(document["products"])
    return rows


def without_photo_fields(row: dict) -> dict:
    value = copy.deepcopy(row)
    for field in PHOTO_FIELDS:
        value.pop(field, None)
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-root", required=True, type=Path)
    parser.add_argument("--candidate-root", required=True, type=Path)
    parser.add_argument("--retail-site", required=True, type=Path)
    parser.add_argument("--master-after", required=True, type=Path)
    parser.add_argument("--registry-after", required=True, type=Path)
    args = parser.parse_args()

    before = load(args.baseline_root / "public/data/catalog.json")
    after = load(args.candidate_root / "public/data/catalog.json")
    audit = load(args.candidate_root / "petya-photo-update-20261020-part2-audit.json")
    before_by_code = by_code(before)
    after_by_code = by_code(after)

    assert len(before["products"]) == len(after["products"]) == 664
    assert [str(row["sourceCode"]) for row in before["products"]] == [
        str(row["sourceCode"]) for row in after["products"]
    ]
    assert before_by_code.keys() == after_by_code.keys()
    assert before.get("groups") == after.get("groups")
    assert len(after["groups"]) == 17
    fresh = next(row for row in after["groups"] if row["id"] == "group-fresh-arrivals")
    assert len(fresh["productIds"]) == 154
    assert {key: value for key, value in before.items() if key != "products"} == {
        key: value for key, value in after.items() if key != "products"
    }

    expected_by_code = {
        row["sourceCode"]: row["galleryImages"] for row in audit["publishedProducts"]
    }
    assert set(expected_by_code) == PUBLISHED_CODES
    assert audit["publishedProductCount"] == 11
    assert audit["publishedImageCount"] == 33

    for code, old in before_by_code.items():
        new = after_by_code[code]
        if code in PUBLISHED_CODES:
            assert without_photo_fields(old) == without_photo_fields(new), (
                f"non-photo opt field changed for {code}"
            )
            assert not (old.get("galleryImages") or [])
            assert new["galleryImages"] == expected_by_code[code]
            assert new["image"] == expected_by_code[code][0]
            assert len(new["galleryImages"]) == 3
            assert all(path.startswith("https://globalmarket.kg/") for path in new["galleryImages"])
            for url in new["galleryImages"]:
                relative = url.removeprefix("https://globalmarket.kg/")
                assert (args.retail_site / relative).is_file(), f"retail asset missing: {relative}"
        else:
            assert old == new, f"unrelated opt product changed: {code}"

    assert sum(bool(row.get("image")) for row in before["products"]) == 525
    assert sum(bool(row.get("image")) for row in after["products"]) == 536
    for relative in PROTECTED_FILES:
        assert sha256(args.baseline_root / relative) == sha256(args.candidate_root / relative), (
            f"protected opt file changed: {relative}"
        )
    assert sha256(args.candidate_root / "inventory/catalog-master.json") == sha256(args.master_after)
    assert sha256(args.candidate_root / "inventory/product-photo-registry.json") == sha256(args.registry_after)

    print(json.dumps({
        "ok": True,
        "products": 664,
        "groups": 17,
        "freshProducts": 154,
        "photoBackedProducts": 536,
        "newPhotoBackedProducts": 11,
        "pricesStockOrderGroupsAndAccountsPreserved": True,
        "workerAndAccountPoliciesPreserved": True,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
