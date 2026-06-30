#!/usr/bin/env python3
"""Run the safe local verification suite for the backend/admin MVP.

This script does not require Supabase, Cloudflare env vars, network access, or
real secrets. It verifies the code that can be checked locally before the
privileged go-live steps.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PACKAGE = Path("/private/tmp/globalmarket-static-build")


def run_step(title, command, env=None):
    print(f"\n== {title} ==")
    result = subprocess.run(command, cwd=ROOT, env=env)
    if result.returncode:
        print(f"\nVerification failed at: {title}", file=sys.stderr)
        return result.returncode
    return 0


def main():
    parser = argparse.ArgumentParser(description="Verify Global Market KG backend/admin MVP locally.")
    parser.add_argument(
        "--skip-package",
        action="store_true",
        help="Skip static package build/verify when only quick backend/admin checks are needed.",
    )
    parser.add_argument(
        "--package",
        default=str(DEFAULT_PACKAGE),
        help="Package directory used by package_static_site.py. Default: /private/tmp/globalmarket-static-build",
    )
    args = parser.parse_args()

    package = Path(args.package).expanduser()
    if not package.is_absolute():
        package = (ROOT / package).resolve()

    env = os.environ.copy()
    env.setdefault("PYTHONPYCACHEPREFIX", "/private/tmp/pycache-globalmarket")

    steps = [
        (
            "Node tests: orders API + admin helpers/DOM + checkout contract",
            [
                "node",
                "--test",
                "functions/api/orders.test.mjs",
                "functions/api/orders.integration.test.mjs",
                "admin/admin.logic.test.mjs",
                "admin/admin.dom.test.mjs",
                "tests/checkout.contract.test.mjs",
                "tests/rollback.contract.test.mjs",
                "tests/runner-coverage.test.mjs",
                "tests/docs-consistency.test.mjs",
                "tests/category-tiles.test.mjs",
                "tests/header-menu.test.mjs",
                "tests/storefront-layout.test.mjs",
                "tests/product-pages.test.mjs",
                "tests/shared-layout.test.mjs",
                "tests/search-categories.test.mjs",
                "tests/banner-carousel.test.mjs",
                "tests/product-consistency.test.mjs",
                "tests/gallery-completeness.test.mjs",
                "tests/home-cards-checkout.test.mjs",
                "tests/seo-consistency.test.mjs",
                "tests/home-seo.test.mjs",
                "tests/robots-sitemap.test.mjs",
                "tests/headers-manifest.test.mjs",
            ],
        ),
        ("Check admin/admin.js syntax", ["node", "--check", "admin/admin.js"]),
        ("Check admin/admin.logic.js syntax", ["node", "--check", "admin/admin.logic.js"]),
        ("Check orders smoke script syntax", ["node", "--check", "scripts/smoke_orders_api.mjs"]),
        (
            "Check Python syntax for backend/admin verification scripts",
            [
                sys.executable,
                "-m",
                "py_compile",
                "scripts/check_no_secrets.py",
                "scripts/check_backend_env_shape.py",
                "scripts/validate_site_config.py",
                "scripts/package_static_site.py",
                "scripts/verify_static_package.py",
                "scripts/verify_backend_mvp.py",
            ],
        ),
        ("Secret scan: git-tracked files", [sys.executable, "scripts/check_no_secrets.py"]),
        # Informational: reports env/config shape (no values printed). Fails only
        # on a real leak (service_role in admin/config.js), not on missing env,
        # so it stays green before go-live.
        ("Backend env/config shape (informational)", [sys.executable, "scripts/check_backend_env_shape.py"]),
    ]

    if not args.skip_package:
        steps.extend([
            (
                "Build and verify static package",
                [
                    sys.executable,
                    "scripts/package_static_site.py",
                    "--include-reports",
                    "--output",
                    str(package),
                ],
            ),
            (
                "Secret scan: static package",
                [sys.executable, "scripts/check_no_secrets.py", "--package", str(package)],
            ),
        ])

    for title, command in steps:
        code = run_step(title, command, env=env)
        if code:
            return code

    print("\nBackend/admin MVP verification OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
