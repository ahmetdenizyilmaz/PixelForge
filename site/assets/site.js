// Shared PixelForge website behaviour: theme persistence, copy buttons, docs drawer, and code tabs.
(function () {
  var root = document.documentElement;
  function current() {
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }
  function paint() {
    var dark = current() === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      b.innerHTML = dark
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z"/></svg>';
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('.theme-toggle');
    if (t) {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('pf:theme', JSON.stringify(next)); } catch (_) { /* storage off */ }
      paint();
      document.dispatchEvent(new CustomEvent('pf:theme', { detail: next }));
      return;
    }
    var tab = e.target.closest('[data-code-tab]');
    if (tab) {
      var box = tab.closest('[data-code-switcher]');
      if (box) {
        var key = tab.getAttribute('data-code-tab');
        box.querySelectorAll('[data-code-tab]').forEach(function (btn) {
          btn.setAttribute('aria-selected', String(btn === tab));
        });
        box.querySelectorAll('[data-code-pane]').forEach(function (pane) {
          pane.hidden = pane.getAttribute('data-code-pane') !== key;
        });
      }
      return;
    }
    var c = e.target.closest('figure.code .copy, [data-copy]');
    if (c) {
      var text = c.dataset.copy || (c.closest('figure') && c.closest('figure').querySelector('code').innerText) || '';
      if (!text) return;
      navigator.clipboard.writeText(text).then(function () {
        var old = c.textContent;
        c.textContent = 'Copied!';
        setTimeout(function () { c.textContent = old; }, 1200);
      });
      return;
    }
    var m = e.target.closest('.docs-menu');
    if (m) {
      var nav = document.getElementById('docs-nav');
      if (nav) {
        var open = nav.classList.toggle('open');
        m.setAttribute('aria-expanded', String(open));
      }
    }
  });
  paint();
})();
