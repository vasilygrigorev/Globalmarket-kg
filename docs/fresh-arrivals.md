# Fresh arrivals (`restockedAt`) — design

Goal: show a "Свежие поступления" section and let the catalog sort new vs old
products, driven by the 1C stock export instead of manual tagging.

## The field

Each product gains an optional `restockedAt` date (ISO `YYYY-MM-DD`). It is the
date the product was last **replenished**, not the report date and not a
create date. When unknown it is simply absent — such products sort last and
never appear in the fresh feed until a real restock is observed.

## How it is derived (import side)

The 1C export already carries a report date ("На дату…", parsed by
`scripts/import_stock.py` → `parse_stock_date`) and every product a
`stock_quantity`. A product is *restocked* on an import when its quantity rises
versus the previous import:

- brand-new product (no previous record) → `restockedAt = import_date`;
- `new_qty > prev_qty`, including 0 → positive ("back in stock") → `restockedAt = import_date`;
- otherwise → keep the previous `restockedAt` (a slow seller keeps its original arrival date).

This rule is implemented, pure and unit-tested, in `scripts/freshness.py`
(`restock_date(prev_qty, new_qty, prev_date, import_date)`;
tests in `scripts/freshness_test.py`). The import needs the *previous* per-product
quantity and `restockedAt`, which already live in `data/store.db` (sqlite) — the
import compares the new export against them and writes the updated `restockedAt`.

## How the storefront uses it

`scripts/freshness.py` also provides the pure ordering:

- `fresh_arrivals(products)` — all products newest-restock-first, undated last;
- `fresh_arrivals(products, now, window_days=30)` — just the recent feed for the
  "Свежие поступления" block;
- `is_new(product, now, window_days=30)` — whether to badge a card as new.

Default freshness window: **30 days** (tunable). "Свежие поступления" shows the
products restocked within the window, newest first; the main grid can offer a
"Сначала новые поступления" sort using the same key.

## Wiring (apply when the working tree is clean — do not regenerate mid-batch)

1. `scripts/import_stock.py`: load previous quantities + `restockedAt` (from
   `data/store.db`), and for each product set
   `restockedAt = freshness.restock_date(prev_qty, new_qty, prev_date, stock_date)`.
   Persist the updated value back to `store.db` and `data/catalog.json`.
2. `scripts/build_public_catalog.py`: add `"restockedAt"` to
   `PUBLIC_PRODUCT_FIELDS` so it is carried into `data/public-catalog.json`.
3. Storefront: add a "Свежие поступления" section (and/or a "Сначала новые
   поступления" sort) ordered by `restockedAt` desc; optionally a "Новинка"
   badge via `is_new`. Keep the existing WhatsApp/checkout behaviour unchanged.
4. Guardrails (once the field exists): `restockedAt` values are valid ISO dates
   and never in the future; the fresh feed is ordered newest-first; a product
   whose quantity rose in the latest import has today's `restockedAt`.

`scripts/freshness_test.py` is already wired into `scripts/verify_backend_mvp.py`
so the core rules stay correct before the pipeline wiring lands.
