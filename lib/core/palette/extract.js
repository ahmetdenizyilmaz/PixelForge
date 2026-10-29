// Perceptual OKLab palette discovery & procedural OKLab Color-Ramp Harmony Generator:
// Supports 3 deterministic extractors:
//   1. 'oklab-bgm'     — Chroma-seeded Regularized Bayesian Gaussian Mixture EM in OKLab space
//   2. 'oklab-salient' — Chroma-weighted OKLab Median-Cut + K-Means refinement
//   3. 'median-cut'    — Classic uniform Median-Cut

import { oklab, parseColor, toHex } from '../color.js';

export function oklabToRgbBytes([L, a, b]) {
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
  const { maxSamples = 40000, alphaThreshold = 0.5, algo = 'oklab-bgm' } = opts;
  const n = img.width * img.height;
  const step = Math.max(1, Math.floor(n / maxSamples));
  const pts = [];
  for (let i = 0; i < n; i += step) {
    const o = i * 4;
    if (img.data[o + 3] < alphaThreshold * 255) continue;
    pts.push(oklab(img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255));
  }
  if (!pts.length) return ['#000000', '#ffffff'].slice(0, Math.max(1, count));

  const classic = algo === 'median-cut';
  const axisW = classic ? [1.0, 1.0, 1.0] : [1.0, 1.55, 1.55];
  const popExp = classic ? 0.55 : 0.42;

  let boxes = [pts];
  while (boxes.length < count) {
    let bi = -1, bestScore = -1, bestAxis = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      const pop = Math.pow(b.length, popExp);
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

  if (algo === 'oklab-bgm' && centers.length > 1) {
    centers = refineBGM(pts, boxes, centers);
  } else if (algo === 'oklab-salient') {
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
  }

  centers.sort((a, b) => a[0] - b[0]);
  return [...new Set(centers.map(c => toHex(oklabToRgbBytes(c))))];
}

function refineBGM(pts, boxes, seeds) {
  const K = seeds.length;
  const N = pts.length;
  // Cap EM sample set to 8192 evenly spaced points for sub-3ms browser execution
  const emStep = Math.max(1, Math.floor(N / 8192));
  const sample = emStep === 1 ? pts : pts.filter((_, idx) => idx % emStep === 0);
  const M = sample.length;

  const mu = seeds.map(c => [c[0], c[1], c[2]]);
  const pi = boxes.map(b => Math.max(1 / (K * 8), b.length / N));
  const vars = boxes.map((b, k) => {
    let v0 = 0, v1 = 0, v2 = 0;
    const m = mu[k];
    for (const p of b) {
      v0 += (p[0] - m[0]) * (p[0] - m[0]);
      v1 += (p[1] - m[1]) * (p[1] - m[1]);
      v2 += (p[2] - m[2]) * (p[2] - m[2]);
    }
    const d = Math.max(1, b.length);
    return [Math.max(0.0012, v0 / d), Math.max(0.0008, v1 / d), Math.max(0.0008, v2 / d)];
  });

  const alphaPrior = 0.35;
  const tauPrior = 0.45;
  const logR = new Float64Array(K);
  const resp = new Float64Array(K);

  for (let iter = 0; iter < 7; iter++) {
    const nk = new Float64Array(K);
    const s0 = new Float64Array(K), s1 = new Float64Array(K), s2 = new Float64Array(K);
    const q0 = new Float64Array(K), q1 = new Float64Array(K), q2 = new Float64Array(K);

    const logPi = pi.map(w => Math.log(Math.max(1e-9, w)));
    const halfLogDet = vars.map(v => 0.5 * (Math.log(v[0]) + Math.log(v[1]) + Math.log(v[2])));
    const inv2Var = vars.map(v => [0.5 / v[0], 0.65 / v[1], 0.65 / v[2]]);

    for (let i = 0; i < M; i++) {
      const p = sample[i];
      let maxLog = -Infinity;
      for (let k = 0; k < K; k++) {
        const m = mu[k], iv = inv2Var[k];
        const d0 = p[0] - m[0], d1 = p[1] - m[1], d2 = p[2] - m[2];
        const lv = logPi[k] - halfLogDet[k] - (d0 * d0 * iv[0] + d1 * d1 * iv[1] + d2 * d2 * iv[2]);
        logR[k] = lv;
        if (lv > maxLog) maxLog = lv;
      }
      let sumExp = 0;
      for (let k = 0; k < K; k++) {
        const e = Math.exp(logR[k] - maxLog);
        resp[k] = e;
        sumExp += e;
      }
      const invSum = 1 / Math.max(1e-12, sumExp);
      for (let k = 0; k < K; k++) {
        const r = resp[k] * invSum;
        nk[k] += r;
        s0[k] += r * p[0]; s1[k] += r * p[1]; s2[k] += r * p[2];
        const d0 = p[0] - mu[k][0], d1 = p[1] - mu[k][1], d2 = p[2] - mu[k][2];
        q0[k] += r * d0 * d0; q1[k] += r * d1 * d1; q2[k] += r * d2 * d2;
      }
    }

    const denomPi = M + K * alphaPrior;
    for (let k = 0; k < K; k++) {
      pi[k] = (nk[k] + alphaPrior) / denomPi;
      const dm = nk[k] + tauPrior;
      mu[k][0] = (s0[k] + tauPrior * seeds[k][0]) / dm;
      mu[k][1] = (s1[k] + tauPrior * seeds[k][1]) / dm;
      mu[k][2] = (s2[k] + tauPrior * seeds[k][2]) / dm;
      const dv = nk[k] + 1.0;
      vars[k][0] = Math.max(0.0009, (q0[k] + 0.0018) / dv);
      vars[k][1] = Math.max(0.0006, (q1[k] + 0.0012) / dv);
      vars[k][2] = Math.max(0.0006, (q2[k] + 0.0012) / dv);
    }
  }
  return mu;
}

/** Sort hex colours by perceptual OKLab Lightness (L) and Hue angle. */
export function sortPaletteOKLab(colors = []) {
  return colors.slice().sort((ca, cb) => {
    const [r1, g1, b1] = parseColor(ca), [r2, g2, b2] = parseColor(cb);
    const o1 = oklab(r1 / 255, g1 / 255, b1 / 255);
    const o2 = oklab(r2 / 255, g2 / 255, b2 / 255);
    if (Math.abs(o1[0] - o2[0]) > 0.025) return o1[0] - o2[0];
    return Math.atan2(o1[2], o1[1]) - Math.atan2(o2[2], o2[1]);
  });
}

/**
 * Procedural Pixel-Art OKLab Color-Ramp Harmony Generator.
 * Builds hue-shifted shading ramps (cool shadows -> vivid midtones -> warm highlights).
 * Supports both { baseHue, mode, count, chroma, hueShift } and { seedHex, scheme, ramps, steps, hueShift }.
 */
export function generateHarmonyRamp(opts = {}) {
  const {
    seedHex = '#10d9a0',
    baseHue,
    mode,
    scheme,
    count,
    chroma,
    ramps = 4,
    steps = 5,
    hueShift = 0.55,
  } = opts;

  let baseH, baseC;
  if (baseHue !== undefined && baseHue !== null) {
    baseH = (Number(baseHue) * Math.PI) / 180;
    baseC = Math.max(0.03, Math.min(0.28, chroma !== undefined ? Number(chroma) : 0.14));
  } else {
    const [sr, sg, sb] = parseColor(seedHex);
    const [, sa, sB] = oklab(sr / 255, sg / 255, sb / 255);
    baseC = Math.max(0.03, Math.min(0.28, chroma !== undefined ? Number(chroma) : (Math.hypot(sa, sB) || 0.14)));
    baseH = Math.atan2(sB, sa);
  }

  const kind = String(mode || scheme || 'cyber').toLowerCase().replace(/[^a-z]/g, '');
  const offsetsByScheme = {
    analogous: [0, 0.45, -0.45, 0.88, -0.88, 1.28],
    complementary: [0, Math.PI, 0.36, Math.PI + 0.36, -0.38, Math.PI - 0.38],
    split: [0, Math.PI * 0.78, -Math.PI * 0.78, 0.34, Math.PI * 0.78 + 0.3, -Math.PI * 0.78 - 0.3],
    triadic: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3, 0.35, (2 * Math.PI) / 3 + 0.35, (4 * Math.PI) / 3 + 0.35],
    cyber: [0, 1.05, -1.25, Math.PI * 0.88, 2.15, -0.55],
    warmcool: [-0.42, 0.52, -0.85, 0.95, 0, Math.PI * 0.85],
    earth: [0, 0.55, -0.65, 1.25, 2.55, -1.45],
    mono: [0, 0.06, -0.06, 0.12, -0.12, 0.18],
  };
  const offs = offsetsByScheme[kind] || offsetsByScheme.cyber;

  if (count !== undefined && count !== null) {
    const target = Math.max(2, Math.min(64, Math.round(Number(count) || 16)));
    const nRamps = target <= 6 ? 1 : target <= 12 ? 2 : target <= 20 ? 4 : 4;
    const baseSteps = Math.floor(target / nRamps);
    const extra = target % nRamps;
    const out = [];
    for (let r = 0; r < nRamps; r++) {
      const nSteps = baseSteps + (r < extra ? 1 : 0);
      const hCenter = baseH + offs[r % offs.length];
      const chromaScale = kind === 'mono' ? Math.max(0.2, 1 - r * 0.25) : (r % 2 === 0 ? 1.0 : 0.84);
      for (let i = 0; i < nSteps; i++) {
        const t = nSteps <= 1 ? 0.5 : i / (nSteps - 1);
        const L = 0.15 + 0.78 * Math.pow(t, 0.92);
        const hShiftFactor = kind === 'warmcool' ? Math.max(0.45, hueShift) * 1.45 : hueShift * 1.15;
        const h = hCenter + (t - 0.5) * hShiftFactor;
        const bell = Math.sin(Math.PI * (0.1 + 0.8 * t));
        const C = baseC * chromaScale * (0.35 + 0.85 * bell);
        out.push(toHex(oklabToRgbBytes([L, C * Math.cos(h), C * Math.sin(h)])));
      }
    }
    return out.slice(0, target);
  }

  const nRamps = Math.max(1, Math.min(6, ramps));
  const nSteps = Math.max(2, Math.min(10, steps));
  const out = [];
  for (let r = 0; r < nRamps; r++) {
    const hCenter = baseH + offs[r % offs.length];
    const chromaScale = kind === 'mono' ? Math.max(0.18, 1 - r * 0.28) : (r % 2 === 0 ? 1.0 : 0.84);
    for (let i = 0; i < nSteps; i++) {
      const t = nSteps === 1 ? 0.5 : i / (nSteps - 1);
      const L = 0.17 + 0.75 * Math.pow(t, 0.92);
      const h = hCenter + (t - 0.5) * hueShift * 1.15;
      const bell = Math.sin(Math.PI * (0.12 + 0.76 * t));
      const C = baseC * chromaScale * (0.35 + 0.85 * bell);
      const hex = toHex(oklabToRgbBytes([L, C * Math.cos(h), C * Math.sin(h)]));
      if (!out.includes(hex)) out.push(hex);
    }
  }
  return out;
}

function mean(list) {
  let l = 0, a = 0, b = 0;
  for (const p of list) { l += p[0]; a += p[1]; b += p[2]; }
  return [l / list.length, a / list.length, b / list.length];
}
