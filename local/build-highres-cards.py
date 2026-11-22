#!/usr/bin/env python3
"""Build 2.8x HiDPI (3920x1680) Tichu card sprite, 280x420 extras, and clean SVGs from img/highres/."""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent
HIGHRES_DIR = REPO_ROOT / "img" / "highres"
SVG_CARDS_DIR = REPO_ROOT / "img" / "svg" / "cards"
SVG_SUITS_DIR = REPO_ROOT / "img" / "svg" / "suits"
OUT_CARDS_PNG = REPO_ROOT / "img" / "tichu-cards.png"
OUT_MAHJONG_PNG = REPO_ROOT / "img" / "tichu-mahjong.png"
OUT_PASS_PNG = REPO_ROOT / "img" / "tichu-icons-pass.png"

POTRACE_BIN = "/opt/homebrew/bin/potrace"
RSVG_BIN = "/opt/homebrew/bin/rsvg-convert"
PNGQUANT_BIN = "/opt/homebrew/bin/pngquant"

CELL_W = 280
CELL_H = 420
GRID_COLS = 14
GRID_ROWS = 4

SUITS = [
    ("S", "swords", "drache.jpg", np.array([35.0, 31.0, 30.0], dtype=np.float32)),
    ("R", "stars", "phönix.jpg", np.array([239.0, 25.0, 35.0], dtype=np.float32)),
    ("B", "pagodas", "hund.jpg", np.array([0.0, 173.0, 239.0], dtype=np.float32)),
    ("G", "jade", "mahjong.jpg", np.array([0.0, 166.0, 80.0], dtype=np.float32)),
]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
PIP_RANKS = {"2", "3", "4", "5", "6", "7", "8", "9", "10", "A"}

CANONICAL_INKS = {
    "Red": np.array([240.0, 24.0, 34.0], dtype=np.float32),
    "Blue": np.array([0.0, 173.0, 239.0], dtype=np.float32),
    "Green": np.array([0.0, 166.0, 80.0], dtype=np.float32),
    "Yellow": np.array([255.0, 243.0, 0.0], dtype=np.float32),
}


def build_highres_index() -> dict[str, Path]:
    """Index img/highres/*.jpg by NFC-normalized filename (handles macOS NFD e.g. phönix.jpg)."""
    index: dict[str, Path] = {}
    for p in HIGHRES_DIR.glob("*.jpg"):
        index[unicodedata.normalize("NFC", p.name)] = p
    return index


def dilate_mask(mask: np.ndarray, radius: int) -> np.ndarray:
    """Binary dilation by square radius."""
    if radius <= 0:
        return mask.copy()
    img = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    dilated = img.filter(ImageFilter.MaxFilter(2 * radius + 1))
    return np.asarray(dilated) > 127


def box_blur_f32(arr: np.ndarray, radius: int) -> np.ndarray:
    """Fast 2D box blur on float32 [0..255] single-channel array."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode="L")
    return np.asarray(img.filter(ImageFilter.BoxBlur(radius)), dtype=np.float32)


def min_max_gray_window(gray: np.ndarray, size: int) -> tuple[np.ndarray, np.ndarray]:
    """Compute local min and max of grayscale image in a size x size window."""
    img = Image.fromarray(np.clip(gray, 0, 255).astype(np.uint8), mode="L")
    g_min = np.asarray(img.filter(ImageFilter.MinFilter(size)), dtype=np.float32)
    g_max = np.asarray(img.filter(ImageFilter.MaxFilter(size)), dtype=np.float32)
    return g_min, g_max


def clean_outer_scan_border(arr: np.ndarray, border_px: int = 3) -> np.ndarray:
    """Remove 1-3px dark scanner rim around the outer edge of 700x1078 card scans."""
    out = arr.copy()
    out[:border_px, :, :] = 255.0
    out[-border_px:, :, :] = 255.0
    out[:, :border_px, :] = 255.0
    out[:, -border_px:, :] = 255.0
    return out


def remove_grid_seams(arr: np.ndarray) -> np.ndarray:
    """Stage A: Surgical 64x64 tile seam removal strictly on x%64==0, y%64==0 + ±1 flat ringing."""
    out = clean_outer_scan_border(arr.astype(np.float32))
    h, w, _ = out.shape

    x_seams = list(range(64, w - 1, 64))
    y_seams = list(range(64, h - 1, 64))
    y_seam_set = set(y_seams)
    x_seam_set = set(x_seams)

    for x in x_seams:
        for y in range(1, h - 1):
            if y in y_seam_set:
                continue
            cur = out[y, x]
            left = out[y, x - 1]
            right = out[y, x + 1]
            if np.max(np.abs(left - right)) < 45.0:
                mid = 0.5 * (left + right)
                if cur.mean() > mid.mean() + 1.5 or np.max(np.abs(cur - mid)) > 6.0:
                    out[y, x] = mid
            else:
                up = out[y - 1, x]
                dn = out[y + 1, x]
                if (y - 1) not in y_seam_set and (y + 1) not in y_seam_set and np.max(np.abs(up - dn)) < 45.0:
                    mid_v = 0.5 * (up + dn)
                    if cur.mean() > mid_v.mean() + 6.0:
                        out[y, x] = mid_v
                elif cur.mean() > max(left.mean(), right.mean()) + 5.0:
                    out[y, x] = 0.5 * (left + right)

    for y in y_seams:
        for x in range(1, w - 1):
            if x in x_seam_set:
                continue
            cur = out[y, x]
            up = out[y - 1, x]
            dn = out[y + 1, x]
            if np.max(np.abs(up - dn)) < 45.0:
                mid = 0.5 * (up + dn)
                if cur.mean() > mid.mean() + 1.5 or np.max(np.abs(cur - mid)) > 6.0:
                    out[y, x] = mid
            else:
                left = out[y, x - 1]
                right = out[y, x + 1]
                if (x - 1) not in x_seam_set and (x + 1) not in x_seam_set and np.max(np.abs(left - right)) < 45.0:
                    mid_h = 0.5 * (left + right)
                    if cur.mean() > mid_h.mean() + 6.0:
                        out[y, x] = mid_h
                elif cur.mean() > max(up.mean(), dn.mean()) + 5.0:
                    out[y, x] = 0.5 * (up + dn)

    for y in y_seams:
        for x in x_seams:
            n4 = np.stack([out[y - 1, x], out[y + 1, x], out[y, x - 1], out[y, x + 1]], axis=0)
            dv = np.max(np.abs(n4[0] - n4[1]))
            dh = np.max(np.abs(n4[2] - n4[3]))
            if dv < 45.0 and dh < 45.0:
                out[y, x] = n4.mean(axis=0)
            elif dv <= dh:
                out[y, x] = 0.5 * (n4[0] + n4[1])
            else:
                out[y, x] = 0.5 * (n4[2] + n4[3])

    ref = out.copy()
    for x in x_seams:
        for dx in (-1, 1):
            cx = x + dx
            if cx < 2 or cx >= w - 2:
                continue
            p_m2 = ref[:, cx - 2]
            p_p2 = ref[:, cx + 2]
            cur = ref[:, cx]
            flat = (np.max(np.abs(p_m2 - p_p2), axis=1) < 12.0) & (0.5 * (p_m2.mean(axis=1) + p_p2.mean(axis=1)) < 180.0)
            mid = 0.5 * (p_m2 + p_p2)
            ring = flat & (cur.mean(axis=1) > mid.mean(axis=1) + 10.0)
            out[ring, cx] = mid[ring]

    ref2 = out.copy()
    for y in y_seams:
        for dy in (-1, 1):
            cy = y + dy
            if cy < 2 or cy >= h - 2:
                continue
            p_m2 = ref2[cy - 2, :]
            p_p2 = ref2[cy + 2, :]
            cur = ref2[cy, :]
            flat = (np.max(np.abs(p_m2 - p_p2), axis=1) < 12.0) & (0.5 * (p_m2.mean(axis=1) + p_p2.mean(axis=1)) < 180.0)
            mid = 0.5 * (p_m2 + p_p2)
            ring = flat & (cur.mean(axis=1) > mid.mean(axis=1) + 10.0)
            out[cy, ring] = mid[ring]

    return np.clip(out, 0.0, 255.0)


def pad_to_2_3(arr: np.ndarray, fill: float = 255.0) -> np.ndarray:
    """Pad 700x1078 card with +10 left, +9 right pixels -> 719x1078 (exact 2:3 aspect)."""
    h, w, c = arr.shape
    if (w, h) == (719, 1078):
        return arr
    padded = np.full((h, 719, c), fill, dtype=arr.dtype)
    padded[:, 10 : 10 + w, :] = arr
    return padded


def trace_matte_to_svg(
    matte: np.ndarray,
    ink: np.ndarray,
    svg_out: Path,
    tmp_dir: Path,
    square_size: int | None = None,
) -> None:
    """Upscale matte 2x bicubic, trace with potrace to clean SVG."""
    cov_img = Image.fromarray(np.clip(matte * 255.0, 0, 255).astype(np.uint8), mode="L")
    up2x = cov_img.resize((matte.shape[1] * 2, matte.shape[0] * 2), Image.Resampling.BICUBIC)
    bw = (np.asarray(up2x) >= 128).astype(np.uint8)

    pbm_path = tmp_dir / f"{svg_out.stem}.pbm"
    Image.fromarray((1 - bw) * 255, mode="L").convert("1").save(pbm_path)

    hex_ink = "#{:02X}{:02X}{:02X}".format(int(round(ink[0])), int(round(ink[1])), int(round(ink[2])))
    subprocess.run(
        [
            POTRACE_BIN,
            str(pbm_path),
            "--svg",
            "--turdsize",
            "8",
            "--alphamax",
            "1.0",
            "--opttolerance",
            "0.2",
            "--color",
            hex_ink,
            "-o",
            str(svg_out),
        ],
        check=True,
    )

    if square_size is not None:
        text = svg_out.read_text(encoding="utf-8")
        text = re.sub(
            r'width="[0-9.]+pt"\s+height="[0-9.]+pt"',
            f'width="{square_size}" height="{square_size}"',
            text,
            count=1,
        )
        svg_out.write_text(text, encoding="utf-8")


def process_pip_card(
    arr_raw: np.ndarray,
    ink: np.ndarray,
    svg_out: Path,
    tmp_dir: Path,
) -> tuple[Image.Image, np.ndarray]:
    """Stage B: Clean single-ink pip card, trace SVG, and rasterize to 280x420 via rsvg-convert."""
    seamed = remove_grid_seams(arr_raw)

    vec = 255.0 - ink
    denom = float(np.dot(vec, vec))
    cov = np.clip(np.sum((255.0 - seamed) * vec, axis=2) / denom, 0.0, 1.0)

    cov[cov < 0.05] = 0.0
    bg_dilated = dilate_mask(cov < 0.15, 2)
    fg_dilated = dilate_mask(cov > 0.35, 2)
    boundary = bg_dilated & fg_dilated

    cov_clean = cov.copy()
    cov_clean[(~boundary) & (cov_clean >= 0.35)] = 1.0
    cov_clean[cov_clean > 0.95] = 1.0
    cov_clean[(~boundary) & (cov_clean < 0.35)] = 0.0

    cov_padded = pad_to_2_3(cov_clean[..., None], fill=0.0)[:, :, 0]
    trace_matte_to_svg(cov_padded, ink, svg_out, tmp_dir)

    png_tmp = tmp_dir / f"{svg_out.stem}_3x.png"
    subprocess.run(
        [
            RSVG_BIN,
            "-w",
            str(CELL_W),
            "-h",
            str(CELL_H),
            "--background-color=white",
            str(svg_out),
            "-o",
            str(png_tmp),
        ],
        check=True,
    )
    return Image.open(png_tmp).convert("RGB"), cov_clean


def build_suit_svg(cov_clean: np.ndarray, ink: np.ndarray, svg_out: Path, tmp_dir: Path) -> None:
    """Extract center Ace pip matte, square-pad with ~8% margin, and trace standalone suit SVG."""
    center = cov_clean[280:800, 140:560]
    ys, xs = np.where(center > 0.25)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    cropped = center[y0:y1, x0:x1]
    ch, cw = cropped.shape
    side = int(round(max(ch, cw) * 1.16))
    square = np.zeros((side, side), dtype=np.float32)
    oy = (side - ch) // 2
    ox = (side - cw) // 2
    square[oy : oy + ch, ox : ox + cw] = cropped
    trace_matte_to_svg(square, ink, svg_out, tmp_dir, square_size=100)


def refine_card_inks(arr: np.ndarray) -> dict[str, np.ndarray]:
    """Refine canonical chromatic ink RGBs using clean high-saturation pixels on the card."""
    inks: dict[str, np.ndarray] = {}
    for name, base in CANONICAL_INKS.items():
        dist = np.linalg.norm(arr - base, axis=2)
        clean_pts = arr[dist < 22.0]
        if len(clean_pts) >= 200:
            inks[name] = np.median(clean_pts, axis=0).astype(np.float32)
        else:
            inks[name] = base.copy()
    return inks


def clean_illustrated_card(arr_raw: np.ndarray) -> tuple[np.ndarray, dict[str, int]]:
    """Stage C: Surgical grid seam removal + hardened texture-safe 64px tile streak restoration."""
    out = remove_grid_seams(arr_raw)
    h, w, _ = out.shape
    inks = refine_card_inks(out)

    chroma = out.max(axis=2) - out.min(axis=2)
    gray = out.mean(axis=2)
    m_obs = out.min(axis=2)
    R, G, B = out[:, :, 0], out[:, :, 1], out[:, :, 2]

    # Safety mask 1: near-white paper/buttons/eyes (2px dilation protects AA borders)
    near_white_core = (m_obs > 210.0) & (chroma < 38.0)
    near_white = dilate_mask(near_white_core, 2)

    # Safety mask 2 & 3: stipple/crosshatch/woodcut/feather textures
    g_min, g_max = min_max_gray_window(gray, 7)
    v_diff = np.abs(np.diff(gray, axis=0, prepend=gray[:1]))
    v_osc_5 = box_blur_f32(v_diff, 2)
    is_stipple_or_hatch = (g_max > 205.0) & (g_min < 90.0) & (v_osc_5 > 22.0)
    is_textured_hatch = (v_osc_5 > 20.0) & ((g_max - g_min) > 55.0)

    # Safety mask 4 & 5: olive/khaki/gold fills (R_J coat, S_J blade, R_K frame, mahjong bamboo) & pink halftone skin (G_J)
    is_olive_gold = (R < 220.0) & (G < 215.0) & (np.abs(R - G) < 30.0) & ((G - B) > 20.0)
    is_pink_halftone = (R > 195.0) & (B > 170.0) & (G > 160.0) & (R > G + 8.0) & (B > G)

    protect = near_white | is_stipple_or_hatch | is_textured_hatch | is_olive_gold | is_pink_halftone

    is_sat_bg = (G > R + 35.0) & (B > R + 35.0)
    is_sat_yel = (R > B + 50.0) & (G > B + 50.0)
    is_red_dom = (R > G + 40.0) & (R > B + 35.0)
    is_neutral_dark = chroma < 28.0

    m_base = np.full((h, w), 10.0, dtype=np.float32)
    m_base[is_sat_bg | is_sat_yel] = 0.0
    m_base[is_red_dom & (R >= 180.0)] = 24.0
    m_base[is_red_dom & (R < 180.0)] = 10.0
    m_base[is_neutral_dark] = 24.0

    alpha_m = np.clip((m_obs - m_base) / (255.0 - m_base), 0.0, 1.0)

    anchor_mask = np.zeros((h, w), dtype=bool)
    anchor_alpha = np.zeros((h, w), dtype=np.float32)

    for iname, C in inks.items():
        d = 255.0 - C
        denom = float(np.dot(d, d))
        a_k = np.sum((out - C) * d, axis=2) / denom
        proj = C + a_k[..., None] * d
        err = np.linalg.norm(out - proj, axis=2)
        if iname == "Yellow":
            m_k = (
                (err < 24.0)
                & (a_k >= 0.14)
                & (a_k <= 0.44)
                & (R > 225.0)
                & (G > 215.0)
                & (B >= 35.0)
                & (B <= 125.0)
                & (~protect)
            )
        else:
            m_k = (err < 26.0) & (a_k >= 0.13) & (a_k <= 0.44) & (~protect)
        better = m_k & ((~anchor_mask) | (a_k > anchor_alpha))
        anchor_mask |= m_k
        anchor_alpha[better] = a_k[better]

    up_diff = np.abs(gray - np.roll(gray, 1, axis=0))
    dn_diff = np.abs(gray - np.roll(gray, -1, axis=0))
    one_sided_smooth = np.minimum(up_diff, dn_diff) < 18.0
    a_blk = (gray - 28.0) / (255.0 - 28.0)
    m_blk = (chroma < 26.0) & (gray >= 62.0) & (gray <= 145.0) & (~protect) & one_sided_smooth
    clean_black_mask = (gray < 48.0) & (chroma < 25.0)

    work = out.copy()
    stats = {"tile_cols_fixed": 0, "pixels_restored": 0}

    for ty in range((h + 63) // 64):
        y0 = ty * 64
        y1 = min(h, y0 + 64)
        band_h = y1 - y0
        if band_h < 12:
            continue

        pad_top = max(0, y0 - 4)
        pad_bot = min(h, y1 + 4)
        cb_band_dil = dilate_mask(clean_black_mask[pad_top:pad_bot], 6)[y0 - pad_top : y1 - pad_top]
        blk_valid_band = np.zeros((band_h, w), dtype=bool)
        for cx in range(w):
            col_b = m_blk[y0:y1, cx]
            if col_b.sum() >= 6:
                x_l, x_r = max(0, cx - 10), min(w, cx + 11)
                if cb_band_dil[:, cx].any() or clean_black_mask[pad_top:pad_bot, x_l:x_r].sum() > 20:
                    blk_valid_band[:, cx] = col_b

        band_anchor = anchor_mask[y0:y1] | blk_valid_band
        band_anchor_alpha = np.where(anchor_mask[y0:y1], anchor_alpha[y0:y1], np.where(blk_valid_band, a_blk[y0:y1], 0.0))
        band_washed = (~protect[y0:y1]) & (alpha_m[y0:y1] >= 0.12) & (alpha_m[y0:y1] <= 0.45)

        primary_cols = band_anchor.sum(axis=0) >= 6
        neighbor_primary = np.zeros(w, dtype=bool)
        for dx in range(-3, 4):
            shifted = np.roll(primary_cols, dx)
            if dx > 0:
                shifted[:dx] = False
            elif dx < 0:
                shifted[dx:] = False
            neighbor_primary |= shifted

        col_washed_cnt = (band_anchor | band_washed).sum(axis=0)
        col_alpha_est = np.zeros(w, dtype=np.float32)
        for cx in range(w):
            if primary_cols[cx]:
                col_alpha_est[cx] = float(np.median(band_anchor_alpha[band_anchor[:, cx], cx]))
        for cx in range(w):
            if not primary_cols[cx] and neighbor_primary[cx] and col_washed_cnt[cx] >= 4:
                vals = alpha_m[y0:y1, cx][band_washed[:, cx]]
                if len(vals) > 0:
                    col_alpha_est[cx] = float(np.median(vals))
                else:
                    nbrs = col_alpha_est[max(0, cx - 3) : min(w, cx + 4)]
                    col_alpha_est[cx] = float(np.max(nbrs)) if nbrs.size else 0.0

        active_cols = np.where(col_alpha_est >= 0.08)[0]
        if len(active_cols) == 0:
            continue

        for cx in active_cols:
            alpha_col = float(np.clip(col_alpha_est[cx], 0.08, 0.44))
            alpha_cap = min(0.45, alpha_col + 0.14)
            px_mask = (~protect[y0:y1, cx]) & (alpha_m[y0:y1, cx] >= 0.08) & (alpha_m[y0:y1, cx] <= 0.46)
            if not px_mask.any():
                continue

            ys_fix = np.where(px_mask)[0]
            a_px = alpha_m[y0 + ys_fix, cx]
            a_use = np.clip(a_px, 0.0, alpha_cap)[:, None]
            orig_px = out[y0 + ys_fix, cx]
            restored = (orig_px - 255.0 * a_use) / (1.0 - a_use)
            work[y0 + ys_fix, cx] = np.clip(restored, 0.0, 255.0)
            stats["tile_cols_fixed"] += 1
            stats["pixels_restored"] += len(ys_fix)

    return np.clip(work, 0.0, 255.0), stats


def resize_3x(arr: np.ndarray) -> Image.Image:
    """Pad 700x1078 -> 719x1078 (2:3), downscale to 280x420 with Lanczos + subtle unsharp."""
    padded = pad_to_2_3(arr)
    im = Image.fromarray(np.clip(padded, 0, 255).astype(np.uint8), mode="RGB")
    resized = im.resize((CELL_W, CELL_H), Image.Resampling.LANCZOS)
    return resized.filter(ImageFilter.UnsharpMask(radius=0.7, percent=40, threshold=2))


def process_card_back(src_path: Path) -> Image.Image:
    """Crop corner registration dots from rs_schwarz.jpg, pad to 2:3 with charcoal, and resize to 280x420."""
    arr = np.asarray(Image.open(src_path).convert("RGB"), dtype=np.float32)
    cropped = arr[26:1073, 18:703]  # 685x1047 (clears corner dots at 8..15px)
    ch, cw, _ = cropped.shape
    charcoal = np.median(cropped[:12, :12].reshape(-1, 3), axis=0)
    padded = np.empty((ch, 698, 3), dtype=np.float32)
    padded[:, :, :] = charcoal
    padded[:, 7 : 7 + cw, :] = cropped  # 698x1047 = exact 2:3
    im = Image.fromarray(np.clip(padded, 0, 255).astype(np.uint8), mode="RGB")
    resized = im.resize((CELL_W, CELL_H), Image.Resampling.LANCZOS)
    return resized.filter(ImageFilter.UnsharpMask(radius=0.6, percent=35, threshold=2))


def quantize_with_pngquant(rgb_img: Image.Image, out_path: Path, tmp_dir: Path, nofs: bool = True) -> None:
    """Quantize an RGB PIL image to 256-color palette PNG using pngquant."""
    rgb_tmp = tmp_dir / f"{out_path.stem}_rgb_tmp.png"
    rgb_img.save(rgb_tmp, format="PNG", optimize=False)
    cmd = [PNGQUANT_BIN, "256", "--speed", "1", "--force", "--output", str(out_path)]
    if nofs:
        cmd.append("--nofs")
    cmd.append(str(rgb_tmp))
    subprocess.run(cmd, check=True)


def main() -> None:
    SVG_CARDS_DIR.mkdir(parents=True, exist_ok=True)
    SVG_SUITS_DIR.mkdir(parents=True, exist_ok=True)
    index = build_highres_index()

    sheet_rgb = Image.new("RGB", (GRID_COLS * CELL_W, GRID_ROWS * CELL_H), (255, 255, 255))
    mahjong_cell_rgb: Image.Image | None = None
    illustrated_coords: list[tuple[str, int, int]] = []
    report: dict[str, object] = {"illustrated": {}, "pips": 0, "suits": []}

    with tempfile.TemporaryDirectory(prefix="tichu_cards_") as tmp:
        tmp_dir = Path(tmp)

        for row, (suit_code, suit_name, special_file, suit_ink) in enumerate(SUITS):
            # Col 0: Special card (illustrated)
            sp_path = index[special_file]
            sp_raw = np.asarray(Image.open(sp_path).convert("RGB"), dtype=np.float32)
            sp_clean, sp_stats = clean_illustrated_card(sp_raw)
            sp_3x = resize_3x(sp_clean)
            sheet_rgb.paste(sp_3x, (0, row * CELL_H))
            illustrated_coords.append((special_file, row, 0))
            report["illustrated"][special_file] = sp_stats
            if special_file == "mahjong.jpg":
                mahjong_cell_rgb = sp_3x

            # Cols 1..13: Ranks 2..10, J, Q, K, A
            for idx, rank in enumerate(RANKS):
                col = idx + 1
                fname = f"{suit_code}_{rank}.jpg"
                card_path = index[fname]
                raw = np.asarray(Image.open(card_path).convert("RGB"), dtype=np.float32)

                if rank in PIP_RANKS:
                    svg_path = SVG_CARDS_DIR / f"{suit_code}_{rank}.svg"
                    card_3x, cov_clean = process_pip_card(raw, suit_ink, svg_path, tmp_dir)
                    sheet_rgb.paste(card_3x, (col * CELL_W, row * CELL_H))
                    report["pips"] = int(report["pips"]) + 1
                    if rank == "A":
                        suit_svg = SVG_SUITS_DIR / f"{suit_name}.svg"
                        build_suit_svg(cov_clean, suit_ink, suit_svg, tmp_dir)
                        report["suits"].append(suit_svg.name)
                else:
                    clean, c_stats = clean_illustrated_card(raw)
                    card_3x = resize_3x(clean)
                    sheet_rgb.paste(card_3x, (col * CELL_W, row * CELL_H))
                    illustrated_coords.append((fname, row, col))
                    report["illustrated"][fname] = c_stats

        # Compare pngquant --nofs vs Floyd-Steinberg on 16 illustrated cards and pick lowest RMSE
        nofs_out = tmp_dir / "cards_nofs.png"
        fs_out = tmp_dir / "cards_fs.png"
        quantize_with_pngquant(sheet_rgb, nofs_out, tmp_dir, nofs=True)
        quantize_with_pngquant(sheet_rgb, fs_out, tmp_dir, nofs=False)

        rgb_arr = np.asarray(sheet_rgb, dtype=np.float32)
        nofs_arr = np.asarray(Image.open(nofs_out).convert("RGB"), dtype=np.float32)
        fs_arr = np.asarray(Image.open(fs_out).convert("RGB"), dtype=np.float32)

        def ill_rmse(q_arr: np.ndarray) -> float:
            errs = []
            for _, r, c in illustrated_coords:
                y0, y1 = r * CELL_H, (r + 1) * CELL_H
                x0, x1 = c * CELL_W, (c + 1) * CELL_W
                errs.append(np.mean((q_arr[y0:y1, x0:x1] - rgb_arr[y0:y1, x0:x1]) ** 2))
            return float(np.sqrt(np.mean(errs)))

        rmse_nofs = ill_rmse(nofs_arr)
        rmse_fs = ill_rmse(fs_arr)
        chosen = nofs_out if rmse_nofs <= rmse_fs + 0.5 else fs_out
        OUT_CARDS_PNG.write_bytes(chosen.read_bytes())

        assert mahjong_cell_rgb is not None
        quantize_with_pngquant(mahjong_cell_rgb, OUT_MAHJONG_PNG, tmp_dir, nofs=True)

        pass_3x = process_card_back(index["rs_schwarz.jpg"])
        quantize_with_pngquant(pass_3x, OUT_PASS_PNG, tmp_dir, nofs=True)

        report["quantize"] = {
            "chosen": "nofs" if chosen == nofs_out else "floyd",
            "rmse_nofs": round(rmse_nofs, 3),
            "rmse_fs": round(rmse_fs, 3),
            "nofs_bytes": nofs_out.stat().st_size,
            "fs_bytes": fs_out.stat().st_size,
        }

    report["outputs"] = {
        "tichu-cards.png": OUT_CARDS_PNG.stat().st_size,
        "tichu-mahjong.png": OUT_MAHJONG_PNG.stat().st_size,
        "tichu-icons-pass.png": OUT_PASS_PNG.stat().st_size,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
