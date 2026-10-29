"""Unified 15-Tool Model Context Protocol (MCP) Server for PixelForge.

Merges:
- PixelForge's full pixel-art pipeline (17+ dithers incl. Blue Noise & 7 diffusions,
  Lospec/.gpl/.hex/.pal palettes, tone controls, orphan/majority cleanup, 1px sprite outlines,
  indexed PNGs, grid overlays, Sprite Sheet + JSON Atlas, Deduplicated Tilesets, pixel-grid detector).
- PixelForge's 12 Reel/Kurzgesagt/PC-98/Oscilloscope styles, Sobel & Hybrid Edge-Medoid downsampling,
  Bayesian OKLab-BGM palette discovery, and Computer-Vision Audio-Sync detectors (motion, bar fills,
  progressive circle/outline stroke draws, and SoundBit trigger extraction).

Run via:
    python -m pixelforge.mcp_server
"""

import json
from pathlib import Path
import sys
import time
from typing import Any, Dict, List

import imageio.v3 as iio
import numpy as np
from PIL import Image, ImageDraw

from .bar_fills import detect_video_bar_fills
from .engine import OUTLINE_MODES, PRESETS, RESAMPLE_MODES, PixelForge
from .exporters import build_tileset, ensure_rgba_u8, pack_sprite_sheet, save_png
from .fast_ops import ALL_DITHER_METHODS, detect_pixel_grid
from .motion import analyze_video_motion, sync_video_motion_to_audio
from .palettes import (
    export_palette_gpl,
    export_palette_hex,
    export_palette_json,
    list_builtin_palettes,
    resolve_palette,
    rgb_to_hex,
)
from .stroke_draws import detect_frames_stroke_draws, render_stroke_draws_proof
from .styles import STYLE_FUNCTIONS, list_styles, render_styles_showcase
from .triggers import (
    DEFAULT_TRIGGER_CONFIG,
    extract_video_sound_triggers,
    load_trigger_catalog,
)


TOOLS_SCHEMA: List[Dict[str, Any]] = [
    {
        "name": "catalog_list",
        "description": "Lists all merged PixelForge capabilities: 14 presets, 12 Reel styles, 43+ built-in Lospec/Hardware/Reel palettes, 19 dithering methods (incl. Blue Noise & 7 error-diffusion kernels), 4 downsamplers (incl. Hybrid Edge-Medoid), and 4 outline modes.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "image_convert",
        "description": "Converts an image to pixel art using the full unified PixelForge pipeline (Hybrid/Sobel/Box/Nearest downsampling, Hybrid OKLab-BGM or Lospec/.gpl/.hex/.pal palette, 19 dithering modes, Kuwahara pre-brush, tone controls, orphan/majority cleanup, 1px inner/outer/ink outlines, indexed PNG, and pixel grid).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string", "description": "Input image path."},
                "output_path": {"type": "string", "description": "Output PNG path."},
                "preset": {"type": "string", "description": "Optional preset id (e.g. 'hybrid-crisp', 'kurzgesagt-pixel', 'chunky-ink-sprite', 'pico-8', 'sprite', 'one-bit')."},
                "width": {"type": "integer", "description": "Target pixel width (height auto-computed if omitted)."},
                "height": {"type": "integer", "description": "Optional target pixel height."},
                "factor": {"type": "integer", "description": "Alternative integer downscale factor."},
                "upscale": {"type": "integer", "default": 4, "description": "Integer nearest-neighbor output upscale."},
                "resample": {"type": "string", "default": "hybrid", "enum": ["hybrid", "sobel", "box", "nearest"]},
                "palette": {"type": ["integer", "string"], "default": 24, "description": "Color count to extract (2..256), built-in id ('endesga-32', 'pico-8', 'kurzgesagt-24'), 'lospec:<slug>', palette file path (.gpl/.hex/.pal/.json), or 'none'."},
                "extract_mode": {"type": "string", "default": "hybrid_bgm_oklab", "enum": ["hybrid_bgm_oklab", "oklab_median_cut"]},
                "dither": {"type": "string", "default": "bluenoise", "enum": list(ALL_DITHER_METHODS)},
                "dither_strength": {"type": "number", "default": 0.5, "description": "Dither strength in [0.0, 1.0] (palette-spread normalized)."},
                "kuwahara": {"type": "integer", "default": 0, "description": "Pre-pixel Kuwahara flat-paint radius (0=off, 2..5=flat cartoon blocks)."},
                "brightness": {"type": "number", "default": 0.0},
                "contrast": {"type": "number", "default": 0.0},
                "saturation": {"type": "number", "default": 0.0},
                "hue": {"type": "number", "default": 0.0},
                "gamma": {"type": "number", "default": 1.0},
                "remove_orphans": {"type": "boolean", "default": False, "description": "Remove isolated 1-pixel strays."},
                "smooth_majority": {"type": "boolean", "default": False, "description": "3x3 5-of-9 majority speck smoothing."},
                "outline_mode": {"type": "string", "default": "none", "enum": ["none", "outer", "inner", "ink"]},
                "outline_color": {"type": "string", "default": "#181425"},
                "outline_corners": {"type": "boolean", "default": False},
                "grid": {"type": "boolean", "default": False, "description": "Draw 1px pixel grid on upscaled output."},
                "indexed": {"type": "boolean", "default": True, "description": "Write compact Indexed-Color PNG (PLTE+tRNS) when <= 256 colors."},
            },
            "required": ["input_path", "output_path"],
        },
    },
    {
        "name": "image_stylize_reel",
        "description": "Applies one of the 12 procedural Reel visual styles (kurzgesagt_glow, chunky_cartoon, pc98_cyber, oscilloscope_xy, aloboi_dreamcore, bitwonder_bayer, etc.) with optional post-cleanup & 1px outlines.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"},
                "output_path": {"type": "string"},
                "style": {"type": "string", "default": "kurzgesagt_glow", "enum": list(STYLE_FUNCTIONS.keys())},
                "factor": {"type": "integer", "default": 3},
                "upscale": {"type": "integer", "default": 3},
                "remove_orphans": {"type": "boolean", "default": False},
                "outline_mode": {"type": "string", "default": "none", "enum": ["none", "outer", "inner", "ink"]},
                "outline_color": {"type": "string", "default": "#100b20"},
            },
            "required": ["input_path", "output_path"],
        },
    },
    {
        "name": "image_showcase",
        "description": "Renders a labeled multi-panel contact sheet comparing all 12 Reel styles or top PixelForge presets on an input image.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"},
                "output_path": {"type": "string"},
                "mode": {"type": "string", "default": "presets", "enum": ["presets", "reel_styles"]},
                "tile_width": {"type": "integer", "default": 320},
                "tile_height": {"type": "integer", "default": 180},
            },
            "required": ["input_path", "output_path"],
        },
    },
    {
        "name": "image_detect_grid",
        "description": "Detects the pixel-block factor of an already-upscaled pixel-art image (e.g. 4x sprite) and optionally exports its exact 1x native pixel grid.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"},
                "tolerance": {"type": "integer", "default": 8},
                "recover_1x_output_path": {"type": "string", "description": "Optional path to save recovered 1x native pixel-art PNG."},
            },
            "required": ["input_path"],
        },
    },
    {
        "name": "palette_tool",
        "description": "Extracts an optimal palette from an image (via hybrid_bgm_oklab or oklab_median_cut), fetches a Lospec palette ('lospec:<slug>'), or converts any palette to .gpl, .hex, or .json.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "palette": {"type": ["integer", "string"], "description": "Color count (if input_image given), built-in id, 'lospec:<slug>', or palette file path."},
                "input_image": {"type": "string", "description": "Optional image to extract palette from."},
                "extract_mode": {"type": "string", "default": "hybrid_bgm_oklab", "enum": ["hybrid_bgm_oklab", "oklab_median_cut"]},
                "output_file": {"type": "string", "description": "Optional output palette file (.gpl, .hex, or .json)."},
                "name": {"type": "string", "default": "PixelForge Palette"},
            },
            "required": ["palette"],
        },
    },
    {
        "name": "export_spritesheet",
        "description": "Pixelizes and packs multiple input images OR sampled video frames into a single Sprite Sheet PNG + TexturePacker/Aseprite JSON coordinate atlas.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input_paths": {"type": "array", "items": {"type": "string"}, "description": "List of input image paths (or 1 video path)."},
                "output_png": {"type": "string", "description": "Output sprite sheet PNG path."},
                "output_atlas_json": {"type": "string", "description": "Optional JSON atlas path (defaults to <output_png>.json)."},
                "preset": {"type": "string", "description": "Optional PixelForge preset (e.g. 'sprite', 'pico-8', 'hybrid-crisp')."},
                "width": {"type": "integer", "default": 64},
                "palette": {"type": ["integer", "string"], "default": 16},
                "dither": {"type": "string", "default": "none"},
                "outline_mode": {"type": "string", "default": "none", "enum": ["none", "outer", "inner", "ink"]},
                "columns": {"type": "integer", "default": 0, "description": "0 = roughly square grid."},
                "padding": {"type": "integer", "default": 1},
                "max_video_frames": {"type": "integer", "default": 16},
            },
            "required": ["input_paths", "output_png"],
        },
    },
    {
        "name": "export_tileset",
        "description": "Slices a pixel-art (or newly pixelized) image into fixed tiles (e.g. 8x8 or 16x16), deduplicates identical & X/Y/XY mirrored tiles, and writes a compact Tileset PNG + Tilemap JSON.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"},
                "output_png": {"type": "string"},
                "output_map_json": {"type": "string"},
                "pixelize_first": {"type": "boolean", "default": False},
                "width": {"type": "integer", "default": 128},
                "palette": {"type": ["integer", "string"], "default": "endesga-32"},
                "tile_width": {"type": "integer", "default": 8},
                "tile_height": {"type": "integer", "default": 8},
                "allow_flips": {"type": "boolean", "default": True},
            },
            "required": ["input_path", "output_png"],
        },
    },
    {
        "name": "video_convert",
        "description": "Converts a video file to frame-coherent pixel-art MP4 or GIF using any PixelForge preset, custom palette/dither, or 12 Reel styles, keeping original audio or muxing a custom WAV.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input_video": {"type": "string"},
                "output_path": {"type": "string", "description": ".mp4 or .gif output path."},
                "preset": {"type": "string"},
                "style": {"type": "string", "description": "Optional Reel style id (e.g. 'kurzgesagt_glow', 'pc98_cyber')."},
                "width": {"type": "integer"},
                "factor": {"type": "integer", "default": 3},
                "upscale": {"type": "integer", "default": 3},
                "resample": {"type": "string", "default": "hybrid"},
                "palette": {"type": ["integer", "string"], "default": 24},
                "dither": {"type": "string", "default": "bluenoise"},
                "audio_wav": {"type": "string", "description": "Optional custom WAV soundtrack to mux."},
                "keep_source_audio": {"type": "boolean", "default": True},
                "max_frames": {"type": "integer"},
            },
            "required": ["input_video", "output_path"],
        },
    },
    {
        "name": "video_analyze_motion",
        "description": "Analyzes a video for scene cuts, camera zoom-ins/outs, object inflation/shrinking, and per-frame motion energy for SoundBit audio sync.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "video_path": {"type": "string"},
                "max_frames": {"type": "integer"},
            },
            "required": ["video_path"],
        },
    },
    {
        "name": "video_sync_motion_to_audio",
        "description": "Locks video camera zooms, pullbacks, focal tracking, and sub-bass micro-zoom punches in pre-pixel space onto a WAV soundtrack, then stylizes and muxes MP4.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input_video": {"type": "string"},
                "audio_wav": {"type": "string"},
                "output_video": {"type": "string"},
                "bpm": {"type": "number", "default": 120.0},
                "style": {"type": "string", "default": "pc98_cyber"},
                "factor": {"type": "integer", "default": 3},
                "phrase_zoom_strength": {"type": "number", "default": 0.16},
                "bass_punch_strength": {"type": "number", "default": 0.062},
            },
            "required": ["input_video", "audio_wav", "output_video"],
        },
    },
    {
        "name": "video_detect_bar_fills",
        "description": "Detects 1D horizontal & vertical progress bars, meters, gauges, and column fills, returning frame-accurate `fill_curve` trajectories in [0.0, 1.0].",
        "inputSchema": {
            "type": "object",
            "properties": {
                "video_path": {"type": "string"},
                "max_frames": {"type": "integer"},
                "min_duration_s": {"type": "number", "default": 0.65},
            },
            "required": ["video_path"],
        },
    },
    {
        "name": "video_detect_stroke_draws",
        "description": "Detects progressive indicator drawings (`circle_draw`, `contour_outline_draw`, `callout_line_draw`) with exact `start_s`, `finish_s`, and `draw_curve`.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "video_path": {"type": "string"},
                "max_frames": {"type": "integer"},
                "min_duration_s": {"type": "number", "default": 0.28},
                "allowed_shapes": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["circle_draw", "contour_outline_draw", "callout_line_draw"]},
                },
                "proof_image_path": {"type": "string"},
            },
            "required": ["video_path"],
        },
    },
    {
        "name": "video_extract_sound_triggers",
        "description": "Extracts configurable movement-to-sound triggers (bar fills, sparse camera zooms, HUD text ticks, risers, bursts) and musical arrangement regimes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "video_path": {"type": "string"},
                "max_frames": {"type": "integer"},
                "include_catalog": {"type": "boolean", "default": False},
                "zoom_mode": {"type": "string", "default": "major_only", "enum": ["off", "major_only", "probabilistic", "musical_subtle", "all"]},
                "zoom_cooldown_s": {"type": "number", "default": 14.0},
                "zoom_min_sigma": {"type": "number", "default": 2.25},
                "zoom_include_whoosh": {"type": "boolean", "default": False},
                "enable_bar_fills": {"type": "boolean", "default": True},
                "enable_stroke_draws": {"type": "boolean", "default": False},
                "config": {"type": "object"},
            },
            "required": ["video_path"],
        },
    },
    {
        "name": "studio_info",
        "description": "Returns information and launch commands for the upgraded PixelForge WebGL 2 Real-Time Browser Studio.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _render_presets_showcase(img_u8: np.ndarray, output_path: str, tw: int = 320, th: int = 180) -> str:
    chosen = [
        "hybrid-crisp",
        "kurzgesagt-pixel",
        "chunky-ink-sprite",
        "pc98-cyber-dither",
        "aloboi-dream",
        "pico-8",
        "game-boy",
        "one-bit",
        "newsprint",
        "cga",
        "soft",
        "faithful",
    ]
    cols, rows = 4, 3
    header_h = 28
    canvas = Image.new("RGB", (cols * tw, rows * (th + header_h)), (14, 15, 22))
    draw = ImageDraw.Draw(canvas)

    for i, pid in enumerate(chosen):
        pf = PixelForge(preset=pid)
        px_1x = pf.fit(img_u8).transform_1x(img_u8)
        tile_pil = Image.fromarray(px_1x[:, :, :3]).resize((tw, th), resample=Image.Resampling.NEAREST)
        cx = (i % cols) * tw
        cy = (i // cols) * (th + header_h)
        draw.rectangle([cx, cy, cx + tw - 1, cy + header_h - 1], fill=(24, 26, 38))
        draw.text((cx + 8, cy + 7), f"{PRESETS[pid]['name']} ({pf.last_stats['used_colors']}c)", fill=(235, 240, 255))
        canvas.paste(tile_pil, (cx, cy + header_h))

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path)
    return output_path


def handle_tool_call(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    t0 = time.perf_counter()

    if name == "catalog_list":
        return {
            "presets": {k: {"name": v["name"], "description": v["description"]} for k, v in PRESETS.items()},
            "reel_styles": list_styles(),
            "palettes_count": len(list_builtin_palettes()),
            "palettes": [{"id": p["id"], "name": p["name"], "group": p["group"], "count": p["count"]} for p in list_builtin_palettes()],
            "dither_methods": list(ALL_DITHER_METHODS),
            "resample_modes": ["hybrid", "sobel", "box", "nearest"],
            "outline_modes": ["none", "outer", "inner", "ink"],
        }

    if name == "image_convert":
        pf = PixelForge(
            preset=args.get("preset"),
            width=args.get("width"),
            height=args.get("height"),
            factor=args.get("factor"),
            upscale=args.get("upscale", 4),
            resample=args.get("resample", "hybrid"),
            palette=args.get("palette", 24),
            extract_mode=args.get("extract_mode", "hybrid_bgm_oklab"),
            dither=args.get("dither", "bluenoise"),
            dither_strength=args.get("dither_strength", 0.5),
            kuwahara=args.get("kuwahara", 0),
            brightness=args.get("brightness", 0.0),
            contrast=args.get("contrast", 0.0),
            saturation=args.get("saturation", 0.0),
            hue=args.get("hue", 0.0),
            gamma=args.get("gamma", 1.0),
            remove_orphans=args.get("remove_orphans", False),
            smooth_majority=args.get("smooth_majority", False),
            outline_mode=args.get("outline_mode", "none"),
            outline_color=args.get("outline_color", "#181425"),
            outline_corners=args.get("outline_corners", False),
            grid=args.get("grid", False),
        )
        return pf.convert_file(args["input_path"], args["output_path"], indexed=args.get("indexed", True))

    if name == "image_stylize_reel":
        pf = PixelForge(
            style=args.get("style", "kurzgesagt_glow"),
            factor=args.get("factor", 3),
            upscale=args.get("upscale", 3),
            remove_orphans=args.get("remove_orphans", False),
            outline_mode=args.get("outline_mode", "none"),
            outline_color=args.get("outline_color", "#100b20"),
        )
        return pf.convert_file(args["input_path"], args["output_path"], indexed=True)

    if name == "image_showcase":
        img = np.asarray(Image.open(args["input_path"]).convert("RGB"), dtype=np.uint8)
        tw = int(args.get("tile_width", 320))
        th = int(args.get("tile_height", 180))
        if args.get("mode") == "reel_styles":
            render_styles_showcase(img, args["output_path"], tile_width=tw, tile_height=th)
        else:
            _render_presets_showcase(img, args["output_path"], tw=tw, th=th)
        return {
            "output_path": args["output_path"],
            "mode": args.get("mode", "presets"),
            "elapsed_ms": round((time.perf_counter() - t0) * 1000.0, 2),
        }

    if name == "image_detect_grid":
        pil = Image.open(args["input_path"])
        mode = "RGBA" if "A" in pil.getbands() else "RGB"
        arr = np.asarray(pil.convert(mode), dtype=np.uint8)
        block = detect_pixel_grid(arr, tolerance=int(args.get("tolerance", 8)))
        res: Dict[str, Any] = {
            "input_path": args["input_path"],
            "source_width": arr.shape[1],
            "source_height": arr.shape[0],
            "detected_block_size": block,
            "native_width": max(1, arr.shape[1] // block),
            "native_height": max(1, arr.shape[0] // block),
        }
        if args.get("recover_1x_output_path"):
            native = arr[block // 2 :: block, block // 2 :: block]
            meta = save_png(native, args["recover_1x_output_path"], scale=1, indexed=True)
            res["recovered_png"] = meta
        return res

    if name == "palette_tool":
        img_u8 = None
        if args.get("input_image"):
            pil = Image.open(args["input_image"])
            img_u8 = np.asarray(pil.convert("RGBA" if "A" in pil.getbands() else "RGB"), dtype=np.uint8)
        pal_u8, _, pal_name = resolve_palette(
            args["palette"], image_u8=img_u8, extract_mode=args.get("extract_mode", "hybrid_bgm_oklab")
        )
        hexes = [rgb_to_hex(c) for c in pal_u8] if pal_u8 is not None else []
        out_info: Dict[str, Any] = {"name": args.get("name") or pal_name, "count": len(hexes), "colors": hexes}
        if args.get("output_file"):
            out_f = Path(args["output_file"])
            out_f.parent.mkdir(parents=True, exist_ok=True)
            ext = out_f.suffix.lower()
            if ext == ".gpl":
                out_f.write_text(export_palette_gpl(out_info["name"], hexes), encoding="utf-8")
            elif ext == ".hex":
                out_f.write_text(export_palette_hex(hexes), encoding="utf-8")
            else:
                out_f.write_text(export_palette_json(out_info["name"], hexes), encoding="utf-8")
            out_info["output_file"] = str(out_f)
        return out_info

    if name == "export_spritesheet":
        paths = [Path(p) for p in args["input_paths"]]
        pf = PixelForge(
            preset=args.get("preset"),
            width=args.get("width", 64),
            upscale=1,
            palette=args.get("palette", 16),
            dither=args.get("dither", "none"),
            outline_mode=args.get("outline_mode", "none"),
            remove_orphans=True,
        )
        frames: List[np.ndarray] = []
        names: List[str] = []
        if len(paths) == 1 and paths[0].suffix.lower() in (".mp4", ".webm", ".mov", ".gif", ".mkv"):
            max_vf = int(args.get("max_video_frames", 16))
            raw_all = [f for f in iio.imiter(str(paths[0]))]
            step = max(1, len(raw_all) // max_vf)
            sampled = raw_all[::step][:max_vf]
            for i, f in enumerate(sampled):
                if i == 0:
                    pf.fit(f)
                frames.append(pf.transform_1x(f, frame_index=i))
                names.append(f"{paths[0].stem}_{i:03d}")
        else:
            for i, p in enumerate(paths):
                pil = Image.open(p)
                arr = np.asarray(pil.convert("RGBA" if "A" in pil.getbands() else "RGB"), dtype=np.uint8)
                if i == 0:
                    pf.fit(arr)
                frames.append(pf.transform_1x(arr, frame_index=i))
                names.append(p.stem)

        out_png = Path(args["output_png"])
        out_json = Path(args.get("output_atlas_json") or out_png.with_suffix(".json"))
        sheet_img, atlas = pack_sprite_sheet(
            frames,
            frame_names=names,
            columns=int(args.get("columns", 0)),
            padding=int(args.get("padding", 1)),
            sheet_name=out_png.stem,
        )
        png_meta = save_png(sheet_img, out_png, scale=1, indexed=True)
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(json.dumps(atlas, indent=2), encoding="utf-8")
        return {**png_meta, "atlas_json": str(out_json), "frames_packed": len(frames)}

    if name == "export_tileset":
        pil = Image.open(args["input_path"])
        arr = np.asarray(pil.convert("RGBA" if "A" in pil.getbands() else "RGB"), dtype=np.uint8)
        if args.get("pixelize_first", False):
            pf = PixelForge(width=args.get("width", 128), palette=args.get("palette", "endesga-32"), dither="none", upscale=1)
            arr = pf.fit(arr).transform_1x(arr)
        ts = build_tileset(
            arr,
            tile_width=int(args.get("tile_width", 8)),
            tile_height=int(args.get("tile_height", 8)),
            allow_flips=bool(args.get("allow_flips", True)),
        )
        out_png = Path(args["output_png"])
        out_map = Path(args.get("output_map_json") or out_png.with_suffix(".tilemap.json"))
        png_meta = save_png(ts["image"], out_png, scale=1, indexed=True)
        out_map.parent.mkdir(parents=True, exist_ok=True)
        out_map.write_text(json.dumps(ts["map"], indent=2), encoding="utf-8")
        return {
            **png_meta,
            "tilemap_json": str(out_map),
            "unique_tiles": ts["unique_count"],
            "total_tiles": ts["total_tiles"],
            "savings_pct": ts["savings_pct"],
        }

    if name == "video_convert":
        pf = PixelForge(
            preset=args.get("preset"),
            style=args.get("style"),
            width=args.get("width"),
            factor=args.get("factor", 3),
            upscale=args.get("upscale", 3),
            resample=args.get("resample", "hybrid"),
            palette=args.get("palette", 24),
            dither=args.get("dither", "bluenoise"),
        )
        return pf.convert_video(
            input_video=args["input_video"],
            output_path=args["output_path"],
            audio_path=args.get("audio_wav"),
            keep_source_audio=bool(args.get("keep_source_audio", True)),
            max_frames=args.get("max_frames"),
        )

    if name == "video_analyze_motion":
        return analyze_video_motion(args["video_path"], max_frames=args.get("max_frames"))

    if name == "video_sync_motion_to_audio":
        res = sync_video_motion_to_audio(
            input_video=args["input_video"],
            audio_wav=args["audio_wav"],
            output_video=args["output_video"],
            bpm=float(args.get("bpm", 120.0)),
            style=args.get("style", "pc98_cyber"),
            factor=int(args.get("factor", 3)),
            phrase_zoom_strength=float(args.get("phrase_zoom_strength", 0.16)),
            bass_punch_strength=float(args.get("bass_punch_strength", 0.062)),
        )
        res["elapsed_s"] = round(time.perf_counter() - t0, 2)
        return res

    if name == "video_detect_bar_fills":
        res = detect_video_bar_fills(
            args["video_path"],
            max_frames=args.get("max_frames"),
            min_duration_s=float(args.get("min_duration_s", 0.65)),
        )
        res["elapsed_s"] = round(time.perf_counter() - t0, 2)
        return res

    if name == "video_detect_stroke_draws":
        vid_p = args["video_path"]
        max_f = args.get("max_frames")
        try:
            fps = float(iio.immeta(vid_p).get("fps", 30.0))
        except Exception:
            fps = 30.0
        frames = []
        for frame in iio.imiter(vid_p):
            frames.append(frame)
            if max_f is not None and len(frames) >= int(max_f):
                break
        res = detect_frames_stroke_draws(
            frames,
            fps=fps,
            min_duration_s=float(args.get("min_duration_s", 0.28)),
            allowed_shapes=args.get("allowed_shapes"),
        )
        res["video_path"] = vid_p
        if args.get("proof_image_path"):
            res["proof_image_path"] = render_stroke_draws_proof(frames, res, str(args["proof_image_path"]))
        res["elapsed_s"] = round(time.perf_counter() - t0, 2)
        return res

    if name == "video_extract_sound_triggers":
        cfg = dict(DEFAULT_TRIGGER_CONFIG)
        if isinstance(args.get("config"), dict):
            cfg.update(args["config"])
        for key in (
            "zoom_mode",
            "zoom_cooldown_s",
            "zoom_min_sigma",
            "zoom_include_whoosh",
            "enable_bar_fills",
            "enable_stroke_draws",
        ):
            if key in args and args[key] is not None:
                cfg[key] = args[key]
        res = extract_video_sound_triggers(args["video_path"], max_frames=args.get("max_frames"), config=cfg)
        if args.get("include_catalog"):
            res["catalog"] = load_trigger_catalog()
        res["elapsed_s"] = round(time.perf_counter() - t0, 2)
        return res

    if name == "studio_info":
        root = Path(__file__).resolve().parent.parent
        return {
            "studio_root": str(root),
            "site_dist": str(root / "_site"),
            "launch_cli": "python -m pixelforge studio --port 8765",
            "launch_npm": "npm run preview",
            "features": [
                "WebGL 2 GLSL ShaderMate 60-FPS GPU Engine + CPU parity",
                "4 GPU Resamplers: Box, Nearest, Sobel-Edge, and PixelForge Hybrid Edge",
                "GPU Kuwahara Cartoon Pre-Brush + Scanline CRT Shader Pass",
                "43+ Merged Lospec + Retro Hardware + Reel Palettes",
                "17 Dithering Modes + Sprite Sheets + Deduplicated Tilesets + WebCodecs MP4/WebM",
            ],
        }

    raise ValueError(f"Unknown tool: {name}")


def run_stdio_server() -> None:
    """Runs JSON-RPC 2.0 MCP server over stdin/stdout."""
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue

        req_id = req.get("id")
        method = req.get("method", "")
        params = req.get("params") or {}

        if req_id is None:
            continue

        if method == "initialize":
            resp = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "pixelforge-mcp", "version": "1.0.0"},
                },
            }
        elif method == "tools/list":
            resp = {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS_SCHEMA}}
        elif method == "tools/call":
            tool_name = params.get("name", "")
            tool_args = params.get("arguments") or {}
            try:
                data = handle_tool_call(tool_name, tool_args)
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"content": [{"type": "text", "text": json.dumps(data, indent=2)}], "isError": False},
                }
            except Exception as exc:
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"content": [{"type": "text", "text": f"Error: {exc}"}], "isError": True},
                }
        else:
            resp = {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}

        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    run_stdio_server()
