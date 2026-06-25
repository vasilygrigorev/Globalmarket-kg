#!/usr/bin/env python3
"""Check the SHAPE of backend env/config without revealing any secret values.

Safe to run anytime. It NEVER prints key values and NEVER reads real secrets out
of files to display them. It only reports present/missing and valid/invalid for:

- SUPABASE_URL                env var, must start with https:// if present
- SUPABASE_SERVICE_ROLE_KEY   env var, present/missing only (value never shown)
- MANAGER_WHATSAPP            env var, optional; digits-only if present
- admin/config.js             optional local file; if present, must define
                              GM_SUPABASE_URL + GM_SUPABASE_ANON_KEY and must NOT
                              contain a service_role value (that would be a leak)

Exit codes:
- 0  shape looks fine (or only missing vars, which is normal before go-live)
- 1  a real safety problem (service_role found in admin/config.js), OR --strict
     was passed and something required is missing/invalid.

Run: python3 scripts/check_backend_env_shape.py [--strict]
"""
import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADMIN_CONFIG = ROOT / "admin" / "config.js"
SERVICE_ROLE_ASSIGN_RE = re.compile(
    r"service_role[\"'\s:=]+[A-Za-z0-9._-]{20,}", re.IGNORECASE
)


def inspect_config_text(text):
    """Pure check of an admin/config.js body. Returns booleans only — no values."""
    return {
        "has_url": "GM_SUPABASE_URL" in text,
        "has_anon": "GM_SUPABASE_ANON_KEY" in text,
        "has_service_role": bool(SERVICE_ROLE_ASSIGN_RE.search(text)),
    }


def main():
    parser = argparse.ArgumentParser(description="Report backend env/config shape (no values).")
    parser.add_argument("--strict", action="store_true", help="Exit 1 if required vars are missing/invalid.")
    args = parser.parse_args()

    lines = []
    issues = 0      # missing/invalid (soft unless --strict)
    hard_fail = 0   # real safety problems (always fail)

    # SUPABASE_URL
    url = os.environ.get("SUPABASE_URL")
    if not url:
        lines.append("SUPABASE_URL: missing (set in Cloudflare env for go-live)")
        issues += 1
    elif url.startswith("https://"):
        lines.append("SUPABASE_URL: present, valid")
    else:
        lines.append("SUPABASE_URL: present, INVALID (must start with https://)")
        issues += 1

    # SUPABASE_SERVICE_ROLE_KEY — presence only, never the value
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        lines.append("SUPABASE_SERVICE_ROLE_KEY: present (value not shown)")
    else:
        lines.append("SUPABASE_SERVICE_ROLE_KEY: missing (server/edge only; set in Cloudflare)")
        issues += 1

    # MANAGER_WHATSAPP — optional, digits only
    wa = os.environ.get("MANAGER_WHATSAPP")
    if wa is None or wa == "":
        lines.append("MANAGER_WHATSAPP: not set (optional; default used)")
    elif wa.isdigit():
        lines.append("MANAGER_WHATSAPP: present, valid (digits only)")
    else:
        lines.append("MANAGER_WHATSAPP: present, INVALID (must be digits only)")
        issues += 1

    # admin/config.js — local presence allowed; check shape + leak, never print values
    if ADMIN_CONFIG.exists():
        info = inspect_config_text(ADMIN_CONFIG.read_text(encoding="utf-8", errors="ignore"))
        lines.append(f"admin/config.js: present (GM_SUPABASE_URL: {'set' if info['has_url'] else 'missing'}, "
                     f"GM_SUPABASE_ANON_KEY: {'set' if info['has_anon'] else 'missing'})")
        if not (info["has_url"] and info["has_anon"]):
            issues += 1
        if info["has_service_role"]:
            lines.append("admin/config.js: SERVICE_ROLE present — FORBIDDEN (anon key only!)")
            hard_fail += 1
        # An admin/config.js with a JWT is fine (anon key is public); we do not
        # print it. We only forbid service_role above.
    else:
        lines.append("admin/config.js: not present (add locally at go-live; git-ignored)")

    print("Backend env/config shape (no values shown):")
    for line in lines:
        print(f"- {line}")

    if hard_fail:
        print("\nFAIL: a forbidden secret was found.", file=sys.stderr)
        return 1
    if args.strict and issues:
        print(f"\nFAIL (--strict): {issues} missing/invalid item(s).", file=sys.stderr)
        return 1
    if issues:
        print(f"\nOK (informational): {issues} item(s) not set yet — expected before go-live.")
    else:
        print("\nOK: backend env/config shape looks ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
