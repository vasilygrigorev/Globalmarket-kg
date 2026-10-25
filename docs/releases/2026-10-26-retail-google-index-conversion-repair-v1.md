# Retail Google index and conversion repair v1

Date: 2026-10-26

## Scope

- Recovered 75 historical product URLs as permanent `301` aliases to the
  current pages.
- Added an append-only registry for 68 category, collection, and brand landing
  URLs. A brand page now remains available and informative while its stock is
  zero.
- Restored retained pages for Cussons Creations, Degree, L'Oreal Men Expert,
  Sunsilk, and Vatika.
- Protected visible email links from Cloudflare email obfuscation so crawlers
  do not discover new `/cdn-cgi/l/email-protection` URLs.
- Added first-party wholesale lead attribution to the manager email.
- A successfully saved, consented wholesale application now reports to both
  the retained Ads destination and the active Google Ads lead destination
  `AW-18474068233/UR-oCOSq7oQdEInSj-lE`.

No campaign budget, keyword, match type, location, bidding, AI Max, or automatic
expansion setting was changed in this release.

## Verification

- Public products: 686.
- Retained product pages: 840.
- Landing pages: 68.
- Sitemap URLs: 913.
- Node tests: 499 passed.
- Taxonomy tests: 41 passed.
- Fresh-arrival tests: 15 passed.
- Release invariants and clean-package verification: passed.
- Preview: `https://0899c03e.globalmarket-kg.pages.dev` with HTTP, HTML, and
  robots noindex protection.
- Production deployment: `https://20d8a9a2.globalmarket-kg.pages.dev`.
- Production storefront and orders API smoke checks: passed.
- Search Console validation for the historical 404 group: started.
- Updated `sitemap.xml` was resubmitted in Search Console on 2026-10-26;
  Google confirmed receipt. The previous successful processing had found 908
  URLs; the new file contains 913.

## Durable rule

Product and landing URLs are append-only public identities. A stock import may
change availability, but it must not delete a page or reuse an old URL for a
different product. Renames require a permanent alias from every known old URL
to the current page.
