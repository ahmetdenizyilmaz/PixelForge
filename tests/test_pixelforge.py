"""Comprehensive End-to-End Test Suite for PixelForge (Python Core + Exporters + CV + 15-Tool MCP)."""

import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

import pixelforge as pf


def _make_synthetic_scene(w: int = 96, h: int = 72) -> np.ndarray:
    """Creates an RGBA synthetic scene with smooth sky gradient, sharp white text-bars,
    a small vivid neon magenta accent dot, and a transparent cutout corner."""
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            # Smooth twilight sky gradient
            img[y, x, 0] = int(20 + 70 * (y / max(1, h - 1)))
            img[y, x, 1] = int(28 + 90 * (x / max(1, w - 1)))
            img[y, x, 2] = int(95 + 110 * (1.0 - y / max(1, h - 1)))
            img[y, x, 3] = 255
    # Crisp 2px white geometric strokes (simulating text/UI)
    img[10:12, 12:84, :3] = 252
    img[10:26, 12:14, :3] = 252
    img[18:20, 12:60, :3] = 252
    # Vivid golden-orange character circle
    yy, xx = np.ogrid[:h, :w]
    mask_circle = ((xx - 48) ** 2 + (yy - 44) ** 2) <= 16**2
    img[mask_circle, :3] = [255, 165, 24]
    # Small vivid neon magenta eye/accent (only ~25 pixels — tests chroma-salient palette discovery!)
    mask_accent = ((xx - 53) ** 2 + (yy - 40) ** 2) <= 2**2
    img[mask_accent, :3] = [255, 20, 180]
    return img


def _make_transparent_sprite(w: int = 64, h: int = 64) -> np.ndarray:
    img = np.zeros((h, w, 4), dtype=np.uint8)
    yy, xx = np.ogrid[:h, :w]
    body = ((xx - 32) ** 2 + (yy - 32) ** 2) <= 18**2
    img[body] = [70, 210, 130, 255]
    visor = ((xx - 36) ** 2 + (yy - 28) ** 2) <= 7**2
    img[visor] = [240, 250, 255, 255]
    return img


class TestPixelForgeCore(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.scene = _make_synthetic_scene()
        cls.sprite = _make_transparent_sprite()

    def test_resamplers_and_grid_detector(self) -> None:
        for mode in ("hybrid", "sobel", "box", "nearest"):
            engine = pf.PixelForge(width=32, resample=mode, palette="pico-8", dither="none")
            out = engine.fit_transform(self.scene)
            self.assertEqual(out.shape[1], 32)
            self.assertEqual(out.shape[2], 4)
            self.assertLessEqual(len(pf.unique_colors_hex(out)), 16)

        # Verify pixel-grid auto-detector recovers exact 4x upscaled pixel art
        tiny = np.zeros((12, 16, 4), dtype=np.uint8)
        tiny[:, :, 3] = 255
        tiny[::2, ::2, :3] = [250, 80, 40]
        tiny[1::2, ::2, :3] = [30, 180, 240]
        tiny[:, 1::2, :3] = [20, 24, 48]
        upscaled_4x = np.repeat(np.repeat(tiny, 4, axis=0), 4, axis=1)
        grid_step = pf.detect_pixel_grid(upscaled_4x)
        self.assertEqual(grid_step, 4)

    def test_hybrid_oklab_bgm_determinism_and_palettes(self) -> None:
        # Must be 100% deterministic across repeated calls (unlike random-init BGM)
        pal1, _ = pf.extract_hybrid_bgm_oklab(self.scene, count=10)
        pal2, _ = pf.extract_hybrid_bgm_oklab(self.scene, count=10)
        np.testing.assert_array_equal(pal1, pal2)

        # Built-in palettes & Pal enum compatibility
        self.assertGreaterEqual(len(pf.BUILTIN_PALETTES), 43)
        p_kurz = pf.get_builtin_palette("kurzgesagt-24")
        self.assertEqual(len(p_kurz["colors"]), 24)
        self.assertTrue(hasattr(pf.Pal, "PICO_8"))

        # Multi-format palette parser (.gpl, JASC-PAL, .hex, .json)
        gpl_txt = "GIMP Palette\nName: Test\n#\n255 0 128 Pink\n16 32 64 Navy\n"
        jasc_txt = "JASC-PAL\n0100\n2\n10 20 30\n200 210 220\n"
        hex_txt = "#ff0080\n#102040\n"
        json_txt = json.dumps({"colors": ["#112233", "#aabbcc", "#ddeeff"]})
        self.assertEqual(len(pf.parse_palette_text(gpl_txt)["colors"]), 2)
        self.assertEqual(len(pf.parse_palette_text(jasc_txt)["colors"]), 2)
        self.assertEqual(len(pf.parse_palette_text(hex_txt)["colors"]), 2)
        self.assertEqual(len(pf.parse_palette_text(json_txt)["colors"]), 3)

    def test_all_dither_methods(self) -> None:
        custom_mat = "0 2\n3 1"
        for method in pf.ALL_DITHER_METHODS:
            engine = pf.PixelForge(
                width=32,
                resample="hybrid",
                palette=8 if method == "bgm_posterior" else "pico-8",
                dither=method,
                dither_strength=0.65,
                custom_matrix=custom_mat if method == "custom" else None,
            )
            out = engine.fit_transform(self.scene)
            self.assertEqual(out.shape[1], 32)
            self.assertGreaterEqual(len(pf.unique_colors_hex(out)), 2)

    def test_kuwahara_tone_cleanup_and_outlines(self) -> None:
        # Test Kuwahara + Tone + Orphan/Smooth + Ink outline on opaque scene
        eng_ink = pf.PixelForge(
            width=40,
            resample="hybrid",
            kuwahara=2,
            brightness=0.05,
            contrast=0.1,
            saturation=0.15,
            hue=12.0,
            gamma=1.05,
            palette="endesga-32",
            dither="bluenoise",
            remove_orphans=True,
            smooth_majority=True,
            outline_mode="ink",
            outline_color="#07050a",
        )
        out_ink = eng_ink.fit_transform(self.scene)
        self.assertIn("#07050a", pf.unique_colors_hex(out_ink))

        # Test Outer & Inner 1px sprite outlines on transparent sprite
        for mode in ("outer", "inner"):
            eng_sp = pf.PixelForge(
                width=32,
                resample="hybrid",
                palette=6,
                dither="none",
                outline_mode=mode,
                outline_color="#12091f",
            )
            out_sp = eng_sp.fit_transform(self.sprite)
            self.assertIn("#12091f", pf.unique_colors_hex(out_sp))
            # Corner must remain transparent!
            self.assertEqual(int(out_sp[0, 0, 3]), 0)

    def test_exporters_indexed_png_sheet_and_tileset(self) -> None:
        eng = pf.PixelForge(preset="sprite")
        sp_px = eng.fit_transform(self.sprite)

        # 1. Verify True Indexed-Color PNG (IHDR color_type == 3, PLTE + tRNS chunks)
        png_bytes = pf.encode_png_bytes(sp_px, indexed=True)
        self.assertEqual(png_bytes[:8], b"\x89PNG\r\n\x1a\n")
        color_type = png_bytes[25]
        self.assertEqual(color_type, 3, "Expected PNG color_type 3 (Indexed-Color PLTE)")
        self.assertIn(b"PLTE", png_bytes)
        self.assertIn(b"tRNS", png_bytes)

        # Verify PIL decodes our Indexed PNG back bit-identically
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "indexed.png"
            p.write_bytes(png_bytes)
            reloaded = np.asarray(Image.open(p).convert("RGBA"))
            np.testing.assert_array_equal(reloaded, sp_px)

        # 2. Verify Sprite Sheet Packer + TexturePacker JSON Atlas
        f2 = np.fliplr(sp_px).copy()
        sheet_img, atlas = pf.pack_sprite_sheet([sp_px, f2], frame_names=["idle_0", "idle_1"], columns=2, padding=1)
        self.assertIn("idle_0", atlas["frames"])
        self.assertIn("idle_1", atlas["frames"])
        self.assertGreater(sheet_img.shape[1], sp_px.shape[1])

        # 3. Verify Mirror-Deduplicated Tileset Builder
        tile_a = np.zeros((8, 8, 4), dtype=np.uint8)
        tile_a[:, :, 3] = 255
        tile_a[:, :3, 0] = 250  # asymmetric left red bar
        tile_a[:2, :, 1] = 220  # asymmetric top green bar
        # Build 16x16 map from [tile_a, flip_x(tile_a); flip_y(tile_a), flip_xy(tile_a)]
        top = np.concatenate([tile_a, tile_a[:, ::-1, :]], axis=1)
        bot = np.concatenate([tile_a[::-1, :, :], tile_a[::-1, ::-1, :]], axis=1)
        full_map = np.concatenate([top, bot], axis=0)

        ts_no_flip = pf.build_tileset(full_map, tile_width=8, allow_flips=False)
        ts_with_flip = pf.build_tileset(full_map, tile_width=8, allow_flips=True)
        self.assertEqual(ts_no_flip["unique_count"], 4)
        self.assertEqual(ts_with_flip["unique_count"], 1, "All 4 mirrored quadrants must deduplicate to 1 tile!")
        self.assertEqual(ts_with_flip["savings_pct"], 75.0)

    def test_reel_styles_and_cv_modules(self) -> None:
        rgb = self.scene[:, :, :3]
        for style_name in ("kurzgesagt_glow", "chunky_cartoon", "pc98_cyber", "oscilloscope_xy"):
            styled = pf.apply_style(rgb, style=style_name, factor=2, upscale=1)
            self.assertEqual(styled.ndim, 3)
            self.assertEqual(styled.shape[2], 3)

        # Synthetic 16-frame bar-fill sequence smoke check
        frames = []
        for i in range(18):
            fr = np.zeros((64, 96, 3), dtype=np.uint8)
            fill_x = 12 + int(72 * (i / 17.0))
            fr[28:36, 12:fill_x] = [0, 240, 160]
            frames.append(fr)
        motion_res = pf.analyze_frames_motion(frames, fps=15.0)
        self.assertIn("scale_events", motion_res)
        self.assertIn("per_frame", motion_res)
        bar_res = pf.detect_frames_bar_fills(frames, fps=15.0, min_duration_s=0.5)
        self.assertGreaterEqual(len(bar_res["bar_fills"]), 1)

    def test_mcp_server_stdio_handshake_and_tools(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            in_path = Path(tmp) / "in.png"
            out_path = Path(tmp) / "out.png"
            Image.fromarray(self.scene).save(in_path)

            reqs = [
                {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05"}},
                {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
                {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "catalog_list", "arguments": {}}},
                {
                    "jsonrpc": "2.0",
                    "id": 4,
                    "method": "tools/call",
                    "params": {
                        "name": "image_convert",
                        "arguments": {
                            "input_path": str(in_path),
                            "output_path": str(out_path),
                            "preset": "hybrid-crisp",
                            "width": 36,
                            "upscale": 2,
                        },
                    },
                },
            ]
            payload = "\n".join(json.dumps(r) for r in reqs) + "\n"
            proc = subprocess.run(
                [sys.executable, "-m", "pixelforge.mcp_server"],
                input=payload,
                text=True,
                capture_output=True,
                timeout=60,
                check=True,
            )
            lines = [json.loads(line) for line in proc.stdout.strip().splitlines() if line.strip()]
            self.assertEqual(len(lines), 4)
            tools = lines[1]["result"]["tools"]
            self.assertEqual(len(tools), 15, f"Expected 15 MCP tools, got {len(tools)}")
            conv_payload = json.loads(lines[3]["result"]["content"][0]["text"])
            self.assertTrue(Path(conv_payload["output_path"]).exists())


if __name__ == "__main__":
    unittest.main()
