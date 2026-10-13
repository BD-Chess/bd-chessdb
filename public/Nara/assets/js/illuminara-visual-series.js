(() => {
  'use strict';

  const root = document.documentElement;
  const cards = [...document.querySelectorAll('.vs-card')];
  const viewer = document.getElementById('vs-viewer');
  const stage = document.getElementById('vs-stage');
  const surface = document.getElementById('vs-surface');
  const photo = document.getElementById('vs-viewer-image');
  const title = document.getElementById('vs-viewer-title');
  const caption = document.getElementById('vs-viewer-caption');
  const counter = document.getElementById('vs-counter');
  const qualityButton = document.getElementById('vs-quality');
  const status = document.getElementById('vs-quality-state');
  const download = document.getElementById('vs-download');
  const close = document.getElementById('vs-close');
  const prev = document.getElementById('vs-prev');
  const next = document.getElementById('vs-next');
  const heroImage = document.querySelector('.vs-hero-photo img');
  const switcher = document.querySelector('[data-language-switch]');
  const words = {
    en: {
      full: 'Full-screen Illuminara artwork', tap: 'Tap image to return to gallery',
      image: 'Illuminara visual series image', hd: 'HD', fourK: '4K',
      autoHd: 'AUTO · HD', autoFourK: 'AUTO · 4K',
      toHd: 'Use HD', toFourK: 'Use 4K', toAuto: 'Use AUTO',
      quality: 'Image quality', current: 'Current setting', next: 'Next setting',
      saveHd: 'Save HD', saveFourK: 'Save 4K'
    },
    sl: {
      full: 'Celozaslonska slika Illuminare', tap: 'Dotakni se slike za vrnitev v galerijo',
      image: 'Slika iz Illuminarine vizualne serije', hd: 'HD', fourK: '4K',
      autoHd: 'SAMODEJNO · HD', autoFourK: 'SAMODEJNO · 4K',
      toHd: 'Uporabi HD', toFourK: 'Uporabi 4K', toAuto: 'Uporabi samodejno',
      quality: 'Kakovost slike', current: 'Trenutna nastavitev', next: 'Naslednja nastavitev',
      saveHd: 'Shrani HD', saveFourK: 'Shrani 4K'
    }
  };
  const valid = value => value === 'en' || value === 'sl';
  const get = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const set = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const query = new URLSearchParams(location.search).get('lang');
  const stored = get('nara-daily-lang') || get('nara-daily-language');
  let language = valid(query) ? query : valid(stored) ? stored : 'en';
  const phone = Boolean(navigator.userAgentData?.mobile) ||
    /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(navigator.userAgent || '');
  let orientation = resolveOrientation();
  let active = 0, qualityMode = 'auto', quality = 'hd';
  let origin = null, position = null, lastSwipe = 0, refreshPending = false;

  function resolveOrientation() {
    if (!phone) return 'landscape';
    const portrait = window.matchMedia?.('(orientation: portrait)');
    if (portrait) return portrait.matches ? 'portrait' : 'landscape';
    const type = screen.orientation?.type || '';
    if (type) return type.startsWith('portrait') ? 'portrait' : 'landscape';
    return window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
  }

  function sourceFor(element, selectedQuality, selectedOrientation) {
    const q = selectedQuality === '4k' ? '4k' : 'hd';
    const o = selectedOrientation === 'portrait' ? 'Portrait' : 'Landscape';
    return element?.dataset?.[q + o] || element?.dataset?.[q] || '';
  }

  function dimensions(element, selectedQuality, selectedOrientation) {
    const q = selectedQuality === '4k' ? '4k' : 'hd';
    const o = selectedOrientation === 'portrait' ? 'Portrait' : 'Landscape';
    const width = Number(element?.dataset?.[q + 'Width' + o]);
    const height = Number(element?.dataset?.[q + 'Height' + o]);
    if (width > 0 && height > 0) return { width, height };
    const fallback = selectedOrientation === 'portrait'
      ? { width: 1080, height: 1920 }
      : { width: 1920, height: 1080 };
    const scale = q === '4k' ? 2 : 1;
    return { width: fallback.width * scale, height: fallback.height * scale };
  }

  function containedScale() {
    const size = dimensions(cards[active], 'hd', orientation);
    const rect = surface?.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) {
      const width = window.innerWidth || size.width;
      const height = window.innerHeight || size.height;
      return Math.min(width / size.width, height / size.height) * (window.devicePixelRatio || 1);
    }
    const css = getComputedStyle(surface);
    const width = Math.max(1, rect.width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight));
    const height = Math.max(1, rect.height - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom));
    return Math.min(width / size.width, height / size.height) * (window.devicePixelRatio || 1);
  }

  function chooseQuality() {
    if (qualityMode !== 'auto') return qualityMode;
    const scale = containedScale();
    return scale > (quality === '4k' ? 0.96 : 1.04) ? '4k' : 'hd';
  }

  function updateGalleryOrientation() {
    const heroPath = sourceFor(heroImage, 'hd', orientation);
    if (heroImage && heroPath) {
      const size = dimensions(heroImage, 'hd', orientation);
      if (heroImage.getAttribute('src') !== heroPath) heroImage.src = heroPath;
      heroImage.width = size.width;
      heroImage.height = size.height;
    }
    cards.forEach(card => {
      const preview = card.querySelector('.vs-preview');
      const image = preview?.querySelector('img');
      const path = sourceFor(card, 'hd', orientation);
      if (image && path) {
        const size = dimensions(card, 'hd', orientation);
        if (image.getAttribute('src') !== path) image.src = path;
        image.width = size.width;
        image.height = size.height;
        preview.style.setProperty('--vs-ratio', size.width + ' / ' + size.height);
      }
      card.querySelectorAll('.vs-links a[data-quality]').forEach(link => {
        const linkQuality = link.dataset.quality === '4k' ? '4k' : 'hd';
        const linkPath = sourceFor(card, linkQuality, orientation);
        if (linkPath) {
          link.href = linkPath;
          link.download = linkPath.split('/').pop();
        }
      });
    });
  }

  function updateViewer() {
    if (!cards.length || !viewer) return;
    const card = cards[active], w = words[language];
    quality = chooseQuality();
    const src = sourceFor(card, quality, orientation);
    if (src && photo.getAttribute('src') !== src) photo.src = src;
    const size = dimensions(card, quality, orientation);
    photo.width = size.width;
    photo.height = size.height;
    const suffix = language === 'sl' ? 'Sl' : 'En';
    title.textContent = card.dataset['title' + suffix];
    caption.textContent = card.dataset['caption' + suffix];
    photo.alt = w.image + ' ' + String(active + 1).padStart(2, '0') + ': ' + title.textContent;
    counter.textContent = String(active + 1).padStart(2, '0') + ' / ' + cards.length;

    const current = qualityMode === 'auto'
      ? (quality === '4k' ? w.autoFourK : w.autoHd)
      : (quality === '4k' ? w.fourK : w.hd);
    const nextMode = qualityMode === 'auto' ? 'hd' : qualityMode === 'hd' ? '4k' : 'auto';
    qualityButton.textContent = nextMode === 'hd' ? w.toHd : nextMode === '4k' ? w.toFourK : w.toAuto;
    const nextLabel = nextMode === 'hd' ? w.hd : nextMode === '4k' ? w.fourK : 'AUTO';
    qualityButton.setAttribute('aria-label', w.quality + '. ' + w.current + ': ' + current + '. ' + w.next + ': ' + nextLabel);
    qualityButton.setAttribute('aria-pressed', String(qualityMode !== 'auto'));
    status.textContent = current;

    download.href = src;
    download.download = src.split('/').pop();
    download.textContent = quality === '4k' ? w.saveFourK : w.saveHd;
    viewer.setAttribute('aria-label', w.full);
    surface.setAttribute('aria-label', w.tap);
  }

  function setLanguage(nextLanguage, changeURL) {
    if (!valid(nextLanguage)) return;
    language = nextLanguage;
    root.lang = language;
    document.querySelectorAll('[data-language-content]').forEach(el => {
      el.hidden = el.dataset.languageContent !== language;
    });
    document.querySelectorAll('[data-aria-en]').forEach(el => {
      el.setAttribute('aria-label', language === 'sl' ? el.dataset.ariaSl : el.dataset.ariaEn);
    });
    document.querySelectorAll('[data-alt-en]').forEach(el => {
      el.alt = language === 'sl' ? el.dataset.altSl : el.dataset.altEn;
    });
    switcher?.querySelectorAll('[data-language]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.language === language));
    });
    document.title = language === 'sl' ? root.dataset.titleSl : root.dataset.titleEn;
    for (const [selector, slValue, enValue] of [
      ['meta[name="description"]', 'descriptionSl', 'descriptionEn'],
      ['meta[property="og:title"]', 'ogTitleSl', 'ogTitleEn'],
      ['meta[property="og:description"]', 'ogDescriptionSl', 'ogDescriptionEn']
    ]) {
      const el = document.querySelector(selector);
      if (el) el.content = language === 'sl' ? el.dataset[slValue] : el.dataset[enValue];
    }
    set('nara-daily-lang', language);
    set('nara-daily-language', language);
    if (changeURL) {
      try {
        const url = new URL(location.href);
        url.searchParams.set('lang', language);
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch {}
    }
    if (viewer?.open) updateViewer();
  }

  switcher?.querySelectorAll('[data-language]').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.language, true));
  });
  setLanguage(language, false);
  updateGalleryOrientation();
  if (!cards.length || !viewer || !surface || !stage) return;

  function go(index) {
    active = (index + cards.length) % cards.length;
    updateViewer();
  }

  function dismiss() {
    if (!viewer.open) return;
    viewer.close();
    if (document.fullscreenElement === stage) {
      try { document.exitFullscreen?.()?.catch(() => {}); } catch {}
    }
  }

  function open(button) {
    if (viewer.open) return;
    const index = Number(button.dataset.open);
    if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;
    origin = button;
    position = { x: window.scrollX, y: window.scrollY };
    active = index;
    qualityMode = 'auto';
    quality = 'hd';
    if (!viewer.showModal) {
      location.href = sourceFor(cards[active], 'hd', orientation);
      return;
    }
    try { viewer.showModal(); } catch { origin = null; position = null; return; }
    root.classList.add('vs-lightbox-open');
    const nextOrientation = resolveOrientation();
    if (nextOrientation !== orientation) {
      orientation = nextOrientation;
      updateGalleryOrientation();
    }
    updateViewer();
    close.focus({ preventScroll: true });
    try { stage.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {}); } catch {}
  }

  document.querySelectorAll('[data-open]').forEach(button => {
    button.addEventListener('click', () => open(button));
  });
  surface.addEventListener('click', () => {
    if (Date.now() - lastSwipe > 550) dismiss();
  });
  close.addEventListener('click', dismiss);
  prev.addEventListener('click', () => go(active - 1));
  next.addEventListener('click', () => go(active + 1));
  qualityButton.addEventListener('click', () => {
    qualityMode = qualityMode === 'auto' ? 'hd' : qualityMode === 'hd' ? '4k' : 'auto';
    updateViewer();
  });
  viewer.addEventListener('click', event => {
    if (event.target === viewer) dismiss();
  });
  viewer.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  viewer.addEventListener('close', () => {
    root.classList.remove('vs-lightbox-open');
    photo.removeAttribute('src');
    const trigger = origin, scroll = position;
    origin = null;
    position = null;
    try { trigger?.focus({ preventScroll: true }); } catch {}
    if (scroll) requestAnimationFrame(() => window.scrollTo(scroll.x, scroll.y));
  });
  document.addEventListener('keydown', event => {
    if (!viewer.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(active - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(active + 1); }
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
  });

  function refresh() {
    refreshPending = false;
    const nextOrientation = resolveOrientation();
    const orientationChanged = nextOrientation !== orientation;
    if (orientationChanged) {
      orientation = nextOrientation;
      updateGalleryOrientation();
    }
    if (viewer.open && (orientationChanged || qualityMode === 'auto')) updateViewer();
  }
  function scheduleRefresh() {
    if (refreshPending) return;
    refreshPending = true;
    requestAnimationFrame(refresh);
  }
  window.addEventListener('orientationchange', scheduleRefresh, { passive: true });
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleRefresh, { passive: true });
  screen.orientation?.addEventListener?.('change', scheduleRefresh);
  window.matchMedia?.('(orientation: portrait)').addEventListener?.('change', scheduleRefresh);
  document.addEventListener('fullscreenchange', scheduleRefresh);

  let touchStart = null;
  surface.addEventListener('touchstart', event => {
    if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  surface.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      lastSwipe = Date.now();
      event.preventDefault();
      go(active + (dx < 0 ? 1 : -1));
    }
  }, { passive: false });
  surface.addEventListener('touchcancel', () => { touchStart = null; });
})();