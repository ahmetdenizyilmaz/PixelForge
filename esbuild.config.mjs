// Builds the PixelForge library & studio bundles into dist/.
import { esbuild } from './scripts/esbuild.mjs';
import { copy } from './scripts/fsutil.mjs';
import { rmSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

const watch = process.argv.includes('--watch');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const banner = { js: `/*! PixelForge v${pkg.version} | MIT | https://github.com/ahmetdenizyilmaz/PixelForge */` };
const common = { absWorkingDir: ROOT, define: { __ITP_VERSION__: JSON.stringify(pkg.version) }, bundle: true, sourcemap: true, target: 'es2020', banner, logLevel: 'warning', external: ['node:*'] };

const builds = [
  { ...common, entryPoints: ['lib/index.js'], format: 'esm', outfile: 'dist/pixelforge.esm.js', external: ['shadermate', 'node:*'] },
  { ...common, entryPoints: ['lib/index.js'], format: 'cjs', outfile: 'dist/pixelforge.cjs', external: ['shadermate', 'node:*'], platform: 'neutral', mainFields: ['module', 'main'] },
  { ...common, entryPoints: ['lib/index.js'], format: 'esm', outfile: 'dist/pixelforge.bundle.esm.js', minify: true },
  { ...common, entryPoints: ['lib/index.js'], format: 'iife', globalName: 'PixelForge', outfile: 'dist/pixelforge.js' },
  { ...common, entryPoints: ['lib/index.js'], format: 'iife', globalName: 'PixelForge', outfile: 'dist/pixelforge.min.js', minify: true },
  { ...common, entryPoints: ['lib/video.js'], format: 'esm', outfile: 'dist/video.esm.js', minify: true },
  { ...common, entryPoints: ['lib/editor/index.js'], format: 'esm', outfile: 'dist/editor.esm.js', minify: true, splitting: false },
  { ...common, entryPoints: ['lib/editor/styles/editor.css'], outfile: 'dist/editor.css', minify: true, external: ['*.woff2'] },
];

if (!watch) { rmSync(new URL('dist', import.meta.url), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
mkdirSync(new URL('dist', import.meta.url), { recursive: true });

if (watch) {
  for (const b of builds) (await esbuild.context(b)).watch();
  console.log('watching lib/ …');
} else {
  await Promise.all(builds.map(b => esbuild.build(b)));
  copy(join(ROOT, 'lib/editor/styles/fonts'), join(ROOT, 'dist/fonts'));
  console.log(`built ${builds.length} bundles into dist/`);
}
