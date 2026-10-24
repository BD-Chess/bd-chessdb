(() => {
  'use strict';
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const system = matchMedia('(prefers-color-scheme: light)');
  let preference;
  try { preference = localStorage.getItem('ai8-news-theme'); } catch (_) { /* System theme remains available. */ }
  if (!['light', 'dark'].includes(preference)) preference = null;
  function render() {
    const light = preference ? preference === 'light' : system.matches;
    root.dataset.theme = light ? 'light' : 'dark';
    toggle.textContent = light ? 'Temni način' : 'Svetli način';
    toggle.setAttribute('aria-pressed', String(light));
    document.querySelector('meta[name="theme-color"]').content = light ? '#f4f6f8' : '#0a111c';
  }
  render();
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    preference = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('ai8-news-theme', preference); } catch (_) { /* Toggle works without storage. */ }
    render();
  });
  system.addEventListener('change', render);
})();
