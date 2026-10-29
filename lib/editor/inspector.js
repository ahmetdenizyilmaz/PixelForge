// PixelForge Studio Right Workstation Inspector:
// - Live RGB + Luminance Canvas Histogram + Output/Colour/GPU Telemetry
// - 4 Style Snapshot Slots (A, B, C, D) + 4-Up Comparison Trigger
// - 3 Dedicated Workstation Tabs: Pipeline | Color & FX | Game & Export (with Live Mirror-Deduplicated Tileset Studio)

import { h, render } from './dom.js';
import { icon } from './icons.js';
import { section, slider, select, segmented, toggle, colorInput, numberInput, field } from './controls.js';
import { exportSize } from './exporter.js';
import { isFullClipDefault, INITIAL_INTERVAL_SECONDS } from './storyboard.js';
import { DITHER_METHODS, EXTRACT_ALGOS, FX_MODES, ditherKind, defaultSettings, ASPECTS, cropRect } from '../core/settings.js';
import { sortPaletteOKLab } from '../core/palette/extract.js';
import { buildTileset } from '../core/export/sheet.js';
import * as persist from './persist.js';
import { PALETTES } from '../core/palette/builtin.js';
import { parseMatrix } from '../core/dither/matrices.js';

export function createInspector(app) {
  const { store } = app;
  const up = (patch, key) => store.update(patch, { key });
  const commit = () => store.commit();
  const S = () => store.settings;
  const DEF = defaultSettings();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const openState = persist.load('sections_v2', {});
  const sec = (key, title, defaultOpen, groups, ...children) => section(title, {
    open: openState[key] ?? defaultOpen,
    onToggle: open => { openState[key] = open; persist.save('sections_v2', openState); },
    onReset: groups ? () => {
      const patch = {};
      for (const g of groups) patch[g] = JSON.parse(JSON.stringify(DEF[g]));
      store.update(patch);
    } : null,
  }, ...children);

  // =========================================================== TELEMETRY + HISTOGRAM + SNAPSHOTS
  const histCanvas = h('canvas.pf-hist-canvas', { width: 256, height: 52, title: 'Live RGB & Perceptual Luminance Histogram' });
  const histCtx = histCanvas.getContext('2d');

  const statSize = h('div.v', { text: '–' });
  const statColors = h('div.v', { text: '–' });
  const statTime = h('div.v', { text: '–' });
  const stats = h('div.itp-stats', { 'aria-live': 'polite' },
    h('div.itp-stat', {}, h('div.k', { text: 'Grid' }), statSize),
    h('div.itp-stat', {}, h('div.k', { text: 'Colours' }), statColors),
    h('div.itp-stat', {}, h('div.k', { text: 'Engine' }), statTime));

  // 4 Style Snapshot Slots (A, B, C, D)
  const snapButtons = ['A', 'B', 'C', 'D'].map((letter, idx) => {
    const b = h('button.pf-snap-btn', {
      type: 'button',
      'data-filled': 'false',
      title: `Slot ${letter}: Click to save snapshot (or click filled slot to recall; Shift+Click overwrites; Alt+Click clears)`,
      onclick: e => app.handleSnapshot?.(idx, { overwrite: e.shiftKey, clear: e.altKey }),
    }, h('span.l', { text: letter }), h('i.dot'));
    return b;
  });
  const quadArenaBtn = h('button.pf-snap-quad', {
    type: 'button',
    title: 'Compare Snapshots A–D simultaneously in 4-Up Viewport Arena',
    html: `${icon('viewQuad')}<span>4-Up</span>`,
    onclick: () => app.openQuadArena?.(),
  });
  const snapBar = h('div.pf-snap-bar', {},
    h('span.pf-snap-lbl', { text: 'Snapshots' }),
    ...snapButtons,
    quadArenaBtn);

  function syncSnapshots() {
    const list = app.snapshots || [];
    snapButtons.forEach((b, i) => {
      const snap = list[i];
      b.dataset.filled = snap ? 'true' : 'false';
      b.dataset.active = (app.activeSnapshot === i) ? 'true' : 'false';
      b.title = snap
        ? `Slot ${String.fromCharCode(65 + i)} (${snap.label}): Click to recall · Shift+Click to overwrite · Alt+Click to clear`
        : `Slot ${String.fromCharCode(65 + i)} (empty): Click to snapshot current look`;
    });
  }

  function drawHistogram(result) {
    const W = histCanvas.width, H = histCanvas.height;
    histCtx.clearRect(0, 0, W, H);
    if (!result || !result.data) return;
    const d = result.data;
    const binsR = new Uint32Array(64), binsG = new Uint32Array(64), binsB = new Uint32Array(64), binsL = new Uint32Array(64);
    let total = 0;
    const step = Math.max(4, Math.floor(d.length / (4 * 8192)) * 4);
    for (let i = 0; i < d.length; i += step) {
      if (d[i + 3] < 64) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      binsR[r >> 2]++;
      binsG[g >> 2]++;
      binsB[b >> 2]++;
      const l = Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b));
      binsL[l >> 2]++;
      total++;
    }
    if (!total) return;

    let peak = 1;
    for (let i = 1; i < 63; i++) peak = Math.max(peak, binsR[i], binsG[i], binsB[i], binsL[i]);
    const scaleY = v => H - 2 - Math.min(H - 5, Math.pow(v / peak, 0.62) * (H - 6));

    const plotCurve = (bins, stroke, fill) => {
      histCtx.beginPath();
      histCtx.moveTo(0, H);
      for (let i = 0; i < 64; i++) {
        const x = (i / 63) * W;
        const v = i > 0 && i < 63 ? (bins[i - 1] * 0.22 + bins[i] * 0.56 + bins[i + 1] * 0.22) : bins[i];
        histCtx.lineTo(x, scaleY(v));
      }
      histCtx.lineTo(W, H);
      histCtx.closePath();
      histCtx.fillStyle = fill;
      histCtx.fill();
      histCtx.strokeStyle = stroke;
      histCtx.lineWidth = 1.15;
      histCtx.stroke();
    };

    plotCurve(binsR, 'rgba(244,63,94,0.75)', 'rgba(244,63,94,0.14)');
    plotCurve(binsG, 'rgba(20,241,149,0.75)', 'rgba(20,241,149,0.14)');
    plotCurve(binsB, 'rgba(56,189,248,0.8)', 'rgba(56,189,248,0.15)');
    plotCurve(binsL, 'rgba(248,250,252,0.72)', 'rgba(248,250,252,0.08)');
  }

  // ---- 3 Workstation Tabs
  const tabPipeline = h('button', { type: 'button', role: 'tab', 'aria-selected': 'true', id: 'pf-tab-pipeline', html: `${icon('sliders')}<span>Pipeline</span>` });
  const tabColor = h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', id: 'pf-tab-color', html: `${icon('palette')}<span>Color & FX</span>` });
  const tabExport = h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', id: 'pf-tab-export', html: `${icon('download')}<span>Game & Export</span>` });
  const tabs = h('div.itp-seg.pf-insp-tabs', { role: 'tablist', 'aria-label': 'Inspector Tabs' }, tabPipeline, tabColor, tabExport);

  // ---- Multi-File Scope Switcher
  const scope = segmented({
    label: 'Pipeline Scope', bare: true,
    options: [{ value: 'shared', label: 'All Sources', icon: 'layers' }, { value: 'own', label: 'Independent', icon: 'unlink' }],
    value: 'shared',
    onChange: v => app.current && app.setOwn(app.current, v === 'own'),
  });
  const scopeNote = h('span.itp-scope-note', {});
  const scopeRow = h('div.itp-scope', { hidden: true }, h('div.lab', {}, h('span', { text: 'Settings Scope' }), scopeNote), scope.el);

  // =========================================================== TAB 1: PIPELINE
  const sizeMode = segmented({
    label: 'Grid Sizing',
    options: [{ value: 'width', label: 'Target Width' }, { value: 'block', label: 'Block Ratio' }],
    value: 'width',
    onChange: v => up({ size: { mode: v } }),
  });
  const width = slider({ label: 'Pixel Width', min: 8, max: 512, step: 1, value: 96, reset: 96, onInput: v => up({ size: { width: v } }, 'width'), onCommit: commit });
  const height = numberInput({ label: 'Fixed Height', min: 0, max: 2048, help: 'Leave blank (Auto) to preserve exact aspect ratio.', onChange: v => up({ size: { height: v } }) });
  height.input.placeholder = 'Auto';
  const block = slider({ label: 'Source Block Size', min: 1, max: 64, step: 1, value: 8, reset: 8, help: 'Source pixels collapsed into 1 output pixel.', onInput: v => up({ size: { block: v } }, 'block'), onCommit: commit });
  const resample = segmented({
    label: 'Downsampler',
    options: [
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'sobel', label: 'Sobel' },
      { value: 'box', label: 'Box' },
      { value: 'nearest', label: 'Nearest' },
    ],
    value: 'hybrid',
    help: 'Hybrid Bimodal-Plateau locks 1px strokes via Sobel while keeping sky/water gradients ultra-clean.',
    onChange: v => up({ size: { resample: v } }),
  });
  const detect = h('button.itp-btn.small.outline', {
    type: 'button', html: `${icon('grid')}<span>Auto-Detect Pixel Grid (GCD)</span>`,
    title: 'Recover native block size from pre-upscaled pixel art', onclick: () => app.detectGrid(),
  });
  const widthBox = h('div', { style: { display: 'contents' } }, width.el, height.el);
  const blockBox = h('div', { style: { display: 'contents' } }, block.el);
  const secSize = sec('size', 'Grid & Resampler', true, ['size'], sizeMode.el, widthBox, blockBox, resample.el, h('div.itp-row', {}, detect));

  // Scientific Pre-Filters (Kuwahara + SVD + CLAHE)
  const aKuwahara = slider({
    label: 'Anisotropic Brush (Kuwahara)', min: 0, max: 4, step: 1, value: 0, reset: 0,
    help: '4-quadrant variance-minimizing flat paint pre-filter (Kurzgesagt / cel look).',
    onInput: v => up({ adjust: { kuwahara: v } }, 'kw'), onCommit: commit,
  });
  const aSvd = slider({
    label: 'Structural Denoise (SVD)', min: 0, max: 1, step: 0.01, scale: 100, value: 0, reset: 0,
    help: '5×5 low-rank bilateral structural filter that suppresses photo sensor noise before quantization.',
    onInput: v => up({ adjust: { svd: v } }, 'svd'), onCommit: commit,
  });
  const aClahe = slider({
    label: 'Micro-Contrast (CLAHE)', min: 0, max: 1, step: 0.01, scale: 100, value: 0, reset: 0,
    help: 'Adaptive local contrast boost across ridges, foliage & water.',
    onInput: v => up({ adjust: { clahe: v } }, 'clh'), onCommit: commit,
  });
  const secPre = sec('prefilters', 'Scientific Pre-Filters', true, null, aKuwahara.el, aSvd.el, aClahe.el);

  // Cleanup & 1px Ink Outlines
  const orphans = toggle({ label: 'Purge isolated 1px orphans', onChange: v => up({ cleanup: { orphans: v } }) });
  const smooth = toggle({ label: '3×3 majority speckle cleanup', onChange: v => up({ cleanup: { smooth: v } }) });
  const alphaCut = slider({ label: 'Alpha Threshold', min: 0, max: 1, step: 0.01, scale: 100, value: 0.5, reset: 0.5, onInput: v => up({ alpha: { threshold: v } }, 'alpha'), onCommit: commit });
  const olMode = segmented({
    label: '1px Pixel Outlines',
    options: [
      { value: 'none', label: 'Off' },
      { value: 'outer', label: 'Outer' },
      { value: 'inner', label: 'Inner' },
      { value: 'ink', label: 'Comic Ink' },
    ],
    value: 'none',
    help: 'Outer/Inner trace transparent sprite silhouettes; Comic Ink draws internal 1px luminance contours.',
    onChange: v => up({ outline: { mode: v } }),
  });
  const olColor = colorInput({ label: 'Ink Colour', onChange: v => up({ outline: { color: v } }, 'olc') });
  const olCorners = toggle({ label: '8-neighbour diagonal corners', onChange: v => up({ outline: { corners: v } }) });
  const secClean = sec('cleanup', 'Cleanup & 1px Ink Outlines', false, ['cleanup', 'outline', 'alpha'], orphans.el, smooth.el, alphaCut.el, olMode.el, olColor.el, olCorners.el);

  // Aspect & Crop Frame
  const aspectBtns = ASPECTS.map(a => {
    const r = a.ratio || 4 / 3;
    const glyph = h('i', { style: { width: `${Math.round(r >= 1 ? 16 : 16 * r)}px`, height: `${Math.round(r >= 1 ? 16 / r : 16)}px` } });
    if (!a.ratio) glyph.classList.add('orig');
    return h('button', { type: 'button', 'aria-pressed': 'false', title: a.label, onclick: () => up({ frame: { aspect: a.id } }) }, glyph, h('span', { text: a.label }));
  });
  const aspects = h('div.itp-aspects', { role: 'group', 'aria-label': 'Aspect ratio' }, ...aspectBtns);
  const fZoom = slider({ label: 'Crop Zoom', min: 1, max: 8, step: 0.05, value: 1, reset: 1, onInput: v => up({ frame: { zoom: v } }, 'fz'), onCommit: commit });
  const fX = slider({ label: 'Pan X', min: 0, max: 1, step: 0.01, scale: 100, value: 0.5, reset: 0.5, onInput: v => up({ frame: { x: v } }, 'fx'), onCommit: commit });
  const fY = slider({ label: 'Pan Y', min: 0, max: 1, step: 0.01, scale: 100, value: 0.5, reset: 0.5, onInput: v => up({ frame: { y: v } }, 'fy'), onCommit: commit });
  const secFrame = sec('frame', 'Aspect & Crop Frame', false, ['frame'], field('Aspect Ratio', aspects), fZoom.el, fX.el, fY.el);

  const pipelinePane = h('div', { id: 'pf-pane-pipeline', role: 'tabpanel' }, secSize.el, secPre.el, secClean.el, secFrame.el);

  // =========================================================== TAB 2: COLOR & FX
  const palSource = select({
    label: 'Palette Source',
    options: [
      { value: 'extract', label: 'Auto-Discover from Image' },
      { value: 'builtin', label: 'Hardware & Artist Library' },
      { value: 'custom', label: 'Custom / Harmony Swatches' },
      { value: 'none', label: 'Truecolor (24-bit Unquantized)' },
    ],
    onChange: v => up({ palette: { source: v } }),
  });
  const palAlgo = select({
    label: 'Discovery Engine',
    options: EXTRACT_ALGOS.map(a => ({ value: a.id, label: a.label })),
    help: 'OKLab Bayesian GMM fits diagonal covariance clusters via EM for rich accents without muddying.',
    onChange: v => up({ palette: { algo: v } }),
  });
  const palBuiltin = select({
    label: 'Library Palette',
    options: PALETTES.map(p => ({ value: p.id, label: `${p.name} (${p.colors.length})` })),
    onChange: v => up({ palette: { source: 'builtin', id: v } }),
  });
  const palCount = slider({ label: 'Target Colours', min: 2, max: 64, step: 1, value: 16, reset: 16, onInput: v => up({ palette: { count: v } }, 'count'), onCommit: commit });
  const swatches = h('div.itp-swatches', { role: 'list', 'aria-label': 'Active Swatches' });
  const swCount = h('span.val.num', {});
  const swatchField = field('Active Swatches (click = paint/edit)', swatches, { value: swCount });
  const palDistance = segmented({
    label: 'Quantizer Metric',
    options: [{ value: 'oklab', label: 'Perceptual OKLab' }, { value: 'rgb', label: 'Linear RGB' }],
    value: 'oklab',
    onChange: v => up({ palette: { distance: v } }),
  });
  const sortPalBtn = h('button.itp-btn.small.outline', {
    type: 'button',
    html: `${icon('sort')}<span>Sort Luma</span>`,
    title: 'Sort active palette from dark to light in perceptual OKLab space',
    onclick: () => {
      const s = S();
      const baseCols = s.palette.source === 'extract' ? (app.result?.palette || []) : s.palette.colors;
      if (baseCols.length < 2) return;
      up({ palette: { source: 'custom', name: `${s.palette.name || 'Palette'} (Sorted)`, colors: sortPaletteOKLab(baseCols) } });
      app.toast('Sorted swatches by perceptual OKLab lightness', { kind: 'ok', timeout: 1400 });
    },
  });
  const harmonyJumpBtn = h('button.itp-btn.small.outline', {
    type: 'button',
    html: `${icon('spark')}<span>Harmony</span>`,
    title: 'Open Procedural OKLab Color-Ramp Generator',
    onclick: () => app.openHarmonyLab?.(),
  });
  const palActions = h('div.itp-row', { style: { flexWrap: 'wrap' } },
    sortPalBtn,
    harmonyJumpBtn,
    h('button.itp-btn.small.outline', { type: 'button', html: `${icon('upload')}<span>Import</span>`, onclick: () => app.importPalette() }),
    h('button.itp-btn.small.outline', { type: 'button', html: `${icon('palette')}<span>Lospec</span>`, onclick: () => app.lospecDialog() }),
    h('button.itp-btn.small.outline', { type: 'button', html: `${icon('pipette')}<span>Pick</span>`, 'aria-pressed': 'false', onclick: e => app.togglePicker(e.currentTarget) }),
    h('button.itp-btn.small', { type: 'button', html: `${icon('save')}<span>Save</span>`, onclick: () => app.savePalette() }));
  const secPal = sec('palette', 'Palette & Bayesian Discovery', true, ['palette'], palSource.el, palAlgo.el, palBuiltin.el, palCount.el, swatchField, palDistance.el, palActions);

  // Dither (incl. Bayesian Posterior)
  const ditherGroups = {
    none: 'Clean Solid',
    posterior: 'Bayesian Perceptual',
    ordered: 'Ordered Matrix & Blue Noise',
    diffusion: 'Error Diffusion Kernels',
  };
  const dMethod = select({
    label: 'Dither Algorithm',
    options: DITHER_METHODS.map(m => ({ value: m.id, label: m.label, group: ditherGroups[m.kind] })),
    onChange: v => up({ dither: { method: v } }),
  });
  const dStrength = slider({ label: 'Dither Spread / Posterior Mix', min: 0, max: 1, step: 0.01, scale: 100, value: 0.6, reset: 0.6, onInput: v => up({ dither: { strength: v } }, 'strength'), onCommit: commit });
  const matrixText = h('textarea.itp-input', { rows: 4, spellcheck: false, 'aria-label': 'Custom threshold matrix', placeholder: '0 8 2 10\n12 4 14 6\n3 11 1 9\n15 7 13 5' });
  const matrixHelp = h('div.help', { text: 'Rows of numbers up to 16×16.' });
  matrixText.addEventListener('change', () => {
    try { up({ dither: { method: 'custom', matrix: parseMatrix(matrixText.value) } }); matrixHelp.textContent = 'Rows of numbers up to 16×16.'; matrixHelp.style.color = ''; }
    catch (e) { matrixHelp.textContent = e.message; matrixHelp.style.color = 'var(--danger)'; }
  });
  const matrixBox = h('div.itp-field', {}, h('div.lab', {}, h('span', { text: 'Custom Matrix' })), matrixText, matrixHelp);
  const secDither = sec('dither', 'Dithering & Posterior Blend', true, ['dither'], dMethod.el, dStrength.el, matrixBox);

  // 60-FPS GPU Screen Post-FX
  const fxMode = select({ label: 'GPU Screen Shader', options: FX_MODES.map(m => ({ value: m.id, label: m.label })), onChange: v => up({ fx: { mode: v } }) });
  const fxStrength = slider({ label: 'Shader Intensity', min: 0, max: 1, step: 0.01, scale: 100, value: 0.65, reset: 0.65, onInput: v => up({ fx: { strength: v } }, 'fxstr'), onCommit: commit });
  const fxScan = slider({ label: 'CRT Scanlines', min: 0, max: 1, step: 0.01, scale: 100, value: 0, reset: 0, onInput: v => up({ fx: { scanlines: v } }, 'fxscn'), onCommit: commit });
  const fxAberr = slider({ label: 'RGB Chromatic Shift (px)', min: 0, max: 3, step: 0.05, value: 0, reset: 0, onInput: v => up({ fx: { aberration: v } }, 'fxab'), onCommit: commit });
  const secFX = sec('fx', '60-FPS GPU Screen Post-FX', true, ['fx'], fxMode.el, fxStrength.el, fxScan.el, fxAberr.el);

  // Tone Grading
  const pct = { min: -1, max: 1, step: 0.01, scale: 100, value: 0, reset: 0 };
  const aBright = slider({ label: 'Exposure / Brightness', ...pct, onInput: v => up({ adjust: { brightness: v } }, 'br'), onCommit: commit });
  const aContrast = slider({ label: 'Contrast', ...pct, onInput: v => up({ adjust: { contrast: v } }, 'co'), onCommit: commit });
  const aSat = slider({ label: 'Vibrance / Saturation', ...pct, onInput: v => up({ adjust: { saturation: v } }, 'sa'), onCommit: commit });
  const aHue = slider({ label: 'Hue Rotation (°)', min: -180, max: 180, step: 1, value: 0, reset: 0, onInput: v => up({ adjust: { hue: v } }, 'hu'), onCommit: commit });
  const aGamma = slider({ label: 'Gamma Curve', min: 0.2, max: 3, step: 0.05, value: 1, reset: 1, onInput: v => up({ adjust: { gamma: v } }, 'ga'), onCommit: commit });
  const secTone = sec('tone', 'Tone & Colour Grading', false, null, aBright.el, aContrast.el, aSat.el, aHue.el, aGamma.el);

  const colorPane = h('div', { id: 'pf-pane-color', role: 'tabpanel', hidden: true }, secPal.el, secDither.el, secFX.el, secTone.el);

  // =========================================================== TAB 3: GAME & EXPORT
  const exMode = segmented({ label: 'Output Dimensions', options: [{ value: 'scale', label: 'Integer Scale' }, { value: 'source', label: 'Source Frame' }], value: 'scale', onChange: v => up({ export: { size: v } }) });
  const exScale = slider({ label: 'Integer Multiplier', min: 1, max: 32, step: 1, value: 4, reset: 4, help: 'Exact integer pixel upscaling for razor-sharp edges.', onInput: v => up({ export: { scale: v } }, 'scale'), onCommit: commit });
  const exSizeOut = h('span.val.num', {});
  const exGrid = toggle({ label: 'Burn 1px pixel grid into PNG', onChange: v => up({ export: { grid: v } }) });
  const exIndexed = toggle({ label: 'True Indexed PLTE PNG (≤256 colours)', onChange: v => up({ export: { indexed: v } }) });
  const btnPNG = h('button.itp-btn.primary.block', { type: 'button', html: `${icon('download')}<span>Download Crisp PNG</span>`, onclick: () => app.exportPNG() });
  const btnCopy = h('button.itp-btn.outline.block', { type: 'button', html: `${icon('copy')}<span>Copy PNG</span>`, onclick: () => app.copyImage() });
  const btnZip = h('button.itp-btn.outline.block', { type: 'button', html: `${icon('zip')}<span>Batch Export All as ZIP</span>`, onclick: () => app.exportZip() });
  const secImage = sec('image', 'PNG & Batch Export', true, ['export'], field('Final Resolution', h('div'), { value: exSizeOut }), exMode.el, exScale.el, exGrid.el, exIndexed.el, h('div.itp-grid2', {}, btnPNG, btnCopy), btnZip);

  // NEW: Live Mirror-Deduplicated Tileset Studio
  const tsSize = select({
    label: 'Tile Grid Dimension',
    options: [8, 12, 16, 24, 32, 48, 64].map(n => ({ value: String(n), label: `${n} × ${n} px` })),
    onChange: () => updateTilesetPreview(),
  });
  tsSize.set('16');
  const tsFlips = toggle({
    label: 'Mirror X/Y/XY Flip Deduplication',
    help: 'Detects horizontally & vertically mirrored tiles and stores flip flags in the JSON tilemap.',
    onChange: () => updateTilesetPreview(),
  });
  const tsStats = h('div.pf-ts-stats.mono', { text: 'Open an image to preview unique tiles' });
  const tsCanvas = h('canvas.pf-ts-canvas', { width: 128, height: 64 });
  const tsPreviewWrap = h('div.pf-ts-preview', {}, tsStats, tsCanvas);
  const btnTiles = h('button.itp-btn.primary.block', {
    type: 'button',
    html: `${icon('tiles')}<span>Export Deduplicated Tileset + JSON (.zip)</span>`,
    onclick: () => app.exportTileset({ tile: Number(tsSize.select.value), flips: tsFlips.el.querySelector('input').checked }),
  });
  const secTiles = sec('tileset', 'Live Tileset Deduplication Studio', true, null, tsSize.el, tsFlips.el, tsPreviewWrap, btnTiles);

  let lastResultForTiles = null;
  function updateTilesetPreview(res = lastResultForTiles) {
    lastResultForTiles = res;
    if (!res || !res.data || exportPane.hidden) return;
    const tw = Number(tsSize.select.value) || 16;
    const flips = tsFlips.el.querySelector('input').checked;
    try {
      const ts = buildTileset(res, { tileWidth: tw, tileHeight: tw, flips });
      const totalCells = ts.map.width * ts.map.height;
      const savedPct = totalCells > 0 ? Math.max(0, Math.round((1 - ts.count / totalCells) * 100)) : 0;
      tsStats.textContent = `${totalCells} map cells → ${ts.count} unique tiles (${savedPct}% VRAM saved)`;
      tsCanvas.width = ts.image.width;
      tsCanvas.height = ts.image.height;
      const g = tsCanvas.getContext('2d');
      g.putImageData(new ImageData(new Uint8ClampedArray(ts.image.data), ts.image.width, ts.image.height), 0, 0);
    } catch {
      tsStats.textContent = 'Tileset preview unavailable';
    }
  }

  // Video & Frame Animation
  let frameSelection = { active: false, complete: false, count: 0 };
  const anSource = select({ label: 'Animation Source', options: [{ value: 'video', label: 'Active Video Clip' }, { value: 'files', label: 'All Queued Images' }], onChange: () => syncAnim() });
  const anSelect = toggle({
    label: 'Interactive Storyboard Frame Picker',
    help: 'Pick & preview exact video frames on the main canvas before exporting.',
    onChange: enabled => {
      if (enabled) {
        anSource.set('video');
        const cur = app.current?.type === 'video' ? app.current : null;
        const untouched = cur && !anStart.input.dataset.touched && !anEnd.input.dataset.touched;
        if (untouched && isFullClipDefault(Number(anEnd.input.value) || 0, cur.duration)) {
          anStart.set(0); anEnd.set(Math.min(cur.duration, INITIAL_INTERVAL_SECONDS));
        }
      }
      app.setFrameSelection(enabled);
    },
  });
  const anFormat = select({
    label: 'Container Format',
    options: [
      { value: 'gif', label: 'Animated GIF (256-colour LZW)' },
      { value: 'mp4', label: 'MP4 Video (WebCodecs H.264)' },
      { value: 'webm', label: 'WebM Video (WebCodecs VP9)' },
      { value: 'png-seq', label: 'Numbered PNG Sequence (.zip)' },
    ],
    onChange: () => syncAnim(),
  });
  const anFps = numberInput({ label: 'Frame Rate (FPS)', min: 1, max: 60, onChange: v => { anFps.input.dataset.touched = '1'; app.setAnimationFps?.(v); } });
  const changeAnimRange = () => {
    anStart.input.dataset.touched = '1'; anEnd.input.dataset.touched = '1';
    app.setFrameRange?.(Number(anStart.input.value) || 0, Number(anEnd.input.value) || 0);
  };
  const anStart = numberInput({ label: 'Trim Start (s)', min: 0, max: 36000, step: 0.001, onChange: changeAnimRange });
  const anEnd = numberInput({ label: 'Trim End (s)', min: 0, max: 36000, step: 0.001, onChange: changeAnimRange });
  const anSize = select({
    label: 'Video Upscale Target',
    options: [
      { value: '1080', label: '1080p Full HD (Integer Crisp)' },
      { value: '720', label: '720p HD' },
      { value: '2160', label: '4K Ultra HD' },
      { value: 'scale', label: 'Match PNG Scale' },
    ],
    onChange: () => {},
  });
  anSize.set('1080');
  const anAudio = toggle({ label: 'Mux source audio track', onChange: () => syncAnim() });
  const anAudioInput = anAudio.el.querySelector('input');
  const anNote = h('div.help', {});
  const btnAnim = h('button.itp-btn.primary.block', { type: 'button', html: `${icon('film')}<span>Render Animation</span>`, onclick: () => app.exportAnimation(animOpts()) });
  const secAnim = sec('animation', 'Video & Frame Animation', false, null, anSource.el, anSelect.el, anFormat.el, anFps.el, h('div.itp-grid2', {}, anStart.el, anEnd.el), anSize.el, anAudio.el, anNote, btnAnim);
  anFps.set(12); anStart.set(0); anEnd.set(0); anAudio.set(true);
  const animOpts = () => ({
    source: anSource.select.value, format: anFormat.select.value,
    fps: Number(anFps.input.value) || 12,
    start: Number(anStart.input.value) || 0, end: Number(anEnd.input.value) || 0,
    rangeTouched: !!(anStart.input.dataset.touched || anEnd.input.dataset.touched),
    audio: anAudioInput.checked, videoSize: anSize.select.value,
  });

  // Sprite Sheet + TexturePacker Atlas
  const shCols = numberInput({ label: 'Grid Columns', min: 0, max: 256, help: '0 = auto-square packing.', onChange: () => {} });
  const shPad = numberInput({ label: 'Cell Padding (px)', min: 0, max: 64, onChange: () => {} });
  shCols.set(0); shPad.set(0);
  const btnSheet = h('button.itp-btn.outline.block', {
    type: 'button',
    html: `${icon('sheet')}<span>Export Sprite Sheet + JSON Atlas (.zip)</span>`,
    onclick: () => app.exportSheet({ ...animOpts(), columns: Number(shCols.input.value) || 0, padding: Number(shPad.input.value) || 0 }),
  });
  const secSheet = sec('sheet', 'Sprite Sheet & JSON Atlas', false, null,
    h('div.help', { text: 'Packs animation frames into a single PNG + TexturePacker / Aseprite compatible JSON hash atlas.' }),
    h('div.itp-grid2', {}, shCols.el, shPad.el), btnSheet);

  // Preset / Share Link I/O
  const secSettings = sec('settings', 'Share & Preset JSON', false, null,
    h('div.itp-grid2', {},
      h('button.itp-btn.outline', { type: 'button', html: `${icon('link')}<span>Share URL</span>`, onclick: () => app.copyLink() }),
      h('button.itp-btn.outline', { type: 'button', html: `${icon('braces')}<span>Save JSON</span>`, onclick: () => app.saveSettingsFile() })),
    h('button.itp-btn.outline.block', { type: 'button', html: `${icon('upload')}<span>Load Settings JSON</span>`, onclick: () => app.loadSettingsFile() }));

  const exportPane = h('div', { id: 'pf-pane-export', role: 'tabpanel', hidden: true }, secImage.el, secTiles.el, secAnim.el, secSheet.el, secSettings.el);

  // ---- Footer
  const foot = h('div.itp-insp-foot', {},
    h('button.itp-link', { type: 'button', text: 'Reset Pipeline', onclick: () => app.resetSettings() }),
    h('span.pf-engine-tag', { id: 'itp-backend' }));

  const body = h('div.itp-panel-body', {}, pipelinePane, colorPane, exportPane);
  const el = h('aside.itp-insp.pf-inspector', { 'aria-label': 'Workstation Inspector' },
    h('div.itp-insp-head', {},
      h('div.pf-telemetry-card', {}, histCanvas, stats),
      snapBar,
      scopeRow,
      tabs),
    body,
    foot);

  let activeTab = 'pipeline';
  function setTab(t) {
    if (t === 'setup') t = 'pipeline';
    activeTab = t;
    const isP = t === 'pipeline', isC = t === 'color', isE = t === 'export';
    tabPipeline.setAttribute('aria-selected', String(isP));
    tabColor.setAttribute('aria-selected', String(isC));
    tabExport.setAttribute('aria-selected', String(isE));
    pipelinePane.hidden = !isP;
    colorPane.hidden = !isC;
    exportPane.hidden = !isE;
    if (isE) { syncAnim(); updateTilesetPreview(); }
  }
  tabPipeline.onclick = () => setTab('pipeline');
  tabColor.onclick = () => setTab('color');
  tabExport.onclick = () => setTab('export');

  function syncAnim() {
    const cur = app.current?.type === 'video' ? app.current : null;
    const hasVideo = !!cur;
    const nImages = app.items.filter(i => i.type === 'image').length;
    if (!hasVideo && anSource.select.value === 'video' && nImages > 1) anSource.set('files');
    if (hasVideo && anSource.select.value === 'files' && nImages < 2) anSource.set('video');
    const src = anSource.select.value;
    const ok = src === 'video' ? hasVideo : nImages > 1;
    const selecting = frameSelection.active;
    anSelect.el.hidden = !cur;
    anSelect.set(selecting);
    anSource.select.disabled = selecting;
    anStart.el.hidden = anEnd.el.hidden = src !== 'video';
    btnAnim.disabled = btnSheet.disabled = !ok || (selecting && (!frameSelection.complete || !frameSelection.count));
    btnPNG.disabled = btnCopy.disabled = btnTiles.disabled = selecting;
    if (cur && !Number(anEnd.input.value)) anEnd.set(Math.round((cur.duration || 0) * 10) / 10);
    if (cur && cur.fps && !anFps.input.dataset.touched) anFps.set(Math.min(30, Math.round(cur.fps)));
    app.setAnimationFps?.(Number(anFps.input.value) || 12);
    const f = anFormat.select.value;
    const isVideo = f === 'mp4' || f === 'webm';
    anAudio.el.hidden = selecting || !(src === 'video' && isVideo);
    anSize.el.hidden = !isVideo;
    const vs = app.videoSupport;
    const noAudio = vs && 'opus' in vs && anAudioInput.checked && !anAudio.el.hidden && !(f === 'mp4' ? vs.aac || vs.opus : vs.opus);
    const selectionNote = selecting ? !frameSelection.complete ? 'Decoding video frames…'
      : !frameSelection.count ? 'Click frames on the storyboard canvas to include them.'
      : `${frameSelection.count} frames selected at ${Number(anFps.input.value) || 12} fps.` : '';
    const formatNote = !ok
      ? (src === 'video' ? 'Import a video clip (or 2+ images) to render animations.' : 'Import 2+ images to animate them.')
      : isVideo && !vs?.[f] ? `${f.toUpperCase()} WebCodecs encoder unavailable in this browser; GIF and PNG sequence work everywhere.`
      : noAudio ? 'Audio encoding unavailable in this browser; video will export silent.'
      : '';
    anNote.textContent = [selectionNote, formatNote].filter(Boolean).join(' ');
  }
  anFps.input.addEventListener('change', syncAnim);

  function renderSwatches(colors, editable) {
    const activeBrush = (app.brushColor?.() || '').toLowerCase();
    render(swatches, ...colors.map((c, i) => {
      const hex = c.startsWith('#') ? c : `#${c}`;
      const isBrush = hex.toLowerCase() === activeBrush;
      const b = h('button.itp-swatch', {
        type: 'button',
        role: 'listitem',
        'data-brush': isBrush ? 'true' : null,
        title: editable
          ? `${hex} · Click to set paint colour (Double-click to edit swatch, Alt+Click to remove)`
          : `${hex} · Click to set paint colour (Double-click to customize palette)`,
        style: { background: hex },
      });
      b.addEventListener('click', e => {
        if (editable && e.altKey) {
          const next = S().palette.colors.filter((_, j) => j !== i);
          if (next.length) up({ palette: { colors: next } });
          return;
        }
        app.setBrushColor?.(hex);
        renderSwatches(colors, editable);
      });
      b.addEventListener('dblclick', () => {
        if (!editable) {
          up({ palette: { source: 'custom', colors: colors.slice(), name: `${S().palette.name || 'Palette'} (Custom)` } });
          app.toast('Converted to custom editable palette');
          return;
        }
        const inp = h('input', { type: 'color', value: hex, style: { position: 'fixed', opacity: 0, pointerEvents: 'none' } });
        document.body.append(inp);
        inp.addEventListener('input', () => {
          const next = S().palette.colors.slice();
          next[i] = inp.value;
          app.setBrushColor?.(inp.value);
          up({ palette: { colors: next } }, 'sw' + i);
        });
        inp.addEventListener('change', () => inp.remove());
        inp.click();
      });
      return b;
    }), editable ? h('button.itp-swatch.add', {
      type: 'button', 'aria-label': 'Add colour', title: 'Append swatch', html: icon('plus'),
      onclick: () => up({ palette: { colors: [...S().palette.colors, app.brushColor?.() || '#14f195'] } }),
    }) : null);
  }

  let lastPaletteKey = '';
  let lastShownSwatches = [];
  let lastEditableSwatches = false;

  function sync(s, result) {
    syncSnapshots();

    sizeMode.set(s.size.mode);
    widthBox.hidden = s.size.mode !== 'width';
    blockBox.hidden = s.size.mode !== 'block';
    width.set(s.size.width); height.set(s.size.height || ''); block.set(s.size.block); resample.set(s.size.resample);
    secSize.setHint(result ? `${result.width} × ${result.height}` : '');

    aKuwahara.set(s.adjust.kuwahara || 0);
    aSvd.set(s.adjust.svd || 0);
    aClahe.set(s.adjust.clahe || 0);
    const preHints = [
      s.adjust.kuwahara > 0 ? `Brush ${s.adjust.kuwahara}` : '',
      s.adjust.svd > 0.001 ? `SVD ${Math.round(s.adjust.svd * 100)}%` : '',
      s.adjust.clahe > 0.001 ? `CLAHE ${Math.round(s.adjust.clahe * 100)}%` : '',
    ].filter(Boolean);
    secPre.setHint(preHints.join(' · '));

    palSource.set(s.palette.source);
    palAlgo.set(s.palette.algo || 'oklab-bgm');
    palBuiltin.set(s.palette.id);
    palBuiltin.el.hidden = s.palette.source !== 'builtin';
    palAlgo.el.hidden = palCount.el.hidden = s.palette.source !== 'extract';
    palCount.set(s.palette.count);
    palDistance.set(s.palette.distance);
    palDistance.el.hidden = s.palette.source === 'none';
    swatchField.hidden = s.palette.source === 'none';
    const shown = s.palette.source === 'extract' ? (result && result.palette) || [] : s.palette.colors;
    lastShownSwatches = shown;
    lastEditableSwatches = s.palette.source === 'custom';
    const key = s.palette.source + shown.join() + '|' + (app.brushColor?.() || '');
    if (key !== lastPaletteKey) { lastPaletteKey = key; renderSwatches(shown, lastEditableSwatches); }
    swCount.textContent = String(shown.length);
    secPal.setHint(s.palette.source === 'none' ? 'Truecolor' : s.palette.name);

    dMethod.set(s.dither.method); dStrength.set(s.dither.strength);
    const kind = ditherKind(s.dither.method);
    dStrength.el.hidden = kind === 'none';
    matrixBox.hidden = s.dither.method !== 'custom';
    if (s.dither.method === 'custom' && document.activeElement !== matrixText) matrixText.value = (s.dither.matrix || []).map(r => r.join(' ')).join('\n');
    secDither.setHint(s.palette.source === 'none' ? 'Needs palette' : (DITHER_METHODS.find(m => m.id === s.dither.method)?.label || s.dither.method));
    secDither.el.querySelector('select').disabled = s.palette.source === 'none';

    aBright.set(s.adjust.brightness); aContrast.set(s.adjust.contrast); aSat.set(s.adjust.saturation); aHue.set(s.adjust.hue); aGamma.set(s.adjust.gamma);
    const toneChanged = s.adjust.brightness || s.adjust.contrast || s.adjust.saturation || s.adjust.hue || s.adjust.gamma !== 1;
    secTone.setHint(toneChanged ? 'Active' : '');

    const fx = s.fx || DEF.fx;
    fxMode.set(fx.mode); fxStrength.set(fx.strength); fxScan.set(fx.scanlines); fxAberr.set(fx.aberration);
    fxStrength.el.hidden = fx.mode === 'none';
    const fxParts = [
      fx.mode !== 'none' ? (FX_MODES.find(m => m.id === fx.mode)?.label || fx.mode) : '',
      fx.scanlines > 0 ? 'Scanlines' : '',
      fx.aberration > 0 ? 'RGB Shift' : '',
    ].filter(Boolean);
    secFX.setHint(fxParts.length ? fxParts.join(' · ') : 'Off');
    secFX.setChanged(!same(fx, DEF.fx));

    aspectBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(ASPECTS[i].id === s.frame.aspect)));
    fZoom.set(s.frame.zoom); fX.set(s.frame.x); fY.set(s.frame.y);
    const cur = app.current;
    const crop = cur ? cropRect(cur.width, cur.height, s.frame) : null;
    fX.el.hidden = !crop || crop.w >= cur.width;
    fY.el.hidden = !crop || crop.h >= cur.height;
    const framed = s.frame.aspect !== 'original' || s.frame.zoom > 1;
    secFrame.setHint(!framed ? '' : [s.frame.aspect !== 'original' ? s.frame.aspect : '', s.frame.zoom > 1 ? `${Math.round(s.frame.zoom * 100) / 100}×` : ''].filter(Boolean).join(', '));
    secFrame.setChanged(!same(s.frame, DEF.frame));

    const many = app.items.length > 1;
    scopeRow.hidden = !(cur && (many || cur.own));
    scope.set(cur && cur.own ? 'own' : 'shared');
    const nShared = app.items.filter(i => !i.own).length;
    scopeNote.textContent = cur && cur.own ? 'Only this source' : `${nShared} ${nShared === 1 ? 'source' : 'sources'}`;
    el.dataset.scope = cur && cur.own ? 'own' : 'shared';

    alphaCut.set(s.alpha.threshold); orphans.set(s.cleanup.orphans); smooth.set(s.cleanup.smooth);
    olMode.set(s.outline.mode); olColor.set(s.outline.color); olCorners.set(s.outline.corners);
    olColor.el.hidden = olCorners.el.hidden = s.outline.mode === 'none';
    const cl = [s.cleanup.orphans && 'orphans', s.cleanup.smooth && 'smooth', s.outline.mode !== 'none' && s.outline.mode].filter(Boolean);
    secClean.setHint(cl.join(' · '));

    secSize.setChanged(!same(s.size, DEF.size));
    secPal.setChanged(!same(s.palette, DEF.palette));
    secDither.setChanged(!same(s.dither, DEF.dither));
    secClean.setChanged(!same([s.cleanup, s.outline, s.alpha], [DEF.cleanup, DEF.outline, DEF.alpha]));
    secImage.setChanged(!same(s.export, DEF.export));

    exScale.set(s.export.scale); exGrid.set(s.export.grid); exIndexed.set(s.export.indexed); exMode.set(s.export.size);
    exScale.el.hidden = exGrid.el.hidden = s.export.size === 'source';
    const out = exportSize(s, result, app.current);
    exSizeOut.textContent = result ? `${out.width} × ${out.height} px` : '–';
    btnZip.hidden = app.items.length < 2;
    btnZip.querySelector('span').textContent = `Batch Export All ${app.items.length} Sources (.zip)`;
    syncAnim();
    if (activeTab === 'export' && result) updateTilesetPreview(result);
    else lastResultForTiles = result;
  }

  function setStats(result) {
    drawHistogram(result);
    if (!result) {
      statSize.textContent = statColors.textContent = statTime.textContent = '–';
      return;
    }
    statSize.innerHTML = `${result.width}<small>× ${result.height}</small>`;
    const used = result.usedColors().length;
    statColors.innerHTML = result.palette ? `${used}<small>/ ${result.palette.length}</small>` : `${used}`;
    statTime.innerHTML = `${result.ms < 10 ? result.ms.toFixed(1) : Math.round(result.ms)}<small>ms</small>`;
    statTime.parentElement.title = result.backend === 'webgl' ? 'WebGL 2 GPU Shader Pipeline' : 'CPU Reference Pipeline';
    if (activeTab === 'export') updateTilesetPreview(result);
    else lastResultForTiles = result;
  }

  return {
    el,
    sync,
    setStats,
    setTab,
    syncAnim,
    syncSnapshots,
    refreshSwatches() { renderSwatches(lastShownSwatches, lastEditableSwatches); },
    animationOptions: animOpts,
    setFrameSelectionState(state) { frameSelection = state; syncAnim(); },
    setAnimationRange({ start, end, user = false }) {
      anStart.set(Number(start.toFixed(3))); anEnd.set(Number(end.toFixed(3)));
      if (user) { anStart.input.dataset.touched = '1'; anEnd.input.dataset.touched = '1'; }
    },
  };
}
