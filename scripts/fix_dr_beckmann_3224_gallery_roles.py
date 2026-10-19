#!/usr/bin/env python3
"""Correct the approved photo roles for Dr. Beckmann sourceCode 3224."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROJECT = Path(
    "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG"
)
SOURCE_CODE = "3224"
SOURCE_BATCH = "2026-10-19-dr-beckmann-3224-role-correction-v1"
NOTE = (
    "Owner reported that the back panel appeared first. Visual review confirmed "
    "the approved three-image set was shifted: designed card, plain front, back."
)

PUBLIC_PATHS = {
    "card-front": "assets/products/dr-beckmann/dr-beckmann-fleckenteufel-oil-grease-50ml-card-front.jpg",
    "front": "assets/products/dr-beckmann/dr-beckmann-fleckenteufel-oil-grease-50ml-front.jpg",
    "back": "assets/products/dr-beckmann/dr-beckmann-fleckenteufel-oil-grease-50ml-back.jpg",
}

EXPECTED_HASHES = {
    "card-front": "f651d6a2cf70fa058294d4651793f2bd5d551090a07897b839bfb5db23d5cd67",
    "front": "d88ee4e9d3c33d54ffb0f469bb7eb3fbfe0b8a6dfeabeebd46ddc18a9c869f33",
    "back": "dad035cfd068dcd5880d843e479c5af58719a4e2ace4b5bcfa7d85d05b686512",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, payload: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def version_id(files: list[dict]) -> str:
    joined = "|".join(item["sha256"] for item in files)
    return hashlib.sha256(joined.encode()).hexdigest()[:16]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=DEFAULT_PROJECT)
    parser.add_argument("--audit", type=Path, required=True)
    args = parser.parse_args()

    registry_path = args.project / "product-photo-registry.json"
    registry = load(registry_path)
    record = (registry.get("products") or {}).get(SOURCE_CODE)
    if not record:
        raise RuntimeError(f"Missing registry product {SOURCE_CODE}")

    active_version = record.get("activeGalleryVersion")
    active = next(
        (row for row in record.get("galleries", []) if row.get("versionId") == active_version),
        None,
    )
    if not active:
        raise RuntimeError(f"Missing active gallery {active_version} for {SOURCE_CODE}")

    by_hash = {item.get("sha256"): item for item in active.get("files", [])}
    if set(by_hash) != set(EXPECTED_HASHES.values()):
        raise RuntimeError(
            "Active gallery no longer matches the three visually reviewed source photos"
        )

    corrected_files = []
    for role in ("card-front", "front", "back"):
        item = copy.deepcopy(by_hash[EXPECTED_HASHES[role]])
        canonical = args.project / item["canonicalPath"]
        if not canonical.is_file() or sha256(canonical) != EXPECTED_HASHES[role]:
            raise RuntimeError(f"Canonical photo is missing or changed: {canonical}")
        item["role"] = role
        item["publicPath"] = PUBLIC_PATHS[role]
        corrected_files.append(item)

    corrected_version = version_id(corrected_files)
    if corrected_version == active_version:
        raise RuntimeError("Corrected gallery unexpectedly has the same version id")

    active["status"] = "superseded"
    active["statusNote"] = "Corrected after owner report: gallery photo roles were shifted."
    corrected_gallery = {
        "versionId": corrected_version,
        "status": "active",
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "sourceBatch": SOURCE_BATCH,
        "note": NOTE,
        "files": corrected_files,
    }
    record.setdefault("galleries", []).append(corrected_gallery)
    record["activeGalleryVersion"] = corrected_version

    for item in corrected_files:
        source = args.project / item["canonicalPath"]
        destination = ROOT / item["publicPath"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        if sha256(destination) != item["sha256"]:
            raise RuntimeError(f"Published photo hash mismatch: {destination}")

    write(registry_path, registry)
    args.audit.parent.mkdir(parents=True, exist_ok=True)
    write(
        args.audit,
        {
            "sourceCode": SOURCE_CODE,
            "productId": record.get("productId"),
            "title": record.get("titleSnapshot"),
            "previousGalleryVersion": active_version,
            "correctedGalleryVersion": corrected_version,
            "sourceBatch": SOURCE_BATCH,
            "files": corrected_files,
        },
    )
    print(f"Corrected {SOURCE_CODE}: {active_version} -> {corrected_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
