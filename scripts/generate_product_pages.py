#!/usr/bin/env python3
import argparse
import html
import json
import re
import urllib.parse
from datetime import date
from pathlib import Path

from classify_taxonomy import related_rank_key

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "public-catalog.json"
PRODUCT_PAGES_MANIFEST_PATH = ROOT / "data" / "product-pages.json"
LANDING_PAGES_MANIFEST_PATH = ROOT / "data" / "landing-pages.json"
OUTPUT_ROOT = ROOT / "product"
REPORT_PATH = ROOT / "outputs" / "product-pages-report.md"
HEADER_PARTIAL_PATH = ROOT / "partials" / "header.html"
FOOTER_PARTIAL_PATH = ROOT / "partials" / "footer.html"
SITE_URL = "https://globalmarket.kg"

TRANSLIT = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "e",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
)


def slugify(value):
    value = value.lower().translate(TRANSLIT)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or "product"


def product_slug(product):
    return f"{slugify(product.get('title', 'product'))}-{product.get('id', '')[-6:]}"


def escape(value):
    return html.escape(str(value or ""), quote=True)


def money(value):
    return f"{int(value):,}".replace(",", " ")


def price_html(value):
    return f'{money(value)} <span class="som-sign">с</span>'


def has_product_image(product):
    # Presence-only check (not existence-on-disk) to mirror hasProductImage() in
    # app.js exactly, since that's what the "Хит" badge rule keys off there.
    return bool(product.get("image") or product.get("galleryImages"))


def product_badges(product):
    """Marketing badges shown bottom-left of a product tile. Mirrors
    productBadges() in app.js — keep both in sync (parity is asserted by
    tests/catalog-badges-parity.test.mjs)."""
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
    """'-XX%' badge shown bottom-right of a product tile when a discount is
    active. Mirrors discountBadgeHtml() in app.js."""
    if not has_discount(product):
        return ""
    return f'<span class="discount-badge">-{int(product["discountPercent"])}%</span>'


def price_with_discount_html(product):
    """Current (retail) price, with the crossed-out original price alongside
    it when a discount is active. Mirrors priceWithDiscountHtml() in app.js."""
    current = price_html(product.get("retailPriceKgs", 0))
    if not has_discount(product):
        return f'<span class="price">{current}</span>'
    original = price_html(product["originalPriceKgs"])
    return f'<span class="price-group"><span class="price">{current}</span><span class="price-original">{original}</span></span>'


def load_partial(path):
    return path.read_text(encoding="utf-8").strip()


def image_exists(path):
    return bool(path) and (ROOT / path.lstrip("/")).exists()


def product_images(product):
    gallery = product.get("galleryImages") or []
    if gallery:
        return [image for image in gallery if image_exists(image)]
    image = product.get("image")
    return [image] if image_exists(image) else []


def missing_product_images(product):
    gallery = product.get("galleryImages") or []
    images = gallery if gallery else ([product.get("image")] if product.get("image") else [])
    return [image for image in images if image and not image_exists(image)]


def is_in_stock(product):
    return product.get("status") == "active"


def skip_reason(product):
    if not is_in_stock(product):
        return "товар скрыт или не активен"
    if not product.get("retailPriceKgs"):
        return "нет розничной цены"
    if missing_product_images(product):
        return "есть ссылки на отсутствующие изображения"
    if not product_images(product):
        return "нет существующих фото"
    return ""


def eligible_products(products):
    return [product for product in products if not skip_reason(product)]


def select_product(products):
    candidates = []
    for product in eligible_products(products):
        images = product_images(product)
        score = 0
        if "europe" in (product.get("collections") or []):
            score += 100
        if product.get("categoryId") == "laundry":
            score += 10
        score += min(len(images), 3)
        candidates.append((score, product.get("title", ""), product))
    if not candidates:
        raise SystemExit("No active product with price and existing images found")
    return sorted(candidates, key=lambda item: (-item[0], item[1]))[0][2]


def related_products(product, products):
    related = []
    seen = {product.get("id")}
    for candidate in products:
        candidate_id = candidate.get("id")
        if candidate_id in seen:
            continue
        if candidate.get("categoryId") != product.get("categoryId"):
            continue
        if not is_in_stock(candidate):
            continue
        if not product_images(candidate):
            continue
        related.append(candidate)
        seen.add(candidate_id)
    related.sort(key=lambda item: related_rank_key(product, item))
    if len(related) < 4:
        fallback = []
        for candidate in products:
            candidate_id = candidate.get("id")
            if candidate_id in seen:
                continue
            if not is_in_stock(candidate):
                continue
            if not product_images(candidate):
                continue
            fallback.append(candidate)
            seen.add(candidate_id)
        fallback.sort(key=lambda item: (0 if item.get("categoryId") == "perfume" else 1, item.get("title", "")))
        related.extend(fallback[: 4 - len(related)])
    return related[:24]


def image_label(path, index):
    lower = path.lower()
    if "back" in lower:
        return "Обратная"
    if "alt" in lower:
        return f"Вариант {index + 1}"
    return "Лицевая"


def product_size(title):
    text = str(title or "").replace(",", ".")
    combo = re.search(
        r"(?:^|\s)(\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g)\s*\+\s*\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g))(?:\s|$)",
        text,
        re.I,
    )
    single = re.search(r"(?:^|\s)(\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g|шт))(?:\s|$)", text, re.I)
    value = (combo or single)
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


def production_country(product):
    brand = (product.get("brand") or "").lower()
    title = (product.get("title") or "").lower()
    european_german_brands = {
        "dalli",
        "dash",
        "persil",
        "kamill",
        "banduff",
    }
    if any(item in brand for item in european_german_brands) or any(item in title for item in european_german_brands):
        return "Германия"
    return ""


def brand_with_country(product):
    brand = product.get("brand") or "Global Market"
    country = production_country(product)
    return f"{brand} ({country})" if country else brand


def normalize_key(value):
    return str(value or "").strip().lower()


def load_landing_lookup():
    if not LANDING_PAGES_MANIFEST_PATH.exists():
        return {"category": {}, "brand": {}, "collection": {}}
    manifest = json.loads(LANDING_PAGES_MANIFEST_PATH.read_text(encoding="utf-8"))
    lookup = {"category": {}, "brand": {}, "collection": {}}
    for page in manifest.get("pages") or []:
        page_type = page.get("type")
        if page_type == "category":
            lookup["category"][page.get("slug")] = page
        elif page_type == "collection":
            lookup["collection"][page.get("slug")] = page
        elif page_type == "brand":
            lookup["brand"][normalize_key(page.get("title"))] = page
    return lookup


def product_landing_links(product, lookup):
    links = {}
    category_page = lookup.get("category", {}).get(product.get("categoryId"))
    if category_page:
        links["category"] = category_page
    brand_page = lookup.get("brand", {}).get(normalize_key(product.get("brand")))
    if brand_page:
        links["brand"] = brand_page
    collection_pages = []
    for collection in product.get("collections") or []:
        page = lookup.get("collection", {}).get(collection)
        if page:
            collection_pages.append(page)
    links["collections"] = collection_pages
    return links


def spec_value(label, href=""):
    label = escape(label)
    if href:
        return f'<a href="{escape(href)}">{label}</a>'
    return label


def visual_breadcrumbs(product, links):
    category = links.get("category")
    brand = links.get("brand")
    parts = ['<a href="/#top">Главная</a>']
    if category:
        parts.append(f'<a href="{escape(category["path"])}">{escape(category["title"])}</a>')
    if brand:
        parts.append(f'<a href="{escape(brand["path"])}">{escape(brand["title"])}</a>')
    parts.append(f'<span>{escape(product.get("title"))}</span>')
    return '<nav class="product-breadcrumbs" aria-label="Навигация">' + '<span class="crumb-separator">/</span>'.join(parts) + "</nav>"


def absolute_url(path):
    return f"{SITE_URL}/{path.lstrip('/')}"


def build_json_ld(product, canonical, images):
    data = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.get("title"),
        "description": product.get("description") or product.get("title"),
        "image": [absolute_url(image) for image in images],
        "sku": product.get("id"),
        "brand": {
            "@type": "Brand",
            "name": product.get("brand") or "Global Market KG",
        },
        "offers": {
            "@type": "Offer",
            "url": canonical,
            "priceCurrency": "KGS",
            "price": str(product.get("retailPriceKgs")),
            "priceValidUntil": f"{date.today().year + 1}-12-31",
            "itemCondition": "https://schema.org/NewCondition",
            "availability": "https://schema.org/InStock" if is_in_stock(product) else "https://schema.org/OutOfStock",
            "seller": {
                "@type": "Organization",
                "name": "Global Market KG",
            },
        },
    }
    return json.dumps(data, ensure_ascii=False, indent=2)


def build_breadcrumb_json_ld(product, canonical, links=None):
    links = links or {}
    category = product.get("category") or "Каталог"
    category_item = (
        f"{SITE_URL}{links['category']['path']}"
        if links.get("category")
        else f"{SITE_URL}/?category={urllib.parse.quote(category)}#catalog"
    )
    data = {
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
                "name": category,
                "item": category_item,
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": product.get("title"),
                "item": canonical,
            },
        ],
    }
    return json.dumps(data, ensure_ascii=False, indent=2)


def render_gallery(images, title):
    items = "\n".join(
        f"""
        <button class="gallery-thumb {'active' if index == 0 else ''}" type="button" data-gallery-image="/{escape(image)}" aria-label="{escape(image_label(image, index))}">
          <img src="/{escape(image)}" alt="{escape(title)} - {escape(image_label(image, index))}" loading="lazy">
          <span>{escape(image_label(image, index))}</span>
        </button>
        """
        for index, image in enumerate(images)
    )
    return f'<div class="gallery-thumbs" aria-label="Фотографии товара">{items}</div>'


def product_tile_html(product, extra_class=""):
    """One catalog-style tile: brand pill, like button, marketing + discount
    badges, image, title/type/variant, category, description, price (with
    strikethrough original when discounted), add-to-cart. Matches the home
    page .product-card markup (renderProducts() in app.js) exactly, reusing
    the same styles.css classes, so a tile looks identical wherever it
    appears — home grid, "Похожие товары", or a landing page grid. The like
    button/add-to-cart button carry the real product id in data-favorite /
    data-add so the page's embedded script can wire them up the same way the
    home page does (see wireGridCardInteractions() below)."""
    images = product_images(product)
    if not images:
        return ""
    image = images[0]
    slug = product_slug(product)
    href = f"/product/{escape(slug)}/"
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
            <article class="product-card {extra_class}">
              <div class="product-visual" style="--tone-a: {tone_a}; --tone-b: {tone_b}">
                <span class="placeholder-brand">{escape(product.get("brand") or "GM")}</span>
                <button class="favorite-button" type="button" data-favorite="{product_id}" aria-label="Добавить в избранное" aria-pressed="false">
                  <svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.6c0 5.4-8.8 10.2-8.8 10.2S3.2 14 3.2 8.6A4.8 4.8 0 0 1 12 5.9a4.8 4.8 0 0 1 8.8 2.7Z"></path></svg>
                </button>
                {badges_html}
                {discount_badge_html(product)}
                <a class="product-image-link" href="{href}" data-product-link="{product_id}" aria-label="Открыть {escape(product.get("title"))}">
                  <img class="product-image" src="/{escape(image)}" alt="{escape(product.get("title"))}" loading="lazy">
                </a>
              </div>
              <div class="product-info">
                <a class="product-title-button product-copy" href="{href}" data-product-link="{product_id}">
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


def render_related(products):
    if not products:
        return ""
    cards = "".join(product_tile_html(product) for product in products)
    if not cards:
        return ""
    return f"""
    <section class="related">
      <h2>Похожие товары</h2>
      <div class="related-grid">{cards}</div>
    </section>
    """


def render_page(product, related, slug, landing_lookup=None):
    header_partial = load_partial(HEADER_PARTIAL_PATH)
    footer_partial = load_partial(FOOTER_PARTIAL_PATH)
    links = product_landing_links(product, landing_lookup or {"category": {}, "brand": {}, "collection": {}})
    images = product_images(product)
    main_image = images[0]
    title = product.get("title", "Товар")
    description = product.get("description") or f"{title} в Global Market KG."
    meta_description = description[:155]
    canonical = f"{SITE_URL}/product/{slug}/"
    display = product_display_parts(product)
    order_text = f"Здравствуйте! Хочу заказать: {title}, цена {money(product.get('retailPriceKgs', 0))} сом."
    whatsapp = f"https://wa.me/996706771103?text={urllib.parse.quote(order_text)}"
    question_text = f"Здравствуйте! Вопрос по товару: {title}, цена {money(product.get('retailPriceKgs', 0))} сом. {canonical}"
    whatsapp_question = f"https://wa.me/996706771103?text={urllib.parse.quote(question_text)}"
    json_ld = build_json_ld(product, canonical, images)
    breadcrumb_json_ld = build_breadcrumb_json_ld(product, canonical, links)
    collection_links = links.get("collections") or []
    collection_spec = ", ".join(
        spec_value(page.get("title"), page.get("path"))
        for page in collection_links
    )
    product_json = json.dumps(
        {
            "id": product.get("id"),
            "title": title,
            "price": product.get("retailPriceKgs", 0),
            "whatsapp": whatsapp,
            "url": canonical,
        },
        ensure_ascii=False,
    )
    action = (
        f"""
        <div class="modal-actions">
          <button class="primary-action" type="button" data-add-cart>В корзину</button>
          <a class="secondary-action" href="/#checkout" data-checkout>К оформлению</a>
        </div>
        <a class="whatsapp-action" href="{escape(whatsapp)}" rel="noopener">Заказать сразу в WhatsApp</a>
        <a class="whatsapp-action" href="{escape(whatsapp_question)}" rel="noopener">Спросить в WhatsApp</a>
        """
        if is_in_stock(product)
        else (
            '<p class="stock-note">Нет в наличии. Посмотрите похожие товары ниже.</p>'
            f'<a class="whatsapp-action" href="{escape(whatsapp_question)}" rel="noopener">Спросить в WhatsApp</a>'
        )
    )
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
  <meta name="description" content="{escape(meta_description)}">
  <link rel="canonical" href="{escape(canonical)}">
  <meta property="og:site_name" content="Global Market KG">
  <meta property="og:type" content="product">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(meta_description)}">
  <meta property="og:url" content="{escape(canonical)}">
  <meta property="og:image" content="{escape(absolute_url(main_image))}">
  <meta property="og:image:alt" content="{escape(title)}">
  <meta property="og:locale" content="ru_RU">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escape(title)}">
  <meta name="twitter:description" content="{escape(meta_description)}">
  <meta name="twitter:image" content="{escape(absolute_url(main_image))}">
  <link rel="stylesheet" href="/styles.css?v=20260708-search-taxonomy">
  <script type="application/ld+json">{json_ld}</script>
  <script type="application/ld+json">{breadcrumb_json_ld}</script>
  <style>
    :root {{ color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; background: #f2f3f5; color: #202124; }}
    * {{ box-sizing: border-box; }}
    body.product-page {{ margin: 0; padding-top: var(--site-header-height, 58px); }}
    button, a {{ -webkit-tap-highlight-color: transparent; }}
    .page {{ max-width: 980px; margin: 0 auto; padding: 14px; }}
    .product-shell {{ position: relative; overflow: hidden; background: #fff; border-radius: 8px; box-shadow: 0 18px 44px rgba(0, 0, 0, 0.08); }}
    .top-actions {{ position: absolute; inset: 12px 12px auto 12px; z-index: 3; display: flex; justify-content: space-between; pointer-events: none; }}
    .top-actions > div {{ display: flex; gap: 8px; pointer-events: auto; }}
    .icon-action {{ display: grid; place-items: center; width: 46px; height: 46px; border: 1px solid rgba(214, 216, 220, 0.72); border-radius: 8px; background: rgba(255, 255, 255, 0.92); color: #1f1f1f; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.08); cursor: pointer; text-decoration: none; }}
    .icon-action svg {{ width: 21px; height: 21px; }}
    .icon-action svg circle,
    .icon-action svg path {{ fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.1; }}
    .icon-action .heart-path {{ fill: rgba(255, 255, 255, 0.08); stroke-width: 2.45; }}
    .icon-action.active {{ color: #d70015; background: rgba(255, 246, 247, 0.94); }}
    .visual-panel {{ background: #fff; }}
    .media-main {{ display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border: 0; border-radius: 0; }}
    .gallery-thumbs {{ display: flex; gap: 10px; padding: 14px 16px 18px; overflow-x: auto; background: #f7f7f8; }}
    .gallery-thumb {{ display: grid; flex: 0 0 76px; gap: 5px; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 8px; background: rgba(255, 255, 255, 0.6); color: #555; cursor: pointer; }}
    .gallery-thumb.active {{ border-color: #1f1f1f; background: #fff; }}
    .gallery-thumb img {{ width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 4px; }}
    .gallery-thumb span {{ overflow: hidden; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; text-align: center; }}
    .product-info {{ display: grid; gap: 18px; padding: 28px 26px 26px; }}
    .product-breadcrumbs {{ display: flex; gap: 8px; flex-wrap: wrap; align-items: center; color: #777; font-size: 13px; line-height: 1.35; }}
    .product-breadcrumbs a {{ color: inherit; text-decoration: none; }}
    .product-breadcrumbs a:hover {{ color: #111; }}
    .crumb-separator {{ color: #b0b0b6; }}
    .title-block {{ display: grid; gap: 8px; }}
    .brand-row {{ display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }}
    h1 {{ margin: 0; font-size: clamp(38px, 7vw, 58px); font-weight: 300; line-height: 1.05; }}
    .size-line {{ flex: 0 0 auto; color: #555; font-size: clamp(20px, 4.5vw, 30px); font-weight: 300; line-height: 1.1; white-space: nowrap; }}
    .type {{ margin: 0; font-size: clamp(24px, 5vw, 34px); font-weight: 800; line-height: 1.12; }}
    .variant {{ margin: 0; color: #777; font-size: 19px; line-height: 1.35; }}
    .description {{ margin: 0; color: #666; font-size: 18px; line-height: 1.55; }}
    .price-box {{ display: grid; gap: 4px; padding: 16px; border: 1px solid #e4e4e7; border-radius: 8px; background: #f5f5f6; }}
    .price-box span,
    .price-box small {{ color: #777; }}
    .price {{ font-size: 38px; font-weight: 850; line-height: 1; }}
    .som-sign {{ display: inline-block; padding-bottom: 0.03em; border-bottom: 0.06em solid currentColor; line-height: 0.88; }}
    .specs {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }}
    .specs div {{ padding: 12px; border: 1px solid #e4e4e7; border-radius: 8px; background: #fff; }}
    .specs dt {{ color: #777; font-size: 13px; }}
    .specs dd {{ margin: 4px 0 0; font-weight: 800; }}
    .specs dd a {{ color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }}
    .note {{ padding: 13px 14px; border-radius: 8px; color: #666; background: #f5f5f6; line-height: 1.45; }}
    .modal-actions {{ display: flex; gap: 12px; flex-wrap: wrap; }}
    .primary-action,
    .secondary-action,
    .whatsapp-action {{ min-height: 48px; border-radius: 8px; padding: 0 18px; font-weight: 800; text-decoration: none; cursor: pointer; }}
    .primary-action {{ border: 0; background: #111; color: #fff; }}
    .primary-action.added {{ background: #2eaf62; }}
    .secondary-action {{ display: inline-flex; align-items: center; justify-content: center; border: 1px solid #d7d7dc; background: #fff; color: #111; }}
    .whatsapp-action {{ display: inline-flex; align-items: center; justify-content: center; width: fit-content; min-height: 42px; color: #4f4f55; background: transparent; }}
    .stock-note {{ padding: 14px; border-radius: 12px; background: #f1f1f1; color: #555; }}
    .related {{ margin-top: 28px; }}
    .related h2 {{ font-size: 26px; }}
    /* Cards inside .related-grid reuse the shared .product-card rules from
       styles.css (loaded above) so they render identically to home-page
       catalog cards — same brand pill, like button, badges, price, add
       button. Only the grid container itself is defined here. */
    .related-grid {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }}
    body.product-page .site-header {{ z-index: 20; }}
    .site-footer {{ margin: 32px auto 0; padding: 28px 18px calc(32px + env(safe-area-inset-bottom)); color: #636366; background: #fff; border-top: 1px solid #e4e4e7; }}
    .site-footer-inner {{ display: grid; gap: 18px; max-width: 980px; margin: 0 auto; }}
    .footer-brand {{ display: inline-flex; align-items: center; width: fit-content; gap: 9px; }}
    .footer-brand-orb {{ display: block; width: 32px; height: 32px; border-radius: 50%; object-fit: cover; filter: brightness(1.16) saturate(0.94); -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 58%, rgba(0, 0, 0, 0.86) 66%, transparent 76%); mask-image: radial-gradient(circle at 50% 50%, #000 58%, rgba(0, 0, 0, 0.86) 66%, transparent 76%); }}
    .footer-brand-wordmark {{ display: block; width: min(214px, 56vw); height: auto; }}
    .footer-links {{ display: flex; gap: 14px; flex-wrap: wrap; }}
    .footer-links a {{ color: #4b5563; text-decoration: none; }}
    .bottom-page-actions {{ display: flex; align-items: center; gap: 10px; max-width: 980px; margin: 18px auto 0; padding: 0 14px; }}
    .bottom-page-action {{ display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 13px; border: 1px solid #d2d2d7; border-radius: 8px; color: #1d1d1f; background: rgba(255, 255, 255, 0.92); font-weight: 750; text-decoration: none; cursor: pointer; }}
    .bottom-page-action svg {{ width: 18px; height: 18px; }}
    .bottom-page-action svg path {{ fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }}
    .bottom-page-action.top {{ margin-left: auto; }}
    @media (max-width: 720px) {{
      body.product-page {{ padding-top: 45px; }}
      body.product-page .header-search {{ display: none; }}
      body.product-page .search-toggle {{ display: inline-flex; }}
      .page {{ max-width: none; padding: 0; }}
      .product-shell {{ border-radius: 0; box-shadow: none; }}
      .related {{ padding: 0 8px; }}
      .product-info {{ padding: 26px 18px 20px; }}
      .icon-action {{ width: 44px; height: 44px; }}
      .specs {{ grid-template-columns: 1fr; }}
      .related-grid {{ grid-template-columns: repeat(2, 1fr); }}
      .bottom-page-actions {{ padding: 0 18px; }}
    }}
    @media (min-width: 860px) {{
      .product-shell {{ display: grid; grid-template-columns: minmax(0, 52%) minmax(320px, 48%); }}
      .product-info {{ padding-top: 58px; }}
      .gallery-thumbs {{ background: #fff; }}
      .top-actions {{ left: 16px; right: 16px; }}
    }}
  </style>
</head>
<body class="product-page">
  {header_partial}
  <main class="page">
    <article class="product-shell">
      <div class="top-actions" aria-label="Действия с товаром">
        <div>
          <button class="icon-action" type="button" data-back aria-label="Назад">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"></path></svg>
          </button>
        </div>
        <div>
          <button class="icon-action" type="button" data-favorite aria-label="Добавить в избранное" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path class="heart-path" d="M20.8 8.6c0 5.4-8.8 10.2-8.8 10.2S3.2 14 3.2 8.6A4.8 4.8 0 0 1 12 5.9a4.8 4.8 0 0 1 8.8 2.7Z"></path></svg>
          </button>
          <button class="icon-action" type="button" data-share aria-label="Поделиться товаром">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"></path>
            </svg>
          </button>
        </div>
      </div>
      <section class="visual-panel">
        <img class="media-main" src="/{escape(main_image)}" alt="{escape(title)}" data-main-image>
        {render_gallery(images, title)}
      </section>
      <section class="product-info">
        {visual_breadcrumbs(product, links)}
        <div class="title-block">
          <div class="brand-row">
            <h1>{escape(display["brand"])}</h1>
            {f'<span class="size-line">{escape(display["size"])}</span>' if display["size"] else ''}
          </div>
          <p class="type">{escape(display["type"])}</p>
          <p class="variant">{escape(display["variant"])}</p>
        </div>
        <p class="description">{escape(description)}</p>
        <div class="price-box">
          <span>Ваша цена{f" · скидка {int(product['discountPercent'])}%" if has_discount(product) else ""}</span>
          <strong>{price_with_discount_html(product)}</strong>
          <small>Клиентская цена: скидка 3% при входе</small>
        </div>
        <dl class="specs">
          <div><dt>Бренд</dt><dd>{spec_value(brand_with_country(product), (links.get("brand") or {}).get("path", ""))}</dd></div>
          <div><dt>Категория</dt><dd>{spec_value(product.get("category") or "Товар", (links.get("category") or {}).get("path", ""))}</dd></div>
          <div><dt>Тип товара</dt><dd>{escape(product.get("productType") or display["type"])}</dd></div>
          <div><dt>Единица</dt><dd>{escape(product.get("unit") or "шт")}</dd></div>
          {f'<div><dt>Подборка</dt><dd>{collection_spec}</dd></div>' if collection_spec else ''}
        </dl>
        <div class="note">Наличие, оплату и доставку подтверждает менеджер. Бесплатная доставка от 10 000 <span class="som-sign">с</span>.</div>
        {action}
      </section>
    </article>
    {render_related(related)}
    <nav class="bottom-page-actions" aria-label="Навигация по странице">
      <button class="bottom-page-action" type="button" data-back>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"></path></svg>
        <span>Назад</span>
      </button>
      <a class="bottom-page-action" href="/#top">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5"></path><path d="M6.5 10.5V20h11v-9.5"></path></svg>
        <span>Главная</span>
      </a>
      <button class="bottom-page-action top" type="button" data-scroll-top aria-label="Наверх">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"></path><path d="m6 11 6-6 6 6"></path></svg>
        <span>Наверх</span>
      </button>
    </nav>
  </main>
  {footer_partial}
  <script>
    const product = {product_json};
    const cartKey = "globalMarketCartDraft";
    const favoritesKey = "globalMarketFavorites";
    const recentlyViewedKey = "globalMarketRecentlyViewed";
    const smartHeader = document.querySelector("[data-smart-header]");
    const categoryMenu = document.querySelector("#categoryMenu");
    const toggleMenuButton = document.querySelector("#toggleMenu");
    let lastScrollY = window.scrollY;
    let ticking = false;

    function readJson(key, fallback) {{
      try {{
        return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
      }} catch (_) {{
        return fallback;
      }}
    }}

    function addToCart(options = {{ increment: true }}) {{
      const rows = readJson(cartKey, []);
      const index = rows.findIndex((row) => row[0] === product.id);
      if (index >= 0) {{
        rows[index][1] = options.increment ? Number(rows[index][1] || 0) + 1 : Number(rows[index][1] || 1);
      }}
      else rows.push([product.id, 1]);
      localStorage.setItem(cartKey, JSON.stringify(rows));
      updateCartCount();
      const button = document.querySelector("[data-add-cart]");
      if (!button) return;
      button.classList.add("added");
      button.textContent = "Добавлено";
      window.setTimeout(() => {{
        button.classList.remove("added");
        button.textContent = "В корзину";
      }}, 900);
    }}

    function updateCartCount() {{
      const rows = readJson(cartKey, []);
      const count = rows.reduce((sum, row) => sum + Number(row[1] || 0), 0);
      document.querySelectorAll("[data-cart-count]").forEach((item) => {{
        item.textContent = String(count);
      }});
    }}

    function recordRecentlyViewed() {{
      const ids = readJson(recentlyViewedKey, []);
      const next = [product.id, ...ids.filter((id) => id !== product.id)].slice(0, 20);
      localStorage.setItem(recentlyViewedKey, JSON.stringify(next));
    }}

    function updateFavoriteButton() {{
      const ids = new Set(readJson(favoritesKey, []));
      const button = document.querySelector("[data-favorite]");
      if (!button) return;
      const active = ids.has(product.id);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "Убрать из избранного" : "Добавить в избранное");
    }}

    // "Похожие товары" cards are full catalog tiles (same markup as the home
    // page) with a real product id in data-favorite/data-add, unlike this
    // page's own singular data-favorite/data-add-cart buttons (which always
    // refer to `product`). Handled separately via delegation on .related-grid
    // so the two mechanisms never collide.
    function syncGridFavoriteButtons() {{
      const ids = new Set(readJson(favoritesKey, []));
      document.querySelectorAll(".related-grid [data-favorite]").forEach((button) => {{
        const active = ids.has(button.dataset.favorite);
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-label", active ? "Убрать из избранного" : "Добавить в избранное");
      }});
    }}

    document.querySelector(".related-grid")?.addEventListener("click", (event) => {{
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

    document.querySelectorAll("[data-back]").forEach((button) => {{
      button.addEventListener("click", () => {{
        if (history.length > 1) history.back();
        else window.location.href = "/#catalog";
      }});
    }});

    document.querySelector("#toggleSearch")?.addEventListener("click", () => {{
      window.location.href = "/#catalog";
    }});

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

    document.querySelector("[data-scroll-top]")?.addEventListener("click", () => {{
      window.scrollTo({{ top: 0, behavior: "smooth" }});
    }});

    document.querySelector("[data-share]")?.addEventListener("click", async () => {{
      const shareData = {{ title: product.title, text: product.title, url: product.url }};
      try {{
        if (navigator.share) await navigator.share(shareData);
        else {{
          await navigator.clipboard.writeText(`${{shareData.text}}\\n${{shareData.url}}`);
          const button = document.querySelector("[data-share]");
          button?.classList.add("active");
          window.setTimeout(() => button?.classList.remove("active"), 900);
        }}
      }} catch (_) {{}}
    }});

    document.querySelector("[data-favorite]")?.addEventListener("click", () => {{
      const ids = new Set(readJson(favoritesKey, []));
      if (ids.has(product.id)) ids.delete(product.id);
      else ids.add(product.id);
      localStorage.setItem(favoritesKey, JSON.stringify([...ids]));
      updateFavoriteButton();
    }});

    document.querySelector("[data-add-cart]")?.addEventListener("click", addToCart);
    document.querySelector("[data-checkout]")?.addEventListener("click", () => addToCart({{ increment: false }}));

    document.querySelectorAll("[data-gallery-image]").forEach((button) => {{
      button.addEventListener("click", () => {{
        const image = button.dataset.galleryImage;
        const mainImage = document.querySelector("[data-main-image]");
        if (mainImage && image) mainImage.src = image;
        document.querySelectorAll("[data-gallery-image]").forEach((item) => item.classList.toggle("active", item === button));
      }});
    }});

    updateFavoriteButton();
    syncGridFavoriteButtons();
    updateCartCount();
    recordRecentlyViewed();
    renderMenu();

    function updateSmartHeader() {{
      if (!smartHeader) return;
      const current = window.scrollY;
      const delta = current - lastScrollY;
      smartHeader.classList.toggle("header-floating", current > 12);
      if (current < 24 || delta < -6) {{
        smartHeader.classList.remove("header-hidden");
      }} else if (delta > 8 && current > 90) {{
        smartHeader.classList.add("header-hidden");
      }}
      lastScrollY = current;
      ticking = false;
    }}

    window.addEventListener("scroll", () => {{
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateSmartHeader);
    }}, {{ passive: true }});
  </script>
</body>
</html>
"""


def load_products():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return catalog.get("products", [])


def validate_page(page, product):
    marker_start = page.index('<script type="application/ld+json">') + len('<script type="application/ld+json">')
    marker_end = page.index("</script>", marker_start)
    json.loads(page[marker_start:marker_end])
    missing_images = missing_product_images(product)
    if missing_images:
        raise ValueError(f"missing product images: {missing_images}")


def write_product_page(product, products, landing_lookup=None):
    slug = product_slug(product)
    related = related_products(product, products)
    page = render_page(product, related, slug, landing_lookup)
    target = OUTPUT_ROOT / slug / "index.html"
    validate_page(page, product)
    previous = target.read_text(encoding="utf-8") if target.exists() else None
    target.parent.mkdir(parents=True, exist_ok=True)
    if previous != page:
        target.write_text(page, encoding="utf-8")
    status = "created" if previous is None else ("unchanged" if previous == page else "updated")
    if not related:
        raise ValueError("no related products rendered")
    return {
        "status": status,
        "product": product,
        "slug": slug,
        "path": target.relative_to(ROOT),
        "related_count": len(related),
        "image_count": len(product_images(product)),
    }


def write_report(results, skipped, mode):
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    counts = {
        "created": sum(1 for item in results if item["status"] == "created"),
        "updated": sum(1 for item in results if item["status"] == "updated"),
        "unchanged": sum(1 for item in results if item["status"] == "unchanged"),
        "failed": sum(1 for item in results if item["status"] == "failed"),
    }
    lines = [
        "# Product Pages Report",
        "",
        f"- Mode: `{mode}`",
        f"- Generated candidates: {len(results)}",
        f"- Created: {counts['created']}",
        f"- Updated: {counts['updated']}",
        f"- Unchanged: {counts['unchanged']}",
        f"- Failed: {counts['failed']}",
        f"- Skipped products: {len(skipped)}",
        "",
        "## Generated",
        "",
    ]
    if results:
        lines.append("| Status | Product | Page | Images | Related |")
        lines.append("|---|---|---|---:|---:|")
        for item in results:
            product = item["product"]
            page = item.get("path") or ""
            lines.append(
                f"| {item['status']} | {product.get('id')} / {product.get('title')} | `{page}` | {item.get('image_count', 0)} | {item.get('related_count', 0)} |"
            )
    else:
        lines.append("No pages generated.")

    lines.extend(["", "## Skipped", ""])
    if skipped:
        lines.append("| Product | Reason |")
        lines.append("|---|---|")
        for product, reason in skipped:
            lines.append(f"| {product.get('id')} / {product.get('title')} | {reason} |")
    else:
        lines.append("No skipped products.")

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_manifest(results):
    pages = []
    for item in results:
        if item.get("status") == "failed":
            continue
        product = item["product"]
        slug = item["slug"]
        pages.append(
            {
                "id": product.get("id"),
                "slug": slug,
                "path": f"/product/{slug}/",
                "url": f"{SITE_URL}/product/{slug}/",
                "title": product.get("title"),
                "brand": product.get("brand"),
                "category": product.get("category"),
                "categoryId": product.get("categoryId"),
                "collections": product.get("collections") or [],
                "retailPriceKgs": product.get("retailPriceKgs"),
                "image": f"/{product_images(product)[0]}" if product_images(product) else "",
                "imageCount": item.get("image_count", 0),
                "relatedCount": item.get("related_count", 0),
            }
        )

    manifest = {
        "generatedBy": "scripts/generate_product_pages.py",
        "siteUrl": SITE_URL,
        "count": len(pages),
        "pages": pages,
    }
    PRODUCT_PAGES_MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args():
    parser = argparse.ArgumentParser(description="Generate static product pages for Global Market KG.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--all", action="store_true", help="Generate pages for all active priced products with existing photos.")
    group.add_argument("--product-id", help="Generate one page by product id.")
    parser.add_argument("--report", action="store_true", help="Write outputs/product-pages-report.md.")
    return parser.parse_args()


def main():
    args = parse_args()
    products = load_products()
    landing_lookup = load_landing_lookup()
    skipped = [(product, skip_reason(product)) for product in products if skip_reason(product)]
    if args.all:
        targets = eligible_products(products)
        mode = "all"
    elif args.product_id:
        product = next((item for item in products if item.get("id") == args.product_id), None)
        if not product:
            raise SystemExit(f"Product not found: {args.product_id}")
        reason = skip_reason(product)
        if reason:
            raise SystemExit(f"Product is not eligible: {reason}")
        targets = [product]
        mode = f"product-id:{args.product_id}"
    else:
        targets = [select_product(products)]
        mode = "single-best"

    results = []
    for product in targets:
        try:
            results.append(write_product_page(product, products, landing_lookup))
        except Exception as error:
            results.append(
                {
                    "status": "failed",
                    "product": product,
                    "slug": product_slug(product),
                    "path": "",
                    "related_count": 0,
                    "image_count": len(product_images(product)),
                    "error": str(error),
                }
            )

    if args.report or args.all:
        write_report(results, skipped, mode)
    if args.all:
        write_manifest(results)

    failed = [item for item in results if item["status"] == "failed"]
    for item in results[:10]:
        print(f"{item['status']}: {item['product'].get('id')} / {item['product'].get('title')} -> {item.get('path')}")
    if len(results) > 10:
        print(f"... {len(results) - 10} more pages")
    if args.report or args.all:
        print(f"Report: {REPORT_PATH.relative_to(ROOT)}")
    if args.all:
        print(f"Manifest: {PRODUCT_PAGES_MANIFEST_PATH.relative_to(ROOT)}")
    if failed:
        for item in failed[:10]:
            print(f"FAILED: {item['product'].get('id')} / {item['product'].get('title')}: {item.get('error')}")
        raise SystemExit(f"{len(failed)} product pages failed")


if __name__ == "__main__":
    main()
