# Photo priority list

Snapshot after the 2026-07-05 exception audit. Run
`python3 scripts/report_photo_coverage.py` for a fresh number any time —
this file is a snapshot, not a live report.

Current coverage: **125/529 = 23.6%** (up from 122/529 before this pass —
see "Priority 0" below, no new photography involved).

## Priority 0 — fix before shooting anything new (no camera needed)

Found while auditing the 3 documented card+front-only exceptions: **23
more products** have a `data/product_overrides.json` entry that
`scripts/apply_product_overrides.py` silently skips, because the entry
uses a legacy camelCase schema (`productType`/`categoryId`/`title`)
instead of the snake_case keys the apply script actually requires
(`clean_title`/`product_type`/`category_id`/`description`/`brand`). These
products show **no photo at all** on the site even though several of them
already have real photos sitting on disk (confirmed for the TRESemmé
lines — card-front/front/back files exist under `assets/products/tresemme/`
dated 2026-06-09).

Affected brands: TRESemmé (2 more, plus 1 already allowlisted-hidden),
Pantene (5), Lenor (8 perfume-for-laundry variants), Sunsilk (4, already
allowlisted-hidden). Full id list is reproducible with:

```bash
python3 - <<'EOF'
import json
d = json.loads(open("data/product_overrides.json", encoding="utf-8").read())
required = ("clean_title", "description", "brand", "product_type")
for pid, v in d.items():
    if any(k not in v for k in required) and not pid.startswith("prd_perfume_"):
        print(pid, v.get("brand"), v.get("title"))
EOF
```

**This is higher-value than any new shooting**: fixing the schema for
these ~23 entries (converting the same way the 3 exceptions in this
commit were fixed — see `data/product_overrides.json` notes on
`prd_432b62d4b317` for the exact pattern) could restore photos for
products that already have them, before spending any new photography time.
Left out of this pass on purpose — it touches ~20+ live products in one
sweep and deserves its own reviewed commit rather than being bundled into
a "known 3 exceptions" audit.

## Priority 1 — category gaps (0% or near-0% coverage)

| Category | Total | With photos | Coverage |
|---|---|---|---|
| Зубная гигиена (oral care) | 26 | 0 | 0% |
| Продукты (food) | 6 | 0 | 0% |
| Уборка и чистота (cleaning) | 9 | 2 | 22% |
| Разное (misc) | 69 | 2 | 3% |
| Уход за телом (body) | 85 | 8 | 9% |

Oral care and food are fully unphotographed categories — worth a
dedicated Petya shooting session rather than one-off requests.

## Priority 2 — top 20 in-stock products with no photo, by stock value (USD)

Ranked by `stock_amount_usd` (quantity × cost) — these are the products
where a missing photo most likely costs real sales.

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
the storefront right now with a placeholder icon instead of a real photo
(not blocked by the Priority 0 bug; nobody has photographed them yet).

## Priority 3 — products waiting on exactly one missing photo

These already have 2 of the required 3 photos and are documented,
published exceptions (not blocked, but a reshoot would complete them):

- `prd_432b62d4b317` — TRESemmé Clean & Replenish шампунь 828 мл — missing **back**.
- `prd_1f1557a2acbb` — Pantene Damage Repair шампунь 600 мл — missing **back**.
- `prd_296bd01a7c1f` — Pantene Sheer Volume шампунь 600 мл — missing **back**.

Not yet published, need one more `card-front` photo each (see
`docs/pending-photo-review.md` for full detail):

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
