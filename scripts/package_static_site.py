#!/usr/bin/env python3
import argparse
import fnmatch
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = Path("/private/tmp/globalmarket-static-build")

ROOT_FILES = [
    "index.html",
    "app.js",
    "styles.css",
    "privacy.html",
    "404.html",
    "site.webmanifest",
    "_headers",
    "sitemap.xml",
    "robots.txt",
]

DATA_FILES = [
    "public-catalog.json",
    "site-config.json",
    "search-synonyms.json",
    "product-pages.json",
    "landing-pages.json",
]

ASSET_EXCLUDES = {
    "document_inbox",
    "product_sources",
    "telegram_inbox",
    "telegram_uploads",
}


def copy_file(src, dst):
    if not src.exists():
        raise FileNotFoundError(src)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copy_tree(src, dst, exclude_names=None, exclude_globs=None):
    exclude_names = exclude_names or set()
    exclude_globs = exclude_globs or set()
    if not src.exists():
        raise FileNotFoundError(src)
    if dst.exists():
        shutil.rmtree(dst)

    def ignore(_, names):
        dropped = set()
        for name in names:
            if name in exclude_names or name == ".DS_Store":
                dropped.add(name)
            elif any(fnmatch.fnmatch(name, pattern) for pattern in exclude_globs):
                dropped.add(name)
        return dropped

    shutil.copytree(src, dst, ignore=ignore)


def count_files(path):
    return sum(1 for item in path.rglob("*") if item.is_file())


def main():
    parser = argparse.ArgumentParser(description="Package the public static storefront into a clean deploy directory.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output directory. Default: /private/tmp/globalmarket-static-build")
    parser.add_argument("--include-reports", action="store_true", help="Include lightweight markdown reports for preview QA.")
    parser.add_argument("--skip-build", action="store_true", help="Skip running scripts/build_static_site.py before packaging.")
    args = parser.parse_args()

    output = Path(args.output).expanduser()
    if not output.is_absolute():
        output = (ROOT / output).resolve()

    if not args.skip_build:
        subprocess.run(["python3", "scripts/build_static_site.py"], cwd=ROOT, check=True)

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    for name in ROOT_FILES:
        copy_file(ROOT / name, output / name)

    data_output = output / "data"
    for name in DATA_FILES:
        copy_file(ROOT / "data" / name, data_output / name)

    copy_tree(ROOT / "assets", output / "assets", exclude_names=ASSET_EXCLUDES)
    copy_tree(ROOT / "product", output / "product")
    copy_tree(ROOT / "catalog", output / "catalog")
    copy_tree(ROOT / "category", output / "category")
    copy_tree(ROOT / "collection", output / "collection")
    copy_tree(ROOT / "brand", output / "brand")

    # Cloudflare Pages Functions: ship functions/ so /api/* routes deploy.
    # Exclude tests/specs and dotfiles — only runtime handlers should ship.
    if (ROOT / "functions").exists():
        copy_tree(
            ROOT / "functions",
            output / "functions",
            exclude_globs={"*.test.*", "*.spec.*", "__tests__"},
        )

    # Admin orders page (static; gated at runtime by Supabase auth + RLS).
    # Ship index.html + admin.js (+ admin/config.js if the owner created it).
    # Never ship the *.example.* template.
    if (ROOT / "admin").exists():
        copy_tree(
            ROOT / "admin",
            output / "admin",
            exclude_globs={"*.example.*"},
        )

    if args.include_reports:
        reports_output = output / "outputs"
        for name in (
            "site-config-report.md",
            "product-pages-report.md",
            "landing-pages-report.md",
            "landing-pages-validation-report.md",
            "catalog-index-report.md",
            "search-synonyms-report.md",
            "product-pages-validation-report.md",
            "structured-data-report.md",
            "internal-links-report.md",
            "build-manifest.json",
            "project-stage-report.md",
        ):
            copy_file(ROOT / "outputs" / name, reports_output / name)

    verify_command = ["python3", "scripts/verify_static_package.py", "--package", str(output)]
    if args.include_reports:
        verify_command.append("--require-reports")
    subprocess.run(verify_command, cwd=ROOT, check=True)

    print(f"Package: {output}")
    print(f"Files: {count_files(output)}")
    print("Included: root public files, data/public-catalog.json, data/site-config.json, data/search-synonyms.json, assets, product pages, Cloudflare Pages functions (tests excluded)")
    if args.include_reports:
        print("Included reports: outputs/site-config-report.md, outputs/product-pages-report.md, outputs/landing-pages-report.md, outputs/landing-pages-validation-report.md, outputs/catalog-index-report.md, outputs/search-synonyms-report.md, outputs/product-pages-validation-report.md, outputs/structured-data-report.md, outputs/internal-links-report.md, outputs/build-manifest.json, outputs/project-stage-report.md")


if __name__ == "__main__":
    main()
