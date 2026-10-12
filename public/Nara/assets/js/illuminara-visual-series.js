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
  const switcher = document.querySelector('[data-language-switch]');
  const words = {
    en: { full: 'Full-screen Illuminara artwork', tap: 'Tap image to return to gallery', image: 'Illuminara visual series image', hd: 'HD preview', k: '4K original', load: 'Load 4K original', back: 'Return to HD', saveHd: 'Save HD', saveK: 'Save 4K' },
    sl: { full: 'Celozaslonska slika Illuminare', tap: 'Dotakni se slike za vrnitev v galerijo', image: 'Slika iz Illuminarine vizualne serije', hd: 'Predogled HD', k: 'Izvirnik 4K', load: 'Naloži izvirnik 4K', back: 'Vrni se na HD', saveHd: 'Shrani HD', saveK: 'Shrani 4K' }
  };
  const valid = s => s === 'en' || s === 'sl';
  const get = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const set = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const query = new URLSearchParams(location.search).get('lang');
  const stored = get('nara-daily-lang') || get('nara-daily-language');
  let language = valid(query) ? query : valid(stored) ? stored : 'en';
  let active = 0, quality = 'hd', origin = null, position = null, hadFullscreen = false, lastSwipe = 0;

  function updateViewer() {
    if (!cards.length || !viewer) return;
    const card = cards[active], w = words[language];
    const src = quality === '4k' ? card.dataset['4k'] : card.dataset.hd;
    if (photo.getAttribute('src') !== src) photo.src = src;
    const suffix = language === 'sl' ? 'Sl' : 'En';
    title.textContent = card.dataset['title' + suffix];
    caption.textContent = card.dataset['caption' + suffix];
    photo.alt = w.image + ' ' + String(active + 1).padStart(2, '0') + ': ' + title.textContent;
    counter.textContent = String(active + 1).padStart(2, '0') + ' / ' + cards.length;
    qualityButton.textContent = quality === '4k' ? w.back : w.load;
    qualityButton.setAttribute('aria-pressed', String(quality === '4k'));
    status.textContent = quality === '4k' ? w.k : w.hd;
    download.href = src;
    download.download = src.split('/').pop();
    download.textContent = quality === '4k' ? w.saveK : w.saveHd;
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
    for (const [querySelector, slValue, enValue] of [
      ['meta[name="description"]', 'descriptionSl', 'descriptionEn'],
      ['meta[property="og:title"]', 'ogTitleSl', 'ogTitleEn'],
      ['meta[property="og:description"]', 'ogDescriptionSl', 'ogDescriptionEn']
    ]) {
      const el = document.querySelector(querySelector);
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
  if (!cards.length || !viewer || !surface || !stage) return;

  function go(i) {
    active = (i + cards.length) % cards.length;
    quality = 'hd';
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
    const i = Number(button.dataset.open);
    if (!Number.isInteger(i) || i < 0 || i >= cards.length) return;
    origin = button;
    position = { x: window.scrollX, y: window.scrollY };
    active = i; quality = 'hd'; updateViewer();
    if (!viewer.showModal) { location.href = cards[active].dataset.hd; return; }
    try { viewer.showModal(); } catch { origin = null; position = null; return; }
    root.classList.add('vs-lightbox-open');
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
    quality = quality === 'hd' ? '4k' : 'hd';
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
    origin = null; position = null; hadFullscreen = false;
    try { trigger?.focus({ preventScroll: true }); } catch {}
    if (scroll) requestAnimationFrame(() => window.scrollTo(scroll.x, scroll.y));
  });
  document.addEventListener('keydown', event => {
    if (!viewer.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(active - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(active + 1); }
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
  });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === stage) hadFullscreen = true;
    else if (hadFullscreen) { hadFullscreen = false; dismiss(); }
  });

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
