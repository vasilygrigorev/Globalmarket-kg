# Photo priority list

Snapshot after commit `b26262c` (legacy override schema normalization). Run
`python3 scripts/report_photo_coverage.py` (or
`python3 scripts/report_photo_priority.py`) for a fresh number any time —
this file is a snapshot, not a live report.

Current coverage: **167/529 = 31.6%** (was 150/529 — 17 new products from a
second live 2026-07-06 Petya batch found in `assets/telegram_inbox/`: 5
Rexona sticks, 1 Dove Men stick, 6 BIC disposable razors, 5 Gillette/Venus
razors and cartridges, see `docs/pending-photo-review.md` for the full
identification trail). From here on, closing the remaining gap needs real
new photos.

## Priority 0 — fix these first, they're almost done

Six groups from the 2026-07-06 afternoon batch are blocked on a **specific
missing or wrong photo**, not full reshoots:

- **Rexona Men Ice Cool стик 40 г** — has card-front + back, missing the
  plain "front" photo.
- **Rexona "invisible on black+white clothes"** — has a full triple, but its
  back photo is byte/barcode-identical to a different product's (Rexona
  Antibacterial + Invisible) already-published back — needs its own back
  photo.
- **BIC Miss Soleil Colour Collection 4T** — has card-front + back, missing
  the plain "front" photo.
- **BIC Soleil Bella** — full triple, but package says 3 razors while the
  only 1C candidate is a 4-pack — needs count/code confirmation.
- **Venus Comfortglide Breeze, 4-pack** and **Venus Deluxe Smooth Swirl,
  XL 6-pack** — both are missing a *reliable* back photo: the two back
  photos sent for them are byte/barcode-identical to each other, so at
  least one is misattributed. Needs a fresh back photo for each pack size.

From the earlier 2026-07-06 morning batch: two products have a **confident
1C match and a good front/card-front, but a wrong back photo** — not missing, wrong
(one is a different product's back entirely, one is byte-identical to
another product's back). A single correct back photo each would finish
them:

- **Colgate 360 Optic White, Medium** — needs its own real back photo.
- **Colgate Max Fresh** (1C code 1075) — needs its own real back photo (not
  MaxWhite's, which is what got attached by mistake).

Three more from the same batch are internally consistent (Colgate 360
Charcoal Medium, 360 Charcoal Gold Soft, 360 Whole Mouth Clean Medium) but
**match no line in the current 1C stock export at all** — need Petya/owner
to confirm whether these are in current inventory and under which 1C code
before anyone can publish them.

## Priority 1 — category gaps (0% or near-0% coverage)

| Category | Total | With photos | Coverage |
|---|---|---|---|
| Продукты (food) | 6 | 0 | 0% |
| Уход за телом (body) | 81 | 8 | 10% |
| Разное (misc) | 75 | 8 | 11% |
| Зубная гигиена (oral care) | 26 | 4 | 15% |
| Уборка и чистота (cleaning) | 9 | 2 | 22% |

Food is still fully unphotographed. Oral care went from 0% to 15% this
pass (4 Colgate toothbrushes) — the other 22 products in that category are
still unphotographed, worth finishing in the same session as whichever
toothbrush/toothpaste restock happens next.

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

0. **Из партии 2026-07-06 (день)**: обычное фото "front" для Rexona Ice Cool
   и для BIC Miss Soleil Colour Collection; новое фото "back" для Rexona
   "invisible on black+white clothes", для Venus Comfortglide Breeze
   (пачка 4 шт) и для Venus Deluxe Smooth Swirl (пачка XL 6 шт) — присланные
   back-фото для этих двух пачек Venus совпадают друг с другом, значит
   одно из них перепутано; и подтверждение — Soleil Bella в пачке правда
   3 станка или 4 (в остатках только позиция на 4 шт)?
1. **Обратная сторона (back) для Colgate 360 Optic White и Colgate Max
   Fresh** — фото перепутались с другими щётками при съёмке 2026-07-06,
   нужно всего по одному новому фото на каждый товар, всё остальное уже
   готово.
2. **Подтвердить код 1С для трёх Colgate 360** (Charcoal, Charcoal Gold,
   Whole Mouth Clean) — фото хорошие, но в остатках такой позиции не
   нашлось; нужно сказать, это новый товар или как он называется в 1С.
3. **Продукты питания** — сейчас 0% фото (6 товаров). Один сеанс съёмки
   закроет всю категорию.
4. **Топ-20 товаров выше по таблице** — самые "дорогие" (по остатку в
   долларах) товары без фото: Persil Light Foam 3л+1л, Ariel 6кг
   Color/Universal, Mach 3/Fusion запаски, Gillette Blue II Pivot, H&S
   Smooth Silky, Dove Moisture/Oil Therapy и другие.
5. **Обратная сторона (back) для 3 уже опубликованных товаров**: TRESemmé
   Clean & Replenish 828 мл, Pantene Damage Repair 600 мл, Pantene Sheer
   Volume 600 мл — сейчас на сайте только карточка + перёд.
6. **Третье фото (card-front) для 2 товаров Dove**: Apple & White Tea и
   Advanced Care Original, 250 мл — см. `docs/pending-photo-review.md`.

Готовый текст для пересылки Пете/менеджеру теперь есть отдельно в
`docs/petya-shooting-request.md`.
