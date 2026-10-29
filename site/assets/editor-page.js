// The /editor/ page: mount PixelForge Studio full-screen and open a scenic view photo on first launch.
import { mountEditor } from '../../lib/editor/index.js';

const root = document.getElementById('editor');
const requestedSample = new URLSearchParams(location.search).get('sample');

mountEditor(root, { homeHref: '../', initialSample: requestedSample || 'mountain-fjord', forceSample: Boolean(requestedSample) })
  .then(editor => {
    window.pfStudio = editor;
    window.itpEditor = editor;
  })
  .catch(err => {
    root.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'editor-boot err';
    p.textContent = `PixelForge Studio could not start: ${err.message}. Try a current version of Chrome, Edge, Firefox or Safari.`;
    root.append(p);
  });
