#!/usr/bin/env python3
import csv
import json
import re
import sys
from pathlib import Path


NUM_RE = re.compile(r"^-?\d+(?:'\d{3})*(?:\.\d+)?%?$")
PRODUCT_RE = re.compile(
    r'(?P<name>[^\n{}#]{3,160})\+\{"B","0","0","84","0","0","\s*(?P<code>\d+)\s*"\}#\n'
    r"(?P<body>.*?)(?=\n[^\n{}#]{0,160}\+\{\"B\",\"0\",\"0\",\"84\"|\n[\w .,'\"()&/%$!-]{3,160},\{\"B\"|\Z)",
    re.S,
)


def normalize_name(value: str) -> str:
    value = value.replace("\x00", " ")
    value = re.sub(r"^[^\wА-Яа-яЁё$'\".()&/%-]+", "", value)
    value = re.sub(r"\s+", " ", value).strip(" ,")
    return value


def parse_number(value: str):
    value = value.replace("'", "").replace("%", "")
    try:
        return float(value)
    except ValueError:
        return None


def extract_products(mxl_path: Path):
    raw = mxl_path.read_bytes()
    text = raw.decode("cp1251", errors="ignore")
    products = []
    seen = set()

    for match in PRODUCT_RE.finditer(text):
        name = normalize_name(match.group("name"))
        if not name or name in {">", ">>"}:
            continue
        if re.fullmatch(r"[\d\s%#.$/+,-]+", name):
            continue

        numbers = [parse_number(line.strip()) for line in match.group("body").splitlines() if NUM_RE.match(line.strip())]
        numbers = [number for number in numbers if number is not None]
        if not numbers:
            continue

        quantity = numbers[0]
        if quantity <= 0:
            continue

        # In this 1C report the product line usually starts with quantity,
        # then original/current amounts, difference, and percent.
        old_amount = numbers[1] if len(numbers) > 1 else None
        current_amount = numbers[2] if len(numbers) > 2 else old_amount
        unit_price = round(current_amount / quantity, 2) if current_amount and quantity else None
        code = match.group("code").strip()
        key = (code, name, quantity, current_amount)
        if key in seen:
            continue
        seen.add(key)

        products.append(
            {
                "id": f"mxl-{code}-{len(products) + 1}",
                "code": code,
                "title": name,
                "category": guess_category(name),
                "quantity": quantity,
                "amount": current_amount,
                "price": unit_price,
            }
        )

    return products


def guess_category(name: str) -> str:
    lowered = name.lower()
    groups = [
        ("Стирка", ["ariel", "persil", "omo", "lenor", "fairy"]),
        ("Уход за волосами", ["pantene", "head", "shamp", "conditioner", "elseve"]),
        ("Гигиена", ["dove", "rexona", "old spice", "deodorant", "stick", "anti pers"]),
        ("Зубная паста", ["crest", "oral", "tooth", "paste"]),
        ("Уход за кожей", ["l'oreal", "nivea", "cream", "lotion", "soap"]),
    ]
    for category, tokens in groups:
        if any(token in lowered for token in tokens):
            return category
    return "Прочее"


def main():
    if len(sys.argv) != 4:
        print("Usage: import_mxl_report.py input.mxl output.json output.csv", file=sys.stderr)
        return 2

    source = Path(sys.argv[1])
    json_path = Path(sys.argv[2])
    csv_path = Path(sys.argv[3])
    products = extract_products(source)

    json_path.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "code", "title", "category", "quantity", "amount", "price"])
        writer.writeheader()
        writer.writerows(products)

    total_quantity = sum(item["quantity"] for item in products)
    print(f"Extracted {len(products)} product rows, total quantity {total_quantity:.3f}")


if __name__ == "__main__":
    raise SystemExit(main())
