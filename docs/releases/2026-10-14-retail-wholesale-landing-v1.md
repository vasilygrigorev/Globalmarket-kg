# Retail wholesale landing v1

Release id: `20261014-retail-wholesale-landing-v1`

## Scope

- Published the public, indexable wholesale landing page at `/opt/`.
- Added a compact wholesale entry immediately after fresh products on the retail homepage.
- Added canonical, social metadata, Organization/WebPage/Service/BreadcrumbList structured data, and the wholesale URL to `sitemap.xml`.
- Added consent-aware anonymous wholesale funnel events. Customer-entered fields are never sent to Google.
- Added the wholesale landing to build, package, structured-data, link, sitemap, deployment, and release-invariant checks.
- Prepared the separate Bishkek wholesale Search campaign targeting and ad assets without changing the retail campaign.

## Production

- Git release commit: `80cc6d3`
- Verification follow-up commit: `470a5c9`
- Cloudflare deployment: `155a8291-7b1b-4954-bb75-8362e8723198`
- Immutable URL: `https://155a8291.globalmarket-kg.pages.dev`
- Production URL: `https://globalmarket.kg/opt/`
- Rollback deployment: `1702cc77-69a4-4a3e-8314-75e8c865fa7b`

## Verification

- 493 Node tests passed in the mandatory preflight, plus taxonomy and freshness Python tests.
- 721 active products and 838 retained product pages.
- 905 sitemap URLs and 92,599 local links with zero errors.
- Production deployment smoke passed.
- Orders API returned the expected non-writing `400 empty_cart` probe.
- Wholesale application API returned the expected non-writing `400 missing_name` probe.
- Mobile and desktop browser checks passed.
- Production `/opt/` returns `200`, is explicitly indexable, and has no `X-Robots-Tag: noindex` header.

## Advertising guardrail

`generate_lead` is emitted only after the wholesale application API confirms a successful save. Keep it secondary until one controlled consented submission is visible in GA4 and Google Ads. The retail campaign is not a wholesale bidding source and must not be changed as part of this release.
