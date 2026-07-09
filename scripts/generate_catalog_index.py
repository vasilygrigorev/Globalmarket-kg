#!/usr/bin/env python3
import argparse
import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LANDING_PAGES_PATH = ROOT / "data" / "landing-pages.json"
HEADER_PARTIAL_PATH = ROOT / "partials" / "header.html"
FOOTER_PARTIAL_PATH = ROOT / "partials" / "footer.html"
OUTPUT_PATH = ROOT / "catalog" / "index.html"
REPORT_PATH = ROOT / "outputs" / "catalog-index-report.md"
SITE_URL = "https://globalmarket.kg"


SECTION_LABELS = {
    "category": "Категории",
    "collection": "Подборки",
    "brand": "Бренды",
}


def escape(value):
    return html.escape(str(value or ""), quote=True)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_partial(path):
    return path.read_text(encoding="utf-8").strip()


def grouped_pages(pages):
    groups = {key: [] for key in SECTION_LABELS}
    for page in pages:
        page_type = page.get("type")
        if page_type in groups:
            groups[page_type].append(page)
    for items in groups.values():
        items.sort(key=lambda item: (-int(item.get("count") or 0), item.get("title", "").lower()))
    return groups


def render_items(items):
    if not items:
        return '<p class="catalog-index-empty">Пока нет страниц.</p>'
    return "\n".join(
        f"""
        <a class="catalog-index-card" href="{escape(item.get('path'))}">
          <strong>{escape(item.get('title'))}</strong>
          <span>{int(item.get('count') or 0)} товаров</span>
        </a>
        """.rstrip("\n ") + "\n"
        for item in items
    )


def render_page(pages):
    header = load_partial(HEADER_PARTIAL_PATH)
    footer = load_partial(FOOTER_PARTIAL_PATH)
    groups = grouped_pages(pages)
    section_html = "\n".join(
        f"""
        <section class="catalog-index-section" aria-labelledby="catalog-index-{escape(section_type)}">
          <h2 id="catalog-index-{escape(section_type)}">{escape(label)}</h2>
          <div class="catalog-index-grid">
            {render_items(groups[section_type])}
          </div>
        </section>
        """
        for section_type, label in SECTION_LABELS.items()
    )
    item_list = [
        {
            "@type": "ListItem",
            "position": index,
            "name": page.get("title"),
            "url": f"{SITE_URL}{page.get('path')}",
        }
        for index, page in enumerate(pages, start=1)
    ]
    json_ld = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Разделы Global Market KG",
            "itemListElement": item_list,
        },
        ensure_ascii=False,
        indent=2,
    )
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Разделы магазина | Global Market KG</title>
  <link rel="icon" type="image/jpeg" href="/assets/brand/globalmarket-tech-orb-tight.jpg">
  <link rel="apple-touch-icon" href="/assets/brand/globalmarket-tech-orb.jpg">
  <meta name="theme-color" content="#ffffff">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="description" content="Категории, подборки и бренды Global Market KG: стирка, чистка, уход, бритье, парфюм, Европа, Dalli, Persil, Gillette, Downy и другие разделы.">
  <link rel="canonical" href="{SITE_URL}/catalog/">
  <meta property="og:site_name" content="Global Market KG">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Разделы магазина Global Market KG">
  <meta property="og:description" content="Категории, подборки и бренды Global Market KG.">
  <meta property="og:url" content="{SITE_URL}/catalog/">
  <meta property="og:image" content="{SITE_URL}/assets/hero-green-wide-v1.png">
  <meta property="og:locale" content="ru_RU">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Разделы магазина Global Market KG">
  <meta name="twitter:description" content="Категории, подборки и бренды Global Market KG.">
  <meta name="twitter:image" content="{SITE_URL}/assets/hero-green-wide-v1.png">
  <link rel="stylesheet" href="/styles.css?v=20260709-marketplace-nav">
  <script type="application/ld+json">{json_ld}</script>
  <style>
    body.catalog-index-page {{ margin: 0; padding-top: var(--site-header-height, 58px); background: #f2f3f5; color: #202124; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; }}
    .catalog-index-main {{ max-width: 1120px; margin: 0 auto; padding: 30px 18px 42px; }}
    .catalog-index-hero {{ display: grid; gap: 12px; padding: 22px 0 24px; }}
    .catalog-index-hero h1 {{ margin: 0; font-size: clamp(38px, 7vw, 68px); font-weight: 300; line-height: 1.02; }}
    .catalog-index-hero p {{ max-width: 760px; margin: 0; color: #636366; font-size: clamp(17px, 2vw, 22px); line-height: 1.45; }}
    .catalog-index-section {{ margin-top: 28px; }}
    .catalog-index-section h2 {{ margin: 0 0 12px; font-size: clamp(24px, 3vw, 34px); font-weight: 650; }}
    .catalog-index-grid {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }}
    .catalog-index-card {{ display: grid; gap: 8px; min-height: 92px; align-content: center; padding: 16px; border: 1px solid #e2e2e7; border-radius: 14px; color: inherit; background: #fff; text-decoration: none; }}
    .catalog-index-card strong {{ font-size: 18px; line-height: 1.15; }}
    .catalog-index-card span {{ color: #6e6e73; font-size: 14px; }}
    .catalog-index-empty {{ margin: 0; color: #6e6e73; }}
    @media (max-width: 720px) {{
      body.catalog-index-page {{ padding-top: 45px; }}
      body.catalog-index-page .header-search {{ display: none; }}
      body.catalog-index-page .search-toggle {{ display: inline-flex; }}
      .catalog-index-main {{ padding: 20px 12px 32px; }}
      .catalog-index-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }}
      .catalog-index-card {{ min-height: 82px; padding: 13px; border-radius: 12px; }}
      .catalog-index-card strong {{ font-size: 16px; }}
    }}
  </style>
</head>
<body class="catalog-index-page">
  {header}
  <main class="catalog-index-main">
    <section class="catalog-index-hero">
      <p class="eyebrow">Global Market KG</p>
      <h1>Разделы магазина</h1>
      <p>Быстрый переход к категориям, подборкам и брендам. Эта страница помогает не теряться в каталоге и даёт поисковикам понятную структуру магазина.</p>
    </section>
    {section_html}
  </main>
  {footer}
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="Generate a static catalog index page for categories, collections, and brands.")
    parser.add_argument("--report", action="store_true", help="Write outputs/catalog-index-report.md.")
    args = parser.parse_args()

    manifest = load_json(LANDING_PAGES_PATH)
    pages = manifest.get("pages") or []
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_page(pages), encoding="utf-8")
    print(f"Catalog index: {OUTPUT_PATH.relative_to(ROOT)}")
    print(f"Landing links: {len(pages)}")

    if args.report:
        groups = grouped_pages(pages)
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "# Catalog Index Report",
            "",
            f"Landing links: `{len(pages)}`",
            "",
            "| Section | Links |",
            "|---|---:|",
        ]
        for section_type, label in SECTION_LABELS.items():
            lines.append(f"| {label} | {len(groups[section_type])} |")
        REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"Report: {REPORT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    raise SystemExit(main())
