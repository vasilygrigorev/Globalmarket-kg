#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "public-catalog.json"

KNOWN_EXCEPTIONS = {
    "prd_432b62d4b317": "TRESemmé Clean & Replenish: missing back photo; needs reshoot/source photo.",
    "prd_1f1557a2acbb": "Pantene Damage Repair 600 ml: missing back photo in 2026-06-10 Petya album; user requested publication.",
    "prd_296bd01a7c1f": "Pantene Sheer Volume 600 ml: missing back photo in 2026-06-10 Petya album; user requested publication.",
}

# Raw/temporary-file markers that must never appear in a PUBLISHED image path —
# a Telegram export, OCR scratch file, or contact sheet is a working file, not a
# finished product photo. Mirrors tests/catalog-image-hygiene.test.mjs.
RAW_LEFTOVER_MARKER = re.compile(r"telegram-|ocr|contact|sheet|dup", re.IGNORECASE)


def path_hygiene_issues(pid, title, src):
    """Guardrails that apply to EVERY published path, including exception
    products: no raw/temp leftover markers, and the file must live inside an
    approved subfolder of assets/products/ (never loose at the root, which is
    reserved for unsorted raw uploads)."""
    issues = []
    if RAW_LEFTOVER_MARKER.search(Path(src).name):
        issues.append(f"{pid} {title}: raw/temp filename marker in published path {src}")
    rel = src[len("assets/products/"):] if src.startswith("assets/products/") else src
    if "/" not in rel:
        issues.append(f"{pid} {title}: image must live in a subfolder of assets/products/, got {src}")
    return issues


def is_real_product_photo(product):
    image = product.get("image") or ""
    gallery = product.get("galleryImages") or []
    return image.startswith("assets/products/") or any(
        str(src).startswith("assets/products/") for src in gallery
    )


def check_gallery(product):
    pid = product.get("id")
    title = product.get("title") or ""
    image = product.get("image") or ""
    gallery = product.get("galleryImages") or []
    issues = []

    # Path hygiene applies to every photographed product, including documented
    # completeness exceptions — a raw Telegram/OCR leftover or a loose root-level
    # file must never be published, no matter how many photos the product has.
    all_srcs = {str(src) for src in gallery if src}
    if image:
        all_srcs.add(str(image))
    for src in sorted(all_srcs):
        if src.startswith("assets/products/"):
            issues.extend(path_hygiene_issues(pid, title, src))

    if pid in KNOWN_EXCEPTIONS:
        return issues

    if product.get("categoryId") == "perfume":
        if len(gallery) != 1:
            issues.append(f"{pid} {title}: perfume products must have exactly 1 card image, got {len(gallery)}")
            return issues
        if image != gallery[0]:
            issues.append(f"{pid} {title}: image must equal galleryImages[0]")
        if "card" not in Path(gallery[0]).stem.lower():
            issues.append(f"{pid} {title}: perfume image should be a card image, got {gallery[0]}")
        if not str(gallery[0]).startswith("assets/products/perfume/"):
            issues.append(f"{pid} {title}: perfume image must live under assets/products/perfume/, got {gallery[0]}")
        if not (ROOT / gallery[0]).exists():
            issues.append(f"{pid} {title}: missing file {gallery[0]}")
        return issues

    if len(gallery) != 3:
        issues.append(f"{pid} {title}: expected 3 gallery images, got {len(gallery)}")
        return issues

    if image != gallery[0]:
        issues.append(f"{pid} {title}: image must equal galleryImages[0]")

    checks = [
        ("card", gallery[0]),
        ("front", gallery[1]),
        ("back", gallery[2]),
    ]
    for token, src in checks:
        name = Path(src).stem.lower()
        if token not in name:
            issues.append(f"{pid} {title}: expected {token} image, got {src}")
        if not (ROOT / src).exists():
            issues.append(f"{pid} {title}: missing file {src}")

    return issues


def main():
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    products = data.get("products", [])
    photographed = [product for product in products if is_real_product_photo(product)]
    issues = []
    exceptions_present = []

    for product in photographed:
        pid = product.get("id")
        if pid in KNOWN_EXCEPTIONS:
            exceptions_present.append((pid, product.get("title"), KNOWN_EXCEPTIONS[pid]))
        issues.extend(check_gallery(product))

    print(f"Products total: {len(products)}")
    print(f"Products with real product photos: {len(photographed)}")
    print(f"Known exceptions: {len(exceptions_present)}")
    for pid, title, reason in exceptions_present:
        print(f"EXCEPTION {pid} {title}: {reason}")

    if issues:
        print("\nGallery contract violations:")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print("Gallery contract OK for all non-exception photographed products.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
