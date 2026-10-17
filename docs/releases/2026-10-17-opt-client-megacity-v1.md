# Opt client Megacity release

Production release: `20261017-opt-client-megacity-v1`

## Scope

- Adds the client login `megacity`; the credential itself is stored only as an
  encrypted Cloudflare secret and is not committed.
- Hides stock quantities for this client.
- Limits access to these current 1C contractors:
  - `ctr_1c_246` — `"Мега Сити"р-ок Ортосай - Калыс`
  - `ctr_1c_679` — `Мега Сити №1 - Калыс`
  - `ctr_1c_861` — `Мега Сити №2 - Калыс`
- Calculates this account's KGS price from the exact original 1C USD price at
  `USD x 95`, without a markup coefficient.
- Uses the same server-side price in the catalog, cart validation, email and
  WhatsApp order summary.

No retail code, Google Ads configuration, product record, group, stock, photo,
existing account price or order transport was changed.

## Preserved baseline

- Products: `699`
- Base 1C groups: `16`
- First virtual group: `group-fresh-arrivals`
- Fresh arrivals: `161`
- Public and inventory files are byte-identical to parent release
  `20261012-opt-sales-report-fresh-arrivals-v1`.

## Deployment

- Production Worker: `a96b4c09-40a3-4b1a-a974-97572659164b`
- Immediate rollback: `7c2c3966-1f2c-46f6-8b16-4ce1be3dcd02`
- Pre-change Worker: `b985877a-b12b-41a0-a0f9-85f217347e3e`
- Host: `https://opt.globalmarket.kg`
- Immutable archive:
  `/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/releases/2026-10-17-opt-client-megacity-v1`

## Verification

- Authenticated live catalog matched all 699 locally shaped product rows.
- All 161 fresh-arrival references and their order matched.
- Every returned KGS price equalled source 1C `priceUsd x 95`.
- Stock fields and source USD prices were absent from the client response.
- Anonymous catalog access returned `401`; raw catalog access returned `404`.
- Production HTML, JavaScript and CSS hashes matched the release.
- `X-Robots-Tag: noindex, nofollow, noarchive` and `Disallow: /` remain active.
- No real order was submitted during verification.
