#!/usr/bin/env python3
"""Install one consent-aware Google tag block on every public storefront page."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HEAD_PARTIAL = ROOT / "partials" / "analytics-head.html"
CONSENT_PARTIAL = ROOT / "partials" / "analytics-consent.html"
HEAD_START = "<!-- BEGIN shared-analytics-head -->"
HEAD_END = "<!-- END shared-analytics-head -->"
CONSENT_START = "<!-- BEGIN shared-analytics-consent -->"
CONSENT_END = "<!-- END shared-analytics-consent -->"


def marked(start: str, content: str, end: str) -> str:
    return f"{start}\n{content.strip()}\n{end}"


def strip_marked(text: str, start: str, end: str) -> str:
    return re.sub(
        rf"\s*{re.escape(start)}.*?{re.escape(end)}\s*",
        "\n",
        text,
        flags=re.S,
    )


def public_pages() -> list[Path]:
    pages = [ROOT / "index.html", ROOT / "privacy.html", ROOT / "delivery-and-returns" / "index.html"]
    pages.extend((ROOT / "catalog").glob("*/index.html"))
    if (ROOT / "catalog" / "index.html").exists():
        pages.append(ROOT / "catalog" / "index.html")
    for dirname in ("category", "collection", "brand", "product"):
        pages.extend((ROOT / dirname).glob("*/index.html"))
    return sorted(set(path for path in pages if path.exists()))


def install(path: Path, head: str, consent: str) -> None:
    text = path.read_text(encoding="utf-8")
    text = strip_marked(text, HEAD_START, HEAD_END)
    text = strip_marked(text, CONSENT_START, CONSENT_END)
    if "gmk-google-tag-loader" in text or "gmk_google_consent_v1" in text:
        raise RuntimeError(f"Unmanaged Google instrumentation remains in {path.relative_to(ROOT)}")
    if "</head>" not in text or "</body>" not in text:
        raise RuntimeError(f"Page has no complete HTML shell: {path.relative_to(ROOT)}")
    text = text.replace("</head>", f"  {head}\n</head>", 1)
    text = text.replace("</body>", f"  {consent}\n</body>", 1)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    head = marked(HEAD_START, HEAD_PARTIAL.read_text(encoding="utf-8"), HEAD_END)
    consent = marked(CONSENT_START, CONSENT_PARTIAL.read_text(encoding="utf-8"), CONSENT_END)
    pages = public_pages()
    for path in pages:
        install(path, head, consent)
    print(f"Installed consent-aware analytics on {len(pages)} public pages")


if __name__ == "__main__":
    main()
