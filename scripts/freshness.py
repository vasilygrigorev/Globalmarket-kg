#!/usr/bin/env python3
"""Pure "fresh arrivals" logic for Global Market KG.

Adds a per-product ``restockedAt`` date so the storefront can show a
"Свежие поступления" section and sort newest arrivals first.

Signal source: the 1C stock export already carries a report date ("На дату…",
parsed by scripts/import_stock.py) and each product a ``stock_quantity``. A
product counts as *restocked* on an import when its quantity goes UP versus the
previous import (a brand-new product, or one coming back from 0, is a special
case of "up"). On a restock, ``restockedAt`` is set to that import's date; when
the quantity does not rise, the previous ``restockedAt`` is carried forward
unchanged, so a slow-selling item keeps its original arrival date.

This module is intentionally standalone and pure (no I/O, no DB, no network) so
it can be unit-tested and wired into scripts/import_stock.py (to write
``restockedAt`` onto catalog products) and into the storefront ordering without
a catalog regeneration. See docs/fresh-arrivals.md.
"""

from datetime import date, datetime, timezone


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def restock_date(prev_qty, new_qty, prev_date, import_date):
    """Return the ``restockedAt`` to store for a product after an import.

    - ``prev_qty`` is None  → brand-new product → ``import_date``.
    - ``new_qty`` > ``prev_qty`` (restock / back in stock) → ``import_date``.
    - otherwise → keep ``prev_date`` unchanged (may be None if never observed).

    All dates are compared/returned as ISO ``YYYY-MM-DD`` strings; ``import_date``
    is required and ``prev_date`` may be None.
    """
    n = _num(new_qty)
    if n is None:
        # No usable new quantity — do not touch the existing arrival date.
        return prev_date
    p = _num(prev_qty)
    if p is None:
        return import_date            # brand-new product = a fresh arrival
    if n > p:
        return import_date            # quantity went up = restock / back in stock
    return prev_date                  # no increase → keep the original date


def _parse(d):
    if not d:
        return None
    try:
        return datetime.strptime(str(d)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def is_new(product, now=None, window_days=30):
    """True when the product was restocked within the last ``window_days``."""
    now = now or datetime.now(timezone.utc).date()
    if isinstance(now, datetime):
        now = now.date()
    d = _parse(product.get("restockedAt"))
    if d is None:
        return False
    delta = (now - d).days
    return 0 <= delta <= window_days


def fresh_arrivals(products, now=None, window_days=None):
    """Products ordered newest-restock-first.

    Dated products come first, most-recent ``restockedAt`` first (ties broken by
    title for stability); undated products follow in title order. When
    ``window_days`` is given, only products restocked within that window are
    returned (the "Свежие поступления" feed); otherwise all products are ordered.
    """
    def key(p):
        d = _parse(p.get("restockedAt"))
        # (has_no_date, negated-ordinal so newer sorts first, title)
        ordinal = d.toordinal() if d else 0
        return (d is None, -ordinal, str(p.get("title") or ""))

    ordered = sorted(products, key=key)
    if window_days is not None:
        ordered = [p for p in ordered if is_new(p, now=now, window_days=window_days)]
    return ordered
