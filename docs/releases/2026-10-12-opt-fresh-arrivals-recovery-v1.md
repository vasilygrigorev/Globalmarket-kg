# Opt fresh-arrivals recovery v1

Published 2026-10-12 to `https://opt.globalmarket.kg`.

## Cause

The 2026-10-10 stock rebuild emitted only the 16 original 1C groups. A stale
fresh-arrivals audit remained in the package, so the missing virtual group was
not detected.

## Repair

- Restored `group-fresh-arrivals` / `Свежие поступления` as the first group.
- Applied the approved USD 10 000 / 14-day receipt-cluster algorithm.
- Selected four receipt documents dated 2026-08-27 and 2026-09-07; the excluded
  boundary is document `А-00000019` dated 2026-08-06.
- Filtered the selection against the 2026-10-10 positive-stock catalog, leaving
  97 visible fresh products.
- Preserved all 699 product records, 16 base groups, prices, stock, photos,
  accounts, contractor scopes, cart and order handoff.

## Release gate

`scripts/verify_opt_fresh_arrivals.py` now fails when the first group is missing
or empty, the audit/source hash is stale, the product records change, or any
base group changes. `scripts/opt_fresh_arrivals.py` recomputes the group without
duplicating product records.

## Deployment

- Release: `20261012-opt-fresh-arrivals-recovery-v1`
- Worker version: `64351973-d985-4e19-9e86-dfd92d2658a0`
- Traffic: 100 percent
- Rollback version: `2a2cd307-16d3-4978-862d-1843c873f722`
- Archive: `GlobalMarketKG/releases/2026-10-12-opt-fresh-arrivals-recovery-v1`

Production smoke checks passed for the portal, noindex headers, protected
catalog API, hidden direct catalog asset and robots response. No real login,
SMS or order was sent. Retail and Google Ads were not changed.
