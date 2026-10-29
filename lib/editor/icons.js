// Original geometric workstation vector icons & Forge Hex-Prism Anvil emblem for PixelForge Studio.

export const FORGE_LOGO_SVG = `<svg class="pf-emblem" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="pf-brand-g1" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#14f195"/>
      <stop offset="0.52" stop-color="#10b981"/>
      <stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="pf-brand-g2" x1="10" y1="4" x2="22" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="#07111a" stroke="rgba(56,189,248,0.35)" stroke-width="1.5"/>
  <path d="M7.5 10.5h17l-2.8 4.6H10.3L7.5 10.5Z" fill="url(#pf-brand-g1)"/>
  <path d="M12.2 15.1h7.6l1.9 5.4H10.3l1.9-5.4Z" fill="#38bdf8" fill-opacity="0.86"/>
  <rect x="7.5" y="20.5" width="17" height="3.5" rx="1.2" fill="url(#pf-brand-g1)"/>
  <rect x="14.5" y="4.8" width="3" height="3" rx="0.6" fill="url(#pf-brand-g2)"/>
  <rect x="9.4" y="6.1" width="2.2" height="2.2" rx="0.5" fill="#38bdf8"/>
  <rect x="20.4" y="6.1" width="2.2" height="2.2" rx="0.5" fill="#14f195"/>
</svg>`;

const P = {
  // File & I/O
  upload: '<path d="M12 15.5V4.5m0 0L8.2 8.3M12 4.5l3.8 3.8"/><path d="M4.5 15.5v2.8a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7v-2.8"/>',
  download: '<path d="M12 4.5v11m0 0-3.8-3.8M12 15.5l3.8-3.8"/><path d="M4.5 15.5v2.8a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7v-2.8"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="8.8" cy="9.6" r="1.5"/><path d="m4.2 17.2 4.8-4.4 3.8 3.3 3.2-2.7 3.8 3.8"/>',
  film: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.2h4M3.5 14.8h4M16.5 9.2h4M16.5 14.8h4"/>',
  files: '<path d="M8.5 7V5.6A1.6 1.6 0 0 1 10.1 4h5.1l3.8 3.8v8.6a1.6 1.6 0 0 1-1.6 1.6H16"/><rect x="4.5" y="7" width="11.2" height="13" rx="1.8"/>',
  presets: '<path d="m12 3.5 2.3 5.2 5.7.6-4.2 3.8 1.2 5.6L12 15.9l-5 2.8 1.2-5.6L4 9.3l5.7-.6L12 3.5Z"/>',
  palette: '<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="10.5" r="1.1"/><circle cx="11.5" cy="7.6" r="1.1"/><circle cx="15.4" cy="9.2" r="1.1"/><path d="M12 20.5c1.5 0 2.3-1.1 1.8-2.3-.4-1.1.4-2.2 1.6-2.2h2.2a2.9 2.9 0 0 0 2.9-3"/>',
  search: '<circle cx="10.8" cy="10.8" r="5.8"/><path d="m19.5 19.5-4.3-4.3"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  minus: '<path d="M5.5 12h13"/>',
  chevron: '<path d="m9.5 6.2 5.8 5.8-5.8 5.8"/>',
  chevronDown: '<path d="m6.2 9.5 5.8 5.8 5.8-5.8"/>',
  undo: '<path d="M8.8 7.2 4.5 11.5l4.3 4.3"/><path d="M5 11.5h9.2a4.8 4.8 0 0 1 0 9.6H11"/>',
  redo: '<path d="m15.2 7.2 4.3 4.3-4.3 4.3"/><path d="M19 11.5H9.8a4.8 4.8 0 0 0 0 9.6H13"/>',

  // Viewport Modes
  viewSingle: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><rect x="7.5" y="8.5" width="9" height="7" rx="1"/>',
  compare: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><path d="M12 3v18"/><path d="m14.8 9.8 2.2 2.2-2.2 2.2M9.2 9.8 7 12l2.2 2.2"/>',
  viewSplitH: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><path d="M2.5 12h19"/><path d="m9.8 9.2 2.2-2.2 2.2 2.2M9.8 14.8 12 17l2.2-2.2"/>',
  viewDual: '<rect x="3" y="5" width="8" height="14" rx="1.6"/><rect x="13" y="5" width="8" height="14" rx="1.6"/>',
  viewQuad: '<rect x="3.5" y="4" width="7.2" height="7" rx="1.3"/><rect x="13.3" y="4" width="7.2" height="7" rx="1.3"/><rect x="3.5" y="13" width="7.2" height="7" rx="1.3"/><rect x="13.3" y="13" width="7.2" height="7" rx="1.3"/>',
  viewTile: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.8"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>',

  // Pixel Retouch Tools
  hand: '<path d="M9 11V5.8a1.3 1.3 0 0 1 2.6 0V10m0-4.8a1.3 1.3 0 0 1 2.6 0V10m0-3.8a1.3 1.3 0 0 1 2.6 0v7.2a5.8 5.8 0 0 1-5.8 5.8h-1.2a5.5 5.5 0 0 1-4.6-2.5l-2-3.1a1.4 1.4 0 0 1 2.2-1.7L9 13.5V11Z"/>',
  pencil: '<path d="m4.2 19.8 1-4.3L15.8 4.9a1.8 1.8 0 0 1 2.5 0l.8.8a1.8 1.8 0 0 1 0 2.5L8.5 18.8l-4.3 1Z"/><path d="m13.8 6.9 3.3 3.3"/>',
  eraser: '<path d="m14.2 4.8 5 5a1.8 1.8 0 0 1 0 2.5l-6.6 6.7H6.8l-2.6-2.6a1.8 1.8 0 0 1 0-2.5l7.5-9.1a1.8 1.8 0 0 1 2.5 0Z"/><path d="M9 19h10.5M8.4 11.2l5.8 5.8"/>',
  bucket: '<path d="m11.2 4.6 7.2 7.2-6.8 6.8a2 2 0 0 1-2.8 0l-4.4-4.4a2 2 0 0 1 0-2.8l6.8-6.8Z"/><path d="M8.5 2.8 11.2 5.5M19.8 14.5c1.3 1.6 2 2.7 2 3.7a2 2 0 1 1-4 0c0-1 .7-2.1 2-3.7Z"/>',
  line: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M7.5 16.5l9-9"/>',
  rect: '<rect x="4.5" y="5.5" width="15" height="13" rx="1.4"/><path d="M4.5 8.5h2M17.5 8.5h2M4.5 15.5h2M17.5 15.5h2"/>',
  loupe: '<circle cx="10.5" cy="10.5" r="6"/><path d="m19.8 19.8-4.8-4.8"/><path d="M8 10.5h5M10.5 8v5"/>',
  eye: '<path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.6"/>',
  eyeOff: '<path d="M3.5 3.5l17 17"/><path d="M9.9 6.3A9.7 9.7 0 0 1 12 6c5.8 0 9.2 6 9.2 6a16.5 16.5 0 0 1-3.3 4.1M6.4 8.2A16 16 0 0 0 2.8 12s3.4 6 9.2 6c1.5 0 2.9-.4 4.1-1"/>',

  // Controls & Studio Utilities
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>',
  fit: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>',
  zoomIn: '<circle cx="10.8" cy="10.8" r="5.8"/><path d="m19.5 19.5-4.3-4.3M10.8 8.3v5M8.3 10.8h5"/>',
  zoomOut: '<circle cx="10.8" cy="10.8" r="5.8"/><path d="m19.5 19.5-4.3-4.3M8.3 10.8h5"/>',
  sun: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z"/>',
  sidebarLeft: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><path d="M9.2 4.5v15"/>',
  sidebarRight: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><path d="M14.8 4.5v15"/>',
  play: '<path d="M8.2 5.5v13l10.3-6.5L8.2 5.5Z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  stepBack: '<path d="M7 5.5v13M17.8 6l-8 6 8 6V6Z"/>',
  stepForward: '<path d="M17 5.5v13M6.2 6l8 6-8 6V6Z"/>',
  save: '<path d="M5.2 4.5h10.8l3.5 3.5v10a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5.2 4.5Z"/><path d="M8 4.5v4h7v-4M8 19.5v-5.8h8v5.8"/>',
  rename: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  volume: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>',
  volumeOff: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 6.8"/><path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
  braces: '<path d="M8.5 4.5H8A2 2 0 0 0 6 6.5v3A2.5 2.5 0 0 1 3.5 12 2.5 2.5 0 0 1 6 14.5v3a2 2 0 0 0 2 2h.5M15.5 4.5h.5a2 2 0 0 1 2 2v3a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0-2.5 2.5v3a2 2 0 0 1-2 2h-.5"/>',
  pipette: '<path d="m14.5 6.5 3 3M12 9l-7.2 7.2a2 2 0 0 0-.5 1V20h2.8a2 2 0 0 0 1-.5L15.2 12"/><path d="M13 7.5 15.8 4.7a2.3 2.3 0 0 1 3.3 3.3L16.3 10.8 13 7.5Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
  sheet: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h17M12 3.5v17"/>',
  tiles: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><path d="M13.5 17h7M17 13.5v7"/>',
  zip: '<path d="M6 3.5h8l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z"/><path d="M10 3.5v2h2v2h-2v2h2v2h-2v3"/>',
  gif: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M10 10.5H8.5a1.5 1.5 0 0 0 0 3H10V12M13 10v4M16 14v-4h2M16 12h1.5"/>',
  more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  unlink: '<path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 6.8"/><path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3"/><path d="M4 4l16 16"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4Z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
  frame: '<path d="M7 3v14a1 1 0 0 0 1 1h13"/><path d="M3 7h13a1 1 0 0 1 1 1v13"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.6"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M9 10h6M9 14h4"/>',
  github: '<path d="M9 19c-4 1.3-4-2-5.5-2.5M14.5 21v-3.2c0-1 .1-1.4-.5-2 2.6-.3 5.5-1.3 5.5-5.8a4.5 4.5 0 0 0-1.2-3.1 4.2 4.2 0 0 0-.1-3.1s-1-.3-3.3 1.2a11.4 11.4 0 0 0-6 0C6.6 3.5 5.6 3.8 5.6 3.8a4.2 4.2 0 0 0-.1 3.1A4.5 4.5 0 0 0 4.3 10c0 4.5 2.9 5.5 5.5 5.8-.6.6-.6 1.2-.5 2V21"/>',
  spark: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3Z"/>',
  sort: '<path d="M4 7h10M4 12h7M4 17h4M17 5v14m0 0-3-3m3 3 3-3"/>',
  histogram: '<path d="M4 19.5h16"/><path d="M5.5 19.5v-5l3-4.5 3.2 3 3.3-7.5 3.5 9v5"/>',
  snapshot: '<path d="M4.5 7.5A2 2 0 0 1 6.5 5.5h2l1.2-1.8h4.6l1.2 1.8h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-10Z"/><circle cx="12" cy="12.5" r="3.2"/>',
  flip: '<path d="M12 3.5v17"/><path d="M4.5 16.5 9 8.5v8H4.5Z"/><path d="M19.5 16.5 15 8.5v8h4.5Z"/>',
};

/** SVG markup for an icon name. */
export function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
}
export const ICON_NAMES = Object.keys(P);
