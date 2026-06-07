#!/usr/bin/env python3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "placeholders"


ICONS = {
    "laundry-gel": """
      <path d="M118 68h36v22h-36z" />
      <path d="M108 90h56l10 168c1 18-12 34-30 34h-32c-18 0-31-16-30-34l10-168z" />
      <path d="M104 146h68v80h-68z" class="panel" />
      <path d="M118 188c16-22 32 22 50 0" class="accent" />
    """,
    "laundry-powder": """
      <path d="M86 92h142l-18 210H104z" />
      <path d="M104 126h108v70H104z" class="panel" />
      <path d="M112 226h80" class="accent" />
      <path d="M116 248h56" class="accent" />
    """,
    "laundry-capsules": """
      <path d="M86 116h142v152a28 28 0 0 1-28 28h-86a28 28 0 0 1-28-28z" />
      <path d="M102 86h110v30H102z" />
      <circle cx="128" cy="182" r="22" class="panel" />
      <circle cx="176" cy="188" r="24" class="panel" />
      <circle cx="152" cy="232" r="20" class="panel" />
    """,
    "fabric-softener": """
      <path d="M128 64h44v28h-44z" />
      <path d="M106 92h80c10 38 18 86 18 148 0 34-19 58-54 58s-54-24-54-58c0-62 8-110 18-148z" />
      <path d="M116 154h82v68h-82z" class="panel" />
      <path d="M126 246c18 14 40 14 58 0" class="accent" />
    """,
    "shampoo": """
      <path d="M124 66h48v26h-48z" />
      <path d="M106 92h84v210h-84z" />
      <path d="M120 146h56v96h-56z" class="panel" />
      <path d="M132 190c18-28 28 28 44 0" class="accent" />
    """,
    "conditioner": """
      <path d="M108 82h96v214h-96z" />
      <path d="M126 58h58v24h-58z" />
      <path d="M122 144h68v86h-68z" class="panel" />
      <path d="M132 256h48" class="accent" />
    """,
    "shower-gel": """
      <path d="M118 66h48v28h-48z" />
      <path d="M96 94h86l18 208H78z" />
      <path d="M110 152h68v88h-68z" class="panel" />
      <circle cx="142" cy="260" r="10" class="accent-fill" />
    """,
    "soap": """
      <rect x="76" y="132" width="180" height="112" rx="52" />
      <path d="M116 186h92" class="accent" />
      <circle cx="208" cy="126" r="12" class="panel" />
      <circle cx="234" cy="102" r="8" class="panel" />
    """,
    "deodorant-spray": """
      <path d="M118 80h54v26h-54z" />
      <path d="M106 106h78v198h-78z" />
      <path d="M118 154h54v98h-54z" class="panel" />
      <path d="M188 92c18-18 34-20 52-14" class="accent" />
    """,
    "deodorant-roll": """
      <path d="M102 116h92v184h-92z" />
      <path d="M116 74h64a26 26 0 0 1 26 26v16H90v-16a26 26 0 0 1 26-26z" />
      <path d="M118 164h58v90h-58z" class="panel" />
    """,
    "shaving": """
      <path d="M142 72h44l-18 88h-44z" />
      <path d="M134 160l-52 128" class="thick" />
      <path d="M88 278l42 18" class="thick" />
      <path d="M112 118h76" class="accent" />
    """,
    "toothpaste": """
      <path d="M76 174h170l-34 70H84z" />
      <path d="M228 182h38v52h-38z" />
      <path d="M106 206h92" class="accent" />
      <path d="M98 154c28-22 68-22 104 0" class="accent" />
    """,
    "dish": """
      <path d="M124 68h42v26h-42z" />
      <path d="M104 94h84l16 206H88z" />
      <path d="M116 150h74v92h-74z" class="panel" />
      <path d="M118 266h70" class="accent" />
    """,
    "cleaning": """
      <path d="M120 78h72l10 36h-92z" />
      <path d="M102 114h108l-16 186h-76z" />
      <path d="M116 160h78v84h-78z" class="panel" />
      <path d="M210 90c20-18 36-24 58-18" class="accent" />
    """,
    "food": """
      <path d="M98 96h124l-16 206H114z" />
      <path d="M116 134h88v78h-88z" class="panel" />
      <path d="M124 238h72" class="accent" />
      <circle cx="196" cy="92" r="20" class="panel" />
    """,
    "generic": """
      <rect x="92" y="92" width="128" height="196" rx="26" />
      <path d="M114 144h86v88h-86z" class="panel" />
      <path d="M126 254h58" class="accent" />
    """,
}


TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="{label}">
  <rect width="320" height="320" rx="0" fill="#f5f5f7"/>
  <g fill="#ffffff" stroke="#b9b9bf" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
{icon}
  </g>
  <style>
    .panel {{ fill: #fbfbfd; }}
    .accent {{ fill: none; stroke: #86868b; stroke-width: 5; }}
    .accent-fill {{ fill: #86868b; stroke: none; }}
    .thick {{ fill: none; stroke: #b9b9bf; stroke-width: 12; }}
  </style>
</svg>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, icon in ICONS.items():
        svg = TEMPLATE.format(label=name.replace("-", " "), icon=icon.rstrip())
        (OUT / f"{name}.svg").write_text(svg, encoding="utf-8")
    print(f"Wrote {len(ICONS)} placeholders to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
