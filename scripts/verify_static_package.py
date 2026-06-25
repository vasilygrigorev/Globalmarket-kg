#!/usr/bin/env python3
import argparse
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_PACKAGE = Path("/private/tmp/globalmarket-static-build")
REQUIRED_ROOT_FILES = {
    "index.html",
    "app.js",
    "styles.css",
    "privacy.html",
    "404.html",
    "site.webmanifest",
    "_headers",
    "sitemap.xml",
    "robots.txt",
}
REQUIRED_ASSET_FILES = {
    "assets/brand/icon-192.png",
    "assets/brand/icon-512.png",
    "assets/brand/globalmarket-tech-orb-tight.jpg",
    "assets/brand/globalmarket-tech-orb.jpg",
}
REQUIRED_DATA_FILES = {
    "public-catalog.json",
    "site-config.json",
    "search-synonyms.json",
    "product-pages.json",
    "landing-pages.json",
}
FORBIDDEN_DIR_NAMES = {
    "document_inbox",
    "product_sources",
    "telegram_inbox",
    "telegram_uploads",
    "__pycache__",
    ".git",
    ".wrangler",
}
FORBIDDEN_ROOT_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".mxl",
    ".xls",
    ".xlsx",
    ".csv",
    ".db",
}


def fail(errors, message):
    errors.append(message)


def parse_json(path, errors):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(errors, f"Invalid JSON: {path}: {exc}")
        return {}


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def count_files(path):
    if not path.exists():
        return 0
    return sum(1 for item in path.rglob("*") if item.is_file())


def verify_required_files(package, errors):
    for name in sorted(REQUIRED_ROOT_FILES):
        if not (package / name).is_file():
            fail(errors, f"Missing root file: {name}")
    for name in sorted(REQUIRED_DATA_FILES):
        if not (package / "data" / name).is_file():
            fail(errors, f"Missing data file: data/{name}")
    for rel in sorted(REQUIRED_ASSET_FILES):
        if not (package / rel).is_file():
            fail(errors, f"Missing required asset: {rel}")
    for dirname in ("assets", "product", "catalog", "category", "collection", "brand"):
        if not (package / dirname).is_dir():
            fail(errors, f"Missing directory: {dirname}")


def verify_forbidden_files(package, errors):
    for path in package.rglob("*"):
        rel = path.relative_to(package).as_posix()
        if any(part in FORBIDDEN_DIR_NAMES for part in rel.split("/")):
            fail(errors, f"Forbidden path in package: {rel}")
        if path.parent == package and path.suffix.lower() in FORBIDDEN_ROOT_SUFFIXES:
            fail(errors, f"Forbidden root artifact in package: {rel}")


def verify_catalog_images(package, catalog, errors):
    missing = []
    for product in catalog.get("products", []):
        urls = []
        if product.get("image"):
            urls.append(product["image"])
        for item in product.get("galleryImages") or []:
            if isinstance(item, dict) and item.get("src"):
                urls.append(item["src"])
        for url in urls:
            parsed = urlparse(url)
            if parsed.scheme or not parsed.path.startswith("/"):
                continue
            target = package / parsed.path.lstrip("/")
            if not target.is_file():
                missing.append((product.get("id", ""), parsed.path))
    if missing:
        for product_id, path in missing[:30]:
            fail(errors, f"Missing catalog image in package: {product_id}: {path}")
        if len(missing) > 30:
            fail(errors, f"Missing catalog images omitted: {len(missing) - 30}")


def verify_search_synonyms(package, errors):
    synonyms = parse_json(package / "data" / "search-synonyms.json", errors)
    if not isinstance(synonyms, dict):
        fail(errors, "search-synonyms.json must be an object")
        return
    groups = synonyms.get("groups")
    if not isinstance(groups, list) or not groups:
        fail(errors, "search-synonyms.json must contain non-empty groups")
        return
    for index, group in enumerate(groups, start=1):
        if not isinstance(group, dict):
            fail(errors, f"search-synonyms.json group {index} must be an object")
            continue
        group_id = group.get("id") or index
        if not group.get("id"):
            fail(errors, f"search-synonyms.json group {index} missing id")
        if not group.get("aliases") and not group.get("terms"):
            fail(errors, f"search-synonyms.json group {group_id} has no aliases/terms")


def verify_sitemap(package, catalog, errors):
    sitemap_path = package / "sitemap.xml"
    try:
        root = ET.parse(sitemap_path).getroot()
    except Exception as exc:
        fail(errors, f"Invalid sitemap.xml: {exc}")
        return
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [node.find("sm:loc", ns).text for node in root.findall("sm:url", ns) if node.find("sm:loc", ns) is not None]
    if "https://globalmarket.kg/" not in urls:
        fail(errors, "sitemap.xml does not include homepage")
    product_pages = sorted((package / "product").glob("*/index.html"))
    landing_pages = (
        sorted((package / "category").glob("*/index.html"))
        + sorted((package / "collection").glob("*/index.html"))
        + sorted((package / "brand").glob("*/index.html"))
    )
    expected_count = len(product_pages) + len(landing_pages) + 3
    if len(urls) != expected_count:
        fail(errors, f"sitemap.xml URL count mismatch: {len(urls)} != {expected_count}")
    product_ids_with_pages = {
        page.parent.name
        for page in product_pages
    }
    if not product_ids_with_pages:
        fail(errors, "No product pages found in package")


def verify_product_pages_manifest(package, manifest, errors):
    pages = manifest.get("pages") or []
    if manifest.get("count") != len(pages):
        fail(errors, f"product-pages.json count mismatch: {manifest.get('count')} != {len(pages)}")
    product_pages = sorted((package / "product").glob("*/index.html"))
    if len(pages) != len(product_pages):
        fail(errors, f"product-pages.json page count mismatch: {len(pages)} != {len(product_pages)}")
    for item in pages:
        path = item.get("path", "")
        if not path.startswith("/product/"):
            fail(errors, f"product-pages.json invalid path: {path}")
            continue
        local = package / path.strip("/") / "index.html"
        if not local.is_file():
            fail(errors, f"product-pages.json page missing: {path}")
        image = item.get("image")
        if image:
            image_path = package / image.strip("/")
            if not image_path.is_file():
                fail(errors, f"product-pages.json image missing: {image}")


def verify_landing_pages_manifest(package, manifest, errors):
    pages = manifest.get("pages") or []
    if manifest.get("count") != len(pages):
        fail(errors, f"landing-pages.json count mismatch: {manifest.get('count')} != {len(pages)}")
    landing_pages = (
        sorted((package / "category").glob("*/index.html"))
        + sorted((package / "collection").glob("*/index.html"))
        + sorted((package / "brand").glob("*/index.html"))
    )
    if len(pages) != len(landing_pages):
        fail(errors, f"landing-pages.json page count mismatch: {len(pages)} != {len(landing_pages)}")
    for item in pages:
        path = item.get("path", "")
        if not (path.startswith("/category/") or path.startswith("/collection/") or path.startswith("/brand/")):
            fail(errors, f"landing-pages.json invalid path: {path}")
            continue
        local = package / path.strip("/") / "index.html"
        if not local.is_file():
            fail(errors, f"landing-pages.json page missing: {path}")


def verify_reports(package, require_reports, errors):
    if not require_reports:
        return
    for name in (
        "site-config-report.md",
        "product-pages-report.md",
        "landing-pages-report.md",
        "landing-pages-validation-report.md",
        "catalog-index-report.md",
        "search-synonyms-report.md",
        "product-pages-validation-report.md",
        "structured-data-report.md",
        "internal-links-report.md",
        "build-manifest.json",
        "project-stage-report.md",
    ):
        if not (package / "outputs" / name).is_file():
            fail(errors, f"Missing preview report: outputs/{name}")


def verify_build_manifest(package, require_reports, catalog, product_pages_manifest, errors):
    manifest_path = package / "outputs" / "build-manifest.json"
    if not require_reports:
        return
    manifest = parse_json(manifest_path, errors)
    if not manifest:
        return

    counts = manifest.get("counts") or {}
    product_pages = sorted((package / "product").glob("*/index.html"))
    landing_pages = (
        sorted((package / "category").glob("*/index.html"))
        + sorted((package / "collection").glob("*/index.html"))
        + sorted((package / "brand").glob("*/index.html"))
    )
    expected_counts = {
        "products": len(catalog.get("products", [])),
        "inStockProducts": sum(1 for product in catalog.get("products", []) if product.get("inStock") is not False),
        "productsWithImages": sum(1 for product in catalog.get("products", []) if product.get("image") or product.get("galleryImages")),
        "productPages": len(product_pages_manifest.get("pages") or []),
        "landingPages": len(landing_pages),
        "assetsFiles": count_files(package / "assets"),
        "publicProductFiles": len(product_pages),
    }
    for key, value in expected_counts.items():
        if counts.get(key) != value:
            fail(errors, f"build-manifest count mismatch `{key}`: {counts.get(key)} != {value}")

    for name, expected in (manifest.get("files") or {}).items():
        target = package / name
        if not target.is_file():
            fail(errors, f"build-manifest file missing in package: {name}")
            continue
        actual_bytes = target.stat().st_size
        if expected.get("bytes") != actual_bytes:
            fail(errors, f"build-manifest bytes mismatch `{name}`: {expected.get('bytes')} != {actual_bytes}")
        actual_hash = sha256(target)
        if expected.get("sha256") != actual_hash:
            fail(errors, f"build-manifest sha256 mismatch `{name}`")


def main():
    parser = argparse.ArgumentParser(description="Verify a packaged static Global Market KG deploy directory.")
    parser.add_argument("--package", default=str(DEFAULT_PACKAGE), help="Package directory to verify.")
    parser.add_argument("--require-reports", action="store_true", help="Require preview QA reports in outputs/.")
    args = parser.parse_args()

    package = Path(args.package).expanduser()
    if not package.is_absolute():
        package = package.resolve()

    errors = []
    if not package.is_dir():
        fail(errors, f"Package directory not found: {package}")
    else:
        verify_required_files(package, errors)
        verify_forbidden_files(package, errors)
        catalog = parse_json(package / "data" / "public-catalog.json", errors)
        parse_json(package / "data" / "site-config.json", errors)
        product_pages_manifest = parse_json(package / "data" / "product-pages.json", errors)
        landing_pages_manifest = parse_json(package / "data" / "landing-pages.json", errors)
        verify_search_synonyms(package, errors)
        verify_catalog_images(package, catalog, errors)
        verify_sitemap(package, catalog, errors)
        verify_product_pages_manifest(package, product_pages_manifest, errors)
        verify_landing_pages_manifest(package, landing_pages_manifest, errors)
        verify_reports(package, args.require_reports, errors)
        verify_build_manifest(package, args.require_reports, catalog, product_pages_manifest, errors)

    if errors:
        print("Package verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    file_count = sum(1 for item in package.rglob("*") if item.is_file())
    product_page_count = sum(1 for item in (package / "product").glob("*/index.html"))
    print(f"Package OK: {package}")
    print(f"Files: {file_count}")
    print(f"Product pages: {product_page_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
