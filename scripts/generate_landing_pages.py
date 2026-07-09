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
                    "name": "Каталог",
                    "item": f"{SITE_URL}/catalog/",
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": target["title"],
                    "item": canonical,
                },
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def has_product_image(product):
    # Presence-only check (not existence-on-disk) to mirror hasProductImage()
    # in app.js, since that's what the "Хит" badge rule keys off there.
    return bool(product.get("image") or product.get("galleryImages"))


def product_badges(product):
    """Marketing badges shown bottom-left of a product tile. Mirrors
    productBadges() in app.js and product_badges() in
    scripts/generate_product_pages.py — keep all three in sync (parity is
    asserted by tests/catalog-badges-parity.test.mjs)."""
    badges = []
    if product.get("categoryId") == "perfume" or product.get("brand") == "Concord":
        badges.append("Новинка")
    if has_product_image(product) and float(product.get("rating") or 0) >= 4.8:
        badges.append("Хит")
    retail = float(product.get("retailPriceKgs") or 0)
    if 0 < retail <= 500:
        badges.append("Выгодно")
    return badges[:2]


def has_discount(product):
    """A manual promo discount is active (data/discounts.json ->
    discountPercent/originalPriceKgs on the catalog). Mirrors hasDiscount() in
    app.js."""
    discount_percent = product.get("discountPercent") or 0
    original = product.get("originalPriceKgs") or 0
    retail = product.get("retailPriceKgs") or 0
    return discount_percent > 0 and original > retail


def discount_badge_html(product):
    if not has_discount(product):
        return ""
    return f'<span class="discount-badge">-{int(product["discountPercent"])}%</span>'


def price_with_discount_html(product):
    current = price_html(product.get("retailPriceKgs", 0))
    if not has_discount(product):
        return f'<span class="price">{current}</span>'
    original = price_html(product["originalPriceKgs"])
    return f'<span class="price-group"><span class="price">{current}</span><span class="price-original">{original}</span></span>'


def product_size(title):
    text = str(title or "").replace(",", ".")
    combo = re.search(
        r"(?:^|\s)(\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g)\s*\+\s*\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g))(?:\s|$)",
        text,
        re.I,
    )
    single = re.search(r"(?:^|\s)(\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g|шт))(?:\s|$)", text, re.I)
    value = combo or single
    if not value:
        return ""
    return (
        value.group(1)
        .replace(".", ",")
        .replace("ml", "мл")
        .replace("ML", "мл")
        .replace("kg", "кг")
        .replace("KG", "кг")
    )


def display_product_type(product):
    # Mirrors display_product_type() in scripts/generate_product_pages.py.
    product_type = product.get("productType") or ""
    category = product.get("category") or "товар"
    title = product.get("title") or ""
    lower = f"{product_type} {category} {title}".lower()
    if "ополаскив" in lower or "кондиционер для белья" in lower:
        return "ополаскиватель"
    if "гель для стирки" in lower:
        return "гель для стирки"
    if "порош" in lower:
        return "стиральный порошок"
    if "шамп" in lower:
        return "шампунь"
    if "гель для бритья" in lower:
        return "гель для бритья"
    if "пена для бритья" in lower:
        return "пена для бритья"
    if "запас" in lower or "кассет" in lower:
        return "кассеты для станка"
    if "станок" in lower:
        return "станок для бритья"
    if "парфюм" in lower:
        return "парфюм на разлив"
    return product_type or category


def strip_first(text, needle):
    text = str(text or "").strip()
    needle = str(needle or "").strip()
    if not text or not needle:
        return text
    pattern = re.compile(re.escape(needle), re.I)
    return pattern.sub("", text, count=1).strip(" -·,")


def product_display_parts(product):
    # Mirrors product_display_parts() in scripts/generate_product_pages.py and
    # productDisplayParts() in app.js.
    brand = product.get("brand") or "Global Market"
    product_type = display_product_type(product)
    size = product_size(product.get("title"))
    variant = product.get("title") or ""
    for part in (brand, product.get("productType"), product_type, size):
        variant = strip_first(variant, part)
    variant = re.sub(r"\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g|шт)", "", variant, flags=re.I)
    variant = re.sub(r"\s+", " ", variant.replace("(", " ").replace(")", " ")).strip(" -·,")
    if not variant or variant.lower() == brand.lower():
        variant = (product.get("description") or product.get("title") or "").split(".")[0]
    return {"brand": brand, "type": product_type, "size": size, "variant": variant}


def product_tile_html(product, href):
    """One catalog-style tile: brand pill, like button, marketing + discount
    badges, image, title/type/variant, category, description, price (with
    strikethrough original when discounted), add-to-cart. Matches the home
    page .product-card markup (renderProducts() in app.js) and
    scripts/generate_product_pages.py's product_tile_html() exactly, reusing
    the same styles.css classes."""
    image = public_path(product_image(product))
    if not image:
        return ""
    display = product_display_parts(product)
    badges = product_badges(product)
    tones = product.get("tones") or ["#f4f4f6", "#ffffff"]
    tone_a = escape(tones[0] if len(tones) > 0 else "#f4f4f6")
    tone_b = escape(tones[1] if len(tones) > 1 else tone_a)
    product_id = escape(product.get("id"))
    badges_html = (
        f'<div class="marketing-badges">{"".join(f"<span>{escape(b)}</span>" for b in badges)}</div>'
        if badges
        else ""
    )
    size_html = f'<span>{escape(display["size"])}</span>' if display["size"] else ""
    # rstrip each line: badges_html/discount_badge_html can be "" for a given
    # product, which would otherwise leave an indentation-only line behind
    # (fails git diff --check's trailing-whitespace guard).
    return "\n".join(line.rstrip() for line in f"""
            <article class="product-card">
              <div class="product-visual" style="--tone-a: {tone_a}; --tone-b: {tone_b}">
                <span class="placeholder-brand">{escape(product.get("brand") or "GM")}</span>
                <button class="favorite-button" type="button" data-favorite="{product_id}" aria-label="Добавить в избранное" aria-pressed="false">
                  <svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.6c0 5.4-8.8 10.2-8.8 10.2S3.2 14 3.2 8.6A4.8 4.8 0 0 1 12 5.9a4.8 4.8 0 0 1 8.8 2.7Z"></path></svg>
                </button>
                {badges_html}
                {discount_badge_html(product)}
                <a class="product-image-link" href="{escape(href)}" data-product-link="{product_id}" aria-label="Открыть {escape(product.get("title"))}">
                  <img class="product-image" src="{escape(image)}" alt="{escape(product.get("title"))}" loading="lazy">
                </a>
              </div>
              <div class="product-info">
                <a class="product-title-button product-copy" href="{escape(href)}" data-product-link="{product_id}">
                  <span class="product-brand-line">{escape(display["brand"])}</span>
                  <span class="product-kind-line">
                    <strong>{escape(display["type"])}</strong>
                    {size_html}
                  </span>
                  <span class="product-variant-line">{escape(display["variant"])}</span>
                </a>
                <div class="product-meta product-meta-compact">
                  <span>{escape(product.get("category"))}</span>
                </div>
                <p>{escape(product.get("description"))}</p>
                <div class="price-stack">
                  <div class="price-action-row">
                    {price_with_discount_html(product)}
                    <button class="add-button compact-add-button" type="button" data-add="{product_id}" aria-label="Добавить в корзину">В корзину</button>
                  </div>
                  <span class="registered-price-note">Цена при входе: {price_html(product.get("registeredPriceKgs", 0))}</span>
                </div>
              </div>
            </article>
    """.splitlines())


def render_cards(products, product_page_by_id):
    cards = []
    for product in products[:36]:
        page = product_page_by_id.get(product.get("id"))
        if not page:
            continue
        card = product_tile_html(product, page["path"])
        if card:
            cards.append(card)
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
    """.rstrip("\n ") + "\n"


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
    share_image = f"{SITE_URL}/assets/hero-green-wide-v1.png"
    for product in products:
        img = public_path(product_image(product))
        if img:
            share_image = img if img.startswith("http") else f"{SITE_URL}{img}"
            break
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
  <link rel="icon" type="image/jpeg" href="/assets/brand/globalmarket-tech-orb-tight.jpg">
  <link rel="apple-touch-icon" href="/assets/brand/globalmarket-tech-orb.jpg">
  <meta name="theme-color" content="#ffffff">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="description" content="{escape(description)}">
  <link rel="canonical" href="{escape(canonical)}">
  <meta property="og:site_name" content="Global Market KG">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(description)}">
  <meta property="og:url" content="{escape(canonical)}">
  <meta property="og:image" content="{escape(share_image)}">
  <meta property="og:locale" content="ru_RU">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escape(title)}">
  <meta name="twitter:description" content="{escape(description)}">
  <meta name="twitter:image" content="{escape(share_image)}">
  <link rel="stylesheet" href="/styles.css?v=20260709-marketplace-nav-2">
  <script type="application/ld+json">{breadcrumb_json_ld(target, canonical)}</script>
  <script type="application/ld+json">{item_list_json_ld(products, product_page_by_id)}</script>
  <style>
    body.landing-page {{ margin: 0; padding-top: var(--site-header-height, 58px); background: #f2f3f5; color: #202124; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; }}
    .landing-main {{ max-width: 1120px; margin: 0 auto; padding: 26px 18px 36px; }}
    .landing-hero {{ display: grid; gap: 14px; padding: 28px 0 22px; }}
    .breadcrumbs {{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 14px; color: #6e6e73; }}
    .breadcrumbs a {{ color: #515154; text-decoration: none; }}
    .breadcrumbs a:hover {{ text-decoration: underline; }}
    .breadcrumbs span[aria-current] {{ color: #1d1d1f; font-weight: 600; }}
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
    /* Cards inside .landing-grid reuse the shared .product-card rules from
       styles.css (loaded above) so they render identically to home-page
       catalog cards — same brand pill, like button, badges, price, add
       button. Only the grid container itself is defined here. */
    .landing-grid {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }}
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
      <nav class="breadcrumbs" aria-label="Хлебные крошки">
        <a href="/">Главная</a>
        <span aria-hidden="true">›</span>
        <a href="/catalog/">Каталог</a>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{escape(title)}</span>
      </nav>
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
  <script>
    const cartKey = "globalMarketCartDraft";
    const favoritesKey = "globalMarketFavorites";
    const recentlyViewedKey = "globalMarketRecentlyViewed";
    const categoryMenu = document.querySelector("#categoryMenu");
    const toggleMenuButton = document.querySelector("#toggleMenu");
    const smartHeader = document.querySelector("[data-smart-header]");

    function readJson(key, fallback) {{
      try {{
        return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
      }} catch (_) {{
        return fallback;
      }}
    }}

    function updateCartCount() {{
      const rows = readJson(cartKey, []);
      const count = rows.reduce((sum, row) => sum + Number(row[1] || 0), 0);
      document.querySelectorAll("[data-cart-count]").forEach((item) => {{
        item.textContent = String(count);
      }});
    }}

    // Product tiles carry a real id in data-favorite/data-add (see
    // scripts/generate_landing_pages.py product_tile_html()) — same contract
    // as the home page's renderProducts() in app.js and the "Похожие товары"
    // grid in scripts/generate_product_pages.py.
    function syncGridFavoriteButtons() {{
      const ids = new Set(readJson(favoritesKey, []));
      document.querySelectorAll(".landing-grid [data-favorite]").forEach((button) => {{
        const active = ids.has(button.dataset.favorite);
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-label", active ? "Убрать из избранного" : "Добавить в избранное");
      }});
    }}

    document.querySelector(".landing-grid")?.addEventListener("click", (event) => {{
      const favoriteButton = event.target.closest("[data-favorite]");
      const addButton = event.target.closest("[data-add]");
      const productLink = event.target.closest("[data-product-link]");
      if (favoriteButton) {{
        const id = favoriteButton.dataset.favorite;
        const ids = new Set(readJson(favoritesKey, []));
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        localStorage.setItem(favoritesKey, JSON.stringify([...ids]));
        syncGridFavoriteButtons();
        return;
      }}
      if (addButton) {{
        const id = addButton.dataset.add;
        const rows = readJson(cartKey, []);
        const index = rows.findIndex((row) => row[0] === id);
        if (index >= 0) rows[index][1] = Number(rows[index][1] || 0) + 1;
        else rows.push([id, 1]);
        localStorage.setItem(cartKey, JSON.stringify(rows));
        updateCartCount();
        addButton.classList.add("added");
        const originalLabel = addButton.textContent;
        window.setTimeout(() => {{
          addButton.classList.remove("added");
          addButton.textContent = originalLabel;
        }}, 900);
        addButton.textContent = "Добавлено";
        return;
      }}
      if (productLink) {{
        const ids = readJson(recentlyViewedKey, []);
        const next = [productLink.dataset.productLink, ...ids.filter((id) => id !== productLink.dataset.productLink)].slice(0, 20);
        localStorage.setItem(recentlyViewedKey, JSON.stringify(next));
      }}
    }});

    function setMenuOpen(isOpen) {{
      if (!categoryMenu || !toggleMenuButton) return;
      categoryMenu.hidden = !isOpen;
      toggleMenuButton.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) smartHeader?.classList.remove("header-hidden");
    }}

    async function renderMenu() {{
      if (!categoryMenu) return;
      try {{
        const response = await fetch("/data/site-config.json", {{ cache: "no-store" }});
        if (!response.ok) throw new Error("config");
        const config = await response.json();
        const items = Array.isArray(config.menu) ? config.menu : [];
        const catalogHref = (item) => {{
          if (item.href) return item.href;
          const params = new URLSearchParams();
          if (item.collection) params.set("collection", item.collection);
          if (item.category) params.set("category", item.category);
          if (item.query) params.set("query", item.query);
          if (item.label) params.set("label", item.label);
          const query = params.toString();
          return query ? `/?${{query}}#catalog` : "/#catalog";
        }};
        categoryMenu.innerHTML = items
          .map((item) => {{
            const href = catalogHref(item);
            return `<a href="${{href}}"><span class="category-menu-title">${{item.label || "Раздел"}}</span></a>`;
          }})
          .join("");
      }} catch (_) {{
        categoryMenu.innerHTML = '<a href="/#catalog"><span class="category-menu-title">Каталог</span></a>';
      }}
    }}

    toggleMenuButton?.addEventListener("click", (event) => {{
      event.stopPropagation();
      setMenuOpen(Boolean(categoryMenu?.hidden));
    }});

    document.addEventListener("click", (event) => {{
      if (categoryMenu?.hidden) return;
      if (event.target.closest("#categoryMenu") || event.target.closest("#toggleMenu")) return;
      setMenuOpen(false);
    }});

    document.querySelector("#openCart")?.addEventListener("click", () => {{
      window.location.href = "/#checkout";
    }});

    document.querySelector("#toggleSearch")?.addEventListener("click", () => {{
      window.location.href = "/#catalog";
    }});

    syncGridFavoriteButtons();
    updateCartCount();
    renderMenu();
  </script>
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
