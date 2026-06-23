#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "outputs" / "structured-data-report.md"


def extract_json_ld(html):
    return re.findall(r'<script\s+type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S)


def json_ld_types(data):
    if isinstance(data, dict) and "@graph" in data and isinstance(data["@graph"], list):
        return [item.get("@type") for item in data["@graph"] if isinstance(item, dict)]
    if isinstance(data, dict):
        return [data.get("@type")]
    if isinstance(data, list):
        return [item.get("@type") for item in data if isinstance(item, dict)]
    return []


def validate_file(path):
    html = path.read_text(encoding="utf-8")
    raw_blocks = extract_json_ld(html)
    errors = []
    types = []

    if not raw_blocks:
        errors.append("missing JSON-LD")
    for index, raw in enumerate(raw_blocks, start=1):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            errors.append(f"invalid JSON-LD block {index}: {exc}")
            continue
        types.extend(item for item in json_ld_types(data) if item)

    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        for required in ("Organization", "WebSite"):
            if required not in types:
                errors.append(f"homepage missing {required} JSON-LD")
    elif rel == "catalog/index.html":
        if "ItemList" not in types:
            errors.append("catalog index missing ItemList JSON-LD")
    elif rel.startswith("category/") or rel.startswith("collection/") or rel.startswith("brand/"):
        for required in ("BreadcrumbList", "ItemList"):
            if required not in types:
                errors.append(f"landing page missing {required} JSON-LD")
    elif rel.startswith("product/"):
        for required in ("Product", "BreadcrumbList"):
            if required not in types:
                errors.append(f"product page missing {required} JSON-LD")

    return {"path": rel, "blocks": len(raw_blocks), "types": types, "errors": errors}


def validate():
    pages = [
        ROOT / "index.html",
        ROOT / "catalog" / "index.html",
        *sorted((ROOT / "category").glob("*/index.html")),
        *sorted((ROOT / "collection").glob("*/index.html")),
        *sorted((ROOT / "brand").glob("*/index.html")),
        *sorted((ROOT / "product").glob("*/index.html")),
    ]
    return [validate_file(path) for path in pages if path.is_file()]


def write_report(results, report_path):
    error_count = sum(len(item["errors"]) for item in results)
    lines = [
        "# Structured Data Report",
        "",
        f"Pages: `{len(results)}`",
        f"Errors: `{error_count}`",
        "",
        "| Page | Blocks | Types | Status |",
        "|---|---:|---|---|",
    ]
    for item in results:
        status = "ERROR" if item["errors"] else "OK"
        types = ", ".join(str(value) for value in item["types"]) or "-"
        lines.append(f"| `{item['path']}` | {item['blocks']} | {types} | {status} |")
    problem_items = [item for item in results if item["errors"]]
    if problem_items:
        lines.extend(["", "## Details", ""])
        for item in problem_items:
            lines.append(f"### `{item['path']}`")
            lines.extend(f"- ERROR: {error}" for error in item["errors"])
            lines.append("")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Validate JSON-LD structured data in static storefront pages.")
    parser.add_argument("--report", default=str(REPORT_PATH), help="Markdown report path.")
    args = parser.parse_args()

    report_path = Path(args.report).expanduser()
    if not report_path.is_absolute():
        report_path = (ROOT / report_path).resolve()
    results = validate()
    write_report(results, report_path)
    error_count = sum(len(item["errors"]) for item in results)
    print(f"Structured data report: {report_path.relative_to(ROOT)}")
    print(f"Pages: {len(results)}")
    print(f"Errors: {error_count}")
    if error_count:
        for item in results:
            for error in item["errors"]:
                print(f"- {item['path']}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
