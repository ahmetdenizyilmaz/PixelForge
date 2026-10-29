// Landing page live WebGL 2 demo on real scenic view photographs with photo switcher, custom upload, and PixelForge preset looks.
import { createPixelator, mergeSettings, defaultSettings, getPreset, encodeSettings } from '../../lib/index.js';
import { SAMPLES, loadSample, sampleURL } from '../../lib/editor/samples.js';

const PHOTO_SAMPLES = SAMPLES.filter(s => s.photo);
const LOOKS = [
  'hybrid-crisp',
  'kurzgesagt',
  'crt-arcade',
  'chunky-ink',
  'pc98-cyber',
  'voxel-3d',
  'oscilloscope-xy',
  'pico-8',
  'game-boy',
];

const stage = document.getElementById('demo-stage');
const photoBar = document.getElementById('demo-photos');
const bar = document.getElementById('demo-bar');
const pxCanvas = document.getElementById('demo-px');
const orig = document.getElementById('demo-orig');
const rightLabel = document.getElementById('demo-label-r');
const studioBtn = document.getElementById('hero-open-studio');

async function main() {
  const engine = await createPixelator();
  let activeSample = PHOTO_SAMPLES[0];
  let activeLook = 'hybrid-crisp';
  let img = await loadSample(activeSample);
  let customPhoto = false;

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
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const scale = Math.max(orig.width / iw, orig.height / ih);
    const dw = iw * scale, dh = ih * scale;
    g.clearRect(0, 0, orig.width, orig.height);
    g.drawImage(img, (orig.width - dw) * 0.5, (orig.height - dh) * 0.5, dw, dh);
  };
  drawOriginal();

  // ---- Top scenic view photo switcher
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
      drawOriginal();
      await show(activeLook);
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
  uploadBtn.textContent = '+ Your photo';
  uploadBtn.title = 'Test PixelForge right here on any photo from your computer';
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
    drawOriginal();
    await show(activeLook);
  });
  photoBar.append(uploadBtn, fileInput);

  // ---- Bottom signature preset chips
  const FALLBACK_SWATCH = {
    'hybrid-crisp': ['#10d9a0', '#38bdf8', '#f4b860', '#1d3557'],
    'oscilloscope-xy': ['#04160e', '#0c5c30', '#14f576', '#a8ffd2'],
  };
  const meta = document.createElement('span');
  meta.className = 'demo-meta';
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
    const cols = s.palette.colors.length ? s.palette.colors : (FALLBACK_SWATCH[id] || ['#10d9a0', '#38bdf8', '#f59e0b', '#0f172a']);
    for (const c of cols.slice(0, 6)) {
      const i = document.createElement('i');
      i.style.background = c;
      sw.append(i);
    }
    b.append(sw, document.createTextNode(p.name));
    b.addEventListener('click', () => show(id));
    bar.append(b);
    return { id, p, b, s };
  });
  bar.append(meta);

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
      frame: { aspect: '3:2' },
      size: { width: Math.min(c.s.size.width, 160) },
    });
    const r = await engine.process(img, s);
    r.toCanvas(1, { canvas: pxCanvas });
    if (rightLabel) rightLabel.textContent = `PixelForge · ${c.p.name}`;
    meta.textContent = `${r.width} × ${r.height} px · ${r.usedColors().length} colours · ${r.ms < 10 ? r.ms.toFixed(1) : Math.round(r.ms)} ms (${r.backend === 'webgl' ? 'WebGL 2' : 'CPU'})`;
    syncStudioLink(c.s);
  }

  // drag to compare
  const setSplit = x => {
    const r = stage.getBoundingClientRect();
    stage.style.setProperty('--split', `${Math.min(100, Math.max(0, (x - r.left) / r.width * 100))}%`);
  };
  stage.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) setSplit(e.clientX); });
  stage.addEventListener('pointerdown', e => setSplit(e.clientX));
  new ResizeObserver(drawOriginal).observe(stage);

  await show('hybrid-crisp');
}

main().catch(err => {
  bar.textContent = `The live demo needs a current browser (${err.message}).`;
});
