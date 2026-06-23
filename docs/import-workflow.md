# 1C Stock Import Workflow

This document describes the intended local import process for stock reports from 1C 7.7.

## Goal

Convert `Остатки2.xls` into a clean, reviewable store catalog without losing manual storefront improvements.

## Input

Expected file type:

- Legacy Excel `.xls`
- 1C `.mxl`
- Report name: `Остатки ТМЦ на складах`

Current known structure:

- Row with title: `Остатки ТМЦ на складах`
- Row with date: `На дату: 21.05.26`
- Warehouse filter contains: `Основной Склад`
- Header row:
  - `ТМЦ`
  - `Ед.`
  - `Усред. себест-ть с НДС (USD)`
  - `Основной Склад / Кол - во`
  - `Основной Склад / Сумма`

## Import Rules

1. Read the spreadsheet locally.
2. Detect report title, date, warehouse, and columns.
3. Read product groups and product rows.
4. Exclude group `18 x Germ 2`.
5. Exclude rows with stock quantity less than or equal to zero.
6. Exclude rows without usable base USD price unless explicitly allowed later.
7. Preserve raw 1C name and raw 1C group.
8. Update source accounting fields only.
9. Never overwrite manual storefront fields.

## Raw Name Spec Hints

The old 1C 7.7 product names often include useful specification hints in parentheses. During recognition and product-description cleanup, treat parenthesized values as possible:

- volume, for example `(1л)`;
- weight, for example `(500)` near a known gram/ml product family;
- wash count, especially for laundry products.

Important Dalli rule:

```text
Dalli (100) = about 100 washes, not 100 pieces.
For Dalli 100-wash powder, use 6 kg in the storefront title/description.
```

Do not blindly publish the parenthesized number as a quantity. Use it as a hint together with brand, product type, package photo, OCR, and known pack sizes.

## Shaving Product Recognition

1C shaving names need customer-facing cleanup:

- `Foam` / `пена` -> `пена для бритья`;
- `Gel` / `гель` -> `гель для бритья`;
- `запаски`, `кассеты`, `лезвия` -> `сменные кассеты/лезвия для бритья`;
- `станок`, `razor`, `Blue3`, `Pivot`, `Simply` -> `бритвенные станки`.

Leading numbers in raw names such as `6 VENUS`, `5 PROGLIDE`, `1 Mach 3`, `4 FUSION` are internal accounting/supplier hints. Do not show them as the customer-facing brand. Use clean brands such as `Gillette`, `Gillette Venus`, `Concord`, `Queen`, `Lazer`.

Price sanity rule:

```text
If one shaving item has a base USD price wildly outside its product family,
hide it until the 1C source is confirmed.
```

Known case:

```text
6 VENUS запаски (4) Breeze had base_price_usd=561.8.
Comparable Venus cartridges are around 5-14 USD.
Do not show this product at 64 990 som; hide it until corrected in 1C.
```

## Category Override By Explicit Product Name

The raw 1C group can be misleading. If the product name itself clearly identifies the product type, trust the name over the group.

Known case:

```text
Cussons пена для ванны = Уход за телом / пена для ванны.
Do not place it in Уход за волосами even if 1C group is "Шампуни Бальзамы".
```

## Identity Rule

The daily `.mxl` report contains a numeric 1C item code. The existing store was first created from raw names, so the current import still preserves identity by normalized raw name and stores the 1C code as metadata.

Current identity:

```text
source_key = normalized_raw_name
```

Additional metadata:

```text
source_code = numeric_1c_item_code
```

Future improvement:

- Reconcile existing products to `source_code`
- Add barcode
- Add external GUID
- Add manual matching screen for renamed products

## Fields Updated By Import

The import can update:

- `raw_name`
- `raw_group`
- `unit`
- `base_price_usd`
- `stock_quantity`
- `stock_amount_usd`
- `warehouse`
- `stock_date`
- `last_imported_at`
- `source_file`
- `source_hash`
- `source_code`

## Fields Not Updated By Import

The import must not overwrite:

- `clean_title`
- `short_title`
- `description`
- `brand`
- `product_type`
- `categories`
- `tags`
- `image`
- `placeholder`
- `visibility`
- `manual notes`
- `promotions`
- `manual product settings`

## Price Calculation During Import

Use current settings:

```text
wholesale_kgs = base_price_usd * usd_rate
retail_raw_kgs = wholesale_kgs * (1 + retail_markup_percent)
retail_price_kgs = beautiful_round(retail_raw_kgs)
registered_price_kgs = floor(retail_price_kgs * (1 - default_registered_discount_percent))
```

Wholesale prices keep two decimals.

Retail and registered prices are whole KGS.

## Review Artifact

After import, generate a review table.

Suggested file:

```text
outputs/catalog_review.xlsx
```

Suggested columns:

- `review_status`
- `source_group`
- `raw_name`
- `clean_title`
- `brand`
- `primary_category`
- `extra_categories`
- `tags`
- `unit`
- `stock_quantity`
- `base_price_usd`
- `wholesale_kgs`
- `retail_kgs`
- `registered_kgs`
- `description`
- `specs`
- `visibility`
- `comment`

Review statuses:

- `ok`
- `needs_review`
- `hidden`
- `new`

## First Catalog Quality Strategy

Do not manually polish all 513 products at once.

Initial suggested scope:

- Keep a complete primitive database for all valid products.
- Deeply improve about 20 products first.
- Pick roughly two products from each customer-facing category.
- Use category placeholders for products without real images.

## Output For Storefront

The storefront should consume a clean catalog layer, not raw Excel.

Possible first-version output:

```text
data/catalog.json
```

or local SQLite tables.

## Daily Update

Managers can upload daily stock reports through Telegram or place new files in `Documents` for scanning.

Product photos can be placed in:

```text
/Users/macmini/shopfoto2
```

This folder is the dedicated incoming folder for internet-store product photos. It should be treated as a staging area: analyze and prepare matches first, then ask before changing product cards.

The Telegram path:

1. Receive the file.
2. Validate it is the expected stock report.
3. Run import.
4. Produce a short summary.
5. Report warnings.
6. Keep manual catalog improvements.

The Documents-folder path:

1. Run `python3 scripts/scan_document_inbox.py --root /Users/macmini/Documents --max-depth 2`.
2. Review `outputs/document_inbox_report.md`.
3. Ask the user before running any import or changing store data.

The scanner can inspect `.zip/.mxl/.xls/.xlsx/.csv` files. It may extract supported files from ZIP archives into `assets/document_inbox/extracted`, but it must not update the store by itself.

Important rule:

```text
No store changes from Documents-folder scans without explicit user confirmation.
```

## Import Summary

Every import should produce a compact summary:

- source file
- report date
- warehouse
- rows read
- products updated
- new products
- hidden products
- excluded rows
- total stock amount
- warnings

Avoid dumping full catalog data into chat.
