#!/usr/bin/env python3
import argparse
import html as html_lib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LANDING_PAGES_PATH = ROOT / "data" / "landing-pages.json"
REPORT_PATH = ROOT / "outputs" / "landing-pages-validation-report.md"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(value):
    return re.sub(r"\s+", " ", str(value or "").lower().replace("ё", "е")).strip()


def extract_meta_description(html):
    match = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html, re.I)
    return html_lib.unescape(match.group(1)) if match else ""


def validate_page(page):
    errors = []
    warnings = []
    path = ROOT / page["path"].strip("/") / "index.html"
    if not path.is_file():
        return {
            "path": page.get("path", ""),
            "terms": len(page.get("seoTerms") or []),
            "errors": [f"missing page file: {page.get('path', '')}"],
            "warnings": [],
        }

    html = path.read_text(encoding="utf-8")
    text_norm = normalize(html_lib.unescape(re.sub(r"<[^>]+>", " ", html)))
    description = normalize(extract_meta_description(html))
    title = page.get("title") or ""

    if normalize(title) not in text_norm:
        errors.append("missing expected H1")
    if '<link rel="canonical"' not in html:
        errors.append("missing canonical link")
    if not description:
        errors.append("missing meta description")
    if "application/ld+json" not in html:
        errors.append("missing JSON-LD")
    if page.get("count", 0) > 0 and 'class="landing-card"' not in html and 'class="landing-empty"' not in html:
        warnings.append("page has products but no rendered product cards or catalog fallback")
    if page.get("count", 0) > 0 and 'class="landing-related-links"' not in html:
        warnings.append("page has products but no contextual landing links")

    seo_terms = page.get("seoTerms") or []
    for term in seo_terms:
        term_norm = normalize(term)
        if term_norm and term_norm not in text_norm:
            errors.append(f"SEO term missing from visible page text: {term}")

    for term in seo_terms[:4]:
        term_norm = normalize(term)
        if term_norm and term_norm not in description:
            warnings.append(f"SEO term missing from meta description: {term}")

    return {
        "path": page["path"],
        "terms": len(seo_terms),
        "errors": errors,
        "warnings": warnings,
    }


def validate():
    manifest = load_json(LANDING_PAGES_PATH)
    pages = manifest.get("pages") or []
    results = [validate_page(page) for page in pages]
    manifest_errors = []
    if manifest.get("count") != len(pages):
        manifest_errors.append(f"landing-pages count mismatch: {manifest.get('count')} != {len(pages)}")
    return results, manifest_errors


def write_report(results, manifest_errors, report_path):
    error_count = len(manifest_errors) + sum(len(item["errors"]) for item in results)
    warning_count = sum(len(item["warnings"]) for item in results)
    lines = [
        "# Landing Pages Validation Report",
        "",
        f"Pages: `{len(results)}`",
        f"Errors: `{error_count}`",
        f"Warnings: `{warning_count}`",
        "",
        "| Page | SEO terms | Status |",
        "|---|---:|---|",
    ]
    for item in results:
        status = "ERROR" if item["errors"] else ("WARN" if item["warnings"] else "OK")
        lines.append(f"| `{item['path']}` | {item['terms']} | {status} |")

    if manifest_errors or error_count or warning_count:
        lines.extend(["", "## Details", ""])
        for error in manifest_errors:
            lines.append(f"- ERROR: {error}")
        for item in results:
            for error in item["errors"]:
                lines.append(f"- ERROR `{item['path']}`: {error}")
            for warning in item["warnings"]:
                lines.append(f"- WARN `{item['path']}`: {warning}")

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Validate generated category/collection landing pages.")
    parser.add_argument("--report", default=str(REPORT_PATH), help="Markdown report path.")
    args = parser.parse_args()

    report_path = Path(args.report).expanduser()
    if not report_path.is_absolute():
        report_path = (ROOT / report_path).resolve()

    results, manifest_errors = validate()
    write_report(results, manifest_errors, report_path)
    error_count = len(manifest_errors) + sum(len(item["errors"]) for item in results)
    warning_count = sum(len(item["warnings"]) for item in results)
    print(f"Landing pages validation report: {report_path.relative_to(ROOT)}")
    print(f"Pages: {len(results)}")
    print(f"Errors: {error_count}")
    print(f"Warnings: {warning_count}")
    if error_count:
        for error in manifest_errors:
            print(f"- {error}", file=sys.stderr)
        for item in results:
            for error in item["errors"]:
                print(f"- {item['path']}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
