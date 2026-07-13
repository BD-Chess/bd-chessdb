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


  const lightboxTriggers = [...document.querySelectorAll('[data-lightbox-image]')];
  if (lightboxTriggers.length) {
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.hidden = true;
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Full-screen scene image');
    lightbox.innerHTML = `
      <div class="image-lightbox__panel">
        <div class="image-lightbox__stage" data-lightbox-close>
          <img class="image-lightbox__image" alt="">
        </div>
        <div class="image-lightbox__bar">
          <p class="image-lightbox__caption"></p>
          <div class="image-lightbox__actions">
            <button class="image-lightbox__button" type="button" data-lightbox-fullscreen aria-label="Use browser full screen">⛶</button>
            <button class="image-lightbox__button" type="button" data-lightbox-close aria-label="Close full-screen image">✕</button>
          </div>
        </div>
      </div>`;
    document.body.append(lightbox);

    const lightboxImage = lightbox.querySelector('.image-lightbox__image');
    const lightboxCaption = lightbox.querySelector('.image-lightbox__caption');
    const closeButton = lightbox.querySelector('button[data-lightbox-close]');
    const fullscreenButton = lightbox.querySelector('[data-lightbox-fullscreen]');
    let lastTrigger = null;

    const closeLightbox = () => {
      if (lightbox.hidden) return;
      lightbox.classList.remove('is-open');
      document.body.classList.remove('lightbox-open');
      window.setTimeout(() => {
        lightbox.hidden = true;
        lightboxImage.removeAttribute('src');
        lastTrigger?.focus({ preventScroll: true });
      }, 170);
    };

    const openLightbox = (trigger) => {
      const sourceImage = trigger.querySelector('img');
      if (!sourceImage) return;
      lastTrigger = trigger;
      lightboxImage.src = sourceImage.currentSrc || sourceImage.src;
      lightboxImage.alt = sourceImage.alt || '';
      lightboxCaption.textContent = trigger.dataset.lightboxCaption || sourceImage.alt || '';
      lightbox.hidden = false;
      document.body.classList.add('lightbox-open');
      requestAnimationFrame(() => lightbox.classList.add('is-open'));
      closeButton?.focus({ preventScroll: true });
    };

    lightboxTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => openLightbox(trigger));
    });

    lightbox.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-lightbox-close]')) {
        closeLightbox();
      }
    });

    fullscreenButton?.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement && lightbox.requestFullscreen) await lightbox.requestFullscreen();
        else if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      } catch (_) { /* The viewport overlay remains available when fullscreen is unsupported. */ }
    });

    document.addEventListener('keydown', (event) => {
      if (!lightbox.hidden && event.key === 'Escape') closeLightbox();
    });
  }

})();
