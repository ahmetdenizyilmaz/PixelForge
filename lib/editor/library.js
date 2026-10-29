// PixelForge Studio Left Asset Drawer:
// - Sources (Batch Queue + Per-File Scope + Scenic View Photographs)
// - Categorized 20-Preset Gallery (Live WebGL 2 Thumbnails)
// - Palettes + Procedural OKLab Color-Ramp Harmony Designer

import { h, render } from './dom.js';
import { menu } from './ui.js';
import { icon } from './icons.js';
import { PRESETS, PRESET_CATEGORIES } from '../core/presets.js';
import { PALETTES } from '../core/palette/builtin.js';
import { generateHarmonyRamp } from '../core/palette/extract.js';
import { mergeSettings, defaultSettings } from '../core/settings.js';
import { SAMPLES, sampleURL } from './samples.js';

export function createLibrary(app) {
  let tab = 'files';
  let presetCat = 'All';

  // Procedural OKLab Harmony state
  const harmony = {
    mode: 'analogous',
    baseHue: 205,
    count: 16,
    chroma: 0.16,
    hueShift: 0.45,
  };

  const tabBtn = (id, label, ic) => h('button', {
    type: 'button', role: 'tab', title: label, 'aria-selected': String(id === tab),
    html: `${icon(ic)}<span>${label}</span>`, onclick: () => setTab(id),
  });
  const tFiles = tabBtn('files', 'Sources', 'files');
  const tPresets = tabBtn('presets', 'Presets', 'presets');
  const tPalettes = tabBtn('palettes', 'Palettes', 'palette');
  const filesCount = h('span.count', {});
  tFiles.append(filesCount);
  const tabs = h('div.itp-seg', { role: 'tablist', 'aria-label': 'Studio Drawer' }, tFiles, tPresets, tPalettes);

  const search = h('input', { type: 'search', placeholder: 'Filter sources, presets or palettes…', 'aria-label': 'Filter studio drawer' });
  const searchBox = h('div.itp-search', {}, h('span', { html: icon('search') }), search);
  search.addEventListener('input', () => renderTab());

  const body = h('div.itp-panel-body', {});
  const el = h('aside.itp-lib.pf-drawer', { 'aria-label': 'Studio Drawer' },
    h('div.itp-panel-head', {}, tabs),
    searchBox,
    body);

  let onTabSwitch = null;

  function setTab(t) {
    tab = t;
    for (const [b, id] of [[tFiles, 'files'], [tPresets, 'presets'], [tPalettes, 'palettes']]) {
      b.setAttribute('aria-selected', String(id === t));
    }
    search.value = '';
    renderTab();
    onTabSwitch?.(t);
    if (t === 'presets' && !thumbs.size) refreshThumbs();
  }
  const q = () => search.value.trim().toLowerCase();

  // ---- Sources
  function fileMenu(it, anchor) {
    const i = app.items.indexOf(it), many = app.items.length > 1;
    menu(anchor, [
      it.own
        ? { label: 'Link to shared settings', sub: 'Drop independent override', icon: 'link', onClick: () => app.setOwn(it, false) }
        : { label: 'Unlink independent settings', sub: 'Edits apply only to this source', icon: 'unlink', disabled: !many, onClick: () => app.setOwn(it, true) },
      'sep',
      { label: 'Copy pipeline settings', icon: 'copy', onClick: () => app.copySettings(it) },
      { label: 'Paste pipeline settings', sub: app.clipboard ? 'Applies copied settings here' : 'Copy from a source first', icon: 'clipboard', disabled: !app.clipboard, onClick: () => app.pasteSettings(it) },
      { label: 'Broadcast settings to all sources', icon: 'layers', disabled: !many, onClick: () => app.applyToAll(it) },
      'sep',
      { label: 'Rename source', sub: 'Used for exported filenames', icon: 'rename', kbd: 'F2', onClick: () => app.startRename(it) },
      { label: 'Duplicate for A/B testing', sub: 'Creates copy with independent settings', icon: 'copy', onClick: () => app.duplicate(it) },
      { label: 'Move up', icon: 'arrowUp', kbd: 'Alt Shift ↑', disabled: i <= 0, onClick: () => app.move(it, -1) },
      { label: 'Move down', icon: 'arrowDown', kbd: 'Alt Shift ↓', disabled: i >= app.items.length - 1, onClick: () => app.move(it, 1) },
      'sep',
      { label: 'Remove source', icon: 'trash', kbd: 'Del', onClick: () => app.removeItem(it) },
    ], { align: 'start' });
  }

  function renderFiles() {
    const items = app.items.filter(i => !q() || i.name.toLowerCase().includes(q()));
    const list = h('ul.itp-files', { 'aria-label': 'Active Sources' });
    for (const it of items) {
      const more = h('button.itp-btn.small.icon', {
        type: 'button', 'aria-label': `Options for ${it.name}`, 'aria-haspopup': 'menu',
        title: 'Scope, duplicate, order', html: icon('more'),
        onclick: e => { e.stopPropagation(); fileMenu(it, more); },
      });
      const editCount = it.edits && it.edits.count ? ` · ${it.edits.count}px retouched` : '';
      const sub = (it.type === 'video' ? `Video · ${fmtTime(it.duration)}` : `${it.width} × ${it.height}`) + editCount;
      const row = h('li.itp-file-row', { tabindex: '0', 'aria-current': String(app.current === it), 'data-own': it.own ? 'true' : null },
        h('img.thumb', { src: it.thumb || '', alt: '' }),
        h('div', { style: { minWidth: 0 } },
          h('div.title', { text: it.name }),
          h('div.sub', {}, sub, it.own ? h('span.itp-own', { title: 'Independent settings', html: `${icon('unlink')}<span>Own</span>` }) : null)),
        h('div.actions', {}, more,
          h('button.itp-btn.small.icon.danger', {
            type: 'button', 'aria-label': `Remove ${it.name}`, title: 'Remove', html: icon('x'),
            onclick: e => { e.stopPropagation(); app.removeItem(it); },
          })));
      row.addEventListener('click', () => app.select(it));
      row.addEventListener('dblclick', e => { if (e.target.closest('.title')) app.startRename(it); });
      row.addEventListener('contextmenu', e => { e.preventDefault(); app.select(it); fileMenu(it, more); });
      row.addEventListener('keydown', e => {
        if (e.target !== row) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.select(it); }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); app.removeItem(it); }
        if (e.altKey) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); row.nextElementSibling?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); row.previousElementSibling?.focus(); }
      });
      list.append(row);
    }

    const nOwn = app.items.filter(i => i.own).length;
    const summary = !app.items.length ? 'Queue Empty'
      : app.items.length === 1 ? '1 Active Source'
      : nOwn ? `${app.items.length} Sources (${nOwn} independent)`
      : `${app.items.length} Sources · Shared Pipeline`;

    const head = h('div.itp-group', {}, h('span', { text: summary }),
      app.items.length > 1 ? h('button.itp-link', { type: 'button', text: 'Clear all', onclick: () => app.clearItems() }) : null);

    const add = h('div.pf-drawer-actions', {},
      h('button.itp-btn.primary.small', { type: 'button', html: `${icon('upload')}<span>Import Media</span>`, onclick: () => app.openFiles() }),
      h('button.itp-btn.outline.small', { type: 'button', html: `${icon('clipboard')}<span>Paste</span>`, title: 'Paste image from clipboard (Ctrl+V)', onclick: () => app.pasteFromClipboard() }));

    const saved = app.savedWorkspace?.();
    const savedNote = saved ? h('div.itp-group.itp-saved', {},
      h('span', { text: `IndexedDB Workspace: ${saved.count} file${saved.count === 1 ? '' : 's'}`, title: 'Stored privately in your browser.' }),
      h('button.itp-link', { type: 'button', text: 'Purge', onclick: () => app.forgetWorkspace() })) : null;

    const scenicPhotos = SAMPLES.filter(s => s.photo);
    const starterSprites = SAMPLES.filter(s => !s.photo);

    const makeSampleCard = s => h('button.pf-lib-sample', {
      type: 'button',
      title: `Open "${s.name}" (${s.subtitle || ''})`,
      onclick: () => app.openSample?.(s),
    },
    h('img', { src: sampleURL(s), alt: '' }),
    h('div.pf-sample-info', {},
      h('span.n', { text: s.name }),
      s.subtitle ? h('span.s', { text: s.subtitle }) : null));

    render(body,
      add,
      head,
      list,
      savedNote,
      h('div.itp-group', {}, h('span', { text: 'Real Scenic View Photographs' })),
      h('div.pf-lib-samples', {}, ...scenicPhotos.map(makeSampleCard)),
      starterSprites.length ? h('div.itp-group', {}, h('span', { text: 'Reference Sprites & Tiles' })) : null,
      starterSprites.length ? h('div.pf-lib-samples', {}, ...starterSprites.map(makeSampleCard)) : null);
  }

  // ---- Categorized 20-Preset Gallery
  const thumbs = new Map();
  let thumbGen = 0;

  function renderPresets() {
    const cats = ['All', ...PRESET_CATEGORIES];
    const catBar = h('div.pf-cat-pills', {},
      ...cats.map(c => h('button.pf-cat-pill', {
        type: 'button',
        'aria-pressed': String(presetCat === c),
        text: c,
        onclick: () => { presetCat = c; renderPresets(); },
      })));

    const list = PRESETS.filter(p =>
      (presetCat === 'All' || p.category === presetCat) &&
      (!q() || (p.name + ' ' + p.description + ' ' + (p.category || '')).toLowerCase().includes(q()))
    );

    const grid = h('div.itp-presets', {});
    for (const p of list) {
      const active = app.activePreset === p.id;
      const pic = thumbs.get(p.id) || h('div.ph', {});
      const b = h('button.itp-preset', {
        type: 'button', 'aria-pressed': String(active), title: p.description,
        onclick: () => app.applyPreset(p),
      },
      pic,
      p.category ? h('span.pf-pcat', { text: p.category }) : null,
      h('span.t', { text: p.name }),
      h('span.d', { text: p.description }));
      grid.append(b);
    }
    render(body, catBar, h('div.itp-group', {}, h('span', { text: `${list.length} Live GPU Looks` })), grid);
  }

  async function refreshThumbs() {
    const gen = ++thumbGen;
    const item = app.current;
    if (!item || !app.engine) return;
    for (const p of PRESETS) {
      if (gen !== thumbGen) return;
      const s = mergeSettings(defaultSettings(), p.settings);
      s.size = { ...s.size, mode: 'width', width: Math.min(s.size.width, 76), height: 0 };
      try {
        const r = await app.engine.process(item.source, s);
        if (gen !== thumbGen) return;
        thumbs.set(p.id, r.toCanvas(1));
        if (tab === 'presets') renderPresets();
      } catch { /* skip failed thumb */ }
    }
  }

  // ---- Palettes + Procedural OKLab Harmony Designer
  function buildHarmonyBox() {
    const rampPreview = h('div.itp-strip.pf-harmony-strip');
    let currentColors = [];

    const updateRamp = () => {
      currentColors = generateHarmonyRamp(harmony);
      render(rampPreview, ...currentColors.map(c => h('i', { style: { background: c }, title: c })));
    };

    const modeSel = h('select.itp-select', { 'aria-label': 'OKLab Harmony Mode' },
      ...[
        ['analogous', 'Analogous Pixel Ramp'],
        ['complementary', 'Complementary Dual-Ramp'],
        ['split', 'Split-Complementary Triad'],
        ['triadic', 'Balanced 3-Hue Triadic'],
        ['cyber', 'Cyberpunk Neon Contrast'],
        ['warmcool', 'Warm Highlights / Cool Shadows'],
      ].map(([v, t]) => h('option', { value: v, text: t, selected: harmony.mode === v })));
    modeSel.addEventListener('change', () => { harmony.mode = modeSel.value; updateRamp(); });

    const countSel = h('select.itp-select', { 'aria-label': 'Ramp Swatch Count' },
      ...[4, 8, 12, 16, 24, 32].map(n => h('option', { value: String(n), text: `${n} colours`, selected: harmony.count === n })));
    countSel.addEventListener('change', () => { harmony.count = Number(countSel.value); updateRamp(); });

    const hueNum = h('span.mono.num', { text: `${harmony.baseHue}°` });
    const hueRange = h('input.pf-mini-range', { type: 'range', min: 0, max: 360, value: harmony.baseHue, 'aria-label': 'Base Hue' });
    hueRange.addEventListener('input', () => {
      harmony.baseHue = Number(hueRange.value);
      hueNum.textContent = `${harmony.baseHue}°`;
      updateRamp();
    });

    const shiftNum = h('span.mono.num', { text: `${Math.round(harmony.hueShift * 100)}%` });
    const shiftRange = h('input.pf-mini-range', { type: 'range', min: 0, max: 100, value: Math.round(harmony.hueShift * 100), 'aria-label': 'Shadow-to-Highlight Hue Shift' });
    shiftRange.addEventListener('input', () => {
      harmony.hueShift = Number(shiftRange.value) / 100;
      shiftNum.textContent = `${shiftRange.value}%`;
      updateRamp();
    });

    updateRamp();

    const applyBtn = h('button.itp-btn.primary.small', {
      type: 'button',
      html: `${icon('spark')}<span>Apply Ramp</span>`,
      onclick: () => {
        const name = `OKLab ${harmony.mode[0].toUpperCase() + harmony.mode.slice(1)} ${harmony.baseHue}°`;
        app.usePalette({ name, colors: currentColors, custom: true });
      },
    });
    const saveBtn = h('button.itp-btn.outline.small', {
      type: 'button',
      html: `${icon('save')}<span>Keep</span>`,
      title: 'Save generated harmony ramp to Your Palettes',
      onclick: () => {
        const name = `OKLab ${harmony.mode[0].toUpperCase() + harmony.mode.slice(1)} (${harmony.count})`;
        app.rememberHarmonyPalette?.(name, currentColors);
      },
    });

    return h('div.pf-harmony-card', {},
      h('div.pf-harmony-head', {},
        h('span', { html: `${icon('spark')}<b>OKLab Harmony Generator</b>` }),
        h('span.pf-tag', { text: 'Procedural' })),
      h('div.pf-harmony-grid', {}, modeSel, countSel),
      h('div.pf-harmony-sl', {}, h('div.lab', {}, h('span', { text: 'Base Hue' }), hueNum), hueRange),
      h('div.pf-harmony-sl', {}, h('div.lab', {}, h('span', { text: 'Ramp Hue Shift' }), shiftNum), shiftRange),
      rampPreview,
      h('div.pf-harmony-btns', {}, applyBtn, saveBtn));
  }

  function palRow(p, active, removable) {
    const strip = h('div.itp-strip', {}, ...p.colors.slice(0, 64).map(c => h('i', { style: { background: c.startsWith('#') ? c : '#' + c } })));
    const row = h('li.itp-pal', { tabindex: '0', role: 'button', 'aria-pressed': String(active) },
      h('div.row', {}, h('span', { text: p.name }), h('span.n', { text: String(p.colors.length), title: p.author ? `by ${p.author}` : null })),
      strip);
    const pick = () => app.usePalette(p);
    row.addEventListener('click', pick);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      if (removable && e.key === 'Delete') app.deletePalette(p);
    });
    if (removable) {
      const del = h('button.itp-btn.small.icon.danger', {
        type: 'button', 'aria-label': `Delete ${p.name}`, title: 'Delete', html: icon('trash'),
        onclick: e => { e.stopPropagation(); app.deletePalette(p); },
      });
      row.firstChild.append(del);
    }
    return row;
  }

  function renderPalettes() {
    const s = app.store.settings.palette;
    const match = p => !q() || (p.name + ' ' + (p.author || '')).toLowerCase().includes(q()) || String(p.colors.length) === q();
    const mine = app.userPalettes.filter(match);
    const built = PALETTES.filter(match);
    const actions = h('div.pf-drawer-actions', {},
      h('button.itp-btn.outline.small', { type: 'button', html: `${icon('upload')}<span>Import .gpl/.hex</span>`, onclick: () => app.importPalette() }),
      h('button.itp-btn.outline.small', { type: 'button', html: `${icon('palette')}<span>Lospec</span>`, onclick: () => app.lospecDialog() }));
    const yours = mine.length ? [
      h('div.itp-group', {}, h('span', { text: 'Your Palettes' }), h('span.itp-badge', { text: String(mine.length) })),
      h('ul.itp-pal-list', {}, ...mine.map(p => palRow(p, s.source === 'custom' && s.name === p.name, true))),
    ] : [];
    render(body,
      !q() ? buildHarmonyBox() : null,
      actions,
      ...yours,
      h('div.itp-group', {}, h('span', { text: 'Hardware & Artist Library' }), h('span.itp-badge', { text: String(built.length) })),
      h('ul.itp-pal-list', {}, ...built.map(p => palRow({ ...p, colors: p.colors.map(c => '#' + c) }, s.source === 'builtin' && s.id === p.id, false))));
  }

  function renderTab() {
    filesCount.textContent = app.items.length ? String(app.items.length) : '';
    if (tab === 'files') renderFiles();
    else if (tab === 'presets') renderPresets();
    else renderPalettes();
  }

  return {
    el,
    refresh: renderTab,
    setTab,
    onTabChange(fn) { onTabSwitch = fn; },
    focusFile(item) { if (tab === 'files') body.querySelectorAll('.itp-file-row')[app.items.indexOf(item)]?.focus(); },
    sourceChanged() { thumbs.clear(); thumbGen++; if (tab === 'presets') { renderTab(); refreshThumbs(); } },
    get tab() { return tab; },
  };
}

export function fmtTime(t = 0) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
