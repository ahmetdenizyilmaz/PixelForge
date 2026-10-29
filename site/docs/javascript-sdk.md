---
title: JavaScript & WebGL 2 SDK
group: Developers
order: 1
description: Embed the zero-dependency WebGL 2 engine, OKLab harmony generator, game-asset packers, or full Workstation UI.
---

# JavaScript & WebGL 2 SDK

PixelForge compiles to a zero-dependency ES module (`dist/pixelforge.esm.js`), UMD bundle (`dist/pixelforge.js`), CommonJS build (`dist/pixelforge.cjs`), and embeddable Workstation UI (`dist/editor.js` + `dist/editor.css`).

## Persistent GPU Engine (`createPixelator`)

For interactive apps, games, and batch processing, create a persistent engine instance once. In browsers with WebGL 2 it compiles all GLSL fragment passes upfront and caches uploaded source textures; in Node.js or headless environments it transparently runs the matching deterministic CPU pipeline.

```javascript
import { createPixelator } from 'pixelforge-studio';

const engine = await createPixelator(); // { backend: 'webgl' | 'cpu', process, invalidate, destroy }

const result = await engine.process(sourceImageOrVideoOrImageData, {
  size: { mode: 'width', width: 160, resample: 'hybrid' },
  adjust: {
    brightness: 0,
    contrast: 0.08,
    saturation: 0.12,
    svd: 0.35,       // SVD structural grain suppression (0..1)
    kuwahara: 2,     // Anisotropic 4-quadrant painterly pre-filter (0..4)
    clahe: 0.22,     // Local adaptive contrast equalization (0..1)
  },
  palette: {
    source: 'extract',
    algo: 'oklab-bgm', // 'oklab-bgm' | 'oklab-salient' | 'median-cut'
    count: 20,
  },
  dither: {
    method: 'posterior', // 'posterior' | 'bluenoise' | 'bayer4' | 'bayer8' | 'atkinson' | ...
    strength: 0.65,
  },
  cleanup: { orphans: true, smooth: false },
  outline: { mode: 'ink', color: '#141020' }, // 'none' | 'outer' | 'inner' | 'ink'
  fx: { mode: 'none', strength: 0.65 }, // 'bloom' | 'crt' | 'voxel' | 'lcd' | 'oscilloscope' | 'blueprint'
});

console.log(`${result.width}x${result.height} rendered in ${result.ms.toFixed(1)} ms on ${result.backend}`);
```

### `PixelResult` Methods

Every `engine.process()` or one-shot `pixelate()` call returns a `PixelResult`:
- `result.width`, `result.height`, `result.data` (`Uint8ClampedArray` RGBA bytes)
- `result.palette` (`string[]` of `#rrggbb` swatches) & `result.usedColors()` (actual unique `#rrggbb` present)
- `result.toCanvas(scale = 1, { canvas })` — Renders nearest-neighbor integer-upscaled output onto an HTMLCanvasElement
- `result.upscale(scale = 4)` — Returns `{ width, height, data }` scaled by an integer factor
- `result.toPNG({ scale = 1, indexed = true })` — Encodes a pure binary `Uint8Array` PNG (with automatic PLTE/tRNS indexed-color table when ≤ 256 colors!)
- `result.toBlob({ scale = 4 })` — Async `Blob` (`image/png`)

## Color Science & Harmony Utilities

```javascript
import {
  extractPalette,
  generateHarmonyRamp,
  sortPaletteOKLab,
  toGPL,
  toHexFile,
} from 'pixelforge-studio';

// 1. Discover an OKLab Bayesian Gaussian Mixture palette directly from RGBA bytes:
const discovered = extractPalette(imageData, 16, 'oklab-bgm');
const sorted = sortPaletteOKLab(discovered);

// 2. Procedurally synthesize a pixel-art color ramp with shadow/highlight hue shifting:
const ramp = generateHarmonyRamp({
  baseHue: 215,          // 0..360 degrees
  mode: 'warm-cool',     // 'analogous' | 'complementary' | 'split' | 'triadic' | 'cyber' | 'warm-cool'
  count: 16,             // 4..32 colors
  chroma: 0.14,          // OKLab chroma intensity
  hueShift: 0.45,        // Cool indigo shadows -> warm golden highlights
});

// 3. Export for Aseprite / GIMP (.gpl) or Lospec (.hex):
const gplText = toGPL('Nordic Dusk 16', ramp);
const hexText = toHexFile(ramp);
```

## Game-Asset Packers: Tilesets, Sprite Sheets & GIFs

### Mirror-Deduplicated Tileset & Tilemap (`buildTileset`)

```javascript
import { buildTileset, encodePNG } from 'pixelforge-studio';

const ts = buildTileset(
  { width: result.width, height: result.height, data: result.data },
  { tileWidth: 16, tileHeight: 16, columns: 16, flips: true } // Deduplicates H/V/HV mirrored 16x16 tiles!
);

const atlasPng = await encodePNG(ts.image);
console.log(`Compressed ${ts.map.width * ts.map.height} cells into ${ts.count} unique tiles`);
// ts.map -> { width, height, tileWidth, tileHeight, tiles: [...], flips: [...] }
```

### Multi-Frame Sprite Sheet (`packSpriteSheet`) & Animated GIF (`encodeGIF`)

```javascript
import { packSpriteSheet, encodeGIF } from 'pixelforge-studio';

const sheet = packSpriteSheet(frames, { columns: 8, padding: 1 });
const gifBytes = encodeGIF(
  frames.map(f => ({ ...f, delayMs: 80 })),
  { loop: 0 }
);
```

## Embedding the Full Workstation (`mountEditor`)

Mount the entire 4-column PixelForge Workstation inside any container element:

```html
<link rel="stylesheet" href="./dist/editor.css">
<div id="studio" style="height: 100vh;"></div>

<script type="module">
  import { mountEditor } from './dist/editor.js';

  const studio = await mountEditor(document.getElementById('studio'), {
    initialSample: 'mountain-fjord',
    persist: true,
  });

  // Programmatically switch viewport modes ('single' | 'split' | 'dual' | 'quad' | 'tile') or presets:
  studio.applyPreset('bgm-posterior');
  studio.setViewMode('split');
</script>
```
