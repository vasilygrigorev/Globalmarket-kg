#!/usr/bin/env python3
import argparse
import json
import math
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "assets" / "products"
DEFAULT_SOURCES = ROOT / "assets" / "product_sources"
OCR_LANGS = "eng+ara+rus"


def run_sips(args):
    subprocess.run(["sips", *args], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def has_command(name):
    return shutil.which(name) is not None


def median(values):
    ordered = sorted(values)
    if not ordered:
        return 0
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) // 2


def clamp(value, low, high):
    return max(low, min(high, value))


def read_bmp(path):
    data = Path(path).read_bytes()
    if data[:2] != b"BM":
        raise ValueError(f"{path} is not a BMP file")

    pixel_offset = struct.unpack_from("<I", data, 10)[0]
    header_size = struct.unpack_from("<I", data, 14)[0]
    if header_size < 40:
        raise ValueError("Unsupported BMP header")

    width = struct.unpack_from("<i", data, 18)[0]
    height_raw = struct.unpack_from("<i", data, 22)[0]
    bit_count = struct.unpack_from("<H", data, 28)[0]
    compression = struct.unpack_from("<I", data, 30)[0]
    if compression != 0 or bit_count not in (24, 32):
        raise ValueError(f"Unsupported BMP format: {bit_count}-bit compression={compression}")

    top_down = height_raw < 0
    height = abs(height_raw)
    bytes_per_pixel = bit_count // 8
    row_stride = ((width * bit_count + 31) // 32) * 4
    pixels = []
    for y in range(height):
        source_y = y if top_down else height - 1 - y
        row_start = pixel_offset + source_y * row_stride
        row = []
        for x in range(width):
            idx = row_start + x * bytes_per_pixel
            b, g, r = data[idx], data[idx + 1], data[idx + 2]
            row.append((r, g, b))
        pixels.append(row)
    return width, height, pixels


def write_bmp(path, width, height, pixels):
    bit_count = 24
    row_stride = ((width * bit_count + 31) // 32) * 4
    pixel_bytes = row_stride * height
    file_size = 14 + 40 + pixel_bytes
    header = bytearray()
    header += b"BM"
    header += struct.pack("<IHHI", file_size, 0, 0, 54)
    header += struct.pack("<IiiHHIIiiII", 40, width, height, 1, bit_count, 0, pixel_bytes, 2835, 2835, 0, 0)
    body = bytearray(pixel_bytes)
    for y in range(height):
        target_y = height - 1 - y
        row_start = target_y * row_stride
        for x in range(width):
            r, g, b = pixels[y][x]
            idx = row_start + x * 3
            body[idx : idx + 3] = bytes((b, g, r))
    Path(path).write_bytes(header + body)


def rotate_image(source, output, degrees):
    if degrees == 0:
        shutil.copy2(source, output)
        return
    run_sips(["-r", str(degrees), str(source), "--out", str(output)])


def tesseract_score(image):
    if not has_command("tesseract"):
        return {"score": 0.0, "words": 0, "letters": 0, "digits": 0}
    try:
        result = subprocess.run(
            ["tesseract", str(image), "stdout", "-l", OCR_LANGS, "--psm", "6", "tsv"],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=10,
        )
    except (subprocess.SubprocessError, OSError):
        return {"score": 0.0, "words": 0, "letters": 0, "digits": 0}

    if result.returncode not in (0, 1):
        return {"score": 0.0, "words": 0, "letters": 0, "digits": 0}

    score = 0.0
    words = 0
    total_letters = 0
    total_digits = 0
    for line in result.stdout.splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) < 12:
            continue
        text = parts[11].strip()
        if not text:
            continue
        try:
            confidence = float(parts[10])
        except ValueError:
            continue
        if confidence < 20:
            continue
        letters = sum(1 for char in text if char.isalpha())
        digits = sum(1 for char in text if char.isdigit())
        chars = letters + digits
        if chars < 2 or (letters == 0 and digits > 5):
            continue
        letter_weight = min(letters, 18) * 2.4
        digit_weight = min(digits, 4) * 0.25
        token_weight = letter_weight + digit_weight
        if letters >= 3:
            token_weight += 2.0
        words += 1
        total_letters += letters
        total_digits += digits
        score += confidence * token_weight
        lowered = text.lower()
        if any(keyword in lowered for keyword in ["clear", "men", "shampoo", "dandruff", "sport", "menthol"]):
            score += confidence * 20
    return {"score": round(score, 2), "words": words, "letters": total_letters, "digits": total_digits}


def orientation_shape_metrics(image, tmp_dir):
    bmp_path = tmp_dir / f"{Path(image).stem}-shape.bmp"
    try:
        run_sips(["-s", "format", "bmp", str(image), "--out", str(bmp_path)])
        width, height, pixels = read_bmp(bmp_path)
        footer_limit = detect_footer_limit(pixels, width, height)
        bg = background_color(pixels, width, height, footer_limit)
        generic_bbox = foreground_bbox(pixels, width, height, bg, footer_limit)
        color_bbox = colored_object_bbox(pixels, width, height, footer_limit)
        bbox = choose_object_bbox(generic_bbox, color_bbox, width, footer_limit)
    except (subprocess.SubprocessError, OSError, ValueError):
        return {"object_aspect": 0.0, "image_aspect": 0.0}

    left, top, right, bottom = bbox
    object_w = max(1, right - left)
    object_h = max(1, bottom - top)
    return {
        "object_aspect": round(object_h / object_w, 3),
        "image_aspect": round(height / max(1, width), 3),
    }


def choose_text_orientation(source, tmp_dir):
    preview = tmp_dir / f"{Path(source).stem}-orientation-preview.jpg"
    run_sips(["-Z", "900", str(source), "--out", str(preview)])

    candidates = []
    for degrees in (0, 90, 180, 270):
        candidate = preview if degrees == 0 else tmp_dir / f"{Path(source).stem}-orientation-{degrees}.jpg"
        if degrees:
            rotate_image(preview, candidate, degrees)
        ocr = tesseract_score(candidate)
        shape = orientation_shape_metrics(candidate, tmp_dir)
        candidates.append({"degrees": degrees, **ocr, **shape})

    current = candidates[0]
    best = max(candidates, key=lambda item: (item["score"], item["words"]))
    if current["object_aspect"] >= 1.45:
        return 0, candidates

    vertical_candidates = [
        item
        for item in candidates
        if item["object_aspect"] >= 1.45 and item["score"] >= max(90, best["score"] * 0.65)
    ]
    if vertical_candidates:
        vertical_best = max(vertical_candidates, key=lambda item: (item["object_aspect"], item["score"], item["words"]))
        sideways_best = best["object_aspect"] < 0.9 and vertical_best["score"] >= best["score"] * 0.72
        if sideways_best:
            best = vertical_best

    enough_text = best["words"] >= 2 and best["score"] >= 120
    clearly_better = best["score"] >= max(current["score"] * 1.35, current["score"] + 100)
    current_unreadable = current["words"] == 0 and best["words"] >= 2
    clearly_more_vertical = best["object_aspect"] >= 1.45 and current["object_aspect"] < 1.0
    if best["degrees"] and enough_text and (clearly_better or current_unreadable):
        return best["degrees"], candidates
    if best["degrees"] and enough_text and clearly_more_vertical:
        return best["degrees"], candidates
    return 0, candidates


def orient_source_by_text(source, tmp_dir):
    source = Path(source)
    oriented = tmp_dir / f"{source.stem}-oriented{source.suffix.lower() or '.jpg'}"
    shutil.copy2(source, oriented)
    return oriented, {"rotation_degrees": 0, "method": "rotation-disabled-by-user", "candidates": []}

    if not has_command("tesseract"):
        shutil.copy2(source, oriented)
        return oriented, {"rotation_degrees": 0, "method": "tesseract-unavailable", "candidates": []}

    try:
        degrees, candidates = choose_text_orientation(source, tmp_dir)
    except (subprocess.SubprocessError, OSError):
        shutil.copy2(source, oriented)
        return oriented, {"rotation_degrees": 0, "method": "orientation-failed", "candidates": []}

    rotate_image(source, oriented, degrees)
    return oriented, {"rotation_degrees": degrees, "method": "tesseract-tsv", "candidates": candidates}


def color_distance(a, b):
    return math.sqrt(sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)))


def is_dark(pixel):
    return sum(pixel) / 3 < 55


def saturation(pixel):
    return max(pixel) - min(pixel)


def luma(pixel):
    return sum(pixel) / 3


def detect_footer_limit(pixels, width, height):
    limit = height
    for y in range(height - 1, int(height * 0.78), -1):
        row = pixels[y]
        dark_ratio = sum(1 for pixel in row if is_dark(pixel)) / width
        avg_luma = sum(luma(pixel) for pixel in row) / width
        if dark_ratio > 0.24 or (dark_ratio > 0.12 and avg_luma < 132):
            limit = y
        elif limit != height:
            break
    return limit


def background_color(pixels, width, height, footer_limit):
    border = max(8, min(width, height) // 25)
    samples = []
    usable_height = max(1, footer_limit)
    for y in range(usable_height):
        if y < border or y >= usable_height - border:
            xs = range(width)
        else:
            xs = list(range(border)) + list(range(width - border, width))
        for x in xs:
            pixel = pixels[y][x]
            if not is_dark(pixel):
                samples.append(pixel)
    return tuple(median([pixel[i] for pixel in samples]) for i in range(3))


def foreground_bbox(pixels, width, height, bg, footer_limit):
    threshold = 28
    bg_luma = luma(bg)
    min_row_hits = max(4, int(width * 0.018))
    min_col_hits = max(4, int(height * 0.012))
    row_hits = [0] * height
    col_hits = [0] * width

    for y in range(footer_limit):
        for x, pixel in enumerate(pixels[y]):
            dist = color_distance(pixel, bg)
            product_like = saturation(pixel) > 42 or luma(pixel) < bg_luma - 26
            if dist > threshold and product_like:
                row_hits[y] += 1
                col_hits[x] += 1

    # Broad dark/grey gradients from the tabletop can mark almost a whole row.
    # A product row is concentrated; a background band usually spans most of the image.
    row_hits = [0 if hits / width > 0.74 else hits for hits in row_hits]

    rows = [idx for idx, hits in enumerate(row_hits[:footer_limit]) if hits >= min_row_hits]
    cols = [idx for idx, hits in enumerate(col_hits) if hits >= min_col_hits]
    if not rows or not cols:
        return 0, 0, width, footer_limit
    return min(cols), min(rows), max(cols) + 1, max(rows) + 1


def colored_object_bbox(pixels, width, height, footer_limit):
    row_hits = []
    col_hits = [0] * width
    for y in range(footer_limit):
        xs = []
        for x, pixel in enumerate(pixels[y]):
            r, g, b = pixel
            blue_or_colored = (
                (b > r + 18 and b > g + 6 and luma(pixel) < 175 and saturation(pixel) > 24)
                or (saturation(pixel) > 80 and luma(pixel) < 185)
            )
            if blue_or_colored:
                xs.append(x)
                col_hits[x] += 1
        if len(xs) > max(20, width * 0.025):
            row_hits.append((y, min(xs), max(xs) + 1))

    cols = [idx for idx, hits in enumerate(col_hits) if hits > max(24, height * 0.02)]
    if not row_hits or not cols:
        return None

    top = row_hits[0][0]
    bottom = row_hits[-1][0] + 1
    left = min(cols)
    right = max(cols) + 1
    object_h = bottom - top
    object_w = right - left
    if object_h < height * 0.22 or object_w < width * 0.12:
        return None
    return left, top, right, bottom


def choose_object_bbox(generic_bbox, colored_bbox_value, width, footer_limit):
    if not colored_bbox_value:
        return generic_bbox
    _, generic_top, _, generic_bottom = generic_bbox
    _, color_top, _, color_bottom = colored_bbox_value
    generic_h = generic_bottom - generic_top
    color_h = color_bottom - color_top
    if color_h < generic_h * 0.92 and color_h > footer_limit * 0.25:
        return colored_bbox_value
    return generic_bbox


def square_crop_box(width, height, bbox, footer_limit, pad_ratio, object_fill):
    left, top, right, bottom = bbox
    box_w = right - left
    box_h = bottom - top
    if object_fill:
        # The longest side of the product should take this share of the square.
        # Vertical bottles fill by height; horizontal boxes/tubes fill by width.
        target_side = math.ceil(max(box_w, box_h) / object_fill)
        pad = 0
    else:
        target_side = max(box_w, box_h)
        pad = int(max(box_w, box_h) * pad_ratio)
    left = clamp(left - pad, 0, width)
    right = clamp(right + pad, 0, width)
    top = clamp(top - pad, 0, footer_limit)
    bottom = clamp(bottom + pad, 0, footer_limit)

    crop_w = right - left
    crop_h = bottom - top
    side = max(crop_w, crop_h, target_side)
    cx = (left + right) // 2
    cy = (top + bottom) // 2
    left = cx - side // 2
    top = cy - side // 2
    right = left + side
    bottom = top + side

    if left < 0:
        right -= left
        left = 0
    if right > width:
        left -= right - width
        right = width
    if top < 0:
        bottom -= top
        top = 0
    if bottom > footer_limit:
        top -= bottom - footer_limit
        bottom = footer_limit
    left = clamp(left, 0, width - 1)
    top = clamp(top, 0, footer_limit - 1)
    right = clamp(right, left + 1, width)
    bottom = clamp(bottom, top + 1, footer_limit)
    return left, top, right, bottom


def adjust_pixel(pixel, bg, target_bg, strength):
    dist = color_distance(pixel, bg)
    if dist < 72:
        blend = strength * (1 - dist / 92)
        return tuple(clamp(round(pixel[i] * (1 - blend) + target_bg[i] * blend), 0, 255) for i in range(3))

    # Gentle clarity lift for the product without changing the package color too much.
    lifted = []
    for channel in pixel:
        value = (channel - 128) * 1.04 + 128 + 3
        lifted.append(clamp(round(value), 0, 255))
    return tuple(lifted)


def product_pixel(pixel):
    lifted = []
    for channel in pixel:
        value = (channel - 128) * 1.025 + 128 + 2
        lifted.append(clamp(round(value), 0, 255))
    return tuple(lifted)


def crop_and_adjust(pixels, box, bg, bg_strength, protected_box=None):
    left, top, right, bottom = box
    target_bg = (248, 247, 243)
    output = []
    for y in range(top, bottom):
        row = []
        for x in range(left, right):
            protected = protected_box and protected_box[0] <= x < protected_box[2] and protected_box[1] <= y < protected_box[3]
            row.append(product_pixel(pixels[y][x]) if protected else adjust_pixel(pixels[y][x], bg, target_bg, bg_strength))
        output.append(row)
    return right - left, bottom - top, output


def place_on_square(width, height, pixels, bg, protected_box=None):
    side = max(width, height)
    x_offset = (side - width) // 2
    y_offset = (side - height) // 2
    target_bg = (248, 247, 243)
    canvas = [[target_bg for _ in range(side)] for _ in range(side)]
    row_ranges = product_row_ranges(pixels, width, height, bg, target_bg)

    # Catalog photos should read as clean product shots. Generated square margins are
    # intentionally flat: no decorative gradients and no sampled edge colors.
    feather = min(10, x_offset)
    for y, row in enumerate(pixels):
        target_y = y + y_offset
        for x, pixel in enumerate(row):
            target_x = x + x_offset
            if feather and x < feather and is_background_like(pixel, bg, target_bg):
                amount = (feather - x) / feather * 0.35
                pixel = blend(pixel, target_bg, amount)
            elif feather and x >= width - feather and is_background_like(pixel, bg, target_bg):
                amount = (x - (width - feather)) / feather * 0.35
                pixel = blend(pixel, target_bg, amount)
            canvas[target_y][target_x] = pixel
    if protected_box:
        left, top, right, bottom = protected_box
        protected_box = (
            clamp(left + x_offset, 0, side),
            clamp(top + y_offset, 0, side),
            clamp(right + x_offset, 0, side),
            clamp(bottom + y_offset, 0, side),
        )
        flatten_background_outside_box(canvas, side, bg, target_bg, protected_box)
    flatten_background_margins(canvas, side, bg, target_bg)
    return side, side, canvas


def average_window(row, start, end):
    sample = row[start:end]
    if not sample:
        return (248, 247, 243)
    return tuple(round(sum(pixel[i] for pixel in sample) / len(sample)) for i in range(3))


def blend(a, b, amount):
    amount = clamp(amount, 0, 1)
    return tuple(clamp(round(a[i] * (1 - amount) + b[i] * amount), 0, 255) for i in range(3))


def is_background_like(pixel, bg, target_bg):
    return (
        color_distance(pixel, bg) < 92
        or color_distance(pixel, target_bg) < 46
        or (saturation(pixel) < 36 and luma(pixel) > 130)
    )


def product_row_ranges(pixels, width, height, bg, target_bg):
    ranges = [None] * height
    min_hits = max(5, int(width * 0.018))
    bg_luma = luma(bg)
    for y, row in enumerate(pixels):
        xs = []
        for x, pixel in enumerate(row):
            pixel_saturation = saturation(pixel)
            pixel_luma = luma(pixel)
            package_like = (
                (pixel_saturation > 48 and pixel_luma < 220)
                or (pixel_saturation > 28 and pixel_luma < bg_luma - 35)
            )
            clearly_not_backdrop = color_distance(pixel, bg) > 52 and color_distance(pixel, target_bg) > 34
            if package_like and clearly_not_backdrop:
                xs.append(x)
        if len(xs) >= min_hits:
            ranges[y] = (min(xs), max(xs) + 1)
    return smooth_row_ranges(ranges, width)


def smooth_row_ranges(ranges, width):
    smoothed = list(ranges)
    last = None
    gap = 0
    for idx, row_range in enumerate(smoothed):
        if row_range:
            if last and 0 < gap <= 3:
                left = min(last[0], row_range[0])
                right = max(last[1], row_range[1])
                for fill_idx in range(idx - gap, idx):
                    smoothed[fill_idx] = (left, right)
            last = row_range
            gap = 0
        elif last:
            gap += 1

    median_widths = [right - left for row_range in smoothed if row_range for left, right in [row_range]]
    if not median_widths:
        return smoothed
    max_reasonable_width = median(median_widths) * 1.45
    return [
        row_range if not row_range or row_range[1] - row_range[0] <= max(width * 0.92, max_reasonable_width) else None
        for row_range in smoothed
    ]


def flatten_background_outside_silhouette(canvas, side, bg, target_bg, row_ranges, x_offset, y_offset):
    pad = max(5, int(side * 0.008))
    for source_y, row_range in enumerate(row_ranges):
        target_y = source_y + y_offset
        if target_y < 0 or target_y >= side:
            continue
        if row_range:
            left, right = row_range
            left = clamp(left + x_offset - pad, 0, side)
            right = clamp(right + x_offset + pad, 0, side)
        else:
            left = right = None
        for x, pixel in enumerate(canvas[target_y]):
            inside_product_row = row_range and left <= x < right
            if not inside_product_row and is_background_like(pixel, bg, target_bg):
                canvas[target_y][x] = target_bg


def apply_vertical_background_gradient(canvas, side, bg, target_bg):
    top_band = max(1, int(side * 0.16))
    bottom_band = max(1, int(side * 0.13))
    for y in range(side):
        if y < top_band:
            amount = (1 - y / top_band) ** 1.4 * 0.34
        elif y >= side - bottom_band:
            amount = (1 - (side - 1 - y) / bottom_band) ** 1.45 * 0.3
        else:
            continue
        for x, pixel in enumerate(canvas[y]):
            if is_background_like(pixel, bg, target_bg):
                canvas[y][x] = blend(pixel, target_bg, amount)


def flatten_background_margins(canvas, side, bg, target_bg):
    # Remove visible side bands from the original tabletop/backdrop. Only background-like
    # pixels are flattened, so product color and labels remain untouched.
    edge_band = max(18, int(side * 0.035))
    for y in range(side):
        for x in range(side):
            near_edge = x < edge_band or x >= side - edge_band or y < edge_band or y >= side - edge_band
            if near_edge and is_background_like(canvas[y][x], bg, target_bg):
                canvas[y][x] = target_bg


def flatten_background_outside_box(canvas, side, bg, target_bg, protected_box):
    left, top, right, bottom = protected_box
    pad = max(6, int(side * 0.012))
    left = clamp(left - pad, 0, side)
    top = clamp(top - pad, 0, side)
    right = clamp(right + pad, 0, side)
    bottom = clamp(bottom + pad, 0, side)
    for y in range(side):
        for x, pixel in enumerate(canvas[y]):
            inside_product = left <= x < right and top <= y < bottom
            if not inside_product and is_background_like(pixel, bg, target_bg):
                canvas[y][x] = target_bg


def flatten_background_columns(canvas, side, bg, target_bg):
    # If a vertical column is almost entirely backdrop, normalize it to a flat
    # catalog background. This removes photographed seams without washing labels.
    min_background_ratio = 0.86
    for x in range(side):
        hits = sum(1 for y in range(side) if is_background_like(canvas[y][x], bg, target_bg))
        if hits / side < min_background_ratio:
            continue
        for y in range(side):
            if is_background_like(canvas[y][x], bg, target_bg):
                canvas[y][x] = target_bg


def edge_is_dark_row(pixels, y, width):
    row = pixels[y]
    dark_ratio = sum(1 for pixel in row if is_dark(pixel)) / width
    avg_luma = sum(luma(pixel) for pixel in row) / width
    return dark_ratio > 0.18 or avg_luma < 105


def edge_is_dark_col(pixels, x, top, bottom):
    sample = [pixels[y][x] for y in range(top, bottom)]
    if not sample:
        return False
    dark_ratio = sum(1 for pixel in sample if is_dark(pixel)) / len(sample)
    avg_luma = sum(luma(pixel) for pixel in sample) / len(sample)
    return dark_ratio > 0.18 or avg_luma < 105


def usable_frame_box(pixels, width, height, footer_limit):
    left, top, right, bottom = 0, 0, width, max(1, footer_limit)
    while top < bottom - 1 and edge_is_dark_row(pixels, top, width):
        top += 1
    while bottom > top + 1 and edge_is_dark_row(pixels, bottom - 1, width):
        bottom -= 1
    while left < right - 1 and edge_is_dark_col(pixels, left, top, bottom):
        left += 1
    while right > left + 1 and edge_is_dark_col(pixels, right - 1, top, bottom):
        right -= 1
    return left, top, right, bottom


def crop_pixels(pixels, box):
    left, top, right, bottom = box
    return [row[left:right] for row in pixels[top:bottom]]


def neutralize_frame_background(pixels, bg, protected_box=None):
    target_bg = (255, 255, 255)
    output = []
    for y, row in enumerate(pixels):
        edited = []
        for x, pixel in enumerate(row):
            protected = protected_box and protected_box[0] <= x < protected_box[2] and protected_box[1] <= y < protected_box[3]
            if protected:
                bg_dist = color_distance(pixel, bg)
                pixel_sat = saturation(pixel)
                pixel_luma = luma(pixel)
                r, g, b = pixel
                blue_or_colored_product = b > r + 4 or pixel_sat > 42
                plain_backdrop = bg_dist < 70 and pixel_sat < 36 and pixel_luma > 118 and not blue_or_colored_product
                if plain_backdrop:
                    amount = 0.9 if pixel_luma > 150 else 0.72
                    edited.append(blend(pixel, target_bg, amount))
                else:
                    edited.append(product_pixel(pixel))
                continue
            bg_dist = color_distance(pixel, bg)
            pixel_sat = saturation(pixel)
            pixel_luma = luma(pixel)
            beige_like = bg_dist < 72 and pixel_sat < 58 and pixel_luma > 95
            neutral_light = pixel_sat < 24 and pixel_luma > 128
            if beige_like or neutral_light:
                amount = 0.78 if bg_dist < 48 else 0.55
                if pixel_luma < 145:
                    amount *= 0.72
                edited.append(blend(pixel, target_bg, amount))
            else:
                edited.append(product_pixel(pixel))
        output.append(edited)
    return output


def box_blur_pixels(pixels, width, height, radius):
    if radius <= 0:
        return pixels
    integral_r = [[0] * (width + 1) for _ in range(height + 1)]
    integral_g = [[0] * (width + 1) for _ in range(height + 1)]
    integral_b = [[0] * (width + 1) for _ in range(height + 1)]
    for y in range(height):
        row_r = row_g = row_b = 0
        for x in range(width):
            r, g, b = pixels[y][x]
            row_r += r
            row_g += g
            row_b += b
            integral_r[y + 1][x + 1] = integral_r[y][x + 1] + row_r
            integral_g[y + 1][x + 1] = integral_g[y][x + 1] + row_g
            integral_b[y + 1][x + 1] = integral_b[y][x + 1] + row_b

    output = []
    for y in range(height):
        y1 = max(0, y - radius)
        y2 = min(height, y + radius + 1)
        row = []
        for x in range(width):
            x1 = max(0, x - radius)
            x2 = min(width, x + radius + 1)
            area = (x2 - x1) * (y2 - y1)
            r = integral_r[y2][x2] - integral_r[y1][x2] - integral_r[y2][x1] + integral_r[y1][x1]
            g = integral_g[y2][x2] - integral_g[y1][x2] - integral_g[y2][x1] + integral_g[y1][x1]
            b = integral_b[y2][x2] - integral_b[y1][x2] - integral_b[y2][x1] + integral_b[y1][x1]
            row.append((round(r / area), round(g / area), round(b / area)))
        output.append(row)
    return output


def place_frame_on_blurred_square(width, height, pixels):
    side = max(width, height)
    target_bg = (255, 255, 255)
    canvas = [[target_bg for _ in range(side)] for _ in range(side)]
    blurred_frame = box_blur_pixels(pixels, width, height, max(2, int(side * 0.004)))

    x_offset = (side - width) // 2
    y_offset = (side - height) // 2
    feather = max(8, int(side * 0.01))
    for y, row in enumerate(pixels):
        target_y = y + y_offset
        for x, pixel in enumerate(row):
            target_x = x + x_offset
            distance_to_frame_edge = min(x, y, width - 1 - x, height - 1 - y)
            if distance_to_frame_edge < feather:
                t = max(0.0, min(1.0, distance_to_frame_edge / feather))
                soft_pixel = blend(blurred_frame[y][x], pixel, t)
                canvas[target_y][target_x] = blend(target_bg, soft_pixel, t ** 1.2)
            else:
                canvas[target_y][target_x] = pixel
    return side, side, canvas


def process_image(source, output, *, size, pad_ratio, bg_strength, object_fill, tmp_dir):
    source = Path(source)
    bmp_path = tmp_dir / f"{source.stem}.bmp"
    edited_bmp = tmp_dir / f"{source.stem}-edited.bmp"
    resized_jpg = tmp_dir / f"{source.stem}-resized.jpg"
    cleaned_jpg = tmp_dir / f"{source.stem}-cleaned.jpg"
    oriented_source, orientation = orient_source_by_text(source, tmp_dir)

    run_sips(["-s", "format", "bmp", str(oriented_source), "--out", str(bmp_path)])
    width, height, pixels = read_bmp(bmp_path)
    footer_limit = detect_footer_limit(pixels, width, height)
    bg = background_color(pixels, width, height, footer_limit)
    generic_bbox = foreground_bbox(pixels, width, height, bg, footer_limit)
    color_bbox = colored_object_bbox(pixels, width, height, footer_limit)
    bbox = choose_object_bbox(generic_bbox, color_bbox, width, footer_limit)
    crop_box = usable_frame_box(pixels, width, height, footer_limit)
    frame = crop_pixels(pixels, crop_box)
    protected_box = (
        clamp(bbox[0] - crop_box[0], 0, crop_box[2] - crop_box[0]),
        clamp(bbox[1] - crop_box[1], 0, crop_box[3] - crop_box[1]),
        clamp(bbox[2] - crop_box[0], 0, crop_box[2] - crop_box[0]),
        clamp(bbox[3] - crop_box[1], 0, crop_box[3] - crop_box[1]),
    )
    frame = neutralize_frame_background(frame, bg, protected_box)
    crop_w = crop_box[2] - crop_box[0]
    crop_h = crop_box[3] - crop_box[1]
    square_w, square_h, square = place_frame_on_blurred_square(crop_w, crop_h, frame)
    write_bmp(edited_bmp, square_w, square_h, square)
    run_sips(["-s", "format", "jpeg", "-s", "formatOptions", "85", "-z", str(size), str(size), str(edited_bmp), "--out", str(resized_jpg)])
    shutil.copy2(resized_jpg, output)
    return {
        "source": str(source),
        "output": str(output),
        "orientation": orientation,
        "mode": "frame-blur-square",
        "source_size": [width, height],
        "footer_limit": footer_limit,
        "background_rgb": bg,
        "bbox": bbox,
        "generic_bbox": generic_bbox,
        "colored_bbox": color_bbox,
        "crop_box": crop_box,
        "output_size": [size, size],
    }


def clean_resized_background(source_jpg, output_jpg, bg, tmp_dir):
    target_bg = (248, 247, 243)
    bmp_path = tmp_dir / f"{Path(source_jpg).stem}-cleanup.bmp"
    cleaned_bmp = tmp_dir / f"{Path(source_jpg).stem}-cleanup-edited.bmp"
    run_sips(["-s", "format", "bmp", str(source_jpg), "--out", str(bmp_path)])
    width, height, pixels = read_bmp(bmp_path)
    if width != height:
        shutil.copy2(source_jpg, output_jpg)
        return
    flatten_background_margins(pixels, width, bg, target_bg)
    write_bmp(cleaned_bmp, width, height, pixels)
    run_sips(["-s", "format", "jpeg", "-s", "formatOptions", "85", str(cleaned_bmp), "--out", str(output_jpg)])


def main():
    parser = argparse.ArgumentParser(description="Local product photo bot: crop and normalize product photos without AI tokens.")
    parser.add_argument("slug", help="Product slug, for example clear-men-cr7-600ml")
    parser.add_argument("photos", nargs="+", help="Input photo paths. First photo becomes the main/front image.")
    parser.add_argument("--labels", nargs="*", help="Optional labels matching photos, e.g. front back")
    parser.add_argument("--size", type=int, default=1200, help="Output square size in pixels.")
    parser.add_argument("--pad", type=float, default=0.12, help="Padding around detected product.")
    parser.add_argument("--object-fill", type=float, default=0.8, help="Target object height inside the square frame, from 0 to 1.")
    parser.add_argument("--bg-strength", type=float, default=0.72, help="Background lightening strength from 0 to 1.")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCES)
    args = parser.parse_args()

    labels = args.labels or []
    if labels and len(labels) != len(args.photos):
        raise SystemExit("--labels count must match photo count")

    product_source_dir = args.source_dir / args.slug
    product_source_dir.mkdir(parents=True, exist_ok=True)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    report = {"slug": args.slug, "images": []}
    with tempfile.TemporaryDirectory(prefix="local-photo-bot-") as temp:
        tmp_dir = Path(temp)
        for index, photo in enumerate(args.photos, start=1):
            source = Path(photo)
            label = labels[index - 1] if labels else ("front" if index == 1 else f"photo-{index}")
            original = product_source_dir / f"{index:02d}-{label}-original{source.suffix.lower() or '.jpg'}"
            shutil.copy2(source, original)
            output = args.out_dir / f"{args.slug}-{label}.jpg"
            image_report = process_image(
                original,
                output,
                size=args.size,
                pad_ratio=args.pad,
                bg_strength=args.bg_strength,
                object_fill=args.object_fill,
                tmp_dir=tmp_dir,
            )
            image_report["label"] = label
            image_report["original"] = str(original)
            report["images"].append(image_report)

    report_path = product_source_dir / "processing-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"report": str(report_path), "outputs": [item["output"] for item in report["images"]]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
