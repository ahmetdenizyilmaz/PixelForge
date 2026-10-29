---
title: Workstation & Pixel Tools
group: Workstation
order: 1
description: Master the 5-mode multi-viewport, 7 non-destructive pixel retouch tools, 12x Loupe, RGB/Luma histogram, and Tileset Studio.
---

# Workstation & Pixel Tools

The **PixelForge Workstation** (`/editor/`) combines real-time WebGL 2 procedural pixelation with non-destructive hand-pixeling, perceptual color science, and game-ready tilemap inspection in a single four-column layout.

## 4-Column Workstation Layout

1. **Top Command Deck** — Brand emblem, active file & resolution metadata, **5-Mode Viewport Switcher** (`1`–`5`), `12× Pixel Loupe` (`L`), `1px & 16×16 Tile Grid` (`G`), integer zoom controls, Undo/Redo, Local IndexedDB Workspace Save, and primary Export menu.
2. **Far-Left Pro Tool Rail (`48px`)** — Quick toggles for the Studio Asset Drawer (`Sources`, `20 Presets`, `Palettes & Harmony Lab`) plus **7 Non-Destructive Pixel Retouch Tools** and active paint swatch well.
3. **Interactive Multi-Viewport Stage** — Hardware-accelerated pan/zoom stage with floating Quick-Settings Pill, Contextual Brush/Edit Bar, Video Frame Transport, and 4-Up Snapshot Arena.
4. **Right 3-Tab Scientific & Game-Asset Inspector** — Live **RGB + Luminance Canvas Histogram**, **4 Style Snapshot Slots (`A/B/C/D`)**, and dedicated tabs for `Pipeline`, `Color & FX`, and `Game & Export`.

## 5 Live Viewport Modes

Switch viewports anytime from the Top Command Deck or with number keys <kbd>1</kbd>–<kbd>5</kbd>:

| Shortcut | Mode | Purpose |
| :--- | :--- | :--- |
| <kbd>1</kbd> | **Single Pixel Canvas** | Distraction-free integer- crisp pixel output with full retouch tool support and optional 1px + 16×16 tile grid overlay. |
| <kbd>2</kbd> / <kbd>C</kbd> | **Split Curtain (V / H)** | Draggable before/after divider comparing raw high-res source against pixelated output. Click the orientation button on the quickbar to flip between **Vertical** and **Horizontal** split curtains. |
| <kbd>3</kbd> | **Dual Sync Side-by-Side** | Locked pan-and-zoom twin viewports displaying the original source on the left and the processed pixel art on the right simultaneously. |
| <kbd>4</kbd> | **4-Up Snapshot Arena** | Renders 4 style configurations concurrently on the active image—either your saved **Snapshot Slots A–D** or 4 signature presets—so you can compare palettes, widths, and dithers side-by-side and load any quadrant in one click. |
| <kbd>5</kbd> | **3×3 Seamless Tile Wrap** | Repeats your pixel output in a live 3×3 matrix with subtle tile-boundary guides so environment artists can inspect repeating textures and seamless edges immediately. |

## 7 Non-Destructive Pixel Retouch Tools

Procedural shaders get an asset 95% of the way there; manual pixel artistry finishes the remaining 5%. PixelForge composites a **non-destructive pixel edit layer** directly over the live GPU output—meaning you can tweak contrast, swap palettes, or change dithering *while preserving your hand-drawn pixel edits*, or undo/clear strokes independently.

| Shortcut | Tool | Behaviour |
| :--- | :--- | :--- |
| <kbd>V</kbd> | **Navigate / Pan** | Drag to pan, scroll wheel to zoom around cursor. Hold <kbd>Space</kbd> while using any paint tool to pan temporarily. |
| <kbd>B</kbd> | **Pixel Pencil (`1px`–`4px`)** | Continuous Bresenham pixel brush. Right-click or <kbd>Alt</kbd>+Click samples any pixel color on the fly. |
| <kbd>E</kbd> | **Pixel Eraser (`1px`–`4px`)** | Default mode **restores the underlying procedural GPU pixel** cleanly; or paint true alpha transparency. |
| <kbd>K</kbd> | **Flood Bucket / Global Swap** | Contiguous 4-way flood fill. Hold <kbd>Shift</kbd>+Click to perform a **Global Color Swap**, replacing every matching pixel across the entire sprite at once. |
| <kbd>U</kbd> | **1px Bresenham Line** | Crisp, jag-free 1px pixel-art line previewed live as you drag. |
| <kbd>R</kbd> | **1px Pixel Rectangle** | Crisp 1px pixel-art bounding box previewed live for UI frames, windows, and mechanical edges. |
| <kbd>I</kbd> | **Smart Eyedropper** | Samples `#HEX` from the rendered pixel canvas into your active brush swatch. |

> [!NOTE]
> Manual pixel edits automatically propagate into **every export target**—crisp PNG, Indexed-Color PNG, Clipboard Copy, 12× Loupe, Live Histogram, and Deduplicated Game Tilesets. If you change the output grid dimensions (`Width` / `Block Size`), edits reset cleanly for the new grid geometry.

## 12× Pixel Loupe & Telemetry HUD

Press <kbd>L</kbd> to enable the floating **12× Pixel Loupe Magnifier**. Hovering anywhere over the canvas displays:
- An ultra-sharp 11×11 neighborhood grid with center-pixel crosshair
- Exact integer pixel coordinates `(X, Y)`
- Exact `#RRGGBB` hex code and perceptual `OKLab (L, a, b)` coordinates

The bottom Telemetry HUD also reports live `WebGL 2` render latency in milliseconds, output dimensions, zoom factor, and clickable active palette swatches (`Click` = set paint color, `Shift+Click` = copy `#HEX`).

## OKLab Procedural Harmony Generator

Open the **Palettes** drawer (`\` or palette icon on the left rail) to access the built-in **Procedural OKLab Harmony Lab**:
- Choose from **6 perceptual color-harmony models**: `Analogous Ramp`, `Complementary Split`, `Split Triad`, `Triadic Arcade`, `Cyber Neon Ramp`, and `Warm-Cool Pixel Shift`.
- Tune **Base Hue (`0°–360°`)**, **Swatch Count (`4–32`)**, **Chroma (`0.02–0.32`)**, and **Pixel-Art Hue Shift** (automatically cooling shadows toward indigo and warming highlights toward gold).
- Preview the live swatch strip, apply directly to your scene, or save to your persistent Studio palette library and export `.gpl` (Aseprite / GIMP), `.hex` (Lospec), or `.json`.

## Live Mirror-Deduplicated Tileset Studio

Switch the Right Inspector to **Game & Export** to use the live **Tileset Studio**:
- Slice any scene into `8×8`, `16×16`, `24×24`, or `32×32` game tiles.
- Toggle **Mirror X/Y/XY Flip Deduplication** to collapse horizontally, vertically, and diagonally mirrored tiles into a single canonical tile entry.
- Inspect the **live packed tile atlas preview canvas** and real-time **VRAM / Tile Count Savings Badge** (e.g. `142 unique / 300 total (-53% VRAM)`), then download a ready-to-load `.zip` containing `tileset.png` and `tilemap.json` (with per-cell tile index and `fx` / `fy` flip flags for Godot, Tiled, Unity, GB Studio, or custom engines).

## Keyboard Shortcuts Reference

| Keys | Action |
| :--- | :--- |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> <kbd>5</kbd> | Switch Viewport: `Single`, `Split Curtain`, `Dual Sync`, `4-Up Arena`, `3×3 Tile Wrap` |
| <kbd>V</kbd> <kbd>B</kbd> <kbd>E</kbd> <kbd>K</kbd> <kbd>U</kbd> <kbd>R</kbd> <kbd>I</kbd> | Select Tool: `Pan`, `Pencil`, `Eraser`, `Bucket`, `Line`, `Rectangle`, `Eyedropper` |
| <kbd>L</kbd> / <kbd>G</kbd> / <kbd>C</kbd> | Toggle `12× Loupe` / `1px & 16×16 Grid` / `Split Curtain` |
| <kbd>[</kbd> <kbd>]</kbd> (`Shift` for ±8) | Decrease / Increase target pixel width |
| <kbd>D</kbd> / <kbd>Shift+D</kbd> | Cycle dithering algorithm (including `Bayesian Posterior` & `64×64 Blue Noise`) |
| <kbd>F</kbd> / <kbd>+</kbd> / <kbd>-</kbd> | Fit to viewport / Integer zoom in / out |
| <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Shift+Z</kbd> | Multi-level Undo / Redo (prioritizes pixel strokes, then pipeline settings) |
| <kbd>Ctrl+O</kbd> / <kbd>Ctrl+S</kbd> | Open media files / Instant PNG download |
| <kbd>\</kbd> / <kbd>/</kbd> / <kbd>T</kbd> | Toggle Asset Drawer / Toggle Right Inspector / Toggle Dark & Light Theme |
