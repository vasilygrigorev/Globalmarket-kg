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
    "ариель",
    "ariel",
    "ариэл",
    "клир",
    "clear",
    "шампунь",
    "гель душ",
    "зубная паста",
    "щетка",
    "зубная щетка",
    "spf",
    "солнцезащитка",
]

# Required queries where "there is a match" is not enough — the FIRST/best
# ranked result must have a specific productKind or brand. Regression guard
# for the reported bug class: "дезик"/"део"/"стик" must never lead with a
# sunscreen just because both happen to say "spray" somewhere.
RANKING_EXPECTATIONS = [
    {"query": "ариель", "expected_brand": "Ariel"},
    {"query": "ariel", "expected_brand": "Ariel"},
    {"query": "ариэл", "expected_brand": "Ariel"},
    {"query": "клир", "expected_brand": "Clear"},
    {"query": "clear", "expected_brand": "Clear"},
    {"query": "порошок", "expected_kinds": ["washing_powder"]},
    {"query": "гель для стирки", "expected_kinds": ["laundry_gel"]},
    {"query": "капсулы", "expected_kinds": ["laundry_capsules"]},
    {"query": "шампунь", "expected_kinds": ["shampoo"]},
    {"query": "дезик", "expected_kinds": ["deodorant_stick", "deodorant_spray", "deodorant_rollon"], "forbidden_kinds": ["sunscreen"]},
    {"query": "део", "expected_kinds": ["deodorant_stick", "deodorant_spray", "deodorant_rollon"], "forbidden_kinds": ["sunscreen"]},
    {"query": "стик", "expected_kinds": ["deodorant_stick"], "forbidden_kinds": ["sunscreen"]},
    {"query": "гель душ", "expected_kinds": ["shower_gel"]},
    {"query": "пена для бритья", "expected_kinds": ["shaving_foam"]},
    {"query": "гель для бритья", "expected_kinds": ["shaving_gel"]},
    {"query": "станки", "expected_kinds": ["razor"]},
    {"query": "станок", "expected_kinds": ["razor"]},
    {"query": "запаски", "expected_kinds": ["blade_cartridge"]},
    {"query": "кассеты", "expected_kinds": ["blade_cartridge"]},
    {"query": "лезвия", "expected_kinds": ["blade_cartridge"]},
    {"query": "зубная паста", "expected_kinds": ["toothpaste"]},
    {"query": "щетка", "expected_kinds": ["toothbrush"]},
    {"query": "зубная щетка", "expected_kinds": ["toothbrush"]},
    {"query": "spf", "expected_kinds": ["sunscreen"]},
    {"query": "солнцезащитка", "expected_kinds": ["sunscreen"]},
    {"query": "мыломойка", "expected_kinds": ["dishwashing_liquid"]},
    {"query": "посудомойка", "expected_kinds": ["dishwashing_liquid"]},
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


def resolve_brand_from_query(normalized_query, brand_aliases):
    """Mirrors resolveBrandFromQuery() in app.js — keep both in sync."""
    query_tokens = [term for term in normalized_query.split(" ") if term]
    for canonical_brand, aliases in (brand_aliases or {}).items():
        candidates = [normalize(canonical_brand)] + [normalize(alias) for alias in aliases or []]
        for alias in candidates:
            if not alias:
                continue
            if normalized_query == alias:
                return canonical_brand
            if " " not in alias and alias in query_tokens:
                return canonical_brand
            if " " in alias and alias in normalized_query:
                return canonical_brand
    return ""


def product_matches_query(product, query, groups, ignored_terms, brand_aliases=None):
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

    expected_brand = resolve_brand_from_query(normalized_query, brand_aliases)
    if expected_brand and normalize(product.get("brand")) == normalize(expected_brand):
        return True

    return any(
        group_matches_query(group, normalized_query) and product_matches_group(product, group, text)
        for group in groups
    )


def resolve_expected_kinds(matched_groups, normalized_query):
    """Mirrors resolveExpectedKinds() in app.js — keep both in sync."""
    kinds = set()
    for group in matched_groups:
        alias_kinds = group.get("aliasKinds") or {}
        used_alias_kind = False
        for alias, kind_list in alias_kinds.items():
            if normalize(alias) and normalize(alias) in normalized_query:
                kinds.update(kind_list or [])
                used_alias_kind = True
        if not used_alias_kind:
            kinds.update(group.get("productKinds") or [])
    return kinds


def search_relevance_score(product, normalized_query, expected_kinds, expected_category_ids, expected_categories, expected_brand):
    """Mirrors searchRelevanceScore() in app.js — keep both in sync."""
    norm_title = normalize(product.get("title"))
    norm_brand = normalize(product.get("brand"))
    score = 0

    if norm_title == normalized_query:
        score += 1000
    elif norm_title.startswith(f"{normalized_query} "):
        score += 400

    if expected_brand and norm_brand == normalize(expected_brand):
        score += 500
    elif norm_brand == normalized_query:
        score += 500

    title_tokens = [t for t in norm_title.split(" ") if t]
    if normalized_query in title_tokens:
        score += 150

    if expected_kinds and product.get("productKind") and product.get("productKind") in expected_kinds:
        score += 300

    if expected_category_ids and product.get("categoryId") in expected_category_ids:
        score += 120
    elif expected_categories and product.get("category") in expected_categories:
        score += 120

    if product.get("image") or product.get("galleryImages"):
        score += 8
    if product.get("status") == "active":
        score += 5

    norm_product_type = normalize(product.get("productType"))
    if normalized_query in norm_title or normalized_query in norm_brand or normalized_query in norm_product_type:
        score += 60
    elif any(normalize(term) == normalized_query for term in product.get("searchTerms") or []):
        score += 40
    else:
        score += 5

    return score


def rank_matches(products, query, groups, brand_aliases):
    normalized_query = normalize(query)
    matched_groups = [group for group in groups if group_matches_query(group, normalized_query)]
    expected_kinds = resolve_expected_kinds(matched_groups, normalized_query)
    expected_category_ids = {cid for group in matched_groups for cid in (group.get("categoryIds") or [])}
    expected_categories = {cat for group in matched_groups for cat in (group.get("categories") or [])}
    expected_brand = resolve_brand_from_query(normalized_query, brand_aliases)

    def sort_key(product):
        return -search_relevance_score(
            product, normalized_query, expected_kinds, expected_category_ids, expected_categories, expected_brand
        )

    return sorted(products, key=sort_key)


def check_ranking_expectations(products, synonyms, expectations):
    """Not just 'there is a match' — the top-ranked result(s) must have the
    expected productKind/brand. Returns a list of error strings."""
    groups = synonyms.get("groups") or []
    brand_aliases = synonyms.get("brandAliases") or {}
    ignored_terms = {normalize(term) for term in synonyms.get("ignoredDraftTerms") or []}
    errors = []

    for expectation in expectations:
        query = expectation["query"]
        matches = find_matches(products, query, groups, ignored_terms, brand_aliases)
        if not matches:
            errors.append(f"Ranking check `{query}`: no matches at all.")
            continue
        ranked = rank_matches(matches, query, groups, brand_aliases)
        top = ranked[0]

        expected_brand = expectation.get("expected_brand")
        if expected_brand and normalize(top.get("brand")) != normalize(expected_brand):
            errors.append(
                f"Ranking check `{query}`: expected top result brand `{expected_brand}`, got "
                f"`{top.get('brand')}` ({top.get('title')})."
            )

        expected_kinds = expectation.get("expected_kinds")
        if expected_kinds and top.get("productKind") not in expected_kinds:
            errors.append(
                f"Ranking check `{query}`: expected top result productKind in {expected_kinds}, got "
                f"`{top.get('productKind')}` ({top.get('title')})."
            )

        forbidden_kinds = expectation.get("forbidden_kinds")
        if forbidden_kinds:
            top_n = ranked[:5]
            leaked = [p for p in top_n if p.get("productKind") in forbidden_kinds]
            if leaked:
                errors.append(
                    f"Ranking check `{query}`: forbidden productKind {leaked[0].get('productKind')} "
                    f"leaked into top results ({leaked[0].get('title')})."
                )

    return errors


def find_matches(products, query, groups, ignored_terms, brand_aliases=None):
    return [
        product
        for product in products
        if product.get("inStock") is not False
        and product_matches_query(product, query, groups, ignored_terms, brand_aliases)
    ]


def report_row(values):
    return "| " + " | ".join(str(value).replace("|", "\\|") for value in values) + " |"


def build_report(catalog, synonyms, queries, shape_errors, shape_warnings):
    products = catalog.get("products") or []
    groups = synonyms.get("groups") or []
    brand_aliases = synonyms.get("brandAliases") or {}
    ignored_terms = {normalize(term) for term in synonyms.get("ignoredDraftTerms") or []}
    rows = []
    errors = list(shape_errors)
    warnings = list(shape_warnings)

    for query in queries:
        normalized_query = normalize(query)
        matches = find_matches(products, query, groups, ignored_terms, brand_aliases)
        ranked = rank_matches(matches, query, groups, brand_aliases) if matches else matches
        first = ranked[0].get("title", "") if ranked else ""
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

    errors.extend(check_ranking_expectations(products, synonyms, RANKING_EXPECTATIONS))

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

    ranking_errors = [e for e in errors if e.startswith("Ranking check")]
    lines.extend(["", "## Ranking Checks", "", f"Checked: {len(RANKING_EXPECTATIONS)}", f"Failed: {len(ranking_errors)}"])

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
