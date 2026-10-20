#!/usr/bin/env python3
"""Apply the second verified 2026-10-20 Petya photo batch."""

from __future__ import annotations

import argparse
import copy
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from apply_petya_photo_release_20261020 import (
    add_gallery,
    guard_product,
    load,
    make_files,
    non_allowed_snapshot,
    product_index,
    public_paths,
    sha256,
    source_file,
    version_id,
    write,
)


RELEASE_ID = "20261020-petya-photo-update-v2"
SOURCE_BATCH = "telegram-8767964230-20261020-160200"


PUBLISHED = {
    "3296": {
        "messages": (3771, 3772, 3773),
        "tokens": ("cherry blossom",),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3296-cherry-blossom-refill-20ml",
        "note": "Fiori di Ciliegio / Cherry Blossom electric refill, 20 ml.",
    },
    "3297": {
        "messages": (3774, 3775, 3776),
        "tokens": ("white musk",),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3297-white-musk-refill-20ml",
        "note": "Muschio Bianco / White Musk electric refill, 20 ml.",
    },
    "3295": {
        "messages": (3777, 3778, 3779),
        "tokens": ("lavender/iris",),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3295-lavender-iris-refill-20ml",
        "note": "Lavanda e Iris / Lavender & Iris electric refill, 20 ml.",
    },
    "3292": {
        "messages": (3780, 3781, 3782),
        "tokens": ("750g", "pink powder"),
        "stem": "assets/products/vanish/vanish-3292-oxi-action-pink-powder-750g",
        "note": "Vanish Oxi Action pink stain-remover powder, 750 g.",
    },
    "3291": {
        "messages": (3783, 3784, 3785),
        "tokens": ("900ml", "sensitive cotton"),
        "stem": "assets/products/lenor/lenor-3291-sensitive-cotton-washing-liquid-900ml",
        "note": "Lenor Sensitive Cotton washing liquid, 900 ml / 20 washes.",
    },
    "3302": {
        "messages": (3786, 3787, 3788),
        "tokens": ("bamboo & lotus", "125ml"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3302-bamboo-lotus-diffuser-120ml",
        "note": (
            "Bamboo & Lotus reed diffuser. The photographed package says 120 ml; "
            "the retained 1C source row says 125 ml. Identity is exact by stable code "
            "and variant; this photo-only release does not rewrite 1C presentation data."
        ),
    },
    "3304": {
        "messages": (3789, 3790, 3791),
        "tokens": ("air spray refill", "classic"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3304-classico-spray-refill-250ml",
        "note": "Classico automatic spray refill, 250 ml.",
    },
    "3305": {
        "messages": (3792, 3793, 3794),
        "tokens": ("air spray refill", "white tea"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3305-white-tea-osmanthus-spray-refill-250ml",
        "note": "White Tea & Osmanthus automatic spray refill, 250 ml.",
    },
    "3306": {
        "messages": (3795, 3796, 3797),
        "tokens": ("air spray refill", "bamboo"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3306-bamboo-lotus-spray-refill-250ml",
        "note": "Bamboo & Lotus automatic spray refill, 250 ml.",
    },
    "3308": {
        "messages": (3798, 3799, 3800),
        "tokens": ("air spray refill", "moon flower"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3308-moon-flowers-spray-refill-250ml",
        "note": "Fiori di Luna / Moon Flowers automatic spray refill, 250 ml.",
    },
    "3307": {
        "messages": (3801, 3802, 3803),
        "tokens": ("air spray refill", "sea salt"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3307-sea-salt-magnolia-spray-refill-250ml",
        "note": "Sea Salts & Magnolia automatic spray refill, 250 ml.",
    },
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--registry", required=True, type=Path)
    parser.add_argument("--library-stage", required=True, type=Path)
    parser.add_argument("--audit", required=True, type=Path)
    args = parser.parse_args()

    documents = {
        "master": load(args.master),
        "public": load(args.repo_root / "data/public-catalog.json"),
        "pages": load(args.repo_root / "data/page-catalog.json"),
    }
    registry = load(args.registry)
    before = {name: non_allowed_snapshot(doc) for name, doc in documents.items()}
    indexes = {name: product_index(doc) for name, doc in documents.items()}
    recorded_at = datetime.now(timezone.utc).isoformat()
    published_rows = []

    for code, meta in PUBLISHED.items():
        master_product = indexes["master"].get(code)
        if not master_product:
            raise RuntimeError(f"1C code {code} is absent from the persistent master")
        guard_product(master_product, meta["tokens"], code)
        if master_product.get("inStock") is not True or float(
            master_product.get("stockQuantity") or 0
        ) <= 0:
            raise RuntimeError(f"1C code {code} is not currently in stock")
        if master_product.get("galleryImages"):
            raise RuntimeError(f"1C code {code} already has an active gallery")

        paths = public_paths(meta["stem"])
        files = make_files(
            args.source_dir, args.library_stage, meta["messages"], paths
        )
        for file_info, relative in zip(files, paths):
            destination = args.repo_root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            source = source_file(args.source_dir, file_info["telegramMessageId"])
            shutil.copy2(source, destination)
            if sha256(destination) != file_info["sha256"]:
                raise RuntimeError(f"Copied photo hash mismatch: {destination}")

        for name, index in indexes.items():
            product = index.get(code)
            if not product:
                raise RuntimeError(f"1C code {code} is absent from {name}")
            product["image"] = paths[0]
            product["galleryImages"] = copy.deepcopy(paths)

        gallery = {
            "versionId": version_id(files),
            "status": "active",
            "recordedAt": recorded_at,
            "sourceBatch": SOURCE_BATCH,
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
            },
        )
        add_gallery(record, gallery, activate=True)
        record.update(
            {
                "productId": master_product.get("id"),
                "titleSnapshot": indexes["master"][code].get("title"),
                "currentlyInStock": True,
                "lastSeenStockDate": master_product.get("lastStockDate"),
            }
        )
        published_rows.append(
            {
                "sourceCode": code,
                "title": indexes["master"][code].get("title"),
                "messages": list(meta["messages"]),
                "galleryImages": paths,
                "versionId": gallery["versionId"],
                "sha256": [item["sha256"] for item in files],
                "note": meta["note"],
            }
        )

    for name, document in documents.items():
        if before[name] != non_allowed_snapshot(document):
            raise RuntimeError(f"Unexpected non-photo fields changed in {name}")

    documents["master"]["updatedAt"] = recorded_at
    documents["master"]["sourceRelease"] = RELEASE_ID
    registry["updatedAt"] = recorded_at
    registry["latestPhotoBatch"] = {
        "id": RELEASE_ID,
        "sourceBatches": [SOURCE_BATCH],
        "approvedSourceCodes": list(PUBLISHED),
        "approvedProducts": len(PUBLISHED),
        "alternateSourceCodes": [],
        "alternateProducts": 0,
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
            bool(record.get("sourceCode"))
            for record in registry.get("products", {}).values()
        ),
        "canonicalAssets": len(canonical_paths),
        "pendingGalleries": len(registry.get("pendingPhotos", [])),
        "currentlyInStock": sum(
            record.get("currentlyInStock") is True
            for record in registry.get("products", {}).values()
        ),
    }

    write(args.master, documents["master"])
    write(args.repo_root / "data/public-catalog.json", documents["public"])
    write(args.repo_root / "data/page-catalog.json", documents["pages"])
    write(args.registry, registry)
    write(
        args.audit,
        {
            "release": RELEASE_ID,
            "generatedAt": recorded_at,
            "sourceBatch": SOURCE_BATCH,
            "sourcePhotoCount": 33,
            "publishedProducts": published_rows,
            "alternateProducts": [],
            "changedFields": ["image", "galleryImages"],
            "labelDiscrepancies": [
                {
                    "sourceCode": "3302",
                    "photoLabel": "120 ml",
                    "source1CLabel": "125 ml",
                    "action": "Photos matched by stable code and exact variant; 1C presentation retained.",
                }
            ],
            "unmatchedProducts": [],
        },
    )
    print(
        json.dumps(
            {
                "publishedGalleries": len(published_rows),
                "publishedImages": len(published_rows) * 3,
                "registryStats": registry["stats"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
