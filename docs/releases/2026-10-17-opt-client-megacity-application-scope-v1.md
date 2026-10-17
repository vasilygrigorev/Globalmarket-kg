# Opt client Megacity application-scope release

Production release: `20261017-opt-client-megacity-application-scope-v1`

## Scope

- Keeps the encrypted `megacity` credential and seven private order
  destinations `Мегасити 1` through `Мегасити 7` unchanged.
- Allows only the 214 products listed in
  `Приложение №2 с номерами СГР`, matched to stable 1C `sourceCode` values.
- Shows an allowed product only while its current 1C stock is positive.
- At publication, 205 allowed products are visible and nine are absent from
  positive stock. An absent allowed product returns automatically when a
  future 1C import restores positive stock for the same code.
- Enforces the same allowlist in the catalog API and order normalization, so
  a hidden product cannot be ordered with a crafted request.
- Keeps stock hidden and retains exact source 1C USD multiplied by 95 KGS for
  catalog, cart validation, email and WhatsApp totals.

No retail code, Google Ads configuration, shared catalog record, product
photo, 1C ordering, fresh-arrivals rule, other account, email transport or
WhatsApp transport was changed.

## Evidence

- Application rows: `214`
- Unique stable 1C codes: `214`
- Unresolved or ambiguous rows: `0`
- Visible positive-stock products: `205`
- Allowed but currently absent products: `9`
- Visible fresh-arrival products for this account: `114`
- Application workbook SHA-256:
  `a933b54dc9e5faa766543871458682bcd951262a2754aa77c4c4024da6d3dd91`
- Full mapping and current availability split:
  `megacity-application-product-scope-audit.json` in the immutable archive.

## Preserved baseline

- Shared products: `699`
- Base 1C groups: `16`
- Shared fresh-arrivals group: `161`
- `public/` and `inventory/` are byte-identical to parent release
  `20261017-opt-client-megacity-seven-v1`.

## Deployment

- Production Worker: `7520784d-ddf2-4406-90b5-6c2f198911b3`
- Immediate rollback: `30f79cad-e2b3-41fc-baed-122de3bee0e2`
- Host: `https://opt.globalmarket.kg`
- Immutable archive:
  `/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/releases/2026-10-17-opt-client-megacity-application-scope-v1`

## Verification

- Live login returned exactly seven private Megacity destinations.
- Live catalog returned exactly the expected 205 source codes.
- Every returned KGS price equals current catalog `priceUsd x 95`.
- Stock and source USD fields remain hidden.
- Every returned group references only visible products; the account-specific
  fresh-arrivals group contains 114 products.
- A positive-stock product outside the application was rejected by the live
  order endpoint with `unknown_product` before email/order creation.
- Shared 699-product catalog and mandatory 161-product fresh-arrivals gates
  passed against all six reports and the authoritative receipt ledger.
- No real order was submitted.
