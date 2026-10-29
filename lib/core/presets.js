// Built-in PixelForge presets: 20 curated presets spanning scientific OKLab-BGM & Posterior dithering,
// cartoon Kuwahara + Comic Ink, retro hardware consoles, and real-time 60-FPS WebGL 2 Screen FX.

export const PRESETS = [
  {
    id: 'hybrid-crisp', category: 'Scientific', name: 'Hybrid Crisp', description: 'Bimodal-Plateau edge downsampling + CLAHE micro-contrast + OKLab-BGM 28 colours + Blue Noise.',
    settings: { size: { width: 136, resample: 'hybrid' }, adjust: { clahe: 0.25 }, palette: { source: 'extract', count: 28, algo: 'oklab-bgm' }, dither: { method: 'bluenoise', strength: 0.45 }, cleanup: { orphans: true } },
  },
  {
    id: 'bgm-posterior', category: 'Scientific', name: 'Bayesian Posterior', description: 'Regularized OKLab-BGM 20-colour Gaussian EM palette + SVD denoise + 2-nearest Posterior soft dithering.',
    settings: { size: { width: 140, resample: 'hybrid' }, adjust: { svd: 0.35, clahe: 0.22 }, palette: { source: 'extract', count: 20, algo: 'oklab-bgm' }, dither: { method: 'posterior', strength: 0.65 }, cleanup: { orphans: true } },
  },
  {
    id: 'svd-cel', category: 'Anime & Ink', name: 'SVD Cel Painting', description: 'SVD structural low-rank denoise + Kuwahara flat brush + OKLab-BGM 18 colours + 1px Comic Ink.',
    settings: { size: { width: 132, resample: 'hybrid' }, adjust: { svd: 0.45, kuwahara: 2, clahe: 0.2 }, palette: { source: 'extract', count: 18, algo: 'oklab-bgm' }, dither: { method: 'none' }, cleanup: { orphans: true, smooth: true }, outline: { mode: 'ink', color: '#12101e' } },
  },
  {
    id: 'kurzgesagt', category: 'Anime & Ink', name: 'Kurzgesagt Glow', description: 'GPU Kuwahara flat-paint brush + Kurzgesagt Cosmic 24 + Bioluminescent Bloom FX.',
    settings: { size: { width: 144, resample: 'hybrid' }, adjust: { contrast: 0.1, saturation: 0.18, kuwahara: 3 }, palette: { source: 'builtin', id: 'kurzgesagt-24' }, dither: { method: 'posterior', strength: 0.45 }, cleanup: { orphans: true }, fx: { mode: 'bloom', strength: 0.55 } },
  },
  {
    id: 'chunky-ink', category: 'Anime & Ink', name: 'Chunky Ink', description: 'Kuwahara flat blocks + Endesga 32 + 1px internal comic ink contour outlines.',
    settings: { size: { width: 124, resample: 'hybrid' }, adjust: { kuwahara: 3, clahe: 0.18 }, palette: { source: 'builtin', id: 'endesga-32' }, dither: { method: 'none' }, cleanup: { orphans: true, smooth: true }, outline: { mode: 'ink', color: '#141020' } },
  },
  {
    id: 'crt-arcade', category: 'Screen FX', name: 'CRT Arcade', description: '1989 Trinitron arcade monitor: Endesga 32 + Bayer 4×4 + CRT phosphor grille, scanlines & RGB shift.',
    settings: { size: { width: 144, resample: 'hybrid' }, adjust: { contrast: 0.12, saturation: 0.12, clahe: 0.2 }, palette: { source: 'builtin', id: 'endesga-32' }, dither: { method: 'bayer4', strength: 0.65 }, fx: { mode: 'crt', strength: 0.68, scanlines: 0.55, aberration: 0.85 } },
  },
  {
    id: 'pc98-cyber', category: 'Retro Hardware', name: 'PC-98 Cyber', description: 'Sobel edge-preserving downsampling + NEC PC-98 Cyber 16 + Bayer 4×4 + dark ink lines.',
    settings: { size: { width: 160, resample: 'sobel' }, adjust: { clahe: 0.2 }, palette: { source: 'builtin', id: 'pc98-cyber-16' }, dither: { method: 'bayer4', strength: 0.65 }, outline: { mode: 'ink', color: '#080614' } },
  },
  {
    id: 'voxel-3d', category: 'Screen FX', name: 'Voxel 3D', description: 'Lit 3D micro-voxel bevel shading over Resurrect 64 crisp blocks.',
    settings: { size: { width: 104, resample: 'hybrid' }, adjust: { kuwahara: 2, clahe: 0.2 }, palette: { source: 'builtin', id: 'resurrect-64' }, dither: { method: 'none' }, cleanup: { orphans: true }, fx: { mode: 'voxel', strength: 0.72 } },
  },
  {
    id: 'oscilloscope-xy', category: 'Screen FX', name: 'Oscilloscope', description: 'Calibrated P31 emerald phosphor vector beam & CRT graticule grid.',
    settings: { size: { width: 176, resample: 'sobel' }, adjust: { clahe: 0.35 }, palette: { source: 'extract', count: 16 }, dither: { method: 'bayer4', strength: 0.4 }, fx: { mode: 'oscilloscope', strength: 0.92, scanlines: 0.25 } },
  },
  {
    id: 'cyber-blueprint', category: 'Screen FX', name: 'Blueprint', description: 'Architectural cyan contour wireframe on deep Prussian drafting grid.',
    settings: { size: { width: 176, resample: 'sobel' }, adjust: { clahe: 0.3 }, palette: { source: 'extract', count: 16 }, dither: { method: 'none' }, fx: { mode: 'blueprint', strength: 0.92 } },
  },
  {
    id: 'aloboi-dream', category: 'Screen FX', name: 'Dreamcore', description: 'Aloboi Dreamcore 16 pastel synthwave palette + Sierra Lite + soft neon glow.',
    settings: { size: { width: 140, resample: 'hybrid' }, palette: { source: 'builtin', id: 'aloboi-dream-16' }, dither: { method: 'sierra-lite', strength: 0.65 }, fx: { mode: 'bloom', strength: 0.35 } },
  },
  {
    id: 'pico-8', category: 'Retro Hardware', name: 'PICO-8', description: '128 px fantasy console look with the 16-colour PICO-8 palette & Blue Noise.',
    settings: { size: { width: 128, resample: 'hybrid' }, adjust: { clahe: 0.15 }, palette: { source: 'builtin', id: 'pico-8' }, dither: { method: 'bluenoise', strength: 0.7 } },
  },
  {
    id: 'game-boy', category: 'Retro Hardware', name: 'Game Boy LCD', description: 'DMG-01 four olive greens, 160 px wide, Bayer 4×4 + dot-matrix LCD grid.',
    settings: { size: { width: 160, resample: 'hybrid' }, adjust: { contrast: 0.15, clahe: 0.2 }, palette: { source: 'builtin', id: 'game-boy-dmg' }, dither: { method: 'bayer4', strength: 1 }, fx: { mode: 'lcd', strength: 0.55 } },
  },
  {
    id: 'one-bit', category: 'Retro Hardware', name: '1-Bit Mac', description: 'Classic Macintosh monochrome: two colours, Atkinson diffusion & crisp local contrast.',
    settings: { size: { width: 192, resample: 'hybrid' }, adjust: { contrast: 0.2, clahe: 0.25 }, palette: { source: 'builtin', id: '1-bit-monitor' }, dither: { method: 'atkinson', strength: 1 } },
  },
  {
    id: 'faithful', category: 'Scientific', name: 'Faithful OKLab', description: '28 salient OKLab colours extracted from the photo + Floyd–Steinberg diffusion.',
    settings: { size: { width: 136, resample: 'hybrid' }, adjust: { clahe: 0.15 }, palette: { source: 'extract', count: 28, algo: 'oklab-salient' }, dither: { method: 'floyd-steinberg', strength: 0.75 } },
  },
  {
    id: 'balanced', category: 'Scientific', name: 'Balanced', description: 'Endesga 32, Bayer 4×4, Hybrid Bimodal-Plateau edge resampling.',
    settings: { size: { width: 112, resample: 'hybrid' }, palette: { source: 'builtin', id: 'endesga-32' }, dither: { method: 'bayer4', strength: 0.6 } },
  },
  {
    id: 'sprite', category: 'Anime & Ink', name: 'Clean Sprite', description: 'No dither, Hybrid edges, orphan cleanup and a dark 1px outer sprite outline.',
    settings: { size: { width: 56, resample: 'hybrid' }, palette: { source: 'extract', count: 12 }, dither: { method: 'none' }, cleanup: { orphans: true }, outline: { mode: 'outer', color: '#1a1c2c' } },
  },
  {
    id: 'cga', category: 'Retro Hardware', name: 'IBM CGA', description: '16 hard hardware colours with an 8×8 Bayer pattern.',
    settings: { size: { width: 160, resample: 'hybrid' }, palette: { source: 'builtin', id: 'cga-16' }, dither: { method: 'bayer8', strength: 1 } },
  },
  {
    id: 'newsprint', category: 'Retro Hardware', name: 'Newsprint', description: 'Greyscale clustered-dot rotary press halftone.',
    settings: { size: { width: 220, resample: 'box' }, palette: { source: 'builtin', id: 'grayscale-4' }, dither: { method: 'cluster8', strength: 1 }, adjust: { saturation: -1, clahe: 0.2 } },
  },
  {
    id: 'soft', category: 'Scientific', name: 'Soft Painterly', description: 'Resurrect 64 with Sierra Lite diffusion, SVD smoothing, and majority cleanup.',
    settings: { size: { width: 116, resample: 'hybrid' }, adjust: { svd: 0.25 }, palette: { source: 'builtin', id: 'resurrect-64' }, dither: { method: 'sierra-lite', strength: 0.6 }, cleanup: { smooth: true } },
  },
];

export const PRESET_CATEGORIES = ['Scientific', 'Anime & Ink', 'Retro Hardware', 'Screen FX'];

export const getPreset = id => PRESETS.find(p => p.id === id) || null;
