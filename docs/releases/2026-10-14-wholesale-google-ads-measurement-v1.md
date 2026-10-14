# Wholesale Google Ads measurement v1

Release id: `20261014-wholesale-google-ads-measurement-v1`

## Scope

- Added a dedicated Google Ads conversion for a successfully saved wholesale
  application.
- The conversion fires only after `/api/wholesale-application` succeeds and
  only when advertising consent is granted.
- Phone numbers, names, addresses, application text and other personal data are
  never sent to Google.
- Added the Ads destination `AW-18473846742` alongside the existing retail
  destination without changing the retail order conversion.

## Production

- Git release commit: `22181e0`
- Cloudflare deployment: `1defc1ec-4ac8-4821-9e15-6bf779348e1e`
- Immutable URL: `https://1defc1ec.globalmarket-kg.pages.dev`
- Production URL: `https://globalmarket.kg/opt/`
- Rollback deployment: `155a8291-7b1b-4954-bb75-8362e8723198`
- Verified preview: `https://96bdc349.globalmarket-kg.pages.dev`

## Conversion

- Name: `Оптовая заявка отправлена`
- Conversion id: `AW-18473846742`
- Conversion destination: `AW-18473846742/i7tRCJa62pwdENaPgulE`
- Value: `1 USD`
- Counting: once per successful application
- Click-through window: 30 days
- Attribution: data-driven
- Enhanced conversions: disabled because the site does not send customer PII
  to Google.

## Campaigns

- Retail campaign `Global Market KG | Поиск | Бишкек` remains enabled at
  `3 USD/day`. It was not paused or otherwise changed during this release.
- Wholesale campaign `Global Market KG | Опт | Поиск | Бишкек`, campaign id
  `24349064793`, is prepared with Bishkek presence-only targeting, Russian,
  Search-only traffic, a `0.50 USD` CPC cap, exact/phrase wholesale-intent
  keywords, negatives, callouts, sitelinks and wholesale UTM parameters.
- The wholesale campaign remains paused, so it cannot add another `3 USD/day`
  of spend without a separate owner decision.

## Spend interpretation

The account lifetime total must not be used to judge the repaired campaign:

- Old and transition period through 8 October 2026: 223 impressions, 52 clicks,
  `123.96 USD` spend, average CPC `2.38 USD`, zero recorded conversions.
- New-rule period from 9 through 13 October 2026: four impressions, one click,
  `0.38 USD` spend, average CPC `0.38 USD`, zero recorded conversions.
- Combined 25 September through 13 October total: 227 impressions, 53 clicks,
  `124.34 USD` spend. More than `100 USD` of that total belongs to the former
  settings and must not be attributed to the `3 USD/day` test.

## Verification

- `node --test`: 499/499 passed.
- Clean release-package, local-link and release-invariant checks passed.
- Production deployment smoke passed.
- A safe intercepted production form submission confirmed the conversion label
  without writing an application, sending email or exposing customer data.

