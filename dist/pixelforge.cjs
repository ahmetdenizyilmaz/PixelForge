/*! PixelForge v1.0.0 | MIT | https://github.com/ahmetdenizyilmaz/PixelForge */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lib/core/color.js
function parseColor(c) {
  if (Array.isArray(c)) return [c[0] | 0, c[1] | 0, c[2] | 0];
  let s = String(c).trim().replace(/^#|^0x/i, "");
  if (s.length === 3 || s.length === 4) s = s.slice(0, 3).split("").map((ch) => ch + ch).join("");
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) throw new Error(`Invalid colour "${c}"`);
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function isColor(c) {
  try {
    parseColor(c);
    return true;
  } catch {
    return false;
  }
}
function toHex(rgb) {
  return "#" + rgb.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function oklab(r, g, b) {
  r = lin(r);
  g = lin(g);
  b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}
function paletteSpread(rgbs) {
  if (rgbs.length < 2) return 1;
  let sum = 0;
  for (let i = 0; i < rgbs.length; i++) {
    let best = Infinity;
    for (let j = 0; j < rgbs.length; j++) {
      if (i === j) continue;
      const dr = rgbs[i][0] - rgbs[j][0], dg = rgbs[i][1] - rgbs[j][1], db = rgbs[i][2] - rgbs[j][2];
      const d = Math.sqrt(dr * dr + dg * dg + db * db);
      if (d < best) best = d;
    }
    sum += best;
  }
  return Math.max(0.04, Math.min(1, sum / rgbs.length / 255));
}
var normHex, lin, LUMA;
var init_color = __esm({
  "lib/core/color.js"() {
    "use strict";
    normHex = (c) => toHex(parseColor(c));
    lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    LUMA = [0.2126, 0.7152, 0.0722];
  }
});

// lib/core/palette/parse.js
function parseGPL(text) {
  const lines = text.split(/\r?\n/);
  if (!/^GIMP Palette/i.test(lines[0] || "")) throw new Error('Not a GIMP palette (missing "GIMP Palette" header)');
  let name = "";
  const colors = [];
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const nm = /^Name:\s*(.*)$/i.exec(line);
    if (nm) {
      name = nm[1].trim();
      continue;
    }
    if (/^Columns:/i.test(line)) continue;
    const m = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/.exec(line);
    if (m) colors.push(normHex([+m[1], +m[2], +m[3]]));
  }
  return { name, colors };
}
function parseHexList(text) {
  const colors = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("//")) continue;
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{8}|[0-9a-f]{3})\b/i.exec(line);
    if (!m) continue;
    const h = m[1].length === 8 ? m[1].slice(2) : m[1];
    colors.push(normHex(h));
  }
  return { name: "", colors };
}
function parseJASC(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines[0] !== "JASC-PAL") throw new Error("Not a JASC palette");
  const n = parseInt(lines[2], 10) || 0;
  const colors = [];
  for (let i = 3; i < 3 + n && i < lines.length; i++) {
    const m = /^(\d+)\s+(\d+)\s+(\d+)/.exec(lines[i]);
    if (m) colors.push(normHex([+m[1], +m[2], +m[3]]));
  }
  return { name: "", colors };
}
function parseJSON(text) {
  const obj = typeof text === "string" ? JSON.parse(text) : text;
  const list = Array.isArray(obj) ? obj : obj.colors || obj.palette || [];
  const colors = list.map((c) => typeof c === "object" && c ? c.hex || c.color : c).filter(Boolean).map(normHex);
  return { name: !Array.isArray(obj) && obj.name || "", colors };
}
function parseLoose(text) {
  const colors = [];
  const re = /#?\b([0-9a-f]{6})\b/gi;
  let m;
  while (m = re.exec(text)) colors.push(normHex(m[1]));
  return { name: "", colors };
}
function parsePalette(text, filename = "") {
  const ext = (/\.([a-z0-9]+)$/i.exec(filename) || [])[1]?.toLowerCase() || "";
  const t = String(text).replace(/^﻿/, "");
  const trimmed = t.trim();
  let out;
  if (ext === "gpl" || /^GIMP Palette/i.test(trimmed)) out = parseGPL(trimmed);
  else if (ext === "pal" || trimmed.startsWith("JASC-PAL")) out = parseJASC(trimmed);
  else if (ext === "json" || trimmed.startsWith("{") || trimmed.startsWith("[")) out = parseJSON(trimmed);
  else if (ext === "hex" || ext === "txt") out = parseHexList(trimmed);
  else {
    out = parseHexList(trimmed);
    if (!out.colors.length) out = parseLoose(trimmed);
  }
  out.colors = dedupe(out.colors).slice(0, 256);
  if (!out.name && filename) out.name = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  if (!out.colors.length) throw new Error("No colours found in that palette");
  return out;
}
function toGPL(name, colors) {
  const rows = colors.map((c) => {
    const h = normHex(c);
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}	${h.slice(1)}`;
  });
  return `GIMP Palette
Name: ${name || "Palette"}
Columns: 8
#
${rows.join("\n")}
`;
}
var dedupe, toHexFile, toPaletteJSON;
var init_parse = __esm({
  "lib/core/palette/parse.js"() {
    "use strict";
    init_color();
    dedupe = (list) => [...new Set(list)];
    toHexFile = (colors) => colors.map((c) => normHex(c).slice(1)).join("\n") + "\n";
    toPaletteJSON = (name, colors) => JSON.stringify({ name: name || "Palette", colors: colors.map((c) => normHex(c).slice(1)) }, null, 2);
  }
});

// lib/core/palette/lospec.js
var lospec_exports = {};
__export(lospec_exports, {
  fetchLospec: () => fetchLospec,
  lospecSlug: () => lospecSlug
});
function lospecSlug(input) {
  const s = String(input || "").trim();
  const m = /palette-list\/([a-z0-9-]+)/i.exec(s);
  return (m ? m[1] : s).toLowerCase().replace(/\.(json|hex|gpl)$/, "");
}
async function fetchLospec(slugOrUrl, { fetch: f = globalThis.fetch } = {}) {
  const slug = lospecSlug(slugOrUrl);
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("That does not look like a Lospec palette slug");
  const res = await f(`https://lospec.com/palette-list/${slug}.json`);
  if (!res.ok) throw new Error(`Lospec returned ${res.status} for "${slug}"`);
  const json = await res.json();
  const p = parseJSON(json);
  return { name: json.name || slug, author: json.author || "", colors: p.colors, slug };
}
var init_lospec = __esm({
  "lib/core/palette/lospec.js"() {
    "use strict";
    init_parse();
  }
});

// lib/index.js
var index_exports = {};
__export(index_exports, {
  ASPECTS: () => ASPECTS,
  DEFAULTS: () => DEFAULTS,
  DITHER_METHODS: () => DITHER_METHODS,
  FX_MODES: () => FX_MODES,
  KERNELS: () => KERNELS,
  LEGACY_DITHER: () => LEGACY_DITHER,
  MAX_SIZE: () => MAX_SIZE,
  PALETTES: () => PALETTES,
  PRESETS: () => PRESETS,
  SETTINGS_VERSION: () => SETTINGS_VERSION,
  VERSION: () => VERSION,
  bayer: () => bayer,
  buildTileset: () => buildTileset,
  compactSettings: () => compactSettings,
  createPixelator: () => createPixelator,
  createZip: () => createZip,
  cropRect: () => cropRect,
  decodeSettings: () => decodeSettings,
  defaultSettings: () => defaultSettings,
  detectGrid: () => detectGrid,
  ditherKind: () => ditherKind,
  downloadBlob: () => downloadBlob,
  encodeGIF: () => encodeGIF,
  encodePNG: () => encodePNG,
  encodeSettings: () => encodeSettings,
  estimateFps: () => estimateFps,
  extractPalette: () => extractPalette,
  fetchLospec: () => fetchLospec,
  forEachFrame: () => forEachFrame,
  frameTimes: () => frameTimes,
  getPalette: () => getPalette,
  getPreset: () => getPreset,
  hasTransparency: () => hasTransparency,
  loadImage: () => loadImage,
  lospecSlug: () => lospecSlug,
  makePlan: () => makePlan,
  makeResult: () => makeResult,
  mediaError: () => mediaError,
  mergeSettings: () => mergeSettings,
  normalizeSettings: () => normalizeSettings,
  oklab: () => oklab,
  packSpriteSheet: () => packSpriteSheet,
  parseColor: () => parseColor,
  parseMatrix: () => parseMatrix,
  parsePalette: () => parsePalette,
  pixelate: () => pixelate,
  resizeNearest: () => resizeNearest,
  resolveSize: () => resolveSize,
  runCPU: () => runCPU,
  seekTo: () => seekTo,
  settingsFromJSON: () => settingsFromJSON,
  settingsToJSON: () => settingsToJSON,
  sniffVideoCodec: () => sniffVideoCodec,
  thresholdMap: () => thresholdMap,
  toCanvas: () => toCanvas,
  toFrame: () => toFrame,
  toGPL: () => toGPL,
  toHex: () => toHex,
  toHexFile: () => toHexFile,
  toPaletteJSON: () => toPaletteJSON,
  uniqueColors: () => uniqueColors,
  upscale: () => upscale,
  videoReady: () => videoReady
});
module.exports = __toCommonJS(index_exports);

// lib/core/palette/builtin.js
var PALETTES = [
  { id: "1-bit-monitor", name: "1-Bit Monitor", author: "", colors: ["222323", "f0f6f0"] },
  { id: "apollo", name: "Apollo", author: "AdamCYounis", colors: ["172038", "253a5e", "3c5e8b", "4f8fba", "73bed3", "a4dddb", "19332d", "25562e", "468232", "75a743", "a8ca58", "d0da91", "4d2b32", "7a4841", "ad7757", "c09473", "d7b594", "e7d5b3", "341c27", "602c2c", "884b2b", "be772b", "de9e41", "e8c170", "241527", "411d31", "752438", "a53030", "cf573c", "da863e", "1e1d39", "402751", "7a367b", "a23e8c", "c65197", "df84a5", "090a14", "10141f", "151d28", "202e37", "394a50", "577277", "819796", "a8b5b2", "c7cfcc", "ebede9"] },
  { id: "batpalette", name: "Batpalette", author: "el Rojaz", colors: ["000000", "7f7f7f", "ffffff", "681e99", "3f48cc", "88ff82", "bfa621", "cc3d18"] },
  { id: "beached-boogaloo", name: "Beached Boogaloo", author: ".tomais", colors: ["ff0b20", "8f0434", "500037", "a0ff00", "57e71e", "0ea717", "057833", "2cdeef", "2483e7", "153ab7", "0d0a87", "ff0b88", "a60fff", "6409cf", "eaef30", "ff880b", "b75308", "802202", "000000", "231940", "514378", "ffffff", "73a3a7", "366770", "f7b771", "c77650", "974c38", "873939", "601e2c", "300c1f"] },
  { id: "cc-29", name: "CC-29", author: "Alpha6", colors: ["f2f0e5", "b8b5b9", "868188", "646365", "45444f", "3a3858", "212123", "352b42", "43436a", "4b80ca", "68c2d3", "a2dcc7", "ede19e", "d3a068", "b45252", "6a536e", "4b4158", "80493a", "a77b5b", "e5ceb4", "c2d368", "8ab060", "567b79", "4e584a", "7b7243", "b2b47e", "edc8c4", "cf8acb", "5f556a"] },
  { id: "cga-16", name: "CGA 16", author: "", colors: ["000000", "0000aa", "00aa00", "00aaaa", "aa0000", "aa00aa", "aa5500", "aaaaaa", "555555", "5555ff", "55ff55", "55ffff", "ff5555", "ff55ff", "ffff55", "ffffff"] },
  { id: "chaotic-neutral", name: "Chaotic neutral", author: "Dodecahedron", colors: ["e1d4cb", "c19f90", "a56457", "6d504d", "484044", "392b29", "31312f", "d8eef0", "97999f", "81a4c0", "6a7f92", "415973", "43425a", "45334b", "4b1f40", "671087", "955ab9"] },
  { id: "endesga-32", name: "Endesga 32", author: "ENDESGA", colors: ["be4a2f", "d77643", "ead4aa", "e4a672", "b86f50", "733e39", "3e2731", "a22633", "e43b44", "f77622", "feae34", "fee761", "63c74d", "3e8948", "265c42", "193c3e", "124e89", "0099db", "2ce8f5", "ffffff", "c0cbdc", "8b9bb4", "5a6988", "3a4466", "262b44", "181425", "ff0044", "68386c", "b55088", "f6757a", "e8b796", "c28569"] },
  { id: "fantasy-24", name: "Fantasy 24", author: "", colors: ["1f240a", "39571c", "a58c27", "efac28", "efd8a1", "ab5c1c", "183f39", "ef692f", "efb775", "a56243", "773421", "724113", "2a1d0d", "392a1c", "684c3c", "927e6a", "276468", "ef3a0c", "45230d", "3c9f9c", "9b1a0a", "36170c", "550f0a", "300f0a"] },
  { id: "game-boy-dmg", name: "Game Boy (DMG)", author: "", colors: ["0f380f", "306230", "8bac0f", "9bbc0f"] },
  { id: "grayscale-4", name: "Grayscale 4", author: "", colors: ["000000", "555555", "aaaaaa", "ffffff"] },
  { id: "hidden-library", name: "Hidden Library", author: "Pixel Hoo", colors: ["100b2a", "2a213a", "314743", "65856d", "adca9a", "ecfeca", "582d27", "974133", "d67654", "5d3441", "a3685b", "ffb379", "ffe6a9", "ffffff"] },
  { id: "intacto14", name: "Intacto14", author: "Anubi", colors: ["221529", "4b5561", "879ba3", "cbf5ef", "62b4de", "5660d6", "5b29a6", "d64562", "f2735c", "edbb8e", "ab6375", "522152", "37ada2", "8cde8c"] },
  { id: "journey", name: "Journey", author: "PineappleOnPizza", colors: ["050914", "110524", "3b063a", "691749", "9c3247", "d46453", "f5a15d", "ffcf8e", "ff7a7d", "ff417d", "d61a88", "94007a", "42004e", "220029", "100726", "25082c", "3d1132", "73263d", "bd4035", "ed7b39", "ffb84a", "fff540", "c6d831", "77b02a", "429058", "2c645e", "153c4a", "052137", "0e0421", "0c0b42", "032769", "144491", "488bd4", "78d7ff", "b0fff1", "faffff", "c7d4e1", "928fb8", "5b537d", "392946", "24142c", "0e0f2c", "132243", "1a466b", "10908e", "28c074", "3dff6e", "f8ffb8", "f0c297", "cf968c", "8f5765", "52294b", "0f022e", "35003b", "64004c", "9b0e3e", "d41e3c", "ed4c40", "ff9757", "d4662f", "9c341a", "691b22", "450c28", "2d002e"] },
  { id: "lospec500", name: "Lospec500", author: "", colors: ["10121c", "2c1e31", "6b2643", "ac2847", "ec273f", "94493a", "de5d3a", "e98537", "f3a833", "4d3533", "6e4c30", "a26d3f", "ce9248", "dab163", "e8d282", "f7f3b7", "1e4044", "006554", "26854c", "5ab552", "9de64e", "008b8b", "62a477", "a6cb96", "d3eed3", "3e3b65", "3859b3", "3388de", "36c5f4", "6dead6", "5e5b8c", "8c78a5", "b0a7b8", "deceed", "9a4d76", "c878af", "cc99ff", "fa6e79", "ffa2ac", "ffd1d5", "f6e8e0", "ffffff"] },
  { id: "nyx8", name: "Nyx8", author: "Javier Guerrero", colors: ["08141e", "0f2a3f", "20394f", "4e495f", "816271", "997577", "c3a38a", "f6d6bd"] },
  { id: "oil-6", name: "Oil 6", author: "", colors: ["fbf5ef", "f2d3ab", "c69fa5", "8b6d9c", "494d7e", "272744"] },
  { id: "pico-8", name: "PICO-8", author: "", colors: ["000000", "1d2b53", "7e2553", "008751", "ab5236", "5f574f", "c2c3c7", "fff1e8", "ff004d", "ffa300", "ffec27", "00e436", "29adff", "83769c", "ff77a8", "ffccaa"] },
  { id: "resurrect-64", name: "Resurrect 64", author: "Kerrie Lake", colors: ["2e222f", "3e3546", "625565", "966c6c", "ab947a", "694f62", "7f708a", "9babb2", "c7dcd0", "ffffff", "6e2727", "b33831", "ea4f36", "f57d4a", "ae2334", "e83b3b", "fb6b1d", "f79617", "f9c22b", "7a3045", "9e4539", "cd683d", "e6904e", "fbb954", "4c3e24", "676633", "a2a947", "d5e04b", "fbff86", "165a4c", "239063", "1ebc73", "91db69", "cddf6c", "313638", "374e4a", "547e64", "92a984", "b2ba90", "0b5e65", "0b8a8f", "0eaf9b", "30e1b9", "8ff8e2", "323353", "484a77", "4d65b4", "4d9be6", "8fd3ff", "45293f", "6b3e75", "905ea9", "a884f3", "eaaded", "753c54", "a24b6f", "cf657f", "ed8099", "831c5d", "c32454", "f04f78", "f68181", "fca790", "fdcbb0"] },
  { id: "slso8", name: "SLSO8", author: "Luis Miguel Maldonado", colors: ["0d2b45", "203c56", "544e68", "8d697a", "d08159", "ffaa5e", "ffd4a3", "ffecd6"] },
  { id: "sweet-canyon-extended-64", name: "Sweet Canyon Extended 64", author: "Mr Slime", colors: ["0f0e11", "2d2c33", "40404a", "51545c", "6b7179", "7c8389", "a8b2b6", "d5d5d5", "eeebe0", "f1dbb1", "eec99f", "e1a17e", "cc9562", "ab7b49", "9a643a", "86482f", "783a29", "6a3328", "541d29", "42192c", "512240", "782349", "8b2e5d", "a93e89", "d062c8", "ec94ea", "f2bdfc", "eaebff", "a2fafa", "64e7e7", "54cfd8", "2fb6c3", "2c89af", "25739d", "2a5684", "214574", "1f2966", "101445", "3c0d3b", "66164c", "901f3d", "bb3030", "dc473c", "ec6a45", "fb9b41", "f0c04c", "f4d66e", "fffb76", "ccf17a", "97d948", "6fba3b", "229443", "1d7e45", "116548", "0c4f3f", "0a3639", "251746", "48246d", "69189c", "9f20c0", "e527d2", "ff51cf", "ff7ada", "ff9edb"] },
  { id: "sweetie-16", name: "Sweetie 16", author: "GrafxKid", colors: ["1a1c2c", "5d275d", "b13e53", "ef7d57", "ffcd75", "a7f070", "38b764", "257179", "29366f", "3b5dc9", "41a6f6", "73eff7", "f4f4f4", "94b0c2", "566c86", "333c57"] },
  { id: "toxic-haze", name: "Toxic Haze", author: "sillyTheJester", colors: ["e5ff00", "b8d14a", "9ab06e", "708763", "4c5c52", "393e40", "242424"] },
  { id: "vinik24", name: "Vinik24", author: "Vinik", colors: ["000000", "6f6776", "9a9a97", "c5ccb8", "8b5580", "c38890", "a593a5", "666092", "9a4f50", "c28d75", "7ca1c0", "416aa3", "8d6268", "be955c", "68aca9", "387080", "6e6962", "93a167", "6eaa78", "557064", "9d9f7f", "7e9e99", "5d6872", "433455"] },
  { id: "kurzgesagt-24", name: "Kurzgesagt Cosmic 24", author: "PixelForge", colors: ["050516", "0d0d38", "18165c", "291d89", "4527b7", "7028e4", "a629f5", "e629d6", "ff2a85", "ff5c33", "ff9e1b", "ffe135", "ffffff", "b5fff6", "3dffdf", "00d2ff", "0084ff", "0044cc", "163832", "0d8a5e", "1ee881", "7dff4d", "c8ff80", "3c1642"] },
  { id: "pc98-cyber-16", name: "NEC PC-9801 Cyber 16", author: "PixelForge", colors: ["080614", "161233", "291f59", "462e8c", "6b3ec2", "9e52e8", "d674ff", "ff4da6", "ff85c2", "003859", "006e99", "00b8d9", "4df7ff", "e0ffff", "ffd166", "fff8eb"] },
  { id: "aloboi-dream-16", name: "Aloboi Dreamcore 16", author: "PixelForge", colors: ["12091c", "241338", "3d1e59", "612c7d", "8f3e9e", "c457b5", "f279c4", "ffa6c9", "ff8c69", "ffb563", "ffd97d", "fff3b0", "4a6fa5", "6fa3d2", "a3d5ff", "eaf6ff"] },
  { id: "oscilloscope-p31", name: "Oscilloscope Tektronix P31", author: "PixelForge", colors: ["030a06", "071c10", "0c3820", "136339", "1ba35c", "28e07f", "5effa8", "c8ffe0"] },
  { id: "commodore-64", name: "Commodore 64 (VIC-II)", author: "Commodore", colors: ["000000", "ffffff", "a14d43", "6ac1c8", "a257a5", "5cad5f", "4f449c", "cbd689", "a3683a", "6e540b", "cc7f76", "636363", "8b8b8b", "9be39d", "8a7fcd", "afafaf"] },
  { id: "zx-spectrum", name: "ZX Spectrum", author: "Sinclair", colors: ["000000", "0027fb", "ff3016", "ff3ffc", "00f92c", "00fcfe", "fffd33", "ffffff"] },
  { id: "apple-ii-lo", name: "Apple II Lo-Res", author: "Apple", colors: ["000000", "853b51", "504789", "ea5df0", "006852", "929292", "00a8f1", "cac3f8", "515c0f", "eb7f23", "f6b9ca", "00ca29", "cbd39b", "9adccb", "ffffff"] },
  { id: "msx", name: "MSX TMS9918", author: "ASCII", colors: ["000000", "3eb849", "74d07d", "5955e0", "8076f1", "b95e51", "65dbef", "db6559", "ff897d", "ccc35e", "ded087", "3aa241", "b766b5", "cccccc", "ffffff"] },
  { id: "teletext", name: "Teletext / BBC Micro", author: "BBC", colors: ["000000", "ff0000", "008000", "ffff00", "0000ff", "ff00ff", "00ffff", "ffffff"] },
  { id: "virtualboy", name: "Nintendo Virtual Boy", author: "Nintendo", colors: ["000000", "550000", "a40000", "ef0000"] },
  { id: "obradinn-ibm", name: "Obra Dinn (IBM 8503)", author: "Lucas Pope", colors: ["2e3037", "ebe5ce"] },
  { id: "obradinn-mac", name: "Obra Dinn (Macintosh)", author: "Lucas Pope", colors: ["333319", "e5ffff"] },
  { id: "phosphor-amber", name: "CRT Phosphor Amber", author: "", colors: ["282828", "ffb000"] },
  { id: "phosphor-green", name: "CRT Phosphor P1 Green", author: "", colors: ["282828", "33ff00"] }
];
function getPalette(idOrName) {
  const k2 = String(idOrName || "").toLowerCase();
  return PALETTES.find((p) => p.id === k2 || p.name.toLowerCase() === k2) || null;
}

// lib/core/settings.js
init_color();
var SETTINGS_VERSION = 1;
var MAX_SIZE = 2048;
var DITHER_METHODS = [
  { id: "none", label: "None", kind: "none" },
  { id: "bayer2", label: "Bayer 2\xD72", kind: "ordered" },
  { id: "bayer4", label: "Bayer 4\xD74", kind: "ordered" },
  { id: "bayer8", label: "Bayer 8\xD78", kind: "ordered" },
  { id: "bayer16", label: "Bayer 16\xD716", kind: "ordered" },
  { id: "cluster4", label: "Clustered dot 4\xD74", kind: "ordered" },
  { id: "cluster8", label: "Clustered dot 8\xD78", kind: "ordered" },
  { id: "lines", label: "Horizontal lines", kind: "ordered" },
  { id: "bluenoise", label: "Blue noise (64\xD764)", kind: "ordered" },
  { id: "custom", label: "Custom matrix", kind: "ordered" },
  { id: "floyd-steinberg", label: "Floyd\u2013Steinberg", kind: "diffusion" },
  { id: "atkinson", label: "Atkinson", kind: "diffusion" },
  { id: "sierra-lite", label: "Sierra Lite", kind: "diffusion" },
  { id: "sierra", label: "Sierra", kind: "diffusion" },
  { id: "burkes", label: "Burkes", kind: "diffusion" },
  { id: "jarvis", label: "Jarvis\u2013Judice\u2013Ninke", kind: "diffusion" },
  { id: "stucki", label: "Stucki", kind: "diffusion" }
];
var ditherKind = (id) => (DITHER_METHODS.find((m) => m.id === id) || { kind: "none" }).kind;
var LEGACY_DITHER = {
  "none": "none",
  "floyd-steinberg": "floyd-steinberg",
  "atkinson": "atkinson",
  "ordered": "bayer8",
  "2x2 bayer": "bayer2",
  "4x4 bayer": "bayer4",
  "clustered 4x4": "cluster4"
};
var FX_MODES = [
  { id: "none", label: "None (Pure Pixel)" },
  { id: "bloom", label: "Bioluminescent Bloom" },
  { id: "crt", label: "CRT Arcade Phosphor" },
  { id: "voxel", label: "3D Voxel Bevel" },
  { id: "lcd", label: "Handheld LCD Grid" },
  { id: "oscilloscope", label: "Oscilloscope Vector" },
  { id: "blueprint", label: "Cyber Blueprint" }
];
var DEFAULTS = Object.freeze({
  version: SETTINGS_VERSION,
  size: { mode: "width", width: 128, height: 0, block: 8, resample: "hybrid" },
  adjust: { brightness: 0, contrast: 0, saturation: 0, hue: 0, gamma: 1, kuwahara: 0, clahe: 0 },
  frame: { aspect: "original", zoom: 1, x: 0.5, y: 0.5 },
  palette: { source: "builtin", id: "endesga-32", name: "Endesga 32", colors: [], count: 24, distance: "oklab" },
  dither: { method: "bayer4", strength: 0.6, matrix: null },
  alpha: { threshold: 0.5 },
  cleanup: { orphans: false, smooth: false },
  outline: { mode: "none", color: "#000000", corners: false },
  fx: { mode: "none", strength: 0.65, scanlines: 0, aberration: 0 },
  export: { size: "scale", scale: 4, indexed: true, grid: false, gridColor: "#000000" }
});
var clamp = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
var oneOf = (v, list, d) => list.includes(v) ? v : d;
var bool = (v, d) => typeof v === "boolean" ? v : d;
function defaultSettings() {
  return normalizeSettings({});
}
function normalizeSettings(input = {}) {
  const d = DEFAULTS;
  const i = input || {};
  const s = {};
  const size = i.size || {};
  const adj = i.adjust || {};
  const pal = i.palette || {};
  const dit = i.dither || {};
  const al = i.alpha || {};
  const cl = i.cleanup || {};
  const ol = i.outline || {};
  const ex = i.export || {};
  s.version = SETTINGS_VERSION;
  s.size = {
    mode: oneOf(size.mode, ["width", "block"], d.size.mode),
    width: Math.round(clamp(size.width, 1, MAX_SIZE, d.size.width)),
    height: Math.round(clamp(size.height, 0, MAX_SIZE, d.size.height)),
    block: clamp(size.block, 1, 256, d.size.block),
    resample: oneOf(size.resample, ["hybrid", "sobel", "box", "nearest"], d.size.resample)
  };
  s.adjust = {
    brightness: clamp(adj.brightness, -1, 1, 0),
    contrast: clamp(adj.contrast, -1, 1, 0),
    saturation: clamp(adj.saturation, -1, 1, 0),
    hue: clamp(adj.hue, -180, 180, 0),
    gamma: clamp(adj.gamma, 0.2, 5, 1),
    kuwahara: Math.round(clamp(adj.kuwahara, 0, 4, 0)),
    clahe: clamp(adj.clahe, 0, 1, 0)
  };
  const fr = i.frame || {};
  s.frame = {
    aspect: oneOf(fr.aspect, ASPECTS.map((a) => a.id), "original"),
    zoom: clamp(fr.zoom, 1, 8, 1),
    x: clamp(fr.x, 0, 1, 0.5),
    y: clamp(fr.y, 0, 1, 0.5)
  };
  const source = oneOf(pal.source, ["builtin", "custom", "extract", "none"], d.palette.source);
  s.palette = {
    source,
    id: typeof pal.id === "string" ? pal.id : source === "builtin" ? d.palette.id : "",
    name: typeof pal.name === "string" ? pal.name : "",
    colors: [],
    count: Math.round(clamp(pal.count, 2, 256, d.palette.count)),
    distance: oneOf(pal.distance, ["oklab", "rgb"], d.palette.distance)
  };
  if (source === "builtin") {
    const p = getPalette(s.palette.id) || getPalette(d.palette.id);
    s.palette.id = p.id;
    s.palette.name = p.name;
    s.palette.colors = p.colors.map((c) => "#" + c);
  } else if (source === "custom") {
    s.palette.colors = (Array.isArray(pal.colors) ? pal.colors : []).filter(isColor).map(normHex).slice(0, 256);
    if (!s.palette.colors.length) s.palette.colors = ["#000000", "#ffffff"];
    s.palette.name = s.palette.name || "Custom";
  } else if (source === "extract") {
    s.palette.name = `Extracted (${s.palette.count})`;
  } else {
    s.palette.name = "None";
  }
  const method = DITHER_METHODS.some((m) => m.id === dit.method) ? dit.method : d.dither.method;
  s.dither = {
    method,
    strength: clamp(dit.strength, 0, 1, d.dither.strength),
    matrix: normalizeMatrix(dit.matrix)
  };
  s.alpha = { threshold: clamp(al.threshold, 0, 1, d.alpha.threshold) };
  s.cleanup = { orphans: bool(cl.orphans, false), smooth: bool(cl.smooth, false) };
  s.outline = {
    mode: oneOf(ol.mode, ["none", "outer", "inner", "ink"], "none"),
    color: isColor(ol.color) ? normHex(ol.color) : d.outline.color,
    corners: bool(ol.corners, false)
  };
  const fx = i.fx || {};
  s.fx = {
    mode: oneOf(fx.mode, FX_MODES.map((m) => m.id), d.fx.mode),
    strength: clamp(fx.strength, 0, 1, d.fx.strength),
    scanlines: clamp(fx.scanlines, 0, 1, d.fx.scanlines),
    aberration: clamp(fx.aberration, 0, 3, d.fx.aberration)
  };
  s.export = {
    size: oneOf(ex.size, ["scale", "source"], "scale"),
    scale: Math.round(clamp(ex.scale, 1, 64, d.export.scale)),
    indexed: bool(ex.indexed, d.export.indexed),
    grid: bool(ex.grid, false),
    gridColor: isColor(ex.gridColor) ? normHex(ex.gridColor) : d.export.gridColor
  };
  return s;
}
function normalizeMatrix(m) {
  if (!Array.isArray(m) || !m.length || !Array.isArray(m[0])) return null;
  const h = Math.min(16, m.length), w = Math.min(16, m[0].length);
  const out = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const v = Number((m[y] || [])[x]);
      row.push(Number.isFinite(v) ? v : 0);
    }
    out.push(row);
  }
  return out;
}
var ASPECTS = [
  { id: "original", label: "Original", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "2:3", label: "2:3", ratio: 2 / 3 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 }
];
function cropRect(srcW, srcH, frame = {}) {
  const a = (ASPECTS.find((x) => x.id === frame.aspect) || ASPECTS[0]).ratio || srcW / srcH;
  let w = srcW, h = srcW / a;
  if (h > srcH) {
    h = srcH;
    w = srcH * a;
  }
  const zoom = Math.max(1, frame.zoom || 1);
  w = Math.max(1, Math.min(srcW, Math.round(w / zoom)));
  h = Math.max(1, Math.min(srcH, Math.round(h / zoom)));
  const fx = frame.x ?? 0.5, fy = frame.y ?? 0.5;
  return { x: Math.round((srcW - w) * fx), y: Math.round((srcH - h) * fy), w, h };
}
function resolveSize(srcW, srcH, size) {
  let w, h;
  if (size.mode === "block") {
    w = Math.max(1, Math.round(srcW / size.block));
    h = Math.max(1, Math.round(srcH / size.block));
  } else {
    w = size.width;
    h = size.height || Math.max(1, Math.round(w * srcH / srcW));
  }
  return { width: Math.min(MAX_SIZE, w), height: Math.min(MAX_SIZE, h) };
}
function diff(a, b) {
  const out = {};
  for (const k2 of Object.keys(a)) {
    if (k2 === "version") continue;
    const va = a[k2], vb = b[k2];
    if (va && typeof va === "object" && !Array.isArray(va)) {
      const g = {};
      for (const kk of Object.keys(va)) if (JSON.stringify(va[kk]) !== JSON.stringify(vb && vb[kk])) g[kk] = va[kk];
      if (Object.keys(g).length) out[k2] = g;
    } else if (JSON.stringify(va) !== JSON.stringify(vb)) out[k2] = va;
  }
  return out;
}
var b64url = {
  enc(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(s) {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
};
function compactSettings(settings) {
  const s = normalizeSettings(settings);
  const out = diff(s, defaultSettings());
  if (out.palette) {
    if (s.palette.source !== "custom") {
      delete out.palette.colors;
      delete out.palette.name;
    }
    if (s.palette.source !== "builtin") delete out.palette.id;
    if (s.palette.source !== "extract") delete out.palette.count;
  }
  if (out.palette && !Object.keys(out.palette).length) delete out.palette;
  return out;
}
function encodeSettings(settings) {
  return b64url.enc(JSON.stringify({ v: SETTINGS_VERSION, ...compactSettings(settings) }));
}
function decodeSettings(str) {
  let s = String(str);
  const m = /[#&?]s=([A-Za-z0-9_-]+)/.exec(s);
  if (m) s = m[1];
  const obj = JSON.parse(b64url.dec(s));
  delete obj.v;
  return normalizeSettings(obj);
}
function settingsToJSON(settings) {
  return JSON.stringify({ $schema: "pixelforge/settings", version: SETTINGS_VERSION, ...compactSettings(settings) }, null, 2);
}
function settingsFromJSON(text) {
  const obj = typeof text === "string" ? JSON.parse(text) : text;
  delete obj.$schema;
  return normalizeSettings(obj);
}
function mergeSettings(base, patch) {
  const out = JSON.parse(JSON.stringify(base));
  for (const k2 of Object.keys(patch || {})) {
    if (patch[k2] && typeof patch[k2] === "object" && !Array.isArray(patch[k2]) && out[k2] && typeof out[k2] === "object") {
      Object.assign(out[k2], patch[k2]);
    } else out[k2] = patch[k2];
  }
  return normalizeSettings(out);
}

// lib/core/plan.js
init_color();

// lib/core/dither/bluenoise-data.js
var BLUE_NOISE_SIZE = 64;
var BLUE_NOISE_B64 = "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";

// lib/core/dither/matrices.js
function fromB64(b64) {
  if (typeof atob === "function") return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Uint8Array(Buffer.from(b64, "base64"));
}
function bayer(n) {
  let m = [[0]];
  for (let s = 1; s < n; s *= 2) {
    const next = [];
    for (let y = 0; y < s * 2; y++) next.push(new Array(s * 2));
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = 4 * m[y][x];
      next[y][x] = v;
      next[y][x + s] = v + 2;
      next[y + s][x] = v + 3;
      next[y + s][x + s] = v + 1;
    }
    m = next;
  }
  return m;
}
function toRanks(rows) {
  const h = rows.length, w = rows[0].length;
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push({ i: y * w + x, v: rows[y][x] });
  cells.sort((a, b) => a.v - b.v || a.i - b.i);
  const out = new Uint8Array(w * h);
  cells.forEach((c, r) => {
    out[c.i] = r;
  });
  return out;
}
function clustered(n) {
  const rows = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n * 2 * Math.PI, v = (y + 0.5) / n * 2 * Math.PI;
      row.push(-(Math.cos(u) + Math.cos(v)) + (x * n + y) * 1e-9);
    }
    rows.push(row);
  }
  return rows;
}
var CLUSTER4 = [[7, 13, 11, 4], [12, 16, 14, 8], [10, 15, 6, 2], [5, 9, 3, 1]];
var cache = /* @__PURE__ */ new Map();
function thresholdMap(method, custom = null) {
  if (method === "custom") {
    const m = custom && custom.length ? custom : bayer(4);
    return { w: m[0].length, h: m.length, levels: m.length * m[0].length, values: toRanks(m) };
  }
  if (cache.has(method)) return cache.get(method);
  let map;
  const sq = (rows) => ({ w: rows[0].length, h: rows.length, levels: rows.length * rows[0].length, values: toRanks(rows) });
  switch (method) {
    case "bayer2":
      map = sq(bayer(2));
      break;
    case "bayer4":
      map = sq(bayer(4));
      break;
    case "bayer8":
      map = sq(bayer(8));
      break;
    case "bayer16":
      map = sq(bayer(16));
      break;
    case "cluster4":
      map = sq(CLUSTER4);
      break;
    case "cluster8":
      map = sq(clustered(8));
      break;
    case "lines":
      map = sq([[0], [2], [1], [3]]);
      break;
    case "bluenoise":
      map = { w: BLUE_NOISE_SIZE, h: BLUE_NOISE_SIZE, levels: 256, values: fromB64(BLUE_NOISE_B64) };
      break;
    default:
      map = sq(bayer(4));
  }
  cache.set(method, map);
  return map;
}
function parseMatrix(text) {
  const rows = String(text).split(/\r?\n|;/).map((l) => l.trim()).filter((l) => l && !/^\//.test(l)).map((l) => l.replace(/[[\]]/g, "").split(/[\s,]+/).filter(Boolean).map(Number));
  if (!rows.length) throw new Error("Matrix is empty");
  const w = rows[0].length;
  if (rows.some((r) => r.length !== w || r.some((v) => !Number.isFinite(v)))) throw new Error("Every row needs the same number of values");
  if (w > 16 || rows.length > 16) throw new Error("Matrices are limited to 16\xD716");
  return rows;
}

// lib/core/dither/kernels.js
var k = (div, list) => list.map(([dx, dy, w]) => [dx, dy, w / div]);
var KERNELS = {
  "floyd-steinberg": k(16, [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]]),
  "atkinson": k(8, [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]]),
  "sierra-lite": k(4, [[1, 0, 2], [-1, 1, 1], [0, 1, 1]]),
  "sierra": k(32, [[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]]),
  "burkes": k(32, [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]]),
  "jarvis": k(48, [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]]),
  "stucki": k(42, [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]])
};
var MAX_KERNEL = 12;
function kernelSkew(kernel) {
  let s = 1;
  for (const [dx, dy] of kernel) if (dy > 0) s = Math.max(s, Math.floor(-dx / dy) + 1);
  return s;
}
var waveCount = (w, h, skew) => w - 1 + skew * (h - 1) + 1;

// lib/core/palette/extract.js
init_color();
function oklabToRgbBytes([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const lin2srgb = (v) => {
    const c = Math.max(0, Math.min(1, v));
    return Math.round((c <= 31308e-7 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
  };
  return [
    lin2srgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    lin2srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    lin2srgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
}
function extractPalette(img, count = 16, opts = {}) {
  const { maxSamples = 4e4, alphaThreshold = 0.5 } = opts;
  const n = img.width * img.height;
  const step = Math.max(1, Math.floor(n / maxSamples));
  const pts = [];
  for (let i = 0; i < n; i += step) {
    const o = i * 4;
    if (img.data[o + 3] < alphaThreshold * 255) continue;
    pts.push(oklab(img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255));
  }
  if (!pts.length) return ["#000000", "#ffffff"].slice(0, Math.max(1, count));
  const axisW = [1, 1.55, 1.55];
  let boxes = [pts];
  while (boxes.length < count) {
    let bi = -1, bestScore = -1, bestAxis = 0;
    boxes.forEach((b2, i) => {
      if (b2.length < 2) return;
      const pop = Math.pow(b2.length, 0.42);
      for (let a = 0; a < 3; a++) {
        let lo = Infinity, hi = -Infinity;
        for (const p of b2) {
          if (p[a] < lo) lo = p[a];
          if (p[a] > hi) hi = p[a];
        }
        const score = (hi - lo) * axisW[a] * pop;
        if (score > bestScore) {
          bestScore = score;
          bi = i;
          bestAxis = a;
        }
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
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      const s = sums[best];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    }
    centers = centers.map((c, i) => sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c);
  }
  centers.sort((a, b) => a[0] - b[0]);
  return [...new Set(centers.map((c) => toHex(oklabToRgbBytes(c))))];
}
function mean(list) {
  let l = 0, a = 0, b = 0;
  for (const p of list) {
    l += p[0];
    a += p[1];
    b += p[2];
  }
  return [l / list.length, a / list.length, b / list.length];
}

// lib/core/cpu/stages.js
init_color();
function sampleTexel(d, srcW, srcH, x, y, kuwahara = 0) {
  const cx = Math.max(0, Math.min(srcW - 1, x)), cy = Math.max(0, Math.min(srcH - 1, y));
  const co = (cy * srcW + cx) * 4;
  const ca = d[co + 3] / 255;
  if (!kuwahara || ca <= 0) return [d[co] / 255, d[co + 1] / 255, d[co + 2] / 255, ca];
  const rad = Math.min(4, kuwahara | 0);
  let bestVar = 1e18, br = d[co] / 255, bg = d[co + 1] / 255, bb = d[co + 2] / 255;
  for (let qy = 0; qy < 2; qy++) {
    for (let qx = 0; qx < 2; qx++) {
      let sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, cnt = 0;
      for (let dy = 0; dy <= rad; dy++) {
        const yy = Math.max(0, Math.min(srcH - 1, cy + (qy === 0 ? -dy : dy)));
        for (let dx = 0; dx <= rad; dx++) {
          const xx = Math.max(0, Math.min(srcW - 1, cx + (qx === 0 ? -dx : dx)));
          const o = (yy * srcW + xx) * 4;
          const r = d[o] / 255, g = d[o + 1] / 255, b = d[o + 2] / 255;
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          sr += r;
          sg += g;
          sb += b;
          sl += l;
          sl2 += l * l;
          cnt++;
        }
      }
      const ml = sl / cnt, v = sl2 / cnt - ml * ml;
      if (v < bestVar) {
        bestVar = v;
        br = sr / cnt;
        bg = sg / cnt;
        bb = sb / cnt;
      }
    }
  }
  return [br, bg, bb, ca];
}
function sobelAt(d, srcW, srcH, x, y) {
  const lumAt = (px, py) => {
    const xx = Math.max(0, Math.min(srcW - 1, px)), yy = Math.max(0, Math.min(srcH - 1, py));
    const o = (yy * srcW + xx) * 4;
    return (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
  };
  const lmm = lumAt(x - 1, y - 1), lm0 = lumAt(x, y - 1), lmp = lumAt(x + 1, y - 1);
  const l0m = lumAt(x - 1, y), l0p = lumAt(x + 1, y);
  const lpm = lumAt(x - 1, y + 1), lp0 = lumAt(x, y + 1), lpp = lumAt(x + 1, y + 1);
  const gx = lmp + 2 * l0p + lpp - (lmm + 2 * l0m + lpm);
  const gy = lpm + 2 * lp0 + lpp - (lmm + 2 * lm0 + lmp);
  return Math.sqrt(gx * gx + gy * gy);
}
function resample(src, w, h, mode = "hybrid", crop = null, kuwahara = 0) {
  const ox = crop ? crop.x : 0, oy = crop ? crop.y : 0;
  const sw = crop ? crop.w : src.width, sh = crop ? crop.h : src.height, d = src.data;
  const out = new Float32Array(w * h * 4);
  const nx = mode === "nearest" ? 1 : Math.min(12, Math.max(1, Math.ceil(sw / w)));
  const ny = mode === "nearest" ? 1 : Math.min(12, Math.max(1, Math.ceil(sh / h)));
  const xs = new Int32Array(w * nx), ys = new Int32Array(h * ny);
  for (let x = 0; x < w; x++) for (let i = 0; i < nx; i++) xs[x * nx + i] = ox + Math.min(sw - 1, Math.floor((2 * (x * nx + i) + 1) * sw / (2 * w * nx)));
  for (let y = 0; y < h; y++) for (let j = 0; j < ny; j++) ys[y * ny + j] = oy + Math.min(sh - 1, Math.floor((2 * (y * ny + j) + 1) * sh / (2 * h * ny)));
  const useEdge = mode === "sobel" || mode === "hybrid";
  const halfNx = 0.5 * Math.max(1, nx), halfNy = 0.5 * Math.max(1, ny);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      let sr = 0, sg = 0, sb = 0, swt = 0, minL = 1e9, maxL = -1e9;
      const samples = mode === "hybrid" ? [] : null;
      for (let j = 0; j < ny; j++) {
        const sy = ys[y * ny + j];
        const dyc = (j + 0.5 - halfNy) / halfNy;
        for (let i = 0; i < nx; i++) {
          const sx = xs[x * nx + i];
          const [cr, cg, cb, al] = sampleTexel(d, src.width, src.height, sx, sy, kuwahara);
          r += cr * al;
          g += cg * al;
          b += cb * al;
          a += al;
          if (useEdge && al > 0) {
            const l = 0.299 * cr + 0.587 * cg + 0.114 * cb;
            if (l < minL) minL = l;
            if (l > maxL) maxL = l;
            const mag = sobelAt(d, src.width, src.height, sx, sy);
            if (mode === "sobel") {
              const wt = (mag + 0.02) * al;
              sr += cr * wt;
              sg += cg * wt;
              sb += cb * wt;
              swt += wt;
            } else {
              const dxc = (i + 0.5 - halfNx) / halfNx;
              const cw = Math.max(0.25, 1.35 - 0.55 * (dxc * dxc + dyc * dyc));
              samples.push([cr, cg, cb, l, al * cw / (1 + 2.5 * mag)]);
            }
          }
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        let fr = r / a, fg = g / a, fb = b / a;
        if (mode === "sobel" && swt > 0) {
          fr = sr / swt;
          fg = sg / swt;
          fb = sb / swt;
        } else if (mode === "hybrid" && maxL - minL > 0.1) {
          const midL = 0.5 * (minL + maxL);
          let lr = 0, lg = 0, lb = 0, lw = 0, hr = 0, hg = 0, hb = 0, hw = 0;
          for (const [cr, cg, cb, l, pw] of samples) {
            if (l <= midL) {
              lr += cr * pw;
              lg += cg * pw;
              lb += cb * pw;
              lw += pw;
            } else {
              hr += cr * pw;
              hg += cg * pw;
              hb += cb * pw;
              hw += pw;
            }
          }
          let pr = fr, pg = fg, pb = fb;
          if (hw * 1.12 >= lw && hw > 0) {
            pr = hr / hw;
            pg = hg / hw;
            pb = hb / hw;
          } else if (lw > 0) {
            pr = lr / lw;
            pg = lg / lw;
            pb = lb / lw;
          }
          const t = Math.min(1, Math.max(0, (maxL - minL - 0.1) / 0.22));
          const blend = t * t * (3 - 2 * t) * 0.98;
          fr += (pr - fr) * blend;
          fg += (pg - fg) * blend;
          fb += (pb - fb) * blend;
        }
        out[o] = fr;
        out[o + 1] = fg;
        out[o + 2] = fb;
      }
      out[o + 3] = a / (nx * ny);
    }
  }
  return out;
}
function adjust(buf, { brightness = 0, contrast = 0, saturation = 0, hue = 0, gamma = 1 }) {
  if (!brightness && !contrast && !saturation && !hue && gamma === 1) return buf;
  const f = contrast >= 0 ? 1 / (1 - 0.99 * contrast) : 1 + contrast;
  const ig = 1 / gamma;
  const hk = Math.cos(hue * Math.PI / 180), hq = Math.sin(hue * Math.PI / 180);
  const M = [
    0.213 + 0.787 * hk - 0.213 * hq,
    0.715 - 0.715 * hk - 0.715 * hq,
    0.072 - 0.072 * hk + 0.928 * hq,
    0.213 - 0.213 * hk + 0.143 * hq,
    0.715 + 0.285 * hk + 0.14 * hq,
    0.072 - 0.072 * hk - 0.283 * hq,
    0.213 - 0.213 * hk - 0.787 * hq,
    0.715 - 0.715 * hk + 0.715 * hq,
    0.072 + 0.928 * hk + 0.072 * hq
  ];
  for (let o = 0; o < buf.length; o += 4) {
    let r = buf[o] + brightness, g = buf[o + 1] + brightness, b = buf[o + 2] + brightness;
    r = (r - 0.5) * f + 0.5;
    g = (g - 0.5) * f + 0.5;
    b = (b - 0.5) * f + 0.5;
    const l = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
    const k2 = 1 + saturation;
    r = l + (r - l) * k2;
    g = l + (g - l) * k2;
    b = l + (b - l) * k2;
    if (hue) {
      const r2 = M[0] * r + M[1] * g + M[2] * b, g2 = M[3] * r + M[4] * g + M[5] * b, b2 = M[6] * r + M[7] * g + M[8] * b;
      r = r2;
      g = g2;
      b = b2;
    }
    buf[o] = Math.pow(clamp01(r), ig);
    buf[o + 1] = Math.pow(clamp01(g), ig);
    buf[o + 2] = Math.pow(clamp01(b), ig);
  }
  return buf;
}
function alphaCut(buf, threshold) {
  for (let o = 3; o < buf.length; o += 4) buf[o] = buf[o] >= threshold && buf[o] > 0 ? 1 : 0;
  return buf;
}
function localContrast(buf, w, h, amount = 0) {
  if (!(amount > 1e-3)) return buf;
  const src = buf.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (src[o + 3] < 0.5) continue;
      let sumL = 0, sumL2 = 0, cnt = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = Math.max(0, Math.min(h - 1, y + dy));
        for (let dx = -2; dx <= 2; dx++) {
          const xx = Math.max(0, Math.min(w - 1, x + dx));
          const qo = (yy * w + xx) * 4;
          if (src[qo + 3] < 0.5) continue;
          const l = 0.299 * src[qo] + 0.587 * src[qo + 1] + 0.114 * src[qo + 2];
          sumL += l;
          sumL2 += l * l;
          cnt++;
        }
      }
      if (cnt < 2) continue;
      const meanL = sumL / cnt;
      const stdL = Math.sqrt(Math.max(0, sumL2 / cnt - meanL * meanL));
      const L = 0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2];
      const gain = Math.min(2.6, 1 + amount * (1.35 / (0.18 + stdL)));
      const boosted = clamp01(meanL + (L - meanL) * gain);
      const delta = boosted - L;
      buf[o] = clamp01(src[o] + delta);
      buf[o + 1] = clamp01(src[o + 1] + delta);
      buf[o + 2] = clamp01(src[o + 2] + delta);
    }
  }
  return buf;
}
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
function paletteSpace(palette, distance) {
  const n = palette.length;
  const coords = new Float64Array(n * 3);
  const rgb = new Float64Array(n * 3);
  palette.forEach((c, i) => {
    rgb.set([c[0] / 255, c[1] / 255, c[2] / 255], i * 3);
    coords.set(distance === 1 ? [c[0] / 255, c[1] / 255, c[2] / 255] : oklab(c[0] / 255, c[1] / 255, c[2] / 255), i * 3);
  });
  return { n, coords, rgb, distance };
}
var W_RGB = [0.299, 0.587, 0.114];
function nearest(sp, r, g, b) {
  let p0, p1, p2, w0 = 1, w1 = 1.3225, w2 = 1.3225;
  if (sp.distance === 1) {
    p0 = r;
    p1 = g;
    p2 = b;
    w0 = W_RGB[0];
    w1 = W_RGB[1];
    w2 = W_RGB[2];
  } else [p0, p1, p2] = oklab(r, g, b);
  let best = 0, bd = Infinity;
  const c = sp.coords;
  for (let i = 0; i < sp.n; i++) {
    const d0 = p0 - c[i * 3], d1 = p1 - c[i * 3 + 1], d2 = p2 - c[i * 3 + 2];
    const dist = w0 * d0 * d0 + w1 * d1 * d1 + w2 * d2 * d2;
    if (dist < bd) {
      bd = dist;
      best = i;
    }
  }
  return best;
}
function quantizeOrdered(buf, w, h, plan) {
  const out = new Uint8ClampedArray(w * h * 4);
  const sp = plan.quantize ? paletteSpace(plan.palette, plan.distance) : null;
  const map = plan.kind === "ordered" ? plan.map : null;
  const amt = map ? plan.spread * plan.settings.dither.strength : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (buf[o + 3] < 0.5) continue;
      let r = buf[o], g = buf[o + 1], b = buf[o + 2];
      if (sp) {
        if (map) {
          const t = (map.values[y % map.h * map.w + x % map.w] + 0.5) / map.levels - 0.5;
          r = clamp01(r + t * amt);
          g = clamp01(g + t * amt);
          b = clamp01(b + t * amt);
        }
        const i = nearest(sp, r, g, b);
        out[o] = plan.palette[i][0];
        out[o + 1] = plan.palette[i][1];
        out[o + 2] = plan.palette[i][2];
      } else {
        out[o] = Math.round(r * 255);
        out[o + 1] = Math.round(g * 255);
        out[o + 2] = Math.round(b * 255);
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
function quantizeDiffusion(buf, w, h, plan) {
  const out = new Uint8ClampedArray(w * h * 4);
  const sp = paletteSpace(plan.palette, plan.distance);
  const acc = new Float32Array(w * h * 3);
  const strength = plan.settings.dither.strength;
  const kernel = plan.kernel;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, o = p * 4;
      if (buf[o + 3] < 0.5) continue;
      const r = clamp01(buf[o] + acc[p * 3] * strength);
      const g = clamp01(buf[o + 1] + acc[p * 3 + 1] * strength);
      const b = clamp01(buf[o + 2] + acc[p * 3 + 2] * strength);
      const i = nearest(sp, r, g, b);
      const er = r - sp.rgb[i * 3], eg = g - sp.rgb[i * 3 + 1], eb = b - sp.rgb[i * 3 + 2];
      for (const [dx, dy, wt] of kernel) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= w || yy >= h) continue;
        const q = (yy * w + xx) * 3;
        acc[q] += er * wt;
        acc[q + 1] += eg * wt;
        acc[q + 2] += eb * wt;
      }
      out[o] = plan.palette[i][0];
      out[o + 1] = plan.palette[i][1];
      out[o + 2] = plan.palette[i][2];
      out[o + 3] = 255;
    }
  }
  return out;
}
var key = (d, o) => d[o + 3] === 0 ? -1 : d[o] << 16 | d[o + 1] << 8 | d[o + 2];
var N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function removeOrphans(px, w, h) {
  const src = px.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, c = key(src, o);
      const ks = [], os = [];
      for (const [dx, dy] of N4) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const oo = (yy * w + xx) * 4;
        ks.push(key(src, oo));
        os.push(oo);
      }
      if (ks.length < 2 || ks.includes(c)) continue;
      let best = 0, bc = 0;
      for (let i = 0; i < ks.length; i++) {
        let n = 0;
        for (let j = 0; j < ks.length; j++) if (ks[j] === ks[i]) n++;
        if (n > bc) {
          bc = n;
          best = i;
        }
      }
      px.set(src.subarray(os[best], os[best] + 4), o);
    }
  }
  return px;
}
function smoothMajority(px, w, h) {
  const src = px.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, c = key(src, o);
      const ks = [], os = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
        const oo = (yy * w + xx) * 4;
        ks.push(key(src, oo));
        os.push(oo);
      }
      for (let i = 0; i < 9; i++) {
        if (ks[i] === c) continue;
        let n = 0;
        for (let j = 0; j < 9; j++) if (ks[j] === ks[i]) n++;
        if (n >= 5) {
          px.set(src.subarray(os[i], os[i] + 4), o);
          break;
        }
      }
    }
  }
  return px;
}
function outline(px, w, h, { mode, color, corners }) {
  if (mode === "none") return px;
  const src = px.slice();
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const nb = corners ? [[0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]] : N4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const me = opaque(x, y);
      let hit = false;
      if (mode === "ink") {
        if (!me) continue;
        const mo = (y * w + x) * 4;
        const lm = (0.299 * src[mo] + 0.587 * src[mo + 1] + 0.114 * src[mo + 2]) / 255;
        for (const [dx, dy] of nb) {
          const xx = x + dx, yy = y + dy;
          if (!opaque(xx, yy)) continue;
          const qo = (yy * w + xx) * 4;
          const lq = (0.299 * src[qo] + 0.587 * src[qo + 1] + 0.114 * src[qo + 2]) / 255;
          if (lq - lm >= 0.28) {
            hit = true;
            break;
          }
        }
      } else {
        for (const [dx, dy] of nb) {
          const xx = x + dx, yy = y + dy;
          if (!inside(xx, yy)) continue;
          if (mode === "outer" ? !me && opaque(xx, yy) : me && !opaque(xx, yy)) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        const o = (y * w + x) * 4;
        px[o] = color[0];
        px[o + 1] = color[1];
        px[o + 2] = color[2];
        px[o + 3] = 255;
      }
    }
  }
  return px;
}
function postFX(px, w, h, fx = {}) {
  const mode = fx.mode || "none";
  const str = fx.strength ?? 0.65;
  const scan = fx.scanlines ?? 0;
  const ab = fx.aberration ?? 0;
  if (mode === "none" && scan <= 1e-3 && ab <= 1e-3) return px;
  const src = px.slice();
  const sample = (x, y) => {
    const xx = Math.max(0, Math.min(w - 1, x)), yy = Math.max(0, Math.min(h - 1, y));
    const o = (yy * w + xx) * 4;
    return [src[o] / 255, src[o + 1] / 255, src[o + 2] / 255, src[o + 3] / 255];
  };
  const luma3 = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const mix1 = (a, b, t) => a + (b - a) * t;
  const clampRange = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (src[o + 3] < 128) continue;
      let r = src[o] / 255, g = src[o + 1] / 255, b = src[o + 2] / 255;
      if (ab > 1e-3) {
        const s0 = Math.floor(ab), s1 = s0 + 1, f = ab - s0;
        r = mix1(sample(x - s0, y)[0], sample(x - s1, y)[0], f);
        b = mix1(sample(x + s0, y)[2], sample(x + s1, y)[2], f);
      }
      if (mode === "bloom") {
        let gr = 0, gg = 0, gb = 0, wSum = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const wt = 1 / (1 + dx * dx + dy * dy);
            const sc = sample(x + dx, y + dy);
            const peak = Math.max(sc[0], sc[1], sc[2]);
            const br = Math.max(0, peak - 0.42) / 0.58;
            gr += sc[0] * br * wt;
            gg += sc[1] * br * wt;
            gb += sc[2] * br * wt;
            wSum += wt;
          }
        }
        wSum = Math.max(1, wSum);
        gr /= wSum;
        gg /= wSum;
        gb /= wSum;
        const lm = 0.299 * r + 0.587 * g + 0.114 * b;
        const lift = (1 - lm) * str;
        r = clamp01(r + gr * 1.45 * str + 0.025 * lift);
        g = clamp01(g + gg * 1.45 * str + 0.02 * lift);
        b = clamp01(b + gb * 1.45 * str + 0.075 * lift);
      } else if (mode === "crt") {
        const lN = sample(x - 1, y), rN = sample(x + 1, y);
        const bt = 0.45 * str;
        r = mix1(r, 0.18 * lN[0] + 0.64 * r + 0.18 * rN[0], bt);
        g = mix1(g, 0.18 * lN[1] + 0.64 * g + 0.18 * rN[1], bt);
        b = mix1(b, 0.18 * lN[2] + 0.64 * b + 0.18 * rN[2], bt);
        const sub = x % 3;
        const mask = sub === 0 ? [1.07, 0.96, 0.96] : sub === 1 ? [0.96, 1.07, 0.96] : [0.96, 0.96, 1.08];
        r *= mix1(1, mask[0], str);
        g *= mix1(1, mask[1], str);
        b *= mix1(1, mask[2], str);
        if (y % 2 === 1) {
          const k2 = 1 - 0.22 * str;
          r *= k2;
          g *= k2;
          b *= k2;
        }
        const ux = (x + 0.5) / Math.max(1, w) * 2 - 1, uy = (y + 0.5) / Math.max(1, h) * 2 - 1;
        const vig = clampRange(1 - 0.24 * str * (ux * ux + uy * uy), 0.55, 1) * (1 + 0.12 * str);
        r = clamp01(r * vig);
        g = clamp01(g * vig);
        b = clamp01(b * vig);
      } else if (mode === "voxel") {
        const lC = 0.299 * r + 0.587 * g + 0.114 * b;
        const lTL = 0.5 * (luma3(sample(x - 1, y)) + luma3(sample(x, y - 1)));
        const lBR = 0.5 * (luma3(sample(x + 1, y)) + luma3(sample(x, y + 1)));
        const bevel = clampRange((lC - lTL) * 1.4, -0.25, 0.28) - clampRange((lC - lBR) * 1.2, -0.22, 0.25);
        const facet = (x + y) % 2 === 0 ? 0.032 : -0.032;
        const d = (bevel + facet) * str;
        r = clamp01(r + d);
        g = clamp01(g + d);
        b = clamp01(b + d);
      } else if (mode === "lcd") {
        const ghost = (1 - luma3(sample(x - 1, y - 1))) * 0.12 * str;
        const cell = x % 2 === 0 && y % 2 === 0 ? 1.04 : 0.94;
        const cf = 1 + (cell - 1) * str;
        r = clamp01(r * cf - ghost + 0.76 * 0.04 * str);
        g = clamp01(g * cf - ghost + 0.82 * 0.04 * str);
        b = clamp01(b * cf - ghost + 0.62 * 0.04 * str);
      } else if (mode === "oscilloscope") {
        const lL = luma3(sample(x - 1, y)), lR = luma3(sample(x + 1, y));
        const lU = luma3(sample(x, y - 1)), lD = luma3(sample(x, y + 1));
        const edge = clamp01(Math.sqrt((lR - lL) * (lR - lL) + (lD - lU) * (lD - lU)) * 2.4);
        const lm = 0.299 * r + 0.587 * g + 0.114 * b;
        const grid = x % 16 === 0 || y % 16 === 0 ? 0.11 : x % 4 === 0 && y % 4 === 0 ? 0.06 : 0;
        const beam = clamp01(edge * 0.85 + Math.pow(lm, 1.35) * 0.55);
        const core = Math.pow(beam, 3) * 0.65;
        const or = clamp01(0.015 + 0.05 * grid + 0.08 * beam + 0.45 * core);
        const og = clamp01(0.055 + 0.32 * grid + 0.96 * beam + 1 * core);
        const ob = clamp01(0.035 + 0.16 * grid + 0.46 * beam + 0.78 * core);
        r = clamp01(mix1(r, or, str));
        g = clamp01(mix1(g, og, str));
        b = clamp01(mix1(b, ob, str));
      } else if (mode === "blueprint") {
        const lL = luma3(sample(x - 1, y)), lR = luma3(sample(x + 1, y));
        const lU = luma3(sample(x, y - 1)), lD = luma3(sample(x, y + 1));
        const edge = clamp01(Math.sqrt((lR - lL) * (lR - lL) + (lD - lU) * (lD - lU)) * 2.5);
        const lm = 0.299 * r + 0.587 * g + 0.114 * b;
        const majorG = x % 24 === 0 || y % 24 === 0 ? 0.16 : x % 8 === 0 || y % 8 === 0 ? 0.065 : 0;
        const wash = lm * 0.55 + majorG;
        const core = Math.pow(edge, 2.5) * 0.6;
        const br = clamp01(0.035 + 0.1 * wash + 0.36 * edge + 0.92 * core);
        const bg = clamp01(0.11 + 0.3 * wash + 0.84 * edge + 0.98 * core);
        const bb = clamp01(0.24 + 0.54 * wash + 1 * edge + 1 * core);
        r = clamp01(mix1(r, br, str));
        g = clamp01(mix1(g, bg, str));
        b = clamp01(mix1(b, bb, str));
      }
      if (scan > 1e-3 && y % 2 === 1) {
        const k2 = 1 - 0.28 * scan;
        r *= k2;
        g *= k2;
        b *= k2;
      }
      px[o] = Math.round(clamp01(r) * 255);
      px[o + 1] = Math.round(clamp01(g) * 255);
      px[o + 2] = Math.round(clamp01(b) * 255);
    }
  }
  return px;
}

// lib/core/plan.js
function makePlan(settings, src) {
  const s = normalizeSettings(settings);
  const crop = cropRect(src.width, src.height, s.frame);
  const { width, height } = resolveSize(crop.w, crop.h, s.size);
  let colors = s.palette.colors;
  if (s.palette.source === "extract") colors = extractFrom(src, s, width, height, crop);
  const quantize = s.palette.source !== "none" && colors.length > 0;
  const palette = quantize ? colors.map(parseColor) : [];
  let kind = quantize ? ditherKind(s.dither.method) : "none";
  if (s.dither.strength <= 0) kind = "none";
  const map = kind === "ordered" ? thresholdMap(s.dither.method, s.dither.matrix) : null;
  const kernel = kind === "diffusion" ? KERNELS[s.dither.method] : null;
  const skew = kernel ? kernelSkew(kernel) : 1;
  return {
    settings: s,
    srcWidth: src.width,
    srcHeight: src.height,
    crop,
    // source pixels kept by the frame settings
    width,
    height,
    quantize,
    kind,
    palette,
    // [[r, g, b] bytes]
    paletteHex: quantize ? colors.slice() : null,
    distance: s.palette.distance === "rgb" ? 1 : 0,
    spread: quantize ? paletteSpread(palette) : 0,
    map,
    kernel,
    skew,
    waves: kernel ? waveCount(width, height, skew) : 0,
    outline: { mode: s.outline.mode, color: parseColor(s.outline.color), corners: s.outline.corners }
  };
}
function extractFrom(src, s, width, height, crop) {
  const k2 = Math.min(1, 160 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * k2)), h = Math.max(1, Math.round(height * k2));
  const prep = resample(src, w, h, s.size.resample || "hybrid", crop, s.adjust.kuwahara || 0);
  adjust(prep, s.adjust);
  if (s.adjust.clahe > 1e-3) localContrast(prep, w, h, s.adjust.clahe);
  const bytes = new Uint8ClampedArray(prep.length);
  for (let i = 0; i < prep.length; i++) bytes[i] = Math.round(prep[i] * 255);
  return extractPalette({ data: bytes, width: w, height: h }, s.palette.count, { alphaThreshold: Math.max(0.01, s.alpha.threshold) });
}

// lib/core/cpu/pipeline.js
function runCPU(plan, src) {
  const { width: w, height: h, settings: s } = plan;
  const buf = resample(src, w, h, s.size.resample, plan.crop, s.adjust.kuwahara || 0);
  adjust(buf, s.adjust);
  alphaCut(buf, s.alpha.threshold);
  if (s.adjust.clahe > 1e-3) localContrast(buf, w, h, s.adjust.clahe);
  const px = plan.kind === "diffusion" ? quantizeDiffusion(buf, w, h, plan) : quantizeOrdered(buf, w, h, plan);
  if (s.cleanup.orphans) removeOrphans(px, w, h);
  if (s.cleanup.smooth) smoothMajority(px, w, h);
  outline(px, w, h, plan.outline);
  if (s.fx) postFX(px, w, h, s.fx);
  return px;
}

// lib/core/gpu/backend.js
var import_shadermate = require("shadermate");

// lib/core/gpu/shaders.js
var COMMON = (
  /* glsl */
  `
uniform sampler2D u_palette;
uniform int u_count;
uniform int u_distance;

ivec2 topDown() { return ivec2(int(gl_FragCoord.x), int(u_resolution.y) - 1 - int(gl_FragCoord.y)); }
vec4 at(sampler2D t, ivec2 p) { ivec2 s = textureSize(t, 0); p = clamp(p, ivec2(0), s - 1); return texelFetch(t, ivec2(p.x, s.y - 1 - p.y), 0); }
bool inside(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < int(u_resolution.x) && p.y < int(u_resolution.y); }
vec3 palColor(int i) { return texelFetch(u_palette, ivec2(i, 0), 0).rgb; }

float linear1(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
vec3 oklab(vec3 c) {
  c = vec3(linear1(c.r), linear1(c.g), linear1(c.b));
  float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 1.0 / 3.0);
  float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 1.0 / 3.0);
  float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 space(vec3 c) { return u_distance == 1 ? c : oklab(c); }
int nearestIndex(vec3 c) {
  vec3 p = space(c);
  vec3 w = u_distance == 1 ? vec3(0.299, 0.587, 0.114) : vec3(1.0, 1.15, 1.15);
  int best = 0; float bd = 1e20;
  for (int i = 0; i < 256; i++) {
    if (i >= u_count) break;
    vec3 d = p - space(palColor(i));
    float dist = dot(w * d, w * d);
    if (dist < bd) { bd = dist; best = i; }
  }
  return best;
}
int colorKey(vec4 c) {
  if (c.a < 0.5) return -1;
  ivec3 b = ivec3(floor(c.rgb * 255.0 + 0.5));
  return b.r * 65536 + b.g * 256 + b.b;
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`
);
var PREP = (
  /* glsl */
  `
uniform int u_resample;
uniform int u_kuwahara;
uniform vec4 u_adjust;
uniform float u_hue;
uniform float u_alphaCut;
uniform ivec4 u_crop;

vec4 sampleSrc(ivec2 pos) {
  if (u_kuwahara <= 0) return at(iChannel0, pos);
  vec4 center = at(iChannel0, pos);
  if (center.a <= 0.0) return center;
  float bestVar = 1e18;
  vec3 bestCol = center.rgb;
  int rad = min(4, u_kuwahara);
  for (int qy = 0; qy < 2; qy++) {
    for (int qx = 0; qx < 2; qx++) {
      vec3 sumC = vec3(0.0);
      float sumL = 0.0, sumL2 = 0.0, cnt = 0.0;
      for (int dy = 0; dy <= 4; dy++) {
        if (dy > rad) break;
        int yy = pos.y + (qy == 0 ? -dy : dy);
        for (int dx = 0; dx <= 4; dx++) {
          if (dx > rad) break;
          int xx = pos.x + (qx == 0 ? -dx : dx);
          vec4 sc = at(iChannel0, ivec2(xx, yy));
          float l = luma(sc.rgb);
          sumC += sc.rgb; sumL += l; sumL2 += l * l; cnt += 1.0;
        }
      }
      float ml = sumL / cnt;
      float v = (sumL2 / cnt) - ml * ml;
      if (v < bestVar) { bestVar = v; bestCol = sumC / cnt; }
    }
  }
  return vec4(bestCol, center.a);
}

float sobelAt(ivec2 p) {
  float lmm = luma(at(iChannel0, p + ivec2(-1, -1)).rgb);
  float lm0 = luma(at(iChannel0, p + ivec2( 0, -1)).rgb);
  float lmp = luma(at(iChannel0, p + ivec2( 1, -1)).rgb);
  float l0m = luma(at(iChannel0, p + ivec2(-1,  0)).rgb);
  float l0p = luma(at(iChannel0, p + ivec2( 1,  0)).rgb);
  float lpm = luma(at(iChannel0, p + ivec2(-1,  1)).rgb);
  float lp0 = luma(at(iChannel0, p + ivec2( 0,  1)).rgb);
  float lpp = luma(at(iChannel0, p + ivec2( 1,  1)).rgb);
  float gx = (lmp + 2.0 * l0p + lpp) - (lmm + 2.0 * l0m + lpm);
  float gy = (lpm + 2.0 * lp0 + lpp) - (lmm + 2.0 * lm0 + lmp);
  return sqrt(gx * gx + gy * gy);
}

void main() {
  ivec2 P = topDown();
  ivec2 R = ivec2(u_resolution);
  ivec2 O = u_crop.xy;
  ivec2 S = u_crop.zw;
  int nx = u_resample == 1 ? 1 : clamp((S.x + R.x - 1) / R.x, 1, 12);
  int ny = u_resample == 1 ? 1 : clamp((S.y + R.y - 1) / R.y, 1, 12);

  vec4 boxAcc = vec4(0.0);
  vec3 salAcc = vec3(0.0);
  float salW = 0.0;
  float minL = 1e9, maxL = -1e9;

  for (int j = 0; j < 12; j++) {
    if (j >= ny) break;
    int sy = min(S.y - 1, ((2 * (P.y * ny + j) + 1) * S.y) / (2 * R.y * ny));
    for (int i = 0; i < 12; i++) {
      if (i >= nx) break;
      int sx = min(S.x - 1, ((2 * (P.x * nx + i) + 1) * S.x) / (2 * R.x * nx));
      ivec2 sp = O + ivec2(sx, sy);
      vec4 c = sampleSrc(sp);
      boxAcc += vec4(c.rgb * c.a, c.a);
      if (u_resample >= 2 && c.a > 0.0) {
        float l = luma(c.rgb);
        minL = min(minL, l); maxL = max(maxL, l);
        float mag = sobelAt(sp);
        float w = (u_resample == 2 ? (mag + 0.02) : (1.0 + 3.2 * mag)) * c.a;
        salAcc += c.rgb * w;
        salW += w;
      }
    }
  }

  vec3 c = boxAcc.a > 0.0 ? boxAcc.rgb / boxAcc.a : vec3(0.0);
  float a = boxAcc.a / float(nx * ny);

  if (u_resample == 2 && salW > 0.0) {
    c = salAcc / salW;
  } else if (u_resample == 3 && (maxL - minL) > 0.10) {
    float midL = 0.5 * (minL + maxL);
    vec3 loC = vec3(0.0), hiC = vec3(0.0);
    float loW = 0.0, hiW = 0.0;
    float hNx = 0.5 * max(1.0, float(nx)), hNy = 0.5 * max(1.0, float(ny));
    for (int j = 0; j < 12; j++) {
      if (j >= ny) break;
      int sy = min(S.y - 1, ((2 * (P.y * ny + j) + 1) * S.y) / (2 * R.y * ny));
      float dyc = ((float(j) + 0.5) - hNy) / hNy;
      for (int i = 0; i < 12; i++) {
        if (i >= nx) break;
        int sx = min(S.x - 1, ((2 * (P.x * nx + i) + 1) * S.x) / (2 * R.x * nx));
        ivec2 sp = O + ivec2(sx, sy);
        vec4 sc = sampleSrc(sp);
        if (sc.a <= 0.0) continue;
        float l = luma(sc.rgb);
        float mag = sobelAt(sp);
        float dxc = ((float(i) + 0.5) - hNx) / hNx;
        float cw = max(0.25, 1.35 - 0.55 * (dxc * dxc + dyc * dyc));
        float pw = (sc.a * cw) / (1.0 + 2.5 * mag);
        if (l <= midL) { loC += sc.rgb * pw; loW += pw; }
        else { hiC += sc.rgb * pw; hiW += pw; }
      }
    }
    vec3 plat = c;
    if (hiW * 1.12 >= loW && hiW > 0.0) plat = hiC / hiW;
    else if (loW > 0.0) plat = loC / loW;
    float span = clamp(((maxL - minL) - 0.10) / 0.22, 0.0, 1.0);
    float blend = span * span * (3.0 - 2.0 * span) * 0.98;
    c = mix(c, plat, blend);
  }

  float br = u_adjust.x, co = u_adjust.y, sa = u_adjust.z, ga = u_adjust.w;
  if (br != 0.0 || co != 0.0 || sa != 0.0 || ga != 1.0 || u_hue != 0.0) {
    float f = co >= 0.0 ? 1.0 / (1.0 - 0.99 * co) : 1.0 + co;
    c = (c + br - 0.5) * f + 0.5;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = l + (c - l) * (1.0 + sa);
    if (u_hue != 0.0) {
      float h = radians(u_hue), k = cos(h), q = sin(h);
      c = vec3(
        (0.213 + 0.787 * k - 0.213 * q) * c.r + (0.715 - 0.715 * k - 0.715 * q) * c.g + (0.072 - 0.072 * k + 0.928 * q) * c.b,
        (0.213 - 0.213 * k + 0.143 * q) * c.r + (0.715 + 0.285 * k + 0.140 * q) * c.g + (0.072 - 0.072 * k - 0.283 * q) * c.b,
        (0.213 - 0.213 * k - 0.787 * q) * c.r + (0.715 - 0.715 * k + 0.715 * q) * c.g + (0.072 + 0.928 * k + 0.072 * q) * c.b);
    }
    c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / ga));
  } else {
    c = clamp(c, 0.0, 1.0);
  }
  a = (a >= u_alphaCut && a > 0.0) ? 1.0 : 0.0;
  fragColor = vec4(c * a, a);
}
`
);
var CLAHE = (
  /* glsl */
  `
uniform float u_clahe;
void main() {
  ivec2 P = topDown();
  vec4 me = at(iChannel0, P);
  if (u_clahe <= 0.001 || me.a < 0.5) { fragColor = me; return; }
  ivec2 R = ivec2(u_resolution);
  float sumL = 0.0, sumL2 = 0.0, cnt = 0.0;
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      ivec2 Q = clamp(P + ivec2(dx, dy), ivec2(0), R - 1);
      vec4 s = at(iChannel0, Q);
      if (s.a < 0.5) continue;
      float l = luma(s.rgb);
      sumL += l; sumL2 += l * l; cnt += 1.0;
    }
  }
  if (cnt < 2.0) { fragColor = me; return; }
  float meanL = sumL / cnt;
  float stdL = sqrt(max(0.0, (sumL2 / cnt) - meanL * meanL));
  float L = luma(me.rgb);
  float gain = min(2.6, 1.0 + u_clahe * (1.35 / (0.18 + stdL)));
  float boosted = clamp(meanL + (L - meanL) * gain, 0.0, 1.0);
  fragColor = vec4(clamp(me.rgb + (boosted - L), 0.0, 1.0), me.a);
}
`
);
var QUANT = (
  /* glsl */
  `
uniform sampler2D u_matrix;
uniform int u_mode;
uniform float u_levels;
uniform float u_amount;

void main() {
  ivec2 P = topDown();
  vec4 p = at(iChannel0, P);
  if (p.a < 0.5) { fragColor = vec4(0.0); return; }
  vec3 c = p.rgb;
  if (u_mode == 0) { fragColor = vec4(floor(c * 255.0 + 0.5) / 255.0, 1.0); return; }
  if (u_mode == 2) {
    ivec2 ms = textureSize(u_matrix, 0);
    float v = floor(at(u_matrix, ivec2(P.x % ms.x, P.y % ms.y)).r * 255.0 + 0.5);
    float t = (v + 0.5) / u_levels - 0.5;
    c = clamp(c + t * u_amount, 0.0, 1.0);
  }
  fragColor = vec4(palColor(nearestIndex(c)), 1.0);
}
`
);
var DIFFUSE = (
  /* glsl */
  `
uniform int u_recursion;
uniform int u_on;
uniform int u_skew;
uniform float u_strength;
uniform int u_kn;
uniform vec3 u_kernel[12];

void main() {
  if (u_on == 0) { fragColor = vec4(0.0, 0.0, 0.0, -1.0); return; }
  ivec2 P = topDown();
  int k = P.x + u_skew * P.y;
  int r = u_recursion;
  if (k < r) { fragColor = at(iChannel1, P); return; }
  if (k > r) { fragColor = vec4(0.0, 0.0, 0.0, -1.0); return; }
  vec4 p = at(iChannel0, P);
  if (p.a < 0.5) { fragColor = vec4(0.0, 0.0, 0.0, -2.0); return; }
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    if (i >= u_kn) break;
    ivec2 Q = P - ivec2(u_kernel[i].xy);
    if (!inside(Q)) continue;
    vec4 e = at(iChannel1, Q);
    if (e.a >= 0.0) acc += e.rgb * u_kernel[i].z;
  }
  vec3 c = clamp(p.rgb + acc * u_strength, 0.0, 1.0);
  int idx = nearestIndex(c);
  fragColor = vec4(c - palColor(idx), float(idx));
}
`
);
var RESOLVE = (
  /* glsl */
  `
uniform int u_on;
void main() {
  ivec2 P = topDown();
  if (u_on == 0) { fragColor = at(iChannel0, P); return; }
  vec4 d = at(iChannel1, P);
  fragColor = d.a < 0.0 ? vec4(0.0) : vec4(palColor(int(d.a + 0.5)), 1.0);
}
`
);
var ORPHAN = (
  /* glsl */
  `
uniform int u_on;
void main() {
  ivec2 P = topDown();
  vec4 me = at(iChannel0, P);
  fragColor = me;
  if (u_on == 0) return;
  int c = colorKey(me);
  ivec2 off[4] = ivec2[4](ivec2(0, -1), ivec2(1, 0), ivec2(0, 1), ivec2(-1, 0));
  int ks[4]; vec4 cs[4]; int n = 0;
  for (int i = 0; i < 4; i++) {
    ivec2 Q = P + off[i];
    if (!inside(Q)) continue;
    cs[n] = at(iChannel0, Q); ks[n] = colorKey(cs[n]);
    if (ks[n] == c) return;
    n++;
  }
  if (n < 2) return;
  int best = 0, bc = 0;
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    int m = 0;
    for (int j = 0; j < 4; j++) { if (j >= n) break; if (ks[j] == ks[i]) m++; }
    if (m > bc) { bc = m; best = i; }
  }
  fragColor = cs[best];
}
`
);
var SMOOTH = (
  /* glsl */
  `
uniform int u_on;
void main() {
  ivec2 P = topDown();
  vec4 me = at(iChannel0, P);
  fragColor = me;
  if (u_on == 0) return;
  int c = colorKey(me);
  ivec2 R = ivec2(u_resolution);
  int ks[9]; vec4 cs[9];
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    ivec2 Q = clamp(P + ivec2(i - 1, j - 1), ivec2(0), R - 1);
    cs[j * 3 + i] = at(iChannel0, Q); ks[j * 3 + i] = colorKey(cs[j * 3 + i]);
  }
  for (int i = 0; i < 9; i++) {
    if (ks[i] == c) continue;
    int m = 0;
    for (int j = 0; j < 9; j++) if (ks[j] == ks[i]) m++;
    if (m >= 5) { fragColor = cs[i]; return; }
  }
}
`
);
var OUTLINE = (
  /* glsl */
  `
uniform int u_outline;
uniform int u_corners;
uniform vec3 u_outlineColor;
bool opaqueAt(ivec2 q) { return inside(q) && at(iChannel0, q).a > 0.5; }
void main() {
  ivec2 P = topDown();
  vec4 me = at(iChannel0, P);
  fragColor = me;
  if (u_outline == 0) return;
  ivec2 off[8] = ivec2[8](ivec2(0, -1), ivec2(1, 0), ivec2(0, 1), ivec2(-1, 0), ivec2(-1, -1), ivec2(1, -1), ivec2(1, 1), ivec2(-1, 1));
  int n = u_corners == 1 ? 8 : 4;
  bool o = me.a > 0.5;
  if (u_outline == 3) {
    if (!o) return;
    float lm = luma(me.rgb);
    for (int i = 0; i < 8; i++) {
      if (i >= n) break;
      ivec2 Q = P + off[i];
      if (!opaqueAt(Q)) continue;
      if (luma(at(iChannel0, Q).rgb) - lm >= 0.28) { fragColor = vec4(u_outlineColor, 1.0); return; }
    }
    return;
  }
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    ivec2 Q = P + off[i];
    if (!inside(Q)) continue;
    bool other = opaqueAt(Q);
    if (u_outline == 1 ? (!o && other) : (o && !other)) { fragColor = vec4(u_outlineColor, 1.0); return; }
  }
}
`
);
var POSTFX = (
  /* glsl */
  `
uniform int u_fxMode;
uniform vec3 u_fxParams; // x=strength, y=scanlines, z=aberration

void main() {
  ivec2 P = topDown();
  ivec2 R = ivec2(u_resolution);
  vec4 me = at(iChannel0, P);
  float str = u_fxParams.x, scan = u_fxParams.y, ab = u_fxParams.z;
  if ((u_fxMode == 0 && scan <= 0.001 && ab <= 0.001) || me.a < 0.5) {
    fragColor = me;
    return;
  }

  vec3 c = me.rgb;
  if (ab > 0.001) {
    int s0 = int(floor(ab));
    int s1 = s0 + 1;
    float f = ab - float(s0);
    float rL = mix(at(iChannel0, P - ivec2(s0, 0)).r, at(iChannel0, P - ivec2(s1, 0)).r, f);
    float bR = mix(at(iChannel0, P + ivec2(s0, 0)).b, at(iChannel0, P + ivec2(s1, 0)).b, f);
    c = vec3(rL, c.g, bR);
  }

  if (u_fxMode == 1) {
    vec3 glow = vec3(0.0);
    float wSum = 0.0;
    for (int dy = -2; dy <= 2; dy++) {
      for (int dx = -2; dx <= 2; dx++) {
        float w = 1.0 / (1.0 + float(dx * dx + dy * dy));
        vec3 sc = at(iChannel0, P + ivec2(dx, dy)).rgb;
        float peak = max(sc.r, max(sc.g, sc.b));
        float br = max(0.0, peak - 0.42) / 0.58;
        glow += sc * (br * w);
        wSum += w;
      }
    }
    glow /= max(1.0, wSum);
    float lm = luma(c);
    vec3 shadowLift = vec3(0.025, 0.02, 0.075) * (1.0 - lm) * str;
    c = clamp(c + glow * (1.45 * str) + shadowLift, 0.0, 1.0);
  } else if (u_fxMode == 2) {
    vec3 lN = at(iChannel0, P - ivec2(1, 0)).rgb;
    vec3 rN = at(iChannel0, P + ivec2(1, 0)).rgb;
    c = mix(c, 0.18 * lN + 0.64 * c + 0.18 * rN, 0.45 * str);
    int sub = P.x % 3;
    vec3 mask = sub == 0 ? vec3(1.07, 0.96, 0.96) : (sub == 1 ? vec3(0.96, 1.07, 0.96) : vec3(0.96, 0.96, 1.08));
    c *= mix(vec3(1.0), mask, str);
    if ((P.y % 2) == 1) c *= (1.0 - 0.22 * str);
    vec2 resF = vec2(max(1.0, float(R.x)), max(1.0, float(R.y)));
    vec2 uv = ((vec2(P) + 0.5) / resF) * 2.0 - 1.0;
    float vig = clamp(1.0 - 0.24 * str * dot(uv, uv), 0.55, 1.0);
    c = clamp(c * (1.0 + 0.12 * str) * vig, 0.0, 1.0);
  } else if (u_fxMode == 3) {
    float lC = luma(c);
    float lTL = 0.5 * (luma(at(iChannel0, P + ivec2(-1, 0)).rgb) + luma(at(iChannel0, P + ivec2(0, -1)).rgb));
    float lBR = 0.5 * (luma(at(iChannel0, P + ivec2(1, 0)).rgb) + luma(at(iChannel0, P + ivec2(0, 1)).rgb));
    float bevel = clamp((lC - lTL) * 1.4, -0.25, 0.28) - clamp((lC - lBR) * 1.2, -0.22, 0.25);
    float facet = (((P.x + P.y) % 2) == 0 ? 0.032 : -0.032);
    c = clamp(c + (bevel + facet) * str, 0.0, 1.0);
  } else if (u_fxMode == 4) {
    vec3 prev = at(iChannel0, P - ivec2(1, 1)).rgb;
    float ghost = (1.0 - luma(prev)) * 0.12 * str;
    float cell = (((P.x % 2) == 0 && (P.y % 2) == 0) ? 1.04 : 0.94);
    vec3 paper = vec3(0.76, 0.82, 0.62);
    c = clamp(c * (1.0 + (cell - 1.0) * str) - ghost + paper * (0.04 * str), 0.0, 1.0);
  } else if (u_fxMode == 5) {
    float lL = luma(at(iChannel0, P + ivec2(-1, 0)).rgb), lR = luma(at(iChannel0, P + ivec2(1, 0)).rgb);
    float lU = luma(at(iChannel0, P + ivec2(0, -1)).rgb), lD = luma(at(iChannel0, P + ivec2(0, 1)).rgb);
    float edge = clamp(sqrt((lR - lL) * (lR - lL) + (lD - lU) * (lD - lU)) * 2.4, 0.0, 1.0);
    float lm = luma(c);
    float grid = ((P.x % 16) == 0 || (P.y % 16) == 0) ? 0.11 : (((P.x % 4) == 0 && (P.y % 4) == 0) ? 0.06 : 0.0);
    float beam = clamp(edge * 0.85 + pow(lm, 1.35) * 0.55, 0.0, 1.0);
    vec3 osc = vec3(0.015, 0.055, 0.035) + vec3(0.05, 0.32, 0.16) * grid
             + vec3(0.08, 0.96, 0.46) * beam + vec3(0.45, 1.0, 0.78) * pow(beam, 3.0) * 0.65;
    c = clamp(mix(c, clamp(osc, 0.0, 1.0), str), 0.0, 1.0);
  } else if (u_fxMode == 6) {
    float lL = luma(at(iChannel0, P + ivec2(-1, 0)).rgb), lR = luma(at(iChannel0, P + ivec2(1, 0)).rgb);
    float lU = luma(at(iChannel0, P + ivec2(0, -1)).rgb), lD = luma(at(iChannel0, P + ivec2(0, 1)).rgb);
    float edge = clamp(sqrt((lR - lL) * (lR - lL) + (lD - lU) * (lD - lU)) * 2.5, 0.0, 1.0);
    float lm = luma(c);
    float majorG = ((P.x % 24) == 0 || (P.y % 24) == 0) ? 0.16 : (((P.x % 8) == 0 || (P.y % 8) == 0) ? 0.065 : 0.0);
    vec3 bp = vec3(0.035, 0.11, 0.24) + vec3(0.10, 0.30, 0.54) * (lm * 0.55 + majorG)
            + vec3(0.36, 0.84, 1.0) * edge + vec3(0.92, 0.98, 1.0) * pow(edge, 2.5) * 0.6;
    c = clamp(mix(c, clamp(bp, 0.0, 1.0), str), 0.0, 1.0);
  }

  if (scan > 0.001 && (P.y % 2) == 1) {
    c *= (1.0 - 0.28 * scan);
  }
  fragColor = vec4(floor(clamp(c, 0.0, 1.0) * 255.0 + 0.5) / 255.0, 1.0);
}
`
);

// lib/core/gpu/backend.js
var canvasOf = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
var RESAMPLE_ID = { box: 0, nearest: 1, sobel: 2, hybrid: 3 };
var OUTLINE_ID = { none: 0, outer: 1, inner: 2, ink: 3 };
var FX_ID = { none: 0, bloom: 1, crt: 2, voxel: 3, lcd: 4, oscilloscope: 5, blueprint: 6 };
async function createGPUBackend() {
  if (typeof document === "undefined") throw new Error("No DOM");
  const probe = canvasOf(1, 1).getContext("webgl2");
  if (!probe) throw new Error("WebGL 2 is not available");
  if (!probe.getExtension("EXT_color_buffer_float")) throw new Error("Float render targets are not available");
  const dbg = probe.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(dbg ? probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : probe.getParameter(probe.RENDERER));
  probe.getExtension("WEBGL_lose_context")?.loseContext();
  const canvas = canvasOf(1, 1);
  const source = canvasOf(1, 1);
  const palette = canvasOf(256, 1);
  const matrix = canvasOf(1, 1);
  const nearest2 = (el) => ({ element: el, filter: "nearest", wrap: "clamp" });
  const sm = (0, import_shadermate.createShader)({
    canvas,
    webgl: 2,
    size: [1, 1],
    pixelRatio: 1,
    autoplay: false,
    pauseWhenHidden: false,
    pointer: false,
    errorOverlay: false,
    warnMissingUniforms: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    antialias: false,
    dialect: "shadermate",
    common: COMMON,
    samplers: { u_palette: nearest2(palette), u_matrix: nearest2(matrix) },
    uniforms: {
      u_count: 1,
      u_distance: 0,
      u_resample: 3,
      u_kuwahara: 0,
      u_clahe: 0,
      u_adjust: [0, 0, 0, 1],
      u_hue: 0,
      u_crop: [0, 0, 1, 1],
      u_alphaCut: 0.5,
      u_mode: 0,
      u_levels: 1,
      u_amount: 0,
      u_skew: 1,
      u_strength: 1,
      u_kn: 0,
      u_kernel: new Float32Array(MAX_KERNEL * 3),
      u_outline: 0,
      u_corners: 0,
      u_outlineColor: [0, 0, 0],
      u_fxMode: 0,
      u_fxParams: [0.65, 0, 0]
    },
    passes: [
      { name: "prep", shader: PREP, float: "full", filter: "nearest", channels: [{ ...nearest2(source), dynamic: false }] },
      { name: "clahe", shader: CLAHE, float: "full", filter: "nearest", channels: ["prep"] },
      { name: "quant", shader: QUANT, filter: "nearest", channels: ["clahe"] },
      { name: "diffuse", shader: DIFFUSE, float: "full", filter: "nearest", pingpong: true, iterations: 2, channels: ["clahe", "diffuse"] },
      { name: "resolve", shader: RESOLVE, filter: "nearest", channels: ["quant", "diffuse"] },
      { name: "orphan", shader: ORPHAN, filter: "nearest", channels: ["resolve"] },
      { name: "smooth", shader: SMOOTH, filter: "nearest", channels: ["orphan"] },
      { name: "out", shader: OUTLINE, filter: "nearest", channels: ["smooth"] },
      { name: "postfx", shader: POSTFX, screen: true, channels: ["out"] }
    ]
  });
  let failure = null;
  sm.on("error", (e) => {
    failure = e;
  });
  await sm.ready;
  if (failure || sm.error) {
    sm.destroy();
    throw failure || sm.error;
  }
  const passUniforms = (name, values) => {
    for (const k2 in values) sm.set(k2, values[k2], name);
  };
  let lastSource = null;
  let paletteKey = "", matrixKey = "";
  async function setSource(frame) {
    if (frame.canvas === lastSource && !frame.dirty) return;
    source.width = frame.width;
    source.height = frame.height;
    const ctx = source.getContext("2d");
    ctx.clearRect(0, 0, source.width, source.height);
    ctx.drawImage(frame.canvas, 0, 0);
    await sm.setChannel(0, { ...nearest2(source), dynamic: false }, "prep");
    lastSource = frame.canvas;
  }
  function setPalette(plan) {
    const key2 = plan.palette.map((c) => c.join(",")).join(";");
    if (key2 === paletteKey) return;
    paletteKey = key2;
    const ctx = palette.getContext("2d");
    const img = ctx.createImageData(256, 1);
    plan.palette.forEach((c, i) => img.data.set([c[0], c[1], c[2], 255], i * 4));
    ctx.putImageData(img, 0, 0);
  }
  function setMatrix(map) {
    const key2 = map ? `${map.w}x${map.h}:${map.levels}:${map.values.join(",")}` : "none";
    if (key2 === matrixKey) return;
    matrixKey = key2;
    const m = map || { w: 1, h: 1, values: [0] };
    matrix.width = m.w;
    matrix.height = m.h;
    const ctx = matrix.getContext("2d");
    const img = ctx.createImageData(m.w, m.h);
    for (let i = 0; i < m.values.length; i++) img.data.set([m.values[i], 0, 0, 255], i * 4);
    ctx.putImageData(img, 0, 0);
  }
  async function run(plan, frame) {
    const s = plan.settings;
    await setSource(frame);
    if (plan.quantize) setPalette(plan);
    setMatrix(plan.map);
    if (sm.width !== plan.width || sm.height !== plan.height) sm.setSize(plan.width, plan.height);
    const diffusion = plan.kind === "diffusion";
    const kernel = new Array(MAX_KERNEL).fill(null).map((_, i) => plan.kernel && plan.kernel[i] || [0, 0, 0]);
    const fx = s.fx || { mode: "none", strength: 0.65, scanlines: 0, aberration: 0 };
    sm.set({
      u_count: plan.palette.length || 1,
      u_distance: plan.distance,
      u_resample: RESAMPLE_ID[s.size.resample] ?? 3,
      u_kuwahara: s.adjust.kuwahara | 0,
      u_clahe: s.adjust.clahe || 0,
      u_adjust: [s.adjust.brightness, s.adjust.contrast, s.adjust.saturation, s.adjust.gamma],
      u_hue: s.adjust.hue,
      u_crop: [plan.crop.x, plan.crop.y, plan.crop.w, plan.crop.h],
      u_alphaCut: s.alpha.threshold,
      u_mode: !plan.quantize ? 0 : plan.kind === "ordered" ? 2 : 1,
      u_levels: plan.map ? plan.map.levels : 1,
      u_amount: plan.map ? plan.spread * s.dither.strength : 0,
      u_skew: plan.skew,
      u_strength: s.dither.strength,
      u_kn: plan.kernel ? plan.kernel.length : 0,
      u_kernel: new Float32Array(kernel.flat()),
      u_outline: OUTLINE_ID[plan.outline.mode] ?? 0,
      u_corners: plan.outline.corners ? 1 : 0,
      u_outlineColor: plan.outline.color.map((v) => v / 255),
      u_fxMode: FX_ID[fx.mode] ?? 0,
      u_fxParams: [fx.strength ?? 0.65, fx.scanlines ?? 0, fx.aberration ?? 0]
    });
    passUniforms("diffuse", { u_on: diffusion ? 1 : 0 });
    passUniforms("resolve", { u_on: diffusion ? 1 : 0 });
    passUniforms("orphan", { u_on: s.cleanup.orphans ? 1 : 0 });
    passUniforms("smooth", { u_on: s.cleanup.smooth ? 1 : 0 });
    sm.getPass("diffuse").cfg.iterations = diffusion ? plan.waves : 1;
    const { data } = sm.readPixels();
    const w = plan.width, h = plan.height, out = new Uint8ClampedArray(w * h * 4), row = w * 4;
    for (let y = 0; y < h; y++) out.set(data.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    return out;
  }
  return {
    name: "webgl",
    renderer,
    software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer),
    run,
    shader: sm,
    destroy() {
      sm.destroy();
    }
  };
}

// lib/core/source.js
var MAX_SOURCE = 4096;
var hasDOM = typeof document !== "undefined";
var isRGBA = (s) => s && typeof s === "object" && "data" in s && "width" in s && "height" in s && s.data && s.data.length === s.width * s.height * 4;
async function loadImage(src) {
  if (typeof Blob !== "undefined" && src instanceof Blob) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(src);
      } catch {
      }
    }
    src = URL.createObjectURL(src);
  }
  if (!hasDOM) throw new Error("Loading images by URL needs a browser; pass { width, height, data } in Node.");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = src;
  await img.decode();
  return img;
}
function sizeOf(el) {
  return {
    width: el.naturalWidth || el.videoWidth || el.displayWidth || el.codedWidth || el.width || 0,
    height: el.naturalHeight || el.videoHeight || el.displayHeight || el.codedHeight || el.height || 0
  };
}
function unwrap(src) {
  if (src && !isRGBA(src) && typeof src === "object") {
    if (src.canvas && typeof src.canvas === "object" && "getContext" in src.canvas) return src.canvas;
    if (src.elt && typeof src.elt === "object" && "getContext" in src.elt) return src.elt;
  }
  return src;
}
async function toFrame(source, opts = {}) {
  const maxSize = opts.maxSize || MAX_SOURCE;
  let src = unwrap(source);
  if (typeof src === "string" || typeof Blob !== "undefined" && src instanceof Blob) src = await loadImage(src);
  if (src && typeof src.complete === "boolean" && !src.complete && src.decode) await src.decode();
  if (isRGBA(src)) {
    const frame = { width: src.width, height: src.height, data: src.data, canvas: null };
    if (hasDOM) {
      Object.defineProperty(frame, "canvas", {
        configurable: true,
        get() {
          const c = document.createElement("canvas");
          c.width = src.width;
          c.height = src.height;
          const img = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
          c.getContext("2d").putImageData(img, 0, 0);
          Object.defineProperty(frame, "canvas", { value: c });
          return c;
        }
      });
    }
    return frame;
  }
  if (!hasDOM) throw new Error("Unsupported source in a non-browser environment. Pass { width, height, data }.");
  let { width, height } = sizeOf(src);
  if (!width || !height) throw new Error("Source has no size yet (is the image or video loaded?)");
  const k2 = Math.min(1, maxSize / Math.max(width, height));
  width = Math.max(1, Math.round(width * k2));
  height = Math.max(1, Math.round(height * k2));
  const canvas = opts.canvas || document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = k2 < 1;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, width, height);
  let cached = null;
  return {
    width,
    height,
    canvas,
    dirty: true,
    get data() {
      return cached || (cached = ctx.getImageData(0, 0, width, height).data);
    }
  };
}

// lib/core/export/scale.js
init_color();
function upscale(img, k2 = 1, opts = {}) {
  k2 = Math.max(1, Math.round(k2));
  const w = img.width * k2, h = img.height * k2;
  const out = new Uint8ClampedArray(w * h * 4);
  const src = img.data, sw = img.width;
  for (let y = 0; y < h; y++) {
    const sy = y / k2 | 0;
    for (let x = 0; x < w; x++) {
      const so = (sy * sw + (x / k2 | 0)) * 4, o = (y * w + x) * 4;
      out[o] = src[so];
      out[o + 1] = src[so + 1];
      out[o + 2] = src[so + 2];
      out[o + 3] = src[so + 3];
    }
  }
  if (opts.grid && k2 >= 3) {
    const [r, g, b] = parseColor(opts.gridColor || "#000000");
    const a = opts.gridAlpha ?? 0.35;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x % k2 && y % k2) continue;
      const o = (y * w + x) * 4;
      const sa = out[o + 3] / 255, oa = a + sa * (1 - a);
      out[o] = (r * a + out[o] * sa * (1 - a)) / oa;
      out[o + 1] = (g * a + out[o + 1] * sa * (1 - a)) / oa;
      out[o + 2] = (b * a + out[o + 2] * sa * (1 - a)) / oa;
      out[o + 3] = oa * 255;
    }
  }
  return { width: w, height: h, data: out };
}
function resizeNearest(img, width, height) {
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  const out = new Uint8ClampedArray(width * height * 4);
  const xs = new Int32Array(width);
  for (let x = 0; x < width; x++) xs[x] = Math.min(img.width - 1, Math.floor((x + 0.5) * img.width / width));
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y + 0.5) * img.height / height));
    for (let x = 0; x < width; x++) {
      const so = (sy * img.width + xs[x]) * 4, o = (y * width + x) * 4;
      out[o] = img.data[so];
      out[o + 1] = img.data[so + 1];
      out[o + 2] = img.data[so + 2];
      out[o + 3] = img.data[so + 3];
    }
  }
  return { width, height, data: out };
}
function uniqueColors(img, limit = Infinity) {
  const seen = /* @__PURE__ */ new Set();
  const d = img.data;
  for (let o = 0; o < d.length; o += 4) {
    if (d[o + 3] === 0) continue;
    seen.add(d[o] << 16 | d[o + 1] << 8 | d[o + 2]);
    if (seen.size > limit) break;
  }
  return [...seen].map((v) => toHex([v >> 16, v >> 8 & 255, v & 255]));
}
function hasTransparency(img) {
  for (let o = 3; o < img.data.length; o += 4) if (img.data[o] < 255) return true;
  return false;
}
function detectGrid(img, tolerance = 8) {
  const { width: w, height: h, data: d } = img;
  const same = (a, b) => Math.abs(d[a] - d[b]) <= tolerance && Math.abs(d[a + 1] - d[b + 1]) <= tolerance && Math.abs(d[a + 2] - d[b + 2]) <= tolerance && Math.abs(d[a + 3] - d[b + 3]) <= tolerance;
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  let g = 0;
  const stepY = Math.max(1, Math.floor(h / 64)), stepX = Math.max(1, Math.floor(w / 64));
  for (let y = 0; y < h; y += stepY) {
    let run = 1;
    for (let x = 1; x < w; x++) {
      if (same((y * w + x) * 4, (y * w + x - 1) * 4)) run++;
      else {
        g = gcd(g, run);
        run = 1;
        if (g === 1) return 1;
      }
    }
  }
  for (let x = 0; x < w; x += stepX) {
    let run = 1;
    for (let y = 1; y < h; y++) {
      if (same((y * w + x) * 4, ((y - 1) * w + x) * 4)) run++;
      else {
        g = gcd(g, run);
        run = 1;
        if (g === 1) return 1;
      }
    }
  }
  return g || 1;
}

// lib/core/export/canvas.js
function toCanvas(img, scale = 1, opts = {}) {
  const up = scale > 1 || opts.grid ? upscale(img, scale, opts) : img;
  const c = opts.canvas || document.createElement("canvas");
  c.width = up.width;
  c.height = up.height;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(up.data), up.width, up.height), 0, 0);
  return c;
}
function downloadBlob(data, filename, type = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e4);
}

// lib/core/export/crc32.js
var table = null;
function crc32(bytes, crc = 0) {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k2 = 0; k2 < 8; k2++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  crc = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 255] ^ crc >>> 8;
  return ~crc >>> 0;
}

// lib/core/export/png.js
var SIG = [137, 80, 78, 71, 13, 10, 26, 10];
async function deflate(bytes) {
  if (typeof CompressionStream === "function") {
    const cs = new CompressionStream("deflate");
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { deflateSync } = await import("node:zlib");
  return new Uint8Array(deflateSync(bytes));
}
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function indexImage(img) {
  const d = img.data, n = img.width * img.height;
  const map = /* @__PURE__ */ new Map(), colors = [], idx = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const k2 = d[o + 3] === 0 ? -1 : (d[o] << 24 | d[o + 1] << 16 | d[o + 2] << 8 | d[o + 3]) >>> 0;
    let v = map.get(k2);
    if (v === void 0) {
      if (colors.length === 256) return null;
      v = colors.length;
      map.set(k2, v);
      colors.push(k2 === -1 ? [0, 0, 0, 0] : [d[o], d[o + 1], d[o + 2], d[o + 3]]);
    }
    idx[i] = v;
  }
  return { colors, indices: idx };
}
async function encodePNG(img, opts = {}) {
  if (opts.width && opts.height) img = resizeNearest(img, opts.width, opts.height);
  else if (opts.scale && opts.scale > 1 || opts.grid) img = upscale(img, opts.scale || 1, opts);
  const { width: w, height: h } = img;
  const ix = opts.indexed === false ? null : indexImage(img);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  const parts = [new Uint8Array(SIG)];
  let raw;
  if (ix) {
    const bits = ix.colors.length <= 2 ? 1 : ix.colors.length <= 4 ? 2 : ix.colors.length <= 16 ? 4 : 8;
    ihdr.set([bits, 3, 0, 0, 0], 8);
    const stride = Math.ceil(w * bits / 8);
    raw = new Uint8Array((stride + 1) * h);
    for (let y = 0; y < h; y++) {
      const row = y * (stride + 1) + 1;
      for (let x = 0; x < w; x++) {
        const v = ix.indices[y * w + x];
        const bit = x * bits;
        raw[row + (bit >> 3)] |= v << 8 - bits - (bit & 7);
      }
    }
    parts.push(chunk("IHDR", ihdr));
    parts.push(chunk("PLTE", Uint8Array.from(ix.colors.flatMap((c) => c.slice(0, 3)))));
    if (ix.colors.some((c) => c[3] < 255)) {
      let last = ix.colors.length;
      while (last > 0 && ix.colors[last - 1][3] === 255) last--;
      parts.push(chunk("tRNS", Uint8Array.from(ix.colors.slice(0, last).map((c) => c[3]))));
    }
  } else {
    ihdr.set([8, 6, 0, 0, 0], 8);
    raw = new Uint8Array((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) raw.set(img.data.subarray ? img.data.subarray(y * w * 4, (y + 1) * w * 4) : Array.prototype.slice.call(img.data, y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
    parts.push(chunk("IHDR", ihdr));
  }
  parts.push(chunk("IDAT", await deflate(raw)));
  parts.push(chunk("IEND", new Uint8Array(0)));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// lib/core/engine.js
var isVideo = (s) => typeof HTMLVideoElement !== "undefined" && s instanceof HTMLVideoElement;
var isVideoFrame = (s) => typeof VideoFrame !== "undefined" && s instanceof VideoFrame;
async function createPixelator(options = {}) {
  const want = options.backend || "auto";
  let gpu = null, gpuError = null;
  if (want !== "cpu" && typeof document !== "undefined") {
    try {
      gpu = await createGPUBackend();
    } catch (e) {
      gpuError = e;
      if (want === "webgl") throw e;
    }
  }
  const scratch = typeof document !== "undefined" ? document.createElement("canvas") : null;
  let last = { source: null, frame: null };
  let queue = Promise.resolve();
  async function frameFor(source) {
    if (source === last.source && last.frame && !isVideo(source) && !isVideoFrame(source)) {
      last.frame.dirty = false;
      return last.frame;
    }
    const frame = await toFrame(source, { maxSize: options.maxSourceSize, canvas: scratch });
    last = { source, frame };
    return frame;
  }
  async function processNow(source, settings) {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const frame = await frameFor(source);
    const plan = makePlan(settings, frame);
    let data, backend = "cpu";
    const diffusionOnCPU = plan.kind === "diffusion" && (options.diffusion === "cpu" || options.diffusion !== "gpu" && gpu && gpu.software);
    if (gpu && frame.canvas && !diffusionOnCPU) {
      data = await gpu.run(plan, frame);
      backend = "webgl";
    } else {
      data = runCPU(plan, frame);
    }
    const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    return makeResult(plan, data, backend, ms);
  }
  return {
    /** 'webgl' or 'cpu' */
    get backend() {
      return gpu ? "webgl" : "cpu";
    },
    /** GPU renderer string (WebGL backend only). */
    get renderer() {
      return gpu ? gpu.renderer : "";
    },
    /** Why the GPU backend is not in use, if it isn't. */
    get fallbackReason() {
      return gpuError ? String(gpuError.message || gpuError) : "";
    },
    /**
     * Process one source. Calls are queued, so it is safe to call from input handlers.
     * @returns {Promise<PixelResult>}
     */
    process(source, settings = {}) {
      const run = queue.then(() => processNow(source, settings));
      queue = run.catch(() => {
      });
      return run;
    },
    /** Forget the cached source (call after drawing new content into the same canvas). */
    invalidate() {
      last = { source: null, frame: null };
    },
    destroy() {
      if (gpu) gpu.destroy();
      gpu = null;
    },
    /** The underlying ShaderMate instance (GPU backend only), for debugging. */
    get shader() {
      return gpu ? gpu.shader : null;
    }
  };
}
function makeResult(plan, data, backend = "cpu", ms = 0) {
  const result = {
    width: plan.width,
    height: plan.height,
    data,
    palette: plan.paletteHex ? plan.paletteHex.slice() : null,
    settings: plan.settings,
    kind: plan.kind,
    waves: plan.waves,
    /** The framed part of the source, as fractions of its width and height. */
    crop: { x: plan.crop.x / plan.srcWidth, y: plan.crop.y / plan.srcHeight, w: plan.crop.w / plan.srcWidth, h: plan.crop.h / plan.srcHeight },
    backend,
    ms,
    /** Distinct colours actually used in the image. */
    usedColors() {
      return uniqueColors(this);
    },
    toImageData() {
      return new ImageData(new Uint8ClampedArray(this.data), this.width, this.height);
    },
    /** Canvas at `scale` × (nearest-neighbour), optional grid lines. */
    toCanvas(scale = 1, opts = {}) {
      return toCanvas(this, scale, opts);
    },
    /** PNG bytes (indexed when ≤ 256 colours unless `indexed: false`). */
    toPNG(opts = {}) {
      return encodePNG(this, opts);
    },
    async toBlob(opts = {}) {
      return new Blob([await encodePNG(this, opts)], { type: "image/png" });
    }
  };
  return result;
}
var shared = null;
async function pixelate(source, settings) {
  if (settings === void 0 && source && typeof source === "object" && "image" in source && "width" in source) {
    return pixelateClassic(source);
  }
  shared || (shared = createPixelator());
  return (await shared).process(source, settings);
}
async function pixelateClassic(opts) {
  const { image, width, dither = "none", strength = 0, palette = null, resolution = "original" } = opts;
  let pal = { source: "none" };
  if (Array.isArray(palette)) pal = { source: "custom", colors: palette };
  else if (typeof palette === "string") {
    const { fetchLospec: fetchLospec2 } = await Promise.resolve().then(() => (init_lospec(), lospec_exports));
    const p = await fetchLospec2(palette);
    pal = { source: "custom", colors: p.colors, name: p.name };
  }
  const settings = normalizeSettings({
    size: { width },
    palette: pal,
    dither: { method: LEGACY_DITHER[String(dither).toLowerCase()] || "none", strength: strength / 100 },
    alpha: { threshold: 0 }
  });
  shared || (shared = createPixelator());
  const engine = await shared;
  const res = await engine.process(image, settings);
  if (resolution === "original") {
    const frame = await toFrame(image);
    const c = document.createElement("canvas");
    c.width = frame.width;
    c.height = frame.height;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(res.toCanvas(1), 0, 0, c.width, c.height);
    return c;
  }
  return res.toCanvas(1);
}

// lib/index.js
init_parse();
init_lospec();

// lib/core/presets.js
var PRESETS = [
  {
    id: "hybrid-crisp",
    name: "Hybrid Crisp",
    description: "Bimodal-Plateau edge downsampling + local micro-contrast + OKLab 28 colours + Blue Noise.",
    settings: { size: { width: 136, resample: "hybrid" }, adjust: { clahe: 0.25 }, palette: { source: "extract", count: 28 }, dither: { method: "bluenoise", strength: 0.45 }, cleanup: { orphans: true } }
  },
  {
    id: "kurzgesagt",
    name: "Kurzgesagt Glow",
    description: "GPU Kuwahara flat-paint brush + Kurzgesagt Cosmic 24 + Bioluminescent Bloom FX.",
    settings: { size: { width: 144, resample: "hybrid" }, adjust: { contrast: 0.1, saturation: 0.18, kuwahara: 3 }, palette: { source: "builtin", id: "kurzgesagt-24" }, dither: { method: "bluenoise", strength: 0.35 }, cleanup: { orphans: true }, fx: { mode: "bloom", strength: 0.55 } }
  },
  {
    id: "crt-arcade",
    name: "CRT Arcade",
    description: "1989 Trinitron arcade monitor: Endesga 32 + Bayer 4\xD74 + CRT phosphor grille, scanlines & RGB shift.",
    settings: { size: { width: 144, resample: "hybrid" }, adjust: { contrast: 0.12, saturation: 0.12, clahe: 0.2 }, palette: { source: "builtin", id: "endesga-32" }, dither: { method: "bayer4", strength: 0.65 }, fx: { mode: "crt", strength: 0.68, scanlines: 0.55, aberration: 0.85 } }
  },
  {
    id: "chunky-ink",
    name: "Chunky Ink",
    description: "Kuwahara flat blocks + Endesga 32 + 1px internal comic ink contour outlines.",
    settings: { size: { width: 124, resample: "hybrid" }, adjust: { kuwahara: 3, clahe: 0.18 }, palette: { source: "builtin", id: "endesga-32" }, dither: { method: "none" }, cleanup: { orphans: true, smooth: true }, outline: { mode: "ink", color: "#141020" } }
  },
  {
    id: "pc98-cyber",
    name: "PC-98 Cyber",
    description: "Sobel edge-preserving downsampling + NEC PC-98 Cyber 16 + Bayer 4\xD74 + dark ink lines.",
    settings: { size: { width: 160, resample: "sobel" }, adjust: { clahe: 0.2 }, palette: { source: "builtin", id: "pc98-cyber-16" }, dither: { method: "bayer4", strength: 0.65 }, outline: { mode: "ink", color: "#080614" } }
  },
  {
    id: "voxel-3d",
    name: "Voxel 3D",
    description: "Lit 3D micro-voxel bevel shading over Resurrect 64 crisp blocks.",
    settings: { size: { width: 104, resample: "hybrid" }, adjust: { kuwahara: 2, clahe: 0.2 }, palette: { source: "builtin", id: "resurrect-64" }, dither: { method: "none" }, cleanup: { orphans: true }, fx: { mode: "voxel", strength: 0.72 } }
  },
  {
    id: "oscilloscope-xy",
    name: "Oscilloscope",
    description: "Calibrated P31 emerald phosphor vector beam & CRT graticule grid.",
    settings: { size: { width: 176, resample: "sobel" }, adjust: { clahe: 0.35 }, palette: { source: "extract", count: 16 }, dither: { method: "bayer4", strength: 0.4 }, fx: { mode: "oscilloscope", strength: 0.92, scanlines: 0.25 } }
  },
  {
    id: "cyber-blueprint",
    name: "Blueprint",
    description: "Architectural cyan contour wireframe on deep Prussian drafting grid.",
    settings: { size: { width: 176, resample: "sobel" }, adjust: { clahe: 0.3 }, palette: { source: "extract", count: 16 }, dither: { method: "none" }, fx: { mode: "blueprint", strength: 0.92 } }
  },
  {
    id: "aloboi-dream",
    name: "Dreamcore",
    description: "Aloboi Dreamcore 16 pastel synthwave palette + Sierra Lite + soft neon glow.",
    settings: { size: { width: 140, resample: "hybrid" }, palette: { source: "builtin", id: "aloboi-dream-16" }, dither: { method: "sierra-lite", strength: 0.65 }, fx: { mode: "bloom", strength: 0.35 } }
  },
  {
    id: "pico-8",
    name: "PICO-8",
    description: "128 px fantasy console look with the 16-colour PICO-8 palette & Blue Noise.",
    settings: { size: { width: 128, resample: "hybrid" }, adjust: { clahe: 0.15 }, palette: { source: "builtin", id: "pico-8" }, dither: { method: "bluenoise", strength: 0.7 } }
  },
  {
    id: "game-boy",
    name: "Game Boy LCD",
    description: "DMG-01 four olive greens, 160 px wide, Bayer 4\xD74 + dot-matrix LCD grid.",
    settings: { size: { width: 160, resample: "hybrid" }, adjust: { contrast: 0.15, clahe: 0.2 }, palette: { source: "builtin", id: "game-boy-dmg" }, dither: { method: "bayer4", strength: 1 }, fx: { mode: "lcd", strength: 0.55 } }
  },
  {
    id: "one-bit",
    name: "1-Bit Mac",
    description: "Classic Macintosh monochrome: two colours, Atkinson diffusion & crisp local contrast.",
    settings: { size: { width: 192, resample: "hybrid" }, adjust: { contrast: 0.2, clahe: 0.25 }, palette: { source: "builtin", id: "1-bit-monitor" }, dither: { method: "atkinson", strength: 1 } }
  },
  {
    id: "faithful",
    name: "Faithful OKLab",
    description: "28 salient OKLab colours extracted from the photo + Floyd\u2013Steinberg diffusion.",
    settings: { size: { width: 136, resample: "hybrid" }, adjust: { clahe: 0.15 }, palette: { source: "extract", count: 28 }, dither: { method: "floyd-steinberg", strength: 0.75 } }
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Endesga 32, Bayer 4\xD74, Hybrid Bimodal-Plateau edge resampling.",
    settings: { size: { width: 112, resample: "hybrid" }, palette: { source: "builtin", id: "endesga-32" }, dither: { method: "bayer4", strength: 0.6 } }
  },
  {
    id: "sprite",
    name: "Clean Sprite",
    description: "No dither, Hybrid edges, orphan cleanup and a dark 1px outer sprite outline.",
    settings: { size: { width: 56, resample: "hybrid" }, palette: { source: "extract", count: 12 }, dither: { method: "none" }, cleanup: { orphans: true }, outline: { mode: "outer", color: "#1a1c2c" } }
  },
  {
    id: "cga",
    name: "IBM CGA",
    description: "16 hard hardware colours with an 8\xD78 Bayer pattern.",
    settings: { size: { width: 160, resample: "hybrid" }, palette: { source: "builtin", id: "cga-16" }, dither: { method: "bayer8", strength: 1 } }
  },
  {
    id: "newsprint",
    name: "Newsprint",
    description: "Greyscale clustered-dot rotary press halftone.",
    settings: { size: { width: 220, resample: "box" }, palette: { source: "builtin", id: "grayscale-4" }, dither: { method: "cluster8", strength: 1 }, adjust: { saturation: -1, clahe: 0.2 } }
  },
  {
    id: "soft",
    name: "Soft Painterly",
    description: "Resurrect 64 with Sierra Lite diffusion and majority smoothing.",
    settings: { size: { width: 116, resample: "hybrid" }, palette: { source: "builtin", id: "resurrect-64" }, dither: { method: "sierra-lite", strength: 0.6 }, cleanup: { smooth: true } }
  }
];
var getPreset = (id) => PRESETS.find((p) => p.id === id) || null;

// lib/index.js
init_color();

// lib/core/export/gif.js
init_color();
var ByteWriter = class {
  constructor() {
    this.buf = new Uint8Array(1 << 16);
    this.n = 0;
  }
  byte(b) {
    if (this.n === this.buf.length) {
      const nb = new Uint8Array(this.buf.length * 2);
      nb.set(this.buf);
      this.buf = nb;
    }
    this.buf[this.n++] = b;
  }
  bytes(arr) {
    for (let i = 0; i < arr.length; i++) this.byte(arr[i]);
  }
  u16(v) {
    this.byte(v & 255);
    this.byte(v >> 8 & 255);
  }
  str(s) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  result() {
    return this.buf.slice(0, this.n);
  }
};
function lzwEncode(indices, minCodeSize, w) {
  const clear = 1 << minCodeSize, eoi = clear + 1;
  let codeSize = minCodeSize + 1, next = eoi + 1;
  let dict = /* @__PURE__ */ new Map();
  let cur = 0, curBits = 0;
  const sub = [];
  let block = [];
  const emit = (code) => {
    cur |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      block.push(cur & 255);
      cur >>>= 8;
      curBits -= 8;
      if (block.length === 255) {
        sub.push(block);
        block = [];
      }
    }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k2 = indices[i];
    const key2 = prefix * 256 + k2;
    const hit = dict.get(key2);
    if (hit !== void 0) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key2, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = /* @__PURE__ */ new Map();
      codeSize = minCodeSize + 1;
      next = eoi + 1;
    }
    prefix = k2;
  }
  emit(prefix);
  emit(eoi);
  if (curBits > 0) block.push(cur & 255);
  if (block.length) sub.push(block);
  w.byte(minCodeSize);
  for (const b of sub) {
    w.byte(b.length);
    w.bytes(b);
  }
  w.byte(0);
}
var keyOf = (d, o) => d[o + 3] < 128 ? -1 : d[o] << 16 | d[o + 1] << 8 | d[o + 2];
function tableFor(colorKeys, transparent) {
  const list = [...colorKeys].filter((k2) => k2 !== -1);
  const colors = list.map((k2) => [k2 >> 16, k2 >> 8 & 255, k2 & 255]);
  const tIndex = transparent ? colors.length : -1;
  if (transparent) colors.push([0, 0, 0]);
  let bits = 1;
  while (1 << bits < colors.length) bits++;
  while (colors.length < 1 << bits) colors.push([0, 0, 0]);
  const index = new Map(list.map((k2, i) => [k2, i]));
  return { colors, bits, tIndex, index };
}
function reduce(frame, max) {
  const pal = extractPalette(frame, max).map(parseColor);
  const d = new Uint8ClampedArray(frame.data);
  const cache2 = /* @__PURE__ */ new Map();
  for (let o = 0; o < d.length; o += 4) {
    if (d[o + 3] < 128) continue;
    const k2 = d[o] << 16 | d[o + 1] << 8 | d[o + 2];
    let best = cache2.get(k2);
    if (best === void 0) {
      let bd = Infinity;
      best = 0;
      for (let i = 0; i < pal.length; i++) {
        const dr = d[o] - pal[i][0], dg = d[o + 1] - pal[i][1], db = d[o + 2] - pal[i][2];
        const dist = dr * dr * 3 + dg * dg * 4 + db * db * 2;
        if (dist < bd) {
          bd = dist;
          best = i;
        }
      }
      cache2.set(k2, best);
    }
    d.set(pal[best], o);
  }
  return { ...frame, data: d };
}
function encodeGIF(frames, opts = {}) {
  if (!frames.length) throw new Error("No frames");
  const scale = Math.max(1, Math.round(opts.scale || 1));
  const fr = frames.map((f) => ({ ...scale > 1 ? upscale(f, scale) : f, delay: f.delay ?? opts.delay ?? 100 }));
  const W = fr[0].width, H = fr[0].height;
  let transparent = false;
  const all = /* @__PURE__ */ new Set();
  const perFrame = fr.map((f) => {
    const s = /* @__PURE__ */ new Set();
    for (let o = 0; o < f.data.length; o += 4) {
      const k2 = keyOf(f.data, o);
      if (k2 === -1) transparent = true;
      s.add(k2);
      all.add(k2);
    }
    return s;
  });
  const opaqueCount = (s) => s.size - (s.has(-1) ? 1 : 0);
  const globalOK = opaqueCount(all) + (transparent ? 1 : 0) <= 256;
  const global = globalOK ? tableFor(all, transparent) : null;
  const w = new ByteWriter();
  w.str("GIF89a");
  w.u16(W);
  w.u16(H);
  w.byte(global ? 240 | global.bits - 1 : 0);
  w.byte(0);
  w.byte(0);
  if (global) for (const c of global.colors) w.bytes(c);
  if (fr.length > 1 && opts.loop !== -1) {
    w.byte(33);
    w.byte(255);
    w.byte(11);
    w.str("NETSCAPE2.0");
    w.byte(3);
    w.byte(1);
    w.u16(opts.loop || 0);
    w.byte(0);
  }
  fr.forEach((f0, i) => {
    let f = f0, table2 = global, set = perFrame[i];
    if (!table2) {
      const max = transparent ? 255 : 256;
      if (opaqueCount(set) > max) {
        f = reduce(f0, max);
        set = /* @__PURE__ */ new Set();
        for (let o = 0; o < f.data.length; o += 4) set.add(keyOf(f.data, o));
      }
      table2 = tableFor(set, set.has(-1));
    }
    w.byte(33);
    w.byte(249);
    w.byte(4);
    w.byte((transparent ? 2 : 1) << 2 | (table2.tIndex >= 0 ? 1 : 0));
    w.u16(Math.max(2, Math.round(f.delay / 10)));
    w.byte(table2.tIndex >= 0 ? table2.tIndex : 0);
    w.byte(0);
    w.byte(44);
    w.u16(0);
    w.u16(0);
    w.u16(W);
    w.u16(H);
    w.byte(table2 === global ? 0 : 128 | table2.bits - 1);
    if (table2 !== global) for (const c of table2.colors) w.bytes(c);
    const idx = new Uint8Array(W * H);
    for (let p = 0; p < idx.length; p++) {
      const k2 = keyOf(f.data, p * 4);
      idx[p] = k2 === -1 ? table2.tIndex : table2.index.get(k2);
    }
    lzwEncode(idx, Math.max(2, table2.bits), w);
  });
  w.byte(59);
  return w.result();
}

// lib/core/export/zip.js
var enc = new TextEncoder();
function createZip(entries) {
  const files = [], central = [];
  let offset = 0;
  const used = /* @__PURE__ */ new Set();
  for (const e of entries) {
    let name = e.name.replace(/\\/g, "/").replace(/^\/+/, "");
    if (used.has(name)) {
      const m = /^(.*?)(\.[^.]*)?$/.exec(name);
      let i = 2;
      while (used.has(`${m[1]}-${i}${m[2] || ""}`)) i++;
      name = `${m[1]}-${i}${m[2] || ""}`;
    }
    used.add(name);
    const nameBytes = enc.encode(name);
    const data = typeof e.data === "string" ? enc.encode(e.data) : e.data;
    const crc = crc32(data);
    const d = e.date || /* @__PURE__ */ new Date();
    const time = d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1;
    const date = d.getFullYear() - 1980 << 9 | d.getMonth() + 1 << 5 | d.getDate();
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 67324752, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 2048, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 33639248, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 2048, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    files.push(local, data);
    central.push(cen);
    offset += local.length + data.length;
  }
  const cenSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 101010256, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cenSize + 22);
  let o = 0;
  for (const p of [...files, ...central, end]) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// lib/core/export/sheet.js
var blank = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
function blit(dst, src, dx, dy, sx = 0, sy = 0, sw = src.width, sh = src.height) {
  for (let y = 0; y < sh; y++) {
    const so = ((sy + y) * src.width + sx) * 4, o = ((dy + y) * dst.width + dx) * 4;
    dst.data.set(src.data.subarray ? src.data.subarray(so, so + sw * 4) : Array.prototype.slice.call(src.data, so, so + sw * 4), o);
  }
}
function packSpriteSheet(frames, opts = {}) {
  if (!frames.length) throw new Error("No frames");
  const pad = Math.max(0, opts.padding | 0);
  const cw = Math.max(...frames.map((f) => f.width)), ch = Math.max(...frames.map((f) => f.height));
  const cols = Math.max(1, Math.min(frames.length, opts.columns || Math.ceil(Math.sqrt(frames.length))));
  const rows = Math.ceil(frames.length / cols);
  const W = cols * cw + (cols - 1) * pad, H = rows * ch + (rows - 1) * pad;
  const image = blank(W, H);
  const out = {};
  frames.forEach((f, i) => {
    const x = i % cols * (cw + pad), y = Math.floor(i / cols) * (ch + pad);
    blit(image, f, x, y);
    out[f.name || `frame-${String(i).padStart(3, "0")}`] = {
      frame: { x, y, w: f.width, h: f.height },
      sourceSize: { w: f.width, h: f.height },
      ...f.delay != null ? { duration: Math.round(f.delay) } : {}
    };
  });
  const atlas = { frames: out, meta: { app: "pixelforge", image: (opts.name || "sheet") + ".png", size: { w: W, h: H }, scale: "1", columns: cols, rows, padding: pad } };
  return { image, atlas };
}
function buildTileset(img, opts = {}) {
  const tw = Math.max(1, opts.tileWidth || 8), th = Math.max(1, opts.tileHeight || tw);
  const mw = Math.ceil(img.width / tw), mh = Math.ceil(img.height / th);
  const tiles = [], keys = /* @__PURE__ */ new Map(), map = [], flipsOut = [];
  const read = (tx, ty) => {
    const t = blank(tw, th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const sx = tx * tw + x, sy = ty * th + y;
      if (sx >= img.width || sy >= img.height) continue;
      const so = (sy * img.width + sx) * 4;
      t.data.set([img.data[so], img.data[so + 1], img.data[so + 2], img.data[so + 3]], (y * tw + x) * 4);
    }
    return t;
  };
  const key2 = (t) => {
    let s = "";
    for (let i = 0; i < t.data.length; i += 4) s += t.data[i + 3] === 0 ? "." : String.fromCharCode(t.data[i] + 1, t.data[i + 1] + 1, t.data[i + 2] + 1);
    return s;
  };
  const flip = (t, fx, fy) => {
    const o = blank(tw, th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const si = ((fy ? th - 1 - y : y) * tw + (fx ? tw - 1 - x : x)) * 4;
      o.data.set(t.data.subarray(si, si + 4), (y * tw + x) * 4);
    }
    return o;
  };
  for (let ty = 0; ty < mh; ty++) {
    for (let tx = 0; tx < mw; tx++) {
      const t = read(tx, ty);
      let id = keys.get(key2(t)), f = 0;
      if (id === void 0 && opts.flips) {
        for (const [fx, fy, code] of [[1, 0, 1], [0, 1, 2], [1, 1, 3]]) {
          const k2 = keys.get(key2(flip(t, fx, fy)));
          if (k2 !== void 0) {
            id = k2;
            f = code;
            break;
          }
        }
      }
      if (id === void 0) {
        id = tiles.length;
        tiles.push(t);
        keys.set(key2(t), id);
      }
      map.push(id);
      flipsOut.push(f);
    }
  }
  const sheet = packSpriteSheet(tiles, { columns: opts.columns || Math.min(16, tiles.length) });
  return {
    image: sheet.image,
    map: { width: mw, height: mh, tileWidth: tw, tileHeight: th, tiles: map, ...opts.flips ? { flips: flipsOut } : {} },
    count: tiles.length
  };
}

// lib/core/video/frames.js
var wait = (el, ev, ms = 4e3) => new Promise((res, rej) => {
  const t = setTimeout(() => {
    el.removeEventListener(ev, ok);
    rej(new Error(`Timed out waiting for "${ev}"`));
  }, ms);
  const ok = () => {
    clearTimeout(t);
    res();
  };
  el.addEventListener(ev, ok, { once: true });
});
var MEDIA_ERRORS = {
  1: "loading was aborted",
  2: "a network error stopped the download",
  3: "the browser could not decode it",
  4: "this browser can't play this video's format"
};
function mediaError(video) {
  const code = video.error ? video.error.code : 0;
  const err = new Error(MEDIA_ERRORS[code] || "the video could not be loaded");
  err.code = code;
  if (video.error && video.error.message) err.detail = video.error.message;
  return err;
}
var waitOrFail = (video, ok, ms) => new Promise((res, rej) => {
  const done = () => {
    clearTimeout(t);
    video.removeEventListener(ok, onOk);
    video.removeEventListener("error", onErr);
  };
  const onOk = () => {
    done();
    res();
  };
  const onErr = () => {
    done();
    rej(mediaError(video));
  };
  const t = setTimeout(() => {
    done();
    rej(new Error(`no response from the video decoder after ${ms / 1e3} s`));
  }, ms);
  video.addEventListener(ok, onOk, { once: true });
  video.addEventListener("error", onErr, { once: true });
});
async function videoReady(video, { timeout = 6e4 } = {}) {
  if (video.error) throw mediaError(video);
  if (video.readyState < 1) await waitOrFail(video, "loadedmetadata", timeout);
  if (video.readyState < 2) await waitOrFail(video, "loadeddata", timeout).catch((e) => {
    if (e.code) throw e;
  });
  return video;
}
async function sniffVideoCodec(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const NAMES = { avc1: "H.264", avc3: "H.264", hvc1: "H.265 (HEVC)", hev1: "H.265 (HEVC)", av01: "AV1", vp09: "VP9", vp08: "VP8", mp4v: "MPEG-4 Part 2", apcn: "ProRes", apch: "ProRes", apcs: "ProRes", apco: "ProRes", ap4h: "ProRes 4444", dvh1: "Dolby Vision", dvhe: "Dolby Vision" };
  for (let i = 0; i + 24 < buf.length; i++) {
    if (buf[i] === 115 && buf[i + 1] === 116 && buf[i + 2] === 115 && buf[i + 3] === 100) {
      const type = String.fromCharCode(buf[i + 16], buf[i + 17], buf[i + 18], buf[i + 19]);
      if (NAMES[type]) return NAMES[type];
    }
  }
  const head = new TextDecoder("latin1").decode(buf.subarray(0, Math.min(buf.length, 1 << 20)));
  const m = /V_(VP8|VP9|AV1|MPEG4\/ISO\/AVC|MPEGH\/ISO\/HEVC)/.exec(head);
  if (m) return { VP8: "VP8", VP9: "VP9", AV1: "AV1", "MPEG4/ISO/AVC": "H.264", "MPEGH/ISO/HEVC": "H.265 (HEVC)" }[m[1]];
  return "";
}
async function seekTo(video, time) {
  time = Math.max(0, Math.min(time, (video.duration || 0) - 1e-4));
  if (Math.abs(video.currentTime - time) < 1e-6 && video.readyState >= 2) return;
  const presented = "requestVideoFrameCallback" in video ? new Promise((res) => {
    video.requestVideoFrameCallback(() => res());
    setTimeout(res, 500);
  }) : null;
  const seeked = wait(video, "seeked");
  video.currentTime = time;
  await seeked;
  if (presented) await presented;
}
async function estimateFps(video, fallback = 30) {
  if (!("requestVideoFrameCallback" in video)) return fallback;
  await videoReady(video);
  const was = { t: video.currentTime, muted: video.muted, paused: video.paused };
  const times = [];
  try {
    video.muted = true;
    await new Promise((res) => {
      const done = setTimeout(res, 1200);
      const cb = (_, meta) => {
        times.push(meta.mediaTime);
        if (times.length >= 12) {
          clearTimeout(done);
          res();
        } else video.requestVideoFrameCallback(cb);
      };
      video.requestVideoFrameCallback(cb);
      video.play().catch(() => {
        clearTimeout(done);
        res();
      });
    });
  } finally {
    video.pause();
    video.muted = was.muted;
    await seekTo(video, was.t).catch(() => {
    });
  }
  const deltas = [];
  for (let i = 1; i < times.length; i++) {
    const d = times[i] - times[i - 1];
    if (d > 1e-3) deltas.push(d);
  }
  if (deltas.length < 3) return fallback;
  deltas.sort((a, b) => a - b);
  const fps = 1 / deltas[Math.floor(deltas.length / 2)];
  for (const r of [12, 15, 23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60]) if (Math.abs(fps - r) < 0.6) return r;
  return Math.round(fps);
}
function frameTimes({ duration, fps, start = 0, end = duration, maxFrames = Infinity }) {
  const out = [];
  const n = Math.min(maxFrames, Math.max(1, Math.floor((end - start) * fps + 1e-6)));
  for (let i = 0; i < n; i++) out.push(start + (i + 0.5) / fps);
  return out;
}
async function forEachFrame(video, opts) {
  await videoReady(video);
  const wasPaused = video.paused;
  video.pause();
  const times = Array.isArray(opts.times) ? opts.times.filter((t) => Number.isFinite(t)).slice(0, opts.maxFrames ?? Infinity) : frameTimes({ duration: video.duration, ...opts });
  try {
    for (let i = 0; i < times.length; i++) {
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await seekTo(video, times[i]);
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await opts.onFrame({ index: i, time: times[i], total: times.length });
    }
  } finally {
    if (!wasPaused) video.play().catch(() => {
    });
  }
  return times.length;
}

// lib/index.js
var VERSION = true ? "1.0.0" : "dev";
//# sourceMappingURL=pixelforge.cjs.map
