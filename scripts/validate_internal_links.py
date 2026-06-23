#!/usr/bin/env python3
import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "outputs" / "internal-links-report.md"
HTML_GLOBS = (
    "index.html",
    "catalog/index.html",
    "privacy.html",
    "category/*/index.html",
    "collection/*/index.html",
    "brand/*/index.html",
    "product/*/index.html",
)
IGNORED_SCHEMES = {
    "data",
    "http",
    "https",
    "javascript",
    "mailto",
    "sms",
    "tel",
    "whatsapp",
}


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attr in ("href", "src"):
            value = attrs.get(attr)
            if value:
                self.links.append((tag, attr, value))
        srcset = attrs.get("srcset")
        if srcset:
            for value in parse_srcset(srcset):
                self.links.append((tag, "srcset", value))


def parse_srcset(value):
    items = []
    for part in value.split(","):
        url = part.strip().split(" ", 1)[0].strip()
        if url:
            items.append(url)
    return items


def html_files():
    files = []
    for pattern in HTML_GLOBS:
        files.extend(ROOT.glob(pattern))
    return sorted({path.resolve() for path in files if path.is_file()})


def should_ignore(raw_url):
    raw_url = raw_url.strip()
    if not raw_url or raw_url.startswith("#") or raw_url.startswith("//"):
        return True
    parsed = urlparse(raw_url)
    return parsed.scheme.lower() in IGNORED_SCHEMES


def resolve_target(page_path, raw_url):
    parsed = urlparse(raw_url.strip())
    path = parsed.path
    if not path:
        return ROOT / "index.html"

    if path.startswith("/"):
        relative = path.lstrip("/")
        if not relative:
            return ROOT / "index.html"
        target = ROOT / relative
    else:
        target = page_path.parent / path

    target = target.resolve()
    if raw_url.endswith("/") or path.endswith("/"):
        return target / "index.html"
    if not target.suffix and target.is_dir():
        return target / "index.html"
    return target


def is_local_target_allowed(target):
    try:
        target.relative_to(ROOT)
    except ValueError:
        return False
    return True


def parse_links(path):
    parser = LinkParser()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    return parser.links


def validate():
    pages = html_files()
    errors = []
    warnings = []
    checked = 0
    ignored = 0

    for page in pages:
        for tag, attr, raw_url in parse_links(page):
            if should_ignore(raw_url):
                ignored += 1
                continue
            target = resolve_target(page, raw_url)
            if not is_local_target_allowed(target):
                rel_page = page.relative_to(ROOT).as_posix()
                errors.append(f"{rel_page}: {tag}[{attr}] escapes project root: {raw_url}")
                continue
            checked += 1
            if not target.is_file():
                rel_page = page.relative_to(ROOT).as_posix()
                rel_target = target.relative_to(ROOT).as_posix() if is_local_target_allowed(target) else str(target)
                errors.append(f"{rel_page}: missing {tag}[{attr}] `{raw_url}` -> `{rel_target}`")

    return {
        "pages": len(pages),
        "checked": checked,
        "ignored": ignored,
        "errors": errors,
        "warnings": warnings,
    }


def write_report(result, report_path):
    report_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Internal Links Report",
        "",
        f"HTML pages: {result['pages']}",
        f"Local links checked: {result['checked']}",
        f"External/hash/data links ignored: {result['ignored']}",
        f"Errors: {len(result['errors'])}",
        f"Warnings: {len(result['warnings'])}",
        "",
    ]
    if result["errors"]:
        lines.append("## Errors")
        lines.append("")
        lines.extend(f"- {item}" for item in result["errors"])
        lines.append("")
    if result["warnings"]:
        lines.append("## Warnings")
        lines.append("")
        lines.extend(f"- {item}" for item in result["warnings"])
        lines.append("")
    if not result["errors"] and not result["warnings"]:
        lines.append("No broken local links or local image references found.")
        lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Validate local href/src references in storefront HTML.")
    parser.add_argument("--report", default=str(DEFAULT_REPORT), help="Markdown report path.")
    args = parser.parse_args()

    result = validate()
    report_path = Path(args.report).expanduser()
    if not report_path.is_absolute():
        report_path = (ROOT / report_path).resolve()
    write_report(result, report_path)

    print(f"Internal link report: {report_path}")
    print(f"HTML pages: {result['pages']}")
    print(f"Local links checked: {result['checked']}")
    print(f"Errors: {len(result['errors'])}")
    if result["errors"]:
        for error in result["errors"][:30]:
            print(f"- {error}", file=sys.stderr)
        if len(result["errors"]) > 30:
            print(f"- ... {len(result['errors']) - 30} more", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
