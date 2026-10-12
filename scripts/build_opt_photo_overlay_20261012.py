#!/usr/bin/env python3
"""Build a photo-only opt successor from the current verified production release."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


BASELINE = Path(
    "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/"
    "releases/2026-10-12-opt-fresh-arrivals-ledger-v2"
)
ROOT = Path(__file__).resolve().parents[1]
PROJECT = BASELINE.parents[1]
MASTER = PROJECT / "catalog-master.json"
REGISTRY = PROJECT / "product-photo-registry.json"
RELEASE_ID = "20261012-opt-petya-missing-photo-release-v1"
TARGET_CODES = {
    "3243",
    "3246",
    "3247",
    "3248",
    "3249",
    "3250",
    "3253",
    "3260",
    "3269",
    "3271",
    "3285",
    "3286",
    "3288",
}
NEW_RETAIL_CODES = {"3243", "3246", "3269", "3271", "3285", "3286", "3288"}
RESTORED_OPT_CODES = TARGET_CODES - NEW_RETAIL_CODES


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, payload: dict, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=None if compact else 2,
            separators=(",", ":") if compact else None,
        )
        + ("" if compact else "\n"),
        encoding="utf-8",
    )
    temporary.replace(path)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def by_code(document: dict) -> dict[str, dict]:
    return {
        str(item.get("sourceCode")): item
        for item in document.get("products", [])
        if item.get("sourceCode") not in (None, "")
    }


def non_photo_product(item: dict) -> dict:
    row = copy.deepcopy(item)
    row.pop("image", None)
    row.pop("galleryImages", None)
    return row


def absolute(path: str) -> str:
    return path if path.startswith(("http://", "https://")) else f"https://globalmarket.kg/{path.lstrip('/')}"


def write_checksums(root: Path) -> None:
    rows = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.name != "SHA256SUMS" and ".wrangler" not in path.parts:
            rows.append(f"{sha256(path)}  ./{path.relative_to(root).as_posix()}")
    (root / "SHA256SUMS").write_text("\n".join(rows) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", required=True, type=Path)
    args = parser.parse_args()
    root = args.candidate.resolve()
    baseline_catalog = load(BASELINE / "public/data/catalog.json")
    catalog_path = root / "public/data/catalog.json"
    catalog = load(catalog_path)
    if catalog != baseline_catalog:
        raise RuntimeError("Opt candidate is not an exact copy of the current production baseline")
    if len(catalog.get("products", [])) != 699 or len(catalog.get("groups", [])) != 17:
        raise RuntimeError("Unexpected production catalog size")
    if catalog["groups"][0].get("id") != "group-fresh-arrivals":
        raise RuntimeError("Mandatory fresh-arrivals group is not first")

    master = load(MASTER)
    master_index = by_code(master)
    catalog_index = by_code(catalog)
    if not TARGET_CODES <= set(catalog_index):
        raise RuntimeError(f"Target codes absent from opt: {sorted(TARGET_CODES - set(catalog_index))}")
    if not TARGET_CODES <= set(master_index):
        raise RuntimeError(f"Target codes absent from master: {sorted(TARGET_CODES - set(master_index))}")

    before_products = [non_photo_product(item) for item in catalog["products"]]
    before_groups = copy.deepcopy(catalog["groups"])
    updates = []
    for code in sorted(TARGET_CODES, key=int):
        source = master_index[code]
        gallery = source.get("galleryImages") or []
        if len(gallery) != 3 or source.get("image") != gallery[0]:
            raise RuntimeError(f"Retail master gallery is incomplete for {code}")
        for path in gallery:
            if not (Path(__file__).resolve().parents[1] / path).is_file():
                raise RuntimeError(f"Retail photo file is missing for {code}: {path}")
        target = catalog_index[code]
        previous = copy.deepcopy(target.get("galleryImages") or [])
        target["image"] = absolute(gallery[0])
        target["galleryImages"] = [absolute(path) for path in gallery]
        updates.append(
            {
                "sourceCode": code,
                "title": target.get("name1C") or target.get("title"),
                "action": "restore-opt" if code in RESTORED_OPT_CODES else "publish-both",
                "previousGallery": previous,
                "galleryImages": target["galleryImages"],
            }
        )

    if [non_photo_product(item) for item in catalog["products"]] != before_products:
        raise RuntimeError("A non-photo opt product field changed")
    if catalog["groups"] != before_groups:
        raise RuntimeError("Opt groups or fresh-arrivals selection changed")

    now = datetime.now(timezone.utc).isoformat()
    catalog["release"] = RELEASE_ID
    catalog["generatedAt"] = now
    write(catalog_path, catalog, compact=True)

    inventory_master_path = root / "inventory/catalog-master.json"
    inventory_master = load(inventory_master_path)
    inventory_index = by_code(inventory_master)
    for code in TARGET_CODES:
        if code not in inventory_index:
            continue
        source = master_index[code]
        inventory_index[code]["image"] = source["image"]
        inventory_index[code]["galleryImages"] = source["galleryImages"]
    write(inventory_master_path, inventory_master)
    shutil.copy2(REGISTRY, root / "inventory/product-photo-registry.json")

    manifest_path = root / "build-manifest.json"
    manifest = load(manifest_path)
    manifest.update(
        {
            "release": RELEASE_ID,
            "generatedAt": now,
            "parentRelease": "20261012-opt-fresh-arrivals-ledger-v2",
            "photoBackedProducts": sum(bool(item.get("image")) for item in catalog["products"]),
            "missingPhotoProducts": sum(not bool(item.get("image")) for item in catalog["products"]),
            "galleryImageReferenceCount": sum(len(item.get("galleryImages") or []) for item in catalog["products"]),
            "petyaMissingPhotoRelease": {
                "sourceCodes": sorted(TARGET_CODES, key=int),
                "newRetailAndOptCodes": sorted(NEW_RETAIL_CODES, key=int),
                "restoredOptOnlyCodes": sorted(RESTORED_OPT_CODES, key=int),
                "changedFields": ["image", "galleryImages"],
                "productCount": len(TARGET_CODES),
                "orderStockPricesGroupsFreshArrivalsAuthChanged": False,
            },
            "deployment": {
                "status": "not-deployed",
                "parentWorkerVersion": "e3587979-b459-4cbd-b44b-84f985277e51",
            },
        }
    )
    write(manifest_path, manifest)
    fresh_audit_path = root / "fresh-arrivals-audit.json"
    fresh_audit = load(fresh_audit_path)
    fresh_audit["release"] = RELEASE_ID
    fresh_audit["verifiedForPhotoOnlySuccessorAt"] = now
    write(fresh_audit_path, fresh_audit)
    write(
        root / "petya-missing-photo-audit.json",
        {
            "release": RELEASE_ID,
            "parentRelease": "20261012-opt-fresh-arrivals-ledger-v2",
            "generatedAt": now,
            "updates": updates,
            "catalogProductCount": len(catalog["products"]),
            "groupCount": len(catalog["groups"]),
            "freshProductCount": len(catalog["groups"][0]["productIds"]),
            "nonPhotoProductFieldsChanged": False,
            "groupsChanged": False,
        },
    )
    (root / "README.md").write_text(
        "# Global Market KG opt Petya missing-photo release\n\n"
        f"Release `{RELEASE_ID}` is a photo-only successor to "
        "`20261012-opt-fresh-arrivals-ledger-v2`. It publishes seven newly "
        "verified retail galleries and restores six already approved galleries "
        "that were absent only from opt. All 699 product records, 16 base groups, "
        "the 105-product fresh-arrivals group, exact 1C order, prices, stock, "
        "accounts, contractor scopes, cart, and order delivery are unchanged.\n",
        encoding="utf-8",
    )
    shutil.copy2(Path(__file__), root / "scripts/build_opt_photo_overlay_20261012.py")
    shutil.copy2(ROOT / "scripts/verify_opt_fresh_arrivals.py", root / "scripts/verify_opt_fresh_arrivals.py")
    write_checksums(root)
    print(
        json.dumps(
            {
                "release": RELEASE_ID,
                "products": len(catalog["products"]),
                "groups": len(catalog["groups"]),
                "freshProducts": len(catalog["groups"][0]["productIds"]),
                "photoUpdates": len(updates),
                "photoBackedProducts": manifest["photoBackedProducts"],
                "galleryReferences": manifest["galleryImageReferenceCount"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
