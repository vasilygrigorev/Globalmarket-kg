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

## Wiring status

1. **Done** — `scripts/import_stock.py`: on every import, reads the previous
   `stock_quantity`/`restocked_at` for each `source_id` from `data/store.db`
   *before* overwriting it, computes
   `restocked_at = freshness.restock_date(prev_qty, new_qty, prev_date, stock_date)`,
   and persists it on the same `source_products` upsert (schema-migrated with
   an `alter table ... add column`, same pattern as the existing `source_code`
   migration, so it's safe against older DB files). Carried into
   `generate_outputs()` → both `data/catalog.json` (`"restockedAt"` on every
   product, including manual/perfume products via `manual.get("restockedAt")`)
   and the review CSV. Tested end-to-end against a real temp sqlite DB in
   `tests/import-stock-freshness.test.mjs` (new product, no-change re-import,
   restock, and the "dropped to 0 then back" case — 6 tests, wired into
   `scripts/verify_backend_mvp.py`).

   Note: this only takes effect on the *next real* `scripts/import_stock.py`
   run against an actual 1C export. The currently-committed `data/catalog.json`
   predates the field, so every product's `restockedAt` is absent until then
   — by design ("when unknown it is simply absent").

2. **Done** — `scripts/build_public_catalog.py`: `"restockedAt"` added to
   `PUBLIC_PRODUCT_FIELDS`, carried into `data/public-catalog.json`.

3. **Not done — needs a decision before touching it.** A "Свежие поступления"
   section already exists on the storefront (`app.js` `freshProducts()` /
   `renderFreshProducts()`, mount points `#freshProducts`/`#freshProductsRow`),
   currently ranked by a heuristic (real photo → "Новинка" badge → rating →
   diversity caps), not by real dates. The "Новинка" badge itself
   (`productBadges()` in `app.js`) is a placeholder rule
   (`categoryId === "perfume" || brand === "Concord"`) duplicated **identically**
   in `scripts/generate_product_pages.py` and `scripts/generate_landing_pages.py`,
   locked together by `tests/catalog-badges-parity.test.mjs` (asserts the three
   copies are byte-identical and match specific literal conditions incl.
   `perfume`, `Concord`, `4.8`, `500`). Switching "Новинка" to `is_new()` means
   editing all three files plus that guard test in lockstep — and would
   visibly blank the badge sitewide until the next real 1C import populates
   `restockedAt`. Do this as its own reviewed change, not silently.
4. Guardrails (once live data exists): `restockedAt` values are valid ISO
   dates and never in the future; the fresh feed is ordered newest-first; a
   product whose quantity rose in the latest import has today's
   `restockedAt`.
