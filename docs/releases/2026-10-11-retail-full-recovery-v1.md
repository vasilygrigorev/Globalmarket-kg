# Retail Full Recovery v1

Released: 2026-10-11

## Production

- Public URL: `https://globalmarket.kg`
- Cloudflare project: `globalmarket-kg`
- Production deployment: `001ebc78-2924-4a58-98c6-05b8863ec380`
- Verified preview deployment: `2d5577ab-fd61-4ae4-b151-75cd4bc804ad`
- Immediate rollback deployment: `0c619bb5-8395-4615-b941-21c59d40b112`
- Release header: `20261011-retail-full-recovery-v1`
- Latest stock date: `2026-10-10`

## Retained data

- Master records: 993
- Active retail products: 721
- Retained product pages: 838
- Protected legacy product URLs: 604
- Landing pages: 61
- Sitemap URLs: 903
- Active products with approved real photos: 548

Every active product has a static `productPagePath`. Products awaiting an exact
photo use a neutral category placeholder; historical zero-stock pages remain
informative and have no purchase controls.

## Verification

- Static build and package: passed
- Node tests: 284 passed, 0 failed
- Internal links checked: 92,479; 0 errors
- Product page validation: 838 pages; 0 errors
- Landing validation: 61 pages; 0 errors
- Structured data validation: 901 pages; 0 errors
- Product gallery contract: passed with six documented exceptions
- External preview and production deployment checks: passed
- Public package checksum spot-check against production: matched
- Preview indexing protection: HTTP, HTML, and robots checks passed
- Production indexing: allowed; `/admin/` remains blocked

Google Ads was not enabled or modified by this release.
