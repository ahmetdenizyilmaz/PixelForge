"""Unified PixelForge Engine: Merges PixelForge + PixelForge + New Hybrid Algorithms.

Provides:
- `PixelForge` class (`fit`, `transform`, `fit_transform`, `convert_file`, `convert_video`)
- `PRESETS` dictionary covering 14 built-in presets for pixel art, sprites, retro hardware, and stylized animation
- `Pyx` alias for drop-in backward compatibility with PixelForge scripts.
"""

from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import imageio.v3 as iio
import numpy as np
from PIL import Image
from sklearn.utils.extmath import randomized_svd

from .exporters import (
    ensure_rgba_u8,
    save_gif,
    save_mp4,
    save_png,
    unique_colors_hex,
    upscale_with_grid,
)
from .fast_ops import (
    ALL_DITHER_METHODS,
    DIFFUSION_KERNELS,
    ORDERED_MATRICES,
    detect_pixel_grid,
    equalize_adapthist_fast,
    floyd_dither_numba,
    kuwahara_filter_numba,
    palette_spread,
    parse_custom_matrix,
    quantize_diffusion_rgba_numba,
    quantize_ordered_rgba_numba,
    remove_orphans_numba,
    resample_rgba_numba,
    rgb2oklab,
    smooth_majority_numba,
    sprite_outline_numba,
    tone_adjust_rgba_numba,
)
from .palettes import (
    BasePalette,
    HybridOKLabBGM,
    norm_hex,
    parse_hex_color,
    resolve_palette,
    rgb_to_hex,
)
from .styles import STYLE_FUNCTIONS, apply_style, list_styles


ASPECT_RATIOS: Dict[str, Optional[float]] = {
    "original": None,
    "1:1": 1.0,
    "4:3": 4.0 / 3.0,
    "3:4": 3.0 / 4.0,
    "3:2": 3.0 / 2.0,
    "2:3": 2.0 / 3.0,
    "16:9": 16.0 / 9.0,
    "9:16": 9.0 / 16.0,
}

RESAMPLE_MODES: Dict[str, int] = {
    "box": 0,
    "average": 0,
    "nearest": 1,
    "sobel": 2,
    "sobel_edge": 2,
    "hybrid": 3,
    "hybrid_edge_box": 3,
}

OUTLINE_MODES: Dict[str, int] = {
    "none": 0,
    "outer": 1,
    "outside": 1,
    "inner": 2,
    "inside": 2,
    "ink": 3,
}

# Merged Presets: 14 built-in PixelForge presets
PRESETS: Dict[str, Dict[str, Any]] = {
    "hybrid-crisp": {
        "name": "PixelForge Hybrid Crisp",
        "description": "Hybrid edge-medoid downsampling + Hybrid OKLab-BGM 24-color palette + Blue-Noise dither + orphan cleanup.",
        "config": {"width": 128, "resample": "hybrid", "palette": 24, "dither": "bluenoise", "dither_strength": 0.45, "remove_orphans": True},
    },
    "kurzgesagt-pixel": {
        "name": "Kurzgesagt Cosmic Pixel",
        "description": "Kuwahara flat-paint brush + Hybrid edge downsampling + Kurzgesagt Cosmic 24 palette + Blue-Noise.",
        "config": {"width": 144, "resample": "hybrid", "kuwahara": 3, "palette": "kurzgesagt-24", "dither": "bluenoise", "dither_strength": 0.35, "contrast": 0.12, "saturation": 0.18, "remove_orphans": True},
    },
    "chunky-ink-sprite": {
        "name": "Chunky Inked Cartoon",
        "description": "Kuwahara flat blocks + Hybrid edge resampling + Endesga 32 + 1px internal comic ink outlines.",
        "config": {"width": 136, "resample": "hybrid", "kuwahara": 2, "palette": "endesga-32", "dither": "none", "remove_orphans": True, "smooth_majority": True, "outline_mode": "ink", "outline_color": "#181425"},
    },
    "pc98-cyber-dither": {
        "name": "NEC PC-9801 Cyber Anime",
        "description": "Sobel edge-preserving downsampling + PC-98 Cyber 16 palette + Bayer 4x4 crosshatch + dark ink lines.",
        "config": {"width": 160, "resample": "sobel", "palette": "pc98-cyber-16", "dither": "bayer4", "dither_strength": 0.65, "outline_mode": "ink", "outline_color": "#080614"},
    },
    "aloboi-dream": {
        "name": "Aloboi Pastel Dreamcore",
        "description": "Hybrid downsampling + Aloboi Dreamcore 16 palette + Sierra Lite smooth diffusion.",
        "config": {"width": 140, "resample": "hybrid", "palette": "aloboi-dream-16", "dither": "sierra-lite", "dither_strength": 0.65},
    },
    "balanced": {
        "name": "Balanced (Endesga 32)",
        "description": "Endesga 32 palette with Bayer 4x4 ordered dithering.",
        "config": {"width": 96, "resample": "hybrid", "palette": "endesga-32", "dither": "bayer4", "dither_strength": 0.6},
    },
    "game-boy": {
        "name": "Game Boy (DMG)",
        "description": "Four classic olive greens, 160 px wide, Bayer 4x4 dither.",
        "config": {"width": 160, "resample": "hybrid", "palette": "game-boy-dmg", "dither": "bayer4", "dither_strength": 1.0, "contrast": 0.15},
    },
    "pico-8": {
        "name": "PICO-8 Fantasy Console",
        "description": "128 px wide, PICO-8 16-color palette, 64x64 Void-and-Cluster Blue Noise dither.",
        "config": {"width": 128, "resample": "hybrid", "palette": "pico-8", "dither": "bluenoise", "dither_strength": 0.7},
    },
    "one-bit": {
        "name": "1-Bit Macintosh Atkinson",
        "description": "Classic 2-color monitor look with crisp Atkinson error diffusion.",
        "config": {"width": 192, "resample": "hybrid", "palette": "1-bit-monitor", "dither": "atkinson", "dither_strength": 1.0, "contrast": 0.2},
    },
    "faithful": {
        "name": "Faithful Extracted 24",
        "description": "24-color Hybrid OKLab-BGM extracted palette with serpentine Floyd-Steinberg diffusion.",
        "config": {"width": 128, "resample": "hybrid", "palette": 24, "dither": "floyd-steinberg", "dither_strength": 0.75},
    },
    "sprite": {
        "name": "Clean Game Sprite",
        "description": "No dither, Hybrid sharp edges, 12 extracted colors, orphan cleanup, and 1px outer dark outline.",
        "config": {"width": 48, "resample": "hybrid", "palette": 12, "dither": "none", "remove_orphans": True, "outline_mode": "outer", "outline_color": "#1a1c2c"},
    },
    "cga": {
        "name": "IBM CGA 16",
        "description": "16 hard CGA colors with an 8x8 Bayer pattern.",
        "config": {"width": 160, "resample": "hybrid", "palette": "cga-16", "dither": "bayer8", "dither_strength": 1.0},
    },
    "newsprint": {
        "name": "Newsprint Halftone",
        "description": "4-shade greyscale with 8x8 45-degree clustered-dot halftone screen.",
        "config": {"width": 220, "resample": "box", "palette": "grayscale-4", "dither": "cluster8", "dither_strength": 1.0, "saturation": -1.0},
    },
    "soft": {
        "name": "Soft Painterly (Resurrect 64)",
        "description": "Resurrect 64 with Sierra Lite diffusion and 3x3 majority speck smoothing.",
        "config": {"width": 112, "resample": "hybrid", "palette": "resurrect-64", "dither": "sierra-lite", "dither_strength": 0.6, "smooth_majority": True},
    },
}


def compute_crop_rect(
    src_w: int,
    src_h: int,
    aspect: str = "original",
    zoom: float = 1.0,
    pan_x: float = 0.5,
    pan_y: float = 0.5,
) -> Tuple[int, int, int, int]:
    """Computes integer `(x, y, w, h)` source crop rectangle for framing & zoom."""
    ratio = ASPECT_RATIOS.get(aspect) or (src_w / max(1, src_h))
    w = float(src_w)
    h = w / ratio
    if h > src_h:
        h = float(src_h)
        w = h * ratio
    z = max(1.0, float(zoom))
    cw = max(1, min(src_w, int(round(w / z))))
    ch = max(1, min(src_h, int(round(h / z))))
    cx = int(round((src_w - cw) * float(np.clip(pan_x, 0.0, 1.0))))
    cy = int(round((src_h - ch) * float(np.clip(pan_y, 0.0, 1.0))))
    return cx, cy, cw, ch


class PixelForge:
    """Unified Pixel-Art, Reel Stylization & Game-Asset Engine (32-Thread Numba + OKLab + BGM)."""

    def __init__(
        self,
        width: Optional[int] = None,
        height: Optional[int] = None,
        factor: Optional[int] = None,
        upscale: int = 1,
        resample: str = "hybrid",
        edge_sharpness: float = 0.78,
        palette: Union[int, str, Sequence[Any], BasePalette, np.ndarray, None] = 16,
        extract_mode: str = "hybrid_bgm_oklab",
        distance: str = "oklab",
        dither: str = "bluenoise",
        dither_strength: float = 0.55,
        custom_matrix: Optional[Any] = None,
        serpentine: bool = True,
        # Pre-adjustments & pre-filters
        brightness: float = 0.0,
        contrast: float = 0.0,
        saturation: float = 0.0,
        hue: float = 0.0,
        gamma: float = 1.0,
        clahe: bool = False,
        svd: bool = False,
        kuwahara: int = 0,
        # Framing & alpha
        aspect: str = "original",
        zoom: float = 1.0,
        pan_x: float = 0.5,
        pan_y: float = 0.5,
        alpha_threshold: float = 0.5,
        auto_detect_grid: bool = False,
        # Post-cleanup & outlines
        remove_orphans: bool = False,
        smooth_majority: bool = False,
        outline_mode: str = "none",
        outline_color: str = "#181425",
        outline_corners: bool = False,
        # Export options
        grid: bool = False,
        grid_color: str = "#000000",
        # Optional full procedural Reel style (from styles.py) or preset
        style: Optional[str] = None,
        preset: Optional[str] = None,
        # Legacy PixelForge compatibility kwargs
        depth: int = 1,
        sobel: int = 3,
        alpha: Optional[float] = None,
    ) -> None:
        if preset is not None:
            if preset not in PRESETS:
                raise ValueError(f"Unknown preset '{preset}'. Available: {list(PRESETS)}")
            p_cfg = PRESETS[preset]["config"]
            width = width if width is not None else p_cfg.get("width")
            resample = p_cfg.get("resample", resample)
            palette = p_cfg.get("palette", palette)
            dither = p_cfg.get("dither", dither)
            dither_strength = p_cfg.get("dither_strength", dither_strength)
            brightness = p_cfg.get("brightness", brightness)
            contrast = p_cfg.get("contrast", contrast)
            saturation = p_cfg.get("saturation", saturation)
            kuwahara = p_cfg.get("kuwahara", kuwahara)
            remove_orphans = p_cfg.get("remove_orphans", remove_orphans)
            smooth_majority = p_cfg.get("smooth_majority", smooth_majority)
            outline_mode = p_cfg.get("outline_mode", outline_mode)
            outline_color = p_cfg.get("outline_color", outline_color)

        self.width = int(width) if width else None
        self.height = int(height) if height else None
        self.factor = int(factor) if factor else None
        self.upscale = int(upscale[0]) if isinstance(upscale, (tuple, list)) else max(1, int(upscale))

        resample_key = str(resample or "hybrid").lower()
        if resample_key not in RESAMPLE_MODES:
            raise ValueError(f"Unknown resample mode '{resample}'. Valid: {list(RESAMPLE_MODES)}")
        self.resample = resample_key
        self.edge_sharpness = float(np.clip(edge_sharpness, 0.0, 1.0))

        self.palette = palette
        self.extract_mode = extract_mode
        self.distance = str(distance or "oklab").lower()

        d_norm = "none" if dither is None else str(dither).lower()
        if d_norm == "bayer":
            d_norm = "bayer4"
        elif d_norm == "floyd":
            d_norm = "floyd-steinberg"
        if d_norm not in ALL_DITHER_METHODS:
            raise ValueError(f"Unknown dither '{dither}'. Valid: {ALL_DITHER_METHODS}")
        self.dither = d_norm
        self.dither_strength = float(np.clip(dither_strength, 0.0, 1.0))
        self.custom_matrix = parse_custom_matrix(custom_matrix) if custom_matrix is not None else None
        self.serpentine = bool(serpentine)

        self.brightness = float(np.clip(brightness, -1.0, 1.0))
        self.contrast = float(np.clip(contrast, -1.0, 1.0))
        self.saturation = float(np.clip(saturation, -1.0, 1.0))
        self.hue = float(np.clip(hue, -180.0, 180.0))
        self.gamma = float(np.clip(gamma, 0.2, 5.0))
        self.clahe = bool(clahe)
        self.svd = bool(svd)
        self.kuwahara = max(0, int(kuwahara))

        self.aspect = aspect if aspect in ASPECT_RATIOS else "original"
        self.zoom = max(1.0, float(zoom))
        self.pan_x = float(np.clip(pan_x, 0.0, 1.0))
        self.pan_y = float(np.clip(pan_y, 0.0, 1.0))
        self.alpha_threshold = float(alpha if alpha is not None else alpha_threshold)
        self.auto_detect_grid = bool(auto_detect_grid)

        self.remove_orphans = bool(remove_orphans)
        self.smooth_majority = bool(smooth_majority)
        ol_key = str(outline_mode or "none").lower()
        if ol_key not in OUTLINE_MODES:
            raise ValueError(f"Unknown outline_mode '{outline_mode}'. Valid: {list(OUTLINE_MODES)}")
        self.outline_mode = ol_key
        self.outline_color = norm_hex(outline_color)
        self.outline_corners = bool(outline_corners)

        self.grid = bool(grid)
        self.grid_color = norm_hex(grid_color)

        if style is not None and style not in STYLE_FUNCTIONS:
            raise ValueError(f"Unknown Reel style '{style}'. Valid: {list(STYLE_FUNCTIONS)}")
        self.style = style

        # Fitted state
        self.palette_u8: Optional[np.ndarray] = None
        self.bgm_model: Optional[HybridOKLabBGM] = None
        self.palette_name: str = "unfitted"
        self.is_fitted: bool = False
        self.last_stats: Dict[str, Any] = {}

    @property
    def colors(self) -> np.ndarray:
        """Returns fitted uint8 RGB palette array of shape (K, 3)."""
        if self.palette_u8 is None:
            raise RuntimeError("Call fit(image) or fit_transform(image) first!")
        return self.palette_u8

    @property
    def palette_hex(self) -> List[str]:
        if self.palette_u8 is None:
            return []
        return [rgb_to_hex(c) for c in self.palette_u8]

    def _resolve_target_size(self, crop_w: int, crop_h: int, detected_grid: int = 1) -> Tuple[int, int]:
        if detected_grid > 1 and self.width is None and self.height is None and self.factor is None:
            return max(1, crop_w // detected_grid), max(1, crop_h // detected_grid)
        if self.width is not None and self.height is not None:
            return max(1, self.width), max(1, self.height)
        if self.width is not None:
            return max(1, self.width), max(1, int(round(self.width * crop_h / max(1, crop_w))))
        if self.height is not None:
            return max(1, int(round(self.height * crop_w / max(1, crop_h)))), max(1, self.height)
        if self.factor is not None:
            return max(1, crop_w // max(1, self.factor)), max(1, crop_h // max(1, self.factor))
        # Smart default: 128 px wide
        w = min(crop_w, 128)
        return max(1, w), max(1, int(round(w * crop_h / max(1, crop_w))))

    def _apply_svd(self, rgb_f32: np.ndarray) -> np.ndarray:
        h, w, _ = rgb_f32.shape
        n_comp = min(32, min(h, w) - 1)
        if n_comp < 2:
            return rgb_f32
        out = np.empty_like(rgb_f32)
        for ch in range(3):
            u, s, vt = randomized_svd(rgb_f32[:, :, ch].astype(np.float64), n_components=n_comp, n_iter=6, random_state=1234)
            out[:, :, ch] = np.clip((u * s) @ vt, 0.0, 1.0).astype(np.float32)
        return out

    def _prepare_buffer(self, rgba_u8: np.ndarray) -> Tuple[np.ndarray, int]:
        """Runs pre-filters, crop/aspect, 32-thread resampling, and tone/alpha adjustment."""
        src = rgba_u8
        grid_block = detect_pixel_grid(src) if self.auto_detect_grid else 1
        src_h, src_w, _ = src.shape
        cx, cy, cw, ch = compute_crop_rect(src_w, src_h, self.aspect, self.zoom, self.pan_x, self.pan_y)
        out_w, out_h = self._resolve_target_size(cw, ch, detected_grid=grid_block)

        work_src = src
        if self.kuwahara > 0:
            # Apply Kuwahara flat-region painting at a bounded pre-pixel resolution for speed & bold shapes
            kh, kw = work_src.shape[:2]
            cap_scale = min(1.0, max(out_w * 3, 384) / max(1, max(kw, kh)))
            if cap_scale < 0.85:
                pil_small = Image.fromarray(work_src).resize(
                    (max(1, int(kw * cap_scale)), max(1, int(kh * cap_scale))),
                    resample=Image.Resampling.BILINEAR,
                )
                work_src = np.asarray(pil_small, dtype=np.uint8)
                src_h, src_w = work_src.shape[:2]
                cx, cy, cw, ch = compute_crop_rect(src_w, src_h, self.aspect, self.zoom, self.pan_x, self.pan_y)
            f_img = work_src.astype(np.float32) / 255.0
            painted = kuwahara_filter_numba(f_img, radius=self.kuwahara)
            work_src = np.clip(np.round(painted * 255.0), 0, 255).astype(np.uint8)

        mode_id = 1 if grid_block > 1 and self.auto_detect_grid else RESAMPLE_MODES[self.resample]
        buf = resample_rgba_numba(
            work_src,
            out_w=out_w,
            out_h=out_h,
            mode_id=mode_id,
            crop_x=cx,
            crop_y=cy,
            crop_w=cw,
            crop_h=ch,
            edge_sharpness=self.edge_sharpness,
        )

        if self.svd:
            buf[:, :, :3] = self._apply_svd(buf[:, :, :3])
        if self.clahe:
            mask = buf[:, :, 3] > 0.0
            if np.any(mask):
                buf[:, :, :3] = equalize_adapthist_fast(buf[:, :, :3]).astype(np.float32)

        buf = tone_adjust_rgba_numba(
            buf,
            brightness=self.brightness,
            contrast=self.contrast,
            saturation=self.saturation,
            hue_deg=self.hue,
            gamma=self.gamma,
            alpha_threshold=self.alpha_threshold,
        )
        return buf, grid_block

    def fit(self, image: np.ndarray, y: Any = None) -> "PixelForge":
        """Fits/locks the target palette from `image` (so multi-frame video/sprites share one stable palette)."""
        if self.style is not None and isinstance(self.palette, int):
            self.is_fitted = True
            return self
        rgba = ensure_rgba_u8(image)
        buf, _ = self._prepare_buffer(rgba)
        prep_u8 = np.clip(np.round(buf * 255.0), 0, 255).astype(np.uint8)
        self.palette_u8, self.bgm_model, self.palette_name = resolve_palette(
            self.palette, image_u8=prep_u8, extract_mode=self.extract_mode
        )
        self.is_fitted = True
        return self

    def _quantize_and_dither(self, buf: np.ndarray) -> np.ndarray:
        h, w, _ = buf.shape
        if self.palette_u8 is None or len(self.palette_u8) == 0:
            return np.clip(np.round(buf * 255.0), 0, 255).astype(np.uint8)

        pal_u8 = np.ascontiguousarray(self.palette_u8[:, :3], dtype=np.uint8)
        pal_f32 = pal_u8.astype(np.float32) / 255.0
        pal_lab = rgb2oklab(pal_f32).astype(np.float32)
        use_oklab = self.distance != "rgb"

        method = self.dither
        strength = self.dither_strength
        if strength <= 0.0:
            method = "none"

        if method == "none":
            dummy_map = np.zeros((1, 1), dtype=np.float32)
            return quantize_ordered_rgba_numba(buf, pal_u8, pal_f32, pal_lab, dummy_map, 0.0, use_oklab)

        if method in ("bgm_posterior", "naive") and self.bgm_model is not None and len(self.bgm_model.means_) == len(pal_u8):
            flat_lab = rgb2oklab(buf[:, :, :3].reshape(-1, 3))
            probs = self.bgm_model.predict_proba(flat_lab)
            if method == "bgm_posterior":
                probs_3d = np.ascontiguousarray(
                    [probs[:, i].reshape((h, w)) for i in range(len(pal_u8))],
                    dtype=np.float64,
                )
                idx = floyd_dither_numba(probs_3d, h, w)
                rgb_out = pal_u8[idx]
            else:
                p1 = np.argmax(probs, axis=1)
                rgb_flat = pal_u8[p1].copy()
                probs[np.arange(len(p1)), p1] = 0.0
                p2 = np.argmax(probs, axis=1)
                thresh = 1.0 / (len(pal_u8) * (1.0 + strength) + 1.0)
                checker = ((np.arange(h)[:, None] + np.arange(w)[None, :]) % 2 == 1).reshape(-1)
                swap = checker & (np.max(probs, axis=1) > thresh)
                rgb_flat[swap] = pal_u8[p2[swap]]
                rgb_out = rgb_flat.reshape((h, w, 3))
            alpha_u8 = np.where(buf[:, :, 3] >= 0.5, 255, 0).astype(np.uint8)
            out = np.dstack([rgb_out, alpha_u8])
            out[alpha_u8 == 0] = 0
            return out

        if method in ORDERED_MATRICES or method == "custom":
            tmap = self.custom_matrix if (method == "custom" and self.custom_matrix is not None) else ORDERED_MATRICES.get(method, ORDERED_MATRICES["bayer4"])
            spread = palette_spread(pal_u8)
            amount = float(spread * strength)
            return quantize_ordered_rgba_numba(
                buf, pal_u8, pal_f32, pal_lab, np.ascontiguousarray(tmap, dtype=np.float32), amount, use_oklab
            )

        if method in DIFFUSION_KERNELS:
            kern = DIFFUSION_KERNELS[method]
            k_dx = np.array([k[0] for k in kern], dtype=np.int32)
            k_dy = np.array([k[1] for k in kern], dtype=np.int32)
            k_wt = np.array([k[2] for k in kern], dtype=np.float32)
            return quantize_diffusion_rgba_numba(
                buf, pal_u8, pal_f32, pal_lab, k_dx, k_dy, k_wt, strength, use_oklab, self.serpentine
            )

        # Fallback ordered bayer4
        spread = palette_spread(pal_u8)
        return quantize_ordered_rgba_numba(
            buf, pal_u8, pal_f32, pal_lab, ORDERED_MATRICES["bayer4"], float(spread * strength), use_oklab
        )

    def transform_1x(self, image: np.ndarray, frame_index: int = 0) -> np.ndarray:
        """Transforms `image` and returns the 1x pixel-art RGBA (or RGB if input was RGB & opaque) uint8 buffer."""
        t0 = time.perf_counter()
        has_input_alpha = image.ndim == 3 and image.shape[2] == 4
        rgba = ensure_rgba_u8(image)

        if self.style is not None:
            eff_factor = self.factor or (max(2, rgba.shape[1] // self.width) if self.width else 3)
            styled_rgb = apply_style(
                rgba[:, :, :3],
                style=self.style,
                factor=eff_factor,
                upscale=1,
                frame_index=frame_index,
            )
            px = ensure_rgba_u8(styled_rgb)
            if has_input_alpha:
                # Preserve hard-cut source alpha resized to styled_rgb dimensions
                sh, sw = px.shape[:2]
                a_small = np.asarray(
                    Image.fromarray(rgba[:, :, 3]).resize((sw, sh), resample=Image.Resampling.NEAREST),
                    dtype=np.uint8,
                )
                px[:, :, 3] = np.where(a_small >= int(self.alpha_threshold * 255), 255, 0).astype(np.uint8)
                px[px[:, :, 3] == 0] = 0
            # Optional post-cleanup & outline composability on top of Reel styles!
            if self.remove_orphans:
                px = remove_orphans_numba(px)
            if self.smooth_majority:
                px = smooth_majority_numba(px)
            if OUTLINE_MODES[self.outline_mode] > 0:
                or_, og_, ob_ = parse_hex_color(self.outline_color)
                px = sprite_outline_numba(px, OUTLINE_MODES[self.outline_mode], or_, og_, ob_, self.outline_corners)
            self.last_stats = {
                "width": px.shape[1],
                "height": px.shape[0],
                "elapsed_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                "style": self.style,
            }
            return px

        if not self.is_fitted:
            self.fit(rgba)

        buf, grid_block = self._prepare_buffer(rgba)
        px = self._quantize_and_dither(buf)

        if self.remove_orphans:
            px = remove_orphans_numba(px)
        if self.smooth_majority:
            px = smooth_majority_numba(px)
        if OUTLINE_MODES[self.outline_mode] > 0:
            or_, og_, ob_ = parse_hex_color(self.outline_color)
            px = sprite_outline_numba(px, OUTLINE_MODES[self.outline_mode], or_, og_, ob_, self.outline_corners)

        self.last_stats = {
            "width": int(px.shape[1]),
            "height": int(px.shape[0]),
            "palette_name": self.palette_name,
            "palette_size": int(len(self.palette_u8)) if self.palette_u8 is not None else 0,
            "used_colors": len(unique_colors_hex(px)),
            "detected_grid": grid_block,
            "resample": self.resample,
            "dither": self.dither,
            "elapsed_ms": round((time.perf_counter() - t0) * 1000.0, 2),
        }
        return px

    def transform(self, image: np.ndarray, y: Any = None, frame_index: int = 0) -> np.ndarray:
        """Transforms `image` and applies `upscale` + optional `grid`. Returns RGB if opaque 3-ch input, else RGBA."""
        has_input_alpha = image.ndim == 3 and image.shape[2] == 4
        px_1x = self.transform_1x(image, frame_index=frame_index)
        up = upscale_with_grid(px_1x, scale=self.upscale, grid=self.grid, grid_color=self.grid_color)
        if not has_input_alpha and np.all(up[:, :, 3] == 255):
            return up[:, :, :3]
        return up

    def fit_transform(self, image: np.ndarray, y: Any = None, frame_index: int = 0) -> np.ndarray:
        return self.fit(image).transform(image, frame_index=frame_index)

    def convert_file(
        self,
        input_path: Union[str, Path],
        output_path: Union[str, Path],
        indexed: bool = True,
    ) -> Dict[str, Any]:
        """Reads an image file, runs the full PixelForge pipeline, and writes an Indexed or RGBA PNG."""
        pil_in = Image.open(input_path)
        mode = "RGBA" if ("A" in pil_in.getbands() or pil_in.info.get("transparency") is not None) else "RGB"
        arr = np.asarray(pil_in.convert(mode), dtype=np.uint8)
        self.fit(arr)
        px_1x = self.transform_1x(arr)
        png_meta = save_png(
            px_1x,
            output_path=output_path,
            scale=self.upscale,
            grid=self.grid,
            grid_color=self.grid_color,
            indexed=indexed,
        )
        return {**self.last_stats, **png_meta, "palette_hex": self.palette_hex}

    def convert_video(
        self,
        input_video: Union[str, Path],
        output_path: Union[str, Path],
        audio_path: Optional[Union[str, Path]] = None,
        keep_source_audio: bool = True,
        max_frames: Optional[int] = None,
        fps_override: Optional[float] = None,
        lock_palette: bool = True,
    ) -> Dict[str, Any]:
        """Converts a video file to frame-coherent pixel-art MP4 or GIF."""
        t0 = time.perf_counter()
        in_p = Path(input_video)
        out_p = Path(output_path)
        try:
            src_fps = float(iio.immeta(str(in_p)).get("fps", 30.0))
        except Exception:
            src_fps = 30.0
        fps = float(fps_override or src_fps)

        frames_1x: List[np.ndarray] = []
        for idx, frame in enumerate(iio.imiter(str(in_p))):
            if idx == 0 or not lock_palette:
                self.fit(frame)
            frames_1x.append(self.transform_1x(frame, frame_index=idx))
            if max_frames is not None and len(frames_1x) >= int(max_frames):
                break

        if not frames_1x:
            raise ValueError(f"No frames decoded from {in_p}")

        if out_p.suffix.lower() == ".gif":
            meta = save_gif(frames_1x, out_p, fps=fps, scale=self.upscale)
        else:
            mux_audio = audio_path if audio_path else (in_p if keep_source_audio else None)
            meta = save_mp4(frames_1x, out_p, fps=fps, scale=self.upscale, audio_path=mux_audio)

        return {
            **meta,
            "pixel_width": int(frames_1x[0].shape[1]),
            "pixel_height": int(frames_1x[0].shape[0]),
            "style": self.style,
            "palette_name": self.palette_name,
            "dither": self.dither,
            "resample": self.resample,
            "elapsed_s": round(time.perf_counter() - t0, 2),
        }


# Drop-in backward compatibility alias for PixelForge users
Pyx = PixelForge
