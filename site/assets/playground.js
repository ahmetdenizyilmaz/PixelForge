// Interactive WebGL 2 Algorithm & Game-Asset Lab (/playground/).
import {
  createPixelator,
  defaultSettings,
  mergeSettings,
  encodeSettings,
  generateHarmonyRamp,
  sortPaletteOKLab,
  buildTileset,
  encodePNG,
  createZip,
  toGPL,
  toHexFile,
  downloadBlob,
} from '../../lib/index.js';

const photosEl = document.getElementById('lab-photos');
const uploadEl = document.getElementById('lab-upload');
const gpuBadge = document.getElementById('lab-gpu-badge');
const openStudioTop = document.getElementById('lab-open-studio');

let activeTab = 'dither';
let currentSample = 'mountain-fjord';
let sourceImg = null;
let engine = null;
let lastTilesetArchive = null;
let currentHarmonyColors = [];

function loadPhoto(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function studioHref(settings) {
  const hash = `#s=${encodeSettings(mergeSettings(defaultSettings(), settings))}`;
  const q = currentSample ? `?sample=${encodeURIComponent(currentSample)}` : '';
  return `../editor/${q}${hash}`;
}

// ================================================================ LAB 1: DITHER ARENA
const DITHER_CASES = [
  { id: 'posterior', title: 'Bayesian Posterior (OKLab)', badge: 'Signature', desc: '2-nearest OKLab Boltzmann posterior over 64×64 Blue Noise. Zero 3rd-color bleed.' },
  { id: 'bluenoise', title: '64×64 Void & Cluster', badge: 'Filmic', desc: 'Organic blue-noise stippling without repetitive diagonal grid lines.' },
  { id: 'bayer8', title: 'Ordered Bayer 8×8', badge: 'Retro GPU', desc: 'Classic structured crosshatch ideal for PC-98, Genesis, and GBA scenes.' },
  { id: 'atkinson', title: 'Atkinson Bounded', badge: 'Crisp 75%', desc: 'Propagates 6/8 of quantization error to preserve crisp midtone contrast.' },
  { id: 'cluster4', title: 'Clustered 4×4 Halftone', badge: 'Print', desc: 'Dot-screen halftone stipple suited for comic and zine aesthetics.' },
  { id: 'none', title: 'Hard OKLab Centroids', badge: 'Clean Cel', desc: 'Zero dither; pure Hybrid Bimodal-Plateau clusters + adaptive contours.' },
];

const ditherGrid = document.getElementById('dither-grid');
const ditherCards = DITHER_CASES.map(c => {
  const el = document.createElement('article');
  el.className = 'lab-card';
  el.innerHTML = `
    <div class="lab-card-head">
      <div><b>${c.title}</b> <em class="lab-badge">${c.badge}</em></div>
      <span class="lab-ms">—</span>
    </div>
    <div class="lab-canvas-box"><canvas></canvas></div>
    <div class="lab-card-foot">
      <p>${c.desc}</p>
      <a class="lab-link" href="../editor/">Open in Workstation →</a>
    </div>
  `;
  ditherGrid.append(el);
  return { ...c, el, canvas: el.querySelector('canvas'), ms: el.querySelector('.lab-ms'), link: el.querySelector('.lab-link') };
});

async function renderDitherLab(gen) {
  const width = Number(document.getElementById('d-w').value);
  const strength = Number(document.getElementById('d-str').value) / 100;
  const count = Number(document.getElementById('d-pal').value);
  document.getElementById('d-w-val').textContent = `${width} px`;
  document.getElementById('d-str-val').textContent = `${Math.round(strength * 100)}%`;
  document.getElementById('d-pal-val').textContent = String(count);

  for (const card of ditherCards) {
    if (gen !== renderGen) return;
    const cfg = {
      size: { mode: 'width', width, resample: 'hybrid' },
      adjust: { contrast: 0.08, saturation: 0.1, svd: 0.2, kuwahara: 1, clahe: 0.25 },
      palette: { source: 'extract', algo: 'oklab-bgm', count },
      dither: { method: card.id, strength },
      cleanup: { orphans: card.id === 'none' },
      outline: { mode: card.id === 'none' ? 'ink' : 'none', color: '#141020' },
    };
    const r = await engine.process(sourceImg, cfg);
    if (gen !== renderGen) return;
    r.toCanvas(1, { canvas: card.canvas });
    card.ms.textContent = `${r.usedColors().length} cols · ${r.ms < 10 ? r.ms.toFixed(1) : Math.round(r.ms)} ms`;
    card.link.href = studioHref(cfg);
  }
}

// ================================================================ LAB 2: PALETTE DISCOVERY
const PALETTE_ALGOS = [
  { id: 'oklab-bgm', title: 'OKLab-BGM (Gaussian Mixture EM)', badge: 'Recommended', desc: '7-iteration regularized EM fitting anisotropic diagonal covariances & Dirichlet priors in OKLab.' },
  { id: 'oklab-salient', title: 'OKLab Salient K-Means++', badge: 'Fast Focal', desc: 'Chroma- and edge-weighted perceptual clustering prioritizing vivid focal accents.' },
  { id: 'median-cut', title: 'Perceptual Median-Cut', badge: 'Balanced Box', desc: 'Recursive longest-axis perceptual partition producing uniform tonal coverage.' },
];

const paletteGrid = document.getElementById('palette-grid');
const paletteCards = PALETTE_ALGOS.map(a => {
  const el = document.createElement('article');
  el.className = 'lab-card';
  el.innerHTML = `
    <div class="lab-card-head">
      <div><b>${a.title}</b> <em class="lab-badge">${a.badge}</em></div>
      <span class="lab-ms">—</span>
    </div>
    <div class="lab-canvas-box"><canvas></canvas></div>
    <div class="lab-swatches"></div>
    <div class="lab-card-foot">
      <p>${a.desc}</p>
      <div class="lab-foot-btns">
        <button type="button" class="lab-mini-btn dl-gpl">Download .GPL</button>
        <a class="lab-link" href="../editor/">Workstation →</a>
      </div>
    </div>
  `;
  paletteGrid.append(el);
  return {
    ...a,
    canvas: el.querySelector('canvas'),
    ms: el.querySelector('.lab-ms'),
    swatches: el.querySelector('.lab-swatches'),
    gplBtn: el.querySelector('.dl-gpl'),
    link: el.querySelector('.lab-link'),
    colors: [],
  };
});

paletteCards.forEach(card => {
  card.gplBtn.addEventListener('click', () => {
    if (!card.colors.length) return;
    downloadBlob(toGPL(`PixelForge ${card.id}`, card.colors), `pixelforge-${card.id}.gpl`, 'text/plain');
  });
});

async function renderPaletteLab(gen) {
  const count = Number(document.getElementById('p-cnt').value);
  const svd = Number(document.getElementById('p-svd').value) / 100;
  const width = Number(document.getElementById('p-w').value);
  document.getElementById('p-cnt-val').textContent = `${count} colors`;
  document.getElementById('p-svd-val').textContent = `${Math.round(svd * 100)}%`;
  document.getElementById('p-w-val').textContent = `${width} px`;

  for (const card of paletteCards) {
    if (gen !== renderGen) return;
    const cfg = {
      size: { mode: 'width', width, resample: 'hybrid' },
      adjust: { contrast: 0.08, saturation: 0.12, svd, kuwahara: 1, clahe: 0.25 },
      palette: { source: 'extract', algo: card.id, count },
      dither: { method: 'posterior', strength: 0.45 },
    };
    engine.invalidate();
    const r = await engine.process(sourceImg, cfg);
    if (gen !== renderGen) return;
    r.toCanvas(1, { canvas: card.canvas });
    const sorted = sortPaletteOKLab(r.usedColors());
    card.colors = sorted;
    card.ms.textContent = `${sorted.length} active · ${r.ms < 10 ? r.ms.toFixed(1) : Math.round(r.ms)} ms`;
    card.swatches.innerHTML = sorted.map(hex => `<button type="button" style="background:${hex}" title="Copy ${hex}" data-copy="${hex}"></button>`).join('');
    card.link.href = studioHref(cfg);
  }
}

// ================================================================ LAB 3: TILESET VISUALIZER
async function renderTilesetLab(gen) {
  const tile = Number(document.getElementById('t-size').value);
  const width = Number(document.getElementById('t-w').value);
  const flips = document.getElementById('t-flips').checked;
  document.getElementById('t-w-val').textContent = `${width} px`;

  const cfg = {
    size: { mode: 'width', width, resample: 'hybrid' },
    adjust: { contrast: 0.1, svd: 0.25, kuwahara: 2, clahe: 0.22 },
    palette: { source: 'extract', algo: 'oklab-bgm', count: 12 },
    dither: { method: 'none', strength: 0.3 },
    cleanup: { orphans: true, smooth: true },
  };
  const r = await engine.process(sourceImg, cfg);
  if (gen !== renderGen) return;

  const ts = buildTileset({ width: r.width, height: r.height, data: r.data }, { tileWidth: tile, tileHeight: tile, columns: 16, flips });
  const totalCells = ts.map.width * ts.map.height;
  const saved = Math.max(0, totalCells - ts.count);
  const pct = totalCells > 0 ? Math.round((saved / totalCells) * 100) : 0;
  const flippedCells = (ts.map.flips || []).filter(f => f > 0).length;

  document.getElementById('tile-stats').innerHTML = `
    <div class="lab-stat"><b>${ts.map.width} × ${ts.map.height}</b><span>Map Grid (${totalCells} cells)</span></div>
    <div class="lab-stat"><b>${ts.count}</b><span>Unique ${tile}×${tile} Atlas Tiles</span></div>
    <div class="lab-stat"><b>${flippedCells}</b><span>Mirror-Flipped Cells Reused</span></div>
    <div class="lab-stat accent"><b>-${pct}% VRAM</b><span>${saved} Duplicate Tiles Eliminated</span></div>
  `;

  // Draw scene with subtle tile grid overlay
  const sceneCv = document.getElementById('t-scene-cv');
  const scale = 2;
  sceneCv.width = r.width * scale;
  sceneCv.height = r.height * scale;
  const sg = sceneCv.getContext('2d');
  sg.imageSmoothingEnabled = false;
  const tmp = r.toCanvas(1);
  sg.drawImage(tmp, 0, 0, sceneCv.width, sceneCv.height);
  sg.strokeStyle = 'rgba(20, 241, 149, 0.26)';
  sg.lineWidth = 1;
  sg.beginPath();
  for (let x = tile * scale; x < sceneCv.width; x += tile * scale) { sg.moveTo(x + 0.5, 0); sg.lineTo(x + 0.5, sceneCv.height); }
  for (let y = tile * scale; y < sceneCv.height; y += tile * scale) { sg.moveTo(0, y + 0.5); sg.lineTo(sceneCv.width, y + 0.5); }
  sg.stroke();
  document.getElementById('t-scene-dim').textContent = `${r.width} × ${r.height} px`;

  // Draw packed tile atlas
  const atlasCv = document.getElementById('t-atlas-cv');
  atlasCv.width = ts.image.width;
  atlasCv.height = ts.image.height;
  atlasCv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(ts.image.data), ts.image.width, ts.image.height), 0, 0);
  document.getElementById('t-atlas-dim').textContent = `${ts.image.width} × ${ts.image.height} px (${ts.count} tiles)`;

  lastTilesetArchive = async () => {
    const png = await encodePNG(ts.image);
    const json = new TextEncoder().encode(JSON.stringify(ts.map, null, 2));
    const zip = createZip([
      { name: 'tileset.png', data: png },
      { name: 'tilemap.json', data: json },
    ]);
    downloadBlob(zip, `pixelforge-tileset-${tile}px.zip`, 'application/zip');
  };
}

document.getElementById('t-download').addEventListener('click', () => {
  if (lastTilesetArchive) lastTilesetArchive();
});

// ================================================================ LAB 4: OKLAB HARMONY DESIGNER
async function renderHarmonyLab(gen) {
  const mode = document.getElementById('h-mode').value;
  const baseHue = Number(document.getElementById('h-hue').value);
  const count = Number(document.getElementById('h-cnt').value);
  const chroma = Number(document.getElementById('h-chr').value);
  const hueShift = Number(document.getElementById('h-shf').value);

  document.getElementById('h-hue-val').textContent = `${baseHue}°`;
  document.getElementById('h-cnt-val').textContent = String(count);
  document.getElementById('h-chr-val').textContent = chroma.toFixed(2);
  document.getElementById('h-shf-val').textContent = hueShift.toFixed(2);

  const colors = generateHarmonyRamp({ baseHue, mode, count, chroma, hueShift });
  currentHarmonyColors = colors;

  const strip = document.getElementById('h-strip');
  strip.innerHTML = colors.map(hex => `<button type="button" style="background:${hex}" data-copy="${hex}" title="Click to copy ${hex}"><span>${hex}</span></button>`).join('');

  const cfg = {
    size: { mode: 'width', width: 184, resample: 'hybrid' },
    adjust: { contrast: 0.1, clahe: 0.25, kuwahara: 1 },
    palette: { source: 'custom', name: `OKLab ${mode} ${baseHue}°`, colors },
    dither: { method: 'posterior', strength: 0.5 },
    outline: { mode: 'ink', color: '#141020' },
  };
  document.getElementById('h-open-studio').href = studioHref(cfg);

  const r = await engine.process(sourceImg, cfg);
  if (gen !== renderGen) return;
  const cv = document.getElementById('h-preview-cv');
  r.toCanvas(1, { canvas: cv });
  document.getElementById('h-meta').textContent = `${r.width} × ${r.height} px · ${r.usedColors().length}/${colors.length} swatches active · ${r.ms.toFixed(1)} ms`;
}

document.getElementById('h-copy-hex').addEventListener('click', e => {
  if (!currentHarmonyColors.length) return;
  navigator.clipboard.writeText(toHexFile(currentHarmonyColors)).then(() => {
    const btn = e.currentTarget;
    const old = btn.textContent;
    btn.textContent = 'Copied .HEX!';
    setTimeout(() => { btn.textContent = old; }, 1200);
  });
});

document.getElementById('h-dl-gpl').addEventListener('click', () => {
  if (!currentHarmonyColors.length) return;
  const mode = document.getElementById('h-mode').value;
  const hue = document.getElementById('h-hue').value;
  downloadBlob(toGPL(`PixelForge ${mode} ${hue}deg`, currentHarmonyColors), `pixelforge-${mode}-${hue}.gpl`, 'text/plain');
});

// ================================================================ ORCHESTRATOR
let renderGen = 0;
let rafPending = false;

function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(async () => {
    rafPending = false;
    if (!engine || !sourceImg) return;
    const gen = ++renderGen;
    openStudioTop.href = currentSample ? `../editor/?sample=${encodeURIComponent(currentSample)}` : '../editor/';
    try {
      if (activeTab === 'dither') await renderDitherLab(gen);
      else if (activeTab === 'palette') await renderPaletteLab(gen);
      else if (activeTab === 'tileset') await renderTilesetLab(gen);
      else if (activeTab === 'harmony') await renderHarmonyLab(gen);
    } catch (err) {
      console.error('[Interactive Lab]', err);
    }
  });
}

document.querySelectorAll('[data-lab-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.labTab;
    document.querySelectorAll('[data-lab-tab]').forEach(b => b.setAttribute('aria-selected', String(b === btn)));
    document.querySelectorAll('[data-lab-pane]').forEach(p => { p.hidden = p.dataset.labPane !== activeTab; });
    scheduleRender();
  });
});

document.querySelectorAll('.lab-controls input, .lab-controls select').forEach(inp => {
  inp.addEventListener('input', scheduleRender);
  inp.addEventListener('change', scheduleRender);
});

photosEl.addEventListener('click', async e => {
  const pill = e.target.closest('button.photo-pill[data-photo]');
  if (!pill) return;
  photosEl.querySelectorAll('button.photo-pill').forEach(b => b.setAttribute('aria-pressed', String(b === pill)));
  try {
    sourceImg = await loadPhoto(pill.dataset.photo);
    currentSample = pill.dataset.sample || '';
    engine?.invalidate();
    scheduleRender();
  } catch (err) {
    console.warn(err);
  }
});

uploadEl.addEventListener('change', () => {
  const file = uploadEl.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadPhoto(url).then(img => {
    sourceImg = img;
    currentSample = '';
    photosEl.querySelectorAll('button.photo-pill').forEach(b => b.setAttribute('aria-pressed', 'false'));
    engine?.invalidate();
    scheduleRender();
  });
});

(async () => {
  try {
    [engine, sourceImg] = await Promise.all([
      createPixelator(),
      loadPhoto('../assets/photos/mountain-fjord.jpg'),
    ]);
    gpuBadge.textContent = engine.backend === 'webgl' ? 'WebGL 2 GPU Active' : 'CPU Reference Active';
    scheduleRender();
  } catch (err) {
    gpuBadge.textContent = `Init error: ${err.message}`;
  }
})();
