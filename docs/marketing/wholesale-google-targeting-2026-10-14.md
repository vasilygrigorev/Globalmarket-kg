# Google targeting: wholesale landing

Date: 2026-10-14
Landing page: `https://globalmarket.kg/opt/`

## Goal

- Audience: owners and purchasing managers of retail stores and small chains.
- Geography: Bishkek, presence only; exclude people merely interested in Bishkek.
- Primary action: successfully submitted wholesale application.
- Diagnostic actions: wholesale page visit, application start, WhatsApp click, wholesale-catalog login click.
- Google never receives phone, name, shop name, address, or comment text.

## Measurement

- `select_content`: click from the retail homepage to `/opt/` and clicks to the closed wholesale catalog.
- `wholesale_application_started`: first interaction with the application form.
- `contact`: WhatsApp click with `method=wholesale_whatsapp`.
- `generate_lead`: API-confirmed successful wholesale application with `lead_type=wholesale_application`.
- `wholesale_application_failed`: application API failure.

Keep `generate_lead` secondary until one controlled consented form test is visible in GA4 and imported into Google Ads. Do not reuse the retail `order_submitted` goal for wholesale bidding.

## Exact-match search groups

### General wholesale

- `[бытовая химия оптом бишкек]`
- `[бытовая химия оптом кыргызстан]`
- `[поставщик бытовой химии бишкек]`
- `[оптовая база бытовой химии бишкек]`
- `[товары для дома оптом бишкек]`
- `[моющие средства оптом бишкек]`
- `[чистящие средства оптом бишкек]`
- `[стиральный порошок оптом бишкек]`

### Brand wholesale

- `[dalli оптом бишкек]`
- `[dash оптом бишкек]`
- `[pink stuff оптом бишкек]`
- `[felce azzurra оптом бишкек]`
- `[dr beckmann оптом бишкек]`
- `[kamill оптом бишкек]`

Start with exact match only. Add phrase match only after reviewing real search terms and conversion quality.

## Initial negative keywords

- работа
- вакансии
- резюме
- производство
- завод
- своими руками
- рецепт
- бесплатно
- скачать
- фото
- отзывы сотрудников
- обучение
- курсы
- реферат
- оптом россия
- оптом казахстан

Do not add `цена`, `купить`, `магазин`, `поставщик`, or brand names as negatives.

## URL parameters

Final URL:

`https://globalmarket.kg/opt/`

Final URL suffix:

`utm_source=google&utm_medium=cpc&utm_campaign=wholesale_bishkek_search&utm_content={adgroupid}-{creative}&utm_term={keyword}&device={device}&matchtype={matchtype}`

## Responsive search ad

Use one responsive search ad in each initial ad group. Pin nothing until real search-term data is available.

Headlines (30 characters or fewer):

- `Бытовая химия оптом`
- `Опт для магазинов Бишкек`
- `Поставщик бытовой химии`
- `Товары для дома оптом`
- `Оптовые цены для бизнеса`
- `Dalli и Dash оптом`
- `Pink Stuff оптом Бишкек`
- `Felce Azzurra оптом`
- `Персональный оптовый доступ`
- `Заказ через личный кабинет`
- `Поставки по Кыргызстану`
- `Актуальный ассортимент`
- `Связь с менеджером`
- `Для магазинов Бишкека`
- `Global Market KG оптом`

Descriptions (90 characters or fewer):

- `Бытовая химия и товары для дома оптом для магазинов Бишкека и Кыргызстана.`
- `Получите персональный доступ к оптовому каталогу и оформляйте заказы онлайн.`
- `Актуальный складской ассортимент, связь с менеджером и согласование доставки.`
- `Dalli, Dash, Pink Stuff, Felce Azzurra, Dr. Beckmann, Kamill и другие бренды.`

Display paths:

- Path 1: `opt`
- Path 2: `bishkek`

## Assets

Callouts:

- `Оптовые цены`
- `Актуальный ассортимент`
- `Персональный доступ`
- `Связь с менеджером`
- `Для магазинов`
- `Заказы онлайн`

Sitelinks:

- `Оставить заявку` -> `https://globalmarket.kg/opt/#application`
- `Оптовый каталог` -> `https://opt.globalmarket.kg/`
- `The Pink Stuff оптом` -> `https://globalmarket.kg/brand/the-pink-stuff/`
- `Dalli оптом` -> `https://globalmarket.kg/brand/dalli/`

Structured snippet, header `Бренды`:

- Dalli
- Dash
- The Pink Stuff
- Felce Azzurra
- Dr. Beckmann
- Kamill
- Glysolid

## Controlled test settings

- Campaign name: `Global Market KG | Опт | Поиск | Бишкек`.
- Daily budget: `USD 3` for the first controlled test; no automatic budget increases.
- Bidding: maximize clicks with a `USD 0.50` maximum CPC until a verified lead exists.
- Networks: Google Search only. Disable Display Network and search partners for the first test.
- Location option: people in or regularly in Bishkek; exclude interest-only traffic.
- Languages: Russian and English. Keywords and ads remain primarily Russian.
- Ad schedule: 08:00-21:00 Bishkek time while a manager can respond.
- Do not enable automatically created assets, broad match, AI Max, or automatic keyword expansion.
- Do not make `contact`, page views, or form starts primary bidding conversions.

## Launch guardrails

- Separate wholesale campaign from the paused retail campaign.
- Search Network only; no Display expansion, AI Max, broad match, or automatically added keywords.
- Verify identity/account eligibility before launch.
- Run one controlled consented lead test before making `generate_lead` primary.
- Review search terms and lead quality before increasing budget.
