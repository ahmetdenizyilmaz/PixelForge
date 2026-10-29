---
title: Python 32-Thread Core & Video CV
group: Developers
order: 2
description: Parallel Numba/BGM batch processing, temporal video sequences, cut/zoom motion analyzers, and bar-fill & stroke detectors.
---

# Python 32-Thread Core & Video CV

Alongside the browser WebGL 2 engine, PixelForge ships a high-throughput **Python scientific backend** (`pixelforge/`) powered by **32-thread Numba JIT kernels** (`@njit(parallel=True, fastmath=True)`) and full-covariance **Bayesian Gaussian Mixtures (`scikit-learn`)**. It is designed for offline game asset builds, temporal video pixelation, and automated computer-vision video analysis.

## Installation

```bash
pip install -e .
```

Core dependencies: `numpy`, `scipy`, `scikit-image`, `scikit-learn`, `numba`, `Pillow`.

## Python `PixelForge` Engine API

Following `scikit-learn` conventions, `PixelForge` separates palette fitting (`fit`) from image transformation (`transform`), making it effortless to lock a unified palette across dozens of sprite sheets or video frames:

```python
from skimage import io
from pixelforge import PixelForge, Pal, Dither

# 1. Single-image Bayesian Gaussian Mixture + Posterior Dither
img = io.imread("forest_waterfall.jpg")
model = PixelForge(
    width=160,                 # Target pixel width (or downsample_by=6)
    pal=16,                    # Discover 16 BGM clusters (or pass Pal.PICO_8 / hex list)
    sobel=3,                   # Parallel 32-thread Sobel edge operator size
    svd=True,                  # Truncated SVD structural noise suppression
    clahe=0.35,                # Local adaptive histogram equalization
    kuwahara=2,                # Anisotropic quadrant smoothing radius
    dither=Dither.BAYESIAN,    # Perceptual BGM posterior probability dithering
    alpha=0.6,                 # Alpha transparency threshold for RGBA sprites
    cleanup=True,              # Remove isolated 1px speckles
    outlines=0.45,             # Adaptive darkened pixel-art contours
)

out = model.fit_transform(img)
io.imsave("waterfall_pixel.png", out)

# 2. Reuse the exact fitted BGM palette across additional assets:
prop_out = model.transform(io.imread("stone_shrine.png"))
```

### Supported `Dither` Modes in Python
- `Dither.NONE` — Hard maximum-a-posteriori cluster assignment
- `Dither.BAYESIAN` — Smooth BGM cluster posterior probability dithering
- `Dither.BLUENOISE` — 64×64 void-and-cluster filmic stippling
- `Dither.NAIVE` / `Dither.BAYER` — Ordered Bayer crosshatch matrix
- `Dither.ATKINSON` — Crisp 75% bounded error diffusion
- `Dither.FLOYD` — Classic serpentine Floyd-Steinberg error diffusion

## Temporal Video Sequence Processing (`Sequence`)

Pixelating video frame-by-frame independently causes severe palette flicker. `Sequence` analyzes scene cuts and **locks BGM palettes across coherent shots** (`keyframe` sensitivity) while rendering frames in parallel:

```bash
pixelforge cutscene.mp4 pixel_cutscene/ --sequence --keyframe 0.30 --refit --pal 20 --dither bayesian --pad 1
```

## CLI Batch Reference

```bash
# Convert an entire folder of concept art using PICO-8 hardware colors and 4x integer upscale:
pixelforge assets/raw/ assets/pixel/ --width 128 --pal pico-8 --dither bayer --upscale 4

# High-detail scientific landscape pass with SVD + CLAHE + 24 BGM colors:
pixelforge vista.jpg vista_px.png --width 220 --pal 24 --svd --clahe 0.4 --dither bayesian
```

## Modular Computer-Vision Video Detectors (`pixelforge/video/`)

PixelForge includes three standalone, composable computer-vision modules for detecting structural visual events and motion cues in recorded gameplay, tutorials, or motion graphics:

### 1. Cut, Motion & Configurable Camera Zoom Analyzer (`analyzer.py`)

```python
from pixelforge.video import analyze_video_events

report = analyze_video_events(
    "gameplay_capture.mp4",
    detect_cuts=True,
    detect_zooms=True,          # Configurable: disable or raise zoom_threshold to avoid over-triggering
    zoom_threshold=0.18,
    min_zoom_duration_s=0.35,
)
# report["cuts"], report["motion_peaks"], report["zooms"] -> exact timestamps & magnitudes
```

### 2. Horizontal & Vertical Bar-Fill Detector (`bar_fill_detector.py`)

Detects progress bars, health/mana meters, and vertical/horizontal wipe fills with exact `start_time`, `finish_time`, `orientation` (`horizontal` | `vertical`), and fill percentage curves:

```python
from pixelforge.video import detect_bar_fills

bars = detect_bar_fills("hud_recording.mp4", min_fill_span=0.35)
for b in bars:
    print(f"{b.orientation} bar @ bbox={b.bbox}: {b.start_time:.2f}s -> {b.finish_time:.2f}s")
```

### 3. Drawn Circle, Box & Callout Stroke Detector (`stroke_draw_detector.py`)

Isolates progressive indicator drawings—such as hand-drawn circles, arrows, underlines, or bounding lines drawn around an object—reporting exact `draw_start_s`, `draw_finish_s`, `shape_kind` (`circle_loop`, `box_ enclosure`, `line_indicator`), and bounding coordinates as an independent opt-in module:

```python
from pixelforge.video import detect_stroke_drawings

strokes = detect_stroke_drawings("annotated_demo.mp4", min_arc_px=45)
for s in strokes:
    print(f"{s.shape_kind} drawn {s.draw_start_s:.2f}s -> {s.draw_finish_s:.2f}s around {s.bbox}")
```
