#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


STEPS = [
    ("Validate site config", ["python3", "scripts/validate_site_config.py"]),
    ("Sync layout partials", ["python3", "scripts/sync_layout_partials.py"]),
    ("Generate product pages", ["python3", "scripts/generate_product_pages.py", "--all", "--report"]),
    ("Generate landing pages", ["python3", "scripts/generate_landing_pages.py", "--report"]),
    ("Generate catalog index", ["python3", "scripts/generate_catalog_index.py", "--report"]),
    ("Validate landing pages", ["python3", "scripts/validate_landing_pages.py"]),
    ("Validate search synonyms", ["python3", "scripts/validate_search_synonyms.py"]),
    ("Validate product pages", ["python3", "scripts/validate_product_pages.py"]),
    ("Validate structured data", ["python3", "scripts/validate_structured_data.py"]),
    ("Generate sitemap", ["python3", "scripts/generate_sitemap.py"]),
    ("Validate internal links", ["python3", "scripts/validate_internal_links.py"]),
    ("Generate build manifest", ["python3", "scripts/generate_build_manifest.py"]),
    ("Generate project stage report", ["python3", "scripts/generate_project_stage_report.py"]),
    ("Verify product galleries", ["python3", "scripts/verify_product_galleries.py"]),
    ("Check app.js syntax", ["node", "--check", "app.js"]),
    (
        "Check Python syntax",
        [
            "python3",
            "-m",
            "py_compile",
            "scripts/generate_product_pages.py",
            "scripts/generate_landing_pages.py",
            "scripts/generate_catalog_index.py",
            "scripts/sync_layout_partials.py",
            "scripts/validate_site_config.py",
            "scripts/validate_product_pages.py",
            "scripts/validate_landing_pages.py",
            "scripts/validate_search_synonyms.py",
            "scripts/validate_structured_data.py",
            "scripts/validate_internal_links.py",
            "scripts/generate_build_manifest.py",
            "scripts/generate_project_stage_report.py",
            "scripts/generate_sitemap.py",
        ],
    ),
]


def run_step(title, command):
    print(f"\n== {title} ==")
    result = subprocess.run(command, cwd=ROOT)
    if result.returncode:
        return result.returncode
    return 0


def main():
    for title, command in STEPS:
        code = run_step(title, command)
        if code:
            print(f"\nBuild failed at: {title}", file=sys.stderr)
            return code
    print("\nBuild OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
