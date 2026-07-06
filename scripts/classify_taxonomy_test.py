#!/usr/bin/env python3
"""Unit tests for scripts/classify_taxonomy.py — pure, no catalog/network.

Run:  python3 scripts/classify_taxonomy_test.py
"""

import unittest

from classify_taxonomy import (
    classify_product_kind,
    classify_audience,
    classify_attributes,
    enrich,
    rank_related,
    related_rank_key,
)


def prod(**kw):
    return kw


class ProductKind(unittest.TestCase):
    def test_laundry_kinds_are_distinct(self):
        self.assertEqual(
            classify_product_kind(prod(categoryId="laundry", title="Dalli стиральный порошок 6 кг", brand="Dalli")),
            "washing_powder",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="laundry", title="Persil Rose гель для стирки 3 л", brand="Persil")),
            "laundry_gel",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="laundry", title="Dash Color капсулы для стирки 60 шт", brand="Dash")),
            "laundry_capsules",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="laundry", title="Downy Fresh кондиционер для белья 1 л", brand="Downy")),
            "fabric_softener",
        )
        # Downy concentrate (softener brand, no explicit "softener" word)
        self.assertEqual(
            classify_product_kind(prod(categoryId="laundry", title="Downy All-in-One Rose концентрат 1 л", brand="Downy")),
            "fabric_softener",
        )

    def test_shaving_razor_vs_cartridge(self):
        self.assertEqual(
            classify_product_kind(prod(categoryId="shaving", title="Gillette Venus ComfortGlide сменные кассеты 2 шт", brand="Gillette")),
            "blade_cartridge",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="shaving", title="VENUS запаски 4 шт", brand="Gillette")),
            "blade_cartridge",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="shaving", title="Gillette Blue3 одноразовые станки 3 шт", brand="Gillette")),
            "razor",
        )

    def test_shaving_gel_and_foam(self):
        self.assertEqual(
            classify_product_kind(prod(categoryId="shaving", title="Gillette Moisturising гель для бритья 200 мл", brand="Gillette")),
            "shaving_gel",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="shaving", title="Gillette Regular пена для бритья 200 мл", brand="Gillette")),
            "shaving_foam",
        )

    def test_hair_kinds(self):
        self.assertEqual(classify_product_kind(prod(categoryId="hair", title="Clear шампунь 600 мл")), "shampoo")
        self.assertEqual(classify_product_kind(prod(categoryId="hair", title="Gliss кондиционер 200 мл")), "conditioner")
        self.assertEqual(classify_product_kind(prod(categoryId="hair", title="Gliss маска для волос 300 мл")), "hair_mask")

    def test_deodorant_forms(self):
        self.assertEqual(classify_product_kind(prod(categoryId="deodorants", title="AXE спрей 150 мл")), "deodorant_spray")
        self.assertEqual(classify_product_kind(prod(categoryId="deodorants", title="Rexona стик 40 мл")), "deodorant_stick")
        self.assertEqual(classify_product_kind(prod(categoryId="deodorants", title="Dove роликовый дезодорант 50 мл")), "deodorant_rollon")

    def test_home_cleaning_forms(self):
        self.assertEqual(classify_product_kind(prod(categoryId="home_cleaning", title="Fairy средство для посуды 600 мл")), "dishwashing_liquid")
        self.assertEqual(classify_product_kind(prod(categoryId="home_cleaning", title="Cif чистящий крем 500 мл")), "cleaning_cream")
        self.assertEqual(classify_product_kind(prod(categoryId="home_cleaning", title="Domestos для унитаза 1 л")), "toilet_cleaner")
        self.assertEqual(classify_product_kind(prod(categoryId="home_cleaning", title="Mr Muscle для стекол 500 мл")), "surface_cleaner")

    def test_perfume_is_decant(self):
        self.assertEqual(classify_product_kind(prod(categoryId="perfume", title="Chanel Chance парфюм 5 мл")), "perfume_decant")

    def test_unknown_when_unsure(self):
        self.assertEqual(classify_product_kind(prod(categoryId="other", title="Что-то непонятное")), "")
        self.assertEqual(classify_product_kind(prod(categoryId="body", title="Johnson's baby масло 200 мл")), "")


class Audience(unittest.TestCase):
    def test_kids(self):
        self.assertEqual(classify_audience(prod(categoryId="body", title="Johnson's baby детское масло 200 мл", brand="Johnson's")), "kids")

    def test_women_venus(self):
        self.assertEqual(classify_audience(prod(categoryId="shaving", title="Gillette Venus кассеты 2 шт", brand="Gillette")), "women")

    def test_men_brands(self):
        self.assertEqual(classify_audience(prod(categoryId="deodorants", title="AXE Dark Temptation спрей", brand="AXE")), "men")
        self.assertEqual(classify_audience(prod(categoryId="hair", title="Clear Men Legend by CR7 шампунь 600 мл", brand="Clear")), "men")

    def test_household_is_family(self):
        self.assertEqual(classify_audience(prod(categoryId="laundry", title="Persil гель для стирки 3 л")), "family")
        self.assertEqual(classify_audience(prod(categoryId="home_cleaning", title="Fairy средство для посуды")), "family")

    def test_unknown(self):
        self.assertEqual(classify_audience(prod(categoryId="hair", title="Herbal Essences шампунь 400 мл")), "unknown")


class Attributes(unittest.TestCase):
    def test_tags(self):
        self.assertIn("rose", classify_attributes(prod(title="Persil Rose гель для стирки")))
        self.assertIn("capsules", classify_attributes(prod(title="Dash капсулы для стирки")))
        self.assertIn("color", classify_attributes(prod(title="Dash Color Frische")))
        self.assertIn("fresh", classify_attributes(prod(title="Dash Color Frische")))
        self.assertIn("concentrate", classify_attributes(prod(title="Downy концентрат 1 л")))
        self.assertIn("sensitive", classify_attributes(prod(title="Persil Sensitive гель")))
        self.assertEqual(classify_attributes(prod(title="Обычный товар")), [])

    def test_enrich_shape(self):
        e = enrich(prod(categoryId="laundry", title="Persil Rose гель для стирки 3 л", brand="Persil"))
        self.assertEqual(e["productKind"], "laundry_gel")
        self.assertEqual(e["audience"], "family")
        self.assertIn("rose", e["attributes"])


class RelatedRanking(unittest.TestCase):
    def test_same_product_kind_ranks_first(self):
        target = enrich(prod(categoryId="hair", title="Clear шампунь 600 мл", brand="Clear"))
        cand_shampoo = enrich(prod(categoryId="hair", title="Head&Shoulders шампунь 400 мл", brand="H&S"))
        cand_conditioner = enrich(prod(categoryId="hair", title="Gliss кондиционер 200 мл", brand="Gliss"))
        cand_other = enrich(prod(categoryId="body", title="Dove мыло", brand="Dove"))
        ranked = rank_related(target, [cand_conditioner, cand_other, cand_shampoo])
        self.assertEqual(ranked[0]["productKind"], "shampoo")  # same kind first

    def test_laundry_does_not_mix_forms(self):
        target = enrich(prod(categoryId="laundry", title="Persil гель для стирки 3 л", brand="Persil"))
        gel = enrich(prod(categoryId="laundry", title="Dalli гель для стирки 1.1 л", brand="Dalli"))
        powder = enrich(prod(categoryId="laundry", title="Dalli стиральный порошок 6 кг", brand="Dalli"))
        softener = enrich(prod(categoryId="laundry", title="Downy кондиционер для белья 1 л", brand="Downy"))
        ranked = rank_related(target, [powder, softener, gel])
        self.assertEqual(ranked[0]["productKind"], "laundry_gel")  # gel target -> gel first

    def test_men_ranks_above_women_within_same_kind(self):
        target = enrich(prod(categoryId="shaving", title="Gillette Fusion сменные кассеты 4 шт (men)", brand="Gillette"))
        # force men audience on target for the test
        target["audience"] = "men"
        men_cart = enrich(prod(categoryId="shaving", title="Gillette Mach3 сменные кассеты 4 шт", brand="Gillette"))
        men_cart["audience"] = "men"
        women_cart = enrich(prod(categoryId="shaving", title="Gillette Venus сменные кассеты 4 шт", brand="Gillette"))
        ranked = rank_related(target, [women_cart, men_cart])
        self.assertEqual(ranked[0]["audience"], "men")  # men before women when target is men


if __name__ == "__main__":
    unittest.main(verbosity=2)
