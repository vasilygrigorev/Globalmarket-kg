#!/usr/bin/env python3
"""Unit tests for scripts/classify_taxonomy.py — pure, no catalog/network.

Run:  python3 scripts/classify_taxonomy_test.py
"""

import unittest

from classify_taxonomy import (
    classify_product_kind,
    classify_audience,
    classify_attributes,
    classify_form,
    classify_use_area,
    classify_search_terms,
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

    def test_germany_category_uses_laundry_rules(self):
        # "germany" is a legacy collection-style categoryId (see
        # docs/catalog-taxonomy.md); classification runs off the text, not
        # the categoryId, so it stays correct even though it isn't "laundry".
        self.assertEqual(
            classify_product_kind(prod(categoryId="germany", title="Dalli Universal стиральный порошок 6 кг", brand="Dalli")),
            "washing_powder",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="germany", title="G.Dalli CAPS (24шт) 3in1 Colorwaschmittel", brand="G.Dalli")),
            "laundry_capsules",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="germany", title="G.DASH GEL (1.1L)(20стир) Color Frische", brand="G.DASH")),
            "laundry_gel",
        )
        # No explicit form word at all, but weight (kg) + "Waschmittel" +
        # wash count is the same structural signal as an explicit "порошок".
        self.assertEqual(
            classify_product_kind(prod(categoryId="germany", title="G.Dalli (3.12kg)(48стир) Vollwaschmittel", brand="G.Dalli")),
            "washing_powder",
        )
        # Genuinely ambiguous ("моющее средство" could be many things) stays "".
        self.assertEqual(
            classify_product_kind(prod(categoryId="germany", title="G.Dalli моющее ср-во (1L) Apple", brand="G.Dalli")),
            "",
        )

    def test_miscategorized_products_recovered_by_text_fallback(self):
        # Raw 1C rows sometimes file a product under the wrong category; the
        # fallback pass recognizes the real kind from the title regardless.
        self.assertEqual(
            classify_product_kind(prod(categoryId="other", title="Pantene Smooth & Silky шампунь 600 мл", brand="Pantene")),
            "shampoo",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="home_cleaning", title="Signal з/щ X-tra Clean", brand="Signal")),
            "toothbrush",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="home_cleaning", title="Fructies Конд. (750 ml) Pure Clean", brand="Fructies")),
            "conditioner",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="deodorants", title="AXE Гель/душ (250) Apollo", brand="AXE")),
            "shower_gel",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="body", title="Dove Advanced Care Original спрей-дезодорант, 250 мл", brand="Dove")),
            "deodorant_spray",
        )

    def test_edt_fragrance_excluded_from_deodorants(self):
        # "EDT" (Eau de Toilette) is a fragrance wrongly filed under
        # deodorants in the raw import; it must not be guessed as a form.
        self.assertEqual(
            classify_product_kind(prod(categoryId="deodorants", title="Adidas EDT (M) (100) Team Five", brand="Adidas")),
            "",
        )

    def test_deodorant_form_from_packaging_unit_when_no_form_word(self):
        # No "стик"/"спрей" word at all, but grams vs ml is a reliable
        # structural signal in this catalog (sticks 15-90g, sprays 100-300ml).
        self.assertEqual(
            classify_product_kind(prod(categoryId="deodorants", title="Arm & Hammer Essentials Juniper Berry дезодорант 71 г", brand="Arm & Hammer")),
            "deodorant_stick",
        )
        self.assertEqual(
            classify_product_kind(prod(categoryId="deodorants", title="L'Oreal ДЕО (250 мл) Thermic Resist", brand="L'Oreal")),
            "deodorant_spray",
        )
        # No unit at all: stays unclassified rather than guessed.
        self.assertEqual(
            classify_product_kind(prod(categoryId="deodorants", title="Reebok Deo (150) (L) Cool", brand="Reebok")),
            "",
        )

    def test_gillette_gel_antiperspirant_is_its_own_kind(self):
        self.assertEqual(
            classify_product_kind(prod(categoryId="deodorants", title="Gillette Antiperspirant Cool Wave гель-дезодорант 70 мл", brand="Gillette")),
            "deodorant_gel",
        )

    def test_aftershave_balm_not_confused_with_hair_conditioner(self):
        # Filed under "hair" in the raw import, but "после бритья" means it
        # is an aftershave balm, not a hair conditioner (both say "бальзам").
        self.assertEqual(
            classify_product_kind(prod(categoryId="hair", title="Nivea Бальзам после бритья (100 мл) Fresh Kick", brand="Nivea")),
            "aftershave_balm",
        )

    def test_mistagged_razor_not_read_as_fabric_softener(self):
        # Real catalog bug: a razor pack with a leftover laundry
        # categoryId/productType from a source-code collision. The title's
        # "Blue-3" (an established Gillette razor line elsewhere in this
        # catalog) must win over the mistagged "кондиционер для белья".
        self.assertEqual(
            classify_product_kind(
                prod(categoryId="laundry", title="GILLETTE Blue-3 comfort (8pcs) (6+2)", brand="Gillette", productType="кондиционер для белья")
            ),
            "",
        )

    def test_title_wins_over_conflicting_producttype(self):
        # productType says "гель для душа" (copy-paste leftover) but the
        # title clearly says "для ног" (feet/legs) — not a shower gel.
        self.assertEqual(
            classify_product_kind(
                prod(categoryId="body", title="LadyDiana Гель для ног (170)", brand="LadyDiana", productType="гель для душа")
            ),
            "",
        )

    def test_misc_other_category_kinds(self):
        self.assertEqual(classify_product_kind(prod(categoryId="other", title="Concord Кусачки (3001-8)", productType="разное")), "nail_clipper")
        self.assertEqual(classify_product_kind(prod(categoryId="other", title="Concord Ножницы (DT 613)", productType="разное")), "scissors")
        self.assertEqual(classify_product_kind(prod(categoryId="other", title="Терка для пяток № 160", productType="разное")), "foot_file")
        self.assertEqual(classify_product_kind(prod(categoryId="other", title="Febreze освежитель (185) Ocean", productType="разное")), "air_freshener")
        self.assertEqual(classify_product_kind(prod(categoryId="food", title="Davidoff Espresso молотый кофе 250 г")), "ground_coffee")
        self.assertEqual(classify_product_kind(prod(categoryId="food", title="Bharmal Tea (500) Flag Brand")), "tea")
        # productType "маникюрный инструмент" must not shadow the more
        # specific title word "кусачки" (a real bug caught during review).
        self.assertEqual(
            classify_product_kind(prod(categoryId="other", title="Concord кусачки для ногтей №603-PS", productType="маникюрный инструмент")),
            "nail_clipper",
        )

    def test_oral_kinds(self):
        self.assertEqual(classify_product_kind(prod(categoryId="oral", title="Colgate Cavity Protection зубная паста Pump 100 мл")), "toothpaste")
        self.assertEqual(classify_product_kind(prod(categoryId="oral", title="Dabur Зуб.Паста RED (100) щл")), "toothpaste")
        self.assertEqual(classify_product_kind(prod(categoryId="oral", title="Colgate 360 Charcoal зубная щётка")), "toothbrush")
        self.assertEqual(classify_product_kind(prod(categoryId="oral", title="Oral-B з/щ")), "toothbrush")
        self.assertEqual(classify_product_kind(prod(categoryId="oral", title="LORD Kids зуб/щ Speed фб")), "toothbrush")

    def test_sunscreen_including_abbreviated_titles(self):
        self.assertEqual(
            classify_product_kind(prod(categoryId="body", title="YC Sunscreen UV Protection SPF50 солнцезащитный крем 100 г")),
            "sunscreen",
        )
        # Abbreviated distributor title with no Russian "солнцезащ" word at all.
        self.assertEqual(classify_product_kind(prod(categoryId="body", title="С/З DS (SD-299)SPF80(200ml) Summer")), "sunscreen")

    def test_sunscreen_does_not_leak_into_deodorant_query(self):
        # Regression guard for the real bug: a sunscreen SPRAY must not be
        # confused with a deodorant spray just because both say "spray".
        sunscreen = classify_product_kind(prod(categoryId="body", title="YC White Sunscreen Spray SPF50 солнцезащитный спрей 150 мл"))
        self.assertEqual(sunscreen, "sunscreen")
        self.assertNotIn(sunscreen, {"deodorant_spray", "deodorant_stick", "deodorant_rollon"})


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
        self.assertEqual(e["form"], "gel")
        self.assertEqual(e["useArea"], "laundry")
        self.assertIn("persil", e["searchTerms"])


class Form(unittest.TestCase):
    def test_form_by_kind(self):
        self.assertEqual(classify_form(prod(categoryId="laundry", title="Dalli стиральный порошок 6 кг")), "powder")
        self.assertEqual(classify_form(prod(categoryId="deodorants", title="Rexona стик 40 мл")), "stick")
        self.assertEqual(classify_form(prod(categoryId="shaving", title="Gillette Regular пена для бритья 200 мл")), "foam")
        self.assertEqual(classify_form(prod(categoryId="shaving", title="Gillette Blue3 одноразовые станки 3 шт")), "card_only")

    def test_sunscreen_form_depends_on_spray_vs_cream(self):
        self.assertEqual(classify_form(prod(categoryId="body", title="YC White Sunscreen Spray SPF50 солнцезащитный спрей 150 мл")), "spray")
        self.assertEqual(classify_form(prod(categoryId="body", title="YC Sunscreen UV Protection SPF50 солнцезащитный крем 100 г")), "cream")

    def test_unknown_kind_has_no_form(self):
        self.assertEqual(classify_form(prod(categoryId="other", title="Что-то непонятное")), "")


class UseArea(unittest.TestCase):
    def test_maps_from_category(self):
        self.assertEqual(classify_use_area(prod(categoryId="hair", title="Clear шампунь 600 мл")), "hair")
        self.assertEqual(classify_use_area(prod(categoryId="shaving", title="Gillette станок")), "shaving")
        self.assertEqual(classify_use_area(prod(categoryId="oral", title="Colgate зубная паста")), "oral")

    def test_dishwashing_gets_its_own_area(self):
        self.assertEqual(
            classify_use_area(prod(categoryId="home_cleaning", title="Fairy средство для посуды 600 мл")),
            "dishes",
        )
        self.assertEqual(
            classify_use_area(prod(categoryId="home_cleaning", title="Domestos для унитаза 1 л")),
            "home_cleaning",
        )


class SearchTerms(unittest.TestCase):
    def test_tokenizes_and_dedupes(self):
        terms = classify_search_terms(prod(title="Ariel Fast Dissolving концентрат 2,5 кг", brand="Ariel", productType="стиральный порошок"))
        self.assertIn("ariel", terms)
        self.assertIn("концентрат", terms)
        self.assertIn("порошок", terms)
        self.assertEqual(len(terms), len(set(terms)))

    def test_drops_units_and_stopwords(self):
        terms = classify_search_terms(prod(title="Persil Rose гель для стирки 3 л", brand="Persil"))
        self.assertNotIn("для", terms)
        self.assertNotIn("л", terms)


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
