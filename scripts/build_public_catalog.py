#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "catalog.json"
TARGET = ROOT / "data" / "public-catalog.json"

PUBLIC_SETTINGS = {
    "default_registered_discount_percent",
    "free_delivery_threshold_kgs",
    "manager_whatsapp",
}

PUBLIC_PRODUCT_FIELDS = [
    "unit",
    "badge",
    "restockedAt",
    "retailPriceKgs",
    "category",
    "categoryId",
    "collections",
    "collectionLabels",
    "galleryImages",
    "status",
    "id",
    "tones",
    "image",
    "icon",
    "registeredPriceKgs",
    "description",
    "title",
    "productType",
    "brand",
    "rating",
    "discountPercent",
    "originalPriceKgs",
]


def compact_search_text(product):
    parts = [
        product.get("title"),
        product.get("category"),
        product.get("brand"),
        product.get("productType"),
        product.get("description"),
    ]
    return " ".join(str(part) for part in parts if part).lower()


def main():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    public = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "settings": {
            key: value
            for key, value in source.get("settings", {}).items()
            if key in PUBLIC_SETTINGS
        },
        "categories": source.get("categories", []),
        "products": [],
    }

    for product in source.get("products", []):
        item = {
            key: product.get(key)
            for key in PUBLIC_PRODUCT_FIELDS
            if key in product
        }
        item["searchText"] = compact_search_text(product)
        public["products"].append(item)

    TARGET.write_text(
        json.dumps(public, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {TARGET.relative_to(ROOT)} with {len(public['products'])} products")


if __name__ == "__main__":
    main()
