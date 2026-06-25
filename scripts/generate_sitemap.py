#!/usr/bin/env python3
from datetime import date
import json
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://globalmarket.kg"
SITEMAP_PATH = ROOT / "sitemap.xml"
ROBOTS_PATH = ROOT / "robots.txt"
PRODUCT_PAGES_MANIFEST_PATH = ROOT / "data" / "product-pages.json"
LANDING_PAGES_MANIFEST_PATH = ROOT / "data" / "landing-pages.json"


def url_entry(loc, priority="0.7", changefreq="weekly", image_loc=None):
    today = date.today().isoformat()
    image_block = ""
    if image_loc:
        image_block = (
            "    <image:image>\n"
            f"      <image:loc>{escape(image_loc)}</image:loc>\n"
            "    </image:image>\n"
        )
    return (
        "  <url>\n"
        f"    <loc>{escape(loc)}</loc>\n"
        f"    <lastmod>{today}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"{image_block}"
        "  </url>"
    )


def collect_product_urls():
    if PRODUCT_PAGES_MANIFEST_PATH.exists():
        manifest = json.loads(PRODUCT_PAGES_MANIFEST_PATH.read_text(encoding="utf-8"))
        urls = [item.get("url") for item in manifest.get("pages", []) if item.get("url")]
        if urls:
            return sorted(set(urls))

    product_dir = ROOT / "product"
    if not product_dir.exists():
        return []
    return [f"{BASE_URL}/product/{page.parent.name}/" for page in sorted(product_dir.glob("*/index.html"))]


def collect_product_entries():
    """Product URL rows carrying an optional image:loc for the image sitemap."""
    if not PRODUCT_PAGES_MANIFEST_PATH.exists():
        return [(url, "0.8", "weekly", None) for url in collect_product_urls()]
    manifest = json.loads(PRODUCT_PAGES_MANIFEST_PATH.read_text(encoding="utf-8"))
    entries = []
    for item in manifest.get("pages", []):
        url = item.get("url")
        if not url:
            continue
        image = item.get("image")
        image_loc = None
        if image:
            if image.startswith(("http://", "https://")):
                image_loc = image
            else:
                image_loc = f"{BASE_URL}{image if image.startswith('/') else '/' + image}"
        entries.append((url, "0.8", "weekly", image_loc))
    entries.sort(key=lambda row: row[0])
    return entries


def collect_landing_urls():
    if LANDING_PAGES_MANIFEST_PATH.exists():
        manifest = json.loads(LANDING_PAGES_MANIFEST_PATH.read_text(encoding="utf-8"))
        urls = [item.get("url") for item in manifest.get("pages", []) if item.get("url")]
        if urls:
            return sorted(set(urls))

    urls = []
    for directory in ("category", "collection", "brand"):
        path = ROOT / directory
        if path.exists():
            urls.extend(f"{BASE_URL}/{directory}/{page.parent.name}/" for page in sorted(path.glob("*/index.html")))
    return sorted(set(urls))


def main():
    urls = [
        (f"{BASE_URL}/", "1.0", "daily"),
        (f"{BASE_URL}/catalog/", "0.8", "weekly"),
        (f"{BASE_URL}/privacy.html", "0.2", "monthly"),
    ]
    urls.extend((url, "0.7", "weekly") for url in collect_landing_urls())
    urls.extend(collect_product_entries())

    sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        *(url_entry(*row) for row in urls),
        "</urlset>",
        "",
    ]
    SITEMAP_PATH.write_text("\n".join(sitemap), encoding="utf-8")

    robots = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /admin/",
            "",
            f"Sitemap: {BASE_URL}/sitemap.xml",
            "",
        ],
    )
    ROBOTS_PATH.write_text(robots, encoding="utf-8")
    print(f"Generated {SITEMAP_PATH.relative_to(ROOT)} with {len(urls)} URLs")
    print(f"Generated {ROBOTS_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
