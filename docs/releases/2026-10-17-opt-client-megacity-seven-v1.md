# Opt client Megacity seven-client release

Production release: `20261017-opt-client-megacity-seven-v1`

## Scope

- Keeps the existing encrypted `megacity` credential unchanged.
- Replaces that account's former three-contractor scope with exactly seven
  private order destinations: `Мегасити 1` through `Мегасити 7`.
- Generates the seven rows inside the authenticated Worker only for
  `megacity`; they are not added to the shared contractor directory and are
  not visible to agents or other client accounts.
- Hides stock quantities and retains exact source 1C USD multiplied by 95 KGS
  for catalog, cart validation, email and WhatsApp totals.
- Rejects all three former contractor IDs for orders from this account.

No retail code, Google Ads configuration, product record, group, stock, photo,
other account, cart behavior or order transport was changed.

## Preserved baseline

- Products: `699`
- Base 1C groups: `16`
- First virtual group: `group-fresh-arrivals`
- Fresh arrivals: `161`
- Public and inventory files are byte-identical to parent release
  `20261017-opt-client-megacity-v1`.

## Deployment

- Production Worker: `30f79cad-e2b3-41fc-baed-122de3bee0e2`
- Immediate rollback: `a96b4c09-40a3-4b1a-a974-97572659164b`
- Host: `https://opt.globalmarket.kg`
- Immutable archive:
  `/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/releases/2026-10-17-opt-client-megacity-seven-v1`

## Verification

- Live login returned exactly `Мегасити 1` through `Мегасити 7` in order.
- A former 1C contractor was rejected by the production order endpoint before
  any order or email was created.
- All 699 returned prices equal exact source 1C `priceUsd x 95`.
- Stock and source USD fields remain hidden from the account.
- Mandatory 161-product fresh-arrivals verification passed against all six
  receipt-report snapshots and the authoritative receipt ledger.
- No real order was submitted during verification.
