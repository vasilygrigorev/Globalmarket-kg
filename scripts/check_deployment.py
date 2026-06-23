#!/usr/bin/env python3
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import parse_qs, urljoin, urlparse


DEFAULT_BASE_URL = "https://shared-layout-preview.globalmarket-kg.pages.dev"
DEFAULT_PRODUCT_PATH = "/product/dalli-colorwaschmittel-gel-dlya-stirki-1-1-l-bdb383/"
USER_AGENT = "Mozilla/5.0 GlobalMarketDeployCheck/1.0"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.status, response.headers.get("content-type", ""), response.read()


def parse_params(href):
    parsed = urlparse(href)
    return {key: values[-1] for key, values in parse_qs(parsed.query).items() if values}


def product_text(product):
    return " ".join(
        str(product.get(key, ""))
        for key in ("title", "category", "brand", "productType", "description", "searchText")
    ).lower()


def product_matches(product, params):
    if product.get("inStock") is False:
        return False
    if params.get("category") and product.get("category") != params["category"]:
        return False
    if params.get("collection") and params["collection"] not in (product.get("collections") or []):
        return False
    query = (params.get("query") or params.get("q") or "").strip().lower()
    if query and query not in product_text(product):
        return False
    return True


def add_error(errors, message):
    errors.append(message)


def content_type_matches(content_type, expected_content):
    expected_values = expected_content if isinstance(expected_content, tuple) else (expected_content,)
    return not expected_content or any(value in content_type for value in expected_values)


def check_url(base_url, path, expected_content, errors):
    url = urljoin(base_url, path)
    last_error = ""
    for attempt in range(1, 4):
        try:
            status, content_type, body = fetch(url)
        except urllib.error.HTTPError as exc:
            last_error = f"{path}: HTTP {exc.code}"
        except Exception as exc:
            last_error = f"{path}: request failed: {exc}"
        else:
            if status == 200 and content_type_matches(content_type, expected_content):
                return body
            if status != 200:
                last_error = f"{path}: HTTP {status}"
            else:
                expected_values = expected_content if isinstance(expected_content, tuple) else (expected_content,)
                last_error = f"{path}: content-type `{content_type}` does not include one of `{expected_values}`"
        if attempt < 3:
            time.sleep(1.5)
    add_error(errors, last_error)
    return b""


def check_banner_targets(config, catalog, errors):
    products = catalog.get("products", [])
    rows = []
    for banner in config.get("banners", []):
        if banner.get("active") is False:
            continue
        params = parse_params(banner.get("href", ""))
        if not params:
            continue
        matches = sum(1 for product in products if product_matches(product, params))
        rows.append((banner.get("title", "banner"), matches))
        if matches == 0:
            add_error(errors, f"banner `{banner.get('title', '')}` resolves to 0 products")
    return rows


def check_sitemap(body, errors):
    try:
        root = ET.fromstring(body)
    except Exception as exc:
        add_error(errors, f"sitemap.xml parse failed: {exc}")
        return 0
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [node.find("sm:loc", ns).text for node in root.findall("sm:url", ns) if node.find("sm:loc", ns) is not None]
    if "https://globalmarket.kg/" not in urls:
        add_error(errors, "sitemap.xml does not include homepage")
    if "https://globalmarket.kg/privacy.html" not in urls:
        add_error(errors, "sitemap.xml does not include privacy page")
    product_urls = [url for url in urls if "/product/" in url]
    if not product_urls:
        add_error(errors, "sitemap.xml does not include product URLs")
    return len(urls), len(product_urls)


def main():
    parser = argparse.ArgumentParser(description="Check a deployed Global Market KG static site.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"Base URL to check. Default: {DEFAULT_BASE_URL}")
    parser.add_argument("--product-path", default=DEFAULT_PRODUCT_PATH, help="Known generated product page path to check.")
    parser.add_argument("--require-reports", action="store_true", help="Require preview report URLs under /outputs/.")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/") + "/"
    errors = []

    check_url(base_url, "/", "text/html", errors)
    check_url(base_url, "/catalog/", "text/html", errors)
    config_body = check_url(base_url, "/data/site-config.json", "application/json", errors)
    synonyms_body = check_url(base_url, "/data/search-synonyms.json", "application/json", errors)
    catalog_body = check_url(base_url, "/data/public-catalog.json", "application/json", errors)
    product_pages_body = check_url(base_url, "/data/product-pages.json", "application/json", errors)
    landing_pages_body = check_url(base_url, "/data/landing-pages.json", "application/json", errors)
    sitemap_body = check_url(base_url, "/sitemap.xml", "xml", errors)
    check_url(base_url, "/robots.txt", "text/plain", errors)
    check_url(base_url, args.product_path, "text/html", errors)
    if args.require_reports:
        check_url(base_url, "/outputs/site-config-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/product-pages-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/landing-pages-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/landing-pages-validation-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/catalog-index-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/search-synonyms-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/product-pages-validation-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/structured-data-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/internal-links-report.md", ("text/plain", "text/markdown"), errors)
        check_url(base_url, "/outputs/build-manifest.json", "application/json", errors)
        check_url(base_url, "/outputs/project-stage-report.md", ("text/plain", "text/markdown"), errors)

    try:
        config = json.loads(config_body.decode("utf-8"))
    except Exception as exc:
        config = {}
        add_error(errors, f"site-config JSON parse failed: {exc}")
    try:
        synonyms = json.loads(synonyms_body.decode("utf-8"))
        if not isinstance(synonyms.get("groups"), list) or not synonyms["groups"]:
            add_error(errors, "search-synonyms has no groups")
    except Exception as exc:
        add_error(errors, f"search-synonyms JSON parse failed: {exc}")
    try:
        catalog = json.loads(catalog_body.decode("utf-8"))
    except Exception as exc:
        catalog = {}
        add_error(errors, f"catalog JSON parse failed: {exc}")
    try:
        product_pages_manifest = json.loads(product_pages_body.decode("utf-8"))
    except Exception as exc:
        product_pages_manifest = {}
        add_error(errors, f"product-pages JSON parse failed: {exc}")
    try:
        landing_pages_manifest = json.loads(landing_pages_body.decode("utf-8"))
    except Exception as exc:
        landing_pages_manifest = {}
        add_error(errors, f"landing-pages JSON parse failed: {exc}")

    banner_rows = check_banner_targets(config, catalog, errors) if config and catalog else []
    sitemap_count, sitemap_product_count = check_sitemap(sitemap_body, errors) if sitemap_body else (0, 0)
    manifest_pages = product_pages_manifest.get("pages") or []
    landing_pages = landing_pages_manifest.get("pages") or []
    if product_pages_manifest.get("count") != len(manifest_pages):
        add_error(errors, f"product-pages count mismatch: {product_pages_manifest.get('count')} != {len(manifest_pages)}")
    if landing_pages_manifest.get("count") != len(landing_pages):
        add_error(errors, f"landing-pages count mismatch: {landing_pages_manifest.get('count')} != {len(landing_pages)}")
    expected_sitemap_count = len(manifest_pages) + len(landing_pages) + 3
    if sitemap_count and sitemap_count != expected_sitemap_count:
        add_error(errors, f"sitemap URL count mismatch: {sitemap_count} != {expected_sitemap_count}")
    if sitemap_product_count and manifest_pages and sitemap_product_count != len(manifest_pages):
        add_error(errors, f"sitemap product URL count mismatch: {sitemap_product_count} != {len(manifest_pages)}")

    if errors:
        print("Deployment check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Deployment OK: {base_url.rstrip('/')}")
    print(f"Products: {len(catalog.get('products', []))}")
    print(f"Product pages manifest: {len(manifest_pages)}")
    print(f"Landing pages manifest: {len(landing_pages)}")
    print(f"Sitemap URLs: {sitemap_count}")
    print(f"Sitemap product URLs: {sitemap_product_count}")
    for title, matches in banner_rows:
        print(f"Banner `{title}`: {matches} products")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
