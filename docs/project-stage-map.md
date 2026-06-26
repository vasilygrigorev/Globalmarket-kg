# Project Stage Map

Generated: 2026-06-26T05:38:38.772984+00:00

Approximate progress map for Global Market KG. Percentages are working estimates, not contractual milestones.

| Stage | Progress | Status | Current meaning |
|---|---:|---|---|
| Витрина | ████████░░ 76% | usable-preview | Главная, каталог, карточки, корзина, WhatsApp-заказ. |
| Фото и товары | ██████░░░░ 55% | ongoing | Фото через Петю, 1C-остатки, сопоставление товаров. |
| SEO/product pages | ███████░░░ 66% | preview-mvp | Отдельные страницы товаров, landing pages, sitemap, JSON-LD, перелинковка. |
| Общие блоки | ███████░░░ 68% | preview | Единый header/footer/menu/banner config. |
| Безопасная сборка | ████████░░ 83% | strong-preview | Build, package, manifest, preview checks, browser smoke. |
| Дизайн polish | ██████░░░░ 55% | ongoing | Мобильный/desktop вид, баннеры, карточки, UX. |
| Backend/Supabase | ░░░░░░░░░░ 5% | planned | База, заказы, админка, клиенты, роли, отзывы. |
| Production-релиз текущей ветки | ░░░░░░░░░░ 0% | not-started | Commit, push, production deploy текущей shared-layout/product-pages ветки. |

## Details

### Витрина - 76%

- Status: `usable-preview`
- Done: Каталог, карточки, корзина, checkout, WhatsApp-сообщение, базовый UX.
- Next: Довести мелкие UX-детали, проверить production-готовность текущей ветки.

### Фото и товары - 55%

- Status: `ongoing`
- Done: Петя сохраняет оригиналы; 1C MXL импорт работает; gallery contract проверяется.
- Next: Увеличивать покрытие товаров фото и снижать ручную работу при сопоставлении.

### SEO/product pages - 66%

- Status: `preview-mvp`
- Done: 86 product pages, 25 category/collection/brand landing pages, /catalog map page, sitemap, robots.txt, manifest, Product JSON-LD, BreadcrumbList, ItemList, homepage Organization/WebSite, product-to-brand/category/collection links, landing-to-brand/category/collection contextual links.
- Next: Расширять SEO-тексты, синонимы и затем подготовить массовую production-публикацию.

### Общие блоки - 68%

- Status: `preview`
- Done: site-config, partials, единый header/footer для главной/product/landing/catalog pages.
- Next: Стабилизировать структуру меню/баннеров перед production.

### Безопасная сборка - 83%

- Status: `strong-preview`
- Done: Build pipeline, clean package, sitemap/package validation, internal links, structured data validation, build manifest, browser smoke.
- Next: Перед production добавить финальную release-проверку и осознанный commit scope.

### Дизайн polish - 55%

- Status: `ongoing`
- Done: Текущий мобильный и desktop preview удовлетворительный, основные блоки работают.
- Next: Полировать точечно после просмотра на телефоне и desktop.

### Backend/Supabase - 5%

- Status: `planned`
- Done: Обсуждена Supabase-направленность и будущая SQL-схема.
- Next: Проектировать MVP backend: товары, заказы, клиенты, история заказов, админка.

### Production-релиз текущей ветки - 0%

- Status: `not-started`
- Done: Только preview deploy; production не трогали.
- Next: После явной команды: scoped staging, commit, push, production deploy, live verification.
