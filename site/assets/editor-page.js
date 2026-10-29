// Mounts PixelForge Workstation full-screen and supports deep-linking via ?sample=, ?preset=, and ?mode=.
import { mountEditor } from '../../lib/editor/index.js';

const root = document.getElementById('editor');
const params = new URLSearchParams(location.search);
const requestedSample = params.get('sample');
const requestedPreset = params.get('preset');
const requestedMode = params.get('mode');

mountEditor(root, {
  homeHref: '../',
  initialSample: requestedSample || 'mountain-fjord',
  forceSample: Boolean(requestedSample),
})
  .then(editor => {
    window.pfStudio = editor;
    if (requestedPreset && !/[#&]s=/.test(location.hash)) {
      editor.applyPreset(requestedPreset);
    }
    if (requestedMode && ['single', 'split', 'dual', 'quad', 'tile'].includes(requestedMode)) {
      editor.setViewMode(requestedMode);
    }
  })
  .catch(err => {
    root.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'editor-boot err';
    p.textContent = `PixelForge Workstation could not start: ${err.message}. Try a current version of Chrome, Edge, Firefox, or Safari.`;
    root.append(p);
  });
