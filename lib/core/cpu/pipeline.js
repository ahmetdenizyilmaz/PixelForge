// The whole PixelForge pipeline on the CPU (matching gpu/shaders.js).

import { resample, adjust, alphaCut, quantizeOrdered, quantizeDiffusion, removeOrphans, smoothMajority, outline } from './stages.js';

export function runCPU(plan, src) {
  const { width: w, height: h, settings: s } = plan;
  const buf = resample(src, w, h, s.size.resample, plan.crop, s.adjust.kuwahara || 0);
  adjust(buf, s.adjust);
  alphaCut(buf, s.alpha.threshold);
  const px = plan.kind === 'diffusion' ? quantizeDiffusion(buf, w, h, plan) : quantizeOrdered(buf, w, h, plan);
  if (s.cleanup.orphans) removeOrphans(px, w, h);
  if (s.cleanup.smooth) smoothMajority(px, w, h);
  outline(px, w, h, plan.outline);
  return px;
}
