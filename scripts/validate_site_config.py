#!/usr/bin/env python3
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "site-config.json"
CATALOG_PATH = ROOT / "data" / "public-catalog.json"
REPORT_PATH = ROOT / "outputs" / "site-config-report.md"
GENERATED_LOCAL_PATHS = {
    "/catalog",
    "/catalog/",
}


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def path_exists(url_path):
    if not url_path or not url_path.startswith("/"):
        return False
    if url_path in GENERATED_LOCAL_PATHS:
        return True
    return (ROOT / url_path.lstrip("/")).exists()


def parse_local_href(href):
    if not href:
        return {}
    parsed = urlparse(href)
    return {key: values[-1] for key, values in parse_qs(parsed.query).items() if values}


def text_blob(product):
    return " ".join(
        str(product.get(key, ""))
        for key in ("title", "category", "brand", "productType", "description", "searchText")
    ).lower()


def product_matches(product, params):
    if product.get("inStock") is False:
        return False
    if params.get("category") and product.get("category") != params["category"]:
        return False
    if params.get("audience") and product.get("audience") != params["audience"]:
        return False
    if params.get("collection") and params["collection"] not in (product.get("collections") or []):
        return False
    query = (params.get("query") or params.get("q") or "").strip().lower()
    if query and query not in text_blob(product):
        return False
    return True


def item_is_active(item, now=None):
    now = now or datetime.now(timezone.utc)
    if item.get("active") is False:
        return False
    for field, should_be_after in (("startsAt", False), ("endsAt", True)):
        value = item.get(field)
        if not value:
            continue
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            continue
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        if should_be_after and moment < now:
            return False
        if not should_be_after and moment > now:
            return False
    return True


def count_matches(products, item):
    params = parse_local_href(item.get("href", ""))
    if item.get("category") and "category" not in params:
        params["category"] = item["category"]
    if item.get("audience") and "audience" not in params:
        params["audience"] = item["audience"]
    if item.get("collection") and "collection" not in params:
        params["collection"] = item["collection"]
    if item.get("query") and "query" not in params:
        params["query"] = item["query"]
    if not any(params.get(key) for key in ("category", "audience", "collection", "query", "q")):
        return None
    return sum(1 for product in products if product_matches(product, params))


def validate_link_item(section, index, item, products, warnings, errors):
    label = item.get("label") or item.get("title") or f"#{index + 1}"
    if item.get("image") and not path_exists(item["image"]):
        errors.append(f"{section} `{label}`: image not found: `{item['image']}`")
    href = item.get("href", "")
    if href and href.startswith("/") and "#" not in href and "?" not in href and not path_exists(href):
        warnings.append(f"{section} `{label}`: local href target not found on disk: `{href}`")
    matches = count_matches(products, item)
    if matches == 0:
        errors.append(f"{section} `{label}`: target resolves to 0 active products")
    return label, matches


def validate_orders_api(config, errors):
    """Guard the checkout backend flag so a bad edit can't silently break go-live."""
    block = config.get("ordersApi")
    if block is None:
        return  # optional block
    if not isinstance(block, dict):
        errors.append("ordersApi must be an object")
        return
    if "enabled" in block and not isinstance(block["enabled"], bool):
        errors.append("ordersApi.enabled must be a boolean (true/false, not a string)")
    endpoint = block.get("endpoint")
    if endpoint is not None:
        if not isinstance(endpoint, str) or not endpoint.startswith("/"):
            errors.append("ordersApi.endpoint must be a local path string starting with '/'")


def main():
    config = load_json(CONFIG_PATH)
    catalog = load_json(CATALOG_PATH)
    products = catalog.get("products", [])
    warnings = []
    errors = []
    rows = []

    validate_orders_api(config, errors)

    for section in ("banners", "quickCategories", "menu"):
        for index, item in enumerate(config.get(section, [])):
            label, matches = validate_link_item(section, index, item, products, warnings, errors)
            if section == "banners" and not item_is_active(item):
                continue
            rows.append((section, label, item.get("href") or item.get("category") or item.get("collection") or "", matches))

    for index, item in enumerate(config.get("footerLinks", [])):
        label = item.get("label") or f"#{index + 1}"
        href = item.get("href", "")
        if href.startswith("/") and "#" not in href and "?" not in href and not path_exists(href):
            errors.append(f"footerLinks `{label}`: target not found: `{href}`")

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    report = [
        "# Site Config Report",
        "",
        f"- Config: `{CONFIG_PATH.relative_to(ROOT)}`",
        f"- Products: `{len(products)}`",
        f"- Errors: `{len(errors)}`",
        f"- Warnings: `{len(warnings)}`",
        "",
        "## Link Targets",
        "",
        "| Section | Label | Target | Active products |",
        "|---|---|---|---:|",
    ]
    for section, label, target, matches in rows:
        report.append(f"| {section} | {label} | `{target}` | {'' if matches is None else matches} |")

    if errors:
        report.extend(["", "## Errors", ""])
        report.extend(f"- {error}" for error in errors)
    if warnings:
        report.extend(["", "## Warnings", ""])
        report.extend(f"- {warning}" for warning in warnings)

    REPORT_PATH.write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"Report: {REPORT_PATH.relative_to(ROOT)}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
