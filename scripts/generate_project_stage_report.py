#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "outputs" / "project-stage-report.md"
DEFAULT_DOC = ROOT / "docs" / "project-stage-map.md"

STAGES = [
    {
        "name": "Витрина",
        "percent": 76,
        "status": "usable-preview",
        "description": "Главная, каталог, карточки, корзина, WhatsApp-заказ.",
        "done": "Каталог, карточки, корзина, checkout, WhatsApp-сообщение, базовый UX.",
        "next": "Довести мелкие UX-детали, проверить production-готовность текущей ветки.",
    },
    {
        "name": "Фото и товары",
        "percent": 55,
        "status": "ongoing",
        "description": "Фото через Петю, 1C-остатки, сопоставление товаров.",
        "done": "Петя сохраняет оригиналы; 1C MXL импорт работает; gallery contract проверяется.",
        "next": "Увеличивать покрытие товаров фото и снижать ручную работу при сопоставлении.",
    },
    {
        "name": "SEO/product pages",
        "percent": 66,
        "status": "preview-mvp",
        "description": "Отдельные страницы товаров, landing pages, sitemap, JSON-LD, перелинковка.",
        "done": "86 product pages, 25 category/collection/brand landing pages, /catalog map page, sitemap, robots.txt, manifest, Product JSON-LD, BreadcrumbList, ItemList, homepage Organization/WebSite, product-to-brand/category/collection links, landing-to-brand/category/collection contextual links.",
        "next": "Расширять SEO-тексты, синонимы и затем подготовить массовую production-публикацию.",
    },
    {
        "name": "Общие блоки",
        "percent": 68,
        "status": "preview",
        "description": "Единый header/footer/menu/banner config.",
        "done": "site-config, partials, единый header/footer для главной/product/landing/catalog pages.",
        "next": "Стабилизировать структуру меню/баннеров перед production.",
    },
    {
        "name": "Безопасная сборка",
        "percent": 83,
        "status": "strong-preview",
        "description": "Build, package, manifest, preview checks, browser smoke.",
        "done": "Build pipeline, clean package, sitemap/package validation, internal links, structured data validation, build manifest, browser smoke.",
        "next": "Перед production добавить финальную release-проверку и осознанный commit scope.",
    },
    {
        "name": "Дизайн polish",
        "percent": 55,
        "status": "ongoing",
        "description": "Мобильный/desktop вид, баннеры, карточки, UX.",
        "done": "Текущий мобильный и desktop preview удовлетворительный, основные блоки работают.",
        "next": "Полировать точечно после просмотра на телефоне и desktop.",
    },
    {
        "name": "Backend/Supabase",
        "percent": 5,
        "status": "planned",
        "description": "База, заказы, админка, клиенты, роли, отзывы.",
        "done": "Обсуждена Supabase-направленность и будущая SQL-схема.",
        "next": "Проектировать MVP backend: товары, заказы, клиенты, история заказов, админка.",
    },
    {
        "name": "Production-релиз текущей ветки",
        "percent": 0,
        "status": "not-started",
        "description": "Commit, push, production deploy текущей shared-layout/product-pages ветки.",
        "done": "Только preview deploy; production не трогали.",
        "next": "После явной команды: scoped staging, commit, push, production deploy, live verification.",
    },
]


def bar(percent):
    filled = round(percent / 10)
    return "█" * filled + "░" * (10 - filled)


def render():
    now = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Project Stage Map",
        "",
        f"Generated: {now}",
        "",
        "Approximate progress map for Global Market KG. Percentages are working estimates, not contractual milestones.",
        "",
        "| Stage | Progress | Status | Current meaning |",
        "|---|---:|---|---|",
    ]
    for item in STAGES:
        lines.append(
            f"| {item['name']} | {bar(item['percent'])} {item['percent']}% | {item['status']} | {item['description']} |"
        )
    lines.extend(["", "## Details", ""])
    for item in STAGES:
        lines.extend(
            [
                f"### {item['name']} - {item['percent']}%",
                "",
                f"- Status: `{item['status']}`",
                f"- Done: {item['done']}",
                f"- Next: {item['next']}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser(description="Generate the Global Market KG project stage report.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output markdown report path.")
    parser.add_argument("--doc", default=str(DEFAULT_DOC), help="Also write/update this docs markdown path.")
    args = parser.parse_args()

    output = Path(args.output).expanduser()
    if not output.is_absolute():
        output = (ROOT / output).resolve()
    doc = Path(args.doc).expanduser()
    if not doc.is_absolute():
        doc = (ROOT / doc).resolve()

    text = render()
    for path in (output, doc):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    print(f"Project stage report: {output}")
    print(f"Project stage doc: {doc}")
    for item in STAGES:
        print(f"{item['name']}: {item['percent']}%")


if __name__ == "__main__":
    raise SystemExit(main())
