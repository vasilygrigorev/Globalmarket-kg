#!/usr/bin/env python3
"""Pure, deterministic product-taxonomy classifier for Global Market KG.

Derives three optional fields from the data a product already has (title, brand,
category/categoryId, productType, description, unit) so the storefront can make
tighter "Похожие товары" recommendations:

- ``productKind``  a fine-grained type, e.g. ``washing_powder``, ``laundry_gel``,
  ``fabric_softener``, ``laundry_capsules``, ``shampoo``, ``razor``,
  ``blade_cartridge`` … or ``""`` (unknown) when it can't be told confidently.
- ``audience``     one of ``men`` / ``women`` / ``kids`` / ``unisex`` /
  ``family`` / ``unknown``.
- ``attributes``   a de-duplicated list of extra tags (``rose``, ``fresh``,
  ``sensitive``, ``anti_dandruff``, ``color``, ``white``, ``for_black_clothes``,
  ``spf``, ``moisturising``, ``capsules``, ``concentrate`` …).

Design rules:
- Never guess. When unsure, ``productKind`` is ``""`` and ``audience`` is
  ``unknown`` — callers must treat those as "no signal", not a real value.
- Pure functions of the input dict only. No I/O, no catalog reads, no network.
- Additive: this module does not mutate the input; ``enrich()`` returns a small
  dict the catalog builder can merge onto a product.

This module is intentionally standalone so it can be unit-tested and wired into
``scripts/build_public_catalog.py`` (to populate the fields) and into
``scripts/generate_product_pages.py`` (``related_products`` ranking) without a
catalog regeneration. See ``docs/catalog-taxonomy.md``.
"""

import re

AUDIENCES = ("men", "women", "kids", "unisex", "family", "unknown")


def _text(product):
    parts = [
        product.get("title"),
        product.get("productType"),
        product.get("description"),
    ]
    return " ".join(str(p) for p in parts if p).lower()


def _has(text, *needles):
    return any(n in text for n in needles)


def _has_unit(text, unit_pattern, low=1, high=999):
    """True when text has a bare number immediately followed by unit_pattern
    (e.g. r"г|g" for grams), with the number inside [low, high]. Used to tell
    a deodorant stick (grams, ~20-90) from a spray (ml, ~100-300) when the
    title has no explicit "стик"/"спрей" word — a common gap in raw 1C names."""
    for match in re.finditer(r"(\d+)\s*(?:" + unit_pattern + r")\b", text):
        value = int(match.group(1))
        if low <= value <= high:
            return True
    return False


# --- productKind -----------------------------------------------------------

def classify_product_kind(product):
    """Return a fine-grained product kind, or "" when it can't be told.

    Two passes: first a categoryId-scoped set of rules (tightest, uses the
    category as context to disambiguate short abbreviations); then a
    categoryId-agnostic fallback of unambiguous phrases, for the recurring
    case where the raw 1C import puts a product in the wrong category but the
    title itself is clear (e.g. a shampoo filed under "other", a deodorant
    spray filed under "body"). The fallback only fires when the first pass
    found nothing, so a correctly-categorized product is never overridden.
    """
    cid = (product.get("categoryId") or "").lower()
    t = _text(product)

    by_category = _classify_by_category(cid, t, product)
    if by_category:
        return by_category
    return _classify_by_text_fallback(t, product)


def _classify_by_category(cid, t, product):
    if cid == "perfume":
        return "perfume_decant"

    if cid in ("laundry", "germany"):
        # "germany" is a legacy collection-style categoryId (see
        # docs/catalog-taxonomy.md) whose products are, in this catalog,
        # entirely laundry detergent — but classification still runs off the
        # text, not the assumption, so it stays safe if that ever changes.
        # A handful of raw 1C rows have a razor's title but a leftover
        # laundry categoryId/productType from a source-code collision (e.g.
        # "GILLETTE Blue-3 comfort (8pcs)" tagged "кондиционер для белья").
        # "Blue-3"/"Blue3" is an established Gillette razor line elsewhere in
        # this catalog, so trust the title over the mistagged category here.
        if _has(t, "blue-3", "blue3"):
            return ""
        brand = (product.get("brand") or "").lower()
        softener_brand = _has(brand, "downy", "lenor", "vernel", "silan", "cocoon")
        # Order matters: capsules and softener before the generic powder/gel.
        if _has(t, "капсул", "capsule", "caps", "tabs", "подушечк"):
            return "laundry_capsules"
        if softener_brand or _has(t, "кондиционер для бель", "ополаскиват", "softener", "для белья", "конд.д/бель", "конд д/бель"):
            return "fabric_softener"
        if _has(t, "гель для стирк", "жидк", "liquid", "gel"):
            return "laundry_gel"
        if _has(t, "порош", "powder"):
            return "washing_powder"
        # German-import raw names sometimes only say "Waschmittel" (detergent)
        # plus a kg weight and a "(NN стир)" wash count, no Russian form word.
        if _has(t, "waschmittel") and _has(t, "кг", "kg"):
            return "washing_powder"
        return ""

    if cid == "hair":
        if _has(t, "шампун", "shampoo", "sh.", "sh+cond", "sh+cond."):
            return "shampoo"
        if _has(t, "маск", "mask"):
            return "hair_mask"
        if _has(t, "henna", "хна"):
            return "hair_dye"
        if _has(t, "oil replecment", "oil replacement", "масло для волос", "hair oil"):
            return "hair_oil"
        # "Бальзам после бритья" (aftershave balm) is filed under "hair" in
        # the raw import in this catalog, but it is a shaving product, not a
        # hair conditioner — check before the generic "бальзам" match below.
        if _has(t, "после бритья", "aftershave", "after shave"):
            return "aftershave_balm"
        if _has(t, "кондиционер", "бальзам", "conditioner", "конд.", "кондиц."):
            return "conditioner"
        if _has(t, "гельдуш", "гель/душ", "гель для душ", "гель душ", "shower gel"):
            return "shower_gel"
        return ""

    if cid == "shaving":
        if _has(t, "кассет", "запаск", "сменн", "cartridge", "refill"):
            return "blade_cartridge"
        if _has(t, "гель для брит", "shaving gel", "shave gel"):
            return "shaving_gel"
        if _has(t, "пена для брит", "shaving foam", "shave foam", "мусс для брит"):
            return "shaving_foam"
        if _has(t, "помазок", "shaving brush"):
            return "shaving_brush"
        if _has(t, "станок", "станк", "razor", "бритв"):
            return "razor"
        return ""

    if cid == "body":
        # Sunscreen titles are often abbreviated (SPF only, no "крем"/"лосьон"
        # word), so check it before shower_gel/body_lotion to avoid misreads.
        if _has(t, "spf", "солнцезащ", "sunscreen", "sunblock"):
            return "sunscreen"
        # Some raw imports file a plain deodorant under "body" instead of
        # "deodorants" — the explicit word still says which form it is.
        if _has(t, "спрей-дезодорант", "спрей-антиперспирант", "body spray"):
            return "deodorant_spray"
        if _has(t, "дезодорант-стик", "дезодорант стик", "stick"):
            return "deodorant_stick"
        # The title is more specific than a generic productType tag — a
        # product titled "...для ног" (feet/legs) is not a shower gel even
        # when a raw import mislabels its productType as "гель для душа".
        title = str(product.get("title") or "").lower()
        if "для ног" not in title and _has(t, "гельдуш", "гель/душ", "гель для душ", "гель душ", "shower gel", "body wash", "bady wash"):
            return "shower_gel"
        if _has(t, "пена для ванн", "bath foam", "для ванны", "пена д/б"):
            return "bath_foam"
        if _has(t, "peel mask", "пилинг-маска", "пилинг маска"):
            return "peel_mask"
        if _has(t, "соль для ванн", "spa salt", "bath salt"):
            return "bath_salt"
        if _has(t, "детское масло", "baby oil", "масло для тела", "body oil"):
            return "body_oil"
        if _has(t, "лосьон", "молочко для тела", "body lotion", "lotion"):
            return "body_lotion"
        if _has(t, "мыло", "soap"):
            return "soap"
        if _has(t, "cr.", "крем", "cream"):
            return "body_cream"
        return ""

    if cid == "deodorants":
        # "EDT" (Eau de Toilette) marks a fragrance wrongly filed under
        # deodorants in the raw import — it is not a deodorant, so exclude it
        # explicitly rather than let a later rule guess a form for it.
        if _has(t, "edt", "eau de toilette"):
            return ""
        if _has(t, "гель-дезодорант", "гель-антиперспирант", "gel deodorant"):
            return "deodorant_gel"
        if _has(t, "спрей", "аэрозол", "spray", "b.s", "body spray"):
            return "deodorant_spray"
        if _has(t, "стик", "карандаш", "stick"):
            return "deodorant_stick"
        if _has(t, "ролик", "шарик", "roll-on", "rollon", "roll on"):
            return "deodorant_rollon"
        if _has(t, "гельдуш", "гель/душ", "гель для душ", "гель душ", "shower gel"):
            return "shower_gel"
        # No explicit form word: fall back to the packaging unit. In this
        # catalog every deodorant stick is sold in grams (28-90g) and every
        # spray/antiperspirant in ml (100-300ml); mixing these two ranges up
        # does not happen in the data, so this is a safe structural signal.
        if _has_unit(t, r"г|g", 15, 90):
            return "deodorant_stick"
        if _has_unit(t, r"мл|ml", 100, 300):
            return "deodorant_spray"
        return ""

    if cid == "home_cleaning":
        if _has(t, "для посуд", "посуды", "dishwash", "средство для мыт"):
            return "dishwashing_liquid"
        if _has(t, "чистящий крем", "крем", "cream"):
            return "cleaning_cream"
        if _has(t, "унитаз", "туалет", "toilet"):
            return "toilet_cleaner"
        if _has(t, "стек", "окон", "универсал", "поверхност", "surface", "glass"):
            return "surface_cleaner"
        return ""

    if cid == "oral":
        if _has(t, "зубная паста", "зуб.паста", "зубн.паста", "зуб паста", "toothpaste"):
            return "toothpaste"
        if _has(t, "зубная щетка", "зубная щётка", "з/щ", "зуб/щ", "зубн.щетка", "зубн.щётка", "toothbrush"):
            return "toothbrush"
        return ""

    if cid in ("other", "food"):
        return _classify_misc(t)

    return ""


def _classify_misc(t):
    """Classifier for the "other"/"food" catch-all categories: manicure
    tools, foot care, air fresheners, tea/coffee, and similar accessories
    that are not personal-care/cleaning products but are still worth a
    productKind for search and "похожие товары"."""
    if _has(t, "кусачки"):
        return "nail_clipper"
    if _has(t, "ножницы"):
        return "scissors"
    if _has(t, "терка для пяток", "терки для пяток"):
        return "foot_file"
    # Checked after the specific tools above: some manicure-tool productType
    # tags say "маникюрный инструмент" generically, which would otherwise
    # shadow a more specific title word like "кусачки"/"ножницы".
    if _has(t, "маник"):
        return "manicure_set"
    if _has(t, "расчес"):
        return "comb"
    if _has(t, "помазок"):
        return "shaving_brush"
    if _has(t, "пластырь"):
        return "plaster"
    if _has(t, "mineral salt"):
        return "mineral_deodorant"
    if _has(t, "освеж"):
        return "air_freshener"
    if _has(t, "салфетки", "wet wipes"):
        return "wet_wipes"
    if _has(t, "ушные", "cotton bud", "cotton swab"):
        return "cotton_swabs"
    if _has(t, "tea", "чай"):
        return "tea"
    if _has(t, "кофе", "coffee"):
        return "ground_coffee"
    return ""


def _classify_by_text_fallback(t, product):
    """CategoryId-agnostic recovery pass — only unambiguous, specific phrases
    so a genuinely uncertain product still ends up "" rather than guessed.
    Exists because the raw 1C import sometimes files a product under the
    wrong category (a shampoo under "other", a deodorant spray under "body",
    a toothbrush under "home_cleaning") while the title itself is clear."""
    if _has(t, "blue-3", "blue3"):
        return ""
    if _has(t, "шампунь", "шамп.", "shampoo", "sh+cond"):
        return "shampoo"
    if _has(t, "зубная паста", "зуб.паста", "зубн.паста", "toothpaste"):
        return "toothpaste"
    if _has(t, "зубная щетка", "зубная щётка", "з/щ", "зуб/щ", "toothbrush"):
        return "toothbrush"
    if _has(t, "кондиционер для бель", "ополаскиват", "для белья", "конд.д/бель"):
        return "fabric_softener"
    title = str(product.get("title") or "").lower()
    if "для ног" not in title and _has(t, "гельдуш", "гель/душ", "гель для душ", "гель душ", "shower gel", "body wash", "bady wash"):
        return "shower_gel"
    if _has(t, "спрей-дезодорант", "спрей-антиперспирант", "body spray"):
        return "deodorant_spray"
    if _has(t, "дезодорант-стик", "дезодорант стик"):
        return "deodorant_stick"
    if _has(t, "spf", "солнцезащ", "sunscreen", "sunblock"):
        return "sunscreen"
    if _has(t, "освежитель", "air freshener"):
        return "air_freshener"
    if _has(t, "конд.", "кондиционер"):
        return "conditioner"
    return ""


# --- audience --------------------------------------------------------------

def classify_audience(product):
    """Return men/women/kids/unisex/family/unknown (conservative)."""
    cid = (product.get("categoryId") or "").lower()
    brand = (product.get("brand") or "").lower()
    t = _text(product) + " " + brand

    if _has(t, "детск", "детей", "kids", "baby", "бэби", "малыш"):
        return "kids"
    if _has(t, "venus", "женск", "for women", "women", "female"):
        return "women"
    if _has(t, "мужск", "for men", " men", "men's", "cr7", "old spice", "axe", "мужчин"):
        return "men"

    # Household categories serve the whole family rather than a person.
    if cid in {"laundry", "home_cleaning", "food"}:
        return "family"

    return "unknown"


# --- attributes ------------------------------------------------------------

_ATTRIBUTE_RULES = [
    ("rose", ("роза", "розы", "rose", "розов")),
    ("fresh", ("fresh", "свеж", "фреш", "frische", "frisch")),
    ("sensitive", ("sensitive", "чувствит", "сенситив")),
    ("anti_dandruff", ("перхот", "anti-dandruff", "dandruff", "против перхоти")),
    ("color", ("color", "колор", "цвет", "farbe")),
    ("white", ("white", "бел", "vollwaschmittel")),
    ("for_black_clothes", ("для чёрного", "для черного", "чёрн", "черн", "black")),
    ("spf", ("spf", "уф-защ", "uv")),
    ("moisturising", ("moistur", "увлажн", "hydrat", "гидрат")),
    ("capsules", ("капсул", "capsule")),
    ("concentrate", ("концентрат", "concentrate", "konzentrat")),
    ("lavender", ("лаванд", "lavender", "lavendel")),
    ("anti_hairfall", ("против выпад", "hairfall", "hair fall", "выпадени")),
]


def classify_attributes(product):
    """Return a sorted, de-duplicated list of extra attribute tags."""
    t = _text(product)
    tags = {tag for tag, needles in _ATTRIBUTE_RULES if _has(t, *needles)}
    return sorted(tags)


# --- form --------------------------------------------------------------

_FORM_BY_KIND = {
    "shampoo": "liquid",
    "conditioner": "cream",
    "hair_mask": "cream",
    "laundry_gel": "gel",
    "washing_powder": "powder",
    "laundry_capsules": "capsules",
    "fabric_softener": "liquid",
    "dishwashing_liquid": "liquid",
    "cleaning_cream": "cream",
    "surface_cleaner": "liquid",
    "toilet_cleaner": "liquid",
    "deodorant_stick": "stick",
    "deodorant_spray": "spray",
    "deodorant_rollon": "liquid",
    "shaving_gel": "gel",
    "shaving_foam": "foam",
    "razor": "card_only",
    "blade_cartridge": "card_only",
    "shower_gel": "gel",
    "bath_foam": "foam",
    "body_lotion": "cream",
    "soap": "solid",
    "toothpaste": "paste",
    "toothbrush": "card_only",
    "perfume_decant": "liquid",
    "deodorant_gel": "gel",
    "hair_dye": "powder",
    "hair_oil": "liquid",
    "body_oil": "liquid",
    "body_cream": "cream",
    "bath_salt": "powder",
    "peel_mask": "cream",
    "nail_clipper": "card_only",
    "scissors": "card_only",
    "foot_file": "card_only",
    "comb": "card_only",
    "shaving_brush": "card_only",
    "plaster": "card_only",
    "air_freshener": "spray",
    "wet_wipes": "card_only",
    "cotton_swabs": "card_only",
    "tea": "card_only",
    "ground_coffee": "powder",
    "manicure_set": "card_only",
    "mineral_deodorant": "solid",
    "aftershave_balm": "cream",
}


def classify_form(product, product_kind=None):
    """Return the physical form of the product ("" when it can't be told).

    Mostly a deterministic lookup from ``productKind``, except ``sunscreen``
    which can be a cream or a spray — the two need to stay distinct in a
    "похожие товары" list.
    """
    kind = product_kind if product_kind is not None else classify_product_kind(product)
    if kind == "sunscreen":
        t = _text(product)
        return "spray" if _has(t, "спрей", "spray", "аэрозол") else "cream"
    return _FORM_BY_KIND.get(kind, "")


# --- useArea -----------------------------------------------------------

_USE_AREA_BY_CATEGORY = {
    "laundry": "laundry",
    "germany": "laundry",
    "hair": "hair",
    "body": "body",
    "oral": "oral",
    "deodorants": "deodorants",
    "shaving": "shaving",
    "perfume": "perfume",
    "home_cleaning": "home_cleaning",
    "food": "food",
}


_USE_AREA_BY_KIND = {
    "shampoo": "hair",
    "conditioner": "hair",
    "hair_mask": "hair",
    "hair_dye": "hair",
    "hair_oil": "hair",
    "laundry_gel": "laundry",
    "washing_powder": "laundry",
    "laundry_capsules": "laundry",
    "fabric_softener": "laundry",
    "dishwashing_liquid": "dishes",
    "cleaning_cream": "home_cleaning",
    "surface_cleaner": "home_cleaning",
    "toilet_cleaner": "home_cleaning",
    "toothpaste": "oral",
    "toothbrush": "oral",
    "deodorant_stick": "deodorants",
    "deodorant_spray": "deodorants",
    "deodorant_rollon": "deodorants",
    "deodorant_gel": "deodorants",
    "shaving_gel": "shaving",
    "shaving_foam": "shaving",
    "razor": "shaving",
    "blade_cartridge": "shaving",
    "shaving_brush": "shaving",
    "aftershave_balm": "shaving",
    "sunscreen": "body",
    "shower_gel": "body",
    "bath_foam": "body",
    "body_lotion": "body",
    "body_cream": "body",
    "body_oil": "body",
    "bath_salt": "body",
    "peel_mask": "body",
    "soap": "body",
    "perfume_decant": "perfume",
    "tea": "food",
    "ground_coffee": "food",
}


def classify_use_area(product, product_kind=None):
    """Return the practical-use area for search/recommendation grouping.

    Derived primarily from productKind (so a product the raw import filed
    under the wrong category, but whose kind was still recognized via the
    text fallback, groups with its real use area rather than its wrong one).
    Falls back to categoryId only when the kind is unknown.
    """
    kind = product_kind if product_kind is not None else classify_product_kind(product)
    if kind and kind in _USE_AREA_BY_KIND:
        return _USE_AREA_BY_KIND[kind]
    cid = (product.get("categoryId") or "").lower()
    return _USE_AREA_BY_CATEGORY.get(cid, "")


# --- searchTerms ---------------------------------------------------------

_STOPWORDS = {"для", "и", "с", "в", "на", "от", "по", "мл", "л", "кг", "г", "шт"}


def classify_search_terms(product):
    """Return a de-duplicated, normalized token list used for search scoring
    (whole-word matches against title/brand/productType, as opposed to a
    substring-only match inside a longer description)."""
    text = " ".join(
        str(product.get(field) or "")
        for field in ("title", "brand", "productType", "category")
    ).lower().replace("ё", "е")
    tokens = re.findall(r"[a-zа-я0-9]+", text)
    seen = []
    for token in tokens:
        if len(token) < 2 or token in _STOPWORDS:
            continue
        if token not in seen:
            seen.append(token)
    return seen


def enrich(product):
    """Return the taxonomy fields to merge onto a product (additive)."""
    product_kind = classify_product_kind(product)
    return {
        "productKind": product_kind,
        "audience": classify_audience(product),
        "attributes": classify_attributes(product),
        "form": classify_form(product, product_kind),
        "useArea": classify_use_area(product, product_kind),
        "searchTerms": classify_search_terms(product),
    }


# --- related-products ranking ---------------------------------------------

def related_rank_key(target, candidate):
    """Sort key (smaller = more relevant) implementing the recommendation
    priority: same productKind → same category/useArea → same brand → same
    audience → same form → fallback (title). Pure; used by generate_product_pages.

    Every component is 0 when it matches and 1 otherwise, so a plain ascending
    sort yields the documented ordering.
    """
    tk = target.get("productKind") or ""
    ck = candidate.get("productKind") or ""
    kind_match = 0 if (tk and tk == ck) else 1

    same_category = bool(target.get("categoryId")) and target.get("categoryId") == candidate.get("categoryId")
    tu = target.get("useArea") or ""
    cu = candidate.get("useArea") or ""
    same_use_area = bool(tu) and tu == cu
    cat_match = 0 if (same_category or same_use_area) else 1

    same_brand = bool(target.get("brand")) and target.get("brand") == candidate.get("brand")
    brand_match = 0 if same_brand else 1

    ta = target.get("audience") or "unknown"
    ca = candidate.get("audience") or "unknown"
    aud_match = 0 if (ta not in ("", "unknown") and ta == ca) else 1

    tf = target.get("form") or ""
    cf = candidate.get("form") or ""
    form_match = 0 if (bool(tf) and tf == cf) else 1

    return (kind_match, cat_match, brand_match, aud_match, form_match, str(candidate.get("title") or ""))


def rank_related(target, candidates):
    """Return candidates ordered by relevance to target (does not filter)."""
    return sorted(candidates, key=lambda c: related_rank_key(target, c))
