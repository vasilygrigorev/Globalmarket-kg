#!/usr/bin/env python3
import csv
import hashlib
import json
import math
import re
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

import xlrd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("/Users/macmini/Downloads/Остатки2.xls")
DB_PATH = ROOT / "data" / "store.db"
CATALOG_PATH = ROOT / "data" / "catalog.json"
REVIEW_CSV_PATH = ROOT / "outputs" / "catalog_review.csv"
REVIEW_XLSX_PATH = ROOT / "outputs" / "catalog_review.xlsx"
SETTINGS_PATH = ROOT / "data" / "settings.json"
MANUAL_PRODUCTS_PATH = ROOT / "data" / "manual_products.json"

EXCLUDED_GROUPS = {"18 x Germ 2"}

CATEGORIES = {
    "laundry": {
        "title": "Стирка и уход за бельем",
        "placeholder": "laundry",
        "tones": ["#f2dfc6", "#d58d79"],
        "icon": "🫧",
    },
    "home_cleaning": {
        "title": "Уборка и чистота",
        "placeholder": "cleaning",
        "tones": ["#d7eadf", "#6aa58f"],
        "icon": "✨",
    },
    "hair": {
        "title": "Уход за волосами",
        "placeholder": "hair",
        "tones": ["#f4d5df", "#b66f91"],
        "icon": "🧴",
    },
    "body": {
        "title": "Уход за телом",
        "placeholder": "body",
        "tones": ["#f2d9c7", "#c7876a"],
        "icon": "🌸",
    },
    "oral": {
        "title": "Зубная гигиена",
        "placeholder": "oral",
        "tones": ["#d6e7f4", "#6b9ec6"],
        "icon": "🪥",
    },
    "deodorants": {
        "title": "Дезодоранты",
        "placeholder": "deodorants",
        "tones": ["#e1d8f3", "#8e78bd"],
        "icon": "💜",
    },
    "shaving": {
        "title": "Бритье",
        "placeholder": "shaving",
        "tones": ["#d8e1e7", "#667d8c"],
        "icon": "🪒",
    },
    "perfume": {
        "title": "Парфюм 5 мл",
        "placeholder": "perfume",
        "tones": ["#f3d6e4", "#a85f88"],
        "icon": "🌸",
    },
    "food": {
        "title": "Продукты",
        "placeholder": "food",
        "tones": ["#f0e2b5", "#c79a4a"],
        "icon": "🍫",
    },
    "germany": {
        "title": "Европа",
        "placeholder": "germany",
        "tones": ["#e5e2dc", "#92968c"],
        "icon": "🇪🇺",
    },
    "other": {
        "title": "Разное",
        "placeholder": "other",
        "tones": ["#e4ded2", "#a99076"],
        "icon": "🛍️",
    },
}

KNOWN_BRANDS = [
    "Ariel",
    "Persil",
    "Lenor",
    "Fairy",
    "OMO",
    "Dove",
    "Pantene",
    "Head & Shoulders",
    "Head",
    "Old Spice",
    "Rexona",
    "Adidas",
    "Reebok",
    "Gillette",
    "Oral-B",
    "Oral B",
    "Crest",
    "Blend-a-med",
    "Colgate",
    "L'Oreal",
    "Loreal",
    "Nivea",
    "Olay",
    "Vatika",
    "Yoko",
    "G.Dalli",
    "Dalli",
    "Comfort",
    "Secret",
    "Fa",
    "Palmolive",
    "Always",
    "Naturella",
]

EUROPE_COLLECTION_BRANDS = {
    "Dalli",
    "G.Dalli",
    "Dash",
    "G.DASH",
    "Kamill",
    "The Pink Stuff",
}


def default_settings():
    return {
        "usd_rate": 89.0,
        "retail_markup_percent": 30.0,
        "default_registered_discount_percent": 3.0,
        "free_delivery_threshold_kgs": 10000,
        "beautiful_rounding_max_deviation_percent": 5.0,
        "manager_whatsapp": "+996706771103",
        "manager_email": "globaldistkg@gmail.com",
    }


def load_settings():
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    settings = default_settings()
    if SETTINGS_PATH.exists():
        settings.update(json.loads(SETTINGS_PATH.read_text(encoding="utf-8")))
    else:
        SETTINGS_PATH.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")
    return settings


def normalize_spaces(value):
    return re.sub(r"\s+", " ", str(value)).strip()


def slugify(value):
    value = value.lower()
    value = re.sub(r"[^a-z0-9а-яё]+", "-", value, flags=re.I)
    value = value.strip("-")
    return value or "item"


def source_id(raw_name):
    digest = hashlib.sha1(raw_name.strip().lower().encode("utf-8")).hexdigest()[:12]
    return f"src_{digest}"


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def parse_stock_date(value):
    match = re.search(r"(\d{2})\.(\d{2})\.(\d{2,4})", value)
    if not match:
        return None
    day, month, year = match.groups()
    year = int(year)
    if year < 100:
        year += 2000
    return f"{year:04d}-{int(month):02d}-{int(day):02d}"


def parse_number_text(value):
    return float(str(value).replace("'", "").replace(",", "."))


def clean_title(raw_name):
    title = normalize_spaces(raw_name)
    replacements = {
        "  ": " ",
        "Ligh Foam": "Light Foam",
        "Orhid": "Orchid",
        "Sensetive": "Sensitive",
        "Blosom": "Blossom",
        "Esentials": "Essentials",
        "Anti Pers.": "Anti-Perspirant",
        "Anti Pers": "Anti-Perspirant",
        "Shamp.": "Shampoo",
        "Cond.": "Conditioner",
        "Micelar": "Micellar",
        "Vollwaschmittel": "Vollwaschmittel",
    }
    for old, new in replacements.items():
        title = title.replace(old, new)
    title = re.sub(r"\((\d+)\s*мл\)", r"(\1 мл)", title)
    title = re.sub(r"\((\d+)\s*кг\)", r"(\1 кг)", title)
    title = title.replace(" х ", " x ")
    return title


def detect_brand(raw_name):
    normalized_name = re.sub(r"^\s*\d+\s+", "", raw_name).strip()
    lowered = normalized_name.lower()
    if any(token in lowered for token in ["venus", "mach", "progl", "fusion", "blue-3", "blue 3", "turbo", "7 o'clock"]):
        return "Gillette"
    for brand in KNOWN_BRANDS:
        if lowered.startswith(brand.lower()) or f" {brand.lower()}" in lowered:
            if brand == "Head":
                return "Head & Shoulders"
            if brand == "Loreal":
                return "L'Oreal"
            if brand == "Oral B":
                return "Oral-B"
            if brand == "Dalli":
                return "G.Dalli"
            return brand
    first = re.split(r"[\s(/]", normalized_name.strip(), maxsplit=1)[0].strip(" .'\"")
    return first if first else "Без бренда"


def detect_category(raw_group, raw_name):
    text = f"{raw_group} {raw_name}".lower()
    name_text = raw_name.lower()
    if "пена для ванны" in name_text or "bath foam" in name_text or "bubble bath" in name_text:
        return "body"
    if any(token in text for token in ["порош", "ополас", "ariel", "persil", "lenor", "omo", "comfort", "стир", "waschmittel", "caps"]):
        return "laundry"
    if any(token in text for token in ["моющие", "чист", "fairy", "clean", "уборк"]):
        return "home_cleaning"
    if any(token in text for token in ["шамп", "бальзам", "pantene", "head", "shampoo", "conditioner", "волос"]):
        return "hair"
    if any(token in text for token in ["мыло", "гели", "крема", "тела", "dove", "nivea", "olay", "soap", "body wash", "cream"]):
        return "body"
    if any(token in text for token in ["зуб", "crest", "oral", "colgate", "tooth"]):
        return "oral"
    if any(token in text for token in ["дезодоран", "deodor", "anti-perspirant", "stick", "rexona", "old spice", "adidas"]):
        return "deodorants"
    if any(token in text for token in ["gillette", "брить", "mach", "proglide", "fusion"]):
        return "shaving"
    if any(token in text for token in ["продукты", "питания"]):
        return "food"
    if "germany" in text or "germ" in text:
        return "germany"
    return "other"


def detect_collections(category_id, raw_group="", raw_name="", brand=""):
    text = f"{raw_group} {raw_name}".lower()
    collections = []
    if (
        category_id == "germany"
        or "germany" in text
        or "germ" in text
        or brand in EUROPE_COLLECTION_BRANDS
    ):
        collections.append("europe")
    return collections


def product_type(raw_name, category_id):
    text = raw_name.lower()
    if category_id == "body" and any(token in text for token in ["пена для ванны", "bath foam", "bubble bath"]):
        return "пена для ванны"
    if category_id == "shaving":
        if any(token in text for token in ["foam", "пена"]):
            return "пена для бритья"
        if any(token in text for token in ["gel", "гель"]):
            return "гель для бритья"
        if any(token in text for token in ["запас", "кассет", "лезв"]):
            return "сменные кассеты для бритья"
        if any(token in text for token in ["станок", "razor", "blue-3", "pivot", "simply", "lady razor", "ocean"]):
            return "бритвенные станки"
    checks = [
        ("гель для стирки", ["gel", "гель"], "laundry"),
        ("капсулы для стирки", ["pods", "caps"], "laundry"),
        ("стиральный порошок", ["powder", "порош"], "laundry"),
        ("кондиционер для белья", ["lenor", "comfort", "ополас"], "laundry"),
        ("шампунь", ["shampoo", "shamp", "шамп"], "hair"),
        ("кондиционер для волос", ["conditioner", "бальзам"], "hair"),
        ("дезодорант", ["deodor", "anti-perspirant", "stick"], "deodorants"),
        ("зубная паста", ["tooth", "paste", "crest"], "oral"),
        ("средство для бритья", ["gillette", "mach", "proglide", "fusion"], "shaving"),
        ("гель для душа", ["body wash", "гель"], "body"),
    ]
    for label, tokens, category in checks:
        if category_id == category and any(token in text for token in tokens):
            return label
    return CATEGORIES[category_id]["title"].lower()


def extract_specs(raw_name):
    specs = []
    patterns = [
        r"(\d+(?:[.,]\d+)?)\s*(kg|кг|g|г|l|л|ml|мл)",
        r"(\d+)\s*(шт|pcs|стир)",
        r"\((\d+(?:[.,]\d+)?\s*(?:kg|кг|g|г|l|л|ml|мл|шт|pcs|стир))\)",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, raw_name, flags=re.I):
            value = normalize_spaces(" ".join(match.groups()))
            if value not in specs:
                specs.append(value)
    return specs


def description_for(raw_name, category_id, brand, ptype):
    specs = extract_specs(raw_name)
    spec_text = f" Формат: {', '.join(specs)}." if specs else ""
    if category_id == "laundry":
        return f"{brand}: {ptype} для ежедневного ухода за бельем и домашней стирки.{spec_text}"
    if category_id == "hair":
        return f"{brand}: средство для ухода за волосами на каждый день.{spec_text}"
    if category_id == "body":
        return f"{brand}: средство для ухода за кожей и ежедневной гигиены.{spec_text}"
    if category_id == "deodorants":
        return f"{brand}: дезодорант для ежедневной свежести.{spec_text}"
    if category_id == "oral":
        return f"{brand}: товар для ежедневной зубной гигиены.{spec_text}"
    if category_id == "shaving":
        return f"{brand}: товар для бритья и ухода.{spec_text}"
    return f"{brand}: товар для дома и личного ухода.{spec_text}"


def beautiful_round(value, max_deviation_percent=5.0):
    if value <= 0:
        return 0
    endings = [90, 95]
    if value >= 3000:
        endings = [900, 950, 990]
        base_step = 1000
    else:
        base_step = 100

    candidates = set()
    lower_base = math.floor(value / base_step) * base_step
    for base in range(int(lower_base - base_step * 2), int(lower_base + base_step * 4), base_step):
        if base < 0:
            continue
        for ending in endings:
            candidate = base + ending
            if candidate > 0:
                candidates.add(candidate)
    allowed = value * (max_deviation_percent / 100)
    valid = [candidate for candidate in candidates if abs(candidate - value) <= allowed]
    if valid:
        return int(min(valid, key=lambda candidate: (abs(candidate - value), candidate)))

    if value < 300:
        return int(round(value / 10) * 10)
    if value < 3000:
        return int(round(value / 50) * 50)
    return int(round(value / 100) * 100)


def read_stock(source_path):
    if source_path.suffix.lower() == ".mxl":
        return read_mxl_stock(source_path)
    return read_xls_stock(source_path)


def read_xls_stock(source_path):
    book = xlrd.open_workbook(str(source_path), encoding_override="cp1251")
    sheet = book.sheet_by_index(0)
    report_title = ""
    stock_date = None
    warehouse = "Основной Склад"
    products = []
    current_group = None
    hidden_by_rule_count = 0

    for row_idx in range(sheet.nrows):
        name = normalize_spaces(sheet.cell_value(row_idx, 0))
        unit = normalize_spaces(sheet.cell_value(row_idx, 2))
        cost = sheet.cell_value(row_idx, 3)
        qty = sheet.cell_value(row_idx, 4)
        amount = sheet.cell_value(row_idx, 5)

        if row_idx < 8:
            row_text = " ".join(normalize_spaces(sheet.cell_value(row_idx, col)) for col in range(sheet.ncols))
            if "Остатки ТМЦ" in row_text:
                report_title = row_text
            if "На дату" in row_text:
                stock_date = parse_stock_date(row_text)
            if "По складу" in row_text:
                match = re.search(r'По складу "([^"]+)"', row_text)
                if match:
                    warehouse = match.group(1)

        if not name or name == "Итого:":
            continue
        if unit and unit != " " and is_number(qty):
            if current_group in EXCLUDED_GROUPS:
                hidden_by_rule_count += 1
                continue
            if qty <= 0 or not is_number(cost):
                continue
            raw_name = clean_title(name)
            category_id = detect_category(current_group or "", raw_name)
            brand = detect_brand(raw_name)
            ptype = product_type(raw_name, category_id)
            products.append(
                {
                    "source_id": source_id(raw_name),
                    "source_code": None,
                    "raw_name": raw_name,
                    "raw_group": current_group or "Без группы",
                    "unit": unit,
                    "base_price_usd": round(float(cost), 4),
                    "stock_quantity": float(qty),
                    "stock_amount_usd": round(float(amount), 4) if is_number(amount) else None,
                    "warehouse": warehouse,
                    "stock_date": stock_date,
                    "category_id": category_id,
                    "brand": brand,
                    "product_type": ptype,
                    "clean_title": raw_name,
                    "description": description_for(raw_name, category_id, brand, ptype),
                    "specs": extract_specs(raw_name),
                }
            )
        elif not unit and name and is_number(amount):
            current_group = name

    aggregated = {}
    for product in products:
        key = product["source_id"]
        if key not in aggregated:
            aggregated[key] = product
            continue
        existing = aggregated[key]
        existing["stock_quantity"] += product["stock_quantity"]
        if existing["stock_amount_usd"] is not None and product["stock_amount_usd"] is not None:
            existing["stock_amount_usd"] += product["stock_amount_usd"]
            if existing["stock_quantity"]:
                existing["base_price_usd"] = round(existing["stock_amount_usd"] / existing["stock_quantity"], 4)

    return {
        "report_title": report_title,
        "stock_date": stock_date,
        "warehouse": warehouse,
        "products": list(aggregated.values()),
        "hidden_by_rule_count": hidden_by_rule_count,
        "warnings": [],
    }


MXL_MARKER_RE = re.compile(r'\+\{"B","0","0","84","0","0","\s*(\d+)\s*"\}#')
MXL_CELL_NUMBER_RE = re.compile(r"\x05\x00\x00\x00.([\d']+(?:\.\d+)?)")


def clean_mxl_text(value):
    value = value.replace("\x00", "")
    value = re.sub(r"[\x01-\x1f\x7f-\x9f]+", " ", value)
    return normalize_spaces(value)


def mxl_name_before(text, start):
    chunk = text[max(0, start - 260) : start].replace("\x00", "")
    match = re.search(r"([A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9 .,&+\-/()№%:_'’]+)$", chunk)
    if match:
        return clean_mxl_text(match.group(1))
    return clean_mxl_text(chunk[-80:])


def looks_like_mxl_header(name):
    return name.startswith(("Остатки", "На дату", "По всем", "ТМЦ", "Ед.", "Усред", "Основной", "Кол"))


def read_mxl_stock(source_path):
    text = source_path.read_bytes().decode("cp1251", errors="ignore")
    report_title = "Остатки ТМЦ на складах" if "Остатки ТМЦ на складах" in text else ""
    stock_date = parse_stock_date(text) or None
    warehouse = "Основной Склад"
    warehouse_match = re.search(r'По складу "([^"]+)"', text)
    if warehouse_match:
        warehouse = warehouse_match.group(1)

    products = []
    warnings = []
    current_group = None
    hidden_by_rule_count = 0
    markers = list(MXL_MARKER_RE.finditer(text))

    for index, marker in enumerate(markers):
        row_name = mxl_name_before(text, marker.start())
        row_end = markers[index + 1].start() if index + 1 < len(markers) else len(text)
        body = text[marker.end() : row_end]
        numbers = [parse_number_text(value) for value in MXL_CELL_NUMBER_RE.findall(body)]
        unit = "шт" if "шт" in body[:260] else None

        if unit and len(numbers) >= 3:
            if current_group in EXCLUDED_GROUPS:
                hidden_by_rule_count += 1
                continue
            cost, quantity, amount = numbers[:3]
            if quantity <= 0:
                continue
            raw_name = clean_title(row_name)
            category_id = detect_category(current_group or "", raw_name)
            brand = detect_brand(raw_name)
            ptype = product_type(raw_name, category_id)
            expected_amount = round(cost * quantity, 2)
            amount_tolerance = max(0.5, abs(amount) * 0.002)
            if abs(expected_amount - amount) > amount_tolerance:
                warnings.append(f"{raw_name}: сумма {amount} не совпадает с себестоимость*количество {expected_amount}")
            products.append(
                {
                    "source_id": source_id(raw_name),
                    "source_code": marker.group(1),
                    "raw_name": raw_name,
                    "raw_group": current_group or "Без группы",
                    "unit": unit,
                    "base_price_usd": round(float(cost), 4),
                    "stock_quantity": float(quantity),
                    "stock_amount_usd": round(float(amount), 4),
                    "warehouse": warehouse,
                    "stock_date": stock_date,
                    "category_id": category_id,
                    "brand": brand,
                    "product_type": ptype,
                    "clean_title": raw_name,
                    "description": description_for(raw_name, category_id, brand, ptype),
                    "specs": extract_specs(raw_name),
                }
            )
            continue

        if row_name and not looks_like_mxl_header(row_name):
            current_group = row_name

    aggregated = {}
    for product in products:
        key = product["source_id"]
        if key not in aggregated:
            aggregated[key] = product
            continue
        existing = aggregated[key]
        existing["stock_quantity"] += product["stock_quantity"]
        if existing["stock_amount_usd"] is not None and product["stock_amount_usd"] is not None:
            existing["stock_amount_usd"] += product["stock_amount_usd"]
            if existing["stock_quantity"]:
                existing["base_price_usd"] = round(existing["stock_amount_usd"] / existing["stock_quantity"], 4)

    return {
        "report_title": report_title,
        "stock_date": stock_date,
        "warehouse": warehouse,
        "products": list(aggregated.values()),
        "hidden_by_rule_count": hidden_by_rule_count,
        "warnings": warnings[:50],
    }


def connect_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        create table if not exists settings (
            key text primary key,
            value text not null
        );
        create table if not exists import_runs (
            import_run_id text primary key,
            source_file text not null,
            source_file_hash text not null,
            report_title text,
            stock_date text,
            warehouse text,
            started_at text not null,
            finished_at text,
            status text not null,
            rows_read integer default 0,
            products_imported integer default 0,
            products_new integer default 0,
            products_updated integer default 0,
            products_hidden_by_rule integer default 0,
            warnings text
        );
        create table if not exists source_products (
            source_id text primary key,
            source_code text,
            raw_name text not null,
            raw_group text,
            unit text,
            base_price_usd real,
            stock_quantity real,
            stock_amount_usd real,
            warehouse text,
            stock_date text,
            last_imported_at text,
            source_file text,
            source_hash text
        );
        create table if not exists products (
            product_id text primary key,
            source_id text unique not null,
            raw_name_snapshot text not null,
            status text not null default 'review',
            visibility text not null default 'storefront',
            clean_title text,
            short_title text,
            description text,
            brand text,
            product_type text,
            unit text,
            image_id text,
            placeholder_key text,
            search_text text,
            notes text,
            created_at text not null,
            updated_at text not null,
            foreign key(source_id) references source_products(source_id)
        );
        create table if not exists categories (
            category_id text primary key,
            parent_id text,
            title text not null,
            slug text not null,
            description text,
            sort_order integer default 0,
            placeholder_key text,
            is_active integer default 1
        );
        create table if not exists product_categories (
            product_id text not null,
            category_id text not null,
            is_primary integer default 0,
            sort_order integer default 0,
            primary key(product_id, category_id),
            foreign key(product_id) references products(product_id),
            foreign key(category_id) references categories(category_id)
        );
        create table if not exists orders (
            order_id text primary key,
            customer_snapshot text,
            status text not null default 'new',
            subtotal_kgs real not null default 0,
            delivery_rule_result text,
            total_kgs real not null default 0,
            manager_message text,
            created_at text not null
        );
        create table if not exists order_items (
            order_item_id text primary key,
            order_id text not null,
            product_id text not null,
            title_snapshot text not null,
            quantity real not null,
            unit text,
            unit_price_kgs real not null,
            line_total_kgs real not null,
            base_price_usd_snapshot real,
            usd_rate_snapshot real,
            price_mode text not null,
            foreign key(order_id) references orders(order_id)
        );
        """
    )
    existing_source_columns = {row[1] for row in conn.execute("pragma table_info(source_products)").fetchall()}
    if "source_code" not in existing_source_columns:
        conn.execute("alter table source_products add column source_code text")
    return conn


def import_to_db(conn, data, settings, source_path):
    now = datetime.now(timezone.utc).isoformat()
    source_bytes = source_path.read_bytes()
    source_file_hash = hashlib.sha1(source_bytes).hexdigest()
    import_run_id = f"imp_{source_file_hash[:12]}_{int(datetime.now().timestamp())}"

    for key, value in settings.items():
        conn.execute(
            "insert into settings(key, value) values(?, ?) on conflict(key) do update set value=excluded.value",
            (key, json.dumps(value, ensure_ascii=False)),
        )

    for sort_order, (category_id, category) in enumerate(CATEGORIES.items(), start=1):
        conn.execute(
            """
            insert into categories(category_id, title, slug, sort_order, placeholder_key, is_active)
            values(?, ?, ?, ?, ?, 1)
            on conflict(category_id) do update set
              title=excluded.title,
              slug=excluded.slug,
              sort_order=excluded.sort_order,
              placeholder_key=excluded.placeholder_key,
              is_active=1
            """,
            (category_id, category["title"], slugify(category["title"]), sort_order, category["placeholder"]),
        )

    conn.execute(
        """
        insert into import_runs(import_run_id, source_file, source_file_hash, report_title, stock_date, warehouse, started_at, status)
        values(?, ?, ?, ?, ?, ?, ?, 'running')
        """,
        (import_run_id, str(source_path), source_file_hash, data["report_title"], data["stock_date"], data["warehouse"], now),
    )

    products_new = 0
    products_updated = 0
    for item in data["products"]:
        item_hash = hashlib.sha1(json.dumps(item, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        conn.execute(
            """
            insert into source_products(
                source_id, source_code, raw_name, raw_group, unit, base_price_usd, stock_quantity, stock_amount_usd,
                warehouse, stock_date, last_imported_at, source_file, source_hash
            )
            values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(source_id) do update set
                source_code=excluded.source_code,
                raw_name=excluded.raw_name,
                raw_group=excluded.raw_group,
                unit=excluded.unit,
                base_price_usd=excluded.base_price_usd,
                stock_quantity=excluded.stock_quantity,
                stock_amount_usd=excluded.stock_amount_usd,
                warehouse=excluded.warehouse,
                stock_date=excluded.stock_date,
                last_imported_at=excluded.last_imported_at,
                source_file=excluded.source_file,
                source_hash=excluded.source_hash
            """,
            (
                item["source_id"],
                item.get("source_code"),
                item["raw_name"],
                item["raw_group"],
                item["unit"],
                item["base_price_usd"],
                item["stock_quantity"],
                item["stock_amount_usd"],
                item["warehouse"],
                item["stock_date"],
                now,
                str(source_path),
                item_hash,
            ),
        )
        product_id = f"prd_{item['source_id'].split('_', 1)[1]}"
        existing = conn.execute("select product_id from products where source_id = ?", (item["source_id"],)).fetchone()
        if existing:
            products_updated += 1
            conn.execute("update products set unit = ?, updated_at = ? where source_id = ?", (item["unit"], now, item["source_id"]))
            product_id = existing["product_id"]
        else:
            products_new += 1
            search_text = " ".join(
                [
                    item["raw_name"],
                    item["raw_group"],
                    item["clean_title"],
                    item["brand"],
                    item["product_type"],
                    CATEGORIES[item["category_id"]]["title"],
                ]
            ).lower()
            conn.execute(
                """
                insert into products(
                    product_id, source_id, raw_name_snapshot, status, visibility, clean_title, short_title,
                    description, brand, product_type, unit, placeholder_key, search_text, created_at, updated_at
                )
                values(?, ?, ?, 'review', 'storefront', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    product_id,
                    item["source_id"],
                    item["raw_name"],
                    item["clean_title"],
                    item["clean_title"],
                    item["description"],
                    item["brand"],
                    item["product_type"],
                    item["unit"],
                    CATEGORIES[item["category_id"]]["placeholder"],
                    search_text,
                    now,
                    now,
                ),
            )

        has_categories = conn.execute("select count(*) as count from product_categories where product_id = ?", (product_id,)).fetchone()["count"]
        if not has_categories:
            conn.execute(
                "insert or ignore into product_categories(product_id, category_id, is_primary, sort_order) values(?, ?, 1, 0)",
                (product_id, item["category_id"]),
            )

    imported_source_ids = [item["source_id"] for item in data["products"]]
    products_missing = 0
    if imported_source_ids:
        placeholders = ",".join("?" for _ in imported_source_ids)
        products_missing = conn.execute(
            f"select count(*) as count from source_products where source_id not in ({placeholders})",
            imported_source_ids,
        ).fetchone()["count"]
        conn.execute(
            f"""
            update source_products
            set stock_quantity = 0,
                stock_amount_usd = 0,
                stock_date = ?,
                last_imported_at = ?,
                source_file = ?,
                source_hash = source_hash
            where source_id not in ({placeholders})
            """,
            [data["stock_date"], now, str(source_path), *imported_source_ids],
        )

    conn.execute(
        """
        update import_runs
        set finished_at = ?, status = 'completed', rows_read = ?, products_imported = ?,
            products_new = ?, products_updated = ?, products_hidden_by_rule = ?
        where import_run_id = ?
        """,
        (
            datetime.now(timezone.utc).isoformat(),
            len(data["products"]),
            len(data["products"]),
            products_new,
            products_updated,
            data.get("hidden_by_rule_count", 0),
            import_run_id,
        ),
    )
    conn.commit()
    return {
        "import_run_id": import_run_id,
        "products_imported": len(data["products"]),
        "products_new": products_new,
        "products_updated": products_updated,
        "products_missing_from_import": products_missing,
        "products_hidden_by_rule": data.get("hidden_by_rule_count", 0),
        "warnings": data.get("warnings", []),
        "source_file_hash": source_file_hash,
    }


def price_values(base_price_usd, settings):
    wholesale = round(base_price_usd * settings["usd_rate"], 2)
    retail_raw = wholesale * (1 + settings["retail_markup_percent"] / 100)
    retail = beautiful_round(retail_raw, settings["beautiful_rounding_max_deviation_percent"])
    registered = math.floor(retail * (1 - settings["default_registered_discount_percent"] / 100))
    return wholesale, round(retail_raw, 2), retail, registered


def product_gallery_images(image_id):
    if not image_id:
        return []
    image_path = ROOT / image_id
    if not image_path.exists():
        return [image_id]
    stem = image_path.stem
    suffix = image_path.suffix
    base = stem
    for ending in ("-card-front", "-final-front", "-front"):
        if stem.endswith(ending):
            base = stem[: -len(ending)]
            break
    front_candidates = [
        image_path.with_name(f"{base}-front{suffix}"),
        image_path.with_name(f"{base}-final-front{suffix}"),
        image_path.with_name(f"{base}-final-alt-front{suffix}"),
        image_path.with_name(f"{base}-alt-front{suffix}"),
    ]
    back_candidates = [
        image_path.with_name(f"{base}-back{suffix}"),
        image_path.with_name(f"{base}-final-back{suffix}"),
        image_path.with_name(f"{base}-final-alt-back{suffix}"),
        image_path.with_name(f"{base}-alt-back{suffix}"),
    ]
    candidates = [image_path]
    for group in (front_candidates, back_candidates):
        for extra in group:
            if extra.exists():
                candidates.append(extra)
                break
    result = []
    seen = set()
    for path in candidates:
        rel_path = path.relative_to(ROOT).as_posix()
        if rel_path not in seen:
            result.append(rel_path)
            seen.add(rel_path)
    return result


def load_manual_products():
    if not MANUAL_PRODUCTS_PATH.exists():
        return []
    payload = json.loads(MANUAL_PRODUCTS_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", payload if isinstance(payload, list) else [])
    active_products = []
    for product in products:
        if product.get("visibility", "storefront") != "storefront":
            continue
        if product.get("status", "active") not in {"active", "review"}:
            continue
        active_products.append(product)
    return active_products


def generate_outputs(conn, settings):
    rows = conn.execute(
        """
        select
          p.product_id, p.status, p.visibility, p.clean_title, p.short_title, p.description,
          p.brand, p.product_type, p.unit as product_unit, p.placeholder_key, p.image_id, p.search_text,
          sp.source_id, sp.source_code, sp.raw_name, sp.raw_group, sp.unit, sp.base_price_usd,
          sp.stock_quantity, sp.stock_amount_usd, sp.warehouse, sp.stock_date,
          c.category_id, c.title as category_title
        from products p
        join source_products sp on sp.source_id = p.source_id
        left join product_categories pc on pc.product_id = p.product_id and pc.is_primary = 1
        left join categories c on c.category_id = pc.category_id
        where p.visibility = 'storefront' and sp.stock_quantity > 0
        order by c.sort_order, sp.stock_amount_usd desc, p.clean_title
        """
    ).fetchall()

    products = []
    review_rows = []
    for row in rows:
        wholesale, retail_raw, retail, registered = price_values(row["base_price_usd"], settings)
        category_id = row["category_id"] or "other"
        category = CATEGORIES.get(category_id, CATEGORIES["other"])
        collections = detect_collections(category_id, row["raw_group"], row["raw_name"], row["brand"])
        product = {
            "id": row["product_id"],
            "sourceId": row["source_id"],
            "sourceCode": row["source_code"],
            "title": row["clean_title"],
            "rawName": row["raw_name"],
            "category": row["category_title"] or category["title"],
            "categoryId": category_id,
            "collections": collections,
            "collectionLabels": ["Европа"] if "europe" in collections else [],
            "brand": row["brand"],
            "productType": row["product_type"],
            "unit": row["unit"],
            "stockQuantity": row["stock_quantity"],
            "stockAmountUsd": row["stock_amount_usd"],
            "status": row["status"],
            "basePriceUsd": row["base_price_usd"],
            "wholesalePriceKgs": wholesale,
            "retailPriceKgs": retail,
            "registeredPriceKgs": registered,
            "description": row["description"],
            "image": row["image_id"],
            "galleryImages": product_gallery_images(row["image_id"]),
            "icon": category["icon"],
            "tones": category["tones"],
            "badge": row["brand"] or "В наличии",
            "rating": 4.8,
            "searchText": " ".join(
                [
                    row["search_text"] or "",
                    row["raw_name"] or "",
                    row["brand"] or "",
                    row["product_type"] or "",
                    row["category_title"] or "",
                ]
            ),
        }
        products.append(product)
        review_rows.append(
            {
                "review_status": row["status"],
                "source_group": row["raw_group"],
                "source_code": row["source_code"],
                "raw_name": row["raw_name"],
                "clean_title": row["clean_title"],
                "brand": row["brand"],
                "primary_category": row["category_title"] or category["title"],
                "unit": row["unit"],
                "stock_quantity": row["stock_quantity"],
                "base_price_usd": row["base_price_usd"],
                "wholesale_kgs": wholesale,
                "retail_raw_kgs": retail_raw,
                "retail_kgs": retail,
                "registered_kgs": registered,
                "description": row["description"],
                "visibility": row["visibility"],
                "comment": "",
            }
        )

    for manual in load_manual_products():
        category_id = manual.get("categoryId") or "other"
        category = CATEGORIES.get(category_id, CATEGORIES["other"])
        image = manual.get("image", "")
        gallery_images = manual.get("galleryImages") or ([image] if image else [])
        retail = int(manual["retailPriceKgs"])
        registered = int(manual.get("registeredPriceKgs", math.floor(retail * 0.97)))
        collections = manual.get("collections") or detect_collections(
            category_id,
            manual.get("sourceGroup", ""),
            manual.get("rawName", manual["title"]),
            manual.get("brand", ""),
        )
        product = {
            "id": manual["id"],
            "sourceId": manual.get("sourceId", "manual"),
            "sourceCode": manual.get("sourceCode", ""),
            "title": manual["title"],
            "rawName": manual.get("rawName", manual["title"]),
            "category": manual.get("category") or category["title"],
            "categoryId": category_id,
            "collections": collections,
            "collectionLabels": manual.get("collectionLabels") or (["Европа"] if "europe" in collections else []),
            "brand": manual.get("brand", ""),
            "productType": manual.get("productType", ""),
            "unit": manual.get("unit", "шт"),
            "stockQuantity": manual.get("stockQuantity", 1),
            "stockAmountUsd": manual.get("stockAmountUsd"),
            "status": manual.get("status", "active"),
            "basePriceUsd": manual.get("basePriceUsd"),
            "wholesalePriceKgs": manual.get("wholesalePriceKgs"),
            "retailPriceKgs": retail,
            "registeredPriceKgs": registered,
            "description": manual.get("description", ""),
            "image": image,
            "galleryImages": gallery_images,
            "icon": category["icon"],
            "tones": category["tones"],
            "badge": manual.get("badge") or manual.get("brand") or "В наличии",
            "rating": manual.get("rating", 4.9),
            "searchText": " ".join(
                [
                    manual.get("searchText", ""),
                    manual["title"],
                    manual.get("brand", ""),
                    manual.get("productType", ""),
                    manual.get("category", category["title"]),
                ]
            ),
        }
        products.append(product)
        review_rows.append(
            {
                "review_status": product["status"],
                "source_group": manual.get("sourceGroup", "manual"),
                "source_code": product["sourceCode"],
                "raw_name": product["rawName"],
                "clean_title": product["title"],
                "brand": product["brand"],
                "primary_category": product["category"],
                "unit": product["unit"],
                "stock_quantity": product["stockQuantity"],
                "base_price_usd": product["basePriceUsd"],
                "wholesale_kgs": product["wholesalePriceKgs"],
                "retail_raw_kgs": retail,
                "retail_kgs": retail,
                "registered_kgs": registered,
                "description": product["description"],
                "visibility": manual.get("visibility", "storefront"),
                "comment": "manual product; stock source is separate from regular 1C import",
            }
        )

    categories = []
    for category_id, category in CATEGORIES.items():
        count = sum(1 for product in products if product["categoryId"] == category_id)
        if count:
            categories.append({"id": category_id, "title": category["title"], "count": count, "icon": category["icon"]})

    CATALOG_PATH.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "settings": settings,
                "categories": categories,
                "products": products,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    REVIEW_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with REVIEW_CSV_PATH.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(review_rows[0].keys()) if review_rows else [])
        if review_rows:
            writer.writeheader()
            writer.writerows(review_rows)
    if review_rows:
        write_simple_xlsx(REVIEW_XLSX_PATH, review_rows)

    return {
        "catalog_products": len(products),
        "catalog_categories": len(categories),
        "catalog_path": str(CATALOG_PATH),
        "review_csv_path": str(REVIEW_CSV_PATH),
        "review_xlsx_path": str(REVIEW_XLSX_PATH),
    }


def excel_col(index):
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def cell_xml(row_index, col_index, value):
    ref = f"{excel_col(col_index)}{row_index}"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value or ""))}</t></is></c>'


def write_simple_xlsx(path, rows):
    headers = list(rows[0].keys())
    all_rows = [headers] + [[row.get(header, "") for header in headers] for row in rows]
    dimension = f"A1:{excel_col(len(headers))}{len(all_rows)}"
    sheet_rows = []
    for row_index, row in enumerate(all_rows, start=1):
        cells = "".join(cell_xml(row_index, col_index, value) for col_index, value in enumerate(row, start=1))
        sheet_rows.append(f'<row r="{row_index}">{cells}</row>')
    widths = "".join(f'<col min="{i}" max="{i}" width="{18 if i not in (3, 4, 14) else 42}" customWidth="1"/>' for i in range(1, len(headers) + 1))
    sheet_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="{dimension}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>{widths}</cols>
  <sheetData>{''.join(sheet_rows)}</sheetData>
  <autoFilter ref="{dimension}"/>
</worksheet>"""
    workbook_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Catalog Review" sheetId="1" r:id="rId1"/></sheets>
</workbook>"""
    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""
    workbook_rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""
    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", rels_xml)
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)


def main():
    source_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source_path.exists():
        print(f"Source file not found: {source_path}", file=sys.stderr)
        return 2
    settings = load_settings()
    data = read_stock(source_path)
    conn = connect_db()
    import_summary = import_to_db(conn, data, settings, source_path)
    output_summary = generate_outputs(conn, settings)
    print(
        json.dumps(
            {
                "source": str(source_path),
                "stock_date": data["stock_date"],
                "warehouse": data["warehouse"],
                **import_summary,
                **output_summary,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
