// Examples gallery: render each card's thumbnail live with the PixelForge WebGL 2 / CPU engine.
import { createPixelator, mergeSettings, defaultSettings } from '../../lib/index.js';
import { findSample, loadSample } from '../../lib/editor/samples.js';

const cards = [...document.querySelectorAll('canvas.ex-thumb')];
if (cards.length) {
  const engine = await createPixelator();
  const images = new Map();
  for (const c of cards) {
    const smp = findSample(c.dataset.sample || 'mountain-fjord');
    if (!images.has(smp.id)) images.set(smp.id, await loadSample(smp));
    let preview = {};
    try { preview = JSON.parse(c.dataset.preset || '{}'); } catch { /* keep defaults */ }
    const s = mergeSettings(mergeSettings(defaultSettings(), preview), { size: { mode: 'width', width: 96, height: 64 } });
    const r = await engine.process(images.get(smp.id), s);
    r.toCanvas(1, { canvas: c });
  }
}
