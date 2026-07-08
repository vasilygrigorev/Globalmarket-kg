# Pending photo review

Raw Petya photos that were investigated but deliberately **not** published,
because either identity or photo-count could not be confirmed with
confidence. Nothing here has been added to `data/product_overrides.json`
or moved into a published `assets/products/<brand>/` folder. Raw files are
left in place under `assets/products/` — do not delete.

## RESOLVED 2026-07-08 — `restored-history/` photo-role rotation (H&S 650 ml + Dove 680 ml)

User report: "хэден 650 вместо карточки стоит лицо" (H&S 650 ml shows the
front photo where the card should be), then "тоже самое по dove 680, фото
перепутаны с разными видами" (same for Dove 680 ml, mixed up with other
variants).

Root cause: the 2026-07-05 gallery restore (`data/product_overrides.json`
notes: "restored historical gallery from d8df3e0 after raw Telegram cleanup
removed previously published images") rotated the three photo roles across
a chain of products instead of restoring each product's own three photos:

- Every affected product's `-card-front.jpg` was actually that product's own
  plain **front** photo, and its `-front.jpg` was actually that product's own
  **back**/ingredients photo — a consistent two-role swap, not random.
- Each product's `-back.jpg` was not a back photo at all: it held a
  **different product's real stylized card**, chained across product lines:
  `Dove Nourishing Oil Care → Dove Intensive Repair → Head & Shoulders
  Anti-Hairfall → Head & Shoulders Smooth & Silky`, and separately
  `Dove Straight & Silky → Dove Hair Fall Rescue → Dove Daily Shine`
  (arrow = "this product's old -back.jpg held the next one's real card").

Fixed by renaming each product's own front/back into their correct roles and
moving each recovered stylized card to the product it actually belongs to:

| Product | product_id | Real card recovered from |
|---|---|---|
| Head & Shoulders Smooth & Silky 650 ml | `prd_2563a902d211` | Anti-Hairfall's old `-back.jpg` |
| Head & Shoulders Anti-Hairfall 650 ml | `prd_d8023f79398b` | Dove Intensive Repair's old `-back.jpg` |
| Dove Intensive Repair 680 ml | `prd_fc72d049dab9` | Dove Nourishing Oil Care's old `-back.jpg` |
| Dove Hair Fall Rescue 680 ml | `prd_5c4dde48386b` | Dove Straight & Silky's old `-back.jpg` |

Two chain heads had no incoming card (nobody's old `-back.jpg` pointed to
them), so their own real stylized card was not found in the first pass —
published front+back only as a temporary `KNOWN_EXCEPTIONS` entry.

**Update, same day, later:** Petya re-sent the same 5-image Dove marketing
set (`telegram-8767964230-20260708-080342-{01..05}`) — the same rotation bug
recurred on the resend (each group's `-back.jpg` again held a different
product's card), but this time the full 5-cycle closed cleanly with no
missing link: `Nourishing Oil Care -> Intensive Repair -> Straight & Silky ->
Hair Fall Rescue -> Nourishing Oil Care` (via each `-back.jpg`), which
included the two previously-missing cards:

- **Dove Straight & Silky 680 ml** (`prd_e165f2a765a7`) — real card recovered
  from this resend's group 02 `-back.jpg`. Now published with the full
  3-photo set; removed from `KNOWN_EXCEPTIONS`.
- **Dove Nourishing Oil Care 680 ml** (`prd_f724e0973fa5`) — real card
  recovered from group 04 `-back.jpg`. Now published with the full 3-photo
  set; removed from `KNOWN_EXCEPTIONS`.
- **Dove Daily Shine 680 ml** (1C source_code 2622, currently 0 stock, not a
  public product) — this resend's group 01 supplied its own front (card-front
  slot) and back (front slot); combined with the card already recovered
  earlier, it now has a complete 3-photo set at
  `assets/products/dove/dove-daily-shine-680ml-*.jpg` for whenever it's back
  in stock. Still no product override, since there's no active product row.

Every other file in the resent batch was a confirmed byte-identical (md5)
duplicate of what was already correctly filed — discarded rather than kept
as redundant loose copies.

**Mistake made and caught during this second pass:** while re-pointing
`dove-straight-silky-680ml-card-front.jpg` and
`dove-nourishing-oil-care-680ml-card-front.jpg` at their newly-recovered real
cards, the plain front photos previously occupying those paths were
overwritten by `mv` before being saved elsewhere, and the loose duplicate
copies that could have replaced them were deleted moments later believing
them redundant. Both plain-front images were recovered from git history
(commit `750b21b`, which predated this fix) and saved as proper, distinct
`-front.jpg` files. Lesson: when a destination path is about to be
overwritten, move the survivor to its new name *before* deleting any
"duplicate" that might be its only remaining copy.

**New, unrelated product identified in the same Petya delivery:** a sixth
group, `telegram-8767964230-20260708-080803-01`, was Colgate Extra Clean
(1C code 357, `prd_f5192ea22a74`) — self-consistent, no rotation issue,
published with the full 3-photo set.

`Head & Shoulders Cool Menthol 650 ml` (`prd_e7e45d64df8b`) was already
correctly organized in its own folder before this fix and was not part of
the broken chain — a stray byte-identical duplicate of its card had leaked
into Smooth & Silky's old `-back.jpg` slot. Originally `rm`'d outright since
the real file already exists at
`assets/products/head-shoulders/head-shoulders-cool-menthol-650ml-card-front.jpg`
— per the no-delete policy adopted 2026-07-08 (see "Petya import rules" in
`docs/product-photo-rules.md`), recovered from git history (commit
`66a1cf7`) and moved to `assets/products/_archive/` instead.

Several duplicate files from Petya's Dove-680ml resend (the same day) were
also `rm`'d before the no-delete policy existed. Those were never committed
to git, so unlike the Cool Menthol case above, the exact original files
can't be restored — but every one was confirmed byte-identical (md5) to a
file that still exists at its published location, so no photographic
content was actually lost, only a redundant raw-upload copy.

14 products total reference "restored historical gallery from d8df3e0" in
their override notes (the H&S/Dove chain above plus Concord, Comfort x3,
Banduff x2, Fairy Lavender). Spot-checked Comfort Iris & Jasmine
(`prd_733c019c32a5`) as a sample from the rest — its card-front/front/back
are each self-consistent and correctly branded, not part of a rotation. The
bug reported here appears scoped to the H&S/Dove shampoo chain specifically,
not universal to every product this restore touched, but the other 9 weren't
individually checked — worth a quick look if a mismatch surfaces there too.

## RESOLVED 2026-07-06 (late) — owner confirmations on archive-audit leftovers

The owner reviewed the uncertain items surfaced by the full-archive audit and
gave direct confirmations. Published as a result:

- **Concord Butterfly Razor = KL 90** (`prd_f12169c0af17`) — owner confirmed
  the unlabeled butterfly razor (`telegram-...-20260619-110606` files 04-06)
  is model KL 90. Override + photos prepared. **Stock is 0**, so it stays
  hidden from the storefront (catalog filters `stock>0`); added to
  `data/photo_mapping_allowlist.json` so the guard knows this is intentional.
  Will appear automatically with its photo when restocked.
- **3 Concord nail clippers** (`prd_f652a5ca9bbf` 020-1, `prd_d53b7b8bf384`
  6401-3, `prd_d686b0354eac` 6425-3) — owner said "take any" for the missing
  plain-front shot. Photos already existed, prepared, in
  `assets/products/concord/` (a prior session curated them but never linked
  overrides); each now published with card-front/front/back. Category `other`.
- **BIC Miss Soleil Colour Collection 4 шт** (`prd_684776405d52`) — owner
  clarified the two shots I sent are front + back and that the designed card
  (`124743` file 50) is the real card-front, so a full triple exists.
  Published.
- **Dove go fresh Cucumber & Green Tea 250 мл** (`prd_07e3d025b33c`) and
  **Coconut & Jasmine 250 мл** (`prd_792036a19367`) — owner confirmed both
  scent identities ("огурец, кокос — всё верно"); the generic 1C names
  ("Cucumber"/"Coconut") are these variants. Published, category `body`.

Perfume note: the 3 "no 1C match" 5 ml perfumes flagged by the audit
(Chanel Chance, Le Labo Another 13, Bybozo Sea Breeze) were never actually
blocked — perfumes live in a **separate** DB, `data/manual_products.json`,
not the 1C `store.db`, and all three were already published there with
images. The audit agent simply didn't know about that file. The "rule" the
owner asked for (perfumes not tied to 1C) already exists as
`manual_products.json` + the `known_external_override_ids` allowlist.

Still genuinely pending after this pass (unchanged, need a photo or a
larger-volume 1C match): Fairy Max Plus Fruity Green (no back), AXE Suave
Zesty Citrus + 2 Gillette shave gels (2 of 3 photos), Downy Lavender & Musk
1 L + Dash Color Frische Gel 1.1 L (back only), Dalli "Super Concentrate"
31-wash (owner thinks it may be a larger 2.25/2.5 L pack — no matching 1C
line found yet), and the several low-confidence Dove Advanced Care /
Persil bundle variants.

## FULL ARCHIVE AUDIT 2026-07-06 (evening) — `assets/telegram_inbox/` (74 folders, 764 files, 2026-06-02 → 2026-07-06)

The user reported that not all photos Petya sent had made it to the site.
Investigation found that the entire `assets/telegram_inbox/` directory is
**gitignored** (`.gitignore` line `assets/telegram_inbox/`), so `git status`
never surfaces it and it had never been audited as a whole — only individual
folders that someone happened to browse to by hand in past sessions. The
existing coverage scripts (`report_raw_photo_groups.py`,
`report_photo_coverage.py`) also only scan `assets/products/`, not
`assets/telegram_inbox/`, so this backlog was invisible to every automated
check.

Ran a full visual audit of all 74 folders (8 parallel research passes,
cross-referenced against `data/store.db` `source_products` by name/weight/
barcode, checked against `data/product_overrides.json` for existing
publication). Result: **the overwhelming majority of the 764 files are
duplicates/resends of photos already published** in prior sessions (Sunsilk,
Lenor, Jif, Pantene, TRESemmé, Downy, Clear, Herbal Essences, Gillette/Venus,
Johnson's, AXE, Persil/Ariel/Dash/Dalli detergents, YC/Skin Doctor sunscreens,
etc. — dozens of SKUs, all already in `product_overrides.json` with full
galleries). Some agent-reported "not yet published" matches turned out to be
wrong on manual re-check (e.g. a "Mach3 Turbo" and a "Fusion5 PRO" cartridge
box were misidentified against unrelated 1C codes that already had photos) —
those were verified against the actual images before being ruled out.

**6 new products confirmed and published** this pass (photos copied into
`assets/products/<brand>/`, added to `data/product_overrides.json`):

| Product | 1C match | product_id |
|---|---|---|
| Head & Shoulders Cool Menthol шампунь 650 мл | H&S Шампунь (650ml) Menthol | `prd_e7e45d64df8b` |
| Skin Doctor SD-622 SPF60 крем 170 г | С/З DS (SD-622)SPF60 (170) | `prd_23e9c6bb855b` |
| Skin Doctor Facial Sunscreen SPF60+ спрей 100 мл | С/З DS (SD-SS-F60P100) | `prd_418f9f481516` |
| Skin Doctor SD-665 SPF50 крем 150 г | С/З DS (SD-665)SPF50 (150gr) | `prd_91d95a5103ac` |
| Dove Advanced Care Original спрей 250 мл | Dove Body Spray (250) Original | `prd_b8b5bfec07e5` |
| Dove go fresh Apple & White Tea спрей 250 мл | Dove Body Spray (250) Go Fresh Apple | `prd_f23090eb2627` |

The two Dove sprays are notable: their `card-front` came from the June 26
batch, while the matching plain `front`/`back` shelf photos came from the
**already-known** July 3 batch (`telegram-989425384-20260703-160531`) that
was previously blocked for exactly these two products (see the "2026-07-05"
section below) — combining photos across two different Petya sends resolved
both long-pending items.

**Photo exists but product is out of stock (0 quantity) — do not publish:**

- **Concord станок KL 6947** (`prd_2554a61dc141`) — complete, confident
  card-front/front/back triple found (`telegram-8767964230-20260619-110606`,
  files 07-09, Art# KL6947 printed on the pack), but `stock_quantity = 0` in
  the current 1C export. Photo is ready to go the moment stock arrives.
- **Dove Шамп. (680) Daily Shine** (`prd_6bd469f8a2b6`) — complete, confident
  triple found (`telegram-8767964230-20260619-110800`, files 21-23), but
  `stock_quantity = 0`.

**Found but still needs one more/better photo, or confirmation, not
published:**

- 3 Concord nail clippers (Art# 020-1, 6425-3, 6401-3 — `prd_f652a5ca9bbf`,
  `prd_d686b0354eac`, `prd_d53b7b8bf384`) — each only has a card-front-style
  shot + back, no plain "front".
- Concord Butterfly Razor, no model number visible on the box — plausible
  match to `Станок (KL 90)` but not confirmed.
- Fairy Max Plus "Fruity Green" 600ml (`prd_43bb60f484a9`, already has a
  text-only override, 1C raw_name says plain "Apple") — has card-front+front
  with a clear barcode, but no matching back panel in the same folder (the
  two back-candidates present are a generic label and one explicitly marked
  "Lavender").
- AXE Signature Suave Zesty Citrus (`prd_af4df5014530`), Gillette Fusion
  Shave Gel 5X Cocoa Butter (`prd_1dfaa90e937f`, text-only override exists),
  Gillette Series Shave Gel Aloe Vera Sensitive (`prd_28ee787466c6`) — each
  only has 2 of the 3 required photos.
- Downy Concentrate Lavender & Musk 1L (`prd_f390f3fe18e6`) and Dash Color
  Frische Gel 1.1L (`prd_57c963eeb3d1`) — only a single back photo each, no
  front/card-front found anywhere in the archive.
- BIC Miss Soleil Colour Collection, Dalli "Super Concentrate" 31-wash
  detergent, several Dove Advanced Care goFresh Cucumber/Coconut variants,
  and a couple of Persil Power Gel bundles with illegible scent names — all
  medium/low confidence, no forced matches made.
- 3 travel-size 5ml perfumes (Chanel Chance, Le Labo Another 13, Bybozo Sea
  Breeze) and a Chloé Nomade 5ml — no perfume line at all in
  `source_products` to cross-reference against; needs a manual check outside
  this DB (or confirmation these are even current stock).

All raw files remain untouched in `assets/telegram_inbox/` (gitignored, not
tracked by git either way).

## PARTIALLY RESOLVED 2026-07-06 (afternoon) — `assets/telegram_inbox/telegram-8767964230-20260706-{120924,120953,124743,124755}`

A new batch (69 raw files, not yet in card-front/front/back naming — found in the
raw `assets/telegram_inbox/` staging area, not `assets/products/`) covering
Rexona/Dove sticks, BIC disposable razors, and Gillette/Venus razors +
cartridges. **17 products identified and published** (card-front/front/back
triples, cross-referenced by name/weight/barcode against `data/store.db`
`source_products`):

| Product | 1C code | product_id |
|---|---|---|
| Rexona Men V8 стик 40 г | 1028 | `prd_9bb309942383` |
| Rexona Antibacterial + Invisible стик 40 г | 2839 | `prd_0d95e9b49711` |
| Rexona Men Cobalt стик 40 г | 2835 | `prd_47c8b6565a63` |
| Rexona Men Xtra Cool стик 40 г | 2836 | `prd_168ccd5d1f3e` |
| Rexona Bamboo стик 40 г | 1246 | `prd_56cefec24fdf` |
| Dove Men +Care Clean Comfort стик 40 г | 1523 | `prd_8b3a9f34a763` |
| BIC 1 Sensitive 15 шт (10+5) | 2925 | `prd_a5a45ddea545` |
| BIC 3 Sensitive 6 шт (4+2) | 2927 | `prd_f83cc0014f92` |
| BIC 2 Sensitive 5 шт | 2926 | `prd_4f3caf82472d` |
| BIC Comfort 2, 5 шт | 2928 | `prd_6a96d3de0c5a` |
| BIC Soleil Scent (женский) 4 шт | 2922 | `prd_d89548b02b08` |
| BIC Twin Lady (женский) 5 шт | 2924 | `prd_9e4624cbe2cf` |
| Gillette Fusion5 Power станок | 887 | `prd_9f1a9f037659` |
| Gillette Fusion5 ProGlide Power станок | 2823 | `prd_1b7d37e71949` |
| Venus Deluxe Smooth Swirl кассеты 3 шт | 2949 | `prd_76659cd2bb07` |
| Venus Comfortglide Breeze кассеты 8 шт (XL) | 605 | `prd_7f5f15b91773` |
| Venus Extra Smooth кассеты 8 шт (XL) | 2951 | `prd_be5c87ae6741` |

Попутно исправлены 2 неверные категории, назначенные при импорте остатков
(были `laundry`, должны быть `deodorants`/`shaving`): Dove Men +Care Clean
Comfort и BIC Comfort 2.

**6 групп фото НЕ опубликованы** — реальные проблемы, не просто "руки не
дошли":

- **Rexona Men Ice Cool стик 40 г** (кандидат: код 2961, `prd_f024c1fb0785`)
  — есть только card-front и back (штрихкод 4800888191144), фото "front"
  (обычное фото товара) не прислали. По контракту нужны все 3 фото.
- **Rexona "invisible on black+white clothes"** (группа `124743-01..03`) —
  тройка фото внутренне согласована, но её back-фото (штрихкод
  4800888220820, текст "REXONA ANTIBACTERIAL + INVISIBLE ANTIPERSPIRANT
  STICK") **побайтово совпадает по штрихкоду** с back-фото уже
  опубликованного Rexona Antibacterial + Invisible (группа `120953-06..08`),
  хотя дизайн лицевой стороны другой ("anti-white marks + yellow stains" с
  иконкой одежды, без красного щита "10x protection"). Вероятный кандидат —
  код 1248 (`Rexona Stick (40) Invisible Black`), но с чужим/задвоенным back
  фото публиковать нельзя — нужно новое фото back именно этой упаковки.
- **BIC Miss Soleil Colour Collection 4T** (кандидат: код 2921,
  `prd_684776405d52`) — есть только card-front (присылали дважды, `124743-31`
  и `124743-50`) и back (штрихкод 3086123303843), обычного фото "front" нет.
- **BIC Soleil Bella** (группа `124743-33..35`) — тройка фото полная
  (card-front/front/back), но на упаковке написано **"3T"** (3 станка),
  а единственный кандидат в остатках — `BIC SOLEIL BELLA WOMEN 4PCS BOX`
  (4 штуки). Расхождение в количестве — нужно подтверждение, тот ли это
  товар (может, другая фасовка не заведена в 1С) или нет.
- **Venus Comfortglide Breeze, малая пачка 4 шт** (группа `124743-41/43`
  card-front, `124743-42` back; кандидат: код 617, `src_ebe1f3c5ba87`) — нет
  фото "front", а присланное back-фото (штрихкод 7702018886364) **побайтово
  совпадает** с back-фото, присланным для другой пачки (см. следующий пункт)
  — явная путаница, нужно новое фото back именно 4-штучной пачки.
- **Venus Deluxe Smooth Swirl, большая пачка XL 6 шт** (группа
  `124743-27/30` card-front/front; кандидат: код 2950, `prd_f5853f007466`) —
  card-front и front надёжные, но присланное back-фото (`124743-29`,
  штрихкод 7702018886364) — **тот же самый штрихкод**, что и у Comfortglide
  Breeze 4 шт выше. Одно из двух back-фото явно перепутано с другим —
  публиковать нельзя, пока не пришлют однозначно свой back для каждой
  пачки.

Все 69 исходных файлов остаются нетронутыми в
`assets/telegram_inbox/telegram-8767964230-20260706-{120924,120953,124743,124755}/`.

## RESOLVED 2026-07-08 (remaining 5 groups) — `telegram-8767964230-20260706-*` (two live batches)

Two fresh batches landed on disk **during local sessions** (~10:28-10:40 and
~12:40, same day), while working on unrelated tasks — not something either
session went looking for. 13 complete-by-filename card-front/front/back
groups, 39 files total, across two drops:

```text
telegram-8767964230-20260706-102856-{01,02,03,04,05}-{card-front,front,back}.jpg  (5 groups)
telegram-8767964230-20260706-103856-{01,02,03}-{card-front,front,back}.jpg        (3 groups)
telegram-8767964230-20260706-104056-{card-front,front,back}.jpg                   (1 group)
telegram-8767964230-20260706-124023-{01,02,03,04}-{card-front,front,back}.jpg     (4 groups)
```

**8 of the 13 groups were identified and published** (dedicated
photo-identification pass, same pattern as the YC sunscreen batch in
`290c609`/`b1ca708` or the Pantene/Lenor/TRESemmé batch in `b26262c` —
cross-referenced brand/barcode/label text against `data/store.db`
`source_products` by 1C `source_code`, not by name):

| Group | Product | 1C code | product_id |
|---|---|---|---|
| `102856-05` | Colgate MaxWhite зубная щётка | 1241 | `prd_1cb756e99bac` |
| `103856-02` | Colgate ZigZag зубная щётка 3 шт | 2938 | `prd_66dd4882eecf` |
| `103856-03` | Colgate ZigZag Charcoal зубная щётка | 2939 | `prd_f3ed12b53668` |
| `104056` | Colgate Double Action Charcoal зубная щётка | 2937 | `prd_773d5cd63456` |
| `124023-01` | Dove go fresh Cucumber & Green Tea стик 40 г | 1699 | `prd_cdc989a294f9` |
| `124023-02` | Dove Original стик 40 г | 122 | `prd_f7a9d836005f` |
| `124023-03` | Dove Beauty Finish стик 40 г | 2706 | `prd_21c8c8aa3e5d` |
| `124023-04` | Dove go fresh Pomegranate & Lemon Verbena стик 40 г | 2948 | `prd_23e1645a6a85` |

Moved to `assets/products/colgate/` and `assets/products/dove/`
respectively, added to `data/product_overrides.json`. Photo coverage
142/529 → 150/529.

**The remaining 5 groups were resolved 2026-07-08.** The earlier pass had
searched `data/store.db` for a literal "360" in `raw_name` and found nothing —
but the 1C export for this line uses heavily truncated/abbreviated names
(`щкд`, `щсп`, or in one case just the bare word `GOLD`) that don't contain
"360" or even "Colgate" as text. Found instead by cross-referencing
`base_price_usd` ($1.30, identical across all four) and `warehouse`
("Основной склад", also identical) — a strong fingerprint for "same shipment,
same product line" even when names don't match:

| Group | Product | raw_name in 1C | 1C code | product_id |
|---|---|---|---|---|
| `102856-01` | Colgate 360 Optic White зубная щётка | `Optic White щкд` | 2940 | `prd_e8a318ef10d2` |
| `102856-02` | Colgate 360 Charcoal зубная щётка | `Charcoal щсп` | 824 | `prd_9fe19a4044b7` |
| `102856-03` | Colgate 360 Charcoal Gold зубная щётка | `GOLD` | 1077 | `prd_09feb137fd5e` |
| `102856-04` | Colgate 360 Whole Mouth Clean зубная щётка | `Whole Mouth щкд` | 2941 | `prd_77566889af78` |
| `103856-01` | Colgate MaxFresh зубная щётка | `Colgate з/щ MaxFresh` | 1075 | `prd_b61ba7c4268e` |

Moved to `assets/products/colgate/`, added to `data/product_overrides.json`.
Photo coverage 179/529 → 184/529.

Two of the five (`102856-01` Optic White and `103856-01` MaxFresh) are
published with only **card-front + front**, not the full 3-photo set — their
own `-back.jpg` files are confirmed mismatches, not genuinely missing photos:

- `102856-01`'s back photo is textually identical to `102856-03`'s own back
  (both say "360 Charcoal Gold"), while `102856-01`'s front clearly shows
  white/blue Optic White bristles — a mixed-up file, not this product's back.
- `103856-01`'s back photo is **byte-identical (md5) to `102856-05`'s
  MaxWhite back** — a real photographer duplicate, not this product's own
  back.

Both are registered in `KNOWN_EXCEPTIONS` in
`scripts/verify_product_galleries.py`, same mechanism already used for the
Pantene/TRESemmé missing-back cases above. The two mismatched `-back.jpg`
files are left untouched at `assets/products/` root — not renamed into
either product's slug, so they're never accidentally published — and not
deleted, in case a real back photo later confirms one of them actually
belongs somewhere else.

## RESOLVED 2026-07-05 — `telegram-8767964230-20260626-142813-next-2-03-*`

Was ambiguous (back-label barcode read "YC852"/SPF50, but the tube design
showed UV60+ — see reasoning below, kept for the record). User confirmed
directly: **UV50 = YC852, UV60 = YC853**. Published as YC Sunscreen SPF60
100g (`prd_8f967f2becb0`, source_code 2912), moved/renamed to
`assets/products/yc/yc-sunscreen-spf60-100g-*.jpg`, added to
`data/product_overrides.json`.

Original reasoning while unresolved: front tube design showed "WITH UV
60+ UVA+UVB", but the back photo's printed code "YC852" and barcode digits
`8859362511882` were byte-for-byte identical to the already-published
YC-852 SPF50 back photo (same MFD/EXP stamp, differing only in the last
batch digits). The back label was apparently not a reliable per-SKU photo
(looked reused/templated), so identity had to come from the user rather
than the barcode.

## 2026-07-05 — `telegram-989425384-20260703-160531-{01,02}-*`

6 files total, re-examined individually (cap color + label text), not by
their `01`/`02` filename grouping (which mixes products):

| File | Cap | Product identified | Notes |
|---|---|---|---|
| `01-card-front.jpg` | Teal | Dove Advanced Care Pear & Aloe Vera goFresh 250ml | |
| `01-front.jpg` | Teal | Same bottle, back label, barcode `7709081559204` | pair with above |
| `01-back.jpg` | Red | Dove go fresh Apple & White Tea, 250ml | |
| `02-card-front.jpg` | Red | Same bottle back label, mentions "parfum Pomme & Thé blanc" | pair with above |
| `02-front.jpg` | Blue | Dove Advanced Care Original, 250ml | |
| `02-back.jpg` | Blue | Same bottle, back label (generic Advanced Care text) | pair with above |

So the 6 photos are really **3 products × 2 photos each** (front-label +
back-label), not 3×3 or 2×3 as the folder names suggest.

- **Teal (Pear & Aloe Vera):** this exact variant is **already published**
  as `prd_d3c195668843` / `Dove Advanced Care Pear & Aloe Vera` with a full
  3-image gallery from a prior batch. These 2 photos are redundant —
  no action needed.
- **Red (Apple & White Tea):** matches stock item `Dove Body Spray (250)
  Go Fresh Apple` (source_code 120, product_id `prd_f23090eb2627`, stock
  qty 96, currently no photo). Identity is fairly confident (scent name on
  can + French ingredient text match), **but only 2 of the required 3
  photos exist** (no separate card/main image, just front-label and
  back-label shelf photos). Per the 3-photo contract, not published.
- **Blue (Original):** matches stock item `Dove Body Spray (250) Original`
  (source_code 806, product_id `prd_b8b5bfec07e5`, stock qty 90, currently
  no photo). Same situation — 2 of 3 photos only, not published.

**Action needed from Petya/owner:** for the Original and Apple & White Tea
variants, either take/send a proper third photo (a clean product-forward
shot to serve as `card-front`), or explicitly approve publishing with only
2 images as a documented exception (like the existing card+front-only
exceptions in `docs/product-photo-rules.md`).

## Что нужно от Пети/владельца (по-русски)

Два товара Dove не публикуются — не хватает третьего фото:

1. **Dove Go Fresh Apple & White Tea, 250 мл** (спрей-дезодорант, красная
   крышка). Сейчас есть только фото лицевой этикетки и фото с составом на
   обороте — нужно ещё одно нормальное "витринное" фото товара (как
   `card-front` у других товаров), либо явное разрешение опубликовать
   всего с 2 фото как исключение.
2. **Dove Advanced Care Original, 250 мл** (спрей-дезодорант, синяя
   крышка). Та же ситуация — 2 фото есть, третьего (`card-front`) нет.

Третий товар с этих же фото — **Dove Pear & Aloe Vera** — уже опубликован
на сайте, эти 2 фото для него не нужны, можно не пересъёмывать.

Пока не пришлют третье фото (или явное "публикуй как есть"), эти два
товара останутся в статусе "review", без фото на сайте.
