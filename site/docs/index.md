---
title: Overview & Quickstart
group: Overview
order: 1
description: Unified WebGL 2 Pixel Art Workstation, Scientific OKLab-BGM & Bayesian Posterior Pipeline, 32-Thread Numba Python Core, and 15-Tool MCP Server.
---

# Overview & Quickstart

**PixelForge** is a dual-runtime scientific pixel-art workstation and game-asset engine engineered for game developers, technical artists, and automated pipelines. Every pixel transformation runs locally—either in real time on your browser's **WebGL 2 GPU** (typically **2–7 ms per frame**) or offline across **all CPU cores via 32-thread Numba & Bayesian Gaussian Mixtures** in Python.

> [!TIP]
> Jump straight into the browser [Workstation](../editor/) to test 5 multi-viewport modes and non-destructive pixel retouch tools, or explore live side-by-side shader comparisons in the [Interactive Lab](../playground/).

## Architecture at a Glance

| Layer | Runtime | Key Capabilities |
| :--- | :--- | :--- |
| **PixelForge Workstation** | Browser (WebGL 2 + Canvas 2D) | 5-mode viewport (`Single`, `Curtain V/H`, `Dual Sync`, `4-Up Arena`, `3×3 Seamless Tile`), 7 non-destructive pixel paint tools, 12× Loupe, Live RGB/Luma Histogram, 4 Style Snapshots, Live Mirror-Deduplicated Tileset Studio |
| **Browser Core SDK** | Zero-dependency ESM / UMD / CJS | `Hybrid Bimodal-Plateau` downsampling, regularized `OKLab-BGM` EM palette discovery, `SVD` + `Kuwahara` + `CLAHE` pre-filters, `Bayesian Posterior` soft dithering, 6 GPU Screen Post-FX, Indexed PNG / GIF / MP4 / WebM / Tileset packers |
| **Python Scientific Core** | Python 3.10+ (`Numba` + `scikit-learn`) | 32-thread parallel Sobel & bilateral filtering, full covariance Bayesian Gaussian Mixture (`BGM`) clustering, temporal keyframe palette locking, CLI batch & video processing, computer-vision cut/zoom/bar-fill/stroke detectors |
| **AI Agent MCP Server** | Node.js JSON-RPC (`stdio`) | 15 zero-dependency Model Context Protocol tools for pixelating assets, extracting OKLab palettes, packing sprite sheets, deduplicating tilemaps, and encoding GIFs directly from AI coding assistants |

## Quickstart

### 1. Run Locally (Workstation + Docs + Interactive Lab)

```bash
git clone https://github.com/ahmetdenizyilmaz/PixelForge.git
cd PixelForge
npm install
npm run build:site
node scripts/serve.mjs
```

Open `http://localhost:8765/` for the interactive homepage, `http://localhost:8765/editor/` for the full-screen Workstation, or `http://localhost:8765/playground/` for the Interactive Algorithm Lab.

### 2. JavaScript / TypeScript WebGL 2 SDK

```javascript
import { createPixelator, generateHarmonyRamp } from 'pixelforge-studio';

const forge = await createPixelator(); // WebGL 2 GPU with automatic CPU fallback
const ramp = generateHarmonyRamp({ baseHue: 205, mode: 'warm-cool', count: 16 });

const result = await forge.process(imageElement, {
  size: { mode: 'width', width: 160, resample: 'hybrid' },
  adjust: { svd: 0.25, kuwahara: 2, clahe: 0.25 },
  palette: { source: 'custom', name: 'Warm-Cool 16', colors: ramp },
  dither: { method: 'posterior', strength: 0.5 },
  cleanup: { orphans: true },
  outline: { mode: 'ink', color: '#141020' },
});

document.body.append(result.toCanvas(4)); // Crisp 4x integer-scaled canvas
```

### 3. Python 32-Thread Numba & BGM Core

```python
from skimage import io
from pixelforge import PixelForge, Dither

img = io.imread("alpine_valley.jpg")
pf = PixelForge(
    width=160,
    pal=16,
    sobel=3,
    svd=True,
    clahe=0.35,
    dither=Dither.BAYESIAN,
    alpha=0.6,
)
pixel_art = pf.fit_transform(img)
io.imsave("alpine_pixel.png", pixel_art)
```

## Documentation Guide

- **[Workstation & Pixel Tools](../workstation/)** — Tour the 4-column workstation layout, 5 viewport modes, 7 non-destructive pixel retouch tools, 12× Loupe, Style Snapshots, and Tileset Studio.
- **[Scientific Pipeline & Shaders](../algorithms/)** — Deep dive into `Hybrid Bimodal-Plateau` resampling, `OKLab-BGM` EM clustering, `SVD` low-rank structural denoising, `Bayesian Posterior` dithering, and GPU Post-FX.
- **[JavaScript & WebGL 2 SDK](../javascript-sdk/)** — Full API reference for `createPixelator`, `mountEditor`, `generateHarmonyRamp`, `buildTileset`, `packSpriteSheet`, and encoders.
- **[Python 32-Thread Core & Video CV](../python-cli/)** — Python `PixelForge` class, CLI flags, temporal video sequences, and modular computer-vision event detectors.
- **[15-Tool AI Agent MCP Server](../mcp-server/)** — Connect PixelForge to Claude Desktop, Cursor, or any MCP host.
