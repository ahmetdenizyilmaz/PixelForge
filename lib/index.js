// pixelforge core: headless & browser WebGL 2 / CPU pixel-art engine.

export { createPixelator, pixelate, makeResult } from './core/engine.js';
export {
  DEFAULTS, DITHER_METHODS, EXTRACT_ALGOS, FX_MODES, SETTINGS_VERSION, MAX_SIZE, LEGACY_DITHER,
  defaultSettings, normalizeSettings, mergeSettings, resolveSize, ditherKind, cropRect, ASPECTS,
  encodeSettings, decodeSettings, compactSettings, settingsToJSON, settingsFromJSON,
} from './core/settings.js';
export { makePlan } from './core/plan.js';
export { runCPU } from './core/cpu/pipeline.js';
export { PALETTES, getPalette } from './core/palette/builtin.js';
export { parsePalette, toGPL, toHexFile, toPaletteJSON } from './core/palette/parse.js';
export { extractPalette, generateHarmonyRamp, sortPaletteOKLab, oklabToRgbBytes } from './core/palette/extract.js';
export { fetchLospec, lospecSlug } from './core/palette/lospec.js';
export { thresholdMap, parseMatrix, bayer } from './core/dither/matrices.js';
export { KERNELS } from './core/dither/kernels.js';
export { PRESETS, PRESET_CATEGORIES, getPreset } from './core/presets.js';
export { parseColor, toHex, oklab } from './core/color.js';
export { toFrame, loadImage } from './core/source.js';
export { upscale, resizeNearest, uniqueColors, detectGrid, hasTransparency } from './core/export/scale.js';
export { toCanvas, downloadBlob } from './core/export/canvas.js';
export { encodePNG } from './core/export/png.js';
export { encodeGIF } from './core/export/gif.js';
export { createZip } from './core/export/zip.js';
export { packSpriteSheet, buildTileset } from './core/export/sheet.js';
export { forEachFrame, estimateFps, seekTo, frameTimes, videoReady, mediaError, sniffVideoCodec } from './core/video/frames.js';

/* global __ITP_VERSION__ */
export const VERSION = typeof __ITP_VERSION__ === 'string' ? __ITP_VERSION__ : 'dev';
