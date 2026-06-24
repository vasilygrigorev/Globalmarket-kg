#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
PRODUCT_DIR = ROOT / "product"
REPORT_PATH = ROOT / "outputs" / "product-pages-validation-report.md"
SITE_URL = "https://globalmarket.kg"


def find(pattern, text, flags=0):
    match = re.search(pattern, text, flags)
    return match.group(1) if match else ""


def local_path_from_url(value):
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc and parsed.netloc != "globalmarket.kg":
        return None
    path = parsed.path if parsed.scheme else value
    if not path.startswith("/"):
        path = "/" + path
    return ROOT / path.lstrip("/")


def validate_json_ld(page, html, errors):
    raw = find(r'<script\s+type="application/ld\+json">(.*?)</script>', html, re.S)
    if not raw:
        errors.append("missing Product JSON-LD")
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        errors.append(f"invalid Product JSON-LD: {exc}")
        return {}
    if data.get("@type") != "Product":
        errors.append("JSON-LD @type is not Product")
    if not data.get("name"):
        errors.append("JSON-LD missing name")
    offer = data.get("offers") or {}
    if offer.get("priceCurrency") != "KGS":
        errors.append("JSON-LD offer priceCurrency is not KGS")
    if not offer.get("price"):
        errors.append("JSON-LD offer missing price")
    images = data.get("image") or []
    if isinstance(images, str):
        images = [images]
    if not images:
        errors.append("JSON-LD missing images")
    for image in images:
        local = local_path_from_url(image)
        if local and not local.is_file():
            errors.append(f"JSON-LD image missing: {image}")
    return data


def validate_page(page):
    html = page.read_text(encoding="utf-8")
    slug = page.parent.name
    errors = []
    warnings = []

    title = find(r"<title>(.*?)</title>", html, re.S).strip()
    description = find(r'<meta\s+name="description"\s+content="([^"]*)"', html)
    canonical = find(r'<link\s+rel="canonical"\s+href="([^"]*)"', html)
    expected_canonical = f"{SITE_URL}/product/{slug}/"

    if not title:
        errors.append("missing title")
    if not description:
        errors.append("missing meta description")
    elif len(description) > 180:
        warnings.append("meta description is longer than 180 characters")
    if canonical != expected_canonical:
        errors.append(f"canonical mismatch: `{canonical}` != `{expected_canonical}`")
    if 'class="site-header"' not in html:
        errors.append("missing shared site header")
    if 'class="site-footer"' not in html:
        errors.append("missing shared site footer")
    if 'data-add-cart' not in html and "Нет в наличии" not in html:
        errors.append("missing add-to-cart action")
    if 'data-favorite' not in html:
        errors.append("missing favorite action")
    if 'data-share' not in html:
        errors.append("missing share action")
    if "Спросить в WhatsApp" not in html:
        errors.append("missing WhatsApp question action")

    validate_json_ld(page, html, errors)

    image_sources = re.findall(r'<img[^>]+src="([^"]+)"', html)
    if not image_sources:
        errors.append("no img tags found")
    for src in image_sources:
        local = local_path_from_url(src)
        if local and not local.is_file():
            errors.append(f"image missing: {src}")

    related_links = re.findall(r'href="(/product/[^"]+/)"', html)
    related_links = [link for link in related_links if link != f"/product/{slug}/"]
    if len(related_links) < 1:
        warnings.append("no related product links")
    for link in related_links:
        local = ROOT / link.strip("/ ") / "index.html"
        if not local.is_file():
            errors.append(f"related product link missing: {link}")

    return {
        "slug": slug,
        "title": title,
        "errors": errors,
        "warnings": warnings,
        "images": len(image_sources),
        "related": len(related_links),
    }


def main():
    pages = sorted(PRODUCT_DIR.glob("*/index.html"))
    results = [validate_page(page) for page in pages]
    error_count = sum(len(item["errors"]) for item in results)
    warning_count = sum(len(item["warnings"]) for item in results)

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Product Pages Validation Report",
        "",
        f"- Pages: `{len(pages)}`",
        f"- Errors: `{error_count}`",
        f"- Warnings: `{warning_count}`",
        "",
        "| Page | Images | Related | Status |",
        "|---|---:|---:|---|",
    ]
    for item in results:
        status = "OK"
        if item["errors"]:
            status = "ERROR"
        elif item["warnings"]:
            status = "WARN"
        lines.append(f"| `{item['slug']}` | {item['images']} | {item['related']} | {status} |")

    problem_items = [item for item in results if item["errors"] or item["warnings"]]
    if problem_items:
        lines.extend(["", "## Details", ""])
        for item in problem_items:
            lines.append(f"### `{item['slug']}`")
            for error in item["errors"]:
                lines.append(f"- ERROR: {error}")
            for warning in item["warnings"]:
                lines.append(f"- WARN: {warning}")
            lines.append("")

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Report: {REPORT_PATH.relative_to(ROOT)}")
    print(f"Product pages: {len(pages)}")
    print(f"Errors: {error_count}")
    print(f"Warnings: {warning_count}")
    if error_count:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
