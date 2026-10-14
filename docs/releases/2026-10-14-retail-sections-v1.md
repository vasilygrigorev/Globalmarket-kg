# Retail storefront sections v1

Release id: `20261014-retail-sections-v1`

## Scope

- Replaced the old 10-tile rail with 11 practical sections and five protected
  brand shortcuts.
- Added `Чистка` and `Прочее`, retained `Дом и уют`, and removed the separate
  `Кремы` shortcut by placing creams in `Тело` and `Ванная` where appropriate.
- Added a visible divider before Dalli / Dash, Pink Stuff, Felce Azzurra,
  Dr. Beckmann, and Kamill / Glysolid.
- Centralized many-to-many `sectionIds` generation in
  `scripts/classify_taxonomy.py` and normalized protected brand spellings.
- Cross-listed fragrance-purpose products in `Парфюм`.

## Preservation contract

The taxonomy migration may change only brand spelling and derived taxonomy
fields. It must not change price, stock, product identity, stable URL, approved
gallery, fresh-arrival membership/rank, banners, checkout, or Google Ads state.
The pre-release catalog and persistent master are archived under the matching
Dropbox release directory before migration.
