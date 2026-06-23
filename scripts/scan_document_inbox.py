#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "data" / "document_scan_state.json"
REPORT_PATH = ROOT / "outputs" / "document_inbox_report.md"
EXTRACT_ROOT = ROOT / "assets" / "document_inbox" / "extracted"
SUPPORTED_EXTENSIONS = {".zip", ".mxl", ".xls", ".xlsx", ".csv"}
IMPORTABLE_STOCK_EXTENSIONS = {".mxl", ".xls"}

sys.path.insert(0, str(ROOT / "scripts"))
from import_stock import read_stock  # noqa: E402


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


def is_supported(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS


def find_supported_files(root: Path, max_depth: int) -> list[Path]:
    root = root.expanduser()
    if max_depth < 1:
        return [path for path in root.iterdir() if is_supported(path)]
    files: list[Path] = []
    base_depth = len(root.parts)
    for path in root.rglob("*"):
        if len(path.parts) - base_depth > max_depth:
            continue
        if is_supported(path):
            files.append(path)
    return sorted(files, key=lambda item: (item.stat().st_mtime, str(item)))


def analyze_stock_file(path: Path) -> dict[str, Any]:
    try:
        data = read_stock(path)
    except Exception as exc:
        return {
            "kind": "stock_export",
            "importable": path.suffix.lower() in IMPORTABLE_STOCK_EXTENSIONS,
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        }
    products = data.get("products", [])
    return {
        "kind": "stock_export",
        "importable": path.suffix.lower() in IMPORTABLE_STOCK_EXTENSIONS,
        "ok": True,
        "stock_date": data.get("stock_date"),
        "warehouse": data.get("warehouse"),
        "products": len(products),
        "hidden_by_rule": data.get("hidden_by_rule_count", 0),
        "warnings": data.get("warnings", [])[:3],
    }


def extract_zip_candidates(path: Path, file_hash: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    target_dir = EXTRACT_ROOT / f"{path.stem}-{file_hash[:10]}"
    try:
        with zipfile.ZipFile(path) as archive:
            names = [name for name in archive.namelist() if not name.endswith("/")]
            for name in names:
                suffix = Path(name).suffix.lower()
                if suffix not in SUPPORTED_EXTENSIONS - {".zip"}:
                    continue
                safe_name = Path(name).name
                target_dir.mkdir(parents=True, exist_ok=True)
                target = target_dir / safe_name
                with archive.open(name) as source, target.open("wb") as handle:
                    handle.write(source.read())
                item = {
                    "path": str(target),
                    "name": safe_name,
                    "extension": suffix,
                    "source_zip": str(path),
                }
                if suffix in IMPORTABLE_STOCK_EXTENSIONS:
                    item["analysis"] = analyze_stock_file(target)
                else:
                    item["analysis"] = {"kind": "table_or_data_file", "importable": False, "ok": True}
                results.append(item)
    except Exception as exc:
        results.append(
            {
                "path": str(path),
                "name": path.name,
                "extension": ".zip",
                "analysis": {"kind": "zip", "ok": False, "error": f"{type(exc).__name__}: {exc}"},
            }
        )
    return results


def analyze_file(path: Path, file_hash: str) -> dict[str, Any]:
    suffix = path.suffix.lower()
    result: dict[str, Any] = {
        "path": str(path),
        "name": path.name,
        "extension": suffix,
        "size": path.stat().st_size,
        "modified_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
        "sha1": file_hash,
    }
    if suffix == ".zip":
        result["analysis"] = {"kind": "zip", "ok": True}
        result["children"] = extract_zip_candidates(path, file_hash)
    elif suffix in IMPORTABLE_STOCK_EXTENSIONS:
        result["analysis"] = analyze_stock_file(path)
    else:
        result["analysis"] = {"kind": "table_or_data_file", "importable": False, "ok": True}
    return result


def render_report(items: list[dict[str, Any]], scan_root: Path) -> str:
    lines = [
        "# Document Inbox Report",
        "",
        f"Scanned: {datetime.now(timezone.utc).isoformat()}",
        f"Root: `{scan_root}`",
        "",
    ]
    if not items:
        lines.append("Новых поддерживаемых файлов не найдено.")
        return "\n".join(lines) + "\n"

    for index, item in enumerate(items, start=1):
        analysis = item.get("analysis", {})
        lines.append(f"## {index}. {item['name']}")
        lines.append(f"- Path: `{item['path']}`")
        lines.append(f"- Type: `{analysis.get('kind', item.get('extension'))}`")
        lines.append(f"- OK: `{analysis.get('ok', True)}`")
        if analysis.get("stock_date") or analysis.get("products") is not None:
            lines.append(f"- Stock date: `{analysis.get('stock_date')}`")
            lines.append(f"- Warehouse: `{analysis.get('warehouse')}`")
            lines.append(f"- Products: `{analysis.get('products')}`")
            lines.append(f"- Hidden by rule: `{analysis.get('hidden_by_rule', 0)}`")
            lines.append(f"- Can import after confirmation: `{analysis.get('importable', False)}`")
        if analysis.get("error"):
            lines.append(f"- Error: `{analysis['error']}`")
        for child in item.get("children", []):
            child_analysis = child.get("analysis", {})
            lines.append(f"  - ZIP item: `{child['name']}`")
            lines.append(f"    - Extracted: `{child['path']}`")
            lines.append(f"    - Type: `{child_analysis.get('kind')}`")
            lines.append(f"    - OK: `{child_analysis.get('ok', True)}`")
            if child_analysis.get("products") is not None:
                lines.append(f"    - Products: `{child_analysis.get('products')}`")
                lines.append(f"    - Can import after confirmation: `{child_analysis.get('importable', False)}`")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan Documents for new store-related exports without changing the store.")
    parser.add_argument("--root", default="/Users/macmini/Documents", help="Folder to scan.")
    parser.add_argument("--max-depth", type=int, default=2, help="Maximum folder depth under root.")
    parser.add_argument("--all", action="store_true", help="Re-analyze already seen files.")
    args = parser.parse_args()

    scan_root = Path(args.root).expanduser()
    state = load_state()
    known = state.setdefault("files", {})
    new_items: list[dict[str, Any]] = []

    for path in find_supported_files(scan_root, args.max_depth):
        file_hash = sha1_file(path)
        key = str(path)
        if not args.all and known.get(key, {}).get("sha1") == file_hash:
            continue
        item = analyze_file(path, file_hash)
        new_items.append(item)
        known[key] = {
            "sha1": file_hash,
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "name": path.name,
            "extension": path.suffix.lower(),
        }

    state["last_scan_at"] = datetime.now(timezone.utc).isoformat()
    state["last_scan_root"] = str(scan_root)
    save_state(state)

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    report = render_report(new_items, scan_root)
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(
        json.dumps(
            {
                "scan_root": str(scan_root),
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
