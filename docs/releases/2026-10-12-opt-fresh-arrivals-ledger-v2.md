# Opt fresh-arrivals ledger v2

Published 2026-10-12 to `https://opt.globalmarket.kg`.

## Cause

The first recovery calculated fresh arrivals from one cumulative 1C report.
That report ended on 2026-09-14 and omitted both newer receipts and some older
receipt evidence, so the live first group stopped at 97 products.

## Repair

- Merge all five verified sequential 1C receipt-report snapshots before running
  the approved selection algorithm.
- Union receipt documents and source codes across snapshots and preserve the
  maximum observed document amount.
- Select the latest large receipt, adjacent earlier large receipts while each
  gap is at most 14 days, and all small receipts newer than the first excluded
  large boundary.
- Filter the result to current positive stock while preserving receipt order
  and then current 1C position.
- Keep every selected product in its original 1C group.

Seven receipt documents from 2026-08-21 through 2026-09-22 are selected. The
excluded boundary remains `А-00000019` dated 2026-08-06. The first virtual group
now contains 105 current products.

## Preserved surface

- Product records: 699, unchanged
- Base 1C groups: 16, unchanged
- Products with approved photos: 520
- Gallery references: 1,554
- Prices, stock, accounts, contractor scopes, cart and order handoff: unchanged
- Retail and Google Ads: untouched

## Deployment

- Release: `20261012-opt-fresh-arrivals-ledger-v2`
- Worker version: `e3587979-b459-4cbd-b44b-84f985277e51`
- Traffic: 100 percent
- Rollback version: `64351973-d985-4e19-9e86-dfd92d2658a0`
- Archive: `GlobalMarketKG/releases/2026-10-12-opt-fresh-arrivals-ledger-v2`

Build, merged-ledger unit test, fresh-arrivals contract, worker-auth checks and
live authenticated catalog verification passed. Direct catalog access remains
hidden with 404 and unauthenticated API access returns 401.
