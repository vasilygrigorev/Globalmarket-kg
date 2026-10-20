#!/usr/bin/env python3
"""Fail-closed verification for the second 2026-10-20 photo release."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import subprocess
from pathlib import Path


PUBLISHED_CODES = {
    "3296", "3297", "3295", "3292", "3291", "3302",
    "3304", "3305", "3306", "3308", "3307",
}
PHOTO_FIELDS = {"image", "galleryImages"}
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


def without_photo_fields(row: dict) -> dict:
    value = copy.deepcopy(row)
    for field in PHOTO_FIELDS:
        value.pop(field, None)
    return value


def product_order(document: dict) -> list[str]:
    return [str(row.get("sourceCode") or row.get("id")) for row in document["products"]]


def verify_catalog(
    label: str,
    before: dict,
    after: dict,
    paths: dict[str, list[str]],
    ignored_top_fields: set[str] | None = None,
) -> None:
    ignored_top_fields = ignored_top_fields or set()
    assert product_order(before) == product_order(after), f"{label}: order changed"
    assert {
        k: v
        for k, v in before.items()
        if k != "products" and k not in ignored_top_fields
    } == {
        k: v
        for k, v in after.items()
        if k != "products" and k not in ignored_top_fields
    }, f"{label}: top-level data changed"
    old_rows, new_rows = by_code(before), by_code(after)
    assert old_rows.keys() == new_rows.keys(), f"{label}: product set changed"
    for code, old in old_rows.items():
        new = new_rows[code]
        if code in PUBLISHED_CODES:
            assert without_photo_fields(old) == without_photo_fields(new), (
                f"{label}: non-photo field changed for {code}"
            )
            assert not (old.get("galleryImages") or []), f"{label}: {code} already pictured"
            assert new.get("galleryImages") == paths[code]
            assert new.get("image") == paths[code][0]
        else:
            assert old == new, f"{label}: unrelated product changed: {code}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--baseline-commit", default="c4e7d6c")
    parser.add_argument("--master-before", required=True, type=Path)
    parser.add_argument("--master-after", required=True, type=Path)
    parser.add_argument("--registry-before", required=True, type=Path)
    parser.add_argument("--registry-after", required=True, type=Path)
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--library-stage", required=True, type=Path)
    args = parser.parse_args()

    audit = load(args.audit)
    assert audit["sourcePhotoCount"] == 33
    assert audit["unmatchedProducts"] == []
    assert len(audit["publishedProducts"]) == 11
    assert audit["alternateProducts"] == []
    assert {row["sourceCode"] for row in audit["publishedProducts"]} == PUBLISHED_CODES
    expected_messages = set(range(3771, 3804))
    actual_messages = {
        message for row in audit["publishedProducts"] for message in row["messages"]
    }
    assert actual_messages == expected_messages, "Petya batch is incomplete or duplicated"
    paths = {row["sourceCode"]: row["galleryImages"] for row in audit["publishedProducts"]}

    baseline_public = git_json(args.repo_root, args.baseline_commit, "data/public-catalog.json")
    baseline_pages = git_json(args.repo_root, args.baseline_commit, "data/page-catalog.json")
    current_public = load(args.repo_root / "data/public-catalog.json")
    current_pages = load(args.repo_root / "data/page-catalog.json")
    verify_catalog("public", baseline_public, current_public, paths)
    verify_catalog("pages", baseline_pages, current_pages, paths)
    assert len(current_public["products"]) == 686
    assert len(current_pages["products"]) == 994

    master_before = load(args.master_before)
    master_after = load(args.master_after)
    verify_catalog(
        "master",
        master_before,
        master_after,
        paths,
        ignored_top_fields={"updatedAt", "sourceRelease"},
    )
    assert len(master_after["products"]) == 995
    assert master_after.get("sourceRelease") == "20261020-petya-photo-update-v2"
    assert sum(row.get("status") == "active" and row.get("inStock") is True for row in master_after["products"]) == 686
    assert sum(row.get("status") != "active" or row.get("inStock") is not True for row in master_after["products"]) == 309

    registry_before = load(args.registry_before)
    registry_after = load(args.registry_after)
    before_products = registry_before.get("products", {})
    after_products = registry_after.get("products", {})
    for code, old in before_products.items():
        if code not in PUBLISHED_CODES:
            assert after_products.get(code) == old, f"registry drift for {code}"
    for row in audit["publishedProducts"]:
        code = row["sourceCode"]
        record = after_products[code]
        assert record["activeGalleryVersion"] == row["versionId"]
        gallery = next(item for item in record["galleries"] if item["versionId"] == row["versionId"])
        assert gallery["status"] == "active"
        assert [item["role"] for item in gallery["files"]] == EXPECTED_ROLES
        old_record = before_products.get(code)
        if old_record:
            old_versions = {item["versionId"] for item in old_record.get("galleries", [])}
            new_versions = {item["versionId"] for item in record.get("galleries", [])}
            assert old_versions <= new_versions, f"registry history lost for {code}"
    latest = registry_after["latestPhotoBatch"]
    assert latest["approvedSourceCodes"] == [row["sourceCode"] for row in audit["publishedProducts"]]
    assert latest["alternateSourceCodes"] == []

    for row in audit["publishedProducts"]:
        for message, relative, expected_hash in zip(
            row["messages"], row["galleryImages"], row["sha256"]
        ):
            source = args.source_dir / f"msg-{message}-telegram.jpg"
            destination = args.repo_root / relative
            staged = args.library_stage / expected_hash[:2] / f"{expected_hash}.jpg"
            assert source.is_file() and destination.is_file() and staged.is_file()
            assert sha256(source) == expected_hash == sha256(destination) == sha256(staged)

    asset_changes = subprocess.run(
        ["git", "diff", "--name-status", args.baseline_commit, "--", "assets"],
        cwd=args.repo_root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    expected_assets = {
        path for row in audit["publishedProducts"] for path in row["galleryImages"]
    }
    actual_added = {line.split("\t", 1)[1] for line in asset_changes if line.startswith("A\t")}
    changed_existing = [line for line in asset_changes if not line.startswith("A\t")]
    assert not changed_existing, f"existing assets changed: {changed_existing}"
    assert actual_added == expected_assets, "added asset set differs from approved galleries"

    assert "telegram-" not in json.dumps(current_public, ensure_ascii=False).lower()
    print(json.dumps({
        "ok": True,
        "sourcePhotos": 33,
        "publishedProducts": 11,
        "publishedImages": 33,
        "retailVisibleProducts": 686,
        "persistentCards": 995,
        "pricesStockAndOrderPreserved": True,
        "historicalGalleriesPreserved": True,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
