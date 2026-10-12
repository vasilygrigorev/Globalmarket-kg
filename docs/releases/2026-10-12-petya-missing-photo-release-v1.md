# 2026-10-12 Petya missing-photo release

## Scope

Photo-only successor releases were published for both storefronts. Inventory,
prices, 1C order, category membership, customer/agent access, cart behavior and
the opt fresh-arrivals selection were not changed.

## Retail

- Release: `20261012-retail-petya-missing-photo-v1`
- Cloudflare Pages: `6bb923c1-d4cb-4fcc-a468-b78aad13a602`
- Rollback: `001ebc78-2924-4a58-98c6-05b8863ec380`
- 721 active products, 838 retained product pages, 62 landing pages and 904
  sitemap URLs.
- Seven exact three-photo galleries were added or corrected:
  - `3243` Ariel Pods Original Todoen1, 44 capsules;
  - `3246` Ariel Pods Extra Stain Removal, 44 capsules;
  - `3269` Felce Azzurra air-freshener gel Cherry Blossom, 140 g;
  - `3271` Felce Azzurra air-freshener gel Summer Night, 140 g;
  - `3285` Lenor Fresh Air Outdoorable Moonlight, 504 ml / 36 washes;
  - `3286` Lenor Eclat de Minuit, 504 g / 36 washes;
  - `3288` Lenor Alpine Breeze, 840 g / 60 washes.

The former `3285` gallery visibly belonged to Eclat de Minuit. It was moved to
`3286`; `3285` now uses separate versioned `moonlight-lily-504g-v2` files so a
browser cache cannot show the former image.

## Opt

- Release: `20261012-opt-petya-missing-photo-release-v1`
- Worker version: `a25f18a7-7d69-4eca-8379-44b509608f4c`
- Rollback: `e3587979-b459-4cbd-b44b-84f985277e51`
- 699 product records, 16 unchanged base groups and the mandatory first virtual
  `Свежие поступления` group with 105 unchanged products.
- The seven retail galleries above were added and six already-approved
  galleries missing only from opt were restored: `3247`, `3248`, `3249`,
  `3250`, `3253`, `3260`.

## Saved but not published

The following Petya triples are stored in the persistent photo registry and
content-addressed library, but have no exact current or retained 1C identity:

- messages `3560-3562`: Felce Azzurra Classico liquid-soap refill, 500 ml;
- messages `3572-3574`: Felce Azzurra Bamboo & Lotus diffuser, 120 ml;
- messages `3627-3629`: Fa Fresh Sport shower gel, 250 ml;
- messages `3686-3688`: Ariel All-in-1 PODS Original, 60 capsules.

Do not assign any of these to a similar size, scent or Ariel 60-capsule SKU.
They remain ready for an exact future 1C match.

## Verification

- Retail package, gallery contract, retained history, static links, structured
  data and deployment checks passed.
- All 21 newly referenced retail photo assets returned HTTP 200 in production.
- Mobile browser checks showed complete 1254 x 1254 galleries with no broken
  images or console errors.
- Opt authentication/order tests passed; customer stock hiding, contractor
  scoping, source USD pricing, stock cap, WhatsApp handoff and background email
  behavior were preserved.
- The fresh-arrivals verifier passed against all five sequential 1C receipt
  reports and retained the seven selected receipt documents and the excluded
  `2026-08-06` boundary.
