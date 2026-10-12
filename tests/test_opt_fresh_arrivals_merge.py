#!/usr/bin/env python3

from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import opt_fresh_arrivals as fresh  # noqa: E402


def receipt(date: str, number: str, value: float, codes: list[str]) -> dict:
    return {
        "date": date,
        "number": number,
        "observedLineValueUsd": value,
        "isLarge": value > fresh.LARGE_RECEIPT_USD,
        "sourceCodes": codes,
    }


class ReceiptSnapshotMergeTest(unittest.TestCase):
    def test_later_snapshot_cannot_erase_history_or_large_classification(self) -> None:
        older = [
            receipt("2026-09-07", "R-24", 12_000, ["100", "101"]),
            receipt("2026-08-25", "R-22", 15_000, ["200"]),
            receipt("2026-08-10", "R-20", 300, ["300"]),
            receipt("2026-08-01", "R-19", 11_000, ["400"]),
        ]
        newer = [
            receipt("2026-09-22", "R-26", 100, ["500"]),
            receipt("2026-09-07", "R-24", 3_000, ["101", "102"]),
        ]

        documents, period = fresh.merge_receipt_document_sets(
            [older, newer],
            [
                {"start": "2026-08-01", "end": "2026-09-14", "invalidReceiptRows": 0},
                {"start": "2026-09-01", "end": "2026-10-02", "invalidReceiptRows": 0},
            ],
        )

        latest_large = next(item for item in documents if item["number"] == "R-24")
        self.assertEqual(latest_large["observedLineValueUsd"], 12_000)
        self.assertTrue(latest_large["isLarge"])
        self.assertEqual(latest_large["sourceCodes"], ["100", "101", "102"])
        self.assertEqual(latest_large["snapshotCount"], 2)
        self.assertEqual(period["start"], "2026-08-01")
        self.assertEqual(period["end"], "2026-10-02")

        selected, boundary = fresh.select_receipts(documents, period)
        self.assertEqual(
            [(item["date"], item["number"]) for item in selected],
            [
                ("2026-09-22", "R-26"),
                ("2026-09-07", "R-24"),
                ("2026-08-25", "R-22"),
                ("2026-08-10", "R-20"),
            ],
        )
        self.assertEqual(boundary["number"], "R-19")


if __name__ == "__main__":
    unittest.main()
