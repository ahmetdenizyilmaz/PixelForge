// Bundled starter samples for PixelForge Studio & Webpage:
// 4 real high-resolution scenic view photographs (CC0) + 1 transparent game sprite for outer/inner outline testing.

const crystalRelic = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560">
<defs>
  <linearGradient id="core" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7efce0"/>
    <stop offset=".45" stop-color="#10d9a0"/>
    <stop offset="1" stop-color="#0d5c75"/>
  </linearGradient>
  <linearGradient id="facetL" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#bffef0"/>
    <stop offset="1" stop-color="#19b394"/>
  </linearGradient>
  <linearGradient id="facetR" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#38bdf8"/>
    <stop offset="1" stop-color="#0a2e4a"/>
  </linearGradient>
  <linearGradient id="ped" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#1e293b"/>
    <stop offset=".5" stop-color="#475569"/>
    <stop offset="1" stop-color="#0f172a"/>
  </linearGradient>
</defs>
<polygon points="280,58 398,196 356,408 280,462 204,408 162,196" fill="url(#core)"/>
<polygon points="280,58 280,462 204,408 162,196" fill="url(#facetL)" opacity=".88"/>
<polygon points="280,58 398,196 356,408 280,462" fill="url(#facetR)" opacity=".85"/>
<polygon points="280,58 334,210 280,350 226,210" fill="#e6fff9" opacity=".42"/>
<path d="M214 188 L280 94 L268 214 Z" fill="#ffffff" opacity=".72"/>
<rect x="176" y="468" width="208" height="28" rx="8" fill="url(#ped)"/>
<rect x="148" y="494" width="264" height="24" rx="8" fill="#0f172a"/>
<circle cx="144" cy="148" r="10" fill="#7efce0"/><circle cx="422" cy="134" r="8" fill="#38bdf8"/><circle cx="416" cy="340" r="11" fill="#10d9a0"/>
</svg>`;

export const SAMPLES = [
  { id: 'mountain-fjord', name: 'Fjord Cliff View', subtitle: 'Nordic Fjord Panorama', photo: 'mountain-fjord.jpg' },
  { id: 'lake-reflection', name: 'Alpine River View', subtitle: 'Valley Mirror & Peaks', photo: 'lake-reflection.jpg' },
  { id: 'forest-waterfall', name: 'Canyon Waterfall', subtitle: 'Emerald Gorge Cascade', photo: 'forest-waterfall.jpg' },
  { id: 'alpine-valley', name: 'Highland Valley', subtitle: 'Misty Mountain Pass', photo: 'alpine-valley.jpg' },
  { id: 'crystal-relic', name: 'Crystal Relic (Sprite)', subtitle: 'Transparent Sprite', svg: crystalRelic },
];

function assetsRoot() {
  if (typeof document !== 'undefined') {
    const icon = document.querySelector('link[rel="icon"]')?.getAttribute('href');
    if (icon && icon.includes('assets/')) return icon.replace(/favicon\.svg.*$/, '');
  }
  return './assets/';
}

/** Resolve a sample by id (with legacy alias fallback to mountain-fjord). */
export function findSample(id) {
  if (!id) return SAMPLES[0];
  if (id === 'potion') return SAMPLES[4];
  if (id === 'still-life') return SAMPLES[1];
  return SAMPLES.find(s => s.id === id) || SAMPLES[0];
}

/** URL or Data URL for a sample (for thumbnails and <img>). */
export const sampleURL = s => s.photo
  ? `${assetsRoot()}photos/${s.photo}`
  : ('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg));

/** Load a sample as an ImageBitmap-compatible <img>. */
export async function loadSample(s) {
  const target = typeof s === 'string' ? findSample(s) : (s || SAMPLES[0]);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = sampleURL(target);
  await img.decode();
  return img;
}
