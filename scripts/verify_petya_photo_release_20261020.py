#!/usr/bin/env python3
"""Fail-closed verification for the 2026-10-20 Petya photo release."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import subprocess
from pathlib import Path


PUBLISHED_CODES = {
    "3299",
    "3294",
    "3298",
    "3261",
    "3262",
    "3281",
    "3100",
    "3270",
    "2961",
    "1248",
    "3062",
    "3268",
    "1212",
    "1155",
    "3233",
    "3231",
    "3227",
    "1940",
    "3064",
}
ALTERNATE_CODES = {"3092", "2527"}
PHOTO_FIELDS = {"image", "galleryImages"}
FA_FIELDS = {"title", "unit", "description", "searchText", "searchTerms"}
EXPECTED_ROLES = ["card-front", "front", "back"]


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def git_json(root: Path, commit: str, relative: str) -> dict:
    result = subprocess.run(
        ["git", "show", f"{commit}:{relative}"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def by_code(document: dict) -> dict[str, dict]:
    rows = {
        str(row["sourceCode"]): row
        for row in document.get("products", [])
        if row.get("sourceCode") not in (None, "")
    }
    expected = sum(
        row.get("sourceCode") not in (None, "")
        for row in document.get("products", [])
    )
    assert len(rows) == expected, "duplicate sourceCode"
    return rows


def without_fields(row: dict, fields: set[str]) -> dict:
    value = copy.deepcopy(row)
    for field in fields:
        value.pop(field, None)
    return value


def product_order(document: dict) -> list[str]:
    return [
        str(row.get("sourceCode") or row.get("id"))
        for row in document.get("products", [])
    ]


def verify_catalog_pair(
    label: str,
    before: dict,
    after: dict,
    expected_paths: dict[str, list[str]],
) -> None:
    assert product_order(before) == product_order(after), f"{label}: product order changed"
    before_top = {key: value for key, value in before.items() if key != "products"}
    after_top = {key: value for key, value in after.items() if key != "products"}
    assert before_top == after_top, f"{label}: non-product catalog data changed"

    before_by_code = by_code(before)
    after_by_code = by_code(after)
    assert before_by_code.keys() == after_by_code.keys(), f"{label}: product set changed"

    for code, old in before_by_code.items():
        new = after_by_code[code]
        if code in PUBLISHED_CODES:
            allowed = PHOTO_FIELDS | (FA_FIELDS if code == "3281" else set())
            assert without_fields(old, allowed) == without_fields(new, allowed), (
                f"{label}: disallowed field changed for {code}"
            )
            assert not (old.get("galleryImages") or []), (
                f"{label}: target {code} already had a gallery"
            )
            assert new.get("galleryImages") == expected_paths[code], (
                f"{label}: wrong gallery paths for {code}"
            )
            assert new.get("image") == expected_paths[code][0], (
                f"{label}: card image is not first for {code}"
            )
        else:
            assert old == new, f"{label}: unrelated product changed: {code}"


def verify_master(before: dict, after: dict, expected_paths: dict[str, list[str]]) -> None:
    assert len(before.get("products", [])) == len(after.get("products", [])) == 995
    assert product_order(before) == product_order(after), "master product order changed"
    before_by_code = by_code(before)
    after_by_code = by_code(after)
    assert before_by_code.keys() == after_by_code.keys(), "master product set changed"

    for code, old in before_by_code.items():
        new = after_by_code[code]
        if code in PUBLISHED_CODES:
            allowed = PHOTO_FIELDS | (FA_FIELDS if code == "3281" else set())
            assert without_fields(old, allowed) == without_fields(new, allowed), (
                f"master: disallowed field changed for {code}"
            )
            assert not (old.get("galleryImages") or [])
            assert new.get("galleryImages") == expected_paths[code]
            assert new.get("image") == expected_paths[code][0]
        else:
            assert old == new, f"master: unrelated product changed: {code}"

    assert sum(row.get("status") == "active" and row.get("inStock") is True for row in after["products"]) == 686
    assert sum(row.get("status") != "active" or row.get("inStock") is not True for row in after["products"]) == 309
    assert after.get("sourceRelease") == "20261020-petya-photo-update-v1"


def verify_registry(before: dict, after: dict, audit: dict) -> None:
    before_products = before.get("products", {})
    after_products = after.get("products", {})
    changed = PUBLISHED_CODES | ALTERNATE_CODES

    for code, old in before_products.items():
        if code not in changed:
            assert after_products.get(code) == old, f"registry drift for unrelated code {code}"

    for row in audit["publishedProducts"]:
        code = row["sourceCode"]
        record = after_products[code]
        assert record["activeGalleryVersion"] == row["versionId"]
        gallery = next(
            item for item in record["galleries"] if item["versionId"] == row["versionId"]
        )
        assert gallery["status"] == "active"
        assert [item["role"] for item in gallery["files"]] == EXPECTED_ROLES

        old_record = before_products.get(code)
        if old_record:
            old_versions = {item["versionId"] for item in old_record.get("galleries", [])}
            new_versions = {item["versionId"] for item in record.get("galleries", [])}
            assert old_versions <= new_versions, f"registry history lost for {code}"

    for row in audit["alternateProducts"]:
        code = row["sourceCode"]
        old_record = before_products[code]
        record = after_products[code]
        assert record["activeGalleryVersion"] == old_record["activeGalleryVersion"]
        assert record["activeGalleryVersion"] == row["activeGalleryRetained"]
        gallery = next(
            item for item in record["galleries"] if item["versionId"] == row["versionId"]
        )
        assert gallery["status"] == "alternate"
        assert [item["role"] for item in gallery["files"]] == EXPECTED_ROLES

    latest = after.get("latestPhotoBatch", {})
    assert latest.get("approvedSourceCodes") == [row["sourceCode"] for row in audit["publishedProducts"]]
    assert latest.get("alternateSourceCodes") == [row["sourceCode"] for row in audit["alternateProducts"]]
    assert latest.get("contract") == "card image first, then plain front and back"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--baseline-commit", default="bf8b66b")
    parser.add_argument("--master-before", required=True, type=Path)
    parser.add_argument("--master-after", required=True, type=Path)
    parser.add_argument("--registry-before", required=True, type=Path)
    parser.add_argument("--registry-after", required=True, type=Path)
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--library-stage", required=True, type=Path)
    args = parser.parse_args()

    audit = load(args.audit)
    assert audit["sourcePhotoCount"] == 63
    assert audit["unmatchedProducts"] == []
    assert len(audit["publishedProducts"]) == 19
    assert len(audit["alternateProducts"]) == 2
    assert {row["sourceCode"] for row in audit["publishedProducts"]} == PUBLISHED_CODES
    assert {row["sourceCode"] for row in audit["alternateProducts"]} == ALTERNATE_CODES

    expected_paths = {
        row["sourceCode"]: row["galleryImages"]
        for row in audit["publishedProducts"]
    }
    expected_messages = set(range(3706, 3769))
    actual_messages = {
        message
        for row in audit["publishedProducts"] + audit["alternateProducts"]
        for message in row["messages"]
    }
    assert actual_messages == expected_messages, "Petya batch is incomplete or duplicated"

    baseline_public = git_json(args.repo_root, args.baseline_commit, "data/public-catalog.json")
    baseline_pages = git_json(args.repo_root, args.baseline_commit, "data/page-catalog.json")
    current_public = load(args.repo_root / "data/public-catalog.json")
    current_pages = load(args.repo_root / "data/page-catalog.json")
    verify_catalog_pair("public", baseline_public, current_public, expected_paths)
    verify_catalog_pair("pages", baseline_pages, current_pages, expected_paths)
    assert len(current_public["products"]) == 686
    assert len(current_pages["products"]) == 994

    master_before = load(args.master_before)
    master_after = load(args.master_after)
    verify_master(master_before, master_after, expected_paths)

    registry_before = load(args.registry_before)
    registry_after = load(args.registry_after)
    verify_registry(registry_before, registry_after, audit)

    for row in audit["publishedProducts"]:
        for message, relative, expected_hash in zip(
            row["messages"], row["galleryImages"], row["sha256"]
        ):
            source = args.source_dir / f"msg-{message}-telegram.jpg"
            destination = args.repo_root / relative
            assert source.is_file() and destination.is_file()
            assert sha256(source) == expected_hash == sha256(destination)

    all_rows = audit["publishedProducts"] + audit["alternateProducts"]
    for row in all_rows:
        for message, expected_hash in zip(row["messages"], row["sha256"]):
            source = args.source_dir / f"msg-{message}-telegram.jpg"
            staged = args.library_stage / expected_hash[:2] / f"{expected_hash}.jpg"
            assert sha256(source) == expected_hash == sha256(staged)

    tracked_asset_changes = subprocess.run(
        ["git", "diff", "--name-status", args.baseline_commit, "--", "assets"],
        cwd=args.repo_root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    expected_added_assets = {
        path.lstrip("/")
        for row in audit["publishedProducts"]
        for path in row["galleryImages"]
    }
    actual_added_assets = {
        line.split("\t", 1)[1]
        for line in tracked_asset_changes
        if line.startswith("A\t")
    }
    changed_existing_assets = [
        line for line in tracked_asset_changes if not line.startswith("A\t")
    ]
    assert not changed_existing_assets, (
        f"existing tracked assets changed: {changed_existing_assets}"
    )
    assert actual_added_assets == expected_added_assets, (
        "added asset set does not match the approved public galleries"
    )

    for document in (current_public, current_pages):
        assert "telegram-" not in json.dumps(document, ensure_ascii=False).lower()

    fa = by_code(current_public)["3281"]
    assert fa["title"] == "Fa Fresh Sport гель для душа, 250 мл"
    assert fa["unit"] == "250 мл"
    assert "Lemon Fresh" not in fa["title"]

    print(
        json.dumps(
            {
                "ok": True,
                "sourcePhotos": 63,
                "publishedProducts": 19,
                "publishedImages": 57,
                "alternateProducts": 2,
                "retailVisibleProducts": len(current_public["products"]),
                "persistentCards": len(master_after["products"]),
                "activeCards": 686,
                "inactiveCards": 309,
                "pricesStockAndOrderPreserved": True,
                "historicalGalleriesPreserved": True,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
