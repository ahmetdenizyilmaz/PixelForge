"""Game-Dev & Media Exporters for PixelForge: Indexed PNG, Pixel Grid, Sprite Sheets, Tilesets, GIF & MP4.

Ports and extends PixelForge's game-asset pipeline into Python/NumPy:
- `upscale_with_grid`   : Integer nearest-neighbor upscaling + crisp 1px pixel-grid overlay.
- `save_png`            : True Indexed-Color PNG (PLTE + tRNS transparency when <= 256 colors) or RGBA PNG.
- `pack_sprite_sheet`   : Packs multiple frames/sprites into one sheet PNG + TexturePacker/Aseprite JSON atlas.
- `build_tileset`       : Slices an image into tiles, deduplicates identical & X/Y/XY mirror-flipped tiles,
                          and outputs a compact tileset PNG + tilemap JSON.
- `save_gif` / `save_mp4`: Animated GIF and H.264 MP4 export (preserving source audio or muxing custom WAV).
"""

import json
import math
import shutil
import struct
import subprocess
import zlib
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import imageio.v3 as iio
import numpy as np
from PIL import Image

from .palettes import parse_hex_color, rgb_to_hex


def ensure_rgba_u8(img: np.ndarray) -> np.ndarray:
    """Normalizes an RGB or RGBA array (float [0..1] or uint8) to contiguous RGBA uint8."""
    arr = np.asarray(img)
    if arr.dtype.kind == "f":
        arr = np.clip(np.round(arr * 255.0), 0, 255).astype(np.uint8)
    else:
        arr = np.clip(arr, 0, 255).astype(np.uint8)
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr, np.full_like(arr, 255)], axis=-1)
    elif arr.shape[2] == 3:
        alpha = np.full((arr.shape[0], arr.shape[1], 1), 255, dtype=np.uint8)
        arr = np.concatenate([arr, alpha], axis=-1)
    return np.ascontiguousarray(arr[:, :, :4], dtype=np.uint8)


def unique_colors_hex(img: np.ndarray, limit: int = 10000) -> List[str]:
    """Distinct opaque colors in `#rrggbb` format."""
    rgba = ensure_rgba_u8(img)
    opaque = rgba[rgba[:, :, 3] > 0][:, :3]
    if len(opaque) == 0:
        return []
    keys = (opaque[:, 0].astype(np.int32) << 16) | (opaque[:, 1].astype(np.int32) << 8) | opaque[:, 2].astype(np.int32)
    _, idx = np.unique(keys, return_index=True)
    ordered = keys[np.sort(idx)][:limit]
    return [f"#{(int(k) >> 16) & 255:02x}{(int(k) >> 8) & 255:02x}{int(k) & 255:02x}" for k in ordered]


def upscale_with_grid(
    img: np.ndarray,
    scale: int = 1,
    grid: bool = False,
    grid_color: str = "#000000",
    grid_alpha: float = 0.35,
) -> np.ndarray:
    """Nearest-neighbor integer upscale with optional 1px pixel-grid lines."""
    rgba = ensure_rgba_u8(img)
    k = max(1, int(round(scale)))
    if k > 1:
        out = np.repeat(np.repeat(rgba, k, axis=0), k, axis=1)
    else:
        out = rgba.copy()

    if grid and k >= 3:
        gr, gg, gb = parse_hex_color(grid_color)
        ga = float(np.clip(grid_alpha, 0.0, 1.0))
        h, w, _ = out.shape
        mask = np.zeros((h, w), dtype=bool)
        mask[::k, :] = True
        mask[:, ::k] = True

        sub = out[mask].astype(np.float32)
        sa = sub[:, 3] / 255.0
        oa = ga + sa * (1.0 - ga)
        safe_oa = np.maximum(oa, 1e-6)
        sub[:, 0] = (gr * ga + sub[:, 0] * sa * (1.0 - ga)) / safe_oa
        sub[:, 1] = (gg * ga + sub[:, 1] * sa * (1.0 - ga)) / safe_oa
        sub[:, 2] = (gb * ga + sub[:, 2] * sa * (1.0 - ga)) / safe_oa
        sub[:, 3] = oa * 255.0
        out[mask] = np.clip(np.round(sub), 0, 255).astype(np.uint8)
    return out


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def encode_png_bytes(
    img: np.ndarray,
    scale: int = 1,
    grid: bool = False,
    grid_color: str = "#000000",
    indexed: bool = True,
) -> bytes:
    """Encodes RGBA image as true 1/2/4/8-bit Indexed PNG (PLTE + tRNS) when <= 256 colors, else RGBA PNG."""
    rgba = upscale_with_grid(img, scale=scale, grid=grid, grid_color=grid_color)
    h, w, _ = rgba.shape

    if indexed:
        flat = rgba.reshape(-1, 4).copy()
        # Normalize all fully-transparent pixels to (0, 0, 0, 0) so they share one palette index
        trans_mask = flat[:, 3] == 0
        flat[trans_mask] = 0
        packed = (
            (flat[:, 0].astype(np.uint32) << 24)
            | (flat[:, 1].astype(np.uint32) << 16)
            | (flat[:, 2].astype(np.uint32) << 8)
            | flat[:, 3].astype(np.uint32)
        )
        uniq, inv = np.unique(packed, return_inverse=True)
        if len(uniq) <= 256:
            colors_rgba = np.stack(
                [(uniq >> 24) & 255, (uniq >> 16) & 255, (uniq >> 8) & 255, uniq & 255],
                axis=-1,
            ).astype(np.uint8)
            n_col = len(colors_rgba)
            bits = 1 if n_col <= 2 else 2 if n_col <= 4 else 4 if n_col <= 16 else 8
            indices = inv.reshape(h, w).astype(np.uint8)

            if bits == 8:
                raw_rows = np.hstack([np.zeros((h, 1), dtype=np.uint8), indices]).tobytes()
            else:
                stride = math.ceil(w * bits / 8)
                buf = np.zeros((h, stride + 1), dtype=np.uint8)
                for x in range(w):
                    bit_pos = x * bits
                    byte_idx = 1 + (bit_pos >> 3)
                    shift = 8 - bits - (bit_pos & 7)
                    buf[:, byte_idx] |= indices[:, x] << shift
                raw_rows = buf.tobytes()

            sig = b"\x89PNG\r\n\x1a\n"
            ihdr = struct.pack(">IIBBBBB", w, h, bits, 3, 0, 0, 0)
            plte = colors_rgba[:, :3].tobytes()
            chunks = [sig, _png_chunk(b"IHDR", ihdr), _png_chunk(b"PLTE", plte)]
            if np.any(colors_rgba[:, 3] < 255):
                # Trim trailing opaque entries from tRNS
                alphas = colors_rgba[:, 3].tolist()
                while alphas and alphas[-1] == 255:
                    alphas.pop()
                chunks.append(_png_chunk(b"tRNS", bytes(alphas)))
            chunks.append(_png_chunk(b"IDAT", zlib.compress(raw_rows, level=9)))
            chunks.append(_png_chunk(b"IEND", b""))
            return b"".join(chunks)

    # Fallback: 8-bit RGBA PNG
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    raw_rows = np.hstack([np.zeros((h, 1), dtype=np.uint8), rgba.reshape(h, w * 4)]).tobytes()
    return b"".join(
        [
            sig,
            _png_chunk(b"IHDR", ihdr),
            _png_chunk(b"IDAT", zlib.compress(raw_rows, level=9)),
            _png_chunk(b"IEND", b""),
        ]
    )


def save_png(
    img: np.ndarray,
    output_path: Union[str, Path],
    scale: int = 1,
    grid: bool = False,
    grid_color: str = "#000000",
    indexed: bool = True,
) -> Dict[str, Any]:
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    data = encode_png_bytes(img, scale=scale, grid=grid, grid_color=grid_color, indexed=indexed)
    out_p.write_bytes(data)
    # Inspect written header color_type at byte offset 25
    color_type = data[25]
    bit_depth = data[24]
    w, h = struct.unpack(">II", data[16:24])
    return {
        "output_path": str(out_p),
        "width": w,
        "height": h,
        "bytes": len(data),
        "indexed": color_type == 3,
        "bit_depth": bit_depth,
    }


def pack_sprite_sheet(
    frames: Sequence[np.ndarray],
    frame_names: Optional[Sequence[str]] = None,
    delays_ms: Optional[Sequence[int]] = None,
    columns: int = 0,
    padding: int = 0,
    sheet_name: str = "sheet",
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Packs multiple RGBA frames into a grid sprite sheet + TexturePacker/Aseprite JSON atlas."""
    if not frames:
        raise ValueError("pack_sprite_sheet requires at least one frame.")
    norm_frames = [ensure_rgba_u8(f) for f in frames]
    pad = max(0, int(padding))
    cell_h = max(f.shape[0] for f in norm_frames)
    cell_w = max(f.shape[1] for f in norm_frames)
    n = len(norm_frames)
    cols = max(1, min(n, int(columns) if columns and columns > 0 else math.ceil(math.sqrt(n))))
    rows = math.ceil(n / cols)

    sheet_w = cols * cell_w + (cols - 1) * pad
    sheet_h = rows * cell_h + (rows - 1) * pad
    sheet = np.zeros((sheet_h, sheet_w, 4), dtype=np.uint8)

    atlas_frames: Dict[str, Any] = {}
    for i, f in enumerate(norm_frames):
        fh, fw, _ = f.shape
        x = (i % cols) * (cell_w + pad)
        y = (i // cols) * (cell_h + pad)
        sheet[y : y + fh, x : x + fw] = f
        fname = frame_names[i] if (frame_names and i < len(frame_names)) else f"frame-{i:03d}"
        entry: Dict[str, Any] = {
            "frame": {"x": x, "y": y, "w": fw, "h": fh},
            "sourceSize": {"w": fw, "h": fh},
        }
        if delays_ms and i < len(delays_ms):
            entry["duration"] = int(round(delays_ms[i]))
        atlas_frames[fname] = entry

    atlas = {
        "frames": atlas_frames,
        "meta": {
            "app": "PixelForge",
            "image": f"{sheet_name}.png",
            "size": {"w": sheet_w, "h": sheet_h},
            "scale": "1",
            "columns": cols,
            "rows": rows,
            "padding": pad,
        },
    }
    return sheet, atlas


def build_tileset(
    img: np.ndarray,
    tile_width: int = 8,
    tile_height: Optional[int] = None,
    columns: int = 0,
    allow_flips: bool = True,
) -> Dict[str, Any]:
    """Cuts an image into tiles, deduplicates identical (and optionally X/Y/XY mirrored) tiles,
    and returns `{ image, map, unique_count, total_tiles, savings_pct }`.
    """
    rgba = ensure_rgba_u8(img).copy()
    rgba[rgba[:, :, 3] == 0] = 0
    tw = max(1, int(tile_width))
    th = max(1, int(tile_height or tw))
    h, w, _ = rgba.shape
    mw = math.ceil(w / tw)
    mh = math.ceil(h / th)

    # Pad image to exact tile multiple
    padded = np.zeros((mh * th, mw * tw, 4), dtype=np.uint8)
    padded[:h, :w] = rgba

    unique_tiles: List[np.ndarray] = []
    seen_keys: Dict[bytes, int] = {}
    tile_indices: List[int] = []
    tile_flips: List[int] = []

    for ty in range(mh):
        for tx in range(mw):
            tile = padded[ty * th : (ty + 1) * th, tx * tw : (tx + 1) * tw]
            k0 = tile.tobytes()
            tid = seen_keys.get(k0)
            flip_code = 0

            if tid is None and allow_flips:
                # 1 = flip X, 2 = flip Y, 3 = flip XY
                for fx, fy, code in ((True, False, 1), (False, True, 2), (True, True, 3)):
                    t_var = tile[:, ::-1] if fx else tile
                    t_var = t_var[::-1, :] if fy else t_var
                    kv = np.ascontiguousarray(t_var).tobytes()
                    if kv in seen_keys:
                        tid = seen_keys[kv]
                        flip_code = code
                        break

            if tid is None:
                tid = len(unique_tiles)
                unique_tiles.append(tile.copy())
                seen_keys[k0] = tid

            tile_indices.append(tid)
            tile_flips.append(flip_code)

    cols = int(columns) if columns and columns > 0 else min(16, max(1, len(unique_tiles)))
    sheet_img, _ = pack_sprite_sheet(unique_tiles, columns=cols, padding=0, sheet_name="tileset")
    total_tiles = mw * mh
    savings = round((1.0 - len(unique_tiles) / max(1, total_tiles)) * 100.0, 2)

    tilemap: Dict[str, Any] = {
        "width": mw,
        "height": mh,
        "tileWidth": tw,
        "tileHeight": th,
        "tiles": tile_indices,
    }
    if allow_flips:
        tilemap["flips"] = tile_flips

    return {
        "image": sheet_img,
        "map": tilemap,
        "unique_count": len(unique_tiles),
        "total_tiles": total_tiles,
        "savings_pct": savings,
    }


def save_gif(
    frames: Sequence[np.ndarray],
    output_path: Union[str, Path],
    fps: float = 12.0,
    scale: int = 1,
    loop: int = 0,
) -> Dict[str, Any]:
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    pil_frames = [
        Image.fromarray(upscale_with_grid(f, scale=scale))
        for f in frames
    ]
    duration_ms = max(20, int(round(1000.0 / max(0.5, fps))))
    pil_frames[0].save(
        out_p,
        save_all=True,
        append_images=pil_frames[1:],
        duration=duration_ms,
        loop=loop,
        disposal=2,
    )
    return {"output_path": str(out_p), "frames": len(pil_frames), "fps": fps, "bytes": out_p.stat().st_size}


def _get_ffmpeg_exe() -> str:
    ff = shutil.which("ffmpeg")
    if ff:
        return ff
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def save_mp4(
    frames: Sequence[np.ndarray],
    output_path: Union[str, Path],
    fps: float = 30.0,
    scale: int = 1,
    audio_path: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Writes crisp yuv420p H.264 MP4 and optionally muxes audio (from a WAV or original source video)."""
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    rgb_frames = []
    for f in frames:
        up = upscale_with_grid(f, scale=scale)[:, :, :3]
        # Ensure even width/height for yuv420p H.264
        eh = up.shape[0] - (up.shape[0] % 2)
        ew = up.shape[1] - (up.shape[1] % 2)
        rgb_frames.append(up[:eh, :ew])

    if audio_path and Path(audio_path).exists():
        ffmpeg_bin = _get_ffmpeg_exe()
        tmp_silent = out_p.with_suffix(".silent_tmp.mp4")
        iio.imwrite(str(tmp_silent), rgb_frames, fps=fps, codec="libx264")
        res = subprocess.run(
            [
                ffmpeg_bin,
                "-y",
                "-i",
                str(tmp_silent),
                "-i",
                str(audio_path),
                "-map",
                "0:v:0",
                "-map",
                "1:a:0?",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-shortest",
                str(out_p),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if res.returncode != 0 or not out_p.exists():
            shutil.move(str(tmp_silent), str(out_p))
        else:
            tmp_silent.unlink(missing_ok=True)
    else:
        iio.imwrite(str(out_p), rgb_frames, fps=fps, codec="libx264")

    return {
        "output_path": str(out_p),
        "frames": len(rgb_frames),
        "fps": fps,
        "bytes": out_p.stat().st_size,
    }
