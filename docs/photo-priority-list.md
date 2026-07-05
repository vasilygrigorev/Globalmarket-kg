# Photo priority list

Snapshot after commit `b26262c` (legacy override schema normalization). Run
`python3 scripts/report_photo_coverage.py` (or
`python3 scripts/report_photo_priority.py`) for a fresh number any time —
this file is a snapshot, not a live report.

Current coverage: **142/529 = 26.8%** (up from 125/529 — that jump was the
23-entry schema fix in `b26262c`, not new photography; see
`docs/claude-next-task.md` history for that story). From here on, closing
the gap needs real new photos.

## Priority 1 — category gaps (0% or near-0% coverage)

| Category | Total | With photos | Coverage |
|---|---|---|---|
| Зубная гигиена (oral care) | 26 | 0 | 0% |
| Продукты (food) | 6 | 0 | 0% |
| Уход за телом (body) | 85 | 8 | 9% |
| Разное (misc) | 75 | 8 | 11% |
| Уборка и чистота (cleaning) | 9 | 2 | 22% |

Oral care and food are still fully unphotographed categories — worth a
dedicated Petya shooting session rather than one-off requests.

## Priority 2 — top 20 in-stock products with no photo, by stock value (USD)

Ranked by `stock_amount_usd` (quantity × cost) — these are the products
where a missing photo most likely costs real sales. Unchanged from the
previous snapshot (none of these were touched by the schema fix).

| Value (USD) | Category | Raw 1C name |
|---|---|---|
| 5175.00 | Стирка и уход за бельем | Persil GEL (3L+1L) Light Foam |
| 4347.30 | Бритье | 1 Mach 3 запаски (8) |
| 2328.00 | Стирка и уход за бельем | Ariel (6kg) Color |
| 2280.00 | Стирка и уход за бельем | Ariel (6kg) Universal |
| 1988.80 | Бритье | GILLETTE Blue II - Pivot (5) Blue |
| 1900.70 | Европа | G.Dalli CAPS (24шт) 3in1 Sport & Outdoor |
| 1757.80 | Бритье | 4 FUSION запаски (8) |
| 1734.70 | Европа | G.Dalli CAPS (24шт) 3in1 Vollwaschmittel |
| 1732.50 | Европа | G.Dalli (6kg)(100стир) Universal |
| 1682.10 | Дезодоранты | Rexona B.S (200) (M) V8 |
| 1585.30 | Европа | G.Dalli CAPS (24шт) 3in1 Colorwaschmittel |
| 1485.00 | Стирка и уход за бельем | Ariel (4) White |
| 1395.00 | Уход за волосами | H&S Шампунь .(400) Smooth Silky |
| 1331.00 | Стирка и уход за бельем | GILLETTE Blue-3 comfort (8pcs) (6+2) |
| 1261.70 | Уход за волосами | Clear Шампунь (M) (400) Legend CR7 |
| 1248.00 | Уход за волосами | Dove Шамп.(600)Moinsture *(status=active already, no photo)* |
| 1107.00 | Стирка и уход за бельем | Persil (4) Automatic New |
| 921.60 | Уход за телом | С/З DS (SD-299)SPF80(200ml) Summer |
| 918.00 | Уход за волосами | Dove Шамп.(600) Oil Therapy *(status=active already, no photo)* |
| 912.60 | Бритье | Shaving GEL Fusion (200) Moinsture |

Note: two rows are marked `status=active already` — these are visible on
the storefront right now with a placeholder icon instead of a real photo;
nobody has photographed them yet (unrelated to any schema bug).

## Priority 3 — products waiting on exactly one missing photo

These already have 2 of the required 3 photos and are documented,
published exceptions (not blocked, but a reshoot would complete them):

- `prd_432b62d4b317` — TRESemmé Clean & Replenish шампунь 828 мл — missing **back**.
- `prd_1f1557a2acbb` — Pantene Damage Repair шампунь 600 мл — missing **back**.
- `prd_296bd01a7c1f` — Pantene Sheer Volume шампунь 600 мл — missing **back**.

Not yet published, need one more `card-front` photo each (see
`docs/pending-photo-review.md` for full detail — these are the 6 raw
`assets/products/telegram-989425384-20260703-160531-*` leftovers,
untouched):

- Dove go fresh Apple & White Tea, 250 мл (`prd_f23090eb2627`).
- Dove Advanced Care Original, 250 мл (`prd_b8b5bfec07e5`).

## Запрос для Пети (по-русски)

Что снять в первую очередь, по убыванию пользы:

1. **Зубная гигиена и продукты питания** — сейчас 0% фото в этих двух
   категориях (26 и 6 товаров соответственно). Один сеанс съёмки закроет
   сразу много позиций.
2. **Топ-20 товаров выше по таблице** — самые "дорогие" (по остатку в
   долларах) товары без фото: Persil Light Foam 3л+1л, Ariel 6кг
   Color/Universal, Mach 3/Fusion запаски, Gillette Blue II Pivot, H&S
   Smooth Silky, Dove Moisture/Oil Therapy и другие.
3. **Обратная сторона (back) для 3 уже опубликованных товаров**: TRESemmé
   Clean & Replenish 828 мл, Pantene Damage Repair 600 мл, Pantene Sheer
   Volume 600 мл — сейчас на сайте только карточка + перёд.
4. **Третье фото (card-front) для 2 товаров Dove**: Apple & White Tea и
   Advanced Care Original, 250 мл — см. `docs/pending-photo-review.md`.

Готовый текст для пересылки Пете/менеджеру теперь есть отдельно в
`docs/petya-shooting-request.md`.
