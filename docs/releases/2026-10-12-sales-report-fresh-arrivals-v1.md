# Sales report and 30-day fresh arrivals

## DUBAI accounting

The cumulative 1C report dated 2026-10-12 was imported into an isolated
analytical layer. It was not posted into canonical stock movements. Seven
individual receipt documents, numbers 27-33, were imported as authoritative
receipt evidence: 157 of 157 rows matched exact 1C product codes.

## Selection rule

The public fresh-arrivals set is the de-duplicated union of:

1. the approved large-receipt cluster: more than USD 10,000, with adjacent
   large receipts chained while every gap is at most 14 calendar days, plus
   the small receipts after the first excluded large boundary;
2. every receipt in the 30 calendar days ending on the latest known receipt
   date.

Individual receipt totals override partial estimates from cumulative reports.
Product-code evidence is unioned across all sources. Products are then filtered
to the current positive-stock catalog and ordered by receipt, then current 1C
position.

## Result

- Selected receipt documents: 9
- Current fresh products: 161
- Missing from current stock but retained in evidence: 6 codes
- Opt release: `20261012-opt-sales-report-fresh-arrivals-v1`
- Retail release: `20261012-retail-sales-report-fresh-arrivals-v1`
- Opt Worker version: `b985877a-b12b-41a0-a0f9-85f217347e3e`
- Retail Pages deployment: `a239509f-9aa2-42ca-87a6-f2681b26a7fe`
- Changed storefront fields: fresh-arrivals group in opt; `freshArrival` and
  `freshArrivalRank` in retail
- Prices, stock, product visibility, photos, categories, accounts and order
  flows are unchanged
