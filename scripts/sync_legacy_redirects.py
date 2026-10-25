#!/usr/bin/env python3
"""Synchronize append-only product URL aliases into Cloudflare redirects."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ALIAS_PATH = ROOT / "data" / "product-url-aliases.json"
PRODUCT_PAGES_PATH = ROOT / "data" / "product-pages.json"
REDIRECTS_PATH = ROOT / "_redirects"
BEGIN = "# BEGIN generated product URL aliases"
END = "# END generated product URL aliases"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def validated_aliases():
    registry = load_json(ALIAS_PATH)
    current_paths = {
        str(page.get("path") or "").strip()
        for page in load_json(PRODUCT_PAGES_PATH).get("pages") or []
        if page.get("path")
    }
    aliases = []
    seen = {}
    errors = []
    for row in registry.get("aliases") or []:
        source = str(row.get("from") or "").strip()
        target = str(row.get("to") or "").strip()
        if not source.startswith("/product/") or not source.endswith("/"):
            errors.append(f"invalid alias source: {source!r}")
        if not target.startswith("/product/") or not target.endswith("/"):
            errors.append(f"invalid alias target: {target!r}")
        if source == target:
            errors.append(f"self redirect: {source}")
        if source in current_paths:
            errors.append(f"alias shadows a generated product page: {source}")
        if target not in current_paths:
            errors.append(f"alias target is not a current product page: {source} -> {target}")
        if source in seen and seen[source] != target:
            errors.append(f"conflicting alias: {source} -> {seen[source]} / {target}")
        seen[source] = target
    for source, target in sorted(seen.items()):
        aliases.append((source, target))
    if errors:
        raise SystemExit("Legacy redirect validation failed:\n- " + "\n- ".join(errors))
    return aliases


def replace_generated_block(text, generated_lines):
    lines = text.splitlines()
    begin_positions = [index for index, line in enumerate(lines) if line.strip() == BEGIN]
    end_positions = [index for index, line in enumerate(lines) if line.strip() == END]
    if len(begin_positions) != len(end_positions) or len(begin_positions) > 1:
        raise SystemExit("Malformed generated redirect marker block")
    if begin_positions:
        start, finish = begin_positions[0], end_positions[0]
        if finish < start:
            raise SystemExit("Malformed generated redirect marker order")
        del lines[start:finish + 1]
    while lines and not lines[-1].strip():
        lines.pop()
    if lines:
        lines.append("")
    lines.extend([BEGIN, *generated_lines, END])
    return "\n".join(lines) + "\n"


def main():
    aliases = validated_aliases()
    original = REDIRECTS_PATH.read_text(encoding="utf-8") if REDIRECTS_PATH.exists() else ""
    generated = [f"{source} {target} 301" for source, target in aliases]
    updated = replace_generated_block(original, generated)
    REDIRECTS_PATH.write_text(updated, encoding="utf-8")
    print(f"Legacy product redirects: {len(aliases)}")


if __name__ == "__main__":
    main()
