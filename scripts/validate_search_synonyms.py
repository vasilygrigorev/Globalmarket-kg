#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "outputs" / "search-synonyms-report.md"

DEFAULT_QUERIES = [
    "мыло",
    "порошок",
    "мыло порошок",
    "Айна",
    "Германия",
    "гель для стирки",
    "запаски",
    "кассеты",
    "станки",
    "лезвия",
    "бритье",
    "пена для бритья",
    "гель для бритья",
    "дезик",
    "део",
    "стик",
    "Сергей",
    "мыломойка",
    "таблетки",
    "капсулы",
    "посудомойка",
    "стиральная машина",
]


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(value):
    text = str(value or "").replace("ё", "е").lower()
    text = re.sub(r"[.,;:!?()[\]{}\"']", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def product_text(product):
    parts = [
        product.get("title"),
        product.get("category"),
        product.get("categoryId"),
        product.get("brand"),
        product.get("productType"),
        product.get("description"),
        product.get("searchText"),
        *(product.get("collections") or []),
    ]
    return normalize(" ".join(str(part or "") for part in parts))


def validate_synonyms_shape(synonyms):
    errors = []
    warnings = []
    groups = synonyms.get("groups")
    if not isinstance(groups, list) or not groups:
        errors.append("search-synonyms.json must contain a non-empty `groups` list.")
        return errors, warnings

    seen_ids = set()
    for index, group in enumerate(groups, start=1):
        if not isinstance(group, dict):
            errors.append(f"Group {index} must be an object.")
            continue
        group_id = group.get("id")
        if not group_id:
            errors.append(f"Group {index} is missing `id`.")
        elif group_id in seen_ids:
            errors.append(f"Duplicate group id: {group_id}")
        else:
            seen_ids.add(group_id)

        aliases = group.get("aliases") or []
        terms = group.get("terms") or []
        landing_terms = group.get("landingTerms") or []
        if not isinstance(aliases, list):
            errors.append(f"Group `{group_id or index}` aliases must be a list.")
        if not isinstance(terms, list):
            errors.append(f"Group `{group_id or index}` terms must be a list.")
        if not isinstance(landing_terms, list):
            errors.append(f"Group `{group_id or index}` landingTerms must be a list.")
        if not aliases and not terms:
            errors.append(f"Group `{group_id or index}` has no aliases or terms.")
        if aliases and not terms and not group.get("categories") and not group.get("categoryIds") and not group.get("collections") and not group.get("brands"):
            warnings.append(f"Group `{group_id or index}` has aliases but no product targeting hints.")

    ignored = synonyms.get("ignoredDraftTerms", [])
    if ignored and not isinstance(ignored, list):
        errors.append("ignoredDraftTerms must be a list when present.")
    return errors, warnings


def group_matches_query(group, normalized_query):
    aliases = [normalize(alias) for alias in group.get("aliases") or []]
    return any(alias and alias in normalized_query for alias in aliases)


def product_matches_group(product, group, text):
    categories = group.get("categories") or []
    category_ids = group.get("categoryIds") or []
    collections = group.get("collections") or []
    brands = group.get("brands") or []
    terms = [normalize(term) for term in group.get("terms") or []]

    if product.get("category") in categories:
        return True
    if product.get("categoryId") in category_ids:
        return True
    if any(collection in collections for collection in product.get("collections") or []):
        return True
    if any(normalize(product.get("brand")) == normalize(brand) for brand in brands):
        return True
    return any(term and term in text for term in terms)


def product_matches_query(product, query, groups, ignored_terms):
    normalized_query = normalize(query)
    if not normalized_query:
        return True
    if normalized_query in ignored_terms:
        return False

    text = product_text(product)
    if normalized_query in text:
        return True

    query_terms = [term for term in normalized_query.split(" ") if term]
    if len(query_terms) > 1 and all(term in text for term in query_terms):
        return True

    return any(
        group_matches_query(group, normalized_query) and product_matches_group(product, group, text)
        for group in groups
    )


def find_matches(products, query, groups, ignored_terms):
    return [
        product
        for product in products
        if product.get("inStock") is not False and product_matches_query(product, query, groups, ignored_terms)
    ]


def report_row(values):
    return "| " + " | ".join(str(value).replace("|", "\\|") for value in values) + " |"


def build_report(catalog, synonyms, queries, shape_errors, shape_warnings):
    products = catalog.get("products") or []
    groups = synonyms.get("groups") or []
    ignored_terms = {normalize(term) for term in synonyms.get("ignoredDraftTerms") or []}
    rows = []
    errors = list(shape_errors)
    warnings = list(shape_warnings)

    for query in queries:
        normalized_query = normalize(query)
        matches = find_matches(products, query, groups, ignored_terms)
        first = matches[0].get("title", "") if matches else ""
        if normalized_query in ignored_terms:
            status = "ignored"
        elif matches:
            status = "ok"
            if len(matches) > 150:
                status = "wide"
                warnings.append(f"Query `{query}` is very broad: {len(matches)} matches.")
        else:
            status = "missing"
            errors.append(f"Query `{query}` returned 0 matches.")
        rows.append((query, len(matches), first or "—", status))

    lines = [
        "# Search Synonyms QA",
        "",
        f"Products checked: {len(products)}",
        f"Synonym groups: {len(groups)}",
        f"Queries checked: {len(queries)}",
        "",
        "## Query Results",
        "",
        report_row(["Query", "Matches", "First result", "Status"]),
        report_row(["---", "---:", "---", "---"]),
    ]
    lines.extend(report_row(row) for row in rows)

    lines.extend(["", "## Warnings", ""])
    if warnings:
        lines.extend(f"- {warning}" for warning in warnings)
    else:
        lines.append("- none")

    lines.extend(["", "## Errors", ""])
    if errors:
        lines.extend(f"- {error}" for error in errors)
    else:
        lines.append("- none")

    return "\n".join(lines) + "\n", errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Validate Global Market KG search synonyms against the public catalog.")
    parser.add_argument("--catalog", default=str(ROOT / "data" / "public-catalog.json"), help="Public catalog JSON path.")
    parser.add_argument("--synonyms", default=str(ROOT / "data" / "search-synonyms.json"), help="Search synonyms JSON path.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Markdown report path.")
    parser.add_argument("--query", action="append", dest="queries", help="Extra query to validate. Can be repeated.")
    args = parser.parse_args()

    catalog = load_json(Path(args.catalog))
    synonyms = load_json(Path(args.synonyms))
    queries = DEFAULT_QUERIES + (args.queries or [])
    shape_errors, shape_warnings = validate_synonyms_shape(synonyms)
    report, errors, warnings = build_report(catalog, synonyms, queries, shape_errors, shape_warnings)

    output = Path(args.output).expanduser()
    if not output.is_absolute():
        output = (ROOT / output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(report, encoding="utf-8")

    print(f"Search synonyms report: {output}")
    print(f"Queries: {len(queries)}")
    print(f"Warnings: {len(warnings)}")
    print(f"Errors: {len(errors)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
