(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'nara-reader-scale-v1';
  const min = 0.88;
  const max = 1.42;
  const step = 0.09;
  const mobileBase = window.matchMedia('(max-width: 700px)').matches ? 1.08 : 1;

  let scale = Number.parseFloat(localStorage.getItem(key));
  if (!Number.isFinite(scale)) scale = mobileBase;
  scale = Math.max(min, Math.min(max, scale));

  const labels = [...document.querySelectorAll('[data-font-label]')];
  const apply = () => {
    root.style.setProperty('--reader-scale', String(scale));
    labels.forEach(el => { el.textContent = `${Math.round(scale * 100)}%`; });
    localStorage.setItem(key, String(scale));
  };

  document.querySelectorAll('[data-font-dec]').forEach(btn => btn.addEventListener('click', () => {
    scale = Math.max(min, +(scale - step).toFixed(2));
    apply();
  }));
  document.querySelectorAll('[data-font-inc]').forEach(btn => btn.addEventListener('click', () => {
    scale = Math.min(max, +(scale + step).toFixed(2));
    apply();
  }));
  document.querySelectorAll('[data-font-reset]').forEach(btn => btn.addEventListener('click', () => {
    scale = mobileBase;
    apply();
  }));
  apply();

  const progress = document.querySelector('[data-reading-progress]');
  if (progress) {
    const updateProgress = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      const pct = total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 0;
      progress.style.width = `${pct}%`;
    };
    updateProgress();
    addEventListener('scroll', updateProgress, {passive:true});
    addEventListener('resize', updateProgress);
  }

  document.querySelectorAll('[data-current-year]').forEach(el => {
    el.textContent = String(new Date().getFullYear());
  });
})();
