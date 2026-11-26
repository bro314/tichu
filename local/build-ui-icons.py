#!/usr/bin/env python3
"""Generate unified Option B (Card Tile) 4x3 UI icon sprite sheet at img/tichu-ui-icons.png.

Grid layout (1024x768, 4x3 cells of 256x256):
  Row 0: (0,0) grandtichucolor, (1,0) grandtichublack, (2,0) tichucolor, (3,0) tichublack
  Row 1: (0,1) firstoutcolor,   (1,1) hand,            (2,1) star,       (3,1) cardback
  Row 2: (0,2) round,           (1,2) trick,           (2,2) eye,        (3,2) scoreboard
"""

import re
import subprocess
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parent.parent
OUT_PATH = REPO / "img/tichu-ui-icons.png"

POTRACE = "/opt/homebrew/bin/potrace"
RSVG = "/opt/homebrew/bin/rsvg-convert"

# Exact flat Tichu card suit colors (img/svg/suits/*.svg)
SWORDS_BLACK = "#231f1e"
STARS_RED = "#ef1923"
PAGODAS_BLUE = "#00adef"
JADE_GREEN = "#00a650"

# Neutral grays & whites
WHITE = "#FFFFFF"
OFF_CARD_BG = "#FAFAFA"
OFF_HAIRLINE = "#E5E5E5"
OFF_FRAME = "#D9D9D9"
OFF_GLYPH = "#CCCCCC"
HAIRLINE_GRAY = "#D4D4D4"
MID_GRAY = "#525252"
STAR_YELLOW = "#f5b800"
STAR_OUTLINE = "#a16207"


def potrace_mask(
    mask: np.ndarray,
    turdsize: int = 2,
    alphamax: float = 1.0,
    opticurve: float = 0.2,
) -> tuple[list[str], str]:
    """Trace a boolean 2D mask (True = foreground) into potrace SVG paths + transform."""
    h, _ = mask.shape
    pbm = Image.fromarray(((1 - mask.astype(np.uint8)) * 255), mode="L").convert("1")
    with tempfile.TemporaryDirectory() as td:
        pbm_path = Path(td) / "mask.pbm"
        svg_path = Path(td) / "mask.svg"
        pbm.save(pbm_path)
        subprocess.run(
            [
                POTRACE,
                "--svg",
                "--flat",
                "-t",
                str(turdsize),
                "-a",
                str(alphamax),
                "-O",
                str(opticurve),
                str(pbm_path),
                "-o",
                str(svg_path),
            ],
            check=True,
        )
        svg_txt = svg_path.read_text(encoding="utf-8")
    g_m = re.search(r'<g\s+transform="([^"]+)"', svg_txt)
    transform = g_m.group(1) if g_m else f"translate(0,{h}) scale(0.1,-0.1)"
    paths = re.findall(r'<path\s+d="([^"]+)"', svg_txt, re.S)
    return paths, transform


def measure_vector_bbox(
    paths: list[str],
    g_transform: str,
    viewbox_size: float = 256.0,
) -> tuple[float, float, float, float]:
    """Measure exact rendered visual bounding box in viewBox coordinates."""
    path_els = "\n".join(f'<path d="{d}"/>' for d in paths)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{viewbox_size}" height="{viewbox_size}" '
        f'viewBox="0 0 {viewbox_size} {viewbox_size}">'
        f'<g transform="{g_transform}" fill="#000000" stroke="none">{path_els}</g></svg>'
    )
    with tempfile.TemporaryDirectory() as td:
        s_path = Path(td) / "measure.svg"
        p_path = Path(td) / "measure.png"
        s_path.write_text(svg, encoding="utf-8")
        subprocess.run([RSVG, "-w", "1024", "-h", "1024", str(s_path), "-o", str(p_path)], check=True)
        arr = np.asarray(Image.open(p_path).convert("RGBA"))
    ys, xs = np.where(arr[:, :, 3] > 20)
    scale_back = viewbox_size / 1024.0
    return (
        float(xs.min()) * scale_back,
        float(ys.min()) * scale_back,
        float(xs.max() + 1) * scale_back,
        float(ys.max() + 1) * scale_back,
    )


def load_suit_vector(svg_path: Path) -> dict:
    """Parse path data, group transform, viewBox, and visual bbox from img/svg/suits/*.svg."""
    txt = svg_path.read_text(encoding="utf-8")
    vb_m = re.search(r'viewBox="0\s+0\s+([0-9.]+)\s+([0-9.]+)"', txt)
    vb_size = float(vb_m.group(1)) if vb_m else 680.0
    g_m = re.search(r'<g\s+transform="([^"]+)"', txt)
    tf = g_m.group(1) if g_m else ""
    paths = re.findall(r'<path\s+d="([^"]+)"', txt, re.S)
    bbox = measure_vector_bbox(paths, tf, viewbox_size=vb_size)
    return {"paths": paths, "tf": tf, "bbox": bbox}


def extract_classic_call_vectors(icons_png: Path) -> dict[str, dict]:
    """Extract clean G, T, 1 shapes from bottom half of img/tichu-icons.png and trace via potrace."""
    sheet = Image.open(icons_png).convert("RGBA")
    bot = sheet.crop((0, 256, 1024, 512))
    arr = np.asarray(bot)
    a = arr[:, :, 3] > 128
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    masks = {
        "gt": a & (b > 150) & (r < 100),
        "t": a & (g > 100) & (r < 100) & (b < 150),
        "1": a & (r > 150) & (g < 100) & (b < 100),
    }

    glyphs: dict[str, dict] = {}
    for key, full_mask in masks.items():
        ys, xs = np.where(full_mask)
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        sub = full_mask[y0:y1, x0:x1]
        sh, sw = sub.shape
        canvas_mask = np.zeros((256, 256), dtype=bool)
        oy, ox = (256 - sh) // 2, (256 - sw) // 2
        canvas_mask[oy : oy + sh, ox : ox + sw] = sub

        paths, tf = potrace_mask(canvas_mask, turdsize=2, alphamax=1.0, opticurve=0.2)
        bbox = measure_vector_bbox(paths, tf, viewbox_size=256.0)
        glyphs[key] = {"paths": paths, "tf": tf, "bbox": bbox}
    return glyphs


def place_vector(
    vec: dict,
    cx: float,
    cy: float,
    target_height: float,
    fill: str,
    rotate_deg: float = 0.0,
    stroke: str | None = None,
    stroke_width_1024: float = 0.0,
) -> str:
    """Place a traced vector centered at (cx, cy) scaled to target_height in 1024-space."""
    x0, y0, x1, y1 = vec["bbox"]
    bx = (x0 + x1) * 0.5
    by = (y0 + y1) * 0.5
    bh = y1 - y0
    s = target_height / bh
    path_els = "\n".join(f'<path d="{d}"/>' for d in vec["paths"])
    rot = f" rotate({rotate_deg:.2f})" if rotate_deg else ""

    tf_scale = 1.0
    m = re.search(r'scale\(\s*([-0-9.]+)', vec["tf"])
    if m:
        tf_scale = abs(float(m.group(1))) or 1.0

    layers = []
    if stroke and stroke_width_1024 > 0:
        inner_sw = stroke_width_1024 / (s * tf_scale)
        layers.append(
            f'<g transform="{vec["tf"]}" fill="{stroke}" stroke="{stroke}" '
            f'stroke-width="{inner_sw:.2f}" stroke-linejoin="round" stroke-linecap="round">{path_els}</g>'
        )
    layers.append(f'<g transform="{vec["tf"]}" fill="{fill}" stroke="none">{path_els}</g>')

    return (
        f'<g transform="translate({cx:.2f},{cy:.2f}){rot} scale({s:.6f}) translate({-bx:.3f},{-by:.3f})">'
        + "".join(layers)
        + "</g>"
    )


def render_svg_256(svg_code: str) -> Image.Image:
    """Render 1024x1024 SVG via rsvg-convert and downsample cleanly to 256x256 RGBA."""
    with tempfile.TemporaryDirectory() as td:
        svg_path = Path(td) / "cell.svg"
        png_path = Path(td) / "cell.png"
        svg_path.write_text(svg_code, encoding="utf-8")
        subprocess.run(
            [RSVG, "-w", "1024", "-h", "1024", str(svg_path), "-o", str(png_path)],
            check=True,
        )
        hi = Image.open(png_path).convert("RGBA")
    return hi.resize((256, 256), Image.Resampling.LANCZOS)


def fit_and_shadow_256(
    img: Image.Image,
    target_span: int = 224,
    with_shadow: bool = True,
) -> Image.Image:
    """Fit artwork into 256x256 with safe margin and optional bounded soft drop shadow."""
    mask = img.split()[3].point(lambda v: 255 if v > 8 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    scale = min(target_span / cw, target_span / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    px = (256 - nw) // 2
    py = (256 - nh) // 2

    if with_shadow:
        alpha = resized.split()[3]
        shadow_alpha = alpha.point(lambda a: int(a * 0.20))
        shadow = Image.new("RGBA", (nw, nh), (15, 23, 42, 255))
        shadow.putalpha(shadow_alpha)

        shadow_layer = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        shadow_layer.paste(shadow, (px, py + 3))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=3.2))
        canvas.alpha_composite(shadow_layer)

    canvas.alpha_composite(resized, (px, py))

    # Guarantee zero cell-boundary bleed on 1px outer border
    arr = np.asarray(canvas).copy()
    arr[0, :, 3] = 0
    arr[255, :, 3] = 0
    arr[:, 0, 3] = 0
    arr[:, 255, 3] = 0
    return Image.fromarray(arr, mode="RGBA")


def build_card_tile_badge(glyph_vec: dict, glyph_key: str, is_on: bool) -> Image.Image:
    """Build Option B Card Tile cell for T, GT, or 1 (On or Off)."""
    on_colors = {"t": JADE_GREEN, "gt": PAGODAS_BLUE, "1": STARS_RED}
    color = on_colors[glyph_key] if is_on else OFF_GLYPH
    frame_col = on_colors[glyph_key] if is_on else OFF_FRAME
    card_bg = WHITE if is_on else OFF_CARD_BG
    outer_line = HAIRLINE_GRAY if is_on else OFF_HAIRLINE
    opt_x = {"t": 6.0, "gt": 0.0, "1": -8.0}[glyph_key]

    def corner_fret(cx_sign: int, cy_sign: int) -> str:
        sx = -1 if cx_sign > 0 else 1
        sy = -1 if cy_sign > 0 else 1
        return f"""
        <g transform="translate(512,512) scale({sx},{sy}) translate(-512,-512)">
          <rect x="128" y="128" width="52" height="52" fill="{card_bg}" stroke="{frame_col}" stroke-width="11"/>
          <rect x="150" y="150" width="30" height="30" fill="none" stroke="{frame_col}" stroke-width="9"/>
        </g>"""

    g_el = place_vector(
        glyph_vec,
        cx=512 + opt_x,
        cy=512,
        target_height=550,
        fill=color,
    )
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="72" y="72" width="880" height="880" rx="96" ry="96" fill="{card_bg}" stroke="{outer_line}" stroke-width="6"/>
  <rect x="128" y="128" width="768" height="768" rx="18" ry="18" fill="none" stroke="{frame_col}" stroke-width="13"/>
  <rect x="152" y="152" width="720" height="720" rx="8" ry="8" fill="none" stroke="{frame_col}" stroke-width="9"/>
  {corner_fret(-1, -1)}
  {corner_fret(1, -1)}
  {corner_fret(-1, 1)}
  {corner_fret(1, 1)}
  {g_el}
</svg>"""
    return fit_and_shadow_256(render_svg_256(svg), target_span=224, with_shadow=True)


def build_hand_cell(suits: dict[str, dict]) -> Image.Image:
    """(1,1) hand (18px): crisp 3-card fan with Pagoda, Jade, and Star pips."""
    # Bold #231f1e borders (stroke-width=38) stay crisp at 18px without dark cartoon bloat
    pip_blue = place_vector(suits["pagodas"], cx=-98, cy=-142, target_height=136, fill=PAGODAS_BLUE)
    pip_green = place_vector(suits["jade"], cx=-96, cy=-145, target_height=136, fill=JADE_GREEN)
    pip_star = place_vector(suits["stars"], cx=0, cy=10, target_height=265, fill=STARS_RED)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Back-left card -->
  <g transform="translate(335,525) rotate(-14)">
    <rect x="-200" y="-285" width="400" height="570" rx="52" ry="52" fill="{WHITE}" stroke="{SWORDS_BLACK}" stroke-width="38"/>
    {pip_blue}
  </g>
  <!-- Center card -->
  <g transform="translate(505,470) rotate(0)">
    <rect x="-200" y="-285" width="400" height="570" rx="52" ry="52" fill="{WHITE}" stroke="{SWORDS_BLACK}" stroke-width="38"/>
    {pip_green}
  </g>
  <!-- Front-right card -->
  <g transform="translate(680,535) rotate(13)">
    <rect x="-200" y="-285" width="400" height="570" rx="52" ry="52" fill="{WHITE}" stroke="{SWORDS_BLACK}" stroke-width="38"/>
    {pip_star}
  </g>
</svg>"""
    return fit_and_shadow_256(render_svg_256(svg), target_span=226, with_shadow=False)


def build_star_cell(suits: dict[str, dict]) -> Image.Image:
    """(2,1) star (18px & 22px): official Tichu star shape in flat golden yellow with crisp contour."""
    star_el = place_vector(
        suits["stars"],
        cx=512,
        cy=512,
        target_height=800,
        fill=STAR_YELLOW,
        stroke=STAR_OUTLINE,
        stroke_width_1024=34,
    )
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  {star_el}
</svg>"""
    return fit_and_shadow_256(render_svg_256(svg), target_span=226, with_shadow=False)


def build_cardback_cell() -> Image.Image:
    """(3,1) cardback (28px): vertical miniature Tichu card back echoing Option B fretwork."""
    # Outer white margin: x=196..828 (w=632), y=72..952 (h=880), rx=72
    # Black inner face: x=240..784 (w=544), y=116..908 (h=792), rx=44
    # Double white inner border + corner frets echoing Option B
    def cb_fret(cx_sign: int, cy_sign: int) -> str:
        sx = -1 if cx_sign > 0 else 1
        sy = -1 if cy_sign > 0 else 1
        return f"""
        <g transform="translate(512,512) scale({sx},{sy}) translate(-512,-512)">
          <rect x="272" y="148" width="44" height="44" fill="{SWORDS_BLACK}" stroke="{WHITE}" stroke-width="10"/>
          <rect x="292" y="168" width="24" height="24" fill="none" stroke="{WHITE}" stroke-width="8"/>
        </g>"""

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="196" y="72" width="632" height="880" rx="72" ry="72" fill="{WHITE}" stroke="{HAIRLINE_GRAY}" stroke-width="8"/>
  <rect x="238" y="114" width="548" height="796" rx="44" ry="44" fill="{SWORDS_BLACK}"/>
  <rect x="272" y="148" width="480" height="728" rx="14" ry="14" fill="none" stroke="{WHITE}" stroke-width="11"/>
  <rect x="294" y="170" width="436" height="684" rx="8" ry="8" fill="none" stroke="{WHITE}" stroke-width="7"/>
  {cb_fret(-1, -1)}
  {cb_fret(1, -1)}
  {cb_fret(-1, 1)}
  {cb_fret(1, 1)}
  <!-- Clean geometric center seal -->
  <polygon points="512,356 644,512 512,668 380,512" fill="none" stroke="{WHITE}" stroke-width="18" stroke-linejoin="round"/>
  <circle cx="512" cy="512" r="78" fill="none" stroke="{WHITE}" stroke-width="18"/>
  <circle cx="512" cy="512" r="28" fill="{WHITE}"/>
</svg>"""
    return fit_and_shadow_256(render_svg_256(svg), target_span=224, with_shadow=True)


def build_round_cell() -> Image.Image:
    """(0,2) round (22px): plain flat Stars-red pennant flag & high-contrast pole."""
    pennant = "M 244 162 L 908 386 L 244 610 Z"
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Subtle white outer halo on pole & pennant so it reads cleanly on Midnight Slate -->
  <line x1="208" y1="150" x2="208" y2="906" stroke="{WHITE}" stroke-width="76" stroke-linecap="round"/>
  <circle cx="208" cy="128" r="72" fill="{WHITE}"/>
  <path d="{pennant}" fill="{WHITE}" stroke="{WHITE}" stroke-width="34" stroke-linejoin="round"/>
  <!-- Pole & finial -->
  <line x1="208" y1="150" x2="208" y2="906" stroke="{MID_GRAY}" stroke-width="46" stroke-linecap="round"/>
  <circle cx="208" cy="128" r="48" fill="{SWORDS_BLACK}"/>
  <!-- Plain red pennant -->
  <path d="{pennant}" fill="{STARS_RED}" stroke="{STARS_RED}" stroke-width="14" stroke-linejoin="round"/>
</svg>"""
    return fit_and_shadow_256(render_svg_256(svg), target_span=224, with_shadow=False)


def build_trick_cell(suits: dict[str, dict]) -> Image.Image:
    """(1,2) trick (22px): two fanned white playing cards with Jade & Star suit pips."""
    jade_el = place_vector(suits["jade"], cx=-82, cy=-14, target_height=205, fill=JADE_GREEN)
    star_el = place_vector(suits["stars"], cx=0, cy=0, target_height=285, fill=STARS_RED)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Back-left Jade card -->
  <g transform="translate(366,500) rotate(-11)">
    <rect x="-235" y="-325" width="470" height="650" rx="58" ry="58" fill="{WHITE}" stroke="{SWORDS_BLACK}" stroke-width="42"/>
    {jade_el}
  </g>
  <!-- Front-right Star card -->
  <g transform="translate(658,524) rotate(9)">
    <rect x="-235" y="-325" width="470" height="650" rx="58" ry="58" fill="{WHITE}" stroke="{SWORDS_BLACK}" stroke-width="42"/>
    {star_el}
  </g>
</svg>"""
    return fit_and_shadow_256(render_svg_256(svg), target_span=224, with_shadow=False)


def build_eye_cell() -> Image.Image:
    """(2,2) eye (22px): flat geometric eye with Pagoda-blue iris, readable on light & dark."""
    almond = "M 92 512 Q 512 152 932 512 Q 512 872 92 512 Z"
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Subtle crisp outer white halo for dark-mode visibility -->
  <path d="{almond}" fill="none" stroke="{WHITE}" stroke-width="84" stroke-linejoin="round"/>
  <path d="{almond}" fill="{WHITE}" stroke="{SWORDS_BLACK}" stroke-width="50" stroke-linejoin="round"/>
  <circle cx="512" cy="512" r="196" fill="{PAGODAS_BLUE}"/>
  <circle cx="512" cy="512" r="96" fill="{SWORDS_BLACK}"/>
  <circle cx="578" cy="446" r="44" fill="{WHITE}"/>
</svg>"""
    return fit_and_shadow_256(render_svg_256(svg), target_span=226, with_shadow=False)


def build_scoreboard_cell() -> Image.Image:
    """(3,2) scoreboard (22px): Option-B style scorepad card with Black/Red team columns."""
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Card base -->
  <rect x="88" y="88" width="848" height="848" rx="96" ry="96" fill="{WHITE}" stroke="{SWORDS_BLACK}" stroke-width="38"/>
  <!-- Team header pills (Black vs Red) -->
  <rect x="166" y="168" width="292" height="100" rx="44" ry="44" fill="{SWORDS_BLACK}"/>
  <rect x="566" y="168" width="292" height="100" rx="44" ry="44" fill="{STARS_RED}"/>
  <!-- Grid dividers -->
  <line x1="106" y1="322" x2="918" y2="322" stroke="{SWORDS_BLACK}" stroke-width="30"/>
  <line x1="512" y1="106" x2="512" y2="918" stroke="{SWORDS_BLACK}" stroke-width="30"/>
  <line x1="120" y1="516" x2="904" y2="516" stroke="{HAIRLINE_GRAY}" stroke-width="18"/>
  <line x1="120" y1="708" x2="904" y2="708" stroke="{HAIRLINE_GRAY}" stroke-width="18"/>
  <!-- Row 1 score bars (Jade Tichu call + neutral) -->
  <rect x="176" y="388" width="272" height="64" rx="32" ry="32" fill="{JADE_GREEN}"/>
  <rect x="576" y="388" width="236" height="64" rx="32" ry="32" fill="{MID_GRAY}"/>
  <!-- Row 2 score bars (neutral + Pagoda GT call) -->
  <rect x="176" y="580" width="232" height="64" rx="32" ry="32" fill="{MID_GRAY}"/>
  <rect x="576" y="580" width="272" height="64" rx="32" ry="32" fill="{PAGODAS_BLUE}"/>
  <!-- Row 3 score bars (total) -->
  <rect x="176" y="772" width="272" height="64" rx="32" ry="32" fill="{SWORDS_BLACK}"/>
  <rect x="576" y="772" width="272" height="64" rx="32" ry="32" fill="{STARS_RED}"/>
</svg>"""
    return fit_and_shadow_256(render_svg_256(svg), target_span=224, with_shadow=True)


def main() -> None:
    glyphs = extract_classic_call_vectors(REPO / "img/tichu-icons.png")
    suits = {
        "stars": load_suit_vector(REPO / "img/svg/suits/stars.svg"),
        "jade": load_suit_vector(REPO / "img/svg/suits/jade.svg"),
        "pagodas": load_suit_vector(REPO / "img/svg/suits/pagodas.svg"),
    }

    cells: dict[tuple[int, int], Image.Image] = {
        # Row 0: GT On, GT Off, T On, T Off
        (0, 0): build_card_tile_badge(glyphs["gt"], "gt", True),
        (1, 0): build_card_tile_badge(glyphs["gt"], "gt", False),
        (2, 0): build_card_tile_badge(glyphs["t"], "t", True),
        (3, 0): build_card_tile_badge(glyphs["t"], "t", False),
        # Row 1: 1st Out, Hand, Star, Pass Cardback
        (0, 1): build_card_tile_badge(glyphs["1"], "1", True),
        (1, 1): build_hand_cell(suits),
        (2, 1): build_star_cell(suits),
        (3, 1): build_cardback_cell(),
        # Row 2: Round, Trick, Eye, Scoreboard
        (0, 2): build_round_cell(),
        (1, 2): build_trick_cell(suits),
        (2, 2): build_eye_cell(),
        (3, 2): build_scoreboard_cell(),
    }

    sheet = Image.new("RGBA", (1024, 768), (0, 0, 0, 0))
    for (col, row), cell_img in cells.items():
        sheet.paste(cell_img, (col * 256, row * 256))

    sheet.save(OUT_PATH, optimize=True)
    print(f"Saved {OUT_PATH} ({sheet.size[0]}x{sheet.size[1]}, mode={sheet.mode})")


if __name__ == "__main__":
    main()
