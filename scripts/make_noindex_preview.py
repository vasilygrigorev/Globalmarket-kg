#!/usr/bin/env python3
"""Copy a production package and make the copy impossible to index."""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path


ROBOTS_META = '<meta name="robots" content="noindex,nofollow,noarchive" />'
ROBOTS_RE = re.compile(
    r'<meta\s+name=["\']robots["\'][^>]*>',
    flags=re.IGNORECASE,
)


def protect_html(path: Path) -> None:
    source = path.read_text(encoding="utf-8")
    if ROBOTS_RE.search(source):
        protected = ROBOTS_RE.sub(ROBOTS_META, source, count=1)
    else:
        protected, replacements = re.subn(
            r"<head([^>]*)>",
            rf"<head\1>\n    {ROBOTS_META}",
            source,
            count=1,
            flags=re.IGNORECASE,
        )
        if replacements != 1:
            raise RuntimeError(f"HTML page has no <head>: {path}")
    path.write_text(protected, encoding="utf-8")


def protect_headers(path: Path) -> None:
    source = path.read_text(encoding="utf-8")
    if "X-Robots-Tag:" in source:
        source = re.sub(
            r"(?im)^\s*X-Robots-Tag:.*$",
            "  X-Robots-Tag: noindex, nofollow, noarchive",
            source,
            count=1,
        )
    else:
        source = source.replace(
            "/*\n",
            "/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n",
            1,
        )
    path.write_text(source, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a preview-only copy with HTTP, HTML, and robots noindex protection."
    )
    parser.add_argument("source", type=Path, help="Verified production package")
    parser.add_argument("destination", type=Path, help="New preview package directory")
    args = parser.parse_args()

    source = args.source.resolve()
    destination = args.destination.resolve()
    if not source.is_dir():
        raise SystemExit(f"Source package does not exist: {source}")
    if destination.exists():
        raise SystemExit(f"Destination already exists: {destination}")
    if not (source / "_headers").is_file():
        raise SystemExit(f"Source package has no _headers: {source}")

    shutil.copytree(source, destination)
    protect_headers(destination / "_headers")
    (destination / "robots.txt").write_text(
        "User-agent: *\nDisallow: /\n",
        encoding="utf-8",
    )

    html_paths = sorted(destination.rglob("*.html"))
    for html_path in html_paths:
        protect_html(html_path)

    missing = [
        path
        for path in html_paths
        if "noindex,nofollow,noarchive" not in path.read_text(encoding="utf-8")
    ]
    if missing:
        raise SystemExit(f"Preview protection missing from {len(missing)} HTML files")

    print(f"Preview package OK: {destination}")
    print(f"Protected HTML pages: {len(html_paths)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
