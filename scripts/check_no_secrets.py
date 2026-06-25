#!/usr/bin/env python3
"""Guard against committing/shipping secrets for Global Market KG.

Scans either git-tracked files (default) or a built deploy package
(--package DIR) for things that must never be committed/deployed:

- Supabase keys / JWTs (anon and service_role keys are JWTs: `eyJ...`).
- `.env` files (any committed env file).
- `admin/config.js` (must stay git-ignored; only the *.example.* template is OK).
- An explicit service-role assignment carrying a real value.

It deliberately does NOT flag plain mentions of the word "service_role" in
docs/code comments (those are guidance, not secrets). Run before commit/deploy:

    python3 scripts/check_no_secrets.py
    python3 scripts/check_no_secrets.py --package /private/tmp/globalmarket-static-build

Exit code 0 = clean, 1 = potential secret found.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# A JWT (Supabase anon/service keys look like this). Three base64url segments.
JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}")
# service_role key assigned a real-looking value (not a placeholder).
SERVICE_ROLE_ASSIGN_RE = re.compile(
    r"service_role[\"'\s:=]+[A-Za-z0-9._-]{20,}", re.IGNORECASE
)

# Files that may legitimately contain placeholder-ish tokens.
ALLOWED_NAME_SUFFIXES = (".example.js", ".example.json", ".example")
# Binary/asset extensions to skip.
SKIP_SUFFIXES = (
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".svg",
    ".zip", ".gz", ".db", ".mxl", ".xls", ".xlsx", ".pdf", ".woff", ".woff2",
)


def tracked_files():
    out = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    return [ROOT / line for line in out.splitlines() if line.strip()]


def package_files(package):
    return [p for p in package.rglob("*") if p.is_file()]


def is_placeholder(value):
    v = value.lower()
    return any(x in v for x in ("your-", "placeholder", "example", "xxxx", "<", "changeme"))


def scan_file(path, rel, mode):
    findings = []
    name = path.name
    rel_posix = rel.replace("\\", "/")
    if name == ".env" or name.startswith(".env."):
        findings.append(f"{rel}: committed .env file")
        return findings
    # admin/config.js holds the PUBLIC anon key and is deployed on purpose, but it
    # must never be git-committed. So: error if tracked; allowed in a package.
    is_admin_config = rel_posix == "admin/config.js"
    if is_admin_config and mode == "git":
        findings.append(f"{rel}: admin/config.js must be git-ignored, not committed")
        return findings
    if path.suffix.lower() in SKIP_SUFFIXES:
        return findings
    if name.endswith(ALLOWED_NAME_SUFFIXES):
        return findings  # example templates are allowed
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return findings
    # The anon key (a JWT) legitimately lives in a deployed admin/config.js.
    if not is_admin_config:
        for m in JWT_RE.finditer(text):
            if not is_placeholder(m.group(0)):
                findings.append(f"{rel}: looks like a JWT/Supabase key ({m.group(0)[:12]}…)")
    # A service_role value is never acceptable, even in admin/config.js.
    for m in SERVICE_ROLE_ASSIGN_RE.finditer(text):
        if not is_placeholder(m.group(0)):
            findings.append(f"{rel}: service_role assigned a value")
    return findings


def main():
    parser = argparse.ArgumentParser(description="Scan for committed/shipped secrets.")
    parser.add_argument("--package", help="Scan a built deploy directory instead of git-tracked files.")
    args = parser.parse_args()

    if args.package:
        base = Path(args.package).expanduser().resolve()
        files = package_files(base)
        scope = f"package {base}"
        mode = "package"
    else:
        base = ROOT
        files = tracked_files()
        scope = "git-tracked files"
        mode = "git"

    findings = []
    for path in files:
        try:
            rel = path.relative_to(base).as_posix()
        except ValueError:
            rel = str(path)
        findings.extend(scan_file(path, rel, mode))

    if findings:
        print(f"Potential secrets found in {scope}:", file=sys.stderr)
        for f in findings:
            print(f"- {f}", file=sys.stderr)
        return 1
    print(f"No secrets detected in {scope} ({len(files)} files scanned).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
