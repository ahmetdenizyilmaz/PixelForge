// Builds the static PixelForge website, Workstation, Interactive Lab, and Docs into _site/.
import { esbuild } from './esbuild.mjs';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { copy, countFiles } from './fsutil.mjs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown, frontMatter, esc } from './markdown.mjs';
import { FORGE_LOGO_SVG } from '../lib/editor/icons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const OUT = join(ROOT, process.env.SITE_OUT || '_site');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const REPO = 'https://github.com/ahmetdenizyilmaz/PixelForge';

const write = (rel, content) => { const f = join(OUT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };
const read = rel => readFileSync(join(SITE, rel), 'utf8');
const up = depth => (depth ? '../'.repeat(depth) : './');

const NAV = [
  ['editor/', 'Workstation'],
  ['playground/', 'Interactive Lab'],
  ['docs/', 'Docs'],
];

function page({ title, description = pkg.description, depth, body, active = '', scripts = [], styles = [], bodyClass = '' }) {
  const r = up(depth);
  const nav = NAV.map(([href, label]) => `<a href="${r}${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta name="color-scheme" content="dark light">
<link rel="icon" href="${r}assets/favicon.svg" type="image/svg+xml">
<script>try{var t=JSON.parse(localStorage.getItem('pf:theme'));if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="stylesheet" href="${r}assets/site.css">
${styles.map(s => `<link rel="stylesheet" href="${r}${s}">`).join('\n')}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-top">
  <a class="brand" href="${r}">${FORGE_LOGO_SVG}<span>PixelForge</span></a>
  <nav class="site-nav" aria-label="Main">${nav}</nav>
  <div class="site-actions">
    <a class="nav-cta hide-xs" href="${r}editor/">Launch Workstation</a>
    <a class="icon-link" href="${REPO}" aria-label="Source on GitHub" title="Source on GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-4 1.3-4-2-5.5-2.5M14.5 21v-3.2c0-1 .1-1.4-.5-2 2.6-.3 5.5-1.3 5.5-5.8a4.5 4.5 0 0 0-1.2-3.1 4.2 4.2 0 0 0-.1-3.1s-1-.3-3.3 1.2a11.4 11.4 0 0 0-6 0C6.6 3.5 5.6 3.8 5.6 3.8a4.2 4.2 0 0 0-.1 3.1A4.5 4.5 0 0 0 4.3 10c0 4.5 2.9 5.5 5.5 5.8-.6.6-.6 1.2-.5 2V21"/></svg></a>
    <button class="icon-link theme-toggle" type="button" aria-label="Toggle theme" title="Toggle theme"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z"/></svg></button>
  </div>
</header>
${body}
<script src="${r}assets/site.js"></script>
${scripts.map(s => `<script type="module" src="${r}${s}"></script>`).join('\n')}
</body>
</html>
`;
}

const footer = depth => `<footer class="site-foot"><div class="wrap">
  <span class="foot-brand">${FORGE_LOGO_SVG}<span>PixelForge ${pkg.version} — WebGL 2 Workstation · OKLab-BGM &amp; Posterior Shaders · 32-Thread Numba Core · 15-Tool MCP. MIT License.</span></span>
  <span class="links"><a href="${up(depth)}editor/">Workstation</a><a href="${up(depth)}playground/">Interactive Lab</a><a href="${up(depth)}docs/">Docs</a><a href="${REPO}">GitHub</a></span>
</div></footer>`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const bundle = (entry, outfile, opts = {}) => esbuild.build({
  entryPoints: [entry], outfile: join(OUT, outfile), bundle: true, minify: true, logLevel: 'warning',
  define: { __ITP_VERSION__: JSON.stringify(pkg.version) }, ...opts,
});
const pageJS = { format: 'esm', sourcemap: true, target: 'es2022', external: ['node:*'] };
await bundle(join(SITE, 'assets/editor-page.js'), 'assets/editor.js', pageJS);
await bundle(join(SITE, 'assets/landing.js'), 'assets/landing.js', pageJS);
await bundle(join(SITE, 'assets/playground.js'), 'assets/playground.js', pageJS);
await bundle(join(SITE, 'assets/site.js'), 'assets/site.js', { format: 'iife', target: 'es2018' });
const css = { external: ['*.woff2'] };
await bundle(join(SITE, 'assets/site.css'), 'assets/site.css', css);
await bundle(join(ROOT, 'lib/editor/styles/editor.css'), 'assets/editor.css', css);
copy(join(ROOT, 'lib/editor/styles/fonts'), join(OUT, 'assets/fonts'));

for (const f of readdirSync(join(SITE, 'assets'))) {
  if (/\.(svg|png|ico|webmanifest|jpg)$/.test(f)) copy(join(SITE, 'assets', f), join(OUT, 'assets', f));
}
if (existsSync(join(SITE, 'assets/photos'))) copy(join(SITE, 'assets/photos'), join(OUT, 'assets/photos'));
const { SAMPLES } = await import('../lib/editor/samples.js');
for (const smp of SAMPLES) if (smp.svg) write(`assets/samples/${smp.id}.svg`, smp.svg);
if (!existsSync(join(ROOT, 'dist/pixelforge.js'))) throw new Error('dist/ is missing: run `npm run build` first');
mkdirSync(join(OUT, 'lib'), { recursive: true });
for (const f of readdirSync(join(ROOT, 'dist'))) if (/\.(js|css|cjs)$/.test(f)) copy(join(ROOT, 'dist', f), join(OUT, 'lib', f));
copy(join(ROOT, 'lib/editor/styles/fonts'), join(OUT, 'lib/fonts'));

write('index.html', page({
  title: 'PixelForge · Scientific Pixel Art Workstation & Dual-Runtime Engine',
  description: 'Real-time WebGL 2 Pixel Art Workstation, OKLab-BGM & Bayesian Posterior Shaders, 32-Thread Numba Python Core, Game Tileset Packers, and 15-Tool MCP Server.',
  depth: 0, active: '',
  body: read('index.html').replace(/\{\{root\}\}/g, './').replace('{{footer}}', footer(0)).replace(/\{\{version\}\}/g, pkg.version),
  scripts: ['assets/landing.js'], bodyClass: 'landing',
}));

write('editor/index.html', page({
  title: 'Workstation · PixelForge',
  description: '5-viewport WebGL 2 pixel-art workstation with non-destructive retouch tools, OKLab-BGM discovery, 12x loupe, and mirror-deduplicated tileset studio.',
  depth: 1, active: 'editor/',
  body: read('editor/index.html'), styles: ['assets/editor.css'], scripts: ['assets/editor.js'], bodyClass: 'app',
}));

write('playground/index.html', page({
  title: 'Interactive Algorithm & Game-Asset Lab · PixelForge',
  description: 'Compare Bayesian Posterior dithering, OKLab-BGM palette discovery, mirror-deduplicated tilesets, and procedural OKLab color ramps live on WebGL 2.',
  depth: 1, active: 'playground/',
  body: read('playground/index.html').replace('{{footer}}', footer(1)),
  scripts: ['assets/playground.js'], bodyClass: 'playground-page',
}));

const docs = readdirSync(join(SITE, 'docs')).filter(f => f.endsWith('.md')).map(f => {
  const { data, body } = frontMatter(readFileSync(join(SITE, 'docs', f), 'utf8'));
  return { slug: f.replace(/\.md$/, ''), ...data, body };
});
const GROUPS = ['Overview', 'Workstation', 'Developers'];
docs.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || (a.order ?? 99) - (b.order ?? 99));

function docNav(current, depth) {
  const r = up(depth);
  return GROUPS.map(g => {
    const list = docs.filter(p => p.group === g);
    if (!list.length) return '';
    return `<div class="nav-group"><div class="nav-label">${g}</div>${list.map(p => {
      const href = p.slug === 'index' ? `${r}docs/` : `${r}docs/${p.slug}/`;
      return `<a href="${href}"${p.slug === current ? ' aria-current="page"' : ''}>${esc(p.title)}</a>`;
    }).join('')}</div>`;
  }).join('');
}

for (const d of docs) {
  const isIndex = d.slug === 'index';
  const depth = isIndex ? 1 : 2;
  const { html, toc, h1 } = renderMarkdown(d.body);
  const idx = docs.indexOf(d);
  const prev = idx > 0 ? docs[idx - 1] : null;
  const next = idx >= 0 && idx < docs.length - 1 ? docs[idx + 1] : null;
  const r = up(depth);
  const docHref = p => (p.slug === 'index' ? `${r}docs/` : `${r}docs/${p.slug}/`);
  const pager = `<nav class="pager" aria-label="Pages">${prev ? `<a class="prev" href="${docHref(prev)}"><small>Previous</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="next" href="${docHref(next)}"><small>Next</small>${esc(next.title)}</a>` : ''}</nav>`;
  const content = isIndex ? html.replace(/href="\.\.\//g, 'href="') : html;
  const body = `<div class="docs" id="main">
  <button class="docs-menu" type="button" aria-expanded="false" aria-controls="docs-nav">Documentation Menu</button>
  <nav class="docs-nav" id="docs-nav" aria-label="Documentation">${docNav(d.slug, depth)}</nav>
  <article class="prose">
    <header class="doc-head"><p class="crumb">${esc(d.group || 'Docs')}</p><h1>${esc(h1 || d.title)}</h1>${d.description ? `<p class="lede">${esc(d.description)}</p>` : ''}</header>
    ${content}
    ${pager}
  </article>
  ${toc.length > 1 ? `<aside class="toc" aria-label="On this page"><div class="nav-label">On this page</div>${toc.map(t => `<a class="d${t.depth}" href="#${t.id}">${esc(t.text)}</a>`).join('')}</aside>` : '<aside class="toc"></aside>'}
</div>${footer(depth)}`;
  write(isIndex ? 'docs/index.html' : `docs/${d.slug}/index.html`, page({ title: `${d.title} · PixelForge Docs`, description: d.description, depth, body, active: 'docs/' }));
}

write('404.html', page({
  title: 'Page Not Found · PixelForge', depth: 0, active: '',
  body: `<main class="notfound" id="main"><div class="wrap"><h1>Nothing at this address</h1><p class="lede">Try the <a href="./editor/">PixelForge Workstation</a>, the <a href="./playground/">Interactive Lab</a>, or the <a href="./docs/">Documentation</a>.</p></div></main>${footer(0)}`,
}));

write('.nojekyll', '');
console.log(`site built: ${relative(ROOT, OUT)}/ (${countFiles(OUT)} files, ${docs.length} docs pages, interactive playground)`);
