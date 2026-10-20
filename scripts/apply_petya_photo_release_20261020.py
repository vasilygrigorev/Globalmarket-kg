#!/usr/bin/env python3
"""Apply the verified 2026-10-20 Petya photo batch to an isolated release tree."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


RELEASE_ID = "20261020-petya-photo-update-v1"
ROLES = ("card-front", "front", "back")


PUBLISHED = {
    "3299": {
        "messages": (3706, 3707, 3708),
        "tokens": ("moon flowers",),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3299-moon-flowers-refill-20ml",
        "note": "Fiori di Luna / Moon Flowers electric diffuser refill, 20 ml.",
    },
    "3294": {
        "messages": (3709, 3710, 3711),
        "tokens": ("classic",),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3294-classico-refill-20ml",
        "note": "Classico electric diffuser refill, 20 ml.",
    },
    "3298": {
        "messages": (3712, 3713, 3714),
        "tokens": ("vanilla",),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3298-vanilla-monoi-refill-20ml",
        "note": "Vaniglia e Monoi electric diffuser refill, 20 ml.",
    },
    "3261": {
        "messages": (3715, 3716, 3717),
        "tokens": ("platinum kitchen cleaner", "750ml"),
        "stem": "assets/products/the-pink-stuff/the-pink-stuff-3261-platinum-kitchen-cleaner-750ml",
        "note": "Exact Platinum Kitchen Cleaner 750 ml package.",
    },
    "3262": {
        "messages": (3718, 3719, 3720),
        "tokens": ("almond & white", "650ml"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3262-almond-white-tea-650ml",
        "note": "Exact Almond & White Tea shower gel 650 ml package for the current 1C row.",
    },
    "3281": {
        "messages": (3724, 3725, 3726),
        "tokens": ("fresh sport", "250"),
        "stem": "assets/products/fa/fa-3281-fresh-sport-shower-gel-250ml",
        "note": "Exact Fa Men Fresh Sport shower gel 250 ml package.",
        "presentation": {
            "title": "Fa Fresh Sport гель для душа, 250 мл",
            "unit": "250 мл",
            "description": (
                "Fa Men Fresh Sport — мужской гель для душа с освежающим ароматом "
                "лайма и мяты. Мягко очищает кожу и подходит для ежедневного "
                "использования. Объём 250 мл; нанесите на влажную кожу, вспеньте и "
                "смойте водой."
            ),
            "searchText": (
                "fa fresh sport гель для душа 250 мл мужской lime mint лайм мята "
                "уход за телом ванная"
            ),
            "searchTerms": [
                "fa",
                "fresh",
                "sport",
                "гель",
                "душа",
                "250",
                "мл",
                "лайм",
                "мята",
            ],
        },
    },
    "3100": {
        "messages": (3727, 3728, 3729),
        "tokens": ("rollon", "fresco"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3100-deo-rollon-fresco-50ml",
        "note": "Exact Fresco roll-on deodorant 50 ml package.",
    },
    "3270": {
        "messages": (3730, 3731, 3732),
        "tokens": ("white musk", "140g"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3270-white-musk-gel-140g",
        "note": "Exact White Musk air-freshener gel 140 g package.",
    },
    "2961": {
        "messages": (3733, 3734, 3735),
        "tokens": ("ice cool", "40"),
        "stem": "assets/products/rexona/rexona-2961-men-ice-cool-stick-40g",
        "note": "Exact Rexona Men Ice Cool stick 40 g package.",
    },
    "1248": {
        "messages": (3736, 3737, 3738),
        "tokens": ("invisible black", "40"),
        "stem": "assets/products/rexona/rexona-1248-invisible-black-white-stick-40g",
        "note": "Exact Invisible on Black + White Clothes stick 40 g package.",
    },
    "3062": {
        "messages": (3742, 3743, 3744),
        "tokens": ("kernseife", "125"),
        "stem": "assets/products/dalli/dalli-3062-kernseife-125g",
        "note": "Exact Dalli Haushalts Kernseife 125 g package.",
    },
    "3268": {
        "messages": (3745, 3746, 3747),
        "tokens": ("orchid", "220"),
        "stem": "assets/products/felce-azzurra/felce-azzurra-3268-orchid-laundry-fragrance-220ml",
        "note": "Exact Orchid Nera laundry fragrance 220 ml package.",
    },
    "1212": {
        "messages": (3748, 3749, 3750),
        "tokens": ("suave", "122"),
        "stem": "assets/products/axe/axe-1212-signature-suave-122ml",
        "note": "Exact yellow Signature Suave 122 ml package; not the red Intense variant.",
    },
    "1155": {
        "messages": (3751, 3752, 3753),
        "tokens": ("invisible b&w", "200"),
        "stem": "assets/products/rexona/rexona-1155-advanced-protection-invisible-200ml",
        "note": "Exact Advanced Protection Invisible aerosol 200 ml package.",
    },
    "3233": {
        "messages": (3754, 3755, 3756),
        "tokens": ("backofen", "375"),
        "stem": "assets/products/dr-beckmann/dr-beckmann-3233-backofen-grill-power-gel-375ml",
        "note": "Exact Backofen & Grill Power-Gel 375 ml package.",
    },
    "3231": {
        "messages": (3757, 3758, 3759),
        "tokens": ("intensiv glas", "250"),
        "stem": "assets/products/dr-beckmann/dr-beckmann-3231-intensiv-glaskeramik-edelstahl-250ml",
        "note": "Exact Intensiv Glaskeramik & Edelstahl Reiniger 250 ml package.",
    },
    "3227": {
        "messages": (3760, 3761, 3762),
        "tokens": ("washing machine cleaner", "vinegar"),
        "stem": "assets/products/dr-beckmann/dr-beckmann-3227-washing-machine-cleaner-vinegar-250ml",
        "note": "Exact Washing Machine Cleaner Vinegar Power 250 ml package.",
    },
    "1940": {
        "messages": (3763, 3764, 3765),
        "tokens": ("5.5kg", "110", "color"),
        "stem": "assets/products/dash/dash-1940-color-frische-5-5kg-110",
        "note": "Exact Dash Color Frische powder 5.5 kg / 110 washes package.",
    },
    "3064": {
        "messages": (3766, 3767, 3768),
        "tokens": ("2.25l", "50", "vollwaschmittel"),
        "stem": "assets/products/dalli/dalli-3064-vollwaschmittel-gel-2-25l-50",
        "note": "Exact Dalli Vollwaschmittel gel 2.25 L / 50 washes package.",
    },
}


ALTERNATES = {
    "3092": {
        "messages": (3721, 3722, 3723),
        "tokens": ("window cleaning kit", "850"),
        "note": "Duplicate exact product intake; the approved active public gallery is retained.",
    },
    "2527": {
        "messages": (3739, 3740, 3741),
        "tokens": ("colorwaschmittel", "1.1"),
        "note": "New packaging photos for the same exact 1.1 L product; the approved active public gallery is retained.",
    },
}


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


def version_id(files: list[dict]) -> str:
    joined = "|".join(item["sha256"] for item in files)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:16]


def product_index(document: dict) -> dict[str, dict]:
    rows = {
        str(item.get("sourceCode")): item
        for item in document.get("products", [])
        if item.get("sourceCode") not in (None, "")
    }
    expected = sum(
        item.get("sourceCode") not in (None, "")
        for item in document.get("products", [])
    )
    if len(rows) != expected:
        raise RuntimeError("Duplicate sourceCode in catalog")
    return rows


def non_allowed_snapshot(document: dict) -> dict[str, dict]:
    snapshot = {}
    for code, item in product_index(document).items():
        row = copy.deepcopy(item)
        row.pop("image", None)
        row.pop("galleryImages", None)
        if code == "3281":
            for key in ("title", "unit", "description", "searchText", "searchTerms"):
                row.pop(key, None)
        snapshot[code] = row
    return snapshot


def guard_product(product: dict, tokens: tuple[str, ...], code: str) -> None:
    haystack = " ".join(
        str(product.get(key) or "")
        for key in ("sourceName1C", "sourceRawName1C", "title", "description")
    ).lower()
    missing = [token for token in tokens if token.lower() not in haystack]
    if missing:
        raise RuntimeError(
            f"Identity guard failed for {code}; missing {missing}: {haystack}"
        )


def public_paths(stem: str) -> list[str]:
    return [f"{stem}-{role}.jpg" for role in ROLES]


def make_files(
    source_dir: Path,
    library_stage: Path,
    messages: tuple[int, int, int],
    public: list[str] | None,
) -> list[dict]:
    files = []
    for index, (role, message) in enumerate(zip(ROLES, messages)):
        source = source_file(source_dir, message)
        digest = sha256(source)
        staged = library_stage / digest[:2] / f"{digest}.jpg"
        staged.parent.mkdir(parents=True, exist_ok=True)
        if not staged.exists():
            shutil.copy2(source, staged)
        if sha256(staged) != digest:
            raise RuntimeError(f"Staged photo hash mismatch: {staged}")
        files.append(
            {
                "role": role,
                "sha256": digest,
                "canonicalPath": f"product-photo-library/{digest[:2]}/{digest}.jpg",
                "publicPath": public[index] if public else None,
                "telegramMessageId": message,
                "source": str(source),
                "rotation180": False,
            }
        )
    return files


def add_gallery(record: dict, gallery: dict, activate: bool) -> None:
    galleries = record.setdefault("galleries", [])
    if any(item.get("versionId") == gallery["versionId"] for item in galleries):
        return
    if activate:
        for existing in galleries:
            if existing.get("status") == "active":
                existing["status"] = "superseded"
                existing["statusNote"] = "Replaced by the approved 2026-10-20 exact gallery."
    galleries.append(gallery)
    if activate:
        record["activeGalleryVersion"] = gallery["versionId"]


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
    alternate_rows = []

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
            product["galleryImages"] = paths
            for key, value in meta.get("presentation", {}).items():
                product[key] = copy.deepcopy(value)

        gallery = {
            "versionId": version_id(files),
            "status": "active",
            "recordedAt": recorded_at,
            "sourceBatch": "telegram-8767964230-20261020-134457",
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

    for code, meta in ALTERNATES.items():
        master_product = indexes["master"].get(code)
        if not master_product:
            raise RuntimeError(f"Alternate 1C code {code} is absent")
        guard_product(master_product, meta["tokens"], code)
        if len(master_product.get("galleryImages") or []) != 3:
            raise RuntimeError(f"Alternate 1C code {code} lacks its approved active gallery")
        files = make_files(
            args.source_dir, args.library_stage, meta["messages"], public=None
        )
        gallery = {
            "versionId": version_id(files),
            "status": "alternate",
            "recordedAt": recorded_at,
            "sourceBatch": "telegram-8767964230-20261020-134457",
            "note": meta["note"],
            "files": files,
        }
        record = registry.get("products", {}).get(code)
        if not record or not record.get("activeGalleryVersion"):
            raise RuntimeError(f"Registry active gallery missing for alternate {code}")
        active_before = record["activeGalleryVersion"]
        add_gallery(record, gallery, activate=False)
        if record.get("activeGalleryVersion") != active_before:
            raise RuntimeError(f"Alternate gallery unexpectedly activated for {code}")
        alternate_rows.append(
            {
                "sourceCode": code,
                "title": master_product.get("title"),
                "messages": list(meta["messages"]),
                "versionId": gallery["versionId"],
                "activeGalleryRetained": active_before,
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
        "sourceBatches": ["telegram-8767964230-20261020-134457"],
        "approvedSourceCodes": list(PUBLISHED),
        "approvedProducts": len(PUBLISHED),
        "alternateSourceCodes": list(ALTERNATES),
        "alternateProducts": len(ALTERNATES),
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
            "sourceBatch": "telegram-8767964230-20261020-134457",
            "sourcePhotoCount": 63,
            "publishedProducts": published_rows,
            "alternateProducts": alternate_rows,
            "presentationCorrections": [
                {
                    "sourceCode": "3281",
                    "from": "Fa гель/душ MEN (250) Lemon Fresh",
                    "to": "Fa Fresh Sport гель для душа, 250 мл",
                    "evidence": "1C sourceName1C and visible package both say Fresh Sport.",
                }
            ],
            "changedFields": [
                "image",
                "galleryImages",
                "3281.title",
                "3281.unit",
                "3281.description",
                "3281.searchText",
                "3281.searchTerms",
            ],
            "unmatchedProducts": [],
        },
    )
    print(
        json.dumps(
            {
                "publishedGalleries": len(published_rows),
                "publishedImages": len(published_rows) * 3,
                "alternateGalleries": len(alternate_rows),
                "alternateImagesPreserved": len(alternate_rows) * 3,
                "registryStats": registry["stats"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
