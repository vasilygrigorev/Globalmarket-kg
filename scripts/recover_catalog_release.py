#!/usr/bin/env python3
"""Rebuild the storefront catalog without destroying curated product data.

The latest 1C-derived master is authoritative only for stock, price and source
fields.  Curated names, descriptions, taxonomy, galleries and stable product
URLs come from the last verified catalog plus explicit overrides.
"""

import argparse
import copy
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from classify_taxonomy import canonical_brand, enrich
from import_stock import CATEGORIES, description_for, detect_brand, product_type


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CURRENT_MASTER = Path(
    "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/catalog-master.json"
)
DEFAULT_BASELINE_RELEASE = Path(
    "/Users/macmini/Library/CloudStorage/Dropbox/CodexProjects/GlobalMarketKG/releases/"
    "2026-10-07-retail-google-ads-recovery-v1"
)

PUBLIC_CATALOG_PATH = ROOT / "data" / "public-catalog.json"
PAGE_CATALOG_PATH = ROOT / "data" / "page-catalog.json"
SLUG_REGISTRY_PATH = ROOT / "data" / "product-slug-registry.json"
PRODUCT_OVERRIDES_PATH = ROOT / "data" / "product_overrides.json"

RAW_TITLE_RE = re.compile(r"^\s*\d+\s*_\s*", re.I)
SERVICE_SOURCE_CODES = {"2322"}
SERVICE_TITLE_RE = re.compile(r"^\s*доставка\s+по\s+городу\s*$", re.I)

# These corrections were approved after the verified baseline but were stored
# directly in the master rather than in product_overrides.json.  Listing them
# explicitly prevents a later raw 1C import from silently changing them again.
CURRENT_TITLE_AUTHORITY_CODES = {
    "2626",  # OMO Sensitive spelling
    "3067",
    "3071",
    "3073",
    "3083",
    "3084",
    "3085",
    "3088",
    "3090",
    "3247",
    "3248",
    "3249",
    "3250",
    "3253",
    "3260",
}

CATEGORY_ALIASES = {
    "hair-care": "hair",
}

CURRENT_PRODUCT_OVERRIDES_BY_CODE = {
    "3260": {
        "brand": "The Pink Stuff",
        "productType": "блок для унитаза",
        "categoryId": "home_cleaning",
        "category": "Уборка и чистота",
        "collections": ["europe"],
        "collectionLabels": ["Европа"],
        "sectionIds": ["bathroom", "home"],
        "sectionLabels": ["Ванная", "Дом и уют"],
    },
}

# Exact owner/audit-approved photo corrections.  These run after merging the
# current master with release history, so a stale master cannot reintroduce a
# raw Telegram path or a gallery whose identity is still under review.
PHOTO_GALLERY_OVERRIDES_BY_CODE = {
    "660": [],  # Fairy Apple: loose trio is held until exact identity is confirmed.
    "2366": [
        "assets/products/concord/concord-kl-6947-card-front.jpg",
        "assets/products/concord/concord-kl-6947-front.jpg",
        "assets/products/concord/concord-kl-6947-back.jpg",
    ],
    "2622": [
        "assets/products/dove/dove-daily-shine-680ml-card-front.jpg",
        "assets/products/dove/dove-daily-shine-680ml-front.jpg",
        "assets/products/dove/dove-daily-shine-680ml-back.jpg",
    ],
}

PRESENTATION_FIELDS = {
    "title",
    "description",
    "brand",
    "productType",
    "unit",
    "category",
    "categoryId",
    "collections",
    "collectionLabels",
    "sectionIds",
    "sectionLabels",
    "productKind",
    "useArea",
    "form",
    "audience",
    "attributes",
    "tones",
    "icon",
    "badge",
    "rating",
    "searchTerms",
}

PUBLIC_FIELDS = {
    "id",
    "sourceCode",
    "title",
    "description",
    "brand",
    "productType",
    "unit",
    "category",
    "categoryId",
    "collections",
    "collectionLabels",
    "sectionIds",
    "sectionLabels",
    "productKind",
    "useArea",
    "form",
    "audience",
    "attributes",
    "tones",
    "icon",
    "badge",
    "rating",
    "galleryImages",
    "image",
    "status",
    "inStock",
    "retailPriceKgs",
    "registeredPriceKgs",
    "discountPercent",
    "originalPriceKgs",
    "firstSeenAt",
    "restockedAt",
    "freshArrival",
    "freshArrivalRank",
    "searchTerms",
    "searchText",
    # Rewritten from the append-only slug registry during the static build.
    "productPagePath",
}

CATEGORY_TITLES = {key: value["title"] for key, value in CATEGORIES.items()}


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_code(product):
    value = product.get("sourceCode")
    return str(value).strip() if value not in (None, "") else ""


def identity_key(product):
    code = source_code(product)
    return f"source:{code}" if code else f"id:{product.get('id')}"


def clean_import_title(value):
    value = RAW_TITLE_RE.sub("", str(value or "").strip())
    return re.sub(r"\s+", " ", value).strip(" _-")


def is_service_product(product):
    return source_code(product) in SERVICE_SOURCE_CODES or bool(
        SERVICE_TITLE_RE.match(str(product.get("title") or product.get("sourceName1C") or ""))
    )


def is_active(product):
    return product.get("status") == "active" and product.get("inStock") is not False


def has_real_photo(product):
    return bool(product.get("galleryImages") or product.get("image"))


def merge_presentation(current, baseline):
    result = copy.deepcopy(current)
    if baseline:
        for field in PRESENTATION_FIELDS:
            if field in baseline and baseline.get(field) not in (None, "", []):
                result[field] = copy.deepcopy(baseline[field])

        # A photo path is durable catalog data.  The latest approved gallery
        # wins, but a stock refresh is never allowed to erase an older gallery.
        if not has_real_photo(current) and has_real_photo(baseline):
            result["galleryImages"] = copy.deepcopy(baseline.get("galleryImages") or [])
            result["image"] = baseline.get("image") or result["galleryImages"][0]

    code = source_code(current)
    if code in CURRENT_TITLE_AUTHORITY_CODES and not RAW_TITLE_RE.match(str(current.get("title") or "")):
        result["title"] = current.get("title")
        if current.get("description"):
            result["description"] = current.get("description")

    # Always retain a newer non-empty approved gallery, including the latest
    # Petya mappings.  Similar-looking photos are never inferred here.
    if has_real_photo(current):
        result["galleryImages"] = copy.deepcopy(current.get("galleryImages") or [])
        result["image"] = current.get("image") or result["galleryImages"][0]

    return result


def repair_new_product(product):
    result = copy.deepcopy(product)
    raw_title = str(result.get("title") or result.get("sourceName1C") or result.get("name1C") or "")
    clean_title = clean_import_title(raw_title)
    if clean_title:
        result["title"] = clean_title

    brand = str(result.get("brand") or "").strip()
    if not brand or brand == "_" or brand.isdigit():
        result["brand"] = detect_brand(clean_title)

    category_id = result.get("categoryId") or "other"
    lower = clean_title.lower()
    if "dr.beckmann" in lower and any(token in lower for token in ("backofen", "ofen", "oven", "clean")):
        category_id = "home_cleaning"
    elif result.get("brand") == "Vanish" and category_id == "home_cleaning":
        category_id = "laundry"
    result["categoryId"] = category_id
    result["category"] = CATEGORY_TITLES.get(category_id, result.get("category") or "Разное")

    current_type = str(result.get("productType") or "").strip()
    if not current_type or current_type in {"разное", "уборка и чистота", "стирка и уход за бельем"}:
        result["productType"] = product_type(clean_title, category_id)

    description = str(result.get("description") or "").strip()
    if not description or description.startswith("_:") or RAW_TITLE_RE.search(description):
        result["description"] = description_for(
            clean_title,
            category_id,
            result.get("brand") or "Товар",
            result.get("productType") or "товар",
        )
    return result


def apply_explicit_override(product, override):
    if not override:
        return product
    result = copy.deepcopy(product)
    mapping = {
        "clean_title": "title",
        "description": "description",
        "brand": "brand",
        "product_type": "productType",
        "unit": "unit",
        "galleryImages": "galleryImages",
        "image": "image",
        "badge": "badge",
    }
    for source, target in mapping.items():
        if source in override and override.get(source) not in (None, "", []):
            result[target] = copy.deepcopy(override[source])
    if override.get("category_id"):
        category_id = CATEGORY_ALIASES.get(override["category_id"], override["category_id"])
        result["categoryId"] = category_id
        result["category"] = CATEGORY_TITLES.get(category_id, result.get("category"))
    return result


def finalize_product(product):
    result = copy.deepcopy(product)
    code_override = CURRENT_PRODUCT_OVERRIDES_BY_CODE.get(source_code(result), {})
    result.update(copy.deepcopy(code_override))
    result["categoryId"] = CATEGORY_ALIASES.get(result.get("categoryId"), result.get("categoryId"))
    if result.get("categoryId") in CATEGORY_TITLES:
        result["category"] = CATEGORY_TITLES[result["categoryId"]]
    result["title"] = clean_import_title(result.get("title"))
    result["brand"] = canonical_brand(result)
    result["status"] = "active" if is_active(product) else "inactive"
    result["inStock"] = result["status"] == "active"
    code = source_code(result)
    if code in PHOTO_GALLERY_OVERRIDES_BY_CODE:
        gallery = copy.deepcopy(PHOTO_GALLERY_OVERRIDES_BY_CODE[code])
        result["galleryImages"] = gallery
        result["image"] = gallery[0] if gallery else ""
    if result.get("galleryImages"):
        result["image"] = result.get("image") or result["galleryImages"][0]
    elif result.get("image"):
        result["galleryImages"] = [result["image"]]

    result.update(enrich(result))
    search_parts = [
        result.get("title"),
        result.get("brand"),
        result.get("productType"),
        result.get("category"),
        result.get("description"),
        result.get("sourceName1C"),
        result.get("sourceRawName1C"),
    ]
    result["searchText"] = " ".join(str(value) for value in search_parts if value).lower()
    return result


def build_slug_registry(previous_site, baseline_products):
    by_id = {}
    by_source_code = {}
    baseline_by_id = {product.get("id"): product for product in baseline_products}
    for page in sorted((previous_site / "product").glob("*/index.html")):
        html = page.read_text(encoding="utf-8", errors="ignore")
        match = re.search(r'"sku"\s*:\s*"([^"]+)"', html)
        if not match:
            continue
        product_id = match.group(1)
        slug = page.parent.name
        by_id[product_id] = slug
        product = baseline_by_id.get(product_id)
        if product and source_code(product):
            by_source_code[source_code(product)] = slug
    return {
        "schemaVersion": 1,
        "source": str(previous_site),
        "byId": dict(sorted(by_id.items())),
        "bySourceCode": dict(sorted(by_source_code.items(), key=lambda item: item[0])),
    }


def category_rows(products, baseline_public):
    previous = {item["id"]: item for item in baseline_public.get("categories") or []}
    ordered_ids = list(previous)
    for product in products:
        category_id = product.get("categoryId") or "other"
        if category_id not in ordered_ids:
            ordered_ids.append(category_id)
    rows = []
    for category_id in ordered_ids:
        count = sum(1 for product in products if product.get("categoryId") == category_id)
        if not count:
            continue
        prior = previous.get(category_id, {})
        rows.append(
            {
                "id": category_id,
                "title": CATEGORY_TITLES.get(category_id, prior.get("title") or category_id),
                "count": count,
                "icon": prior.get("icon") or CATEGORIES.get(category_id, CATEGORIES["other"])["icon"],
            }
        )
    return rows


def public_product(product):
    return {key: copy.deepcopy(product[key]) for key in PUBLIC_FIELDS if key in product}


def main():
    parser = argparse.ArgumentParser(description="Recover a full retail catalog by joining 1C state to curated history.")
    parser.add_argument("--current-master", default=str(DEFAULT_CURRENT_MASTER))
    parser.add_argument("--baseline-release", default=str(DEFAULT_BASELINE_RELEASE))
    parser.add_argument("--master-output", help="Optional recovered full master output path.")
    args = parser.parse_args()

    baseline_release = Path(args.baseline_release).expanduser().resolve()
    current_master = load_json(Path(args.current_master).expanduser().resolve())
    baseline_master = load_json(baseline_release / "inventory" / "catalog-master-after.json")
    baseline_public = load_json(baseline_release / "site" / "data" / "public-catalog.json")
    overrides = load_json(PRODUCT_OVERRIDES_PATH) if PRODUCT_OVERRIDES_PATH.exists() else {}

    baseline_by_key = {identity_key(product): product for product in baseline_master.get("products") or []}
    recovered = []
    for current in current_master.get("products") or []:
        baseline = baseline_by_key.get(identity_key(current))
        product = merge_presentation(current, baseline)
        if baseline is None:
            product = repair_new_product(product)
        product = apply_explicit_override(product, overrides.get(product.get("id")))
        product = finalize_product(product)
        recovered.append(product)

    public_products = [
        public_product(product)
        for product in recovered
        if is_active(product) and not is_service_product(product)
    ]
    page_products = [product for product in recovered if not is_service_product(product)]

    settings = copy.deepcopy(baseline_public.get("settings") or {})
    settings["free_delivery_threshold_kgs"] = 5000
    settings.setdefault("default_registered_discount_percent", 3)
    generated_at = datetime.now(timezone.utc).isoformat()
    public_catalog = {
        "generatedAt": generated_at,
        "latestStockDate": current_master.get("latestStockDate"),
        "settings": settings,
        "categories": category_rows(public_products, baseline_public),
        "products": public_products,
    }
    page_catalog = {
        "generatedAt": generated_at,
        "latestStockDate": current_master.get("latestStockDate"),
        "settings": settings,
        "categories": category_rows(public_products, baseline_public),
        "products": page_products,
    }
    slug_registry = build_slug_registry(baseline_release / "site", baseline_master.get("products") or [])

    write_json(PUBLIC_CATALOG_PATH, public_catalog)
    write_json(PAGE_CATALOG_PATH, page_catalog)
    write_json(SLUG_REGISTRY_PATH, slug_registry)

    recovered_master = copy.deepcopy(current_master)
    recovered_master["updatedAt"] = generated_at
    recovered_master["sourceRelease"] = "20261011-retail-recovery-v2"
    recovered_master["products"] = recovered
    recovered_master["stats"] = {
        "productRecords": len(recovered),
        "active1CRecords": sum(1 for product in recovered if source_code(product) and is_active(product)),
        "inactive1CRecords": sum(1 for product in recovered if source_code(product) and not is_active(product)),
        "publicProducts": len(public_products),
        "picturedProducts": sum(has_real_photo(product) for product in recovered),
    }
    if args.master_output:
        write_json(Path(args.master_output).expanduser().resolve(), recovered_master)

    raw_public = [product for product in public_products if RAW_TITLE_RE.match(str(product.get("title") or ""))]
    print(f"Recovered master records: {len(recovered)}")
    print(f"Public in-stock products: {len(public_products)}")
    print(f"Historical page candidates: {len(page_products)}")
    print(f"Products with photos: {sum(has_real_photo(product) for product in recovered)}")
    print(f"Stable legacy slugs: {len(slug_registry['byId'])}")
    print(f"Raw code-prefixed public titles: {len(raw_public)}")
    if raw_public:
        raise SystemExit("Recovery left raw code-prefixed titles in the public catalog")


if __name__ == "__main__":
    main()
