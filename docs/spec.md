# Internet Store Specification

## Purpose

Build a local-first internet store for Global Distribution KG that can start as a testable local application and later move to VPS hosting, CRM-style administration, and deeper 1C integration.

The first production direction is a polished retail-facing store for household buyers, with a separate approved wholesale mode for shops and wholesale clients.

## Current Data Source

Primary stock source:

- File: `Остатки2.xls`
- Source system: 1C 7.7
- Report: `Остатки ТМЦ на складах`
- Stock date in current sample: `21.05.26`
- Warehouse: `Основной Склад`

Recognized report fields:

- Raw 1C group
- Raw product name
- Unit
- Average cost with VAT in USD
- Stock quantity
- Stock amount in USD

The report does not contain stable product article numbers. For the first version, raw product names are treated as stable.

## Product Visibility

Only products with stock greater than zero are shown.

The 1C group `18 x Germ 2` is excluded from the storefront and should not be considered for catalog work.

Future idea: an archive area for products that are currently unavailable or can be requested by preorder. This is not part of the first version.

## Pricing

All visible store prices are shown in KGS.

Base calculations use USD.

Default settings:

- USD rate: `89.00 KGS`
- Retail markup: `30%`
- Registered retail discount: `3%`
- Free delivery threshold: `10000 KGS`

These values must be configurable.

### Wholesale Price

Wholesale base price:

```text
wholesale_usd = average_cost_usd_from_1c
wholesale_kgs = wholesale_usd * usd_rate
```

Wholesale prices are shown in KGS with two decimals and without beautiful rounding.

Wholesale clients may also have an individual markup or discount. By default, approved wholesalers receive the pure wholesale price.

### Retail Price

Retail base price:

```text
retail_raw_kgs = wholesale_kgs * (1 + retail_markup_percent)
retail_price_kgs = beautiful_round(retail_raw_kgs)
```

Beautiful rounding should target retail-looking endings such as:

- `...90`
- `...95`
- `...900`
- `...950`
- `...990`

Allowed deviation from the calculated raw retail price is around `5%`.

Examples:

- `787.57 -> 795`
- `1020 -> 995`

### Registered Retail Discount

The registered customer discount is applied to the beautiful retail price.

The final discounted price is rounded down to a whole som.

```text
registered_price = floor(retail_price_kgs * (1 - customer_discount_percent))
```

Example:

```text
795 * 0.97 = 771.15 -> 771 KGS
```

### Promotions

Promotions must be supported later for:

- specific products
- categories
- brands
- retail clients
- wholesale clients
- all clients

Promotion rules need a setting for whether they can be combined with individual customer discounts.

Default policy: make this configurable.

## Customer Roles

### Guest Retail Customer

- Default user state
- Sees retail prices
- Can add products to cart
- Can send an order request

### Registered Retail Customer

- No administrator approval required
- Receives the default registered discount, initially `3%`
- Discount can be changed individually
- Should have a minimal account area later

### Wholesale Applicant

- Can apply for wholesale access
- Requires administrator approval
- Does not receive wholesale prices until approved

### Approved Wholesale Customer

- Sees wholesale prices
- Can have individual markup or discount
- Can have separate wholesale promotions

### Administrator

- Single administrator for the first version
- Manages settings and product improvements
- Approves wholesale access
- Managers only receive prepared order messages and do not need admin access in the first version

## Cart And Orders

The cart should feel like a marketplace cart:

- quantity controls
- item removal
- order total
- possibly favorites and buy later in later versions

No stock reservation in the first version.

Order prices and product names should be recorded as they were at the moment of submission.

The storefront must clearly communicate that final availability, price, payment, and delivery are confirmed by a manager.

## Order Flow

1. Customer chooses products.
2. Customer adds products to cart.
3. Customer provides contact and delivery details.
4. Optional future bot conversation before order submission.
5. Order is sent to manager.
6. Manager contacts customer via WhatsApp or email.
7. Payment and delivery are agreed manually.

Manager contacts:

- WhatsApp: `+996706771103`
- Email: `globaldistkg@gmail.com`

## Delivery

Default rule:

- Free delivery from `10000 KGS`
- Otherwise delivery is agreed with manager

The threshold must be configurable.

Customer delivery fields:

- city
- region
- address
- phone / WhatsApp
- delivery comment

Future idea: map location selection. Not required in the first version, but the data model should leave space for coordinates.

## Personal Account

Required eventually:

- customer profile
- saved addresses
- order history
- role/status: retail, wholesale pending, approved wholesale

First version can be minimal.

## Categories And Search

Do not follow raw 1C groups blindly.

Use customer-friendly categories and tags. A product can belong to multiple categories.

Search should be planned from the beginning using:

- raw name
- clean name
- brand
- category
- tags
- volume/size
- product type

## Images

First version may use beautiful category placeholders.

Do not start product image search without explicit confirmation.

Before image search, ask:

- how many products to process
- which priority group
- acceptable image sources
- whether exact packaging match is required
- expected token/credit budget

Do not use AI-generated images for exact branded product packaging.

## Import Safety

New 1C imports must not overwrite storefront improvements:

- clean names
- descriptions
- categories
- tags
- images
- manual visibility
- manual discounts
- SEO text

Imports should update accounting fields only:

- stock quantity
- base USD price
- stock amount
- source group
- source import date

## Future Integration

Current 1C version is old: `7.7`.

For now, all 1C integration is one-way import into the store.

The model should not block future two-way exchange after migration to a more modern accounting system.

## First Implementation Scope

The next work phase should produce:

- local data model
- import workflow
- catalog review artifact
- real-stock storefront foundation

Not included yet:

- online payment
- exact product images for all items
- full CRM
- full admin panel
- map picker
- Telegram stock upload bot
- bot-assisted checkout
