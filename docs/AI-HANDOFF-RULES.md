# Global Market KG: правила работы для другого чата или ИИ

This document is the mandatory handoff for any agent changing the retail or opt storefront.

## Canonical locations

- Git repository: `/Users/macmini/Documents/Codex/2026-05-28-new-chat-2`
- Durable project data: `/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG`
- Persistent card master: `catalog-master.json` in the Dropbox project root
- Immutable releases: `releases/<date>-<release-name>`
- Production site: `https://globalmarket.kg`
- Cloudflare Pages project: `globalmarket-kg`
- Protected opt site: `https://opt.globalmarket.kg`
- Cloudflare Worker: `globalmarket-opt-preview`

Do not choose another old chat folder, Telegram download directory, or release copy as a new source tree.

## Ownership boundaries

Petya receives and stores files. Petya must not interpret approval as permission to change either retail or opt, run a builder, commit, push, or deploy. A Codex chat performs analysis and implementation only after an explicit user request.

Retail and opt are separate deliverables. Do not derive one public catalog from the other and do not deploy one while repairing the other unless the user explicitly asks for both.

## Mandatory opt fresh-arrivals rule

The first opt group is always the non-empty virtual group
`group-fresh-arrivals` / `Свежие поступления`; it references the same product
records as the original 1C groups and never duplicates or removes products.

1. A large receipt is strictly over USD 10 000.
2. Start with the latest large receipt.
3. Include adjacent earlier large receipts while every gap between included
   large receipts is at most 14 calendar days.
4. The first earlier large receipt beyond 14 days is the excluded boundary.
5. Include every small receipt newer than that boundary.
6. Keep only products with current positive stock. Order them by selected
   receipt, then by current 1C position.
7. Keep each fresh product in its original 1C group as well.
8. If a stock export arrives without a newer comprehensive receipt report,
   re-filter the last verified receipt selection against current stock. Never
   remove the group and never infer novelty from a restock or filename date.
9. A single cumulative 1C report is not a complete historical ledger. Merge all
   verified sequential report snapshots before applying the window: preserve
   every receipt document, union its product codes, and keep the maximum
   observed document amount. A newer snapshot must never erase older evidence.

Build with `scripts/opt_fresh_arrivals.py` and block publication unless
`scripts/verify_opt_fresh_arrivals.py` succeeds against the pre-build catalog.

## Correct inventory update

1. Create a clean Git worktree and record the current production deployment as rollback.
2. Copy the existing persistent `catalog-master.json`; never start from the newest 1C file alone.
3. Parse the newest approved 1C export and join rows by exact `sourceCode`.
4. Update stock, source price, current 1C order, and permitted current fields.
5. Mark absent codes inactive with zero stock. Do not delete presentation data.
6. Exclude service code `2322` (`доставка по городу`) from every public projection.
7. Apply exact approved photo mappings. Preserve all older galleries and never guess a missing photo.
8. Apply retail pricing policy: default 30 percent; The Pink Stuff, Felce Azzurra, and Kamill 40 percent; free-delivery threshold 5,000 KGS.
9. Build two projections:
   - `data/public-catalog.json`: active, in-stock retail products only;
   - `data/page-catalog.json`: all retained non-service identities so historical product pages survive, including zero-stock products and products whose exact photo is still pending.
10. Preserve every registered slug from `data/product-slug-registry.json`.
11. Generate and write an exact `productPagePath` for every active product. Storefront code must use that path directly and must never recreate it from the current title.
12. Generate a static page for every active product. If no exact photo is approved, use the category-neutral placeholder, record `imageCount: 0`, and keep the real product link and purchase controls. Never use `href="#"` or a similar product photo.
13. Keep the 10 primary storefront sections in this exact order: Стирка,
    Кухня, Ванная, Тело, Кремы, Бритьё, Зубы, Волосы, Парфюм, Дом и уют.
    Детское and Европа remain supplemental menu links, not duplicate rail tiles.
14. Copy the exact opt `Свежие поступления` set/order into `freshArrival` and
    `freshArrivalRank` when that virtual group exists. If the matching opt
    projection has no such group, use only `firstSeenAt == latestStockDate` as
    a documented fallback; never use `restockedAt`.
15. Keep landing URLs append-only. A historical landing with no current products may stay only with `retainedLegacy: true`; it must never disappear accidentally during regeneration.
16. Copy only reviewed public assets into `assets/`. Never emit Telegram/Petya inbox paths, contact sheets, OCR files, or raw 1C/Dropbox paths into HTML or catalog JSON.

Current explicit hold: source code `660` / Fairy Apple has no approved exact photo. Keep the neutral placeholder until the owner confirms an exact image.

## Required release gates

- Product/master counts must be explained and recorded.
- Opt has `group-fresh-arrivals` first, non-empty and virtual; its audit release,
  complete report-snapshot list and report-set hash match the catalog, all 16
  base 1C groups are byte-for-byte unchanged, and product records are unchanged
  by the fresh-arrivals step.
- No product can expose a raw numeric 1C prefix as its retail title.
- No currently approved gallery may shrink or change without explicit approval.
- Every legacy slug from the previous production release must still resolve.
- Every active catalog row must have a non-empty `productPagePath`, and that file must exist in the package and in `data/product-pages.json`.
- A generated historical page must not be shadowed by an `_redirects` rule.
- Out-of-stock pages must say `Сейчас нет в наличии`, use `OutOfStock` structured data, and contain no add-to-cart control.
- Active pages must show price above equally sized cart/checkout controls.
- Product photos must swipe one image per gesture; visible `Лицевая`/`Обратная` captions are forbidden.
- Footer and privacy page must show `ИП Григорьев Василий Владимирович` and `ИНН 21509198010011`.
- `delivery-and-returns/` must exist and show the current 5,000 KGS free-delivery threshold.
- Consent defaults must block optional Google measurement until the visitor chooses. Never send phone, SMS code, name, address, or order text to Google.
- `_routes.json` must include only `/api/*` and exclude static pages/assets from Pages Functions.
- Production homepage and catalog must be indexable. Every preview hostname must have HTTP `X-Robots-Tag: noindex, nofollow, noarchive`, an HTML noindex meta tag, and `Disallow: /` in its preview-only `robots.txt`.
- Main mobile banner height is 176px; the approved five-banner set is fixed unless the owner changes it.
- Test mobile and desktop, catalog filtering, `Показать ещё`, cart, checkout handoff, share, account entry UI, and at least one active and one inactive product page.
- Do not trigger a real order or SMS during automated smoke tests.

## Publication sequence

1. Build locally.
2. Run all automated gates.
3. Deploy a named preview branch.
4. Add preview-only noindex protection to a copy of the package and verify it by headers, HTML meta, `robots.txt`, script, and real browser screenshots.
5. Deploy the original immutable production package, not the noindex preview copy.
6. Verify `globalmarket.kg`, headers, sitemap, catalog JSON, product pages, and API shape.
7. Archive the exact package and recovery inputs with SHA-256 checksums and deployment/rollback IDs.
8. Commit and push the reviewed source. Update shared handoff, decisions, tasks, and run log.

If any gate fails, stop. Repair the source or master and rebuild; never patch only the live output.

## Current production baseline

The accepted recovery baseline is release `2026-10-11-retail-full-recovery-v1`.
It contains 721 active retail products, 838 retained product pages, 604 protected
legacy product URLs, 61 landing pages, and 903 sitemap URLs. Any later release
must explain a decrease in these retained-history counts before publication.

The accepted opt baseline is release
`2026-10-12-opt-fresh-arrivals-recovery-v1`, Worker version
`64351973-d985-4e19-9e86-dfd92d2658a0`. It contains 699 unchanged product
records, 16 unchanged base 1C groups and a first virtual fresh-arrivals group
with 97 current products. Immediate rollback is Worker version
`2a2cd307-16d3-4978-862d-1843c873f722`.
