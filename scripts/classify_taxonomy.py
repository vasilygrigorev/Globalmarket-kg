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


# --- productKind -----------------------------------------------------------

def classify_product_kind(product):
    """Return a fine-grained product kind, or "" when it can't be told."""
    cid = (product.get("categoryId") or "").lower()
    t = _text(product)

    if cid == "perfume":
        return "perfume_decant"

    if cid == "laundry":
        brand = (product.get("brand") or "").lower()
        softener_brand = _has(brand, "downy", "lenor", "vernel", "silan", "cocoon")
        # Order matters: capsules and softener before the generic powder/gel.
        if _has(t, "капсул", "capsule", "tabs", "подушечк"):
            return "laundry_capsules"
        if softener_brand or _has(t, "кондиционер для бель", "ополаскиват", "softener", "для белья"):
            return "fabric_softener"
        if _has(t, "гель для стирк", "жидк", "liquid", "gel"):
            return "laundry_gel"
        if _has(t, "порош", "powder"):
            return "washing_powder"
        return ""

    if cid == "hair":
        if _has(t, "шампун", "shampoo"):
            return "shampoo"
        if _has(t, "маск", "mask"):
            return "hair_mask"
        if _has(t, "кондиционер", "бальзам", "conditioner"):
            return "conditioner"
        return ""

    if cid == "shaving":
        if _has(t, "кассет", "запаск", "сменн", "cartridge", "refill"):
            return "blade_cartridge"
        if _has(t, "гель для брит", "shaving gel", "shave gel"):
            return "shaving_gel"
        if _has(t, "пена для брит", "shaving foam", "shave foam", "мусс для брит"):
            return "shaving_foam"
        if _has(t, "станок", "станк", "razor", "бритв"):
            return "razor"
        return ""

    if cid == "body":
        # Sunscreen titles are often abbreviated (SPF only, no "крем"/"лосьон"
        # word), so check it before shower_gel/body_lotion to avoid misreads.
        if _has(t, "spf", "солнцезащ", "sunscreen", "sunblock"):
            return "sunscreen"
        if _has(t, "гель для душ", "shower gel"):
            return "shower_gel"
        if _has(t, "пена для ванн", "bath foam", "для ванны"):
            return "bath_foam"
        if _has(t, "лосьон", "молочко для тела", "body lotion", "lotion"):
            return "body_lotion"
        if _has(t, "мыло", "soap"):
            return "soap"
        return ""

    if cid == "deodorants":
        if _has(t, "спрей", "аэрозол", "spray"):
            return "deodorant_spray"
        if _has(t, "стик", "карандаш", "stick"):
            return "deodorant_stick"
        if _has(t, "ролик", "шарик", "roll-on", "rollon", "roll on"):
            return "deodorant_rollon"
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
    "hair": "hair",
    "body": "body",
    "oral": "oral",
    "deodorants": "deodorants",
    "shaving": "shaving",
    "perfume": "perfume",
    "home_cleaning": "home_cleaning",
    "food": "food",
}


def classify_use_area(product, product_kind=None):
    """Return the practical-use area for search/recommendation grouping.

    Derived from categoryId, with one override: within home_cleaning,
    dishwashing liquid gets its own "dishes" area so it doesn't cluster with
    toilet/surface cleaners in "похожие товары" or search scoring.
    """
    kind = product_kind if product_kind is not None else classify_product_kind(product)
    cid = (product.get("categoryId") or "").lower()
    if cid == "home_cleaning" and kind == "dishwashing_liquid":
        return "dishes"
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
