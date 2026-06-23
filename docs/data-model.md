# Data Model Draft

This is a local-first model. It should work with JSON or SQLite in the first version and remain easy to migrate to a VPS database later.

## Design Principles

- Keep imported accounting data separate from manually improved storefront data.
- Preserve manual edits across stock imports.
- Support retail and wholesale pricing.
- Support future admin UI, CRM, and two-way accounting sync.
- Allow products to belong to multiple categories and tags.

## Settings

Stores global configurable values.

Fields:

- `usd_rate`
- `retail_markup_percent`
- `default_registered_discount_percent`
- `free_delivery_threshold_kgs`
- `manager_whatsapp`
- `manager_email`
- `beautiful_rounding_enabled`
- `beautiful_rounding_max_deviation_percent`
- `default_language`
- `supported_languages`

Default values:

```json
{
  "usd_rate": 89.0,
  "retail_markup_percent": 30,
  "default_registered_discount_percent": 3,
  "free_delivery_threshold_kgs": 10000,
  "manager_whatsapp": "+996706771103",
  "manager_email": "globaldistkg@gmail.com",
  "beautiful_rounding_enabled": true,
  "beautiful_rounding_max_deviation_percent": 5,
  "default_language": "ru",
  "supported_languages": ["ru"]
}
```

## Source Products

Imported facts from 1C. These values can be refreshed on every import.

Suggested table/file: `source_products`

Fields:

- `source_id`
- `source_system`
- `source_file`
- `raw_name`
- `raw_group`
- `unit`
- `base_price_usd`
- `stock_quantity`
- `stock_amount_usd`
- `warehouse`
- `stock_date`
- `last_imported_at`
- `source_hash`

Notes:

- In the first version, `raw_name` is the main identity key because the report has no article field.
- `source_hash` can help detect changes.

## Products

Storefront product entity. Manual improvements live here.

Suggested table/file: `products`

Fields:

- `product_id`
- `source_id`
- `raw_name_snapshot`
- `status`
- `visibility`
- `clean_title`
- `short_title`
- `description`
- `brand`
- `product_type`
- `size_value`
- `size_unit`
- `package_quantity`
- `unit`
- `image_id`
- `placeholder_key`
- `search_text`
- `notes`
- `created_at`
- `updated_at`

Suggested statuses:

- `draft`
- `review`
- `active`
- `hidden`
- `archived`

Suggested visibility:

- `storefront`
- `wholesale_only`
- `hidden`
- `archive`

## Categories

Customer-facing categories, independent from raw 1C groups.

Fields:

- `category_id`
- `parent_id`
- `title`
- `slug`
- `description`
- `sort_order`
- `placeholder_key`
- `is_active`

Examples:

- Laundry
- Hair Care
- Body Care
- Deodorants
- Shaving
- Oral Care
- Home Cleaning
- Food

Russian storefront labels can be decided later.

## Product Categories

Many-to-many connection between products and categories.

Fields:

- `product_id`
- `category_id`
- `is_primary`
- `sort_order`

## Tags

Tags support search, filters, campaigns, and future recommendations.

Fields:

- `tag_id`
- `title`
- `slug`
- `type`

Suggested tag types:

- `brand`
- `use_case`
- `size`
- `scent`
- `promotion`
- `audience`

## Product Tags

Fields:

- `product_id`
- `tag_id`

## Prices

Prices are derived from source data and settings, but snapshots are useful for orders and review.

Suggested calculated fields:

- `base_price_usd`
- `wholesale_price_kgs`
- `retail_raw_kgs`
- `retail_price_kgs`
- `registered_price_kgs`

These can be recalculated when:

- USD rate changes
- retail markup changes
- customer discount changes
- product promotion changes
- source base USD price changes

## Customers

Fields:

- `customer_id`
- `name`
- `phone`
- `whatsapp`
- `email`
- `role`
- `wholesale_status`
- `individual_price_base`
- `adjustment_type`
- `adjustment_percent`
- `preferred_contact`
- `created_at`
- `updated_at`

Roles:

- `guest`
- `retail`
- `wholesale`
- `admin`

Wholesale statuses:

- `none`
- `pending`
- `approved`
- `rejected`

Price base:

- `retail`
- `wholesale`

Adjustment type:

- `none`
- `discount`
- `markup`

## Customer Addresses

Fields:

- `address_id`
- `customer_id`
- `city`
- `region`
- `address_line`
- `comment`
- `latitude`
- `longitude`
- `is_default`

Coordinates are optional and reserved for future map selection.

## Promotions

Fields:

- `promotion_id`
- `title`
- `status`
- `audience`
- `target_type`
- `target_id`
- `discount_type`
- `discount_value`
- `starts_at`
- `ends_at`
- `combinable_with_customer_discount`
- `priority`

Audience:

- `retail`
- `wholesale`
- `all`

Target type:

- `product`
- `category`
- `brand`
- `tag`
- `all`

Discount type:

- `percent`
- `fixed_kgs`
- `set_price_kgs`

## Orders

Fields:

- `order_id`
- `customer_id`
- `customer_snapshot`
- `status`
- `price_mode`
- `subtotal_kgs`
- `discount_total_kgs`
- `delivery_rule_result`
- `total_kgs`
- `contact_method`
- `city`
- `region`
- `address_line`
- `delivery_comment`
- `manager_message`
- `created_at`
- `updated_at`

Statuses:

- `new`
- `sent_to_manager`
- `in_progress`
- `confirmed`
- `cancelled`
- `completed`

No stock reservation in the first version.

## Order Items

Order item values are snapshots and must not change after import updates.

Fields:

- `order_item_id`
- `order_id`
- `product_id`
- `source_id`
- `title_snapshot`
- `raw_name_snapshot`
- `quantity`
- `unit`
- `unit_price_kgs`
- `line_total_kgs`
- `base_price_usd_snapshot`
- `usd_rate_snapshot`
- `price_mode`
- `applied_discount_snapshot`

## Import Runs

Tracks every stock import.

Fields:

- `import_run_id`
- `source_file`
- `source_file_hash`
- `stock_date`
- `warehouse`
- `started_at`
- `finished_at`
- `status`
- `rows_read`
- `products_imported`
- `products_updated`
- `products_new`
- `products_hidden_by_rule`
- `warnings`

## Future Sync Fields

To support later two-way exchange with a modern accounting system, keep these optional fields:

- `external_guid`
- `external_article`
- `external_barcode`
- `external_updated_at`
- `sync_status`
- `sync_error`

These may be empty in the 1C 7.7 phase.
