---
title: Scientific Pipeline & Shaders
group: Workstation
order: 2
description: Inside Hybrid Bimodal-Plateau resampling, OKLab-BGM EM discovery, SVD structural denoise, CLAHE, and Bayesian Posterior dithering.
---

# Scientific Pipeline & Shaders

Standard image editors produce blurry, muddy pixel art because they rely on linear box/bicubic averaging, RGB k-means clustering, and unbounded error diffusion. **PixelForge** replaces every stage of that naive chain with perceptual **OKLab color geometry** and **edge-preserving statistical shaders**—matched across both the real-time WebGL 2 GPU backend and the deterministic CPU / Python backends.

## End-to-End 8-Stage Pipeline

```text
Source Image / Video Frame
  │
  ├─ 1. SVD Low-Rank Structural Pre-Filter  (suppresses high-frequency sensor grain before edge math)
  ├─ 2. CLAHE Local Micro-Contrast + Color Grading  (lifts local shadow detail without clipping highlights)
  ├─ 3. Anisotropic 4-Quadrant Kuwahara Filter  (flattens noisy photo textures into clean cel plateaus)
  ├─ 4. Hybrid Bimodal-Plateau / Sobel Resampler  (snaps edges crisply while smoothing flat gradients)
  ├─ 5. Regularized OKLab-BGM EM Palette Discovery  (anisotropic Gaussian clusters + vivid accent boost)
  ├─ 6. Bayesian Posterior / 64×64 Blue Noise Quantizer  (2-nearest perceptual soft dither, zero 3rd-color bleed)
  ├─ 7. Morphological Cleanup & Adaptive Outlines  (1px orphan removal + luminance-aware ink contours)
  └─ 8. GPU Screen Post-FX Shaders  (Bloom, CRT Phosphor, Isometric 3D Voxel, Handheld LCD, Oscilloscope, Blueprint)
```

## Downsampling Operators

Choosing the right downsampler (`size.resample`) determines how sub-pixel geometry collapses onto the target pixel grid:

| Mode | Algorithm | Best For |
| :--- | :--- | :--- |
| **`hybrid`** *(Default)* | **Hybrid Bimodal-Plateau**: Evaluates an anisotropic gradient tensor across every source block. High-gradient blocks separate foreground/background modes bimodally so silhouettes stay razor-sharp; low-gradient plateaus blend smoothly without shimmering. | Landscapes, 3D renders, concept art, portraits, video |
| **`sobel`** | **Sobel Edge-Weighted**: Weights samples inversely to local Sobel gradient magnitude so contours never average across boundaries. | Architectural photos, hard-surface props |
| **`nearest`** | **Point / Center Sample**: Zero filtering; samples exact block centers. Pair with **Auto-Detect Grid** for pre-upscaled pixel art. | Cleaning AI-upscaled or screenshot pixel art |
| **`box`** | **Area Box Average**: Uniform integration over each source footprint. | Smooth atmospheric gradients when paired with dithering |

## Pre-Filters: SVD, CLAHE & Kuwahara

### SVD Structural Noise Pre-Filter (`adjust.svd`: `0..1`)
Photographic JPEG artifacts and high-ISO grain fool edge detectors into creating speckled pixel noise. PixelForge's **SVD / Low-Rank Bilateral Pre-Filter** attenuates micro-variance inside coherent luminance neighborhoods while preserving structural singular edges prior to CLAHE and downsampling.

### CLAHE Local Contrast (`adjust.clahe`: `0..1`)
Global contrast crushes dark caverns and blows out bright skies. **Contrast-Limited Adaptive Histogram Equalization (CLAHE)** equalizes local luminance tiles with clip limiting so shadowed rock faces and bright clouds both retain readable pixel clusters.

### Anisotropic Kuwahara (`adjust.kuwahara`: `0..4`)
Evaluates four overlapping sub-windows around each sample and adopts the mean color of the quadrant with the lowest variance—turning busy grass, water, and skin textures into cohesive painterly planes ready for crisp quantization.

## Palette Discovery in Perceptual OKLab

Euclidean RGB distance treats green shades unfairly and collapses small, high-saturation focal accents (like glowing eyes, flowers, or warning lights) into muddy gray averages. PixelForge performs all clustering in **Björn Ottosson's perceptual OKLab space**:

- **`oklab-bgm` (Bayesian Gaussian Mixture EM)** *(Default)*: Initializes centroids via saliency-weighted **k-means++** (boosting chromaticity and local edge contrast), then runs **7 regularized Expectation-Maximization iterations** fitting per-cluster diagonal covariances `(σ²_L, σ²_a, σ²_b)` and Dirichlet-regularized mixture priors `π_k`. Elongated color ramps (such as lit foliage or metallic gradients) are captured naturally without wasting palette slots.
- **`oklab-salient` (Fast Saliency K-Means)**: Rapid perceptual clustering weighted toward vivid focal hues for ultra-fast interactive sweeps.
- **`median-cut` (Classic Box Partition)**: Recursively splits the widest perceptual bounding-box axis for balanced retro hardware distributions.

## Dithering & Bayesian Posterior Quantization

| Method | Category | Characteristics |
| :--- | :--- | :--- |
| **`posterior`** | **Bayesian Posterior (OKLab)** | Computes exact perceptual distances `(d₁, d₂)` to the **two nearest OKLab palette centroids** and derives a smooth Boltzmann posterior probability `P(c₁) = d₂^γ / (d₁^γ + d₂^γ)`. Thresholded against a 64×64 void-and-cluster Blue Noise field with canonical index ordering (`best₁ < best₂`), it **guarantees zero 3rd-color bleed** and **zero Voronoi boundary seams**. |
| **`bluenoise`** | **64×64 Void-and-Cluster** | Organic, filmic stipple pattern free of repetitive diagonal crosshatch artifacts. |
| **`bayer2` / `bayer4` / `bayer8`** | **Ordered Bayer Matrix** | Classic structured pixel-art crosshatching ideal for Sega Genesis, PC-98, and GBA aesthetics. |
| **`cluster4`** | **4×4 Halftone Dot** | Print-style clustered halftone stippling. |
| **`atkinson`** | **Bounded Error Diffusion** | Propagates 75% (6/8) of quantization error for high-contrast Macintosh 1-bit & indie aesthetics without muddying midtones. |
| **`floyd-steinberg` / `sierra-lite` / `jarvis`** | **Full Error Diffusion** | Smooth photographic tonal gradients on CPU/offline exports. |

> [!TIP]
> For animated video or sprite rotations, prefer **`posterior`**, **`bluenoise`**, or **`bayer4`** over error diffusion (`floyd-steinberg`). Ordered and posterior shaders are spatially deterministic on the GPU, eliminating frame-to-frame "swimming" noise!

## 6 GPU Screen Post-FX Shaders

Every output can pass through hardware-accelerated screen shaders (`fx.mode`):
1. **`bloom`** — HDR emissive threshold extraction + soft multi-tap glow composite.
2. **`crt`** — Trinitron aperture-grille phosphor triads, scanline beam modulation, and subtle barrel curvature.
3. **`voxel`** — Extrudes each quantized pixel into a lit 2.5D isometric voxel column based on perceptual luminance height.
4. **`lcd`** — Sub-pixel RGB dot-matrix grid modeled after classic handheld backlit LCDs.
5. **`oscilloscope`** — Phosphor-green vector waveform trace deflected vertically by pixel luminance.
6. **`blueprint`** — Architectural cyanotype schematic projection with technical grid lines and edge highlights.
