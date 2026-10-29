"""PixelForge: Unified Pixel-Art, Reel Stylization, Game-Asset & CV Audio-Sync Engine.

Hybrid Edge-Aware Pixel Art, Reel Stylization, Game-Asset & Computer-Vision Engine.
"""

from .bar_fills import detect_frames_bar_fills, detect_video_bar_fills
from .engine import PRESETS, PixelForge, Pyx
from .exporters import (
    build_tileset,
    encode_png_bytes,
    pack_sprite_sheet,
    save_gif,
    save_mp4,
    save_png,
    unique_colors_hex,
    upscale_with_grid,
)
from .fast_ops import ALL_DITHER_METHODS, BLUE_NOISE_64X64, detect_pixel_grid
from .motion import analyze_frames_motion, analyze_video_motion, sync_video_motion_to_audio
from .palettes import (
    BUILTIN_PALETTES,
    BasePalette,
    Pal,
    extract_hybrid_bgm_oklab,
    extract_oklab_median_cut,
    fetch_lospec_palette,
    get_builtin_palette,
    list_builtin_palettes,
    parse_palette_text,
    resolve_palette,
)
from .stroke_draws import detect_frames_stroke_draws, render_stroke_draws_proof
from .styles import STYLE_FUNCTIONS, apply_style, list_styles, render_styles_showcase
from .triggers import extract_video_sound_triggers, load_trigger_catalog

__version__ = "1.0.0"

__all__ = [
    "PixelForge",
    "Pyx",
    "PRESETS",
    "Pal",
    "BasePalette",
    "BUILTIN_PALETTES",
    "ALL_DITHER_METHODS",
    "BLUE_NOISE_64X64",
    "detect_pixel_grid",
    "get_builtin_palette",
    "list_builtin_palettes",
    "parse_palette_text",
    "fetch_lospec_palette",
    "extract_oklab_median_cut",
    "extract_hybrid_bgm_oklab",
    "resolve_palette",
    "upscale_with_grid",
    "encode_png_bytes",
    "save_png",
    "save_gif",
    "save_mp4",
    "pack_sprite_sheet",
    "build_tileset",
    "unique_colors_hex",
    "STYLE_FUNCTIONS",
    "apply_style",
    "list_styles",
    "render_styles_showcase",
    "analyze_frames_motion",
    "analyze_video_motion",
    "sync_video_motion_to_audio",
    "detect_frames_bar_fills",
    "detect_video_bar_fills",
    "detect_frames_stroke_draws",
    "render_stroke_draws_proof",
    "extract_video_sound_triggers",
    "load_trigger_catalog",
]
