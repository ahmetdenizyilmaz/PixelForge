---
title: 15-Tool AI Agent MCP Server
group: Developers
order: 3
description: Expose PixelForge pixelation, palette discovery, sprite sheets, tilesets, and GIF encoding to Claude, Cursor, and MCP clients.
---

# 15-Tool AI Agent MCP Server

PixelForge includes a zero-dependency **Model Context Protocol (MCP)** server (`mcp/server.mjs`) speaking standard JSON-RPC 2.0 over `stdio`. AI coding assistants—including **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, and custom agent harnesses—can invoke PixelForge directly to turn concept images into game-ready sprites, extract perceptual OKLab palettes, pack sprite sheets, and build mirror-deduplicated tilemaps.

## Host Configuration

Add `pixelforge` to your MCP client configuration (e.g. `claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "pixelforge": {
      "command": "node",
      "args": ["C:/path/to/PixelForge/mcp/server.mjs"]
    }
  }
}
```

Or launch via the package binary after `npm link`:

```json
{
  "mcpServers": {
    "pixelforge": {
      "command": "pixelforge-mcp"
    }
  }
}
```

## Available 15 MCP Tools

### Core Pixelation & Batch Processing

| Tool | Description |
| :--- | :--- |
| **`pixelate_image`** | Runs the full PixelForge pipeline (`hybrid` / `edge` / `kuwahara`, `svd`, `clahe`, `oklab-bgm`, `posterior` / `bluenoise` / `bayer`, `outlines`, `fx`) on a local image and writes an integer-scaled or indexed-color PNG. |
| **`batch_pixelate`** | Processes an array or directory of images with shared settings and optional locked palette consistency. |
| **`compare_renders`** | Renders a multi-variant comparison strip across specified presets, widths, or dithering algorithms so an agent or user can visually pick the best direction. |
| **`inspect_image`** | Reports dimensions, color count, transparency presence, aspect ratio, and auto-detected pre-upscaled pixel block size. |
| **`detect_pixel_grid`** | Analyzes pre-upscaled or AI-generated pixel images to recover their true integer block grid (`2×`–`32×`). |

### Palettes, Presets & Pipeline URLs

| Tool | Description |
| :--- | :--- |
| **`extract_palette`** | Discovers an N-color perceptual palette from an image using `oklab-bgm`, `oklab-salient`, or `median-cut` and exports `.gpl`, `.hex`, or JSON swatches. |
| **`list_palettes`** | Lists all 25 curated retro & indie hardware palettes (PICO-8, Endesga 32, Sweetie 16, Game Boy DMG, PC-98, Commodore 64, DawnBringer, etc.) with hex values. |
| **`fetch_lospec_palette`** | Downloads any community palette by slug or URL from Lospec and normalizes its hex table. |
| **`convert_palette`** | Converts palette files cleanly between `.gpl` (Aseprite/GIMP), `.hex` (Lospec), `.pal` (JASC), and `.json`. |
| **`list_presets`** | Lists all 20 built-in scientific, anime, retro-hardware, and screen-FX presets with full parameter payloads. |
| **`encode_share_url`** | Encodes any pipeline settings JSON into a compact `#s=...` URL hash that opens directly inside the browser Workstation (`/editor/#s=...`). |
| **`decode_share_url`** | Decodes a Workstation `#s=...` share link back into structured pipeline settings JSON. |

### Game Engine Assets & Animation

| Tool | Description |
| :--- | :--- |
| **`build_tileset`** | Slices an image or pixelated result into `8×8`, `16×16`, or `32×32` tiles with **X/Y/XY mirror-flip deduplication**, writing `tileset.png` + `tilemap.json` and reporting VRAM savings. |
| **`pack_spritesheet`** | Pixelates and packs multiple animation frames into an aligned sprite atlas PNG + frame-coordinate JSON metadata. |
| **`create_animated_gif`** | Pixelates a sequence of frames with a unified palette and encodes a clean, looping animated `.gif`. |

> [!TIP]
> Ask your MCP-enabled coding agent: *"Use PixelForge to convert `hero_idle_*.png` into a 64px-wide Endesga-32 sprite sheet with Bayesian Posterior dithering and darkened outlines, plus a looping preview GIF."* The agent will chain `pack_spritesheet` and `create_animated_gif` automatically.
