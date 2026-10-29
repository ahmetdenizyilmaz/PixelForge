"""32-Thread Numba-Parallel & Perceptual OKLab Core Kernels for PixelForge.

Merges and accelerates:
1. PixelForge's Sobel gradient downsampling, Kuwahara flat-region paint filter, CLAHE, and BGM dithering.
2. PixelForge's alpha-weighted Box/Nearest resampling, CSS luminance-preserving tone adjustments,
   64x64 Void-and-Cluster Blue Noise, Bayer 2..16, Clustered-Dot halftone screens, 7 Error-Diffusion
   kernels (Floyd-Steinberg, Atkinson, Sierra, Sierra-Lite, Burkes, Jarvis, Stucki), palette-spread
   normalization, orphan-pixel removal, 3x3 majority speck smoothing, 1px inner/outer sprite outlines,
   and automatic upscaled pixel-grid GCD detection.
3. NEW PixelForge Hybrid Edge-Medoid Box Resampler (`resample_hybrid_edge_box_numba`): combines noise-free
   alpha-premultiplied box averaging in smooth gradients with Sobel-salient medoid snapping across sharp
   contours/text so neither phantom anti-aliasing halos nor flat-area noise occur.
"""

import base64
import math
from typing import Dict, List, Optional, Tuple

import numpy as np
from numba import njit, prange
from PIL import Image
from scipy.ndimage import maximum_filter, median_filter, uniform_filter


# ---------------------------------------------------------------------------
# 64x64 Void-and-Cluster Blue Noise (from PixelForge bluenoise-data.js)
# ---------------------------------------------------------------------------
BLUE_NOISE_SIZE = 64
BLUE_NOISE_B64 = (
    "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"
)

BLUE_NOISE_64X64 = (
    np.frombuffer(base64.b64decode(BLUE_NOISE_B64), dtype=np.uint8)
    .reshape((BLUE_NOISE_SIZE, BLUE_NOISE_SIZE))
    .astype(np.float32)
    + 0.5
) / 256.0 - 0.5


# ---------------------------------------------------------------------------
# Ordered Dither Matrices & 7 Error-Diffusion Kernels
# ---------------------------------------------------------------------------
def build_bayer_matrix(n: int) -> np.ndarray:
    """Recursive power-of-two Bayer threshold matrix normalized to [-0.5, 0.5]."""
    m = np.array([[0]], dtype=np.int32)
    s = 1
    while s < n:
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
        s *= 2
    levels = float(m.size)
    return (m.astype(np.float32) + 0.5) / levels - 0.5


def _ranks_to_threshold(rows: np.ndarray) -> np.ndarray:
    """Converts arbitrary matrix values into uniform rank thresholds in [-0.5, 0.5]."""
    h, w = rows.shape
    flat = rows.reshape(-1)
    # Stable rank ordering (ties preserve reading order)
    order = np.argsort(flat, kind="mergesort")
    ranks = np.empty_like(order)
    ranks[order] = np.arange(flat.size)
    return ((ranks.reshape((h, w)).astype(np.float32) + 0.5) / float(flat.size)) - 0.5


def _build_clustered_8() -> np.ndarray:
    rows = np.zeros((8, 8), dtype=np.float64)
    for y in range(8):
        for x in range(8):
            u = (x + 0.5) / 8.0 * 2.0 * math.pi
            v = (y + 0.5) / 8.0 * 2.0 * math.pi
            rows[y, x] = -(math.cos(u) + math.cos(v)) + (x * 8 + y) * 1e-9
    return _ranks_to_threshold(rows)


BAYER_2X2 = build_bayer_matrix(2)
BAYER_4X4 = build_bayer_matrix(4)
BAYER_8X8 = build_bayer_matrix(8)
BAYER_16X16 = build_bayer_matrix(16)
CLUSTER_4X4 = _ranks_to_threshold(
    np.array([[7, 13, 11, 4], [12, 16, 14, 8], [10, 15, 6, 2], [5, 9, 3, 1]], dtype=np.float64)
)
CLUSTER_8X8 = _build_clustered_8()
LINES_4X1 = _ranks_to_threshold(np.array([[0], [2], [1], [3]], dtype=np.float64))

ORDERED_MATRICES: Dict[str, np.ndarray] = {
    "bayer": BAYER_4X4,
    "bayer2": BAYER_2X2,
    "bayer4": BAYER_4X4,
    "bayer8": BAYER_8X8,
    "bayer16": BAYER_16X16,
    "cluster4": CLUSTER_4X4,
    "cluster8": CLUSTER_8X8,
    "lines": LINES_4X1,
    "bluenoise": BLUE_NOISE_64X64,
}

# 7 Error-diffusion kernels: list of (dx, dy, weight)
DIFFUSION_KERNELS: Dict[str, List[Tuple[int, int, float]]] = {
    "floyd": [(1, 0, 7 / 16), (-1, 1, 3 / 16), (0, 1, 5 / 16), (1, 1, 1 / 16)],
    "floyd-steinberg": [(1, 0, 7 / 16), (-1, 1, 3 / 16), (0, 1, 5 / 16), (1, 1, 1 / 16)],
    "atkinson": [(1, 0, 1 / 8), (2, 0, 1 / 8), (-1, 1, 1 / 8), (0, 1, 1 / 8), (1, 1, 1 / 8), (0, 2, 1 / 8)],
    "sierra-lite": [(1, 0, 2 / 4), (-1, 1, 1 / 4), (0, 1, 1 / 4)],
    "sierra": [
        (1, 0, 5 / 32), (2, 0, 3 / 32),
        (-2, 1, 2 / 32), (-1, 1, 4 / 32), (0, 1, 5 / 32), (1, 1, 4 / 32), (2, 1, 2 / 32),
        (-1, 2, 2 / 32), (0, 2, 3 / 32), (1, 2, 2 / 32),
    ],
    "burkes": [
        (1, 0, 8 / 32), (2, 0, 4 / 32),
        (-2, 1, 2 / 32), (-1, 1, 4 / 32), (0, 1, 8 / 32), (1, 1, 4 / 32), (2, 1, 2 / 32),
    ],
    "jarvis": [
        (1, 0, 7 / 48), (2, 0, 5 / 48),
        (-2, 1, 3 / 48), (-1, 1, 5 / 48), (0, 1, 7 / 48), (1, 1, 5 / 48), (2, 1, 3 / 48),
        (-2, 2, 1 / 48), (-1, 2, 3 / 48), (0, 2, 5 / 48), (1, 2, 3 / 48), (2, 2, 1 / 48),
    ],
    "stucki": [
        (1, 0, 8 / 42), (2, 0, 4 / 42),
        (-2, 1, 2 / 42), (-1, 1, 4 / 42), (0, 1, 8 / 42), (1, 1, 4 / 42), (2, 1, 2 / 42),
        (-2, 2, 1 / 42), (-1, 2, 2 / 42), (0, 2, 4 / 42), (1, 2, 2 / 42), (2, 2, 1 / 42),
    ],
}

ALL_DITHER_METHODS: Tuple[str, ...] = (
    "none",
    "bgm_posterior",
    "naive",
    "bayer2",
    "bayer4",
    "bayer8",
    "bayer16",
    "cluster4",
    "cluster8",
    "lines",
    "bluenoise",
    "custom",
    "floyd-steinberg",
    "atkinson",
    "sierra-lite",
    "sierra",
    "burkes",
    "jarvis",
    "stucki",
)


def parse_custom_matrix(text_or_rows) -> np.ndarray:
    """Parses user-defined ordered threshold matrix (up to 16x16) into [-0.5, 0.5]."""
    if isinstance(text_or_rows, np.ndarray):
        arr = text_or_rows.astype(np.float64)
    elif isinstance(text_or_rows, (list, tuple)):
        arr = np.asarray(text_or_rows, dtype=np.float64)
    else:
        rows = []
        for raw in str(text_or_rows).replace(";", "\n").splitlines():
            line = raw.strip()
            if not line or line.startswith("/"):
                continue
            cleaned = line.replace("[", "").replace("]", "").replace(",", " ")
            vals = [float(tok) for tok in cleaned.split() if tok]
            if vals:
                rows.append(vals)
        if not rows:
            raise ValueError("Custom dither matrix is empty.")
        w = len(rows[0])
        if any(len(r) != w for r in rows):
            raise ValueError("Every row in custom matrix must have the same length.")
        arr = np.asarray(rows, dtype=np.float64)
    if arr.ndim != 2 or arr.shape[0] > 16 or arr.shape[1] > 16:
        raise ValueError("Custom matrices must be 2D and at most 16x16.")
    return _ranks_to_threshold(arr)


# ---------------------------------------------------------------------------
# Color Math (HSV, OKLab, Palette Spread)
# ---------------------------------------------------------------------------
def resize_float(image: np.ndarray, height: int, width: int, anti_aliasing: bool = True) -> np.ndarray:
    """Fast image resize returning float64 in [0.0, 1.0]."""
    height = max(1, int(height))
    width = max(1, int(width))
    if image.ndim == 2:
        arr = np.clip(image, 0.0, 1.0 if image.dtype.kind == "f" else 255.0)
        arr_u8 = (arr * 255.0).astype(np.uint8) if arr.dtype.kind == "f" else arr.astype(np.uint8)
        resample = Image.Resampling.BILINEAR if anti_aliasing else Image.Resampling.NEAREST
        out = Image.fromarray(arr_u8).resize((width, height), resample=resample)
        return np.asarray(out, dtype=np.float64) / 255.0

    arr = image[:, :, :3]
    arr_u8 = (np.clip(arr, 0.0, 1.0) * 255.0).astype(np.uint8) if arr.dtype.kind == "f" else np.clip(arr, 0, 255).astype(np.uint8)
    resample = Image.Resampling.BILINEAR if anti_aliasing else Image.Resampling.NEAREST
    out = Image.fromarray(arr_u8).resize((width, height), resample=resample)
    return np.asarray(out, dtype=np.float64) / 255.0


def rgb2hsv_fast(rgb: np.ndarray) -> np.ndarray:
    """Vectorized RGB [0..1] to HSV [0..1] conversion."""
    arr = np.asarray(rgb, dtype=np.float64)
    orig_shape = arr.shape
    flat = arr.reshape(-1, 3)
    r, g, b = flat[:, 0], flat[:, 1], flat[:, 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    diff = maxc - minc

    h = np.zeros_like(maxc)
    s = np.where(maxc > 1e-10, diff / np.maximum(maxc, 1e-10), 0.0)
    v = maxc

    mask = diff > 1e-10
    rm = mask & (maxc == r)
    gm = mask & (maxc == g) & ~rm
    bm = mask & ~rm & ~gm

    h[rm] = ((g[rm] - b[rm]) / diff[rm]) % 6.0
    h[gm] = ((b[gm] - r[gm]) / diff[gm]) + 2.0
    h[bm] = ((r[bm] - g[bm]) / diff[bm]) + 4.0
    h = (h / 6.0) % 1.0
    return np.stack([h, s, v], axis=-1).reshape(orig_shape)


def hsv2rgb_fast(hsv: np.ndarray) -> np.ndarray:
    """Vectorized HSV [0..1] to RGB [0..1] conversion."""
    arr = np.asarray(hsv, dtype=np.float64)
    orig_shape = arr.shape
    flat = arr.reshape(-1, 3)
    h, s, v = flat[:, 0] % 1.0, np.clip(flat[:, 1], 0.0, 1.0), np.clip(flat[:, 2], 0.0, 1.0)

    h6 = h * 6.0
    i = np.floor(h6).astype(np.int32) % 6
    f = h6 - np.floor(h6)
    p = v * (1.0 - s)
    q = v * (1.0 - f * s)
    t = v * (1.0 - (1.0 - f) * s)

    r = np.select([i == 0, i == 1, i == 2, i == 3, i == 4, i == 5], [v, q, p, p, t, v], default=v)
    g = np.select([i == 0, i == 1, i == 2, i == 3, i == 4, i == 5], [t, v, v, q, p, p], default=v)
    b = np.select([i == 0, i == 1, i == 2, i == 3, i == 4, i == 5], [p, p, t, v, v, q], default=v)
    return np.stack([r, g, b], axis=-1).reshape(orig_shape)


def rgb2oklab(rgb: np.ndarray) -> np.ndarray:
    """Perceptually uniform sRGB [0..1] to OKLab conversion (Bjorn Ottosson)."""
    arr = np.clip(np.asarray(rgb, dtype=np.float64), 0.0, 1.0)
    orig_shape = arr.shape
    flat = arr.reshape(-1, 3)
    lin = np.where(flat <= 0.04045, flat / 12.92, ((flat + 0.055) / 1.055) ** 2.4)
    r, g, b = lin[:, 0], lin[:, 1], lin[:, 2]

    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

    l_ = np.cbrt(np.maximum(l, 0.0))
    m_ = np.cbrt(np.maximum(m, 0.0))
    s_ = np.cbrt(np.maximum(s, 0.0))

    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return np.stack([L, A, B], axis=-1).reshape(orig_shape)


def oklab2rgb(lab: np.ndarray) -> np.ndarray:
    """Inverse OKLab to sRGB [0..1] conversion."""
    arr = np.asarray(lab, dtype=np.float64)
    orig_shape = arr.shape
    flat = arr.reshape(-1, 3)
    L, a, b = flat[:, 0], flat[:, 1], flat[:, 2]

    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b

    l = l_ * l_ * l_
    m = m_ * m_ * m_
    s = s_ * s_ * s_

    r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    lin = np.clip(np.stack([r_lin, g_lin, b_lin], axis=-1), 0.0, 1.0)
    srgb = np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(lin, 1.0 / 2.4) - 0.055)
    return np.clip(srgb, 0.0, 1.0).reshape(orig_shape)


def oklab_palette_labels(X_rgb: np.ndarray, palette_rgb: np.ndarray) -> np.ndarray:
    """Fast perceptual color matching in OKLab space."""
    x_lab = rgb2oklab(X_rgb.reshape(-1, 3))
    p_lab = rgb2oklab(palette_rgb.reshape(-1, 3))
    dl = (x_lab[:, None, 0] - p_lab[None, :, 0]) * 1.0
    da = (x_lab[:, None, 1] - p_lab[None, :, 1]) * 1.35
    db = (x_lab[:, None, 2] - p_lab[None, :, 2]) * 1.35
    dist2 = dl * dl + da * da + db * db
    return np.argmin(dist2, axis=1)


def palette_spread(palette_u8: np.ndarray) -> float:
    """Average nearest-neighbor distance (sRGB 0..1) so ordered dither strength scales across any palette size."""
    n = len(palette_u8)
    if n < 2:
        return 1.0
    pal = palette_u8[:, :3].astype(np.float64)
    diff = pal[:, None, :] - pal[None, :, :]
    dist = np.sqrt(np.sum(diff * diff, axis=-1))
    np.fill_diagonal(dist, np.inf)
    nearest_d = np.min(dist, axis=1)
    return float(np.clip(np.mean(nearest_d) / 255.0, 0.04, 1.0))


def equalize_adapthist_fast(rgb: np.ndarray) -> np.ndarray:
    """Fast local contrast enhancement replacing skimage.exposure.equalize_adapthist."""
    arr = np.clip(np.asarray(rgb, dtype=np.float64), 0.0, 1.0)
    hsv = rgb2hsv_fast(arr)
    v = hsv[:, :, 2]
    local_mean = uniform_filter(v, size=16, mode="reflect")
    local_sq = uniform_filter(v * v, size=16, mode="reflect")
    local_std = np.sqrt(np.maximum(local_sq - local_mean * local_mean, 1e-5))
    v_enhanced = np.clip((v - local_mean) / (local_std * 2.6 + 0.12) * 0.25 + v * 0.88 + 0.06, 0.0, 1.0)
    hsv[:, :, 2] = v_enhanced
    return hsv2rgb_fast(hsv)


# ---------------------------------------------------------------------------
# 32-Thread Numba Resamplers (Box, Nearest, Sobel-Edge, NEW Hybrid Edge-Box)
# ---------------------------------------------------------------------------
@njit(parallel=True, cache=True, fastmath=True)
def sobel_downsample_numba(image: np.ndarray, tile: int) -> np.ndarray:
    """32-thread parallel Sobel-gradient-weighted block downsampling across all 3 channels."""
    h, w, c = image.shape
    out_h = h // tile
    out_w = w // tile
    out = np.zeros((out_h, out_w, c), dtype=np.float64)

    for by in prange(out_h):
        y0 = by * tile
        for bx in range(out_w):
            x0 = bx * tile
            for ch in range(c):
                w_sum = 0.0
                v_sum = 0.0
                for dy in range(tile):
                    y = y0 + dy
                    ym = max(0, y - 1)
                    yp = min(h - 1, y + 1)
                    for dx in range(tile):
                        x = x0 + dx
                        xm = max(0, x - 1)
                        xp = min(w - 1, x + 1)
                        gx = (
                            (image[ym, xp, ch] + 2.0 * image[y, xp, ch] + image[yp, xp, ch])
                            - (image[ym, xm, ch] + 2.0 * image[y, xm, ch] + image[yp, xm, ch])
                        )
                        gy = (
                            (image[yp, xm, ch] + 2.0 * image[yp, x, ch] + image[yp, xp, ch])
                            - (image[ym, xm, ch] + 2.0 * image[ym, x, ch] + image[ym, xp, ch])
                        )
                        mag = math.sqrt(gx * gx + gy * gy) + 1e-6
                        w_sum += mag
                        v_sum += mag * image[y, x, ch]
                out[by, bx, ch] = v_sum / w_sum
    return out


@njit(parallel=True, cache=True, fastmath=True)
def resample_rgba_numba(
    src_u8: np.ndarray,
    out_w: int,
    out_h: int,
    mode_id: int,
    crop_x: int,
    crop_y: int,
    crop_w: int,
    crop_h: int,
    edge_sharpness: float = 0.78,
) -> np.ndarray:
    """32-thread parallel RGBA resampler returning float32 RGBA in [0..1].

    mode_id:
        0 = 'box'      (PixelForge 16x16 alpha-premultiplied box average)
        1 = 'nearest'  (PixelForge center-texel nearest neighbor)
        2 = 'sobel'    (Arbitrary-size alpha-aware Sobel gradient-weighted pooling)
        3 = 'hybrid'   (NEW PixelForge Hybrid Edge-Medoid Box: smooth box average in low-contrast
                        gradients + Sobel-salient medoid snapping across sharp edges/text so zero
                        muddy anti-aliasing phantom colors appear!)
    """
    src_h, src_w, _ = src_u8.shape
    out = np.zeros((out_h, out_w, 4), dtype=np.float32)

    if mode_id == 1:
        nx = 1
        ny = 1
    else:
        nx = min(16, max(1, (crop_w + out_w - 1) // out_w))
        ny = min(16, max(1, (crop_h + out_h - 1) // out_h))

    inv_255 = np.float32(1.0 / 255.0)
    total_samples = float(nx * ny)

    for y in prange(out_h):
        for x in range(out_w):
            if mode_id == 0 or mode_id == 1:
                r_acc = 0.0
                g_acc = 0.0
                b_acc = 0.0
                a_acc = 0.0
                for j in range(ny):
                    sy = crop_y + min(crop_h - 1, ((2 * (y * ny + j) + 1) * crop_h) // (2 * out_h * ny))
                    for i in range(nx):
                        sx = crop_x + min(crop_w - 1, ((2 * (x * nx + i) + 1) * crop_w) // (2 * out_w * nx))
                        al = src_u8[sy, sx, 3] * inv_255
                        r_acc += (src_u8[sy, sx, 0] * inv_255) * al
                        g_acc += (src_u8[sy, sx, 1] * inv_255) * al
                        b_acc += (src_u8[sy, sx, 2] * inv_255) * al
                        a_acc += al
                if a_acc > 0.0:
                    out[y, x, 0] = r_acc / a_acc
                    out[y, x, 1] = g_acc / a_acc
                    out[y, x, 2] = b_acc / a_acc
                out[y, x, 3] = a_acc / total_samples

            elif mode_id == 2:
                # Sobel gradient-weighted arbitrary-size RGBA pooling
                r_acc = 0.0
                g_acc = 0.0
                b_acc = 0.0
                w_acc = 0.0
                a_acc = 0.0
                for j in range(ny):
                    sy = crop_y + min(crop_h - 1, ((2 * (y * ny + j) + 1) * crop_h) // (2 * out_h * ny))
                    ym = max(0, sy - 1)
                    yp = min(src_h - 1, sy + 1)
                    for i in range(nx):
                        sx = crop_x + min(crop_w - 1, ((2 * (x * nx + i) + 1) * crop_w) // (2 * out_w * nx))
                        xm = max(0, sx - 1)
                        xp = min(src_w - 1, sx + 1)
                        al = src_u8[sy, sx, 3] * inv_255
                        a_acc += al
                        if al <= 0.0:
                            continue
                        # Luminance Sobel magnitude
                        l_mm = (0.299 * src_u8[ym, xm, 0] + 0.587 * src_u8[ym, xm, 1] + 0.114 * src_u8[ym, xm, 2]) * inv_255
                        l_m0 = (0.299 * src_u8[ym, sx, 0] + 0.587 * src_u8[ym, sx, 1] + 0.114 * src_u8[ym, sx, 2]) * inv_255
                        l_mp = (0.299 * src_u8[ym, xp, 0] + 0.587 * src_u8[ym, xp, 1] + 0.114 * src_u8[ym, xp, 2]) * inv_255
                        l_0m = (0.299 * src_u8[sy, xm, 0] + 0.587 * src_u8[sy, xm, 1] + 0.114 * src_u8[sy, xm, 2]) * inv_255
                        l_0p = (0.299 * src_u8[sy, xp, 0] + 0.587 * src_u8[sy, xp, 1] + 0.114 * src_u8[sy, xp, 2]) * inv_255
                        l_pm = (0.299 * src_u8[yp, xm, 0] + 0.587 * src_u8[yp, xm, 1] + 0.114 * src_u8[yp, xm, 2]) * inv_255
                        l_p0 = (0.299 * src_u8[yp, sx, 0] + 0.587 * src_u8[yp, sx, 1] + 0.114 * src_u8[yp, sx, 2]) * inv_255
                        l_pp = (0.299 * src_u8[yp, xp, 0] + 0.587 * src_u8[yp, xp, 1] + 0.114 * src_u8[yp, xp, 2]) * inv_255

                        gx = (l_mp + 2.0 * l_0p + l_pp) - (l_mm + 2.0 * l_0m + l_pm)
                        gy = (l_pm + 2.0 * l_p0 + l_pp) - (l_mm + 2.0 * l_m0 + l_mp)
                        mag = (math.sqrt(gx * gx + gy * gy) + 0.02) * al
                        r_acc += (src_u8[sy, sx, 0] * inv_255) * mag
                        g_acc += (src_u8[sy, sx, 1] * inv_255) * mag
                        b_acc += (src_u8[sy, sx, 2] * inv_255) * mag
                        w_acc += mag
                if w_acc > 0.0:
                    out[y, x, 0] = r_acc / w_acc
                    out[y, x, 1] = g_acc / w_acc
                    out[y, x, 2] = b_acc / w_acc
                out[y, x, 3] = a_acc / total_samples

            else:
                # mode_id == 3: NEW PixelForge Hybrid Bimodal-Plateau + Box Resampler
                # - Low-contrast tiles (span <= 0.10): 100% smooth noise-free box average.
                # - High-contrast edge/text tiles: splits samples around tile midpoint into
                #   Dark Plateau vs Bright Plateau weighted by center proximity and inverse gradient
                #   (rejecting blurry 50% anti-aliased transition ramp pixels!), snapping cleanly
                #   to the true foreground or background plateau with zero phantom halo colors.
                box_r = 0.0
                box_g = 0.0
                box_b = 0.0
                a_acc = 0.0
                min_l = 1e9
                max_l = -1e9

                for j in range(ny):
                    sy = crop_y + min(crop_h - 1, ((2 * (y * ny + j) + 1) * crop_h) // (2 * out_h * ny))
                    for i in range(nx):
                        sx = crop_x + min(crop_w - 1, ((2 * (x * nx + i) + 1) * crop_w) // (2 * out_w * nx))
                        al = src_u8[sy, sx, 3] * inv_255
                        a_acc += al
                        if al <= 0.0:
                            continue
                        sr = src_u8[sy, sx, 0] * inv_255
                        sg = src_u8[sy, sx, 1] * inv_255
                        sb = src_u8[sy, sx, 2] * inv_255
                        sl = 0.299 * sr + 0.587 * sg + 0.114 * sb
                        if sl < min_l:
                            min_l = sl
                        if sl > max_l:
                            max_l = sl
                        box_r += sr * al
                        box_g += sg * al
                        box_b += sb * al

                if a_acc > 0.0:
                    br = box_r / a_acc
                    bg = box_g / a_acc
                    bb = box_b / a_acc
                    span = max(0.0, max_l - min_l)
                    if span <= 0.10:
                        out[y, x, 0] = br
                        out[y, x, 1] = bg
                        out[y, x, 2] = bb
                    else:
                        mid_l = 0.5 * (min_l + max_l)
                        lo_r = 0.0
                        lo_g = 0.0
                        lo_b = 0.0
                        lo_w = 0.0
                        hi_r = 0.0
                        hi_g = 0.0
                        hi_b = 0.0
                        hi_w = 0.0
                        half_nx = 0.5 * max(1.0, float(nx))
                        half_ny = 0.5 * max(1.0, float(ny))

                        for j in range(ny):
                            sy = crop_y + min(crop_h - 1, ((2 * (y * ny + j) + 1) * crop_h) // (2 * out_h * ny))
                            ym = max(0, sy - 1)
                            yp = min(src_h - 1, sy + 1)
                            dy_c = ((float(j) + 0.5) - half_ny) / half_ny
                            for i in range(nx):
                                sx = crop_x + min(crop_w - 1, ((2 * (x * nx + i) + 1) * crop_w) // (2 * out_w * nx))
                                al = src_u8[sy, sx, 3] * inv_255
                                if al <= 0.0:
                                    continue
                                xm = max(0, sx - 1)
                                xp = min(src_w - 1, sx + 1)
                                sr = src_u8[sy, sx, 0] * inv_255
                                sg = src_u8[sy, sx, 1] * inv_255
                                sb = src_u8[sy, sx, 2] * inv_255
                                sl = 0.299 * sr + 0.587 * sg + 0.114 * sb

                                l_0m = (0.299 * src_u8[sy, xm, 0] + 0.587 * src_u8[sy, xm, 1] + 0.114 * src_u8[sy, xm, 2]) * inv_255
                                l_0p = (0.299 * src_u8[sy, xp, 0] + 0.587 * src_u8[sy, xp, 1] + 0.114 * src_u8[sy, xp, 2]) * inv_255
                                l_m0 = (0.299 * src_u8[ym, sx, 0] + 0.587 * src_u8[ym, sx, 1] + 0.114 * src_u8[ym, sx, 2]) * inv_255
                                l_p0 = (0.299 * src_u8[yp, sx, 0] + 0.587 * src_u8[yp, sx, 1] + 0.114 * src_u8[yp, sx, 2]) * inv_255
                                grad = abs(l_0p - l_0m) + abs(l_p0 - l_m0)

                                dx_c = ((float(i) + 0.5) - half_nx) / half_nx
                                center_w = max(0.25, 1.35 - 0.55 * (dx_c * dx_c + dy_c * dy_c))
                                # Penalize blurry mid-ramp anti-aliasing pixels; reward clean plateau interiors
                                plateau_w = (al * center_w) / (1.0 + 5.0 * grad)

                                if sl <= mid_l:
                                    lo_r += sr * plateau_w
                                    lo_g += sg * plateau_w
                                    lo_b += sb * plateau_w
                                    lo_w += plateau_w
                                else:
                                    hi_r += sr * plateau_w
                                    hi_g += sg * plateau_w
                                    hi_b += sb * plateau_w
                                    hi_w += plateau_w

                        # Slight salience boost (1.12x) for bright thin strokes/typography crossing the tile center
                        if hi_w * 1.12 >= lo_w and hi_w > 0.0:
                            pr = hi_r / hi_w
                            pg = hi_g / hi_w
                            pb = hi_b / hi_w
                        elif lo_w > 0.0:
                            pr = lo_r / lo_w
                            pg = lo_g / lo_w
                            pb = lo_b / lo_w
                        else:
                            pr, pg, pb = br, bg, bb

                        t = min(1.0, max(0.0, (span - 0.10) / 0.22))
                        blend = t * t * (3.0 - 2.0 * t) * min(1.0, edge_sharpness * 1.25)
                        out[y, x, 0] = br + (pr - br) * blend
                        out[y, x, 1] = bg + (pg - bg) * blend
                        out[y, x, 2] = bb + (pb - bb) * blend
                out[y, x, 3] = a_acc / total_samples
    return out


# ---------------------------------------------------------------------------
# Pre-Quantization Tone Adjustments, Alpha Cutoff & 32-Thread Kuwahara Filter
# ---------------------------------------------------------------------------
@njit(parallel=True, cache=True, fastmath=True)
def tone_adjust_rgba_numba(
    buf: np.ndarray,
    brightness: float,
    contrast: float,
    saturation: float,
    hue_deg: float,
    gamma: float,
    alpha_threshold: float,
) -> np.ndarray:
    """32-thread parallel Brightness/Contrast/Saturation/CSS-Hue/Gamma + Binary Alpha Cutoff."""
    h, w, _ = buf.shape
    out = buf.copy()
    has_tone = (
        abs(brightness) > 1e-6
        or abs(contrast) > 1e-6
        or abs(saturation) > 1e-6
        or abs(hue_deg) > 1e-6
        or abs(gamma - 1.0) > 1e-6
    )
    f = (1.0 / (1.0 - 0.99 * contrast)) if contrast >= 0.0 else (1.0 + contrast)
    ig = 1.0 / max(0.05, gamma)
    rad = hue_deg * math.pi / 180.0
    hk = math.cos(rad)
    hq = math.sin(rad)

    m0 = 0.213 + 0.787 * hk - 0.213 * hq
    m1 = 0.715 - 0.715 * hk - 0.715 * hq
    m2 = 0.072 - 0.072 * hk + 0.928 * hq
    m3 = 0.213 - 0.213 * hk + 0.143 * hq
    m4 = 0.715 + 0.285 * hk + 0.140 * hq
    m5 = 0.072 - 0.072 * hk - 0.283 * hq
    m6 = 0.213 - 0.213 * hk - 0.787 * hq
    m7 = 0.715 - 0.715 * hk + 0.715 * hq
    m8 = 0.072 + 0.928 * hk + 0.072 * hq
    sat_k = 1.0 + saturation

    for y in prange(h):
        for x in range(w):
            a = out[y, x, 3]
            a_bin = 1.0 if (a >= alpha_threshold and a > 0.0) else 0.0
            out[y, x, 3] = a_bin
            if a_bin == 0.0:
                out[y, x, 0] = 0.0
                out[y, x, 1] = 0.0
                out[y, x, 2] = 0.0
                continue
            if has_tone:
                r = (out[y, x, 0] + brightness - 0.5) * f + 0.5
                g = (out[y, x, 1] + brightness - 0.5) * f + 0.5
                b = (out[y, x, 2] + brightness - 0.5) * f + 0.5
                lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
                r = lum + (r - lum) * sat_k
                g = lum + (g - lum) * sat_k
                b = lum + (b - lum) * sat_k
                if abs(hue_deg) > 1e-6:
                    r2 = m0 * r + m1 * g + m2 * b
                    g2 = m3 * r + m4 * g + m5 * b
                    b2 = m6 * r + m7 * g + m8 * b
                    r, g, b = r2, g2, b2
                r = min(1.0, max(0.0, r)) ** ig
                g = min(1.0, max(0.0, g)) ** ig
                b = min(1.0, max(0.0, b)) ** ig
                out[y, x, 0] = r
                out[y, x, 1] = g
                out[y, x, 2] = b
    return out


@njit(parallel=True, cache=True, fastmath=True)
def kuwahara_filter_numba(image: np.ndarray, radius: int = 3) -> np.ndarray:
    """32-thread parallel edge-preserving Kuwahara flat-region paint filter."""
    h, w, _ = image.shape
    out = np.empty_like(image)
    for y in prange(h):
        for x in range(w):
            best_var = 1e18
            best_r = image[y, x, 0]
            best_g = image[y, x, 1]
            best_b = image[y, x, 2]

            for qy in range(2):
                y_start = max(0, y - radius if qy == 0 else y)
                y_end = min(h - 1, y if qy == 0 else y + radius)
                for qx in range(2):
                    x_start = max(0, x - radius if qx == 0 else x)
                    x_end = min(w - 1, x if qx == 0 else x + radius)

                    sum_r = 0.0
                    sum_g = 0.0
                    sum_b = 0.0
                    sum_l = 0.0
                    sum_l2 = 0.0
                    count = 0.0

                    for py in range(y_start, y_end + 1):
                        for px in range(x_start, x_end + 1):
                            r = image[py, px, 0]
                            g = image[py, px, 1]
                            b = image[py, px, 2]
                            luma = 0.299 * r + 0.587 * g + 0.114 * b
                            sum_r += r
                            sum_g += g
                            sum_b += b
                            sum_l += luma
                            sum_l2 += luma * luma
                            count += 1.0

                    if count > 0.0:
                        mean_l = sum_l / count
                        var = (sum_l2 / count) - (mean_l * mean_l)
                        if var < best_var:
                            best_var = var
                            best_r = sum_r / count
                            best_g = sum_g / count
                            best_b = sum_b / count

            out[y, x, 0] = best_r
            out[y, x, 1] = best_g
            out[y, x, 2] = best_b
            if image.shape[2] == 4:
                out[y, x, 3] = image[y, x, 3]
    return out


# ---------------------------------------------------------------------------
# Numba Perceptual OKLab Nearest & Dithering Kernels (Ordered + 7 Diffusions)
# ---------------------------------------------------------------------------
@njit(inline="always", fastmath=True)
def _srgb_to_oklab_pixel(r: float, g: float, b: float) -> Tuple[float, float, float]:
    rl = r / 12.92 if r <= 0.04045 else ((r + 0.055) / 1.055) ** 2.4
    gl = g / 12.92 if g <= 0.04045 else ((g + 0.055) / 1.055) ** 2.4
    bl = b / 12.92 if b <= 0.04045 else ((b + 0.055) / 1.055) ** 2.4

    l = max(0.0, 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl) ** (1.0 / 3.0)
    m = max(0.0, 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl) ** (1.0 / 3.0)
    s = max(0.0, 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl) ** (1.0 / 3.0)

    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, A, B


@njit(inline="always", fastmath=True)
def _nearest_palette_idx(
    r: float,
    g: float,
    b: float,
    pal_f32: np.ndarray,
    pal_oklab: np.ndarray,
    use_oklab: bool,
) -> int:
    n = pal_f32.shape[0]
    best = 0
    best_d = 1e20
    if use_oklab:
        L, A, B = _srgb_to_oklab_pixel(r, g, b)
        for i in range(n):
            dL = L - pal_oklab[i, 0]
            dA = (A - pal_oklab[i, 1]) * 1.15
            dB = (B - pal_oklab[i, 2]) * 1.15
            d = dL * dL + dA * dA + dB * dB
            if d < best_d:
                best_d = d
                best = i
    else:
        for i in range(n):
            dr = r - pal_f32[i, 0]
            dg = g - pal_f32[i, 1]
            db = b - pal_f32[i, 2]
            d = 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db
            if d < best_d:
                best_d = d
                best = i
    return best


@njit(parallel=True, cache=True, fastmath=True)
def quantize_ordered_rgba_numba(
    rgba_f32: np.ndarray,
    pal_u8: np.ndarray,
    pal_f32: np.ndarray,
    pal_oklab: np.ndarray,
    thresh_map: np.ndarray,
    amount: float,
    use_oklab: bool,
) -> np.ndarray:
    """32-thread parallel ordered/nearest palette quantization returning RGBA uint8."""
    h, w, _ = rgba_f32.shape
    mh, mw = thresh_map.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)

    for y in prange(h):
        ty = y % mh
        for x in range(w):
            if rgba_f32[y, x, 3] < 0.5:
                continue
            r = rgba_f32[y, x, 0]
            g = rgba_f32[y, x, 1]
            b = rgba_f32[y, x, 2]
            if amount > 0.0:
                t = thresh_map[ty, x % mw] * amount
                r = min(1.0, max(0.0, r + t))
                g = min(1.0, max(0.0, g + t))
                b = min(1.0, max(0.0, b + t))
            idx = _nearest_palette_idx(r, g, b, pal_f32, pal_oklab, use_oklab)
            out[y, x, 0] = pal_u8[idx, 0]
            out[y, x, 1] = pal_u8[idx, 1]
            out[y, x, 2] = pal_u8[idx, 2]
            out[y, x, 3] = 255
    return out


@njit(cache=True, fastmath=True)
def quantize_diffusion_rgba_numba(
    rgba_f32: np.ndarray,
    pal_u8: np.ndarray,
    pal_f32: np.ndarray,
    pal_oklab: np.ndarray,
    k_dx: np.ndarray,
    k_dy: np.ndarray,
    k_wt: np.ndarray,
    strength: float,
    use_oklab: bool,
    serpentine: bool = True,
) -> np.ndarray:
    """Numba-compiled 7-kernel perceptual error diffusion with optional serpentine scan."""
    h, w, _ = rgba_f32.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    acc = np.zeros((h, w, 3), dtype=np.float32)
    kn = len(k_wt)

    for y in range(h):
        rev = serpentine and (y % 2 == 1)
        x_start = w - 1 if rev else 0
        x_end = -1 if rev else w
        x_step = -1 if rev else 1
        dir_sign = -1 if rev else 1

        for x in range(x_start, x_end, x_step):
            if rgba_f32[y, x, 3] < 0.5:
                continue
            r = min(1.0, max(0.0, rgba_f32[y, x, 0] + acc[y, x, 0] * strength))
            g = min(1.0, max(0.0, rgba_f32[y, x, 1] + acc[y, x, 1] * strength))
            b = min(1.0, max(0.0, rgba_f32[y, x, 2] + acc[y, x, 2] * strength))
            idx = _nearest_palette_idx(r, g, b, pal_f32, pal_oklab, use_oklab)

            er = r - pal_f32[idx, 0]
            eg = g - pal_f32[idx, 1]
            eb = b - pal_f32[idx, 2]

            for k in range(kn):
                xx = x + k_dx[k] * dir_sign
                yy = y + k_dy[k]
                if 0 <= xx < w and 0 <= yy < h:
                    wt = k_wt[k]
                    acc[yy, xx, 0] += er * wt
                    acc[yy, xx, 1] += eg * wt
                    acc[yy, xx, 2] += eb * wt

            out[y, x, 0] = pal_u8[idx, 0]
            out[y, x, 1] = pal_u8[idx, 1]
            out[y, x, 2] = pal_u8[idx, 2]
            out[y, x, 3] = 255
    return out


@njit(cache=True, fastmath=True)
def floyd_dither_numba(probs: np.ndarray, final_h: int, final_w: int) -> np.ndarray:
    """Pre-compiled Numba Floyd-Steinberg BGM posterior probability dithering."""
    probs_work = np.power(probs, 1.0 / 6.0)
    res = np.zeros((final_h, final_w), dtype=np.int32)
    n_colors = probs_work.shape[0]

    for y in range(final_h - 1):
        for x in range(1, final_w - 1):
            best_idx = 0
            best_val = -1e9
            for c in range(n_colors):
                val = probs_work[c, y, x]
                if val > best_val:
                    best_val = val
                    best_idx = c
            res[y, x] = best_idx
            for c in range(n_colors):
                if c != best_idx:
                    q = probs_work[c, y, x] / 16.0
                    probs_work[c, y, x + 1] += q * 7.0
                    probs_work[c, y + 1, x - 1] += q * 3.0
                    probs_work[c, y + 1, x] += q * 5.0
                    probs_work[c, y + 1, x + 1] += q

    for y in range(final_h):
        res[y, 0] = np.argmax(probs_work[:, y, 0])
        res[y, final_w - 1] = np.argmax(probs_work[:, y, final_w - 1])
    for x in range(1, final_w - 1):
        res[final_h - 1, x] = np.argmax(probs_work[:, final_h - 1, x])
    return res


# ---------------------------------------------------------------------------
# Post-Quantization Pixel-Art Cleanup, Outlines & Grid Detection
# ---------------------------------------------------------------------------
@njit( inline="always" )
def _color_key(px: np.ndarray, y: int, x: int) -> int:
    if px[y, x, 3] == 0:
        return -1
    return (int(px[y, x, 0]) << 16) | (int(px[y, x, 1]) << 8) | int(px[y, x, 2])


@njit(cache=True)
def remove_orphans_numba(rgba_u8: np.ndarray) -> np.ndarray:
    """Replaces isolated single-pixel strays sharing no color with any 4-neighbor."""
    h, w, _ = rgba_u8.shape
    out = rgba_u8.copy()
    dx4 = (0, 1, 0, -1)
    dy4 = (-1, 0, 1, 0)

    for y in range(h):
        for x in range(w):
            c = _color_key(rgba_u8, y, x)
            ks = np.empty(4, dtype=np.int64)
            ny_arr = np.empty(4, dtype=np.int32)
            nx_arr = np.empty(4, dtype=np.int32)
            n = 0
            matched = False
            for d in range(4):
                yy = y + dy4[d]
                xx = x + dx4[d]
                if 0 <= yy < h and 0 <= xx < w:
                    k = _color_key(rgba_u8, yy, xx)
                    if k == c:
                        matched = True
                        break
                    ks[n] = k
                    ny_arr[n] = yy
                    nx_arr[n] = xx
                    n += 1
            if matched or n < 2:
                continue
            best_i = 0
            best_cnt = 0
            for i in range(n):
                cnt = 0
                for j in range(n):
                    if ks[j] == ks[i]:
                        cnt += 1
                if cnt > best_cnt:
                    best_cnt = cnt
                    best_i = i
            by = ny_arr[best_i]
            bx = nx_arr[best_i]
            out[y, x, 0] = rgba_u8[by, bx, 0]
            out[y, x, 1] = rgba_u8[by, bx, 1]
            out[y, x, 2] = rgba_u8[by, bx, 2]
            out[y, x, 3] = rgba_u8[by, bx, 3]
    return out


@njit(cache=True)
def smooth_majority_numba(rgba_u8: np.ndarray) -> np.ndarray:
    """3x3 majority filter: a color filling >= 5 of the 9 cells wins,
    while preserving connected 1px high-contrast linework & typography strokes!"""
    h, w, _ = rgba_u8.shape
    out = rgba_u8.copy()
    inv_255 = 1.0 / 255.0
    for y in range(h):
        for x in range(w):
            c = _color_key(rgba_u8, y, x)
            ks = np.empty(9, dtype=np.int64)
            ys = np.empty(9, dtype=np.int32)
            xs = np.empty(9, dtype=np.int32)
            idx = 0
            same_nb = 0
            for dy in range(-1, 2):
                yy = min(h - 1, max(0, y + dy))
                for dx in range(-1, 2):
                    xx = min(w - 1, max(0, x + dx))
                    k_nb = _color_key(rgba_u8, yy, xx)
                    ks[idx] = k_nb
                    ys[idx] = yy
                    xs[idx] = xx
                    if (dy != 0 or dx != 0) and k_nb == c:
                        same_nb += 1
                    idx += 1
            l_me = (0.299 * rgba_u8[y, x, 0] + 0.587 * rgba_u8[y, x, 1] + 0.114 * rgba_u8[y, x, 2]) * inv_255
            for i in range(9):
                if ks[i] == c:
                    continue
                cnt = 0
                for j in range(9):
                    if ks[j] == ks[i]:
                        cnt += 1
                if cnt >= 5:
                    # Guard connected 1px high-contrast strokes (e.g. crisp pixel text stems)
                    l_win = (
                        0.299 * rgba_u8[ys[i], xs[i], 0]
                        + 0.587 * rgba_u8[ys[i], xs[i], 1]
                        + 0.114 * rgba_u8[ys[i], xs[i], 2]
                    ) * inv_255
                    if same_nb >= 1 and abs(l_win - l_me) > 0.38:
                        continue
                    out[y, x, 0] = rgba_u8[ys[i], xs[i], 0]
                    out[y, x, 1] = rgba_u8[ys[i], xs[i], 1]
                    out[y, x, 2] = rgba_u8[ys[i], xs[i], 2]
                    out[y, x, 3] = rgba_u8[ys[i], xs[i], 3]
                    break
    return out


@njit(cache=True)
def sprite_outline_numba(
    rgba_u8: np.ndarray,
    mode_id: int,
    r: int,
    g: int,
    b: int,
    corners: bool = False,
    edge_threshold: float = 0.26,
) -> np.ndarray:
    """Draws 1px pixel-art outlines.

    mode_id:
        0 = none
        1 = outer (on transparent pixels touching opaque shape)
        2 = inner (on opaque pixels touching transparent boundary)
        3 = ink   (NEW: draws 1px comic ink outline between distinct non-dark shapes on opaque scenes!)
    """
    if mode_id == 0:
        return rgba_u8
    h, w, _ = rgba_u8.shape
    out = rgba_u8.copy()
    dx8 = (0, 1, 0, -1, -1, 1, 1, -1)
    dy8 = (-1, 0, 1, 0, -1, -1, 1, 1)
    nb_count = 8 if corners else 4

    if mode_id in (1, 2):
        for y in range(h):
            for x in range(w):
                me_opaque = rgba_u8[y, x, 3] > 0
                hit = False
                for d in range(nb_count):
                    yy = y + dy8[d]
                    xx = x + dx8[d]
                    if 0 <= yy < h and 0 <= xx < w:
                        other_opaque = rgba_u8[yy, xx, 3] > 0
                        if mode_id == 1 and (not me_opaque and other_opaque):
                            hit = True
                            break
                        elif mode_id == 2 and (me_opaque and not other_opaque):
                            hit = True
                            break
                if hit:
                    out[y, x, 0] = r
                    out[y, x, 1] = g
                    out[y, x, 2] = b
                    out[y, x, 3] = 255
    elif mode_id == 3:
        # Internal comic/pixel ink outline between distinct colored shapes (skips already-dark backgrounds!)
        inv_255 = 1.0 / 255.0
        for y in range(h):
            for x in range(w):
                if rgba_u8[y, x, 3] == 0:
                    continue
                l_me = (0.299 * rgba_u8[y, x, 0] + 0.587 * rgba_u8[y, x, 1] + 0.114 * rgba_u8[y, x, 2]) * inv_255
                if l_me < 0.10:
                    continue
                hit = False
                for d in range(nb_count):
                    yy = y + dy8[d]
                    xx = x + dx8[d]
                    if 0 <= yy < h and 0 <= xx < w and rgba_u8[yy, xx, 3] > 0:
                        l_ot = (0.299 * rgba_u8[yy, xx, 0] + 0.587 * rgba_u8[yy, xx, 1] + 0.114 * rgba_u8[yy, xx, 2]) * inv_255
                        if (l_ot - l_me) >= edge_threshold:
                            hit = True
                            break
                if hit:
                    out[y, x, 0] = r
                    out[y, x, 1] = g
                    out[y, x, 2] = b
                    out[y, x, 3] = 255
    return out


def _gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a


def detect_pixel_grid(image_u8: np.ndarray, tolerance: int = 8) -> int:
    """Detects the integer block scale factor of an already-upscaled pixel-art image (returns >= 1)."""
    h, w = image_u8.shape[:2]
    c = min(4, image_u8.shape[2])
    g = 0
    step_y = max(1, h // 64)
    step_x = max(1, w // 64)

    for y in range(0, h, step_y):
        run = 1
        for x in range(1, w):
            if np.max(np.abs(image_u8[y, x, :c].astype(np.int32) - image_u8[y, x - 1, :c].astype(np.int32))) <= tolerance:
                run += 1
            else:
                g = _gcd(g, run)
                run = 1
                if g == 1:
                    return 1
    for x in range(0, w, step_x):
        run = 1
        for y in range(1, h):
            if np.max(np.abs(image_u8[y, x, :c].astype(np.int32) - image_u8[y - 1, x, :c].astype(np.int32))) <= tolerance:
                run += 1
            else:
                g = _gcd(g, run)
                run = 1
                if g == 1:
                    return 1
    return g if g > 0 else 1


def median_hsv_fast(image: np.ndarray) -> np.ndarray:
    """Fast 3x3 median filter in HSV space."""
    hsv = rgb2hsv_fast(image)
    for ch in range(3):
        hsv[:, :, ch] = median_filter(hsv[:, :, ch], size=3, mode="reflect")
    return hsv2rgb_fast(hsv)


def dilate_rgb_fast(image: np.ndarray, size: int = 3) -> np.ndarray:
    """Fast morphological dilation per RGB channel."""
    out = np.empty_like(image)
    for ch in range(3):
        out[:, :, ch] = maximum_filter(image[:, :, ch], size=size, mode="reflect")
    return out
