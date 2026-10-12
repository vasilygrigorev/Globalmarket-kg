#!/usr/bin/env python3
"""Apply the verified Oct 12 Petya galleries without touching inventory data."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT = Path(
    "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG"
)
MASTER_PATH = PROJECT / "catalog-master.json"
REGISTRY_PATH = PROJECT / "product-photo-registry.json"
TODAY = ROOT / "assets/telegram_inbox/telegram-8767964230-20261012-120110"
YESTERDAY = ROOT / "assets/telegram_inbox/telegram-8767964230-20261011-124001"
YESTERDAY_2 = ROOT / "assets/telegram_inbox/telegram-8767964230-20261011-124316"
ROLES = ("card-front", "front", "back")


PUBLISHED = {
    "3246": {
        "titleToken": "Extra Stain Removal",
        "messages": (3668, 3669, 3670),
        "sourceDir": TODAY,
        "stem": "assets/products/ariel/ariel-pods-44-extra-stain-removal",
        "sourceBatch": "telegram-8767964230-20261012-120110",
        "note": "Exact 1C variant and 44-count package.",
    },
    "3243": {
        "titleToken": "Original Todoen1",
        "messages": (3671, 3672, 3673),
        "sourceDir": TODAY,
        "stem": "assets/products/ariel/ariel-pods-44-original-todoen1",
        "sourceBatch": "telegram-8767964230-20261012-120110",
        "note": "Exact 1C variant and 44-count package.",
    },
    "3285": {
        "titleToken": "Moonlight Lily",
        "messages": (3680, 3681, 3682),
        "sourceDir": TODAY,
        "stem": "assets/products/lenor/lenor-softener-moonlight-lily-504g-v2",
        "sourceBatch": "telegram-8767964230-20261012-120110",
        "note": "Current Moonlight 36-wash set replaces the wrongly assigned Eclat de Minuit set.",
    },
    "3286": {
        "titleToken": "Eclat de minuit",
        "messages": (3537, 3538, 3539),
        "sourceDir": YESTERDAY,
        "stem": "assets/products/lenor/lenor-softener-eclat-de-minuit-504g",
        "sourceBatch": "telegram-8767964230-20261011-124001",
        "note": "Package face explicitly says Eclat de Minuit; corrected from the former 3285 assignment.",
    },
    "3271": {
        "titleToken": "Summer Night",
        "messages": (3695, 3696, 3697),
        "sourceDir": TODAY,
        "stem": "assets/products/felce-azzurra/felce-azzurra-air-freshener-gel-summer-night-140g",
        "sourceBatch": "telegram-8767964230-20261012-120110",
        "note": "Exact 140 g Summer Night air-freshener gel.",
    },
    "3269": {
        "titleToken": "Cherry Bloss",
        "messages": (3698, 3699, 3700),
        "sourceDir": TODAY,
        "stem": "assets/products/felce-azzurra/felce-azzurra-air-freshener-gel-cherry-blossom-140g",
        "sourceBatch": "telegram-8767964230-20261012-120110",
        "note": "Exact 140 g Cherry Blossom air-freshener gel.",
    },
    "3288": {
        "titleToken": "Alpine Breeze",
        "messages": (3701, 3702, 3703),
        "sourceDir": TODAY,
        "stem": "assets/products/lenor/lenor-softener-alpine-breeze-840g-60",
        "sourceBatch": "telegram-8767964230-20261012-120110",
        "note": "Exact Alpine Breeze 60-wash package.",
    },
}


PENDING = (
    {
        "pendingId": "pending-20261011-felce-liquid-soap-refill-classic-500ml",
        "label": "Felce Azzurra Classico liquid soap refill, 500 ml",
        "reason": "No exact current or retained 1C source code exists.",
        "messages": (3560, 3561, 3562),
        "sourceDir": YESTERDAY_2,
        "sourceBatch": "telegram-8767964230-20261011-124316",
    },
    {
        "pendingId": "pending-20261011-felce-diffuser-bamboo-lotus-120ml",
        "label": "Felce Azzurra diffuser Bamboo & Lotus, 120 ml",
        "reason": "No exact current or retained 1C source code exists; 125 ml variants are different SKUs.",
        "messages": (3572, 3573, 3574),
        "sourceDir": YESTERDAY_2,
        "sourceBatch": "telegram-8767964230-20261011-124316",
    },
    {
        "pendingId": "pending-20261011-fa-fresh-sport-250ml",
        "label": "Fa Fresh Sport shower gel, 250 ml",
        "reason": "No exact current or retained 1C source code exists.",
        "messages": (3627, 3628, 3629),
        "sourceDir": YESTERDAY_2,
        "sourceBatch": "telegram-8767964230-20261011-124316",
    },
    {
        "pendingId": "pending-20261012-ariel-pods-original-60",
        "label": "Ariel All-in-1 PODS Original, 60 capsules",
        "reason": "Current 1C has Mountain Spring 60 and Lenor Anti-Odor 60, but no exact Original 60 SKU.",
        "messages": (3686, 3687, 3688),
        "sourceDir": TODAY,
        "sourceBatch": "telegram-8767964230-20261012-120110",
    },
)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_file(source_dir: Path, message: int) -> Path:
    path = source_dir / f"msg-{message}-telegram.jpg"
    if not path.is_file():
        raise RuntimeError(f"Missing Petya source: {path}")
    return path


def canonical_file(source: Path, digest: str) -> Path:
    suffix = source.suffix.lower() or ".jpg"
    target = PROJECT / "product-photo-library" / digest[:2] / f"{digest}{suffix}"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and sha256(target) != digest:
        raise RuntimeError(f"Canonical photo hash collision: {target}")
    if not target.exists():
        shutil.copy2(source, target)
    return target


def make_files(meta: dict, public_paths: list[str] | None) -> list[dict]:
    files = []
    if len(meta["messages"]) != len(ROLES):
        raise RuntimeError(f"Expected three Petya messages: {meta['messages']}")
    for index, (role, message) in enumerate(zip(ROLES, meta["messages"])):
        source = source_file(meta["sourceDir"], message)
        digest = sha256(source)
        canonical = canonical_file(source, digest)
        files.append(
            {
                "role": role,
                "sha256": digest,
                "canonicalPath": canonical.relative_to(PROJECT).as_posix(),
                "publicPath": public_paths[index] if public_paths else None,
                "telegramMessageId": message,
                "source": str(source),
                "rotation180": False,
            }
        )
    return files


def public_paths(stem: str) -> list[str]:
    return [f"{stem}-{role}.jpg" for role in ROLES]


def version_id(files: list[dict]) -> str:
    return hashlib.sha256("|".join(item["sha256"] for item in files).encode()).hexdigest()[:16]


def product_index(document: dict) -> dict[str, dict]:
    rows = {
        str(item.get("sourceCode")): item
        for item in document.get("products", [])
        if item.get("sourceCode") not in (None, "")
    }
    if len(rows) != sum(
        item.get("sourceCode") not in (None, "") for item in document.get("products", [])
    ):
        raise RuntimeError("Duplicate sourceCode in catalog")
    return rows


def non_photo_snapshot(document: dict) -> dict[str, dict]:
    snapshot = {}
    for code, item in product_index(document).items():
        row = copy.deepcopy(item)
        row.pop("image", None)
        row.pop("galleryImages", None)
        snapshot[code] = row
    return snapshot


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", required=True, type=Path)
    args = parser.parse_args()

    documents = {
        "master": load(MASTER_PATH),
        "public": load(ROOT / "data/public-catalog.json"),
        "pages": load(ROOT / "data/page-catalog.json"),
    }
    registry = load(REGISTRY_PATH)
    before = {name: non_photo_snapshot(doc) for name, doc in documents.items()}
    indexes = {name: product_index(doc) for name, doc in documents.items()}
    changed = []

    for code, meta in PUBLISHED.items():
        master_product = indexes["master"].get(code)
        if not master_product:
            raise RuntimeError(f"1C code {code} is absent from the persistent master")
        if meta["titleToken"].lower() not in str(master_product.get("title") or "").lower():
            raise RuntimeError(f"Title guard failed for {code}: {master_product.get('title')}")
        paths = public_paths(meta["stem"])
        files = make_files(meta, paths)
        for source, relative in zip(files, paths):
            destination = ROOT / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_file(meta["sourceDir"], source["telegramMessageId"]), destination)
            if sha256(destination) != source["sha256"]:
                raise RuntimeError(f"Copied photo hash mismatch: {destination}")

        previous_gallery = copy.deepcopy(master_product.get("galleryImages") or [])
        for name, index in indexes.items():
            product = index.get(code)
            if not product:
                if name == "public":
                    continue
                raise RuntimeError(f"1C code {code} is absent from {name}")
            product["image"] = paths[0]
            product["galleryImages"] = paths

        gallery = {
            "versionId": version_id(files),
            "status": "active",
            "recordedAt": datetime.now(timezone.utc).isoformat(),
            "sourceBatch": meta["sourceBatch"],
            "note": meta["note"],
            "files": files,
        }
        record = registry.setdefault("products", {}).setdefault(
            code,
            {
                "sourceCode": code,
                "productId": master_product.get("id"),
                "titleSnapshot": master_product.get("title"),
                "activeGalleryVersion": None,
                "galleries": [],
                "currentlyInStock": master_product.get("inStock") is not False,
            },
        )
        for existing in record.get("galleries", []):
            if existing.get("status") == "active" and existing.get("versionId") != gallery["versionId"]:
                existing["status"] = "reassigned" if code == "3285" else "superseded"
                existing["statusNote"] = (
                    "Visible package says Eclat de Minuit; reassigned to sourceCode 3286."
                    if code == "3285"
                    else "Replaced by a newer exact approved gallery."
                )
        if not any(item.get("versionId") == gallery["versionId"] for item in record.get("galleries", [])):
            record.setdefault("galleries", []).append(gallery)
        else:
            for existing in record["galleries"]:
                if existing.get("versionId") == gallery["versionId"]:
                    existing.update(gallery)
        record.update(
            {
                "productId": master_product.get("id"),
                "titleSnapshot": master_product.get("title"),
                "activeGalleryVersion": gallery["versionId"],
                "currentlyInStock": master_product.get("inStock") is not False,
            }
        )
        changed.append(
            {
                "sourceCode": code,
                "title": master_product.get("title"),
                "messages": list(meta["messages"]),
                "previousGallery": previous_gallery,
                "galleryImages": paths,
                "sha256": [item["sha256"] for item in files],
                "note": meta["note"],
            }
        )

    pending_rows = registry.setdefault("pendingPhotos", [])
    pending_ids = {item.get("pendingId") for item in pending_rows}
    pending_added = []
    for meta in PENDING:
        if meta["pendingId"] in pending_ids:
            continue
        files = make_files(meta, None)
        row = {
            "pendingId": meta["pendingId"],
            "label": meta["label"],
            "reason": meta["reason"],
            "gallery": {
                "versionId": version_id(files),
                "status": "pending",
                "recordedAt": datetime.now(timezone.utc).isoformat(),
                "sourceBatch": meta["sourceBatch"],
                "telegramMessages": list(meta["messages"]),
                "files": files,
            },
        }
        pending_rows.append(row)
        pending_added.append(row)

    for name, document in documents.items():
        after = non_photo_snapshot(document)
        if before[name] != after:
            raise RuntimeError(f"Non-photo fields changed in {name}")

    now = datetime.now(timezone.utc).isoformat()
    documents["master"]["updatedAt"] = now
    documents["master"]["sourceRelease"] = "20261012-petya-missing-photo-release-v1"
    registry["updatedAt"] = now
    registry["latestPhotoBatch"] = {
        "id": "2026-10-12-petya-missing-photo-release-v1",
        "sourceBatches": sorted({meta["sourceBatch"] for meta in PUBLISHED.values()}),
        "approvedSourceCodes": list(PUBLISHED),
        "approvedProducts": len(PUBLISHED),
        "pendingProductsAdded": len(pending_added),
        "contract": "card image first, then plain front and back",
    }
    canonical_paths = {
        file.get("canonicalPath")
        for record in registry.get("products", {}).values()
        for gallery in record.get("galleries", [])
        for file in gallery.get("files", [])
        if file.get("canonicalPath")
    }
    canonical_paths.update(
        file.get("canonicalPath")
        for row in registry.get("pendingPhotos", [])
        for file in row.get("gallery", {}).get("files", [])
        if file.get("canonicalPath")
    )
    registry["stats"] = {
        "productRecords": len(registry.get("products", {})),
        "codeMappedRecords": sum(
            bool(record.get("sourceCode")) for record in registry.get("products", {}).values()
        ),
        "canonicalAssets": len(canonical_paths),
        "pendingGalleries": len(registry.get("pendingPhotos", [])),
    }

    write(MASTER_PATH, documents["master"])
    write(ROOT / "data/public-catalog.json", documents["public"])
    write(ROOT / "data/page-catalog.json", documents["pages"])
    write(REGISTRY_PATH, registry)
    write(
        args.audit,
        {
            "release": "20261012-petya-missing-photo-release-v1",
            "generatedAt": now,
            "publishedProducts": changed,
            "pendingPhotosAdded": pending_added,
            "changedFields": ["image", "galleryImages"],
            "nonPhotoCatalogFieldsChanged": False,
        },
    )
    print(
        json.dumps(
            {
                "publishedGalleries": len(changed),
                "publishedImages": len(changed) * 3,
                "pendingAdded": len(pending_added),
                "registryStats": registry["stats"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
