// PixelForge Studio Workstation UI.
// Mounts the complete GPU/CPU pixel-art workstation inside `root`:
// - Top Command Deck (Forge Emblem, Active Source, 5-Mode Multi-Viewport Switcher, Loupe, Grid, Export)
// - Far-Left Pro Tool Rail (Drawer Toggles + 7 Non-Destructive Pixel Retouch Tools + Paint Well)
// - Left Collapsible Asset & OKLab Harmony Drawer
// - Center Multi-Mode Viewport + Signature Preset Ribbon + Contextual Pixel Retouch Sub-Bar
// - Right 3-Tab Scientific & Game-Asset Inspector (Live RGB/Luma Histogram, 4 Style Snapshots, Live Tileset Studio)

import { createPixelator } from '../core/engine.js';
import { defaultSettings, decodeSettings, encodeSettings, settingsToJSON, settingsFromJSON, mergeSettings } from '../core/settings.js';
import { parsePalette, toGPL, toHexFile, toPaletteJSON } from '../core/palette/parse.js';
import { fetchLospec } from '../core/palette/lospec.js';
import { detectGrid, uniqueColors } from '../core/export/scale.js';
import { toCanvas, downloadBlob } from '../core/export/canvas.js';
import { encodePNG } from '../core/export/png.js';
import { toHex } from '../core/color.js';
import { estimateFps, videoReady, seekTo, sniffVideoCodec, hasAudioTrack } from '../core/video/frames.js';
import { PRESETS } from '../core/presets.js';
import { h, render, pickFiles } from './dom.js';
import { icon, FORGE_LOGO_SVG } from './icons.js';
import { createStore } from './store.js';
import { createStage } from './stage.js';
import { createInspector } from './inspector.js';
import { createLibrary, fmtTime } from './library.js';
import { createExporter } from './exporter.js';
import { createVideoStoryboard } from './storyboard.js';
import { createTimelinePreview } from './timeline-preview.js';
import { toast, menu, closeMenu, dialog } from './ui.js';
import { SAMPLES, findSample, loadSample, sampleURL } from './samples.js';
import * as persist from './persist.js';
import { saveWorkspace, loadWorkspace, forgetWorkspace, isQuotaError, fmtBytes } from './workspace.js';

const IMAGE_TYPES = /^image\//;
const VIDEO_TYPES = /^video\//;
const PALETTE_EXT = /\.(gpl|hex|pal|txt|json)$/i;
const QUAD_FALLBACK_PRESETS = ['hybrid-crisp', 'bgm-posterior', 'kurzgesagt', 'crt-arcade'];

export async function mountEditor(root, options = {}) {
  const usePersist = options.persist !== false;
  const narrow = () => matchMedia('(max-width: 940px)').matches;

  let initial = options.settings || (usePersist && persist.load('settings', null)) || defaultSettings();
  if (/[#&]s=/.test(location.hash)) {
    try { initial = decodeSettings(location.hash); }
    catch { toast('Share link could not be decoded; loaded your previous settings', { kind: 'error' }); }
  }
  const store = createStore(initial);

  const app = {
    store,
    engine: null,
    items: [],
    current: null,
    baseResult: null,
    result: null,
    exporting: false,
    activePreset: null,
    snapshots: usePersist ? persist.load('snapshots_v2', [null, null, null, null]) : [null, null, null, null],
    activeSnapshot: null,
    userPalettes: usePersist ? persist.load('palettes', []) : [],
    shared: store.settings,
    clipboard: null,
    videoSupport: { mp4: false, webm: false },
    toast: (m, o) => toast(m, o),
  };

  // ================================================================ NON-DESTRUCTIVE PIXEL RETOUCH ENGINE
  function ensureEdits(item, w, h) {
    if (!item.edits || item.edits.w !== w || item.edits.h !== h) {
      item.edits = {
        w, h,
        mask: new Uint8Array(w * h),          // 0 = generated, 1 = painted RGBA, 2 = erased transparent
        rgba: new Uint8ClampedArray(w * h * 4),
        visible: true,
        count: 0,
        undo: [],
        redo: [],
      };
    }
    return item.edits;
  }

  function recountEdits(ed) {
    let n = 0;
    for (let i = 0; i < ed.mask.length; i++) if (ed.mask[i] !== 0) n++;
    ed.count = n;
  }

  function snapshotEditLayer(ed) {
    ed.undo.push({ mask: ed.mask.slice(), rgba: ed.rgba.slice(), count: ed.count });
    if (ed.undo.length > 60) ed.undo.shift();
    ed.redo.length = 0;
  }

  function composeWithEdits(baseRes, item) {
    const ed = item && item.edits;
    if (!baseRes || !ed || !ed.visible || !ed.count || ed.w !== baseRes.width || ed.h !== baseRes.height) {
      return baseRes;
    }
    const data = new Uint8ClampedArray(baseRes.data);
    for (let i = 0; i < ed.mask.length; i++) {
      const m = ed.mask[i];
      if (m === 1) {
        const o = i * 4;
        data[o] = ed.rgba[o]; data[o + 1] = ed.rgba[o + 1]; data[o + 2] = ed.rgba[o + 2]; data[o + 3] = 255;
      } else if (m === 2) {
        const o = i * 4;
        data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
      }
    }
    return {
      ...baseRes,
      data,
      usedColors() { return uniqueColors(this); },
      toImageData() { return new ImageData(new Uint8ClampedArray(this.data), this.width, this.height); },
      toCanvas(scale = 1, opts = {}) { return toCanvas(this, scale, opts); },
      toPNG(opts = {}) { return encodePNG(this, opts); },
      async toBlob(opts = {}) { return new Blob([await encodePNG(this, opts)], { type: 'image/png' }); },
    };
  }

  function refreshCompositeFast() {
    const item = app.current;
    if (!item || !app.baseResult) return;
    const res = composeWithEdits(app.baseResult, item);
    app.result = res;
    res.toCanvas(1, { canvas: outCanvas });
    stage.show(outCanvas, item.source, res.crop, res.data);
    updateStats(res);
    syncPaintBar();
    updateStatus();
  }

  function handleStrokeStart() {
    const item = app.current, base = app.baseResult;
    if (!item || !base) return;
    const ed = ensureEdits(item, base.width, base.height);
    snapshotEditLayer(ed);
  }

  function handleStrokePoints(tool, pts, rgb) {
    const item = app.current, base = app.baseResult;
    if (!item || !base) return;
    const ed = ensureEdits(item, base.width, base.height);
    ed.visible = true;
    let changed = false;
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= ed.w || y >= ed.h) continue;
      const i = y * ed.w + x, o = i * 4;
      if (tool === 'eraser') {
        // First erase pass removes painted stroke back to generated pixel; second pass punches transparent
        if (ed.mask[i] === 1) { ed.mask[i] = 0; changed = true; }
        else if (ed.mask[i] === 0 && base.data[o + 3] > 0) { ed.mask[i] = 2; changed = true; }
      } else {
        if (ed.mask[i] !== 1 || ed.rgba[o] !== rgb[0] || ed.rgba[o + 1] !== rgb[1] || ed.rgba[o + 2] !== rgb[2]) {
          ed.mask[i] = 1;
          ed.rgba[o] = rgb[0]; ed.rgba[o + 1] = rgb[1]; ed.rgba[o + 2] = rgb[2]; ed.rgba[o + 3] = 255;
          changed = true;
        }
      }
    }
    if (changed) {
      recountEdits(ed);
      refreshCompositeFast();
    }
  }

  function handleStrokeEnd() {
    library.refresh();
  }

  function handleBucket({ x, y, color, global }) {
    const item = app.current, base = app.baseResult, cur = app.result;
    if (!item || !base || !cur) return;
    const w = cur.width, hgt = cur.height;
    if (x < 0 || y < 0 || x >= w || y >= hgt) return;
    const d = cur.data;
    const to = (y * w + x) * 4;
    const tr = d[to], tg = d[to + 1], tb = d[to + 2], ta = d[to + 3] >= 128 ? 255 : 0;
    if (ta === 255 && tr === color[0] && tg === color[1] && tb === color[2]) return;

    const ed = ensureEdits(item, w, hgt);
    snapshotEditLayer(ed);
    ed.visible = true;

    const matches = idx => {
      const o = idx * 4;
      const a = d[o + 3] >= 128 ? 255 : 0;
      if (ta === 0) return a === 0;
      return a === 255 && d[o] === tr && d[o + 1] === tg && d[o + 2] === tb;
    };

    if (global) {
      for (let i = 0; i < w * hgt; i++) {
        if (matches(i)) {
          const o = i * 4;
          ed.mask[i] = 1;
          ed.rgba[o] = color[0]; ed.rgba[o + 1] = color[1]; ed.rgba[o + 2] = color[2]; ed.rgba[o + 3] = 255;
        }
      }
    } else {
      const seen = new Uint8Array(w * hgt);
      const stack = [y * w + x];
      seen[y * w + x] = 1;
      while (stack.length) {
        const idx = stack.pop();
        const o = idx * 4;
        ed.mask[idx] = 1;
        ed.rgba[o] = color[0]; ed.rgba[o + 1] = color[1]; ed.rgba[o + 2] = color[2]; ed.rgba[o + 3] = 255;
        const px = idx % w, py = (idx / w) | 0;
        if (px > 0 && !seen[idx - 1] && matches(idx - 1)) { seen[idx - 1] = 1; stack.push(idx - 1); }
        if (px + 1 < w && !seen[idx + 1] && matches(idx + 1)) { seen[idx + 1] = 1; stack.push(idx + 1); }
        if (py > 0 && !seen[idx - w] && matches(idx - w)) { seen[idx - w] = 1; stack.push(idx - w); }
        if (py + 1 < hgt && !seen[idx + w] && matches(idx + w)) { seen[idx + w] = 1; stack.push(idx + w); }
      }
    }
    recountEdits(ed);
    refreshCompositeFast();
    library.refresh();
  }

  function undoEditStroke() {
    const ed = app.current?.edits;
    if (!ed || !ed.undo.length) return false;
    ed.redo.push({ mask: ed.mask.slice(), rgba: ed.rgba.slice(), count: ed.count });
    const prev = ed.undo.pop();
    ed.mask = prev.mask; ed.rgba = prev.rgba; ed.count = prev.count;
    refreshCompositeFast();
    library.refresh();
    return true;
  }

  function redoEditStroke() {
    const ed = app.current?.edits;
    if (!ed || !ed.redo.length) return false;
    ed.undo.push({ mask: ed.mask.slice(), rgba: ed.rgba.slice(), count: ed.count });
    const next = ed.redo.pop();
    ed.mask = next.mask; ed.rgba = next.rgba; ed.count = next.count;
    refreshCompositeFast();
    library.refresh();
    return true;
  }

  function clearEdits() {
    const ed = app.current?.edits;
    if (!ed || !ed.count) return;
    snapshotEditLayer(ed);
    ed.mask.fill(0);
    ed.rgba.fill(0);
    ed.count = 0;
    refreshCompositeFast();
    library.refresh();
    toast('Cleared manual pixel retouch layer');
  }

  function toggleEditsVisible() {
    const ed = app.current?.edits;
    if (!ed || !ed.count) return;
    ed.visible = !ed.visible;
    refreshCompositeFast();
  }

  // ================================================================ STAGE, DRAWER, INSPECTOR, EXPORTER
  const stage = createStage({
    onPick: pickAt,
    onViewChange: () => { updateZoomLabel(); syncViewModeBar(); },
    onToolSample: (hex, appendToPalette) => {
      setBrushColor(hex);
      if (appendToPalette) {
        const s = store.settings;
        const cols = s.palette.source === 'custom' ? s.palette.colors : (app.result?.palette || []);
        if (!cols.includes(hex)) {
          store.update({ palette: { source: 'custom', name: 'Picked Custom', colors: [...cols, hex] } });
          toast(`Sampled & added ${hex} to palette`, { kind: 'ok', timeout: 1400 });
          return;
        }
      }
      toast(`Active paint colour: ${hex}`, { timeout: 1100 });
    },
    onStrokeStart: handleStrokeStart,
    onStrokePoints: handleStrokePoints,
    onStrokeEnd: handleStrokeEnd,
    onBucket: handleBucket,
  });

  app.brushColor = () => stage.brushColor;
  app.activeTool = () => stage.tool;

  const inspector = createInspector(app);
  const library = createLibrary(app);
  const exporter = createExporter(app);

  function setBrushColor(hex) {
    stage.setBrushColor(hex);
    railColorWell.style.background = hex;
    railColorInput.value = hex;
    inspector.refreshSwatches();
    syncPaintBar();
  }
  app.setBrushColor = setBrushColor;

  app.openHarmonyLab = () => {
    library.setTab('palettes');
    if (shell.dataset.lib !== 'open') togglePanel('lib');
  };

  // ================================================================ 4 STYLE SNAPSHOT SLOTS & 4-UP ARENA
  const clone = v => JSON.parse(JSON.stringify(v));

  app.handleSnapshot = (idx, { overwrite = false, clear = false } = {}) => {
    const letter = String.fromCharCode(65 + idx);
    if (clear) {
      app.snapshots[idx] = null;
      if (app.activeSnapshot === idx) app.activeSnapshot = null;
      if (usePersist) persist.save('snapshots_v2', app.snapshots);
      inspector.syncSnapshots();
      if (stage.mode === 'quad') refreshQuadArena();
      toast(`Cleared Snapshot ${letter}`);
      return;
    }
    const existing = app.snapshots[idx];
    if (!existing || overwrite) {
      const pName = app.activePreset ? (PRESETS.find(p => p.id === app.activePreset)?.name || 'Custom') : `${store.settings.size.width}px ${store.settings.dither.method}`;
      app.snapshots[idx] = { label: pName, settings: clone(store.settings) };
      app.activeSnapshot = idx;
      if (usePersist) persist.save('snapshots_v2', app.snapshots);
      inspector.syncSnapshots();
      if (stage.mode === 'quad') refreshQuadArena();
      toast(`Saved current look to Snapshot ${letter}`, { kind: 'ok', timeout: 1500 });
    } else {
      app.activeSnapshot = idx;
      store.replace(existing.settings, 'snapshot');
      inspector.syncSnapshots();
      toast(`Recalled Snapshot ${letter} (${existing.label})`, { timeout: 1400 });
    }
  };

  let quadGen = 0;
  async function refreshQuadArena() {
    const gen = ++quadGen;
    const item = app.current;
    if (!item || !app.engine || stage.mode !== 'quad') return;
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const snap = app.snapshots[i];
      const fallback = PRESETS.find(p => p.id === QUAD_FALLBACK_PRESETS[i]) || PRESETS[i];
      const cfg = snap ? snap.settings : mergeSettings(defaultSettings(), fallback.settings);
      const label = snap ? `Snap ${String.fromCharCode(65 + i)}: ${snap.label}` : fallback.name;
      const sub = `${cfg.size.width}px · ${cfg.dither.method}`;
      slots.push({
        id: i,
        label,
        sub,
        settings: cfg,
        active: app.activeSnapshot === i || (!snap && app.activePreset === fallback.id),
        canvas: null,
        onSelect: () => {
          if (snap) app.activeSnapshot = i;
          else app.activePreset = fallback.id;
          store.replace(cfg, snap ? 'snapshot' : 'preset');
          toast(`Loaded ${label}`, { kind: 'ok', timeout: 1300 });
        },
      });
    }
    stage.setQuadSlots(slots);
    for (const sl of slots) {
      if (gen !== quadGen || stage.mode !== 'quad') return;
      try {
        const r = await app.engine.process(item.source, sl.settings);
        if (gen !== quadGen || stage.mode !== 'quad') return;
        sl.canvas = r.toCanvas(1);
        stage.setQuadSlots(slots);
      } catch { /* ignore */ }
    }
  }

  app.openQuadArena = () => setViewMode('quad');

  // ================================================================ TOP COMMAND DECK
  const btn = (ic, label, onclick, extra = {}) =>
    h('button.itp-btn.icon', { type: 'button', 'aria-label': label, title: label, html: icon(ic), onclick, ...extra });

  const brand = h('a.itp-brand', { href: options.homeHref || '#', title: 'PixelForge Studio Home' },
    h('span', { html: FORGE_LOGO_SVG }),
    h('span.hide-sm', { text: 'PixelForge' }),
    h('span.pf-studio-tag.hide-sm', { text: 'WORKSTATION' }));
  if (!options.homeHref) brand.addEventListener('click', e => e.preventDefault());

  const fileName = h('span.name', { text: 'No source loaded' });
  fileName.addEventListener('click', () => { if (app.current) startRename(app.current); });
  const fileMeta = h('span.meta.num', {});

  const scenicBtn = options.samples === false ? null : h('button.itp-btn.outline.small.hide-sm', {
    type: 'button',
    'aria-haspopup': 'menu',
    title: 'Quick-load a real scenic view photograph or starter sprite',
    html: `${icon('image')}<span>Scenic Photos</span>${icon('chevronDown')}`,
    onclick: e => scenicMenu(e.currentTarget),
  });

  // 5-Mode Multi-Viewport Switcher
  const vmDefs = [
    { id: 'single', label: 'Single', icon: 'viewSingle', title: 'Single Pixel Canvas (1)' },
    { id: 'split', label: 'Curtain', icon: 'compare', title: 'Interactive Before/After Split Curtain (2 or C)' },
    { id: 'dual', label: 'Dual Sync', icon: 'viewDual', title: 'Synchronized Side-by-Side Source & Output (3)' },
    { id: 'quad', label: '4-Up', icon: 'viewQuad', title: '4-Up Snapshot & Preset Comparison Arena (4)' },
    { id: 'tile', label: '3×3 Tile', icon: 'viewTile', title: '3×3 Seamless Tilemap & Seam Checker (5)' },
  ];
  const vmBtns = vmDefs.map(m => ({
    id: m.id,
    el: h('button.pf-vm-btn', {
      type: 'button', 'aria-pressed': String(m.id === 'single'), title: m.title,
      html: `${icon(m.icon)}<span>${m.label}</span>`,
      onclick: () => setViewMode(m.id),
    }),
  }));
  const splitAxisBtn = h('button.pf-vm-btn.pf-vm-axis', {
    type: 'button', hidden: true, title: 'Flip split curtain between Vertical and Horizontal',
    html: icon('viewSplitH'),
    onclick: () => {
      const next = stage.splitAxis === 'v' ? 'h' : 'v';
      stage.setSplitAxis(next);
      splitAxisBtn.innerHTML = icon(next === 'v' ? 'viewSplitH' : 'compare');
    },
  });
  const viewModeBar = h('div.pf-viewmodes.hide-sm', { role: 'group', 'aria-label': 'Viewport Mode' },
    ...vmBtns.map(b => b.el), splitAxisBtn);

  function setViewMode(mode) {
    if (storyboard.active) return;
    stage.setMode(mode);
    syncViewModeBar();
    if (mode === 'quad') refreshQuadArena();
  }
  function syncViewModeBar() {
    for (const b of vmBtns) b.el.setAttribute('aria-pressed', String(stage.mode === b.id));
    splitAxisBtn.hidden = stage.mode !== 'split';
  }

  const undoBtn = btn('undo', 'Undo (Ctrl+Z)', () => { if (!undoEditStroke()) store.undo(); });
  const redoBtn = btn('redo', 'Redo (Ctrl+Shift+Z)', () => { if (!redoEditStroke()) store.redo(); });
  const loupeBtn = btn('loupe', '12× Pixel Loupe Magnifier (L)', () => toggleLoupe(), { 'aria-pressed': 'false' });
  const gridBtn = btn('grid', '1px & 16×16 Tile Grid (G)', () => toggleGrid(), { 'aria-pressed': 'false' });
  const zoomBtn = h('button.itp-btn.itp-zoom.num', { type: 'button', 'aria-label': 'Zoom', 'aria-haspopup': 'menu', html: `<span>Fit</span>${icon('chevronDown')}`, onclick: e => zoomMenu(e.currentTarget) });
  const themeBtn = btn('moon', 'Toggle Dark / Light Theme (T)', () => toggleTheme());
  const helpBtn = btn('keyboard', 'Workstation Shortcuts (?)', () => showHelp());
  const inspBtn = btn('sidebarRight', 'Toggle Inspector (/)', () => togglePanel('insp'));
  const saveBtn = h('button.itp-btn.outline', { type: 'button', title: 'Save workspace locally in IndexedDB', html: `${icon('save')}<span class="hide-sm">Save</span>`, onclick: () => saveNow() });
  saveBtn.hidden = !usePersist;
  const exportBtn = h('button.itp-btn.primary', { type: 'button', 'aria-haspopup': 'menu', html: `${icon('download')}<span>Export</span>`, onclick: e => exportMenu(e.currentTarget) });

  const top = h('header.itp-top', {},
    brand,
    h('div.itp-file', {}, fileName, fileMeta),
    scenicBtn,
    h('div.spacer'),
    viewModeBar,
    h('div.spacer'),
    h('span.hide-sm.contents', {}, undoBtn, redoBtn, h('span.sep')),
    loupeBtn, gridBtn, zoomBtn,
    h('span.sep.hide-sm'),
    h('span.hide-sm.contents', {}, themeBtn, helpBtn),
    inspBtn,
    saveBtn, exportBtn);

  // ================================================================ FAR-LEFT PRO TOOL RAIL
  const railFileBadge = h('span.pf-rail-badge', { hidden: true });
  const drawerTabs = [
    { id: 'files', icon: 'files', title: 'Sources & Scenic Photos (\\)' },
    { id: 'presets', icon: 'presets', title: '20 Live Presets Gallery' },
    { id: 'palettes', icon: 'palette', title: 'Palettes & OKLab Harmony Generator' },
  ].map(d => {
    const b = h('button.pf-rail-btn.drawer-tab', {
      type: 'button', 'aria-label': d.title, title: d.title, 'aria-pressed': 'false',
      html: icon(d.icon),
      onclick: () => {
        if (shell.dataset.lib === 'open' && library.tab === d.id) togglePanel('lib');
        else {
          library.setTab(d.id);
          if (shell.dataset.lib !== 'open') togglePanel('lib');
        }
        syncRail();
      },
    });
    if (d.id === 'files') b.append(railFileBadge);
    return { id: d.id, el: b };
  });
  library.onTabChange(() => syncRail());

  const TOOL_DEFS = [
    { id: 'pan', label: 'Navigate / Pan', kbd: 'V', icon: 'hand' },
    { id: 'pencil', label: 'Pixel Pencil', kbd: 'B', icon: 'pencil' },
    { id: 'eraser', label: 'Pixel Eraser', kbd: 'E', icon: 'eraser' },
    { id: 'bucket', label: 'Flood Fill / Color Swap', kbd: 'K', icon: 'bucket' },
    { id: 'line', label: '1px Bresenham Line', kbd: 'U', icon: 'line' },
    { id: 'rect', label: '1px Pixel Rectangle', kbd: 'R', icon: 'rect' },
    { id: 'eyedropper', label: 'Smart Eyedropper', kbd: 'I', icon: 'pipette' },
  ];
  const toolBtns = TOOL_DEFS.map(t => ({
    ...t,
    el: h('button.pf-rail-btn', {
      type: 'button',
      'aria-label': `${t.label} (${t.kbd})`,
      title: `${t.label} (${t.kbd}) · Hold Space to pan`,
      'aria-pressed': String(t.id === 'pan'),
      html: icon(t.icon),
      onclick: () => selectTool(t.id),
    }),
  }));

  function selectTool(toolId) {
    if (stage.picking) togglePicker();
    if (toolId !== 'pan' && (stage.mode === 'split' || stage.mode === 'quad')) {
      setViewMode('single');
    }
    stage.setTool(toolId);
    syncRail();
    syncPaintBar();
  }

  const railColorInput = h('input', { type: 'color', value: stage.brushColor, 'aria-label': 'Active Paint Colour' });
  railColorInput.addEventListener('input', () => setBrushColor(railColorInput.value));
  const railColorWell = h('label.pf-rail-color', {
    title: 'Active Pixel Paint Colour (Click to pick, or click any palette swatch)',
    style: { background: stage.brushColor },
  }, railColorInput);

  const railBrushSizeBtn = h('button.pf-rail-bsize', {
    type: 'button', title: 'Cycle Pixel Brush Size (1px – 4px)', text: '1px',
    onclick: () => {
      const next = (stage.brushSize % 4) + 1;
      stage.setBrushSize(next);
      railBrushSizeBtn.textContent = `${next}px`;
      syncPaintBar();
    },
  });

  const rail = h('nav.pf-rail', { 'aria-label': 'Workstation Tools' },
    ...drawerTabs.map(d => d.el),
    h('span.pf-rail-sep'),
    ...toolBtns.map(t => t.el),
    h('div.pf-rail-spacer'),
    railColorWell,
    railBrushSizeBtn);

  function syncRail() {
    const libOpen = shell.dataset.lib === 'open';
    for (const d of drawerTabs) d.el.setAttribute('aria-pressed', String(libOpen && library.tab === d.id));
    for (const t of toolBtns) t.el.setAttribute('aria-pressed', String(stage.tool === t.id));
    railFileBadge.hidden = app.items.length === 0;
    railFileBadge.textContent = String(app.items.length);
  }

  // ================================================================ SIGNATURE PRESET RIBBON & PIXEL RETOUCH SUB-BAR
  const QUICK_IDS = ['hybrid-crisp', 'bgm-posterior', 'svd-cel', 'kurzgesagt', 'crt-arcade', 'chunky-ink', 'pc98-cyber', 'voxel-3d', 'oscilloscope-xy', 'cyber-blueprint', 'pico-8', 'game-boy'];
  const QUICK_SWATCH = {
    'hybrid-crisp': ['#14f195', '#38bdf8', '#f4b860', '#1d3557'],
    'bgm-posterior': ['#0f172a', '#0284c7', '#14f195', '#fbbf24'],
    'svd-cel': ['#1e293b', '#38bdf8', '#34d399', '#fde047'],
    'oscilloscope-xy': ['#04160e', '#0c5c30', '#14f576', '#a8ffd2'],
    'cyber-blueprint': ['#091c3d', '#1c4d8c', '#5cd6ff', '#ebfbff'],
  };
  const quickChips = QUICK_IDS.map(id => {
    const p = PRESETS.find(x => x.id === id);
    if (!p) return null;
    const ps = mergeSettings(defaultSettings(), p.settings);
    const cols = (ps.palette.colors.length ? ps.palette.colors : (QUICK_SWATCH[id] || ['#14f195', '#38bdf8', '#f59e0b', '#0f172a'])).slice(0, 5);
    const sw = h('span.pf-qsw', {}, ...cols.map(c => h('i', { style: { background: c } })));
    const b = h('button.pf-qchip', { type: 'button', 'aria-pressed': 'false', title: p.description, onclick: () => app.applyPreset(p) }, sw, h('span', { text: p.name }));
    return { id, b };
  }).filter(Boolean);
  const syncQuickBar = () => { for (const q of quickChips) q.b.setAttribute('aria-pressed', String(app.activePreset === q.id)); };
  const morePresetsBtn = h('button.pf-qchip.more', {
    type: 'button',
    title: `Browse all ${PRESETS.length} categorized presets`,
    onclick: () => { library.setTab('presets'); if (shell.dataset.lib !== 'open') togglePanel('lib'); syncRail(); },
  }, h('span', { text: `All ${PRESETS.length}…` }));
  const quickBar = h('div.pf-quickbar', { role: 'toolbar', 'aria-label': 'Signature Presets' },
    h('span.pf-qlabel.hide-sm', { text: 'Looks' }),
    ...quickChips.map(q => q.b),
    morePresetsBtn);

  // Contextual Pixel Retouch Bar (shown when drawing tool active or manual edits exist)
  const paintBar = h('div.pf-paintbar', { hidden: true });
  function syncPaintBar() {
    const ed = app.current?.edits;
    const hasEdits = !!(ed && ed.count > 0);
    const activeTool = stage.tool;
    if (activeTool === 'pan' && !hasEdits) {
      paintBar.hidden = true;
      return;
    }
    paintBar.hidden = false;
    const tDef = TOOL_DEFS.find(t => t.id === activeTool) || TOOL_DEFS[0];
    const palCols = (store.settings.palette.source === 'extract' ? (app.result?.palette || []) : store.settings.palette.colors).slice(0, 16);

    const sizeBtns = [1, 2, 3, 4].map(n => h('button', {
      type: 'button', 'aria-pressed': String(stage.brushSize === n), text: `${n}px`,
      onclick: () => { stage.setBrushSize(n); railBrushSizeBtn.textContent = `${n}px`; syncPaintBar(); },
    }));

    const bucketModeBtn = activeTool === 'bucket' ? h('button.itp-btn.small.outline', {
      type: 'button', 'aria-pressed': String(stage.bucketGlobal),
      text: stage.bucketGlobal ? 'Mode: Global Colour Swap' : 'Mode: Contiguous Fill (Shift = Global)',
      onclick: () => { stage.setBucketGlobal(!stage.bucketGlobal); syncPaintBar(); },
    }) : null;

    const swStrip = palCols.length ? h('div.pf-paint-swatches', {},
      ...palCols.map(c => {
        const hex = c.startsWith('#') ? c : `#${c}`;
        return h('button', {
          type: 'button',
          style: { background: hex },
          'aria-pressed': String(hex.toLowerCase() === stage.brushColor.toLowerCase()),
          title: `Paint with ${hex}`,
          onclick: () => setBrushColor(hex),
        });
      })) : null;

    const editControls = hasEdits ? h('div.pf-paint-meta', {},
      h('span.mono', { text: `${ed.count}px retouched${ed.visible ? '' : ' (hidden)'}` }),
      h('button.itp-btn.small.icon', { type: 'button', title: 'Undo pixel stroke', html: icon('undo'), disabled: !ed.undo.length, onclick: () => undoEditStroke() }),
      h('button.itp-btn.small.icon', { type: 'button', title: ed.visible ? 'Hide manual edits' : 'Show manual edits', html: icon(ed.visible ? 'eye' : 'eyeOff'), onclick: () => toggleEditsVisible() }),
      h('button.itp-btn.small.icon.danger', { type: 'button', title: 'Clear all manual pixel edits', html: icon('trash'), onclick: () => clearEdits() }))
      : h('div.pf-paint-meta.muted', { text: 'Alt+Click samples colour · Hold Space to pan' });

    render(paintBar,
      h('span.pf-paint-tooltag', { html: `${icon(tDef.icon)}<span>${tDef.label}</span>` }),
      (activeTool === 'pencil' || activeTool === 'eraser' || activeTool === 'line' || activeTool === 'rect') ? h('div.pf-paint-sizes', {}, ...sizeBtns) : null,
      bucketModeBtn,
      swStrip,
      editControls);
  }

  // ================================================================ STAGE OVERLAYS & VIDEO TRANSPORT
  const sampleButtons = options.samples === false ? null : h('div.samples', {},
    ...SAMPLES.map(s => h('button', {
      type: 'button', title: `Load "${s.name}"`, onclick: () => openSample(s),
    }, h('img', { src: sampleURL(s), alt: '' }), h('span', { text: s.name }))));

  const empty = h('div.itp-empty', {}, h('div.itp-drop', {},
    h('span', { html: FORGE_LOGO_SVG }),
    h('h2', { text: 'Drop a photograph, sprite, or video into PixelForge Workstation' }),
    h('p', { text: 'Real-time WebGL 2 Hybrid Bimodal-Plateau resampling, OKLab Bayesian GMM palette discovery, Posterior dithering, non-destructive pixel retouch tools & live deduplicated tileset export.' }),
    h('div.actions', {},
      h('button.itp-btn.primary', { type: 'button', html: `${icon('upload')}<span>Import Media</span>`, onclick: () => openFiles() }),
      h('button.itp-btn.outline', { type: 'button', html: `${icon('clipboard')}<span>Paste Clipboard</span>`, onclick: () => pasteFromClipboard() })),
    sampleButtons ? h('p', { style: { fontSize: 'var(--fs-xs)', color: 'var(--faint)' }, text: 'Or launch immediately with a real scenic view photograph' }) : null,
    sampleButtons));

  const status = h('div.itp-float.bl', { 'aria-live': 'polite' });
  const busy = h('div.itp-busy.itp-float', { hidden: true, style: { padding: '6px 10px', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-xs)', color: 'var(--muted)', display: 'flex' } }, h('span.itp-spinner'), h('span', { text: 'Processing' }));
  const viewTools = h('div.itp-float.br', {},
    btn('zoomOut', 'Zoom out (-)', () => stage.zoomOut()),
    btn('fit', 'Fit to view (F)', () => stage.fit()),
    btn('zoomIn', 'Zoom in (+)', () => stage.zoomIn()));
  stage.el.append(empty, status, busy, viewTools);

  // Video Transport
  const playBtn = btn('play', 'Play (Space)', () => togglePlay());
  const timeLabel = h('span.itp-time', {});
  const scrub = h('input.itp-scrub', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Video position' });
  const fpsLabel = h('span.muted.num', { style: { fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' } });
  const sound = { muted: persist.load('muted', true) !== false, volume: Number(persist.load('volume', 1)) };
  if (!(sound.volume >= 0 && sound.volume <= 1)) sound.volume = 1;
  const muteBtn = btn('volumeOff', 'Volume (M mutes)', () => toggleVolPop(), { 'aria-haspopup': 'true', 'aria-expanded': 'false' });
  const volFill = h('div.fill');
  const volThumb = h('div.thumb');
  const volSlider = h('div.itp-vslider', { role: 'slider', tabindex: '0', 'aria-label': 'Volume', 'aria-orientation': 'vertical', 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div.track', {}, volFill, volThumb));
  const volValue = h('span.num', {});
  const volPop = h('div.itp-volpop', { hidden: true }, volValue, volSlider);
  const soundBox = h('div.itp-sound', { hidden: true }, volPop, muteBtn);
  const setLevel = v => setSound(v <= 0.005 ? { muted: true } : { muted: false, volume: Math.min(1, v) });
  const levelAt = e => { const r = volSlider.querySelector('.track').getBoundingClientRect(); return Math.max(0, Math.min(1, (r.bottom - e.clientY) / r.height)); };
  volSlider.addEventListener('pointerdown', e => {
    e.preventDefault(); volSlider.focus(); volSlider.setPointerCapture(e.pointerId);
    const before = sound.muted ? 0 : sound.volume;
    setLevel(levelAt(e));
    const move = ev => setLevel(levelAt(ev));
    const up = () => {
      volSlider.removeEventListener('pointermove', move); volSlider.removeEventListener('pointerup', up); volSlider.removeEventListener('pointercancel', up);
      if (sound.muted && before > 0) setSound({ muted: true, volume: before });
    };
    volSlider.addEventListener('pointermove', move); volSlider.addEventListener('pointerup', up); volSlider.addEventListener('pointercancel', up);
  });
  volSlider.addEventListener('wheel', e => { e.preventDefault(); setLevel((sound.muted ? 0 : sound.volume) - Math.sign(e.deltaY) * 0.05); }, { passive: false });
  function toggleVolPop(open = volPop.hidden) {
    volPop.hidden = !open;
    muteBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      const close = e => { if (!soundBox.contains(e.target)) { toggleVolPop(false); document.removeEventListener('pointerdown', close, true); } };
      document.addEventListener('pointerdown', close, true);
    }
  }
  const transport = h('div.itp-transport', { role: 'group', 'aria-label': 'Video' },
    btn('stepBack', 'Previous frame (,)', () => stepFrame(-1)), playBtn, btn('stepForward', 'Next frame (.)', () => stepFrame(1)),
    timeLabel, scrub, soundBox, fpsLabel);

  let statsResult = null;
  function updateStats(res) {
    if (res === statsResult) return false;
    statsResult = res;
    inspector.setStats(res);
    return true;
  }

  const timelinePreview = createTimelinePreview(app);
  const storyboard = createVideoStoryboard(app, {
    onModeChange: active => {
      timelinePreview.hide();
      quickBar.hidden = active;
      if (active) paintBar.hidden = true; else syncPaintBar();
      stage.el.hidden = active;
      transport.hidden = active;
      loupeBtn.disabled = gridBtn.disabled = active;
      if (!active) { stage.resize(); schedule(); }
      updateZoomLabel();
    },
    onZoomChange: updateZoomLabel,
    onRangeChange: range => inspector.setAnimationRange(range),
    onSelectionChange: state => {
      inspector.setFrameSelectionState(state);
      const res = state.active ? state.result : app.result;
      if (updateStats(res) && res && state.active) inspector.sync(store.settings, res);
    },
    animationOptions: () => inspector.animationOptions(),
  });
  app.setFrameSelection = enabled => storyboard.setMode(enabled);
  app.setFrameRange = (start, end) => storyboard.setRange(start, end);
  app.setAnimationFps = fps => storyboard.setPlaybackFps(fps);
  app.frameSelection = () => storyboard.exportSelection();
  const previewResult = () => (storyboard.active ? storyboard.currentResult() : app.result);

  const stageWrap = h('main.itp-stage', { 'data-video': 'false' }, quickBar, paintBar, stage.el, storyboard.el, transport, storyboard.transport, timelinePreview.el);
  timelinePreview.bind(scrub);
  timelinePreview.bind(storyboard.range, { getFrame: storyboard.frameCanvas });

  stageWrap.addEventListener('pointerdown', () => { if (narrow() && shell.dataset.lib === 'open') { togglePanel('lib'); syncRail(); } }, true);

  const shell = h('div.itp.itp-app.pf-workstation', {
    'data-lib': narrow() ? 'closed' : persist.load('lib', 'open'),
    'data-insp': persist.load('insp', 'open'),
  }, top, rail, library.el, stageWrap, inspector.el);

  render(root, shell);
  applyTheme(persist.load('theme', null));
  syncRail();

  // ================================================================ ENGINE BOOT
  status.textContent = 'Initializing GPU pipeline…';
  try {
    app.engine = await createPixelator();
  } catch (e) {
    toast(`Engine startup failed: ${e.message}`, { kind: 'error' });
    throw e;
  }
  const backendBadge = inspector.el.querySelector('#itp-backend');
  backendBadge.textContent = app.engine.backend === 'webgl' ? 'WebGL 2 GPU' : 'CPU Core';
  backendBadge.title = app.engine.backend === 'webgl' ? `WebGL 2: ${app.engine.renderer}` : (app.engine.fallbackReason || 'CPU Reference Pipeline');
  import('../video.js').then(m => m.videoSupport()).then(v => { app.videoSupport = v; }).catch(() => {});

  // ================================================================ RENDERING LOOP
  let dirty = false, running = false;
  const outCanvas = document.createElement('canvas');

  function schedule() {
    dirty = true;
    if (!running) requestAnimationFrame(run);
  }
  app.schedule = schedule;

  async function run() {
    if (running || !dirty) return;
    if (app.exporting || storyboard.active) return;
    dirty = false;
    const item = app.current;
    if (!item) { app.baseResult = app.result = null; stage.clear(); updateStatus(); return; }
    running = true;
    const slow = setTimeout(() => { busy.hidden = false; }, 250);
    try {
      if (item.type === 'video') app.engine.invalidate();
      const baseRes = await app.engine.process(item.source, store.settings);
      if (item !== app.current || storyboard.active) return;
      app.baseResult = baseRes;
      const res = composeWithEdits(baseRes, item);
      app.result = res;
      res.toCanvas(1, { canvas: outCanvas });
      stage.show(outCanvas, item.source, res.crop, res.data);
      updateStats(res);
      inspector.sync(store.settings, res);
      syncPaintBar();
      updateStatus();
      if (stage.mode === 'quad') refreshQuadArena();
    } catch (e) {
      console.error(e);
      toast(`Rendering failed: ${e.message}`, { kind: 'error' });
    } finally {
      clearTimeout(slow); busy.hidden = true;
      running = false;
      if (dirty) requestAnimationFrame(run);
    }
  }

  function updateStatus() {
    const r = app.result, it = app.current;
    fileName.textContent = it ? it.name : 'No source loaded';
    fileMeta.textContent = it ? (it.type === 'video' ? `${it.width} × ${it.height} · ${fmtTime(it.duration)}` : `${it.width} × ${it.height}`) : '';
    empty.hidden = !!it;
    viewTools.hidden = !it;
    const ed = it?.edits;
    undoBtn.disabled = !(store.canUndo || (ed && ed.undo.length));
    redoBtn.disabled = !(store.canRedo || (ed && ed.redo.length));
    if (!it || !r) { status.hidden = true; return; }
    status.hidden = false;
    const used = r.usedColors();
    const msTxt = `${r.ms < 10 ? r.ms.toFixed(1) : Math.round(r.ms)} ms`;
    const swStrip = h('span.pf-hud-swatches.hide-sm', { title: `${used.length} active colours (click to set paint colour, Shift+Click copies hex)` },
      ...used.slice(0, 20).map(hex => h('button', {
        type: 'button',
        style: { background: hex },
        title: `${hex} (Click = paint colour, Shift+Click = copy)`,
        onclick: e => {
          e.stopPropagation();
          setBrushColor(hex);
          if (e.shiftKey) navigator.clipboard?.writeText(hex).then(() => toast(`Copied ${hex}`, { kind: 'ok', timeout: 1100 })).catch(() => {});
        },
      })));
    render(status,
      h('span.pf-gpu-pill', { text: r.backend === 'webgl' ? `WebGL 2 · ${msTxt}` : `CPU · ${msTxt}` }),
      h('span', {}, h('b', { text: `${r.width} × ${r.height}` }), ' px'),
      h('span.hide-sm', { text: `${Math.round(stage.zoom * 100) / 100}×` }),
      swStrip);
  }

  function updateZoomLabel() {
    const view = storyboard.active ? storyboard : stage;
    zoomBtn.querySelector('span').textContent = !app.current || view.fitted ? 'Fit' : view.zoom >= 1 ? `${Math.round(view.zoom * 10) / 10}×` : `${Math.round(view.zoom * 100)}%`;
    if (app.result) updateStatus();
  }

  store.subscribe((s, why) => {
    const cur = app.current;
    if (cur && cur.own && store.target === cur.id) cur.own = s;
    else if (store.target === 'shared') app.shared = s;
    inspector.sync(s, previewResult());
    if (why !== 'preset') app.activePreset = null;
    if (why !== 'snapshot') app.activeSnapshot = null;
    syncQuickBar();
    inspector.syncSnapshots();
    if (usePersist) saveSoon();
    if (library.tab === 'palettes') library.refresh();
    timelinePreview.reset();
    storyboard.refresh();
    schedule();
  });
  let saveT = null;
  const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(() => persist.save('settings', app.shared), 300); };

  // ================================================================ MEDIA & QUEUE MANAGEMENT
  async function makeThumb(drawable, w, hgt) {
    const c = document.createElement('canvas');
    const k = 76 / Math.max(w, hgt);
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(hgt * k));
    try { c.getContext('2d').drawImage(drawable, 0, 0, c.width, c.height); } catch { /* video seeking */ }
    return c.toDataURL();
  }

  async function addImage(name, drawable, file = null) {
    const w = drawable.naturalWidth || drawable.width, hh = drawable.naturalHeight || drawable.height;
    const item = { id: crypto.randomUUID?.() || String(Math.random()), name, type: 'image', source: drawable, width: w, height: hh, file, edits: null };
    item.thumb = await makeThumb(drawable, w, hh);
    app.items.push(item);
    syncRail();
    return item;
  }

  async function addVideo(name, file) {
    const video = h('video', { muted: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
    video.muted = true;
    video.src = URL.createObjectURL(file);
    try {
      await videoReady(video);
    } catch (e) {
      URL.revokeObjectURL(video.src);
      if (e.code === 3 || e.code === 4) {
        const codec = await sniffVideoCodec(file).catch(() => '');
        const alt = codec === 'H.264' ? 'WebM (VP9)' : codec === 'VP9' ? 'H.264 MP4' : 'H.264 MP4 or WebM (VP9)';
        const err = new Error(codec ? `Unsupported ${codec} stream; re-encode as ${alt}.` : `Unsupported video codec; re-encode as ${alt}.`);
        err.code = e.code;
        throw err;
      }
      throw e;
    }
    const item = { id: crypto.randomUUID?.() || String(Math.random()), name, type: 'video', source: video, width: video.videoWidth, height: video.videoHeight, duration: video.duration, fps: 30, file, edits: null };
    await seekTo(video, Math.min(0.05, video.duration / 2)).catch(() => {});
    item.thumb = await makeThumb(video, item.width, item.height);
    app.items.push(item);
    syncRail();
    item.fpsReady = estimateFps(video, 30).catch(() => 30).then(f => { item.fps = f; item.fpsReady = null; if (app.current === item) updateTransport(); inspector.syncAnim(); });
    hasAudioTrack(file).then(a => { item.hasAudio = a; if (app.current === item) updateTransport(); });
    video.addEventListener('timeupdate', () => { if (app.current === item) updateTransport(); });
    video.addEventListener('play', () => { if (app.current === item) { updateTransport(); pumpVideo(item); } });
    video.addEventListener('pause', () => { if (app.current === item) { updateTransport(); schedule(); } });
    video.addEventListener('seeked', () => { if (app.current === item && !app.exporting) schedule(); });
    video.addEventListener('ended', () => {
      if (app.current !== item || app.exporting || item.fpsReady || storyboard.active) return;
      video.currentTime = 0;
      video.play().catch(() => {});
    });
    return item;
  }

  async function addFiles(files) {
    const media = [], palettes = [], settingsFiles = [];
    for (const f of files) {
      if (PALETTE_EXT.test(f.name) && !/^image|^video/.test(f.type)) {
        if (/\.json$/i.test(f.name)) settingsFiles.push(f); else palettes.push(f);
      } else if (IMAGE_TYPES.test(f.type) || VIDEO_TYPES.test(f.type) || /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|webm|mov)$/i.test(f.name)) media.push(f);
    }
    for (const f of palettes) await importPaletteFile(f);
    for (const f of settingsFiles) {
      const text = await f.text();
      try {
        const obj = JSON.parse(text);
        if (obj.colors || Array.isArray(obj)) await importPaletteFile(f, text);
        else { store.replace(settingsFromJSON(obj)); toast(`Loaded settings from ${f.name}`, { kind: 'ok' }); }
      } catch (e) { toast(`${f.name}: ${e.message}`, { kind: 'error' }); }
    }
    let first = null;
    const t = media.length > 2 ? toast(`Importing ${media.length} sources`, { progress: true }) : null;
    for (let i = 0; i < media.length; i++) {
      const f = media[i];
      try {
        let item;
        if (VIDEO_TYPES.test(f.type) || /\.(mp4|webm|mov)$/i.test(f.name)) item = await addVideo(f.name, f);
        else {
          let drawable;
          try { drawable = await createImageBitmap(f); } catch {
            drawable = new Image(); drawable.src = URL.createObjectURL(f); await drawable.decode();
          }
          item = await addImage(f.name, drawable, f);
        }
        first ||= item;
      } catch (e) { toast(`${f.name}: ${e.message}`, { kind: 'error' }); }
      t?.progress((i + 1) / media.length);
    }
    t?.close();
    if (first) select(first);
    library.refresh();
    syncRail();
    if (media.length > 1) toast(`Queued ${media.length} sources under shared pipeline`, { kind: 'ok' });
  }
  app.addFiles = addFiles;

  async function openFiles() {
    const files = await pickFiles({ accept: 'image/*,video/*,.gpl,.hex,.pal,.txt,.json', multiple: true });
    if (files.length) addFiles(files);
  }
  app.openFiles = openFiles;

  async function openSample(sampleOrId) {
    const s = typeof sampleOrId === 'string' ? findSample(sampleOrId) : (sampleOrId || SAMPLES[0]);
    const existing = app.items.find(it => it.sampleId === s.id);
    if (existing) { select(existing); return existing; }
    const url = sampleURL(s);
    const img = await loadSample(s);
    const ext = s.photo ? 'jpg' : 'svg';
    const filename = `${s.id}.${ext}`;
    let file = null;
    try {
      if (s.photo) {
        const resp = await fetch(url);
        if (resp.ok) file = new File([await resp.blob()], filename, { type: 'image/jpeg' });
      } else if (s.svg) {
        file = new File([s.svg], filename, { type: 'image/svg+xml' });
      }
    } catch { /* fallback */ }
    const item = await addImage(filename, img, file);
    item.sampleId = s.id;
    select(item);
    library.refresh();
    return item;
  }
  app.openSample = openSample;

  function scenicMenu(anchor) {
    menu(anchor, [
      { group: 'Real Scenic View Photographs' },
      ...SAMPLES.filter(s => s.photo).map(s => ({ label: s.name, sub: s.subtitle, icon: 'image', onClick: () => openSample(s) })),
      'sep',
      { group: 'Reference Sprites & Tiles' },
      ...SAMPLES.filter(s => !s.photo).map(s => ({ label: s.name, sub: s.subtitle, icon: 'presets', onClick: () => openSample(s) })),
    ]);
  }

  async function pasteFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      const files = [];
      for (const it of items) for (const type of it.types) if (IMAGE_TYPES.test(type)) {
        const b = await it.getType(type);
        files.push(new File([b], `pasted-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${type.split('/')[1]}`, { type }));
      }
      if (files.length) addFiles(files); else toast('Clipboard contains no image data', { kind: 'error' });
    } catch {
      toast('Press Ctrl+V (⌘V) directly to paste an image');
    }
  }
  app.pasteFromClipboard = pasteFromClipboard;

  function select(item) {
    if (app.current && app.current.type === 'video' && app.current !== item) app.current.source.pause();
    app.current = item;
    timelinePreview.reset();
    storyboard.setItem(item);
    editTarget(item);
    stageWrap.dataset.video = String(item && item.type === 'video');
    if (item && item.type === 'video') updateTransport();
    stage.clear();
    app.baseResult = app.result = null;
    if (stage.picking) togglePicker();
    library.refresh();
    library.sourceChanged();
    syncPaintBar();
    schedule();
    updateStatus();
  }
  app.select = select;

  function removeItem(item) {
    const i = app.items.indexOf(item);
    if (i < 0) return;
    app.items.splice(i, 1);
    store.dropTarget(item.id);
    if (item.type === 'video') { item.source.pause(); URL.revokeObjectURL(item.source.src); }
    if (item.source.close && !app.items.some(x => x.source === item.source)) item.source.close();
    if (app.current === item) select(app.items[Math.min(i, app.items.length - 1)] || null);
    library.refresh();
    syncRail();
    inspector.sync(store.settings, previewResult());
  }
  app.removeItem = removeItem;
  app.clearItems = () => { for (const it of app.items.slice()) removeItem(it); };

  // ================================================================ PER-FILE PIPELINE SCOPE
  const settingsFor = item => (item === app.current ? store.settings : (item && item.own) || app.shared);
  app.settingsFor = settingsFor;

  function editTarget(item, force = false) {
    const key = item && item.own ? item.id : 'shared';
    if (store.target === key && !force) return;
    store.setTarget(key, key === 'shared' ? app.shared : item.own);
  }

  function setOwn(item, own, { quiet = false } = {}) {
    if (!item || !!item.own === own) return;
    if (own) {
      item.own = clone(settingsFor(item));
      if (item === app.current) editTarget(item);
      if (!quiet) toast(`${item.name} now uses independent pipeline settings`);
    } else {
      const was = item.own;
      item.own = null;
      store.dropTarget(item.id);
      if (item === app.current) editTarget(item);
      if (!quiet) toast(`${item.name} relinked to shared pipeline`, { action: { label: 'Undo', onClick: () => { item.own = was; if (item === app.current) editTarget(item); afterScopeChange(); } } });
    }
    afterScopeChange();
  }
  function afterScopeChange() {
    library.refresh();
    const res = previewResult();
    inspector.sync(store.settings, res);
    if (res) updateStats(res);
    schedule();
  }
  app.setOwn = setOwn;

  app.copySettings = item => {
    app.clipboard = clone(settingsFor(item));
    toast(`Copied settings from ${item.name}`, { timeout: 1600 });
    library.refresh();
  };
  app.pasteSettings = item => {
    if (!app.clipboard) return;
    if (!item.own) setOwn(item, true, { quiet: true });
    if (item === app.current) store.replace(app.clipboard, 'paste');
    else item.own = clone(app.clipboard);
    toast(`Applied settings to ${item.name}`, { kind: 'ok', timeout: 1600 });
    afterScopeChange();
  };
  app.applyToAll = item => {
    const snapshot = { shared: app.shared, own: new Map(app.items.map(i => [i, i.own])) };
    app.shared = clone(settingsFor(item));
    for (const it of app.items) { if (it.own) store.dropTarget(it.id); it.own = null; }
    store.setTarget('shared', app.shared);
    if (usePersist) saveSoon();
    toast(`Broadcast ${item.name} settings to all sources`, {
      action: { label: 'Undo', onClick: () => {
        app.shared = snapshot.shared;
        for (const [it, own] of snapshot.own) it.own = own;
        editTarget(app.current, true);
        afterScopeChange();
      } },
    });
    afterScopeChange();
  };
  app.duplicate = async item => {
    const nameCopy = name => { const m = /^(.*?)(\.[^.]*)?$/.exec(name); return `${m[1]} copy${m[2] || ''}`; };
    let copy;
    if (item.type === 'video') copy = await addVideo(nameCopy(item.name), item.file);
    else copy = await addImage(nameCopy(item.name), item.source, item.file);
    app.items.splice(app.items.indexOf(copy), 1);
    app.items.splice(app.items.indexOf(item) + 1, 0, copy);
    copy.own = clone(settingsFor(item));
    select(copy);
    toast(`Duplicated ${item.name} with independent settings`, { timeout: 2200 });
  };
  app.move = (item, dir) => {
    const i = app.items.indexOf(item), j = i + dir;
    if (i < 0 || j < 0 || j >= app.items.length) return;
    [app.items[i], app.items[j]] = [app.items[j], app.items[i]];
    library.refresh();
  };

  // Rename
  const splitExt = name => { const m = /^(.*?)(\.[^.\s]{1,5})?$/.exec(name); return [m[1], m[2] || '']; };
  app.rename = (item, next) => {
    const [, ext] = splitExt(item.name);
    let base = String(next || '').trim().replace(/[\\/:*?"<>|]+/g, '-');
    if (ext && base.toLowerCase().endsWith(ext.toLowerCase())) base = base.slice(0, -ext.length);
    if (!base || base + ext === item.name) return;
    item.name = base + ext;
    library.refresh();
    updateStatus();
  };
  function startRename(item) {
    if (!item || fileName.hidden) return;
    if (app.current !== item) select(item);
    const [base] = splitExt(item.name);
    const input = h('input.itp-name-input', { type: 'text', value: item.name, 'aria-label': 'Source name', spellcheck: false });
    input.style.width = `${Math.min(36, Math.max(12, item.name.length + 2))}ch`;
    fileName.hidden = true;
    fileName.after(input);
    input.focus();
    input.setSelectionRange(0, base.length);
    let done = false;
    const finish = commit => {
      if (done) return;
      done = true;
      if (commit) app.rename(item, input.value);
      input.remove();
      fileName.hidden = false;
    };
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }
  app.startRename = startRename;

  // ================================================================ INDEXEDDB WORKSPACE
  let savedInfo = null;
  app.savedWorkspace = () => savedInfo;

  async function bytesOf(item) {
    if (item.file) return item.file;
    const c = document.createElement('canvas');
    c.width = item.width; c.height = item.height;
    c.getContext('2d').drawImage(item.source, 0, 0);
    return new Promise(res => c.toBlob(b => res(b), 'image/png'));
  }

  async function saveNow() {
    if (!usePersist) return;
    if (!app.items.length) {
      if (savedInfo) { await forgetSaved(); return; }
      toast('Import media first to save a browser workspace');
      return;
    }
    saveBtn.disabled = true;
    try {
      const items = [];
      for (const it of app.items) items.push({ name: it.name, type: it.type, file: await bytesOf(it), own: it.own ? clone(it.own) : null });
      const bytes = await saveWorkspace({ shared: clone(app.shared), current: Math.max(0, app.items.indexOf(app.current)), items });
      savedInfo = { count: items.length, bytes, savedAt: Date.now() };
      library.refresh();
      toast(`Saved ${items.length} source${items.length === 1 ? '' : 's'} (${fmtBytes(bytes)}) locally in IndexedDB`, { kind: 'ok', timeout: 2600 });
    } catch (e) {
      toast(isQuotaError(e) ? 'Browser IndexedDB quota exceeded' : `Workspace save failed: ${e.message}`, { kind: 'error' });
    } finally {
      saveBtn.disabled = false;
    }
  }
  app.saveWorkspace = saveNow;

  async function forgetSaved() {
    try { await forgetWorkspace(); } catch (e) { toast(e.message, { kind: 'error' }); return; }
    savedInfo = null;
    library.refresh();
    toast('Purged saved workspace from IndexedDB');
  }
  app.forgetWorkspace = forgetSaved;

  async function restoreSaved() {
    const ws = await loadWorkspace();
    if (!ws) return;
    savedInfo = { count: ws.items.length, bytes: ws.items.reduce((a, it) => a + (it.file ? it.file.size : 0), 0), savedAt: ws.savedAt };
    if (app.items.length || !ws.items.length) { library.refresh(); return; }
    if (ws.shared && !/[#&]s=/.test(location.hash)) store.setTarget('shared', ws.shared);
    const added = [];
    for (const s of ws.items) {
      try {
        const file = s.file instanceof File ? s.file : new File([s.file], s.name, { type: s.file.type });
        let item;
        if (s.type === 'video') item = await addVideo(s.name, file);
        else {
          let drawable;
          try { drawable = await createImageBitmap(file); } catch { drawable = new Image(); drawable.src = URL.createObjectURL(file); await drawable.decode(); }
          item = await addImage(s.name, drawable, file);
        }
        item.own = s.own || null;
        added.push(item);
      } catch (e) { console.warn('[workspace]', s.name, e); }
    }
    const cur = added[Math.min(ws.current || 0, added.length - 1)];
    if (cur) select(cur);
    library.refresh();
    syncRail();
  }

  // ================================================================ VIDEO PLAYBACK
  function updateTransport() {
    const it = app.current;
    if (!it || it.type !== 'video') return;
    const v = it.source;
    playBtn.innerHTML = icon(v.paused ? 'play' : 'pause');
    timeLabel.innerHTML = `${fmtTime(v.currentTime)} <span>/ ${fmtTime(v.duration)}</span>`;
    scrub.value = String(Math.round(v.currentTime / (v.duration || 1) * 1000));
    scrub.style.setProperty('--p', `${scrub.value / 10}%`);
    fpsLabel.textContent = `${it.fps} fps`;
    soundBox.hidden = it.hasAudio === false;
    applySound(v);
  }
  function applySound(v) {
    if (v && !app.exporting && !app.current?.fpsReady) {
      if (v.muted !== sound.muted) v.muted = sound.muted;
      if (v.volume !== sound.volume) v.volume = sound.volume;
    }
    const level = sound.muted ? 0 : sound.volume;
    const pct = Math.round(level * 100);
    muteBtn.innerHTML = icon(level ? 'volume' : 'volumeOff');
    volSlider.style.setProperty('--v', `${pct}%`);
    volValue.textContent = level ? String(pct) : 'Off';
  }
  function setSound(patch) {
    Object.assign(sound, patch);
    if (patch.muted === false && !sound.volume) sound.volume = 1;
    persist.save('muted', sound.muted); persist.save('volume', sound.volume);
    applySound(app.current && app.current.type === 'video' ? app.current.source : null);
  }
  function pumpVideo(item) {
    const v = item.source;
    const tick = () => {
      if (v.paused || app.current !== item) return;
      schedule();
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(tick); else requestAnimationFrame(tick);
    };
    tick();
  }
  async function togglePlay() {
    const it = app.current;
    if (!it || it.type !== 'video') return;
    if (storyboard.active) { storyboard.toggleAnimation(); return; }
    if (!it.source.paused) { it.source.pause(); return; }
    if (it.fpsReady) await it.fpsReady;
    if (app.current !== it || storyboard.active) return;
    applySound(it.source);
    if (it.source.ended) it.source.currentTime = 0;
    it.source.play().catch(e => toast(e.message, { kind: 'error' }));
  }
  function stepFrame(dir) {
    const it = app.current;
    if (!it || it.type !== 'video' || storyboard.active) return;
    const v = it.source; v.pause();
    const frame = Math.floor(v.currentTime * it.fps + 1e-6) + dir;
    seekTo(v, (Math.max(0, frame) + 0.5) / it.fps).then(() => { updateTransport(); schedule(); });
  }
  scrub.addEventListener('input', () => {
    const it = app.current; if (!it || it.type !== 'video') return;
    it.source.currentTime = scrub.value / 1000 * it.source.duration;
  });

  // ================================================================ VIEW CONTROLS
  function toggleCompare() {
    if (storyboard.active) return;
    setViewMode(stage.mode === 'split' ? 'single' : 'split');
  }
  function toggleLoupe(force) {
    if (storyboard.active) return;
    const on = force ?? !stage.loupe;
    stage.setLoupe(on);
    loupeBtn.setAttribute('aria-pressed', String(on));
  }
  function toggleGrid(force) {
    if (storyboard.active) return;
    const on = force ?? !stage.grid;
    stage.setGrid(on);
    gridBtn.setAttribute('aria-pressed', String(on));
    if (on && stage.zoom < 5 && app.result) toast('Zoom to ≥5× to inspect 1px & 16×16 tile grid lines');
  }
  function zoomMenu(anchor) {
    const view = storyboard.active ? storyboard : stage;
    menu(anchor, [
      { label: 'Fit to Viewport', kbd: 'F', icon: 'fit', onClick: () => view.fit() },
      'sep',
      ...[1, 2, 4, 8, 16, 32].map(z => ({ label: `${z}× Integer Zoom`, onClick: () => view.zoomTo(z) })),
      'sep',
      { group: 'Viewport Modes' },
      ...vmDefs.map((m, idx) => ({ label: m.label, kbd: String(idx + 1), icon: m.icon, onClick: () => setViewMode(m.id) })),
    ]);
  }
  function togglePanel(which) {
    const key = which === 'lib' ? 'lib' : 'insp';
    const open = shell.dataset[key] !== 'open';
    shell.dataset[key] = open ? 'open' : 'closed';
    if (!narrow() || which === 'insp') persist.save(key, shell.dataset[key]);
    syncRail();
    requestAnimationFrame(() => stage.resize());
  }
  function applyTheme(t) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const dark = t ? t === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
    themeBtn.innerHTML = icon(dark ? 'sun' : 'moon');
    stage.redraw();
  }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'dark' ? 'light' : 'dark';
    persist.save('theme', next);
    applyTheme(next);
  }

  // ================================================================ PALETTES & HARMONY
  function pixelsOf(item, maxSize = 4096) {
    const w = item.width, hh = item.height, k = Math.min(1, maxSize / Math.max(w, hh));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(item.source, 0, 0, c.width, c.height);
    return g.getImageData(0, 0, c.width, c.height);
  }
  function pickAt(u, v) {
    const it = app.current; if (!it) return;
    const img = pixelsOf(it, 1024);
    const c = app.result ? app.result.crop : { x: 0, y: 0, w: 1, h: 1 };
    const x = Math.min(img.width - 1, Math.floor((c.x + u * c.w) * img.width));
    const y = Math.min(img.height - 1, Math.floor((c.y + v * c.h) * img.height));
    const o = (y * img.width + x) * 4;
    const hex = toHex([img.data[o], img.data[o + 1], img.data[o + 2]]);
    const s = store.settings;
    const colors = s.palette.source === 'custom' ? s.palette.colors : [];
    if (colors.includes(hex)) return toast(`${hex} is already in palette`);
    store.update({ palette: { source: 'custom', name: s.palette.source === 'custom' ? s.palette.name : 'Picked', colors: [...colors, hex] } });
    setBrushColor(hex);
    toast(`Added ${hex}`, { kind: 'ok', timeout: 1400 });
  }
  let pickerBtn = null;
  function togglePicker(button) {
    if (button) pickerBtn = button;
    const on = !stage.picking;
    stage.setPicking(on);
    pickerBtn?.setAttribute('aria-pressed', String(on));
    if (on) {
      setViewMode('split');
      toast('Click source image to append colours · Esc to finish');
    }
  }
  app.togglePicker = togglePicker;

  function usePalette(p) {
    if (p.id && !p.custom) store.update({ palette: { source: 'builtin', id: p.id } });
    else store.update({ palette: { source: 'custom', name: p.name, colors: p.colors } });
  }
  app.usePalette = usePalette;

  function rememberPalette(name, colors) {
    const list = app.userPalettes.filter(p => p.name !== name);
    list.unshift({ name, colors, custom: true });
    app.userPalettes = list.slice(0, 100);
    if (usePersist) persist.save('palettes', app.userPalettes);
    if (library.tab === 'palettes') library.refresh();
  }
  app.rememberHarmonyPalette = (name, colors) => {
    rememberPalette(name, colors);
    toast(`Saved "${name}" to Your Palettes`, { kind: 'ok', timeout: 1600 });
  };

  async function importPaletteFile(file, text) {
    try {
      const p = parsePalette(text ?? await file.text(), file.name);
      rememberPalette(p.name || 'Imported', p.colors);
      store.update({ palette: { source: 'custom', name: p.name || 'Imported', colors: p.colors } });
      toast(`Imported "${p.name}" (${p.colors.length} colours)`, { kind: 'ok' });
    } catch (e) { toast(`${file.name}: ${e.message}`, { kind: 'error' }); }
  }
  app.importPalette = async () => {
    const [f] = await pickFiles({ accept: '.gpl,.hex,.pal,.txt,.json' });
    if (f) importPaletteFile(f);
  };
  app.savePalette = () => {
    const s = store.settings;
    const colors = s.palette.source === 'extract' ? (app.result?.palette || []) : s.palette.colors;
    if (!colors.length) return toast('No active palette to save', { kind: 'error' });
    const input = h('input.itp-input', { value: s.palette.source === 'custom' ? s.palette.name : `${s.palette.name} Custom`, 'aria-label': 'Palette name' });
    const fmt = h('select.itp-select', { 'aria-label': 'Download format' },
      h('option', { value: '', text: 'Save in Studio Library only' }),
      h('option', { value: 'gpl', text: 'Also download .gpl (Aseprite / GIMP)' }),
      h('option', { value: 'hex', text: 'Also download .hex (Lospec)' }),
      h('option', { value: 'json', text: 'Also download .json' }));
    dialog('Save Palette', [
      h('div.itp-field', {}, h('div.lab', {}, h('span', { text: 'Name' })), input),
      h('div.itp-field', {}, h('div.lab', {}, h('span', { text: 'Export File' })), fmt),
      h('div.itp-strip', { style: { height: '18px' } }, ...colors.map(c => h('i', { style: { background: c } }))),
    ], {
      actions: [{ label: 'Cancel' }, { label: 'Save Palette', primary: true, onClick: () => {
        const name = input.value.trim() || 'Palette';
        rememberPalette(name, colors);
        store.update({ palette: { source: 'custom', name, colors } });
        const slug = name.replace(/[^\w-]+/g, '-').toLowerCase();
        if (fmt.value === 'gpl') downloadBlob(toGPL(name, colors), `${slug}.gpl`, 'text/plain');
        if (fmt.value === 'hex') downloadBlob(toHexFile(colors), `${slug}.hex`, 'text/plain');
        if (fmt.value === 'json') downloadBlob(toPaletteJSON(name, colors), `${slug}.json`, 'application/json');
        toast(`Saved "${name}"`, { kind: 'ok' });
      } }],
    });
    input.select();
  };
  app.deletePalette = p => {
    app.userPalettes = app.userPalettes.filter(x => x !== p);
    if (usePersist) persist.save('palettes', app.userPalettes);
    library.refresh();
    toast(`Removed "${p.name}"`, { action: { label: 'Undo', onClick: () => rememberPalette(p.name, p.colors) } });
  };
  app.lospecDialog = () => {
    const input = h('input.itp-input', { placeholder: 'e.g. endesga-32 or lospec.com palette URL', 'aria-label': 'Lospec slug or URL' });
    const note = h('div.help', { text: 'Fetches any palette directly from lospec.com.' });
    const d = dialog('Import from Lospec', [h('div.itp-field', {}, h('div.lab', {}, h('span', { text: 'Slug or URL' })), input, note)], {
      actions: [{ label: 'Cancel' }, { label: 'Fetch Palette', primary: true, onClick: async () => {
        note.textContent = 'Fetching…'; note.style.color = '';
        try {
          const p = await fetchLospec(input.value);
          rememberPalette(p.name, p.colors);
          store.update({ palette: { source: 'custom', name: p.name, colors: p.colors } });
          toast(`Imported "${p.name}" from Lospec`, { kind: 'ok' });
          return true;
        } catch (e) { note.textContent = e.message; note.style.color = 'var(--danger)'; return false; }
      } }],
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') d.querySelector('footer .primary').click(); });
    input.focus();
  };

  app.detectGrid = () => {
    const it = app.current; if (!it || it.type !== 'image') return toast('Open an image first', { kind: 'error' });
    const b = detectGrid(pixelsOf(it));
    if (b <= 1) return toast('No pre-upscaled integer pixel grid detected');
    store.update({ size: { mode: 'block', block: b, resample: 'nearest' } });
    toast(`Detected ${b}×${b} pixel blocks · Switched to Nearest block sampling`, { kind: 'ok' });
  };

  // ================================================================ SETTINGS & EXPORT MENU
  app.settingsJSON = () => settingsToJSON(store.settings);
  app.copyLink = async () => {
    const url = `${location.origin}${location.pathname}#s=${encodeSettings(store.settings)}`;
    try { await navigator.clipboard.writeText(url); toast('Shareable pipeline URL copied to clipboard', { kind: 'ok' }); }
    catch { dialog('Shareable URL', [h('textarea.itp-input', { rows: 3, readOnly: true, value: url })]); }
    history.replaceState(null, '', `#s=${encodeSettings(store.settings)}`);
  };
  app.saveSettingsFile = () => downloadBlob(settingsToJSON(store.settings), 'pixelforge-pipeline.json', 'application/json');
  app.loadSettingsFile = async () => {
    const [f] = await pickFiles({ accept: '.json,application/json' });
    if (!f) return;
    try { store.replace(settingsFromJSON(await f.text())); toast(`Loaded ${f.name}`, { kind: 'ok' }); } catch (e) { toast(`${f.name}: ${e.message}`, { kind: 'error' }); }
  };
  app.resetSettings = () => { store.replace(defaultSettings()); toast('Pipeline reset to defaults', { action: { label: 'Undo', onClick: () => store.undo() } }); };
  app.applyPreset = p => {
    app.activePreset = p.id;
    store.replace(mergeSettings(defaultSettings(), { ...p.settings, export: store.settings.export }), 'preset');
    syncQuickBar();
    library.refresh();
  };

  Object.assign(app, exporter);

  function exportMenu(anchor) {
    const it = app.current;
    const video = it && it.type === 'video';
    const images = app.items.filter(i => i.type === 'image').length;
    const s = store.settings;
    const selecting = storyboard.active;
    const offNote = selecting ? 'Exit frame selection first' : null;
    menu(anchor, [
      { group: 'Crisp Pixel Image' },
      { label: 'Download PNG', sub: offNote || (app.result ? `${app.result.width * s.export.scale} × ${app.result.height * s.export.scale} px (${s.export.scale}× integer scale)` : 'Open an image first'), icon: 'image', kbd: 'Ctrl S', disabled: !app.result || selecting, onClick: () => app.exportPNG() },
      { label: 'Copy PNG to Clipboard', sub: offNote, icon: 'copy', disabled: !app.result || selecting, onClick: () => app.copyImage() },
      { label: app.items.length > 1 ? `Batch Export All ${app.items.length} Sources (.zip)` : 'Batch Export Queue (.zip)', icon: 'zip', disabled: app.items.length < 2, onClick: () => app.exportZip() },
      { group: 'Game Assets & Animation' },
      { label: 'Deduplicated 16×16 Tileset + JSON (.zip)', sub: offNote || 'Mirror-deduplicated tile atlas & map', icon: 'tiles', disabled: !app.result || selecting, onClick: () => app.exportTileset({ tile: 16, flips: true }) },
      { label: video ? 'Animated GIF from Video' : 'Animated GIF from Image Queue', icon: 'gif', disabled: !video && images < 2, onClick: () => app.exportAnimation({ ...animDefaults(), format: 'gif' }) },
      { label: 'Open Game & Video Export Studio…', sub: 'Live Tileset Studio, MP4/WebM, Sprite Sheet Atlas', icon: 'film', onClick: () => { inspector.setTab('export'); if (shell.dataset.insp !== 'open') togglePanel('insp'); } },
      { group: 'Pipeline Preset' },
      { label: 'Copy Shareable Pipeline URL', icon: 'link', onClick: () => app.copyLink() },
      { label: 'Export Pipeline JSON', icon: 'braces', onClick: () => app.saveSettingsFile() },
    ]);
  }
  const animDefaults = () => {
    const it = app.current;
    const video = it && it.type === 'video';
    return { source: video ? 'video' : 'files', fps: video ? Math.min(30, Math.round(it.fps || 12)) : 8, start: 0, end: video ? it.duration : 0 };
  };

  function showHelp() {
    const keys = [
      ['Single / Curtain / Dual / 4-Up / Tile', '1 2 3 4 5'],
      ['Navigate / Pan Tool', 'V'],
      ['Pixel Pencil / Eraser', 'B  E'],
      ['Flood Bucket / Eyedropper', 'K  I'],
      ['1px Line / Rectangle Tool', 'U  R'],
      ['12× Pixel Loupe Magnifier', 'L'],
      ['1px & 16×16 Tile Grid', 'G'],
      ['Curtain Compare Toggle', 'C'],
      ['Fit / Zoom In / Out', 'F  +  -'],
      ['Pixel Width ±1 / ±8', '[ ]  Shift [ ]'],
      ['Cycle Dither (incl. Posterior)', 'D  Shift D'],
      ['Undo / Redo (Strokes + Pipeline)', 'Ctrl Z  Ctrl Shift Z'],
      ['Import / Export PNG', 'Ctrl O  Ctrl S'],
      ['Toggle Drawer / Inspector', '\\  /'],
      ['Toggle Theme', 'T'],
      ['Rename Active Source', 'F2'],
    ];
    dialog('PixelForge Workstation Shortcuts', [
      h('div.itp-keys', {}, ...keys.map(([a, k]) => h('div', {}, h('span', { text: a }), h('span', {}, ...k.split('  ').map(x => h('kbd', { text: x.trim() })))))),
    ]);
  }

  // ================================================================ KEYBOARD & DRAG/DROP
  const typing = e => e.target.closest('input, select, textarea, [contenteditable="true"]') && !(e.target.type === 'range' || e.target.type === 'checkbox');
  const DITHER_ORDER = ['none', 'posterior', 'bluenoise', 'bayer4', 'bayer8', 'cluster4', 'floyd-steinberg', 'atkinson', 'sierra-lite', 'jarvis'];

  window.addEventListener('keydown', e => {
    if (!shell.isConnected || document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod && k.toLowerCase() === 'z') {
      if (typing(e)) return;
      e.preventDefault();
      if (e.shiftKey) { if (!redoEditStroke()) store.redo(); }
      else { if (!undoEditStroke()) store.undo(); }
      return;
    }
    if (mod && k.toLowerCase() === 'y') { if (typing(e)) return; e.preventDefault(); if (!redoEditStroke()) store.redo(); return; }
    if (mod && k.toLowerCase() === 's') { e.preventDefault(); app.exportPNG(); return; }
    if (mod && k.toLowerCase() === 'o') { e.preventDefault(); openFiles(); return; }
    if (mod || (e.altKey && !['ArrowUp', 'ArrowDown'].includes(k))) return;
    if (typing(e)) { if (k === 'Escape') e.target.blur(); return; }

    const s = store.settings;
    switch (k) {
      case '1': setViewMode('single'); break;
      case '2': setViewMode('split'); break;
      case '3': setViewMode('dual'); break;
      case '4': setViewMode('quad'); break;
      case '5': setViewMode('tile'); break;
      case 'v': case 'V': selectTool('pan'); break;
      case 'b': case 'B': selectTool('pencil'); break;
      case 'e': case 'E': selectTool('eraser'); break;
      case 'k': case 'K': selectTool('bucket'); break;
      case 'u': case 'U': selectTool('line'); break;
      case 'r': case 'R': selectTool('rect'); break;
      case 'i': case 'I': selectTool('eyedropper'); break;
      case 'l': case 'L': toggleLoupe(); break;
      case 'c': case 'C': toggleCompare(); break;
      case 'g': case 'G': toggleGrid(); break;
      case 'f': case 'F': if (storyboard.active) storyboard.fit(); else stage.fit(); break;
      case '+': case '=': if (storyboard.active) storyboard.zoomStep(1); else stage.zoomIn(); break;
      case '-': case '_': if (storyboard.active) storyboard.zoomStep(-1); else stage.zoomOut(); break;
      case 't': case 'T': toggleTheme(); break;
      case '\\': togglePanel('lib'); break;
      case '/': togglePanel('insp'); break;
      case '?': showHelp(); break;
      case '[': case '{': store.update({ size: { mode: 'width', width: Math.max(8, s.size.width - (e.shiftKey ? 8 : 1)) } }, { key: 'kw' }); break;
      case ']': case '}': store.update({ size: { mode: 'width', width: s.size.width + (e.shiftKey ? 8 : 1) } }, { key: 'kw' }); break;
      case 'd': case 'D': {
        const i = DITHER_ORDER.indexOf(s.dither.method);
        const next = DITHER_ORDER[(i + (e.shiftKey ? -1 : 1) + DITHER_ORDER.length) % DITHER_ORDER.length];
        store.update({ dither: { method: next } });
        toast(`Dither: ${next}`, { timeout: 900 });
        break;
      }
      case ' ': if (e.target.closest('button')) break; if (app.current?.type === 'video' && stage.tool === 'pan') { e.preventDefault(); togglePlay(); } break;
      case 'F2': if (app.current) { e.preventDefault(); startRename(app.current); } break;
      case 'm': case 'M': if (app.current?.type === 'video' && !soundBox.hidden) { e.preventDefault(); setSound({ muted: !sound.muted }); } break;
      case ',': stepFrame(-1); break;
      case '.': stepFrame(1); break;
      case 'Escape': if (stage.picking) togglePicker(); else closeMenu(); break;
      case 'ArrowDown': case 'ArrowUp':
        if (e.altKey && e.shiftKey && app.current) { e.preventDefault(); app.move(app.current, k === 'ArrowDown' ? 1 : -1); break; }
        if (e.altKey && app.items.length > 1) {
          e.preventDefault();
          const i = app.items.indexOf(app.current);
          select(app.items[(i + (k === 'ArrowDown' ? 1 : -1) + app.items.length) % app.items.length]);
        }
        break;
      default: return;
    }
  });

  let dragDepth = 0;
  shell.addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; shell.classList.add('itp-dragging'); } });
  shell.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; shell.classList.remove('itp-dragging'); } });
  shell.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  shell.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; shell.classList.remove('itp-dragging');
    if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]);
  });
  window.addEventListener('paste', e => {
    if (!shell.isConnected || typing(e)) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); addFiles(files); return; }
    const text = e.clipboardData?.getData('text') || '';
    if (/#?[0-9a-f]{6}/i.test(text) && /\n|,|\s/.test(text.trim())) {
      try { const p = parsePalette(text); store.update({ palette: { source: 'custom', name: 'Pasted', colors: p.colors } }); toast(`Pasted ${p.colors.length}-colour palette`, { kind: 'ok' }); } catch { /* ignore */ }
    }
  });
  window.addEventListener('hashchange', () => {
    if (/[#&]s=/.test(location.hash)) { try { store.replace(decodeSettings(location.hash)); } catch { /* ignore */ } }
  });

  // Initial Paint
  inspector.sync(store.settings, null);
  library.refresh();
  updateStatus();
  (async () => {
    if (usePersist && options.restore !== false && !options.forceSample) {
      await restoreSaved().catch(e => console.warn('[workspace]', e));
    }
    if (options.initialSample && (options.forceSample || !app.items.length)) {
      await openSample(findSample(options.initialSample)).catch(e => console.warn('[sample]', e));
    }
  })();

  return {
    app, store,
    addFiles,
    async addImage(source, name = 'image') { const it = await addImage(name, source); select(it); library.refresh(); return it; },
    openSample: id => openSample(findSample(id)),
    applyPreset: id => { const p = PRESETS.find(x => x.id === id); if (p) app.applyPreset(p); },
    setTheme: t => { persist.save('theme', t); applyTheme(t); },
    setViewMode,
    selectTool,
    get result() { return app.result; },
    get view() { return stage.rect; },
    async idle() { for (let i = 0; i < 200 && (dirty || running); i++) await new Promise(r => setTimeout(r, 25)); },
  };
}

export { SAMPLES };
