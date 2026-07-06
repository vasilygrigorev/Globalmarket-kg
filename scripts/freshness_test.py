#!/usr/bin/env python3
"""Unit tests for scripts/freshness.py — pure, no I/O.

Run:  python3 scripts/freshness_test.py
"""

import unittest
from datetime import date

from freshness import restock_date, is_new, fresh_arrivals


class RestockDate(unittest.TestCase):
    def test_new_product_gets_import_date(self):
        self.assertEqual(restock_date(None, 10, None, "2026-07-06"), "2026-07-06")

    def test_quantity_increase_is_a_restock(self):
        self.assertEqual(restock_date(4, 12, "2026-06-01", "2026-07-06"), "2026-07-06")

    def test_back_in_stock_from_zero(self):
        self.assertEqual(restock_date(0, 5, "2026-05-01", "2026-07-06"), "2026-07-06")

    def test_no_increase_keeps_previous_date(self):
        self.assertEqual(restock_date(12, 12, "2026-06-01", "2026-07-06"), "2026-06-01")
        self.assertEqual(restock_date(12, 3, "2026-06-01", "2026-07-06"), "2026-06-01")

    def test_missing_new_quantity_keeps_previous(self):
        self.assertEqual(restock_date(5, None, "2026-06-01", "2026-07-06"), "2026-06-01")

    def test_previous_date_may_be_none_without_increase(self):
        self.assertIsNone(restock_date(5, 5, None, "2026-07-06"))


class IsNew(unittest.TestCase):
    def test_within_window(self):
        self.assertTrue(is_new({"restockedAt": "2026-07-01"}, now=date(2026, 7, 6), window_days=30))

    def test_outside_window(self):
        self.assertFalse(is_new({"restockedAt": "2026-05-01"}, now=date(2026, 7, 6), window_days=30))

    def test_no_date_is_not_new(self):
        self.assertFalse(is_new({}, now=date(2026, 7, 6)))

    def test_future_date_not_new(self):
        self.assertFalse(is_new({"restockedAt": "2026-08-01"}, now=date(2026, 7, 6), window_days=30))


class FreshArrivals(unittest.TestCase):
    def _catalog(self):
        return [
            {"title": "Old", "restockedAt": "2026-05-01"},
            {"title": "Newest", "restockedAt": "2026-07-05"},
            {"title": "Undated", "restockedAt": None},
            {"title": "Mid", "restockedAt": "2026-06-15"},
        ]

    def test_newest_restock_first_undated_last(self):
        order = [p["title"] for p in fresh_arrivals(self._catalog())]
        self.assertEqual(order, ["Newest", "Mid", "Old", "Undated"])

    def test_window_filters_to_recent(self):
        feed = [p["title"] for p in fresh_arrivals(self._catalog(), now=date(2026, 7, 6), window_days=30)]
        self.assertEqual(feed, ["Newest", "Mid"])  # Old (May) and Undated excluded


if __name__ == "__main__":
    unittest.main(verbosity=2)
