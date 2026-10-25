#!/usr/bin/env python3
"""Recover append-only storefront URL registries from verified release archives.

This is a maintenance tool, not a build dependency. The generated registries
are committed to the project so normal builds remain local and deterministic.
"""

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RELEASES_ROOT = Path(
    "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/releases"
)
PRODUCT_PAGES_PATH = ROOT / "data" / "product-pages.json"
LANDING_PAGES_PATH = ROOT / "data" / "landing-pages.json"
PRODUCT_ALIAS_PATH = ROOT / "data" / "product-url-aliases.json"
LANDING_REGISTRY_PATH = ROOT / "data" / "landing-page-registry.json"

MANUAL_PRODUCT_ALIASES = {
    "/product/jif-lemon-chistyashchiy-krem-500-ml-118ed3/":
        "/product/jif-lemon-chistyaschiy-krem-500-ml-118ed3/",
}

MANUAL_LANDING_PAGES = [
    {"type": "brand", "slug": "sunsilk", "title": "Sunsilk"},
]


def load_json(path, fallback=None):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def manifest_files(releases_root, name):
    return sorted(releases_root.glob(f"**/data/{name}"))


def product_identity(page):
    product_id = str(page.get("id") or "").strip()
    source_code = str(page.get("sourceCode") or "").strip()
    if product_id:
        return ("id", product_id)
    if source_code:
        return ("sourceCode", source_code)
    return None


def recover_product_aliases(releases_root):
    current_pages = load_json(PRODUCT_PAGES_PATH, {}).get("pages") or []
    current_paths = {page.get("path") for page in current_pages if page.get("path")}
    current_by_identity = {}
    for page in current_pages:
        product_id = str(page.get("id") or "").strip()
        source_code = str(page.get("sourceCode") or "").strip()
        if product_id:
            current_by_identity[("id", product_id)] = page
        if source_code:
            current_by_identity[("sourceCode", source_code)] = page

    aliases = {}
    existing = load_json(PRODUCT_ALIAS_PATH, {}) or {}
    for row in existing.get("aliases") or []:
        source = str(row.get("from") or "").strip()
        target = str(row.get("to") or "").strip()
        if source and target:
            aliases[source] = target

    conflicts = []
    archives = manifest_files(releases_root, "product-pages.json")
    for manifest_path in archives:
        for old_page in (load_json(manifest_path, {}) or {}).get("pages") or []:
            destination = None
            product_id = str(old_page.get("id") or "").strip()
            source_code = str(old_page.get("sourceCode") or "").strip()
            if product_id:
                destination = current_by_identity.get(("id", product_id))
            if destination is None and source_code:
                destination = current_by_identity.get(("sourceCode", source_code))
            source = str(old_page.get("path") or "").strip()
            target = str((destination or {}).get("path") or "").strip()
            if not source or not target or source == target or source in current_paths:
                continue
            previous = aliases.get(source)
            if previous and previous != target:
                conflicts.append((source, previous, target, manifest_path))
                continue
            aliases[source] = target

    for source, target in MANUAL_PRODUCT_ALIASES.items():
        previous = aliases.get(source)
        if previous and previous != target:
            conflicts.append((source, previous, target, "manual"))
        else:
            aliases[source] = target

    if conflicts:
        detail = "\n".join(f"{source}: {left} != {right} ({origin})" for source, left, right, origin in conflicts)
        raise RuntimeError(f"Conflicting historical product aliases:\n{detail}")

    document = {
        "schemaVersion": 1,
        "source": "Recovered from verified Global Market KG release manifests; append-only.",
        "aliases": [
            {"from": source, "to": aliases[source]}
            for source in sorted(aliases)
        ],
    }
    PRODUCT_ALIAS_PATH.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(document["aliases"]), len(archives)


def minimal_landing(page):
    return {
        "type": str(page.get("type") or "").strip(),
        "slug": str(page.get("slug") or "").strip(),
        "title": str(page.get("title") or "").strip(),
    }


def recover_landing_registry(releases_root):
    pages = {}
    existing = load_json(LANDING_REGISTRY_PATH, {}) or {}
    sources = [existing.get("pages") or [], (load_json(LANDING_PAGES_PATH, {}) or {}).get("pages") or []]
    for source_pages in sources:
        for page in source_pages:
            item = minimal_landing(page)
            key = (item["type"], item["slug"])
            if all(key) and item["title"]:
                pages[key] = item

    archives = manifest_files(releases_root, "landing-pages.json")
    for manifest_path in archives:
        for page in (load_json(manifest_path, {}) or {}).get("pages") or []:
            item = minimal_landing(page)
            key = (item["type"], item["slug"])
            if all(key) and item["title"]:
                pages.setdefault(key, item)

    for page in MANUAL_LANDING_PAGES:
        item = minimal_landing(page)
        pages.setdefault((item["type"], item["slug"]), item)

    document = {
        "schemaVersion": 1,
        "source": "Append-only landing URL registry recovered from verified release manifests.",
        "pages": [pages[key] for key in sorted(pages)],
    }
    LANDING_REGISTRY_PATH.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(document["pages"]), len(archives)


def main():
    parser = argparse.ArgumentParser(description="Recover append-only retail URL history.")
    parser.add_argument("--releases-root", default=str(DEFAULT_RELEASES_ROOT))
    args = parser.parse_args()
    releases_root = Path(args.releases_root).expanduser().resolve()
    if not releases_root.is_dir():
        raise SystemExit(f"Release archive not found: {releases_root}")

    alias_count, product_archive_count = recover_product_aliases(releases_root)
    landing_count, landing_archive_count = recover_landing_registry(releases_root)
    print(f"Product aliases: {alias_count} from {product_archive_count} archived manifests")
    print(f"Landing URLs: {landing_count} from {landing_archive_count} archived manifests")


if __name__ == "__main__":
    main()
