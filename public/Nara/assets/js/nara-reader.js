(() => {
  'use strict';

  const root = document.documentElement;
  const storageKey = 'nara-reader-scale-v1';
  const scaleLabel = document.querySelector('[data-reader-scale-label]');
  const scaleFloor = 0.76;

  const safeGet = (key, fallback) => {
    try { return localStorage.getItem(key) ?? fallback; }
    catch (_) { return fallback; }
  };

  const safeSet = (key, value) => {
    try { localStorage.setItem(key, value); }
    catch (_) { /* Reader controls still work for this page view. */ }
  };

  let scale = Number(safeGet(storageKey, '1'));
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  const applyScale = () => {
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    scale = Math.max(scaleFloor, Math.round(scale * 100) / 100);
    root.style.setProperty('--reader-scale', String(scale));
    if (scaleLabel) scaleLabel.textContent = `${Math.round(scale * 100)}%`;
    safeSet(storageKey, String(scale));
  };

  const changeScale = (action) => {
    if (action === 'reset') scale = 1;
    else scale += Number(action || 0);
    applyScale();
  };

  document.querySelectorAll('[data-reader-scale]').forEach((button) => {
    button.addEventListener('click', () => changeScale(button.dataset.readerScale));
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (event.key === '+' || event.key === '=') changeScale('0.08');
    if (event.key === '-') changeScale('-0.08');
    if (event.key === '0') changeScale('reset');
  });

  applyScale();

  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    root.style.setProperty('--reading-progress', progress.toFixed(4));
  };

  let progressFrame = 0;
  const requestProgressUpdate = () => {
    if (progressFrame) return;
    progressFrame = requestAnimationFrame(() => {
      progressFrame = 0;
      updateProgress();
    });
  };

  window.addEventListener('scroll', requestProgressUpdate, { passive: true });
  window.addEventListener('resize', requestProgressUpdate);
  updateProgress();

  const sceneLinks = [...document.querySelectorAll('.scene-index a[href^="#scene-"]')];
  const sceneMap = new Map(sceneLinks.map((link) => [link.getAttribute('href')?.slice(1), link]));
  const scenes = [...document.querySelectorAll('.scene[id]')];

  if ('IntersectionObserver' in window && scenes.length && sceneLinks.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      sceneLinks.forEach((link) => link.removeAttribute('aria-current'));
      sceneMap.get(visible.target.id)?.setAttribute('aria-current', 'location');
    }, { rootMargin: '-20% 0px -62% 0px', threshold: [0, 0.15, 0.4] });
    scenes.forEach((scene) => observer.observe(scene));
  }
})();
