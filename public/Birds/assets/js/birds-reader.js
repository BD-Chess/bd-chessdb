(() => {
  'use strict';
  const root = document.documentElement;
  const storageKey = 'birds-reader-scale-v1';
  const label = document.querySelector('[data-reader-scale-label]');
  const floor = 0.76;
  const safeGet = (k, f) => { try { return localStorage.getItem(k) ?? f; } catch (_) { return f; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  let scale = Number(safeGet(storageKey, '1'));
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  const apply = () => {
    scale = Math.max(floor, Math.round(scale * 100) / 100);
    root.style.setProperty('--reader-scale', String(scale));
    if (label) label.textContent = `${Math.round(scale * 100)}%`;
    safeSet(storageKey, String(scale));
  };
  document.querySelectorAll('[data-reader-scale]').forEach((b) => b.addEventListener('click', () => {
    const action = b.dataset.readerScale;
    scale = action === 'reset' ? 1 : scale + Number(action || 0);
    apply();
  }));
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const t = event.target;
    if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (event.key === '+' || event.key === '=') scale += .08;
    else if (event.key === '-') scale -= .08;
    else if (event.key === '0') scale = 1;
    else return;
    apply();
  });
  apply();

  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    root.style.setProperty('--reading-progress', p.toFixed(4));
  };
  let frame = 0;
  const requestUpdate = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; updateProgress(); });
  };
  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate);
  updateProgress();

  document.querySelectorAll('[data-fallback-image]').forEach((box) => {
    const img = box.querySelector('img');
    if (!img) return;
    const loaded = () => { box.classList.remove('is-missing'); box.classList.add('has-artwork'); };
    const missing = () => { box.classList.remove('has-artwork'); box.classList.add('is-missing'); };
    img.addEventListener('load', loaded);
    img.addEventListener('error', missing);
    if (img.complete) (img.naturalWidth > 0 ? loaded : missing)();
  });
})();
