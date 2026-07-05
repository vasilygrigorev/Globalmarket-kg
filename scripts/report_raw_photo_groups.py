#!/usr/bin/env python3
"""Triage loose raw Petya photo files directly under assets/products/.

Read-only, no network, never deletes or moves files. Groups loose files by
their filename prefix (stripping a trailing -card-front/-front/-back
suffix) and reports whether each group is a complete 3-photo set, or an
incomplete 1/2-photo group that still needs manual identification.

Incomplete groups are cross-checked against docs/pending-photo-review.md so
already-triaged leftovers (documented there with a reason) don't fail
--strict, while a brand-new undocumented incomplete batch does.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_DIR = ROOT / "assets" / "products"
PENDING_REVIEW_PATH = ROOT / "docs" / "pending-photo-review.md"

SUFFIX_RE = re.compile(r"-(card-front|front|back)$", re.IGNORECASE)
FULL_SET = {"card-front", "front", "back"}


def group_key(stem):
    match = SUFFIX_RE.search(stem)
    if match:
        return stem[: match.start()], match.group(1).lower()
    return stem, None


def scan_loose_groups():
    """Loose = files sitting directly in assets/products/, not in a brand subfolder."""
    if not PRODUCTS_DIR.exists():
        return {}
    groups = {}
    for path in sorted(PRODUCTS_DIR.iterdir()):
        if not path.is_file():
            continue
        prefix, suffix = group_key(path.stem)
        entry = groups.setdefault(prefix, {"files": [], "suffixes": []})
        entry["files"].append(path.name)
        if suffix:
            entry["suffixes"].append(suffix)
    return groups


BATCH_SUFFIX_RE = re.compile(r"-\d+$")


def pending_review_text():
    if not PENDING_REVIEW_PATH.exists():
        return ""
    return PENDING_REVIEW_PATH.read_text(encoding="utf-8")


def is_documented(prefix, files, review_text):
    """A group counts as documented if the doc mentions any of its exact
    filenames, or its batch prefix (the shared album name with a trailing
    -01/-02 index stripped) — docs often reference a whole telegram album
    by prefix (e.g. "telegram-...-160531-{01,02}-*") rather than spelling
    out every individual filename."""
    if not review_text:
        return False
    if any(name in review_text for name in files):
        return True
    batch_prefix = BATCH_SUFFIX_RE.sub("", prefix)
    return bool(batch_prefix) and batch_prefix in review_text


def classify(groups, review_text):
    """Filename-complete (exactly card-front/front/back) is only a first-pass
    filter, not proof the three photos are actually the same product — a
    complete-by-filename group can still be a documented content mismatch
    (e.g. three real shelf photos of three different variants numbered as
    one "album"). documented is tracked on every group, complete or not, so
    a human triage note in pending-photo-review.md always wins over the
    filename heuristic."""
    complete = []
    incomplete = []
    for prefix, info in groups.items():
        files = sorted(info["files"])
        is_complete = set(info["suffixes"]) == FULL_SET and len(files) == 3
        entry = {
            "prefix": prefix,
            "files": files,
            "documented": is_documented(prefix, files, review_text),
        }
        (complete if is_complete else incomplete).append(entry)
    return complete, incomplete


def build_report():
    groups = scan_loose_groups()
    review_text = pending_review_text()
    complete, incomplete = classify(groups, review_text)
    undocumented_incomplete = [g for g in incomplete if not g["documented"]]
    undocumented_complete = [g for g in complete if not g["documented"]]
    return {
        "loose_groups_total": len(groups),
        "complete_groups": complete,
        "incomplete_groups": incomplete,
        "undocumented_incomplete_groups": undocumented_incomplete,
        "undocumented_complete_groups": undocumented_complete,
    }


def print_report(report):
    print(f"Loose file groups directly under assets/products/: {report['loose_groups_total']}")
    print(f"Complete-by-filename 3-photo groups (card-front/front/back): {len(report['complete_groups'])}")
    for group in report["complete_groups"]:
        flag = "documented" if group["documented"] else "UNDOCUMENTED, needs triage"
        print(f"  - [{flag}] {group['prefix']}: {', '.join(group['files'])}")
    print(f"Incomplete groups (1-2 photos): {len(report['incomplete_groups'])}")
    for group in report["incomplete_groups"]:
        flag = "documented" if group["documented"] else "UNDOCUMENTED"
        print(f"  - [{flag}] {group['prefix']}: {', '.join(group['files'])}")
    print(f"Undocumented incomplete groups: {len(report['undocumented_incomplete_groups'])}")
    print(f"Undocumented complete-by-filename groups: {len(report['undocumented_complete_groups'])}")
    if report["undocumented_incomplete_groups"] or report["undocumented_complete_groups"]:
        print(
            "  -> new/unreviewed raw photos found. Do not guess a product mapping (even "
            "if the filenames look like a complete card-front/front/back set); triage "
            "manually and record findings in docs/pending-photo-review.md."
        )


def main():
    parser = argparse.ArgumentParser(description="Triage loose raw Petya photo groups under assets/products/.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help=(
            "Fail when a loose raw group (complete-by-filename or not) exists that is "
            "not documented in docs/pending-photo-review.md."
        ),
    )
    args = parser.parse_args()

    report = build_report()
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_report(report)

    if args.strict and (report["undocumented_incomplete_groups"] or report["undocumented_complete_groups"]):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
