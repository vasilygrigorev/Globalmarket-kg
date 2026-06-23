#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PHOTO_ROOT = Path("/Users/macmini/shopfoto2")
STATE_PATH = ROOT / "data" / "shop_photo_scan_state.json"
REPORT_PATH = ROOT / "outputs" / "shop_photo_inbox_report.md"
PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}
ARCHIVE_EXTENSIONS = {".zip"}
SUPPORTED_EXTENSIONS = PHOTO_EXTENSIONS | ARCHIVE_EXTENSIONS


def sha1_file(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {"files": {}}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"files": {}}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def find_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(
        [path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS],
        key=lambda item: (item.stat().st_mtime, str(item)),
    )


def analyze_name(path: Path) -> dict[str, Any]:
    name = path.stem.lower()
    hints: list[str] = []
    if any(token in name for token in ["front", "лицо", "pered", "перед"]):
        hints.append("front")
    if any(token in name for token in ["back", "зад", "zad"]):
        hints.append("back")
    for brand in ["clear", "downy", "persil", "ariel", "dove", "rexona", "gillette", "oral", "head", "pantene"]:
        if brand in name:
            hints.append(f"brand:{brand}")
    return {"name_hints": hints}


def render_report(items: list[dict[str, Any]], root: Path) -> str:
    lines = [
        "# Shop Photo Inbox Report",
        "",
        f"Scanned: {datetime.now(timezone.utc).isoformat()}",
        f"Root: `{root}`",
        "",
    ]
    if not items:
        lines.append("Новых фото или ZIP-архивов не найдено.")
        return "\n".join(lines) + "\n"
    for index, item in enumerate(items, start=1):
        lines.append(f"## {index}. {item['name']}")
        lines.append(f"- Path: `{item['path']}`")
        lines.append(f"- Extension: `{item['extension']}`")
        lines.append(f"- Size: `{item['size']}`")
        if item["hints"]:
            lines.append(f"- Hints: `{', '.join(item['hints'])}`")
        lines.append("- Store change: `requires user confirmation`")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan dedicated shop photo folder without changing the store.")
    parser.add_argument("--root", default=str(DEFAULT_PHOTO_ROOT), help="Photo inbox folder.")
    parser.add_argument("--all", action="store_true", help="Re-analyze already seen files.")
    args = parser.parse_args()

    root = Path(args.root).expanduser()
    state = load_state()
    known = state.setdefault("files", {})
    new_items: list[dict[str, Any]] = []

    for path in find_files(root):
        file_hash = sha1_file(path)
        key = str(path)
        if not args.all and known.get(key, {}).get("sha1") == file_hash:
            continue
        hints = analyze_name(path)["name_hints"]
        item = {
            "path": str(path),
            "name": path.name,
            "extension": path.suffix.lower(),
            "size": path.stat().st_size,
            "modified_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
            "sha1": file_hash,
            "hints": hints,
        }
        new_items.append(item)
        known[key] = {
            "sha1": file_hash,
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "name": path.name,
            "extension": path.suffix.lower(),
        }

    state["last_scan_at"] = datetime.now(timezone.utc).isoformat()
    state["last_scan_root"] = str(root)
    save_state(state)

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(render_report(new_items, root), encoding="utf-8")
    print(
        json.dumps(
            {
                "scan_root": str(root),
                "new_files": len(new_items),
                "report_path": str(REPORT_PATH),
                "items": new_items,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
