#!/usr/bin/env python3
import html
import json
import re
import urllib.parse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "public-catalog.json"
OUTPUT_ROOT = ROOT / "product"
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


def escape(value):
    return html.escape(str(value or ""), quote=True)


def money(value):
    return f"{int(value):,}".replace(",", " ")


def image_exists(path):
    return bool(path) and (ROOT / path.lstrip("/")).exists()


def product_images(product):
    gallery = product.get("galleryImages") or []
    if gallery:
        return [image for image in gallery if image_exists(image)]
    image = product.get("image")
    return [image] if image_exists(image) else []


def is_in_stock(product):
    return product.get("status") == "active"


def select_product(products):
    candidates = []
    for product in products:
        images = product_images(product)
        if not images or not is_in_stock(product) or not product.get("retailPriceKgs"):
            continue
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
    for candidate in products:
        if candidate.get("id") == product.get("id"):
            continue
        if candidate.get("categoryId") != product.get("categoryId"):
            continue
        if not is_in_stock(candidate):
            continue
        if not product_images(candidate):
            continue
        related.append(candidate)
    related.sort(key=lambda item: (0 if "europe" in (item.get("collections") or []) else 1, item.get("title", "")))
    return related[:4]


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
            "availability": "https://schema.org/InStock" if is_in_stock(product) else "https://schema.org/OutOfStock",
            "seller": {
                "@type": "Organization",
                "name": "Global Market KG",
            },
        },
    }
    return json.dumps(data, ensure_ascii=False, indent=2)


def render_gallery(images, title):
    if len(images) <= 1:
        return ""
    items = "\n".join(
        f'<img src="/{escape(image)}" alt="{escape(title)} фото {index}" loading="lazy">'
        for index, image in enumerate(images[1:], start=2)
    )
    return f'<section class="gallery" aria-label="Галерея товара">{items}</section>'


def render_related(products):
    if not products:
        return ""
    cards = []
    for product in products:
        image = product_images(product)[0]
        cards.append(
            f"""
            <article class="related-card">
              <img src="/{escape(image)}" alt="{escape(product.get('title'))}" loading="lazy">
              <strong>{escape(product.get('title'))}</strong>
              <span>{money(product.get('retailPriceKgs', 0))} с</span>
            </article>
            """
        )
    return f"""
    <section class="related">
      <h2>Похожие товары</h2>
      <div class="related-grid">{''.join(cards)}</div>
    </section>
    """


def render_page(product, related, slug):
    images = product_images(product)
    main_image = images[0]
    title = product.get("title", "Товар")
    description = product.get("description") or f"{title} в Global Market KG."
    meta_description = description[:155]
    canonical = f"{SITE_URL}/product/{slug}/"
    order_text = f"Здравствуйте! Хочу заказать: {title}, цена {money(product.get('retailPriceKgs', 0))} сом."
    whatsapp = f"https://wa.me/996706771103?text={urllib.parse.quote(order_text)}"
    json_ld = build_json_ld(product, canonical, images)
    action = (
        f'<a class="primary-action" href="{escape(whatsapp)}" rel="noopener">Заказать в WhatsApp</a>'
        if is_in_stock(product)
        else '<p class="stock-note">Нет в наличии. Посмотрите похожие товары ниже.</p>'
    )
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} | Global Market KG</title>
  <meta name="description" content="{escape(meta_description)}">
  <link rel="canonical" href="{escape(canonical)}">
  <meta property="og:type" content="product">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(meta_description)}">
  <meta property="og:url" content="{escape(canonical)}">
  <meta property="og:image" content="{escape(absolute_url(main_image))}">
  <script type="application/ld+json">{json_ld}</script>
  <style>
    :root {{ color-scheme: light; font-family: Arial, Helvetica, sans-serif; background: #f5f5f5; color: #1f1f1f; }}
    body {{ margin: 0; }}
    .page {{ max-width: 980px; margin: 0 auto; padding: 18px; }}
    .back {{ display: inline-block; margin-bottom: 18px; color: #2563eb; text-decoration: none; }}
    .product {{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .9fr); gap: 28px; background: #fff; border-radius: 18px; padding: 24px; }}
    .media-main {{ width: 100%; border-radius: 14px; display: block; }}
    .gallery {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }}
    .gallery img {{ width: 100%; border-radius: 10px; background: #fff; }}
    h1 {{ margin: 0 0 12px; font-size: clamp(32px, 5vw, 56px); font-weight: 300; line-height: 1.05; }}
    .type {{ font-size: 22px; font-weight: 700; margin: 0 0 12px; }}
    .description {{ color: #666; font-size: 18px; line-height: 1.55; }}
    .price {{ font-size: 34px; font-weight: 800; margin: 24px 0 6px; }}
    .stock {{ color: #267a3f; margin-bottom: 20px; }}
    .primary-action {{ display: inline-flex; justify-content: center; border-radius: 12px; padding: 14px 18px; background: #1478d4; color: #fff; font-weight: 700; text-decoration: none; }}
    .stock-note {{ padding: 14px; border-radius: 12px; background: #f1f1f1; color: #555; }}
    .related {{ margin-top: 28px; }}
    .related h2 {{ font-size: 26px; }}
    .related-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }}
    .related-card {{ background: #fff; border-radius: 14px; padding: 10px; display: grid; gap: 8px; }}
    .related-card img {{ width: 100%; border-radius: 10px; aspect-ratio: 1 / 1; object-fit: cover; }}
    .related-card strong {{ font-size: 14px; }}
    .related-card span {{ font-weight: 800; }}
    @media (max-width: 720px) {{
      .page {{ padding: 12px; }}
      .product {{ grid-template-columns: 1fr; padding: 14px; border-radius: 14px; }}
      .related-grid {{ grid-template-columns: repeat(2, 1fr); }}
    }}
  </style>
</head>
<body>
  <main class="page">
    <a class="back" href="/#catalog">Вернуться в каталог</a>
    <article class="product">
      <section>
        <img class="media-main" src="/{escape(main_image)}" alt="{escape(title)}">
        {render_gallery(images, title)}
      </section>
      <section>
        <h1>{escape(title)}</h1>
        <p class="type">{escape(product.get("productType"))}{' · ' + escape(product.get("unit")) if product.get("unit") else ''}</p>
        <p class="description">{escape(description)}</p>
        <div class="price">{money(product.get("retailPriceKgs", 0))} с</div>
        <div class="stock">{'В наличии' if is_in_stock(product) else 'Нет в наличии'}</div>
        {action}
      </section>
    </article>
    {render_related(related)}
  </main>
</body>
</html>
"""


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    products = catalog.get("products", [])
    product = select_product(products)
    slug = f"{slugify(product.get('title', 'product'))}-{product.get('id', '')[-6:]}"
    related = related_products(product, products)
    page = render_page(product, related, slug)
    target = OUTPUT_ROOT / slug / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(page, encoding="utf-8")

    marker_start = page.index('<script type="application/ld+json">') + len('<script type="application/ld+json">')
    marker_end = page.index("</script>", marker_start)
    json.loads(page[marker_start:marker_end])
    missing_images = [image for image in product_images(product) if not image_exists(image)]
    if missing_images:
        raise SystemExit(f"Missing product images: {missing_images}")
    if not related:
        raise SystemExit("No related products rendered")

    print(f"Selected: {product.get('id')} / {product.get('title')}")
    print(f"Created: {target.relative_to(ROOT)}")
    print(f"Related products: {len(related)}")


if __name__ == "__main__":
    main()
