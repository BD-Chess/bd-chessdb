(() => {
  'use strict';

  const triggers = [...document.querySelectorAll('[data-hybrid-toggle]')];
  const modeButtons = [...document.querySelectorAll('[data-hybrid-mode-btn]')];
  if (!triggers.length) return;

  const portraitMq = typeof window.matchMedia === 'function'
    ? window.matchMedia('(orientation: portrait)')
    : { matches: window.innerHeight > window.innerWidth, addEventListener: null, addListener: null };

  const isPortrait = () => Boolean(
    portraitMq && typeof portraitMq.matches === 'boolean'
      ? portraitMq.matches
      : window.innerHeight > window.innerWidth
  );

  const syncGlobalButtons = () => {
    const allImages = triggers.every((btn) => btn.dataset.activeMedia !== 'video');
    const allVideos = triggers.every((btn) => btn.dataset.activeMedia === 'video');
    modeButtons.forEach((btn) => {
      const target = btn.dataset.hybridModeBtn;
      const active = (target === 'images' && allImages) || (target === 'videos' && allVideos);
      btn.classList.toggle('gold', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  const applyPanelState = (btn, mode) => {
    const targetMode = mode === 'video' ? 'video' : 'image';
    const picture = btn.querySelector('picture');
    const video = btn.querySelector('video.story-video');
    btn.dataset.activeMedia = targetMode;

    if (!video || !picture) return;

    if (targetMode === 'video') {
      const portrait = isPortrait();
      const nextSrc = portrait ? btn.dataset.videoP : btn.dataset.videoL;
      const nextPoster = portrait ? btn.dataset.posterP : btn.dataset.posterL;
      if (nextPoster && video.getAttribute('poster') !== nextPoster) {
        video.setAttribute('poster', nextPoster);
      }
      video.setAttribute('width', portrait ? '720' : '1280');
      video.setAttribute('height', portrait ? '1280' : '720');
      if (nextSrc && video.getAttribute('src') !== nextSrc) {
        video.setAttribute('src', nextSrc);
        video.load();
      }
      picture.hidden = true;
      video.hidden = false;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else {
      video.pause();
      video.hidden = true;
      picture.hidden = false;
    }
  };

  const setAllMode = (mode) => {
    const target = mode === 'videos' ? 'video' : 'image';
    triggers.forEach((btn) => applyPanelState(btn, target));
    syncGlobalButtons();
  };

  triggers.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextMode = btn.dataset.activeMedia === 'video' ? 'image' : 'video';
      applyPanelState(btn, nextMode);
      syncGlobalButtons();
    });
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setAllMode(btn.dataset.hybridModeBtn === 'videos' ? 'videos' : 'images');
    });
  });

  const handleOrientationChange = () => {
    triggers.forEach((btn) => {
      if (btn.dataset.activeMedia === 'video') {
        applyPanelState(btn, 'video');
      }
    });
  };

  if (typeof portraitMq.addEventListener === 'function') {
    portraitMq.addEventListener('change', handleOrientationChange);
  } else if (typeof portraitMq.addListener === 'function') {
    portraitMq.addListener(handleOrientationChange);
  }
  window.addEventListener('resize', handleOrientationChange, { passive: true });

  const initialMode = new URLSearchParams(window.location.search).get('mode');
  if (initialMode === 'videos' || initialMode === 'images') {
    setAllMode(initialMode);
  } else {
    syncGlobalButtons();
  }
})();
