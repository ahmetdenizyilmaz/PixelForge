// Built-in PixelForge presets: 14 built-in presets for pixel art, sprites, retro hardware, and stylized animation.

export const PRESETS = [
  {
    id: 'hybrid-crisp', name: 'Hybrid Crisp', description: 'PixelForge Hybrid edge-medoid downsampling + OKLab 24 colours + Blue Noise + orphan cleanup.',
    settings: { size: { width: 128, resample: 'hybrid' }, palette: { source: 'extract', count: 24 }, dither: { method: 'bluenoise', strength: 0.45 }, cleanup: { orphans: true } },
  },
  {
    id: 'kurzgesagt', name: 'Kurzgesagt Cosmic', description: 'GPU Kuwahara flat-paint brush + Hybrid crisp edges + Kurzgesagt Cosmic 24 + Blue Noise.',
    settings: { size: { width: 144, resample: 'hybrid' }, adjust: { contrast: 0.12, saturation: 0.18, kuwahara: 3 }, palette: { source: 'builtin', id: 'kurzgesagt-24' }, dither: { method: 'bluenoise', strength: 0.35 }, cleanup: { orphans: true } },
  },
  {
    id: 'chunky-ink', name: 'Chunky Cartoon Ink', description: 'Kuwahara flat blocks + Endesga 32 + 1px internal comic ink outlines.',
    settings: { size: { width: 120, resample: 'hybrid' }, adjust: { kuwahara: 3 }, palette: { source: 'builtin', id: 'endesga-32' }, dither: { method: 'none' }, cleanup: { orphans: true, smooth: true }, outline: { mode: 'ink', color: '#181425' } },
  },
  {
    id: 'pc98-cyber', name: 'PC-9801 Cyber', description: 'Sobel edge-preserving downsampling + NEC PC-98 Cyber 16 + Bayer 4×4 + dark ink lines.',
    settings: { size: { width: 160, resample: 'sobel' }, palette: { source: 'builtin', id: 'pc98-cyber-16' }, dither: { method: 'bayer4', strength: 0.65 }, outline: { mode: 'ink', color: '#080614' } },
  },
  {
    id: 'aloboi-dream', name: 'Aloboi Dreamcore', description: 'Aloboi Dreamcore 16 pastel synthwave palette + Sierra Lite smooth diffusion.',
    settings: { size: { width: 140, resample: 'hybrid' }, palette: { source: 'builtin', id: 'aloboi-dream-16' }, dither: { method: 'sierra-lite', strength: 0.65 } },
  },
  {
    id: 'balanced', name: 'Balanced', description: 'Endesga 32, Bayer 4×4, Hybrid edge resampling.',
    settings: { size: { width: 96, resample: 'hybrid' }, palette: { source: 'builtin', id: 'endesga-32' }, dither: { method: 'bayer4', strength: 0.6 } },
  },
  {
    id: 'game-boy', name: 'Game Boy', description: 'Four greens, 160 px wide, ordered dither.',
    settings: { size: { width: 160, resample: 'hybrid' }, palette: { source: 'builtin', id: 'game-boy-dmg' }, dither: { method: 'bayer4', strength: 1 }, adjust: { contrast: 0.15 } },
  },
  {
    id: 'pico-8', name: 'PICO-8', description: '128 px, the PICO-8 palette, blue-noise dither.',
    settings: { size: { width: 128, resample: 'hybrid' }, palette: { source: 'builtin', id: 'pico-8' }, dither: { method: 'bluenoise', strength: 0.7 } },
  },
  {
    id: 'one-bit', name: '1-bit Atkinson', description: 'Classic Mac look: two colours, Atkinson diffusion.',
    settings: { size: { width: 192, resample: 'hybrid' }, palette: { source: 'builtin', id: '1-bit-monitor' }, dither: { method: 'atkinson', strength: 1 }, adjust: { contrast: 0.2 } },
  },
  {
    id: 'faithful', name: 'Faithful colour', description: 'OKLab palette extracted from the image, Floyd–Steinberg.',
    settings: { size: { width: 128, resample: 'hybrid' }, palette: { source: 'extract', count: 24 }, dither: { method: 'floyd-steinberg', strength: 0.75 } },
  },
  {
    id: 'sprite', name: 'Clean sprite', description: 'No dither, Hybrid edges, orphan cleanup and a dark outer outline.',
    settings: { size: { width: 48, resample: 'hybrid' }, palette: { source: 'extract', count: 12 }, dither: { method: 'none' }, cleanup: { orphans: true }, outline: { mode: 'outer', color: '#1a1c2c' } },
  },
  {
    id: 'cga', name: 'CGA', description: '16 hard colours with an 8×8 Bayer pattern.',
    settings: { size: { width: 160, resample: 'hybrid' }, palette: { source: 'builtin', id: 'cga-16' }, dither: { method: 'bayer8', strength: 1 } },
  },
  {
    id: 'newsprint', name: 'Newsprint', description: 'Grey clustered-dot halftone.',
    settings: { size: { width: 220, resample: 'box' }, palette: { source: 'builtin', id: 'grayscale-4' }, dither: { method: 'cluster8', strength: 1 }, adjust: { saturation: -1 } },
  },
  {
    id: 'soft', name: 'Soft painterly', description: 'Resurrect 64 with Sierra Lite and a light smooth.',
    settings: { size: { width: 112, resample: 'hybrid' }, palette: { source: 'builtin', id: 'resurrect-64' }, dither: { method: 'sierra-lite', strength: 0.6 }, cleanup: { smooth: true } },
  },
];

export const getPreset = id => PRESETS.find(p => p.id === id) || null;
