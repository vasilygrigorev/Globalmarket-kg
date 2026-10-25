#!/usr/bin/env python3
"""Hard-stop checks for a Global Market retail release.

The script compares a candidate package with the last verified production
package and the append-only catalog master. It intentionally fails closed.
"""

import argparse
import json
import os
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PREVIOUS = Path(
    "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/"
    "releases/2026-10-07-retail-google-ads-recovery-v1/site"
)
DEFAULT_BASELINE_MASTER = DEFAULT_PREVIOUS.parent / "inventory" / "catalog-master-after.json"
DEFAULT_CURRENT_MASTER = Path(
    os.environ.get(
        "GLOBALMARKET_CURRENT_MASTER",
        "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/catalog-master.json",
    )
)
EXPECTED_BANNERS = [
    "/assets/hero-green-wide-v1.png",
    "/assets/hero-promo-pink-stuff.jpg",
    "/assets/banners/hero-felce-azzurra-v1.webp",
    "/assets/banners/hero-dalli-dash-v1.webp",
    "/assets/banners/hero-dr-beckmann-v1.webp",
]
EXPECTED_PRIMARY_SHORTCUTS = [
    ("Стирка", "section", "laundry"),
    ("Чистка", "section", "cleaning"),
    ("Кухня", "section", "kitchen"),
    ("Ванная", "section", "bathroom"),
    ("Волосы", "section", "hair"),
    ("Тело", "section", "body"),
    ("Зубы", "section", "oral"),
    ("Бритьё", "section", "shaving"),
    ("Парфюм", "section", "perfume"),
    ("Дом и уют", "section", "home"),
    ("Прочее", "section", "other"),
    ("Dalli / Dash", "query", "Dalli|Dash"),
    ("Pink Stuff", "query", "The Pink Stuff"),
    ("Felce Azzurra", "query", "Felce Azzurra"),
    ("Dr. Beckmann", "query", "Dr. Beckmann"),
    ("Kamill / Glysolid", "query", "Kamill|Glysolid"),
]
EXPECTED_SECTION_IDS = {
    value for _, target_type, value in EXPECTED_PRIMARY_SHORTCUTS if target_type == "section"
}
EXPECTED_SECTION_LABELS = {
    value: label for label, target_type, value in EXPECTED_PRIMARY_SHORTCUTS if target_type == "section"
}


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def products_by_code(document):
    return {
        str(product.get("sourceCode") or product.get("code") or "").strip(): product
        for product in document.get("products", [])
        if str(product.get("sourceCode") or product.get("code") or "").strip()
    }


def source_code(product):
    return str(product.get("sourceCode") or product.get("code") or "").strip()


def shortcut_signature(item, label_field):
    if item.get("section"):
        return (item.get(label_field), "section", item.get("section"))
    if item.get("query"):
        return (item.get(label_field), "query", item.get("query"))
    return None


def gallery(product):
    values = product.get("galleryImages") or []
    if values:
        return [str(value) for value in values if value]
    return [str(product["image"])] if product.get("image") else []


def is_service(product):
    code = str(product.get("sourceCode") or product.get("code") or "").strip()
    title = str(product.get("title") or product.get("sourceName1C") or "").strip().lower()
    return code == "2322" or title == "доставка по городу"


def is_active(product):
    return product.get("status") == "active" and product.get("inStock") is not False


def require(condition, message, errors):
    if not condition:
        errors.append(message)


def main():
    parser = argparse.ArgumentParser(description="Verify non-regression invariants for a retail release.")
    parser.add_argument("--site-root", default=str(ROOT), help="Candidate source or packaged site root")
    parser.add_argument("--source-root", default=str(ROOT), help="Source tree containing page catalog and slug registry")
    parser.add_argument("--previous-site", default=str(DEFAULT_PREVIOUS))
    parser.add_argument("--baseline-master", default=str(DEFAULT_BASELINE_MASTER))
    parser.add_argument("--current-master", default=str(DEFAULT_CURRENT_MASTER))
    args = parser.parse_args()

    site = Path(args.site_root).resolve()
    source = Path(args.source_root).resolve()
    previous = Path(args.previous_site).resolve()
    errors = []

    public = load_json(site / "data" / "public-catalog.json")
    pages = load_json(site / "data" / "product-pages.json")
    landing_pages = load_json(site / "data" / "landing-pages.json")
    config = load_json(site / "data" / "site-config.json")
    page_catalog_path = source / "data" / "page-catalog.json"
    page_catalog = load_json(page_catalog_path) if page_catalog_path.exists() else None
    registry = load_json(source / "data" / "product-slug-registry.json")
    alias_registry = load_json(source / "data" / "product-url-aliases.json")
    landing_registry = load_json(source / "data" / "landing-page-registry.json")
    current_master = load_json(Path(args.current_master))
    baseline_master = load_json(Path(args.baseline_master))

    public_products = public.get("products", [])
    current_products = current_master.get("products", [])
    expected_public_count = sum(1 for item in current_products if is_active(item) and not is_service(item))
    expected_history_count = sum(1 for item in current_products if not is_service(item))
    require(
        len(public_products) == expected_public_count,
        f"public product count does not match the master: {len(public_products)} != {expected_public_count}",
        errors,
    )
    require(all(item.get("status") == "active" and item.get("inStock") is not False for item in public_products), "public catalog exposes an inactive/out-of-stock product", errors)
    require(
        all(str(item.get("productPagePath") or "").startswith("/product/") for item in public_products),
        "one or more active products lack an exact generated product page path",
        errors,
    )
    require(not any(str(item.get("sourceCode")) == "2322" for item in public_products), "service code 2322 is public", errors)
    raw_titles = [
        item for item in public_products
        if str(item.get("sourceCode") or "")
        and re.match(rf"^\s*{re.escape(str(item.get('sourceCode')))}(?:\s|[-:])", str(item.get("title") or ""), re.I)
    ]
    require(not raw_titles, f"raw 1C code prefixes remain in {len(raw_titles)} public titles", errors)
    products_without_sections = [source_code(item) for item in public_products if not item.get("sectionIds")]
    require(not products_without_sections, f"active products without storefront sections: {', '.join(products_without_sections[:20])}", errors)
    invalid_sections = sorted({
        section
        for item in public_products
        for section in (item.get("sectionIds") or [])
        if section not in EXPECTED_SECTION_IDS
    })
    require(not invalid_sections, f"unknown/deprecated storefront sections remain: {', '.join(invalid_sections)}", errors)
    bad_section_labels = [
        source_code(item)
        for item in public_products
        if item.get("sectionLabels") != [EXPECTED_SECTION_LABELS[section] for section in item.get("sectionIds", [])]
    ]
    require(not bad_section_labels, f"storefront section labels do not match ids: {', '.join(bad_section_labels[:20])}", errors)
    fragrance_kinds = {
        "perfume_decant", "deodorant_stick", "deodorant_spray", "deodorant_rollon",
        "deodorant_gel", "mineral_deodorant", "air_freshener",
    }
    missing_perfume_crosslist = [
        source_code(item)
        for item in public_products
        if item.get("productKind") in fragrance_kinds and "perfume" not in (item.get("sectionIds") or [])
    ]
    require(not missing_perfume_crosslist, f"fragrance products missing from perfume: {', '.join(missing_perfume_crosslist[:20])}", errors)

    if page_catalog:
        all_products = page_catalog.get("products", [])
        require(
            len(all_products) == expected_history_count,
            f"historical page catalog does not match the master: {len(all_products)} != {expected_history_count}",
            errors,
        )
        require(not any(str(item.get("sourceCode")) == "2322" for item in all_products), "service code 2322 is in page catalog", errors)
        by_code = products_by_code(page_catalog)
        for code in ("660",):
            require(code in by_code and not gallery(by_code[code]), f"held code {code} received an unapproved photo", errors)
        for code in (
            "3243",
            "3246",
            "3247",
            "3248",
            "3249",
            "3250",
            "3253",
            "3260",
            "3269",
            "3271",
            "3285",
            "3286",
            "3288",
        ):
            require(code in by_code and len(gallery(by_code[code])) == 3, f"approved code {code} does not have exactly three photos", errors)
        code_3260 = by_code.get("3260", {})
        require(code_3260.get("title") == "The Pink Stuff Power Active блок для унитаза, 2x40 г", "code 3260 title regressed", errors)
        require(code_3260.get("brand") == "The Pink Stuff", "code 3260 brand regressed", errors)
        raw_photo_mappings = [
            source_code(item) for item in all_products
            if any("/telegram-" in f"/{path}" for path in gallery(item))
        ]
        require(not raw_photo_mappings, f"raw Telegram paths remain mapped: {', '.join(raw_photo_mappings[:20])}", errors)

    baseline_by_code = products_by_code(baseline_master)
    current_by_code = products_by_code(current_master)
    lost_galleries = []
    for code, old in baseline_by_code.items():
        if code == "660":
            # Fairy Apple is deliberately held without a photo after the old
            # baseline image was rejected as a non-exact product match.
            continue
        old_gallery = gallery(old)
        if not old_gallery:
            continue
        new = current_by_code.get(code)
        if not new or not gallery(new):
            lost_galleries.append(code)
    require(not lost_galleries, f"historical galleries disappeared for codes: {', '.join(lost_galleries[:20])}", errors)

    manifest_pages = pages.get("pages", [])
    manifest_slugs = {item.get("slug") for item in manifest_pages}
    manifest_paths = {item.get("path") for item in manifest_pages}
    missing_public_paths = sorted(
        str(item.get("productPagePath") or "")
        for item in public_products
        if item.get("productPagePath") not in manifest_paths
    )
    require(not missing_public_paths, f"active product paths missing from manifest: {', '.join(missing_public_paths[:20])}", errors)
    require(len(manifest_pages) >= 604, f"product-page manifest shrank below legacy floor: {len(manifest_pages)}", errors)
    previous_slugs = {path.parent.name for path in (previous / "product").glob("*/index.html")}
    missing_legacy = sorted(previous_slugs - manifest_slugs)
    require(not missing_legacy, f"legacy product URLs missing: {', '.join(missing_legacy[:20])}", errors)
    require(previous_slugs.issubset(set(registry.get("byId", {}).values()) | set(registry.get("bySourceCode", {}).values())), "slug registry does not protect every previous URL", errors)

    product_dirs = {path.parent.name for path in (site / "product").glob("*/index.html")}
    require(manifest_slugs == product_dirs, f"manifest/files mismatch: manifest={len(manifest_slugs)} files={len(product_dirs)}", errors)
    redirects_path = site / "_redirects"
    redirect_rows = {}
    if redirects_path.exists():
        for raw_line in redirects_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                source_path, target_path = parts[0], parts[1]
                status = parts[2] if len(parts) >= 3 else "302"
                redirect_rows.setdefault(source_path, []).append((target_path, status))
    redirect_product_slugs = {
        source_path.strip("/").split("/")[-1]
        for source_path in redirect_rows
        if source_path.startswith("/product/")
    }
    shadowed_pages = sorted(manifest_slugs & redirect_product_slugs)
    require(not shadowed_pages, f"generated product pages shadowed by redirects: {', '.join(shadowed_pages[:20])}", errors)

    alias_errors = []
    for alias in alias_registry.get("aliases", []):
        source_path = str(alias.get("from") or "").strip()
        target_path = str(alias.get("to") or "").strip()
        rows = redirect_rows.get(source_path, [])
        if rows != [(target_path, "301")]:
            alias_errors.append(f"{source_path}: {rows}")
        if source_path in manifest_paths:
            alias_errors.append(f"{source_path}: shadows generated page")
        if target_path not in manifest_paths:
            alias_errors.append(f"{source_path}: missing target {target_path}")
    require(not alias_errors, f"legacy product URL aliases are incomplete: {'; '.join(alias_errors[:10])}", errors)

    landing_manifest_keys = {
        (item.get("type"), item.get("slug"))
        for item in landing_pages.get("pages", [])
    }
    missing_landing_history = [
        f"{item.get('type')}:{item.get('slug')}"
        for item in landing_registry.get("pages", [])
        if (item.get("type"), item.get("slug")) not in landing_manifest_keys
    ]
    require(
        not missing_landing_history,
        f"landing URL history missing from manifest: {', '.join(missing_landing_history[:20])}",
        errors,
    )

    inactive_checked = 0
    active_checked = 0
    for item in manifest_pages:
        path = site / "product" / str(item.get("slug")) / "index.html"
        require(path.exists(), f"missing generated page: {path}", errors)
        if not path.exists():
            continue
        html = path.read_text(encoding="utf-8")
        require("const galleryButtons" in html, f"gallery swipe missing: {item.get('slug')}", errors)
        require("Лицевая</span>" not in html and "Обратная</span>" not in html, f"visible photo labels returned: {item.get('slug')}", errors)
        if item.get("inStock") is False and inactive_checked < 10:
            inactive_checked += 1
            require("Сейчас нет в наличии" in html, f"inactive page lacks status: {item.get('slug')}", errors)
            require("https://schema.org/OutOfStock" in html, f"inactive page lacks OutOfStock schema: {item.get('slug')}", errors)
            has_purchase_control = bool(re.search(r'<(?:button|a)\b[^>]*\bdata-add-cart\b', html, re.I))
            require(not has_purchase_control, f"inactive page can be added to cart: {item.get('slug')}", errors)
        elif item.get("inStock") is True and active_checked < 10:
            active_checked += 1
            require("purchase-price" in html and html.find("purchase-price") < html.find("data-add-cart"), f"price is not above cart button: {item.get('slug')}", errors)
    require(inactive_checked > 0, "no inactive product page was verified", errors)
    require(active_checked > 0, "no active product page was verified", errors)

    banner_images = [item.get("image") for item in config.get("banners", []) if item.get("active") is not False]
    require(banner_images == EXPECTED_BANNERS, f"banner set/order changed: {banner_images}", errors)
    menu_shortcuts = [
        shortcut_signature(item, "label") for item in config.get("menu", [])
        if item.get("section") or item.get("query")
    ]
    quick_shortcuts = [shortcut_signature(item, "title") for item in config.get("quickCategories", [])]
    require(menu_shortcuts == EXPECTED_PRIMARY_SHORTCUTS, f"primary menu shortcuts changed: {menu_shortcuts}", errors)
    require(quick_shortcuts == EXPECTED_PRIMARY_SHORTCUTS, f"quick category shortcuts changed: {quick_shortcuts}", errors)
    menu_group_starts = [item.get("label") for item in config.get("menu", []) if item.get("groupStart")]
    quick_group_starts = [item.get("title") for item in config.get("quickCategories", []) if item.get("groupStart")]
    require(menu_group_starts == ["Dalli / Dash"], f"menu brand divider changed: {menu_group_starts}", errors)
    require(quick_group_starts == ["Dalli / Dash"], f"quick-category brand divider changed: {quick_group_starts}", errors)
    supplemental = {item.get("label"): item.get("href") for item in config.get("menu", []) if item.get("href")}
    require("audience=kids" in str(supplemental.get("Детское") or ""), "supplemental Детское link is missing", errors)
    require(supplemental.get("Европа") == "/collection/europe/", "supplemental Европа link is missing", errors)
    footer_text = str(config.get("footerText") or "")
    require("Григорьев Василий Владимирович" in footer_text and "21509198010011" in footer_text, "legal requisites missing from site config", errors)
    footer_html = (site / "partials" / "footer.html").read_text(encoding="utf-8") if (site / "partials" / "footer.html").exists() else (site / "index.html").read_text(encoding="utf-8")
    privacy_html = (site / "privacy.html").read_text(encoding="utf-8")
    for label, text in (("footer", footer_html), ("privacy", privacy_html)):
        require("Григорьев Василий Владимирович" in text and "21509198010011" in text, f"legal requisites missing from {label}", errors)

    policy_path = site / "delivery-and-returns" / "index.html"
    require(policy_path.exists(), "delivery and returns page is missing", errors)
    policy_html = policy_path.read_text(encoding="utf-8") if policy_path.exists() else ""
    require("5 000 сом" in policy_html and "14 дней" in policy_html, "delivery/return terms are incomplete", errors)
    require("21509198010011" in policy_html, "legal requisites missing from delivery/return page", errors)
    require("/delivery-and-returns/" in footer_html, "delivery/return link is missing from footer", errors)

    routes = load_json(site / "_routes.json")
    require(routes == {"version": 1, "include": ["/api/*"], "exclude": []}, "Cloudflare function routes are not restricted to /api/*", errors)

    wholesale_path = site / "opt" / "index.html"
    require(wholesale_path.exists(), "public wholesale landing page is missing", errors)
    wholesale_html = wholesale_path.read_text(encoding="utf-8") if wholesale_path.exists() else ""
    require('rel="canonical" href="https://globalmarket.kg/opt/"' in wholesale_html, "wholesale canonical URL is missing", errors)
    require('content="index,follow,max-image-preview:large"' in wholesale_html, "wholesale page is not explicitly indexable", errors)
    require("https://globalmarket.kg/opt/" in (site / "sitemap.xml").read_text(encoding="utf-8"), "wholesale page is missing from sitemap", errors)
    require("generate_lead" in (site / "assets" / "wholesale.js").read_text(encoding="utf-8"), "wholesale lead measurement is missing", errors)

    public_html_paths = [site / "index.html", site / "privacy.html", policy_path, site / "catalog" / "index.html", wholesale_path]
    for dirname in ("category", "collection", "brand", "product"):
        public_html_paths.extend((site / dirname).glob("*/index.html"))
    for path in public_html_paths:
        if not path.exists():
            continue
        html = path.read_text(encoding="utf-8")
        require(html.count('id="gmk-google-tag-loader"') == 1, f"Google tag count mismatch: {path.relative_to(site)}", errors)
        require(html.count('id="gmk-google-consent-script"') == 1, f"Google consent script count mismatch: {path.relative_to(site)}", errors)
        require(html.count('class="gmk-consent"') == 1, f"Google consent banner count mismatch: {path.relative_to(site)}", errors)
        require("analytics_storage: 'denied'" in html, f"denied-by-default consent missing: {path.relative_to(site)}", errors)
        if 'id="gmk-google-tag-loader"' in html and "analytics_storage: 'denied'" in html:
            require(html.index("analytics_storage: 'denied'") < html.index('id="gmk-google-tag-loader"'), f"Google loader precedes consent default: {path.relative_to(site)}", errors)
        require("/cdn-cgi/l/email-protection" not in html, f"Cloudflare email-protection URL leaked into source: {path.relative_to(site)}", errors)
    for path in (site / "privacy.html", policy_path, wholesale_path):
        html = path.read_text(encoding="utf-8")
        mailto_index = html.find('href="mailto:')
        require(mailto_index >= 0, f"manager email link missing: {path.relative_to(site)}", errors)
        if mailto_index >= 0:
            begin_index = html.rfind("<!--email_off-->", 0, mailto_index)
            end_index = html.find("<!--/email_off-->", mailto_index)
            require(begin_index >= 0 and end_index > mailto_index, f"Cloudflare email opt-out missing: {path.relative_to(site)}", errors)
    consent_js = (site / "assets" / "google-consent.js").read_text(encoding="utf-8")
    require("AW-18474068233/UR-oCOSq7oQdEInSj-lE" in consent_js and "order_submitted" in consent_js, "Google Ads/order measurement was lost", errors)

    headers = (site / "_headers").read_text(encoding="utf-8")
    expected_release = str(current_master.get("sourceRelease") or "").strip()
    require(expected_release and expected_release in headers, "release verification header is missing", errors)

    app = (site / "app.js").read_text(encoding="utf-8")
    require('loadMore.addEventListener("click"' in app and "previousOverflowAnchor" in app, "load-more scroll preservation missing", errors)
    require("function scrollToCatalogResults" in app, "category result scrolling helper missing", errors)
    require("5 000" in (site / "index.html").read_text(encoding="utf-8"), "5,000 KGS delivery threshold missing", errors)
    require('freshArrival === true' in app and "firstSeenAt" in app and "restockedAt" not in app[app.find("function freshProducts("):app.find("function renderFreshProducts(")], "fresh-arrivals contract changed", errors)

    for banner in EXPECTED_BANNERS:
        asset = site / banner.lstrip("/")
        require(asset.exists(), f"banner asset missing: {banner}", errors)

    if errors:
        print("Release invariant verification FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Release invariant verification OK")
    print(f"- public products: {len(public_products)}")
    print(f"- historical product pages: {len(manifest_pages)}")
    print(f"- protected legacy URLs: {len(previous_slugs)}")
    print(f"- inactive pages sampled: {inactive_checked}")


if __name__ == "__main__":
    main()
