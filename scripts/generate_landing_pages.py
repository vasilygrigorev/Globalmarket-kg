#!/usr/bin/env python3
import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "public-catalog.json"
PRODUCT_PAGES_PATH = ROOT / "data" / "product-pages.json"
SITE_CONFIG_PATH = ROOT / "data" / "site-config.json"
SEARCH_SYNONYMS_PATH = ROOT / "data" / "search-synonyms.json"
LANDING_PAGES_PATH = ROOT / "data" / "landing-pages.json"
HEADER_PARTIAL_PATH = ROOT / "partials" / "header.html"
FOOTER_PARTIAL_PATH = ROOT / "partials" / "footer.html"
REPORT_PATH = ROOT / "outputs" / "landing-pages-report.md"
SITE_URL = "https://globalmarket.kg"


def escape(value):
    return html.escape(str(value or ""), quote=True)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_partial(path):
    return path.read_text(encoding="utf-8").strip()


def money(value):
    return f"{int(value):,}".replace(",", " ")


def price_html(value):
    return f'{money(value)} <span class="som-sign">с</span>'


def slugify(value):
    value = str(value or "").lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "section"


def product_image(product):
    if product.get("image"):
        return product["image"]
    gallery = product.get("galleryImages") or []
    return gallery[0] if gallery else ""


def public_path(value):
    value = str(value or "").strip()
    if not value:
        return ""
    if value.startswith(("http://", "https://", "/")):
        return value
    return f"/{value}"


def product_text(product):
    return " ".join(
        str(product.get(key, ""))
        for key in ("title", "brand", "category", "productType", "description", "searchText")
    ).lower()


def product_matches(product, target):
    if product.get("inStock") is False:
        return False
    if target.get("brand") and product.get("brand") != target["brand"]:
        return False
    if target.get("category") and product.get("category") != target["category"]:
        return False
    if target.get("collection") and target["collection"] not in (product.get("collections") or []):
        return False
    query = (target.get("query") or "").strip().lower()
    if query and query not in product_text(product):
        return False
    return True


def target_search_groups(target, search_synonyms):
    groups = search_synonyms.get("groups") or []
    matches = []
    for group in groups:
        if target.get("collection") and target["collection"] in (group.get("collections") or []):
            matches.append(group)
            continue
        if target.get("category") and target["category"] in (group.get("categories") or []):
            matches.append(group)
            continue
        if target.get("category") and target["category"] in (group.get("landingCategories") or []):
            matches.append(group)
            continue
    return matches


def seo_terms(target):
    seen = set()
    terms = []
    for value in target.get("seoTerms") or []:
        value = str(value or "").strip()
        key = value.lower()
        if not value or key in seen:
            continue
        seen.add(key)
        terms.append(value)
    for group in target.get("searchGroups") or []:
        source_terms = group.get("landingTerms") or (group.get("aliases") or []) + (group.get("terms") or [])
        for value in source_terms:
            value = str(value or "").strip()
            key = value.lower()
            if not value or key in seen:
                continue
            seen.add(key)
            terms.append(value)
    return terms[:12]


def page_title(target):
    return target["title"]


def page_description(target, count):
    terms = seo_terms(target)[:4]
    suffix = f": {', '.join(terms)}" if terms else ""
    if target.get("collection") == "europe":
        return f"Европейские товары Global Market KG{suffix}. В подборке {count} товаров с ценами в сомах и заказом через WhatsApp."
    if target.get("brand"):
        return f"{target['title']} в Global Market KG{suffix}. В подборке {count} товаров бренда с ценами в сомах и заказом через WhatsApp."
    return f"{target['title']} в Global Market KG{suffix}. В наличии {count} товаров с ценами в сомах и заказом через WhatsApp."


def page_intro(target, count):
    terms = seo_terms(target)[:6]
    if target.get("collection") == "europe":
        base = f"Подборка европейских товаров: бытовая химия, стирка, уход и товары для дома. Сейчас в разделе {count} товаров."
    elif target.get("brand"):
        base = f"Страница бренда «{target['title']}» собирает товары этого бренда в одном месте. Сейчас в подборке {count} товаров."
    else:
        base = f"Раздел «{target['title']}» помогает быстро найти нужные товары по назначению. Сейчас в разделе {count} товаров."
    if terms:
        return f"{base} Поиск также понимает похожие запросы: {', '.join(terms)}."
    return base


def item_list_json_ld(products, product_page_by_id):
    items = []
    for index, product in enumerate(products, start=1):
        page = product_page_by_id.get(product.get("id"))
        if not page:
            continue
        items.append(
            {
                "@type": "ListItem",
                "position": index,
                "url": page["url"],
                "name": product.get("title"),
            }
        )
    return json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": items,
        },
        ensure_ascii=False,
        indent=2,
    )


def breadcrumb_json_ld(target, canonical):
    return json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Главная",
                    "item": SITE_URL,
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": target["title"],
                    "item": canonical,
                },
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def render_cards(products, product_page_by_id):
    cards = []
    for product in products[:36]:
        page = product_page_by_id.get(product.get("id"))
        image = public_path(product_image(product))
        if not page or not image:
            continue
        cards.append(
            f"""
            <a class="landing-card" href="{escape(page['path'])}">
              <img src="{escape(image)}" alt="{escape(product.get('title'))}" loading="lazy">
              <strong>{escape(product.get('title'))}</strong>
              <span>{price_html(product.get('retailPriceKgs', 0))}</span>
            </a>
            """
        )
    return "".join(cards)


def normalize_key(value):
    return str(value or "").strip().lower()


def indexed_targets(targets):
    index = {"category": {}, "brand": {}, "collection": {}}
    for target in targets:
        target_type = target.get("type")
        if target_type == "brand":
            index[target_type][normalize_key(target.get("title"))] = target
        else:
            index.setdefault(target_type, {})[target.get("slug")] = target
    return index


def count_by(products, getter):
    counts = {}
    for product in products:
        keys = getter(product)
        if isinstance(keys, str):
            keys = [keys]
        for key in keys or []:
            if key:
                counts[key] = counts.get(key, 0) + 1
    return counts


def link_card(target, count):
    return f"""
      <a class="landing-link-card" href="{escape(target.get('path'))}">
        <strong>{escape(target.get('title'))}</strong>
        <span>{int(count)} товаров</span>
      </a>
    """


def render_context_links(target, products, all_targets):
    index = indexed_targets(all_targets)
    sections = []

    if target.get("type") in {"category", "collection"}:
        brand_counts = count_by(products, lambda product: product.get("brand"))
        brand_links = []
        for brand, count in sorted(brand_counts.items(), key=lambda item: (-item[1], item[0].lower())):
            page = index.get("brand", {}).get(normalize_key(brand))
            if page and page.get("path") != target.get("path"):
                brand_links.append(link_card(page, count))
            if len(brand_links) >= 8:
                break
        if brand_links:
            sections.append(("Бренды в разделе", brand_links))

    if target.get("type") in {"brand", "collection"}:
        category_counts = count_by(products, lambda product: product.get("categoryId"))
        category_links = []
        for category_id, count in sorted(category_counts.items(), key=lambda item: (-item[1], item[0])):
            page = index.get("category", {}).get(category_id)
            if page and page.get("path") != target.get("path"):
                category_links.append(link_card(page, count))
            if len(category_links) >= 8:
                break
        if category_links:
            sections.append(("Разделы товаров", category_links))

    if target.get("type") in {"brand", "category"}:
        collection_counts = count_by(products, lambda product: product.get("collections") or [])
        collection_links = []
        for collection, count in sorted(collection_counts.items(), key=lambda item: (-item[1], item[0])):
            page = index.get("collection", {}).get(collection)
            if page and page.get("path") != target.get("path"):
                collection_links.append(link_card(page, count))
        if collection_links:
            sections.append(("Подборки", collection_links))

    if not sections:
        fallback_links = []
        for page in all_targets:
            if page.get("type") != "category" or page.get("path") == target.get("path"):
                continue
            count = sum(1 for product in products if product_matches(product, page))
            fallback_links.append(link_card(page, count))
            if len(fallback_links) >= 6:
                break
        if fallback_links:
            sections.append(("Другие разделы", fallback_links))

    if not sections:
        return ""

    section_html = "\n".join(
        f"""
        <section class="landing-link-section" aria-label="{escape(title)}">
          <h2>{escape(title)}</h2>
          <div class="landing-link-grid">{''.join(cards)}</div>
        </section>
        """
        for title, cards in sections
    )
    return f'<div class="landing-related-links">{section_html}</div>'


def render_page(target, products, product_page_by_id, all_targets):
    header = load_partial(HEADER_PARTIAL_PATH)
    footer = load_partial(FOOTER_PARTIAL_PATH)
    title = page_title(target)
    description = page_description(target, len(products))
    intro = page_intro(target, len(products))
    terms = seo_terms(target)
    canonical = f"{SITE_URL}{target['path']}"
    catalog_href = target.get("catalogHref") or "/#catalog"
    cards_html = render_cards(products, product_page_by_id)
    context_links_html = render_context_links(target, products, all_targets)
    if not cards_html:
        cards_html = f"""
            <div class="landing-empty">
              <p>Карточки товаров для этого раздела появятся после добавления фото. Все позиции можно посмотреть в общем каталоге.</p>
              <a href="{escape(catalog_href)}">Открыть раздел в каталоге</a>
            </div>
        """
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} | Global Market KG</title>
  <link rel="icon" href="data:,">
  <meta name="description" content="{escape(description)}">
  <link rel="canonical" href="{escape(canonical)}">
  <meta property="og:site_name" content="Global Market KG">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(description)}">
  <meta property="og:url" content="{escape(canonical)}">
  <meta property="og:image" content="{SITE_URL}/assets/hero-green-wide-v1.png">
  <meta property="og:locale" content="ru_RU">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escape(title)}">
  <meta name="twitter:description" content="{escape(description)}">
  <meta name="twitter:image" content="{SITE_URL}/assets/hero-green-wide-v1.png">
  <link rel="stylesheet" href="/styles.css?v=20260624-wa-product-actions">
  <script type="application/ld+json">{breadcrumb_json_ld(target, canonical)}</script>
  <script type="application/ld+json">{item_list_json_ld(products, product_page_by_id)}</script>
  <style>
    body.landing-page {{ margin: 0; padding-top: var(--site-header-height, 58px); background: #f2f3f5; color: #202124; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; }}
    .landing-main {{ max-width: 1120px; margin: 0 auto; padding: 26px 18px 36px; }}
    .landing-hero {{ display: grid; gap: 14px; padding: 28px 0 22px; }}
    .landing-hero h1 {{ margin: 0; font-size: clamp(34px, 6vw, 62px); font-weight: 300; line-height: 1.05; }}
    .landing-hero p {{ max-width: 720px; margin: 0; color: #636366; font-size: clamp(17px, 2vw, 22px); line-height: 1.45; }}
    .landing-actions {{ display: flex; gap: 10px; flex-wrap: wrap; }}
    .landing-actions a {{ min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 15px; border-radius: 8px; text-decoration: none; font-weight: 800; }}
    .landing-actions .primary {{ background: #111; color: #fff; }}
    .landing-actions .secondary {{ border: 1px solid #d2d2d7; color: #111; background: #fff; }}
    .landing-copy {{ margin: 0 0 18px; padding: 16px; border: 1px solid #e2e2e7; border-radius: 14px; background: #fff; }}
    .landing-copy p {{ margin: 0; color: #515154; font-size: 16px; line-height: 1.5; }}
    .landing-terms {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }}
    .landing-terms span {{ display: inline-flex; min-height: 30px; align-items: center; padding: 0 10px; border: 1px solid #e2e2e7; border-radius: 999px; color: #3a3a3c; background: #f8f8f9; font-size: 14px; }}
    .landing-grid {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }}
    .landing-card {{ display: grid; gap: 9px; min-width: 0; padding: 10px; border-radius: 14px; color: inherit; background: #fff; text-decoration: none; }}
    .landing-card img {{ width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 10px; }}
    .landing-card strong {{ font-size: 14px; line-height: 1.25; }}
    .landing-card span {{ font-size: 18px; font-weight: 850; }}
    .landing-empty {{ grid-column: 1 / -1; padding: 18px; border-radius: 14px; background: #fff; color: #515154; }}
    .landing-empty p {{ margin: 0 0 12px; font-size: 16px; line-height: 1.45; }}
    .landing-empty a {{ color: #111; font-weight: 800; }}
    .landing-related-links {{ display: grid; gap: 20px; margin-top: 30px; }}
    .landing-link-section h2 {{ margin: 0 0 10px; font-size: clamp(22px, 3vw, 30px); line-height: 1.15; }}
    .landing-link-grid {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }}
    .landing-link-card {{ display: grid; gap: 7px; min-height: 76px; align-content: center; padding: 13px; border: 1px solid #e2e2e7; border-radius: 12px; color: inherit; background: #fff; text-decoration: none; }}
    .landing-link-card strong {{ font-size: 16px; line-height: 1.2; }}
    .landing-link-card span {{ color: #6e6e73; font-size: 13px; }}
    @media (max-width: 720px) {{
      body.landing-page {{ padding-top: 45px; }}
      body.landing-page .header-search {{ display: none; }}
      body.landing-page .search-toggle {{ display: inline-flex; }}
      .landing-main {{ padding: 18px 12px 28px; }}
      .landing-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }}
      .landing-link-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    }}
  </style>
</head>
<body class="landing-page">
  {header}
  <main class="landing-main">
    <section class="landing-hero">
      <p class="eyebrow">Global Market KG</p>
      <h1>{escape(title)}</h1>
      <p>{escape(description)}</p>
      <div class="landing-actions">
        <a class="primary" href="{escape(catalog_href)}">Открыть в каталоге</a>
        <a class="secondary" href="/#top">На главную</a>
      </div>
    </section>
    <section class="landing-copy" aria-label="Описание раздела">
      <p>{escape(intro)}</p>
      {render_seo_terms(terms)}
    </section>
    <section class="landing-grid" aria-label="{escape(title)}">
      {cards_html}
    </section>
    {context_links_html}
  </main>
  {footer}
</body>
</html>
"""


def render_seo_terms(terms):
    if not terms:
        return ""
    chips = "".join(f"<span>{escape(term)}</span>" for term in terms)
    return f'<div class="landing-terms" aria-label="Популярные поисковые запросы">{chips}</div>'


def category_targets(catalog):
    targets = []
    for category in catalog.get("categories", []):
        if category.get("id") == "germany":
            continue
        title = category.get("title")
        slug = category.get("id") or slugify(title)
        href = f"/?category={quote(title)}&label={quote(title)}#catalog"
        targets.append(
            {
                "type": "category",
                "slug": slug,
                "title": title,
                "category": title,
                "path": f"/category/{slug}/",
                "catalogHref": href,
            }
        )
    return targets


def collection_targets(catalog):
    collection_counts = {}
    for product in catalog.get("products", []):
        for collection in product.get("collections") or []:
            collection_counts[collection] = collection_counts.get(collection, 0) + 1
    targets = []
    if collection_counts.get("europe"):
        targets.append(
            {
                "type": "collection",
                "slug": "europe",
                "title": "Европа",
                "collection": "europe",
                "path": "/collection/europe/",
                "catalogHref": "/?collection=europe&label=Европа#catalog",
            }
        )
    return targets


def brand_targets(products, product_page_by_id):
    brand_counts = {}
    brand_page_counts = {}
    for product in products:
        if product.get("inStock") is False:
            continue
        brand = str(product.get("brand") or "").strip()
        if not brand:
            continue
        brand_counts[brand] = brand_counts.get(brand, 0) + 1
        if product.get("id") in product_page_by_id and product_image(product):
            brand_page_counts[brand] = brand_page_counts.get(brand, 0) + 1

    targets = []
    for brand, count in sorted(brand_counts.items(), key=lambda item: (-item[1], item[0].lower())):
        if brand_page_counts.get(brand, 0) < 2:
            continue
        slug = slugify(brand)
        href = f"/?query={quote(brand)}&label={quote(brand)}#catalog"
        targets.append(
            {
                "type": "brand",
                "slug": slug,
                "title": brand,
                "brand": brand,
                "path": f"/brand/{slug}/",
                "catalogHref": href,
                "seoTerms": [
                    brand,
                    f"товары {brand}",
                    f"{brand} купить Бишкек",
                ],
            }
        )
    return targets


def write_landing_page(target, html_text):
    page_path = ROOT / target["path"].strip("/") / "index.html"
    page_path.parent.mkdir(parents=True, exist_ok=True)
    old = page_path.read_text(encoding="utf-8") if page_path.exists() else ""
    page_path.write_text(html_text, encoding="utf-8")
    return "created" if not old else ("updated" if old != html_text else "unchanged")


def main():
    parser = argparse.ArgumentParser(description="Generate static category and collection landing pages.")
    parser.add_argument("--report", action="store_true", help="Write outputs/landing-pages-report.md.")
    args = parser.parse_args()

    catalog = load_json(CATALOG_PATH)
    product_pages_manifest = load_json(PRODUCT_PAGES_PATH)
    search_synonyms = load_json(SEARCH_SYNONYMS_PATH)
    product_page_by_id = {item["id"]: item for item in product_pages_manifest.get("pages", [])}
    products = catalog.get("products", [])
    targets = category_targets(catalog) + collection_targets(catalog) + brand_targets(products, product_page_by_id)
    manifest_pages = []
    rows = []

    for target in targets:
        target["searchGroups"] = target_search_groups(target, search_synonyms)
        matched = [product for product in products if product_matches(product, target)]
        matched.sort(key=lambda item: (0 if product_image(item) and item.get("id") in product_page_by_id else 1, item.get("title", "")))
        status = write_landing_page(target, render_page(target, matched, product_page_by_id, targets))
        manifest_pages.append(
            {
                "type": target["type"],
                "slug": target["slug"],
                "title": target["title"],
                "path": target["path"],
                "url": f"{SITE_URL}{target['path']}",
                "count": len(matched),
                "seoTerms": seo_terms(target),
                "shown": min(36, sum(1 for product in matched if product_image(product) and product.get("id") in product_page_by_id)),
            }
        )
        rows.append((status, target, len(matched)))
        print(f"{status}: {target['path']} ({len(matched)} products)")

    LANDING_PAGES_PATH.write_text(
        json.dumps({"count": len(manifest_pages), "pages": manifest_pages}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    if args.report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "# Landing Pages Report",
            "",
            f"Pages: `{len(manifest_pages)}`",
            "",
            "| Status | Page | Products |",
            "|---|---|---:|",
        ]
        for status, target, count in rows:
            lines.append(f"| {status} | `{target['path']}` | {count} |")
        REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"Report: {REPORT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    raise SystemExit(main())
