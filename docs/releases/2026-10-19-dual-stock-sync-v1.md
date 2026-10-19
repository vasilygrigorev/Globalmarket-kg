# Global Market KG stock sync, 2026-10-19

Release `20261019-dual-stock-sync-v1` updates the retail and wholesale storefronts from the authoritative 1C stock workbook dated 2026-10-19.

## Inputs and identity

- Source: `155041-msg-1354-Остатки 19,10,26-1.xlsx`.
- SHA-256: `a8fa65d2b0a995d5fd4e9aa855e1016f8a2d58a4ca58929a466e19eefa4a0ae4`.
- 665 priced 1C rows were matched to stable product codes; 664 merchandise rows were published.
- Service code `2322` (`доставка по городу`) and 12 unpriced perfume-packaging components were excluded.
- Numeric prefixes in the workbook are treated as articles, not as stable 1C product codes.

## Catalog result

- Persistent master: 995 cards, including 686 active and 309 inactive cards.
- Retail: 686 visible products, 840 generated product pages, 528 active products with photos.
- Wholesale: 664 visible products in exact 1C group/order sequence, 506 with photos.
- Fresh arrivals: 154 products, with identical membership and order on retail and wholesale.
- New persistent cards: source codes `3268` and `3302`.
- Existing photos, descriptions, account rules, client pricing and stable product URLs were retained.
- Products with zero stock remain in the master and return automatically after a future positive-stock import.

The available photo for Felce Azzurra Bamboo & Lotus is labelled 120 ml and was deliberately not assigned to the new 125 ml product (`3302`).

## Production

- Git commit: `6295abb2fcd52b37e08e4d350d79ba9300386090`.
- Retail Pages deployment: `129d001b-ec95-4d73-a94f-0b47c8a02157`.
- Retail rollback deployment: `b58e8019-d1b4-49e4-bf5e-9ff3c2d793e5`.
- Wholesale Worker version: `317e287f-3dfe-4871-9512-28b2b0f15903` at 100% traffic.
- Wholesale rollback version: `7520784d-ddf2-4406-90b5-6c2f198911b3`.

Both live domains were checked after publication. No real order was submitted and Google Ads was not changed.

## Verification

The release fails closed on unresolved or ambiguous stock matches. Automated checks cover stock and price parity, service-row exclusion, exact wholesale order, account isolation, server-side order pricing, gallery retention, stable URLs, inactive-product pages, SEO pages, structured data and retail/wholesale fresh-arrival parity.
