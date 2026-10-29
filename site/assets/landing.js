// Homepage Interactive WebGL 2 Workbench (Split Curtain + 10x Pixel Loupe + Swatch Strip)
// plus Live 4-Card WebGL 2 Algorithm Showdown.
import {
  createPixelator,
  mergeSettings,
  defaultSettings,
  getPreset,
  encodeSettings,
  sortPaletteOKLab,
} from '../../lib/index.js';
import { SAMPLES, loadSample, sampleURL } from '../../lib/editor/samples.js';

const PHOTO_SAMPLES = SAMPLES.filter(s => s.photo);
const LOOKS = [
  'bgm-posterior',
  'svd-cel',
  'hybrid-crisp',
  'kurzgesagt',
  'crt-arcade',
  'chunky-ink',
  'voxel-3d',
  'pc98-cyber',
  'oscilloscope-xy',
  'cyber-blueprint',
];

const SHOWDOWN_SPECS = {
  naive: {
    size: { mode: 'width', width: 124, resample: 'box' },
    palette: { source: 'extract', count: 14, algo: 'median-cut' },
    dither: { method: 'none' },
  },
  'svd-cel': {
    size: { mode: 'width', width: 124, resample: 'hybrid' },
    adjust: { svd: 0.42, kuwahara: 2, clahe: 0.22 },
    palette: { source: 'extract', count: 16, algo: 'oklab-bgm' },
    dither: { method: 'none' },
    cleanup: { orphans: true, smooth: true },
    outline: { mode: 'ink', color: '#12101e' },
  },
  bayer: {
    size: { mode: 'width', width: 124, resample: 'sobel' },
    adjust: { clahe: 0.22 },
    palette: { source: 'extract', count: 16, algo: 'oklab-salient' },
    dither: { method: 'bayer4', strength: 0.62 },
  },
  posterior: {
    size: { mode: 'width', width: 124, resample: 'hybrid' },
    adjust: { svd: 0.3, clahe: 0.24 },
    palette: { source: 'extract', count: 16, algo: 'oklab-bgm' },
    dither: { method: 'posterior', strength: 0.65 },
    cleanup: { orphans: true },
  },
};

const stage = document.getElementById('demo-stage');
const photoBar = document.getElementById('demo-photos');
const bar = document.getElementById('demo-bar');
const pxCanvas = document.getElementById('demo-px');
const orig = document.getElementById('demo-orig');
const rightLabel = document.getElementById('demo-label-r');
const studioBtn = document.getElementById('hero-open-studio');
const swatchesEl = document.getElementById('demo-swatches');
const metaEl = document.getElementById('demo-meta');
const loupeBtn = document.getElementById('demo-loupe-btn');
const loupeBox = document.getElementById('demo-loupe');
const loupeCv = document.getElementById('demo-loupe-cv');
const loupeMeta = document.getElementById('demo-loupe-meta');

async function main() {
  const engine = await createPixelator();
  let activeSample = PHOTO_SAMPLES[0];
  let activeLook = 'bgm-posterior';
  let img = await loadSample(activeSample);
  let customPhoto = false;
  let lastResult = null;
  let loupeEnabled = false;
  let showdownGen = 0;

  const fitTo = c => {
    const r = stage.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * devicePixelRatio));
    c.height = Math.max(1, Math.round(r.height * devicePixelRatio));
  };

  const drawOriginal = () => {
    if (!img) return;
    fitTo(orig);
    const g = orig.getContext('2d');
    g.imageSmoothingQuality = 'high';
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(orig.width / iw, orig.height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    g.clearRect(0, 0, orig.width, orig.height);
    g.drawImage(img, (orig.width - dw) * 0.5, (orig.height - dh) * 0.5, dw, dh);
  };
  drawOriginal();

  // ---- Scenic View Photo Switcher + Custom Photo Upload
  const photoBtns = PHOTO_SAMPLES.map(smp => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'photo-pill';
    b.setAttribute('aria-pressed', String(smp === activeSample));
    b.title = `${smp.name} — ${smp.subtitle || ''}`;
    const thumb = document.createElement('img');
    thumb.src = sampleURL(smp);
    thumb.alt = '';
    const txt = document.createElement('span');
    txt.textContent = smp.name;
    b.append(thumb, txt);
    b.addEventListener('click', async () => {
      activeSample = smp;
      customPhoto = false;
      photoBtns.forEach(x => x.b.setAttribute('aria-pressed', String(x.smp === smp)));
      uploadBtn.setAttribute('aria-pressed', 'false');
      img = await loadSample(smp);
      engine.invalidate();
      drawOriginal();
      await show(activeLook);
      renderShowdown();
    });
    photoBar.append(b);
    return { smp, b };
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;
  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'photo-pill upload';
  uploadBtn.setAttribute('aria-pressed', 'false');
  uploadBtn.textContent = '+ Upload Photo';
  uploadBtn.title = 'Test PixelForge live on any photo from your device';
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    try {
      img = await createImageBitmap(f);
    } catch {
      const el = new Image();
      el.src = URL.createObjectURL(f);
      await el.decode();
      img = el;
    }
    customPhoto = true;
    photoBtns.forEach(x => x.b.setAttribute('aria-pressed', 'false'));
    uploadBtn.setAttribute('aria-pressed', 'true');
    engine.invalidate();
    drawOriginal();
    await show(activeLook);
    renderShowdown();
  });
  photoBar.append(uploadBtn, fileInput);

  // ---- Signature Preset Chips
  const FALLBACK_SWATCH = {
    'bgm-posterior': ['#14f195', '#38bdf8', '#fbbf24', '#1e293b'],
    'svd-cel': ['#fb7185', '#38bdf8', '#34d399', '#12101e'],
    'hybrid-crisp': ['#10d9a0', '#38bdf8', '#f4b860', '#1d3557'],
    'oscilloscope-xy': ['#04160e', '#0c5c30', '#14f576', '#a8ffd2'],
    'cyber-blueprint': ['#071936', '#0e4585', '#38bdf8', '#e0f2fe'],
  };

  const chips = LOOKS.map(id => {
    const p = getPreset(id);
    const s = mergeSettings(defaultSettings(), p.settings);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', 'false');
    b.title = p.description;
    const sw = document.createElement('span');
    sw.className = 'sw';
    const cols = s.palette.colors.length ? s.palette.colors : (FALLBACK_SWATCH[id] || ['#14f195', '#38bdf8', '#f59e0b', '#0f172a']);
    for (const c of cols.slice(0, 5)) {
      const i = document.createElement('i');
      i.style.background = c;
      sw.append(i);
    }
    b.append(sw, document.createTextNode(p.name));
    b.addEventListener('click', () => show(id));
    bar.append(b);
    return { id, p, b, s };
  });

  function syncStudioLink(settings) {
    if (!studioBtn) return;
    const hash = `#s=${encodeSettings(settings)}`;
    const q = !customPhoto && activeSample ? `?sample=${encodeURIComponent(activeSample.id)}` : '';
    studioBtn.href = `./editor/${q}${hash}`;
  }

  async function show(id) {
    activeLook = id;
    const c = chips.find(x => x.id === id) || chips[0];
    chips.forEach(x => x.b.setAttribute('aria-pressed', String(x === c)));
    const s = mergeSettings(c.s, {
      frame: { aspect: '16:10' },
      size: { width: Math.min(c.s.size.width, 164) },
    });
    const res = await engine.process(img, s);
    lastResult = res;
    res.toCanvas(1, { canvas: pxCanvas });
    const used = sortPaletteOKLab(res.usedColors());
    rightLabel.textContent = `${c.p.name} · ${used.length} cols`;
    const msTxt = res.ms < 10 ? res.ms.toFixed(1) : Math.round(res.ms);
    metaEl.textContent = `${res.width}×${res.height} px · ${res.backend === 'webgl' ? 'WebGL 2' : 'CPU'} ${msTxt} ms`;
    swatchesEl.innerHTML = used.slice(0, 18).map(hex => `<button type="button" style="background:${hex}" data-copy="${hex}" title="Copy ${hex}"></button>`).join('');
    syncStudioLink(c.s);
  }

  // ---- Live 4-Card WebGL 2 Algorithm Showdown
  async function renderShowdown() {
    const gen = ++showdownGen;
    const cards = document.querySelectorAll('#showdown-grid .show-card');
    for (const card of cards) {
      if (gen !== showdownGen) return;
      const key = card.dataset.case;
      const spec = SHOWDOWN_SPECS[key];
      if (!spec) continue;
      const cfg = mergeSettings(defaultSettings(), { ...spec, frame: { aspect: '16:10' } });
      const res = await engine.process(img, cfg);
      if (gen !== showdownGen) return;
      res.toCanvas(1, { canvas: card.querySelector('canvas') });
    }
  }

  // ---- Interactive 10x Pixel Loupe Magnifier on Hero Stage
  loupeBtn.addEventListener('click', () => {
    loupeEnabled = !loupeEnabled;
    loupeBtn.setAttribute('aria-pressed', String(loupeEnabled));
    if (!loupeEnabled) loupeBox.hidden = true;
  });

  function updateLoupe(e) {
    if (!loupeEnabled || !lastResult) {
      loupeBox.hidden = true;
      return;
    }
    const r = stage.getBoundingClientRect();
    const u = Math.max(0, Math.min(0.9999, (e.clientX - r.left) / r.width));
    const v = Math.max(0, Math.min(0.9999, (e.clientY - r.top) / r.height));
    const px = Math.floor(u * lastResult.width);
    const py = Math.floor(v * lastResult.height);

    const N = 11;
    const half = 5;
    const cell = 10;
    const g = loupeCv.getContext('2d');
    g.clearRect(0, 0, loupeCv.width, loupeCv.height);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const sx = Math.max(0, Math.min(lastResult.width - 1, px + dx));
        const sy = Math.max(0, Math.min(lastResult.height - 1, py + dy));
        const o = (sy * lastResult.width + sx) * 4;
        g.fillStyle = `rgb(${lastResult.data[o]},${lastResult.data[o + 1]},${lastResult.data[o + 2]})`;
        g.fillRect((dx + half) * cell, (dy + half) * cell, cell, cell);
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.88)';
    g.lineWidth = 1.5;
    g.strokeRect(half * cell + 0.5, half * cell + 0.5, cell - 1, cell - 1);

    const co = (py * lastResult.width + px) * 4;
    const hex = '#' + [lastResult.data[co], lastResult.data[co + 1], lastResult.data[co + 2]]
      .map(n => n.toString(16).padStart(2, '0')).join('');
    loupeMeta.innerHTML = `<i style="background:${hex}"></i><b>${hex}</b><span>(${px}, ${py})</span>`;

    const lx = Math.min(r.width - 134, Math.max(10, e.clientX - r.left + 16));
    const ly = Math.min(r.height - 148, Math.max(10, e.clientY - r.top - 136));
    loupeBox.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px)`;
    loupeBox.hidden = false;
  }

  // ---- Split Curtain Dragging + Loupe Tracking
  let split = 0.44;
  const setSplit = v => {
    split = Math.max(0.03, Math.min(0.97, v));
    stage.style.setProperty('--split', `${(split * 100).toFixed(2)}%`);
  };
  setSplit(split);

  let down = false;
  const moveSplit = e => {
    const r = stage.getBoundingClientRect();
    setSplit((e.clientX - r.left) / r.width);
  };
  stage.addEventListener('pointerdown', e => {
    down = true;
    stage.setPointerCapture(e.pointerId);
    moveSplit(e);
    updateLoupe(e);
  });
  stage.addEventListener('pointermove', e => {
    if (down) moveSplit(e);
    updateLoupe(e);
  });
  stage.addEventListener('pointerup', () => { down = false; });
  stage.addEventListener('pointercancel', () => { down = false; });
  stage.addEventListener('pointerleave', () => { loupeBox.hidden = true; });
  window.addEventListener('resize', drawOriginal);

  await show('bgm-posterior');
  renderShowdown();
}

main().catch(err => console.warn('[PixelForge Workbench]', err));
