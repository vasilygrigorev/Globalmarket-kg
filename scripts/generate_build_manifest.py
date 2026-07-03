#!/usr/bin/env python3
import argparse
import fnmatch
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "outputs" / "build-manifest.json"

HASHED_FILES = [
    "index.html",
    "catalog/index.html",
    "app.js",
    "styles.css",
    "privacy.html",
    "sitemap.xml",
    "robots.txt",
    "data/public-catalog.json",
    "data/site-config.json",
    "data/search-synonyms.json",
    "data/product-pages.json",
    "data/landing-pages.json",
]

PUBLIC_ASSET_EXCLUDES = {
    "document_inbox",
    "product_sources",
    "telegram_inbox",
    "telegram_uploads",
}

PUBLIC_ASSET_EXCLUDE_GLOBS = {
    "telegram-*",
    "*contact-sheet*",
    "*ocr*",
    "*dup*",
}


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sitemap_count(path):
    root = ET.parse(path).getroot()
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [
        node.find("sm:loc", ns).text
        for node in root.findall("sm:url", ns)
        if node.find("sm:loc", ns) is not None
    ]
    return {
        "urlCount": len(urls),
        "productUrlCount": sum(1 for url in urls if "/product/" in url),
    }


def count_files(path, exclude_dir_names=None, exclude_globs=None):
    exclude_dir_names = exclude_dir_names or set()
    exclude_globs = exclude_globs or set()
    if not path.exists():
        return 0
    total = 0
    for item in path.rglob("*"):
        if not item.is_file():
            continue
        relative_parts = item.relative_to(path).parts
        if any(part in exclude_dir_names for part in relative_parts):
            continue
        if any(fnmatch.fnmatch(item.name, pattern) for pattern in exclude_globs):
            continue
        total += 1
    return total


def build_manifest():
    catalog = load_json(ROOT / "data" / "public-catalog.json")
    product_pages = load_json(ROOT / "data" / "product-pages.json")
    landing_pages = load_json(ROOT / "data" / "landing-pages.json")
    sitemap = sitemap_count(ROOT / "sitemap.xml")
    files = {}
    for name in HASHED_FILES:
        path = ROOT / name
        files[name] = {
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }

    products = catalog.get("products", [])
    pages = product_pages.get("pages") or []
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "project": "Global Market KG",
        "counts": {
            "products": len(products),
            "inStockProducts": sum(1 for product in products if product.get("inStock") is not False),
            "productsWithImages": sum(1 for product in products if product.get("image") or product.get("galleryImages")),
            "productPages": len(pages),
            "landingPages": len(landing_pages.get("pages") or []),
            "assetsFiles": count_files(ROOT / "assets", PUBLIC_ASSET_EXCLUDES, PUBLIC_ASSET_EXCLUDE_GLOBS),
            "publicProductFiles": count_files(ROOT / "product"),
            **sitemap,
        },
        "files": files,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate a public-safe static build manifest.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output JSON path.")
    args = parser.parse_args()

    output = Path(args.output).expanduser()
    if not output.is_absolute():
        output = (ROOT / output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest()
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Build manifest: {output}")
    print(f"Products: {manifest['counts']['products']}")
    print(f"Product pages: {manifest['counts']['productPages']}")
    print(f"Sitemap URLs: {manifest['counts']['urlCount']}")


if __name__ == "__main__":
    raise SystemExit(main())
