// PixelForge Studio Multi-Mode Viewport:
// - 5 Live Modes: Single, Split Curtain (V/H), Dual Sync Side-by-Side, 4-Up Snapshot Arena, 3×3 Seamless Tile Checker
// - Interactive Pixel Retouch Tools: Pan, Pencil (1-4px), Eraser, Flood/Global Bucket, 1px Line, 1px Rect, Eyedropper
// - Floating 12× Pixel Loupe Magnifier with (X, Y), #HEX, and OKLab telemetry

import { h } from './dom.js';
import { icon } from './icons.js';
import { parseColor, oklab, toHex } from '../core/color.js';

export const ZOOM_STEPS = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

export function bresenhamLine(x0, y0, x1, y1) {
  const pts = [];
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}

export function rectOutlinePoints(x0, y0, x1, y1) {
  const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
  const ty = Math.min(y0, y1), by = Math.max(y0, y1);
  const pts = [];
  for (let x = lx; x <= rx; x++) { pts.push([x, ty]); if (by !== ty) pts.push([x, by]); }
  for (let y = ty + 1; y < by; y++) { pts.push([lx, y]); if (rx !== lx) pts.push([rx, y]); }
  return pts;
}

export function stampBrush(pts, size) {
  if (size <= 1) return pts;
  const out = [];
  const off = -Math.floor((size - 1) / 2);
  for (const [px, py] of pts) {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) out.push([px + off + dx, py + off + dy]);
    }
  }
  return out;
}

export function createStage({
  onPick,
  onViewChange,
  onToolSample,
  onStrokeStart,
  onStrokePoints,
  onStrokeEnd,
  onBucket,
} = {}) {
  const screen = h('canvas.screen', { role: 'img', 'aria-label': 'PixelForge Studio Viewport' });
  const splitLeft = h('span.lbl.l', { text: 'Original' });
  const splitRight = h('span.lbl.r', { text: 'PixelForge' });
  const handle = h('button', { type: 'button', 'aria-label': 'Drag curtain to compare original and pixel output', html: icon('compare') });
  const split = h('div.itp-split', { hidden: true }, splitLeft, splitRight, handle);

  // Quad overlay badges (clickable A/B/C/D headers)
  const quadOverlay = h('div.pf-quad-overlay', { hidden: true });

  // Floating 12× Pixel Loupe Magnifier
  const loupeCanvas = h('canvas', { width: 132, height: 132 });
  const loupeSwatch = h('i.pf-loupe-sw');
  const loupeHex = h('span.mono', { text: '#000000' });
  const loupeCoord = h('span.mono.muted', { text: '0, 0' });
  const loupeLab = h('div.pf-loupe-lab.mono', { text: 'L 0.00 · a 0.00 · b 0.00' });
  const loupeEl = h('div.pf-loupe', { hidden: true },
    loupeCanvas,
    h('div.pf-loupe-meta', {},
      h('div.pf-loupe-row', {}, loupeSwatch, loupeHex, loupeCoord),
      loupeLab));

  const el = h('div.itp-view.pf-viewport', {
    tabindex: '0',
    'aria-label': 'Studio viewport. Scroll to zoom, drag to pan or paint.',
  }, screen, split, quadOverlay, loupeEl);

  const ctx = screen.getContext('2d');
  const loupeCtx = loupeCanvas.getContext('2d');

  const st = {
    result: null,       // output canvas
    resultData: null,   // Uint8ClampedArray RGBA of output
    original: null,     // source drawable
    crop: null,         // { x, y, w, h } fractions
    w: 0, h: 0,
    x: 0, y: 0, z: 1,
    fitted: true,
    mode: 'single',     // 'single' | 'split' | 'dual' | 'quad' | 'tile'
    splitAxis: 'v',     // 'v' | 'h'
    splitAt: 0.5,
    grid: false,
    loupe: false,
    picking: false,     // legacy palette-add picker mode
    tool: 'pan',        // 'pan' | 'pencil' | 'eraser' | 'bucket' | 'line' | 'rect' | 'eyedropper'
    brushSize: 1,
    brushColor: '#14f195',
    bucketGlobal: false,
    spaceHeld: false,
    hover: null,        // { px, py, rawX, rawY, clientX, clientY }
    shapeDrag: null,    // { tool, x0, y0, x1, y1 }
    quadSlots: [],      // [{ id, label, sub, canvas, active, onSelect }]
  };

  let dpr = 1, vw = 0, vh = 0, pattern = null, patternKey = '';

  function checker() {
    const css = getComputedStyle(el);
    const a = css.getPropertyValue('--checker-a').trim() || '#111823';
    const b = css.getPropertyValue('--checker-b').trim() || '#182231';
    const key = a + b;
    if (key === patternKey) return pattern;
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = a; g.fillRect(0, 0, 16, 16);
    g.fillStyle = b; g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
    patternKey = key; pattern = ctx.createPattern(c, 'repeat');
    return pattern;
  }

  function resize() {
    const r = el.getBoundingClientRect();
    const d = Math.min(3, window.devicePixelRatio || 1);
    if (Math.abs(r.width - vw) < 0.5 && Math.abs(r.height - vh) < 0.5 && d === dpr && screen.width > 1) { draw(); return; }
    dpr = d; vw = r.width; vh = r.height;
    screen.width = Math.max(1, Math.round(vw * dpr));
    screen.height = Math.max(1, Math.round(vh * dpr));
    if (st.fitted) fit(false); else draw();
  }

  function paneMetrics() {
    if (st.mode === 'dual') return { pw: vw / 2, ph: vh, mult: 1 };
    if (st.mode === 'quad') return { pw: vw / 2, ph: vh / 2, mult: 1 };
    if (st.mode === 'tile') return { pw: vw, ph: vh, mult: 3 };
    return { pw: vw, ph: vh, mult: 1 };
  }

  function fitZoom() {
    if (!st.w || !st.h) return 1;
    const { pw, ph, mult } = paneMetrics();
    const pad = pw < 420 ? 18 : 44;
    return Math.max(0.05, Math.min((pw - pad) / (st.w * mult), (ph - pad) / (st.h * mult)));
  }

  function fit(notify = true) {
    const { pw, ph } = paneMetrics();
    st.z = fitZoom();
    st.x = (pw - st.w * st.z) / 2;
    st.y = (ph - st.h * st.z) / 2;
    st.fitted = true;
    draw();
    if (notify && onViewChange) onViewChange(view());
  }

  function localAnchor(cx, cy) {
    if (st.mode === 'dual') return { lx: cx >= vw / 2 ? cx - vw / 2 : cx, ly: cy };
    if (st.mode === 'quad') return { lx: cx >= vw / 2 ? cx - vw / 2 : cx, ly: cy >= vh / 2 ? cy - vh / 2 : cy };
    return { lx: cx, ly: cy };
  }

  function zoomTo(z, cx = vw / 2, cy = vh / 2) {
    z = Math.max(0.05, Math.min(128, z));
    const { lx, ly } = localAnchor(cx, cy);
    const px = (lx - st.x) / st.z, py = (ly - st.y) / st.z;
    st.z = z;
    st.x = lx - px * z;
    st.y = ly - py * z;
    st.fitted = false;
    draw();
    if (onViewChange) onViewChange(view());
  }

  function zoomStep(dir, cx, cy) {
    const cur = st.z;
    const next = dir > 0
      ? (ZOOM_STEPS.find(s => s > cur + 1e-6) || cur * 1.5)
      : ([...ZOOM_STEPS].reverse().find(s => s < cur - 1e-6) || cur / 1.5);
    zoomTo(next, cx, cy);
  }

  function drawOriginalInRect(x, y, w, hh) {
    if (!st.original) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    try {
      const ow = st.original.naturalWidth || st.original.videoWidth || st.original.width;
      const oh = st.original.naturalHeight || st.original.videoHeight || st.original.height;
      const c = st.crop || { x: 0, y: 0, w: 1, h: 1 };
      ctx.drawImage(st.original, c.x * ow, c.y * oh, c.w * ow, c.h * oh, x, y, w, hh);
    } catch { /* video frame seeking */ }
    ctx.restore();
  }

  function drawPixelGrid(x, y, w, hh, clipX0, clipY0, clipW, clipH) {
    if (!st.grid || st.z < 5) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.max(x, clipX0), Math.max(y, clipY0), Math.min(x + w, clipX0 + clipW) - Math.max(x, clipX0), Math.min(y + hh, clipY0 + clipH) - Math.max(y, clipY0));
    ctx.clip();
    const x0 = Math.max(0, Math.floor((clipX0 - x) / st.z)), x1 = Math.min(st.w, Math.ceil((clipX0 + clipW - x) / st.z));
    const y0 = Math.max(0, Math.floor((clipY0 - y) / st.z)), y1 = Math.min(st.h, Math.ceil((clipY0 + clipH - y) / st.z));

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 1 / dpr;
    ctx.beginPath();
    for (let i = x0; i <= x1; i++) {
      if (i % 16 === 0) continue;
      const px = Math.round((x + i * st.z) * dpr) / dpr + 0.5 / dpr;
      ctx.moveTo(px, y); ctx.lineTo(px, y + hh);
    }
    for (let j = y0; j <= y1; j++) {
      if (j % 16 === 0) continue;
      const py = Math.round((y + j * st.z) * dpr) / dpr + 0.5 / dpr;
      ctx.moveTo(x, py); ctx.lineTo(x + w, py);
    }
    ctx.stroke();

    // Major 16×16 tile grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.beginPath();
    for (let i = x0; i <= x1; i++) {
      if (i % 16 !== 0) continue;
      const px = Math.round((x + i * st.z) * dpr) / dpr + 0.5 / dpr;
      ctx.moveTo(px, y); ctx.lineTo(px, y + hh);
    }
    for (let j = y0; j <= y1; j++) {
      if (j % 16 !== 0) continue;
      const py = Math.round((y + j * st.z) * dpr) / dpr + 0.5 / dpr;
      ctx.moveTo(x, py); ctx.lineTo(x + w, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawBrushOverlay(ox, oy) {
    const canPaint = st.tool !== 'pan' && !st.spaceHeld && !st.picking && (st.mode === 'single' || st.mode === 'dual' || st.mode === 'tile');
    if (!canPaint) return;

    // Shape preview (Line / Rect) while dragging
    if (st.shapeDrag) {
      const pts = st.shapeDrag.tool === 'line'
        ? bresenhamLine(st.shapeDrag.x0, st.shapeDrag.y0, st.shapeDrag.x1, st.shapeDrag.y1)
        : rectOutlinePoints(st.shapeDrag.x0, st.shapeDrag.y0, st.shapeDrag.x1, st.shapeDrag.y1);
      const stamped = stampBrush(pts, st.brushSize);
      ctx.save();
      ctx.fillStyle = st.brushColor;
      for (let [px, py] of stamped) {
        if (st.mode === 'tile') {
          px = ((px % st.w) + st.w) % st.w;
          py = ((py % st.h) + st.h) % st.h;
          for (let ty = -1; ty <= 1; ty++) {
            for (let tx = -1; tx <= 1; tx++) {
              ctx.fillRect(ox + (px + tx * st.w) * st.z, oy + (py + ty * st.h) * st.z, Math.ceil(st.z), Math.ceil(st.z));
            }
          }
        } else if (px >= 0 && py >= 0 && px < st.w && py < st.h) {
          ctx.fillRect(ox + px * st.z, oy + py * st.z, Math.ceil(st.z), Math.ceil(st.z));
        }
      }
      ctx.restore();
      return;
    }

    // Hover pixel cursor footprint
    if (st.hover) {
      const sz = (st.tool === 'pencil' || st.tool === 'eraser' || st.tool === 'line' || st.tool === 'rect') ? st.brushSize : 1;
      const off = -Math.floor((sz - 1) / 2);
      const hx = ox + (st.hover.rawX + off) * st.z;
      const hy = oy + (st.hover.rawY + off) * st.z;
      const hw = sz * st.z;
      ctx.save();
      ctx.strokeStyle = st.tool === 'eraser' ? '#f43f5e' : '#14f195';
      ctx.lineWidth = Math.max(1.25, 1.5 / dpr);
      ctx.strokeRect(hx, hy, hw, hw);
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 1 / dpr;
      ctx.strokeRect(hx - 1 / dpr, hy - 1 / dpr, hw + 2 / dpr, hw + 2 / dpr);
      ctx.restore();
    }
  }

  function syncQuadBadges() {
    if (st.mode !== 'quad' || !st.result) { quadOverlay.hidden = true; return; }
    quadOverlay.hidden = false;
    quadOverlay.innerHTML = '';
    const positions = [
      { left: '10px', top: '10px' },
      { left: 'calc(50% + 10px)', top: '10px' },
      { left: '10px', top: 'calc(50% + 10px)' },
      { left: 'calc(50% + 10px)', top: 'calc(50% + 10px)' },
    ];
    for (let i = 0; i < 4; i++) {
      const slot = st.quadSlots[i] || { label: `Slot ${String.fromCharCode(65 + i)}`, sub: 'Current Output' };
      const b = h('button.pf-quad-badge', {
        type: 'button',
        'data-active': slot.active ? 'true' : 'false',
        style: positions[i],
        title: slot.onSelect ? `Click to load ${slot.label}` : slot.label,
        onclick: e => { e.stopPropagation(); slot.onSelect?.(); },
      },
      h('span.tag', { text: String.fromCharCode(65 + i) }),
      h('span.name', { text: slot.label }),
      slot.sub ? h('span.sub', { text: slot.sub }) : null);
      quadOverlay.append(b);
    }
  }

  function drawPaneLabel(text, x, y, accent = false) {
    ctx.save();
    ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    const padX = 8, hBox = 22;
    const tw = ctx.measureText(text).width + padX * 2;
    ctx.fillStyle = accent ? 'rgba(10, 28, 36, 0.88)' : 'rgba(13, 19, 29, 0.84)';
    ctx.strokeStyle = accent ? 'rgba(20, 241, 149, 0.45)' : 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, tw, hBox, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent ? '#14f195' : '#cbd5e1';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padX, y + hBox / 2 + 0.5);
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, screen.width, screen.height);
    if (!st.result) { split.hidden = true; quadOverlay.hidden = true; loupeEl.hidden = true; return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const snap = v => Math.round(v * dpr) / dpr;
    const x = snap(st.x), y = snap(st.y);
    const w = snap(st.w * st.z), hh = snap(st.h * st.z);

    split.hidden = st.mode !== 'split';
    syncQuadBadges();

    if (st.mode === 'dual') {
      const half = snap(vw / 2);
      // Left Pane: Original Source
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, half, vh); ctx.clip();
      ctx.fillStyle = checker(); ctx.fillRect(x, y, w, hh);
      drawOriginalInRect(x, y, w, hh);
      if (st.hover) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + st.hover.px * st.z, y + st.hover.py * st.z, Math.max(3, st.z), Math.max(3, st.z));
      }
      drawPaneLabel('ORIGINAL SOURCE', 12, 12, false);
      ctx.restore();

      // Right Pane: PixelForge Output
      ctx.save();
      ctx.beginPath(); ctx.rect(half, 0, vw - half, vh); ctx.clip();
      ctx.fillStyle = checker(); ctx.fillRect(half + x, y, w, hh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(st.result, half + x, y, w, hh);
      drawPixelGrid(half + x, y, w, hh, half, 0, vw - half, vh);
      drawBrushOverlay(half + x, y);
      drawPaneLabel('PIXELFORGE OUTPUT', half + 12, 12, true);
      ctx.restore();

      // Center Divider
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(half + 0.5, 0); ctx.lineTo(half + 0.5, vh); ctx.stroke();
    } else if (st.mode === 'quad') {
      const hw = snap(vw / 2), hhPane = snap(vh / 2);
      const origins = [[0, 0], [hw, 0], [0, hhPane], [hw, hhPane]];
      for (let i = 0; i < 4; i++) {
        const [ox, oy] = origins[i];
        const slot = st.quadSlots[i];
        const img = (slot && slot.canvas) || st.result;
        ctx.save();
        ctx.beginPath(); ctx.rect(ox, oy, hw, hhPane); ctx.clip();
        ctx.fillStyle = checker(); ctx.fillRect(ox + x, oy + y, w, hh);
        if (slot && slot.isOriginal) {
          drawOriginalInRect(ox + x, oy + y, w, hh);
        } else {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, ox + x, oy + y, w, hh);
        }
        drawPixelGrid(ox + x, oy + y, w, hh, ox, oy, hw, hhPane);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw + 0.5, 0); ctx.lineTo(hw + 0.5, vh);
      ctx.moveTo(0, hhPane + 0.5); ctx.lineTo(vw, hhPane + 0.5);
      ctx.stroke();
    } else if (st.mode === 'tile') {
      ctx.fillStyle = checker();
      ctx.fillRect(x - w, y - hh, w * 3, hh * 3);
      ctx.imageSmoothingEnabled = false;
      for (let ty = -1; ty <= 1; ty++) {
        for (let tx = -1; tx <= 1; tx++) {
          ctx.drawImage(st.result, x + tx * w, y + ty * hh, w, hh);
        }
      }
      drawPixelGrid(x, y, w, hh, 0, 0, vw, vh);
      // Center tile seam guide
      ctx.save();
      ctx.strokeStyle = 'rgba(20, 241, 149, 0.65)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x, y, w, hh);
      ctx.restore();
      drawBrushOverlay(x, y);
      drawPaneLabel('3×3 SEAMLESS TILE WRAP', 12, 12, true);
    } else {
      // 'single' or 'split'
      ctx.fillStyle = checker();
      ctx.fillRect(x, y, w, hh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(st.result, x, y, w, hh);

      if (st.mode === 'split' && st.original) {
        split.dataset.axis = st.splitAxis;
        if (st.splitAxis === 'h') {
          const sy = y + hh * st.splitAt;
          ctx.save();
          ctx.beginPath(); ctx.rect(x, y, w, Math.max(0, sy - y)); ctx.clip();
          ctx.fillStyle = checker(); ctx.fillRect(x, y, w, hh);
          drawOriginalInRect(x, y, w, hh);
          ctx.restore();
          split.hidden = false;
          split.style.top = `${sy}px`;
          split.style.left = `${Math.max(0, x)}px`;
          split.style.right = `${Math.max(0, vw - (x + w))}px`;
          split.style.bottom = 'auto';
          handle.innerHTML = icon('viewSplitH');
        } else {
          const sx = x + w * st.splitAt;
          ctx.save();
          ctx.beginPath(); ctx.rect(x, y, Math.max(0, sx - x), hh); ctx.clip();
          ctx.fillStyle = checker(); ctx.fillRect(x, y, w, hh);
          drawOriginalInRect(x, y, w, hh);
          ctx.restore();
          split.hidden = false;
          split.style.left = `${sx}px`;
          split.style.right = 'auto';
          split.style.top = `${Math.max(0, y)}px`;
          split.style.bottom = `${Math.max(0, vh - (y + hh))}px`;
          handle.innerHTML = icon('compare');
        }
      }
      drawPixelGrid(x, y, w, hh, 0, 0, vw, vh);
      drawBrushOverlay(x, y);
    }

    updateLoupe();
  }

  function samplePixel(px, py) {
    if (!st.result || px < 0 || py < 0 || px >= st.w || py >= st.h) return null;
    if (st.resultData && st.resultData.length === st.w * st.h * 4) {
      const o = (py * st.w + px) * 4;
      return [st.resultData[o], st.resultData[o + 1], st.resultData[o + 2], st.resultData[o + 3]];
    }
    const g = st.result.getContext('2d');
    const d = g.getImageData(px, py, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }

  function updateLoupe() {
    if (!st.loupe || !st.result || !st.hover) {
      loupeEl.hidden = true;
      return;
    }
    loupeEl.hidden = false;
    const { px, py } = st.hover;
    const N = 11, cell = 12, half = 5;
    loupeCtx.clearRect(0, 0, 132, 132);
    loupeCtx.fillStyle = '#0b111a';
    loupeCtx.fillRect(0, 0, 132, 132);
    loupeCtx.imageSmoothingEnabled = false;
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const sx = px + dx, sy = py + dy;
        const cx = (dx + half) * cell, cy = (dy + half) * cell;
        if (sx < 0 || sy < 0 || sx >= st.w || sy >= st.h) {
          loupeCtx.fillStyle = ((dx + dy) & 1) ? '#111927' : '#0c131d';
          loupeCtx.fillRect(cx, cy, cell, cell);
        } else {
          const rgba = samplePixel(sx, sy);
          if (!rgba || rgba[3] < 16) {
            loupeCtx.fillStyle = ((sx + sy) & 1) ? '#1c2636' : '#131b26';
            loupeCtx.fillRect(cx, cy, cell, cell);
          } else {
            loupeCtx.fillStyle = `rgb(${rgba[0]},${rgba[1]},${rgba[2]})`;
            loupeCtx.fillRect(cx, cy, cell, cell);
          }
        }
      }
    }
    // Grid lines
    loupeCtx.strokeStyle = 'rgba(148,163,184,0.18)';
    loupeCtx.lineWidth = 1;
    loupeCtx.beginPath();
    for (let i = 1; i < N; i++) {
      loupeCtx.moveTo(i * cell + 0.5, 0); loupeCtx.lineTo(i * cell + 0.5, 132);
      loupeCtx.moveTo(0, i * cell + 0.5); loupeCtx.lineTo(132, i * cell + 0.5);
    }
    loupeCtx.stroke();
    // Center Reticle
    loupeCtx.strokeStyle = '#14f195';
    loupeCtx.lineWidth = 2;
    loupeCtx.strokeRect(half * cell + 1, half * cell + 1, cell - 2, cell - 2);

    const center = samplePixel(px, py) || [0, 0, 0, 0];
    const hex = center[3] < 16 ? 'TRANSP' : toHex(center);
    loupeSwatch.style.background = center[3] < 16 ? 'transparent' : hex;
    loupeHex.textContent = hex;
    loupeCoord.textContent = `${px}, ${py}`;
    if (center[3] >= 16) {
      const [L, a, b] = oklab(center[0] / 255, center[1] / 255, center[2] / 255);
      loupeLab.textContent = `OKLab ${L.toFixed(2)} · ${a >= 0 ? '+' : ''}${a.toFixed(2)} · ${b >= 0 ? '+' : ''}${b.toFixed(2)}`;
    } else {
      loupeLab.textContent = 'Alpha 0 (Transparent)';
    }
  }

  function eventToPixel(e) {
    if (!st.w || !st.h) return null;
    const r = el.getBoundingClientRect();
    let lx = e.clientX - r.left, ly = e.clientY - r.top;
    let inPaintPane = true;
    if (st.mode === 'dual') {
      if (lx >= vw / 2) lx -= vw / 2;
      else inPaintPane = false;
    } else if (st.mode === 'quad') {
      if (lx >= vw / 2) lx -= vw / 2;
      if (ly >= vh / 2) ly -= vh / 2;
      inPaintPane = false;
    }
    const rawX = Math.floor((lx - st.x) / st.z);
    const rawY = Math.floor((ly - st.y) / st.z);
    if (st.mode === 'tile') {
      if (rawX < -st.w || rawX >= st.w * 2 || rawY < -st.h || rawY >= st.h * 2) return null;
      const px = ((rawX % st.w) + st.w) % st.w;
      const py = ((rawY % st.h) + st.h) % st.h;
      return { px, py, rawX, rawY, inPaintPane, u: (px + 0.5) / st.w, v: (py + 0.5) / st.h };
    }
    if (rawX < 0 || rawY < 0 || rawX >= st.w || rawY >= st.h) return null;
    return { px: rawX, py: rawY, rawX, rawY, inPaintPane, u: (rawX + 0.5) / st.w, v: (rawY + 0.5) / st.h };
  }

  // ---- pointer & tool interaction
  let drag = null;
  let painting = null; // { tool, lastX, lastY }
  const pointers = new Map();

  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.target.closest('input, textarea, select')) { st.spaceHeld = true; syncCursor(); }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') { st.spaceHeld = false; syncCursor(); draw(); }
  });

  function syncCursor() {
    const canPaint = st.tool !== 'pan' && !st.spaceHeld && !st.picking && (st.mode === 'single' || st.mode === 'dual' || st.mode === 'tile');
    el.dataset.tool = st.picking ? 'eyedropper' : (canPaint ? st.tool : 'pan');
  }

  el.addEventListener('pointerdown', e => {
    if (e.target === handle || handle.contains(e.target) || e.target.closest('.pf-quad-badge')) return;
    if (e.target !== el && e.target !== screen) return;
    el.focus({ preventScroll: true });
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.setPointerCapture(e.pointerId);

    const hit = eventToPixel(e);
    st.hover = hit;

    // Legacy palette-add picker
    if (st.picking && e.button === 0 && pointers.size === 1) {
      if (hit && onPick) onPick(hit.u, hit.v);
      return;
    }

    const activeTool = (e.button === 1 || st.spaceHeld) ? 'pan' : (e.altKey && st.tool !== 'pan' ? 'eyedropper' : st.tool);
    const canPaint = activeTool !== 'pan' && pointers.size === 1 && e.button === 0 && hit && (hit.inPaintPane || activeTool === 'eyedropper');

    if (canPaint) {
      if (activeTool === 'eyedropper') {
        const rgba = samplePixel(hit.px, hit.py);
        if (rgba && rgba[3] >= 16) {
          const hex = toHex(rgba);
          st.brushColor = hex;
          onToolSample?.(hex, e.shiftKey);
        }
        draw();
        return;
      }
      if (activeTool === 'bucket') {
        onBucket?.({ x: hit.px, y: hit.py, color: parseColor(st.brushColor), global: st.bucketGlobal || e.shiftKey });
        return;
      }
      if (activeTool === 'line' || activeTool === 'rect') {
        st.shapeDrag = { tool: activeTool, x0: hit.rawX, y0: hit.rawY, x1: hit.rawX, y1: hit.rawY };
        draw();
        return;
      }
      if (activeTool === 'pencil' || activeTool === 'eraser') {
        painting = { tool: activeTool, lastX: hit.rawX, lastY: hit.rawY };
        onStrokeStart?.(activeTool);
        const pts = stampBrush([[hit.rawX, hit.rawY]], st.brushSize).map(([x, y]) => [
          st.mode === 'tile' ? ((x % st.w) + st.w) % st.w : x,
          st.mode === 'tile' ? ((y % st.h) + st.h) % st.h : y,
        ]);
        onStrokePoints?.(activeTool, pts, parseColor(st.brushColor));
        return;
      }
    }

    drag = { x: e.clientX, y: e.clientY, ox: st.x, oy: st.y };
    el.classList.add('panning');
  });

  el.addEventListener('pointermove', e => {
    const hit = eventToPixel(e);
    const prevHover = st.hover;
    st.hover = hit;

    if (!pointers.has(e.pointerId)) {
      if (st.loupe || (st.tool !== 'pan' && (prevHover?.rawX !== hit?.rawX || prevHover?.rawY !== hit?.rawY)) || st.mode === 'dual') {
        draw();
      }
      return;
    }

    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (d0 > 0) {
        const r = el.getBoundingClientRect();
        zoomTo(st.z * d1 / d0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      }
      drag = null;
      return;
    }

    if (st.shapeDrag && hit) {
      st.shapeDrag.x1 = hit.rawX;
      st.shapeDrag.y1 = hit.rawY;
      draw();
      return;
    }

    if (painting && hit) {
      const seg = bresenhamLine(painting.lastX, painting.lastY, hit.rawX, hit.rawY);
      painting.lastX = hit.rawX;
      painting.lastY = hit.rawY;
      const pts = stampBrush(seg, st.brushSize).map(([x, y]) => [
        st.mode === 'tile' ? ((x % st.w) + st.w) % st.w : x,
        st.mode === 'tile' ? ((y % st.h) + st.h) % st.h : y,
      ]);
      onStrokePoints?.(painting.tool, pts, parseColor(st.brushColor));
      return;
    }

    if (!drag) return;
    st.x = drag.ox + e.clientX - drag.x;
    st.y = drag.oy + e.clientY - drag.y;
    st.fitted = false;
    draw();
  });

  const end = e => {
    pointers.delete(e.pointerId);
    if (st.shapeDrag) {
      const { tool, x0, y0, x1, y1 } = st.shapeDrag;
      st.shapeDrag = null;
      const rawPts = tool === 'line' ? bresenhamLine(x0, y0, x1, y1) : rectOutlinePoints(x0, y0, x1, y1);
      const pts = stampBrush(rawPts, st.brushSize).map(([x, y]) => [
        st.mode === 'tile' ? ((x % st.w) + st.w) % st.w : x,
        st.mode === 'tile' ? ((y % st.h) + st.h) % st.h : y,
      ]);
      onStrokeStart?.('pencil');
      onStrokePoints?.('pencil', pts, parseColor(st.brushColor));
      onStrokeEnd?.('pencil');
      draw();
    }
    if (painting) {
      const doneTool = painting.tool;
      painting = null;
      onStrokeEnd?.(doneTool);
    }
    if (!pointers.size) {
      drag = null;
      el.classList.remove('panning');
      if (onViewChange) onViewChange(view());
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', () => { if (!pointers.size) { st.hover = null; draw(); } });

  el.addEventListener('wheel', e => {
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const trackpadPan = !e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > 0;
    if (trackpadPan) { st.x -= e.deltaX; st.y -= e.deltaY; st.fitted = false; draw(); return; }
    if (e.ctrlKey && e.deltaMode === 0) zoomTo(st.z * Math.exp(-e.deltaY * 0.01), cx, cy);
    else zoomStep(e.deltaY < 0 ? 1 : -1, cx, cy);
  }, { passive: false });

  el.addEventListener('dblclick', e => {
    if (st.tool === 'pan' && !e.target.closest('.pf-quad-badge')) fit();
  });

  // Split curtain drag (supports both vertical and horizontal axes)
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = el.getBoundingClientRect();
      if (st.splitAxis === 'h') {
        st.splitAt = Math.min(1, Math.max(0, (ev.clientY - r.top - st.y) / (st.h * st.z)));
      } else {
        st.splitAt = Math.min(1, Math.max(0, (ev.clientX - r.left - st.x) / (st.w * st.z)));
      }
      draw();
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
  handle.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const delta = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -0.05 : 0.05;
      st.splitAt = Math.min(1, Math.max(0, st.splitAt + delta));
      draw();
    }
  });

  new ResizeObserver(resize).observe(el);
  const view = () => ({ zoom: st.z, fitted: st.fitted, x: st.x, y: st.y, mode: st.mode });
  syncCursor();

  return {
    el,
    show(result, original, crop, rgbaData = null) {
      const sizeChanged = !st.result || result.width !== st.w || result.height !== st.h;
      const oldRect = { w: st.w * st.z, cx: st.x + st.w * st.z / 2, cy: st.y + st.h * st.z / 2 };
      st.result = result;
      st.resultData = rgbaData;
      st.original = original || st.original;
      st.crop = crop || null;
      if (sizeChanged) {
        st.w = result.width; st.h = result.height;
        if (st.fitted || !oldRect.w) fit();
        else {
          const z = oldRect.w / st.w;
          st.z = z; st.x = oldRect.cx - st.w * z / 2; st.y = oldRect.cy - st.h * z / 2;
          draw();
          if (onViewChange) onViewChange(view());
        }
      } else draw();
    },
    clear() { st.result = null; st.resultData = null; st.original = null; st.w = st.h = 0; st.fitted = true; draw(); },
    fit, zoomTo, zoomStep,
    zoomIn() { zoomStep(1); },
    zoomOut() { zoomStep(-1); },
    get zoom() { return st.z; },
    get fitted() { return st.fitted; },
    get rect() { return { x: st.x, y: st.y, width: st.w * st.z, height: st.h * st.z, zoom: st.z }; },

    // Viewport Modes
    setMode(m) {
      if (st.mode === m) return;
      st.mode = m;
      fit();
    },
    get mode() { return st.mode; },
    setSplitAxis(axis) { st.splitAxis = axis === 'h' ? 'h' : 'v'; draw(); },
    get splitAxis() { return st.splitAxis; },
    setQuadSlots(slots) { st.quadSlots = slots || []; if (st.mode === 'quad') draw(); },

    // Legacy compatibility + toggles
    setCompare(on) { this.setMode(on ? 'split' : 'single'); },
    get compare() { return st.mode === 'split'; },
    setGrid(on) { st.grid = !!on; draw(); },
    get grid() { return st.grid; },
    setLoupe(on) { st.loupe = !!on; draw(); },
    get loupe() { return st.loupe; },
    setPicking(on) { st.picking = !!on; el.classList.toggle('picking', !!on); syncCursor(); },
    get picking() { return st.picking; },

    // Pixel Retouch Tools
    setTool(t) { st.tool = t; syncCursor(); draw(); },
    get tool() { return st.tool; },
    setBrushSize(n) { st.brushSize = Math.max(1, Math.min(4, n | 0)); draw(); },
    get brushSize() { return st.brushSize; },
    setBrushColor(hex) { st.brushColor = hex; draw(); },
    get brushColor() { return st.brushColor; },
    setBucketGlobal(on) { st.bucketGlobal = !!on; },
    get bucketGlobal() { return st.bucketGlobal; },

    redraw: draw,
    resize,
  };
}
