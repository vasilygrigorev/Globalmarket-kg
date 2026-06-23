#!/usr/bin/env python3
import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "index.html"
HEADER_PATH = ROOT / "partials" / "header.html"
FOOTER_PATH = ROOT / "partials" / "footer.html"
CONFIG_PATH = ROOT / "data" / "site-config.json"


def read(path):
    return path.read_text(encoding="utf-8").strip()


def escape(value):
    return html.escape(str(value or ""), quote=True)


def load_config():
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def render_header(config):
    nav_links = "\n".join(
        f'    <a href="{escape(item.get("href"))}">{escape(item.get("label"))}</a>'
        for item in config.get("nav", [])
        if item.get("href") and item.get("label")
    )
    return f"""<header class="site-header" data-smart-header>
  <button class="menu-toggle" id="toggleMenu" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="categoryMenu">
    <span class="menu-icon" aria-hidden="true"></span>
  </button>
  <a class="brand" href="/#top" aria-label="Global Market">
    <img class="brand-orb" src="/assets/brand/globalmarket-tech-orb-tight.jpg" alt="" aria-hidden="true" />
    <img class="brand-wordmark" src="/assets/brand/globalmarket-wordmark.svg" alt="GlobalMarket" />
  </a>
  <nav class="main-nav" aria-label="Основная навигация">
{nav_links}
  </nav>
  <label class="header-search" aria-label="Поиск по товарам">
    <span aria-hidden="true">⌕</span>
    <input id="headerSearchInput" type="search" placeholder="Найти товар" />
  </label>
  <button class="search-toggle" id="toggleSearch" type="button" aria-label="Открыть поиск" aria-expanded="false">
    <span class="search-icon" aria-hidden="true"></span>
  </button>
  <button class="cart-button" id="openCart" type="button" aria-label="Открыть корзину">
    <span class="cart-bag-icon" aria-hidden="true"></span>
    <span class="cart-separator" aria-hidden="true">:</span>
    <span id="cartCount" data-cart-count>0</span>
  </button>
  <nav class="category-menu" id="categoryMenu" aria-label="Меню" hidden></nav>
</header>"""


def render_footer(config):
    footer_links = "\n".join(
        f'      <a href="{escape(item.get("href"))}">{escape(item.get("label"))}</a>'
        for item in config.get("footerLinks", [])
        if item.get("href") and item.get("label")
    )
    footer_text = escape(config.get("footerText", ""))
    return f"""<footer class="site-footer" aria-label="Информация о магазине">
  <div class="site-footer-inner">
    <a class="footer-brand" href="/#top" aria-label="Global Market KG">
      <img class="footer-brand-orb" src="/assets/brand/globalmarket-tech-orb-tight.jpg" alt="" aria-hidden="true" />
      <img class="footer-brand-wordmark" src="/assets/brand/globalmarket-wordmark.svg" alt="GlobalMarket" />
    </a>
    <nav class="footer-links" aria-label="Ссылки внизу страницы">
{footer_links}
    </nav>
    <p>{footer_text}</p>
  </div>
</footer>"""


def write_partials_from_config():
    config = load_config()
    HEADER_PATH.write_text(render_header(config) + "\n", encoding="utf-8")
    FOOTER_PATH.write_text(render_footer(config) + "\n", encoding="utf-8")


def replace_block(html, name, tag, replacement):
    start = f"<!-- BEGIN shared-{name} -->"
    end = f"<!-- END shared-{name} -->"
    wrapped = f"{start}\n    {replacement.replace(chr(10), chr(10) + '    ')}\n    {end}"
    marker_pattern = re.compile(rf"{re.escape(start)}.*?{re.escape(end)}", re.S)
    if marker_pattern.search(html):
        return marker_pattern.sub(wrapped, html, count=1)
    tag_pattern = re.compile(rf"<{tag}\b.*?</{tag}>", re.S)
    return tag_pattern.sub(wrapped, html, count=1)


def main():
    write_partials_from_config()
    html = INDEX_PATH.read_text(encoding="utf-8")
    html = replace_block(html, "header", "header", read(HEADER_PATH))
    html = replace_block(html, "footer", "footer", read(FOOTER_PATH))
    INDEX_PATH.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
