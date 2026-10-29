"""Unified Command-Line Interface for PixelForge."""

import argparse
from functools import partial
import http.server
import json
from pathlib import Path
import socketserver

from .mcp_server import handle_tool_call, run_stdio_server


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="pixelforge",
        description="PixelForge: Hybrid Edge-Aware Pixel Art, WebGL 2 Studio, 32-Thread Numba Core & 15-Tool MCP Engine.",
    )
    sub = parser.add_subparsers(dest="cmd")

    p_cat = sub.add_parser("catalog", help="List all presets, Reel styles, palettes, and dithers.")

    p_conv = sub.add_parser("convert", help="Convert an image or video using PixelForge.")
    p_conv.add_argument("input", help="Input image or video path.")
    p_conv.add_argument("output", help="Output PNG, GIF, or MP4 path.")
    p_conv.add_argument("--preset", default=None, help="Preset id (e.g. hybrid-crisp, kurzgesagt-pixel, pico-8, sprite).")
    p_conv.add_argument("--style", default=None, help="12 Reel style id (e.g. kurzgesagt_glow, pc98_cyber).")
    p_conv.add_argument("--width", type=int, default=None)
    p_conv.add_argument("--factor", type=int, default=None)
    p_conv.add_argument("--upscale", type=int, default=4)
    p_conv.add_argument("--resample", default="hybrid", choices=["hybrid", "sobel", "box", "nearest"])
    p_conv.add_argument("--palette", default="24", help="Color count (int), built-in id, 'lospec:<slug>', or .gpl/.hex/.pal file.")
    p_conv.add_argument("--dither", default="bluenoise")
    p_conv.add_argument("--strength", type=float, default=0.5)
    p_conv.add_argument("--kuwahara", type=int, default=0)
    p_conv.add_argument("--orphans", action="store_true", help="Remove isolated 1px stray pixels.")
    p_conv.add_argument("--smooth", action="store_true", help="3x3 majority speck smoothing.")
    p_conv.add_argument("--outline", default="none", choices=["none", "outer", "inner", "ink"])
    p_conv.add_argument("--outline-color", default="#181425")
    p_conv.add_argument("--grid", action="store_true", help="Overlay 1px pixel grid on upscaled PNG.")
    p_conv.add_argument("--audio", default=None, help="Optional WAV soundtrack for video output.")

    p_sheet = sub.add_parser("spritesheet", help="Pack images or video frames into a Sprite Sheet PNG + JSON Atlas.")
    p_sheet.add_argument("inputs", nargs="+", help="Input image(s) or video.")
    p_sheet.add_argument("-o", "--output", required=True, help="Output sprite sheet PNG.")
    p_sheet.add_argument("--width", type=int, default=64)
    p_sheet.add_argument("--palette", default="16")
    p_sheet.add_argument("--outline", default="outer", choices=["none", "outer", "inner", "ink"])

    p_tile = sub.add_parser("tileset", help="Slice & mirror-deduplicate an image into a Tileset PNG + Tilemap JSON.")
    p_tile.add_argument("input", help="Input image.")
    p_tile.add_argument("-o", "--output", required=True, help="Output tileset PNG.")
    p_tile.add_argument("--tile-size", type=int, default=8)
    p_tile.add_argument("--pixelize", action="store_true")

    p_show = sub.add_parser("showcase", help="Render 12-panel comparison contact sheet.")
    p_show.add_argument("input")
    p_show.add_argument("output")
    p_show.add_argument("--mode", default="presets", choices=["presets", "reel_styles"])

    p_mcp = sub.add_parser("mcp", help="Run JSON-RPC 2.0 stdio MCP server.")

    p_studio = sub.add_parser("studio", help="Serve the upgraded WebGL 2 Real-Time Browser Studio.")
    p_studio.add_argument("--port", type=int, default=8765)

    args = parser.parse_args()
    if args.cmd == "mcp":
        run_stdio_server()
        return
    if args.cmd == "catalog" or args.cmd is None:
        print(json.dumps(handle_tool_call("catalog_list", {}), indent=2))
        return
    if args.cmd == "convert":
        pal = int(args.palette) if str(args.palette).isdigit() else args.palette
        ext = Path(args.output).suffix.lower()
        if ext in (".mp4", ".gif", ".webm"):
            res = handle_tool_call(
                "video_convert",
                {
                    "input_video": args.input,
                    "output_path": args.output,
                    "preset": args.preset,
                    "style": args.style,
                    "width": args.width,
                    "factor": args.factor or 3,
                    "upscale": args.upscale,
                    "resample": args.resample,
                    "palette": pal,
                    "dither": args.dither,
                    "audio_wav": args.audio,
                },
            )
        elif args.style:
            res = handle_tool_call(
                "image_stylize_reel",
                {
                    "input_path": args.input,
                    "output_path": args.output,
                    "style": args.style,
                    "factor": args.factor or 3,
                    "upscale": args.upscale,
                    "remove_orphans": args.orphans,
                    "outline_mode": args.outline,
                    "outline_color": args.outline_color,
                },
            )
        else:
            res = handle_tool_call(
                "image_convert",
                {
                    "input_path": args.input,
                    "output_path": args.output,
                    "preset": args.preset,
                    "width": args.width,
                    "factor": args.factor,
                    "upscale": args.upscale,
                    "resample": args.resample,
                    "palette": pal,
                    "dither": args.dither,
                    "dither_strength": args.strength,
                    "kuwahara": args.kuwahara,
                    "remove_orphans": args.orphans,
                    "smooth_majority": args.smooth,
                    "outline_mode": args.outline,
                    "outline_color": args.outline_color,
                    "grid": args.grid,
                },
            )
        print(json.dumps(res, indent=2))
        return

    if args.cmd == "spritesheet":
        pal = int(args.palette) if str(args.palette).isdigit() else args.palette
        res = handle_tool_call(
            "export_spritesheet",
            {"input_paths": args.inputs, "output_png": args.output, "width": args.width, "palette": pal, "outline_mode": args.outline},
        )
        print(json.dumps(res, indent=2))
        return

    if args.cmd == "tileset":
        res = handle_tool_call(
            "export_tileset",
            {
                "input_path": args.input,
                "output_png": args.output,
                "tile_width": args.tile_size,
                "tile_height": args.tile_size,
                "pixelize_first": args.pixelize,
            },
        )
        print(json.dumps(res, indent=2))
        return

    if args.cmd == "showcase":
        res = handle_tool_call("image_showcase", {"input_path": args.input, "output_path": args.output, "mode": args.mode})
        print(json.dumps(res, indent=2))
        return

    if args.cmd == "studio":
        site_dir = Path(__file__).resolve().parent.parent / "_site"
        if not site_dir.exists():
            print(f"Studio build not found at {site_dir}. Run `npm install && npm run build:site` in PixelForge first.")
            return
        handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(site_dir))
        with socketserver.TCPServer(("127.0.0.1", args.port), handler) as httpd:
            print(f"PixelForge WebGL 2 Studio running at http://127.0.0.1:{args.port}")
            httpd.serve_forever()


if __name__ == "__main__":
    main()
