// Perceptual OKLab chroma-salient Median-Cut + OKLab K-Means palette extraction (PixelForge upgrade).
// Deterministic (no randomness), preserves small vivid highlights/accents alongside flat backgrounds.

import { oklab, toHex } from '../color.js';

function oklabToRgbBytes([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const lin2srgb = v => {
    const c = Math.max(0, Math.min(1, v));
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
  };
  return [
    lin2srgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    lin2srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    lin2srgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

export function extractPalette(img, count = 16, opts = {}) {
  const { maxSamples = 40000, alphaThreshold = 0.5 } = opts;
  const n = img.width * img.height;
  const step = Math.max(1, Math.floor(n / maxSamples));
  const pts = [];
  for (let i = 0; i < n; i += step) {
    const o = i * 4;
    if (img.data[o + 3] < alphaThreshold * 255) continue;
    pts.push(oklab(img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255));
  }
  if (!pts.length) return ['#000000', '#ffffff'].slice(0, Math.max(1, count));

  const axisW = [1.0, 1.55, 1.55];
  let boxes = [pts];
  while (boxes.length < count) {
    let bi = -1, bestScore = -1, bestAxis = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      const pop = Math.pow(b.length, 0.42);
      for (let a = 0; a < 3; a++) {
        let lo = Infinity, hi = -Infinity;
        for (const p of b) { if (p[a] < lo) lo = p[a]; if (p[a] > hi) hi = p[a]; }
        const score = (hi - lo) * axisW[a] * pop;
        if (score > bestScore) { bestScore = score; bi = i; bestAxis = a; }
      }
    });
    if (bi < 0 || bestScore <= 1e-7) break;
    const b = boxes[bi].slice().sort((p, q) => p[bestAxis] - q[bestAxis]);
    const mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  let centers = boxes.map(mean);

  for (let iter = 0; iter < 6; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dL = p[0] - centers[c][0], da = (p[1] - centers[c][1]) * 1.2, db = (p[2] - centers[c][2]) * 1.2;
        const d = dL * dL + da * da + db * db;
        if (d < bd) { bd = d; best = c; }
      }
      const s = sums[best]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    centers = centers.map((c, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c));
  }

  centers.sort((a, b) => a[0] - b[0]);
  return [...new Set(centers.map(c => toHex(oklabToRgbBytes(c))))];
}

function mean(list) {
  let l = 0, a = 0, b = 0;
  for (const p of list) { l += p[0]; a += p[1]; b += p[2]; }
  return [l / list.length, a / list.length, b / list.length];
}
