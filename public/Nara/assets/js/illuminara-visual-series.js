(() => {
  'use strict';
  const root = document.documentElement;
  const cards = [...document.querySelectorAll('.vs-card')];
  const byId = id => document.getElementById(id);
  const viewer = byId('vs-viewer'), stage = byId('vs-stage'), surface = byId('vs-surface');
  const photo = byId('vs-viewer-image'), title = byId('vs-viewer-title'), caption = byId('vs-viewer-caption');
  const counter = byId('vs-counter'), qualityButton = byId('vs-quality'), status = byId('vs-quality-state');
  const download = byId('vs-download'), close = byId('vs-close'), prev = byId('vs-prev'), next = byId('vs-next');
  const orientationControl = byId('vs-orientation'), tourStart = byId('vs-tour');
  const tourToggle = byId('vs-tour-toggle'), tourState = byId('vs-tour-state'), cleanToggle = byId('vs-immersive-toggle');
  const switcher = document.querySelector('[data-language-switch]');
  const words = {
    en: {
      full: 'Full-screen Illuminara artwork', tap: 'Click the image to return to the gallery',
      touch: 'Double-tap for a clean image; double-tap again to restore controls',
      cleanReturn: 'Double-tap or press Escape to restore controls',
      tourTouch: 'Tap to show the tour controls; double-tap for a clean image',
      image: 'Illuminara visual series image', hd: 'HD', fourK: '4K', autoHd: 'AUTO · HD', autoFourK: 'AUTO · 4K',
      toHd: 'Use HD', toFourK: 'Use 4K', toAuto: 'Use AUTO', quality: 'Quality',
      saveHd: 'Save HD', saveFourK: 'Save 4K', loading: 'Loading artwork…',
      failed: 'This artwork could not load. Try again or continue to the next image.',
      retry: 'Try again', fallback: '4K unavailable · HD shown',
      composition: 'Composition', auto: 'Automatic', landscape: 'Landscape', portrait: 'Portrait',
      play: 'Play tour', pause: 'Pause tour', playing: 'Cinematic tour', paused: 'Tour paused',
      ended: 'Journey complete', reduced: 'Tour paused · reduced motion', clean: 'Clean view',
      controls: 'Show controls', of: 'of'
    },
    sl: {
      full: 'Celozaslonska slika Illuminare', tap: 'Klikni sliko za vrnitev v galerijo',
      touch: 'Dvakrat tapni za čisto sliko; z naslednjim dvojnim tapom znova prikažeš kontrole',
      cleanReturn: 'Dvakrat tapni ali pritisni Escape za ponovni prikaz kontrol',
      tourTouch: 'Tapni za prikaz kontrol ogleda; dvakrat tapni za čisto sliko',
      image: 'Slika iz Illuminarine vizualne serije', hd: 'HD', fourK: '4K',
      autoHd: 'AUTO · HD', autoFourK: 'AUTO · 4K', toHd: 'Uporabi HD', toFourK: 'Uporabi 4K', toAuto: 'Uporabi AUTO',
      quality: 'Kakovost', saveHd: 'Shrani HD', saveFourK: 'Shrani 4K', loading: 'Nalagam sliko…',
      failed: 'Slike ni bilo mogoče naložiti. Poskusi znova ali nadaljuj na naslednjo.',
      retry: 'Poskusi znova', fallback: '4K ni na voljo · prikazan HD',
      composition: 'Kompozicija', auto: 'Samodejno', landscape: 'Ležeče', portrait: 'Pokončno',
      play: 'Predvajaj ogled', pause: 'Ustavi ogled', playing: 'Filmski ogled', paused: 'Ogled ustavljen',
      ended: 'Potovanje zaključeno', reduced: 'Ogled ustavljen · zmanjšano gibanje', clean: 'Čisti pogled',
      controls: 'Prikaži kontrole', of: 'od'
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
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const reducedMotion = () => Boolean(motion?.matches);
  let galleryOrientation = resolveAutomaticOrientation();
  let orientationMode = 'auto', qualityMode = 'auto', active = 0;
  let displayed = null, requestedKey = '', loadToken = 0, pendingLoad = null;
  let origin = null, position = null, refreshPending = false, immersive = false;
  let tour = false, playing = false, tourEnded = false, tourTimer = null, hideTimer = null;
  let outgoingTimer = null, lastSwipe = 0, pendingTap = null, pendingDismiss = null, suppressClickUntil = 0;
  let touchStart = null, preload = null, preloadKey = '';
  const TOUR_MS = 8000;
  let outgoing = null, message = null, messageText = null, retry = null;
  let savedFocus = null;

  function resolveAutomaticOrientation() {
    if (!phone) return 'landscape';
    const portrait = window.matchMedia?.('(orientation: portrait)');
    if (portrait) return portrait.matches ? 'portrait' : 'landscape';
    const type = screen.orientation?.type || '';
    return type ? (type.startsWith('portrait') ? 'portrait' : 'landscape') :
      (window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape');
  }
  function selectedOrientation() { return orientationMode === 'auto' ? galleryOrientation : orientationMode; }
  function sourceFor(element, q, o) {
    const suffix = o === 'portrait' ? 'Portrait' : 'Landscape';
    return element?.dataset?.[(q === '4k' ? '4k' : 'hd') + suffix] || element?.dataset?.[q] || '';
  }
  function dimensions(element, q, o) {
    const key = q === '4k' ? '4k' : 'hd', suffix = o === 'portrait' ? 'Portrait' : 'Landscape';
    const width = Number(element?.dataset?.[key + 'Width' + suffix]), height = Number(element?.dataset?.[key + 'Height' + suffix]);
    if (width > 0 && height > 0) return { width, height };
    const scale = q === '4k' ? 2 : 1;
    return o === 'portrait' ? { width: 1080 * scale, height: 1920 * scale } : { width: 1920 * scale, height: 1080 * scale };
  }
  function constrainedNetwork() {
    return Boolean(connection?.saveData) || /(^|-)2g$|^3g$/.test(connection?.effectiveType || '') ||
      (typeof connection?.downlink === 'number' && connection.downlink > 0 && connection.downlink < 1.5);
  }
  function chooseQuality(o) {
    if (qualityMode !== 'auto') return qualityMode;
    if (constrainedNetwork()) return 'hd';
    const size = dimensions(cards[active], 'hd', o);
    const rect = surface?.getBoundingClientRect();
    const css = surface ? getComputedStyle(surface) : {};
    const width = Math.max(1, (rect?.width || window.innerWidth) - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0));
    const height = Math.max(1, (rect?.height || window.innerHeight) - (parseFloat(css.paddingTop) || 0) - (parseFloat(css.paddingBottom) || 0));
    const scale = Math.min(width / size.width, height / size.height) * (window.devicePixelRatio || 1);
    const same = displayed?.index === active && displayed?.orientation === o;
    return scale > (same && displayed.quality === '4k' ? 0.96 : 1.04) ? '4k' : 'hd';
  }
  function updateGalleryOrientation() {
    // Both hero compositions stay visible; gallery thumbnails follow the phone.
    document.querySelectorAll('.vs-hero-photo img').forEach(image => {
      if (image.dataset.heroComposition) return;
      const o = galleryOrientation;
      const src = sourceFor(image, 'hd', o), size = dimensions(image, 'hd', o);
      if (src && image.getAttribute('src') !== src) image.src = src;
      image.width = size.width; image.height = size.height;
    });
    cards.forEach(card => {
      const preview = card.querySelector('.vs-preview'), image = preview?.querySelector('img');
      const src = sourceFor(card, 'hd', galleryOrientation), size = dimensions(card, 'hd', galleryOrientation);
      if (image && src) {
        if (image.getAttribute('src') !== src) image.src = src;
        image.width = size.width; image.height = size.height;
        preview.style.setProperty('--vs-ratio', size.width + ' / ' + size.height);
      }
      card.querySelectorAll('.vs-links a[data-quality]').forEach(link => {
        const q = link.dataset.quality === '4k' ? '4k' : 'hd', path = sourceFor(card, q, galleryOrientation);
        if (path) { link.href = path; link.download = path.split('/').pop(); }
      });
    });
  }
  function updateState() {
    if (!stage) return;
    stage.dataset.orientationMode = orientationMode;
    stage.dataset.qualityMode = qualityMode;
    stage.dataset.activeIndex = String(active);
    stage.dataset.orientation = displayed?.orientation || '';
    stage.dataset.quality = displayed?.quality || '';
    stage.dataset.tour = tour ? (playing ? 'playing' : tourEnded ? 'ended' : 'paused') : 'off';
    stage.dataset.loading = String(Boolean(pendingLoad));
  }
  function setOverlayHidden(hidden) {
    const overlays = viewer.querySelectorAll('.vs-viewer-top,.vs-viewer-foot,#vs-prev,#vs-next');
    if (hidden && !savedFocus) savedFocus = document.activeElement;
    // Focus moves before the containing overlay becomes inert.
    if (hidden) surface.focus({ preventScroll: true });
    overlays.forEach(el => { el.inert = hidden; if (hidden) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); });
    if (!hidden && savedFocus) {
      const focus = savedFocus; savedFocus = null;
      try { if (focus?.isConnected && viewer.contains(focus)) focus.focus({ preventScroll: true }); } catch {}
    }
  }
  function syncOverlays() { setOverlayHidden(immersive || viewer.classList.contains('vs-tour-controls-hidden')); }
  function showControls() {
    clearTimeout(hideTimer); hideTimer = null;
    viewer.classList.remove('vs-tour-controls-hidden');
    syncOverlays();
    if (tour && playing && !immersive && !document.hidden) {
      hideTimer = setTimeout(() => {
        hideTimer = null;
        // Never hide controls while a visitor is using one with the keyboard.
        if (!viewer.open || !playing || immersive || (document.activeElement !== surface && viewer.contains(document.activeElement))) return;
        viewer.classList.add('vs-tour-controls-hidden'); syncOverlays();
      }, 3200);
    }
  }
  function renderControls() {
    if (!viewer || !cards.length) return;
    const w = words[language];
    orientationControl?.setAttribute('aria-label', w.composition);
    orientationControl?.querySelectorAll('[data-orientation]').forEach(button => {
      const mode = button.dataset.orientation;
      button.setAttribute('aria-pressed', String(mode === orientationMode));
      button.setAttribute('aria-label', w[mode === 'auto' ? 'auto' : mode] + ' · ' + w.composition);
      button.title = w[mode === 'auto' ? 'auto' : mode];
    });
    const nextMode = qualityMode === 'auto' ? 'hd' : qualityMode === 'hd' ? '4k' : 'auto';
    qualityButton.textContent = nextMode === 'hd' ? w.toHd : nextMode === '4k' ? w.toFourK : w.toAuto;
    qualityButton.setAttribute('aria-pressed', String(qualityMode !== 'auto'));
    qualityButton.setAttribute('aria-label', w.quality + ': ' + qualityMode.toUpperCase() + '. ' + qualityButton.textContent);
    if (tourToggle) {
      tourToggle.textContent = playing ? 'Ⅱ ' + w.pause : '▶ ' + w.play;
      tourToggle.setAttribute('aria-label', playing ? w.pause : w.play);
      tourToggle.setAttribute('aria-pressed', String(playing));
    }
    if (tourState) {
      tourState.hidden = !tour;
      tourState.textContent = tourEnded ? w.ended : playing ? w.playing : reducedMotion() ? w.reduced : w.paused;
    }
    if (cleanToggle) {
      cleanToggle.textContent = '◇ ' + w.clean;
      cleanToggle.setAttribute('aria-pressed', String(immersive));
      cleanToggle.setAttribute('aria-label', immersive ? w.controls : w.clean);
    }
    viewer.setAttribute('aria-label', w.full);
    surface.setAttribute('aria-label', immersive ? w.cleanReturn : tour ? w.tourTouch : phone ? w.touch : w.tap);
    if (messageText) messageText.textContent = w.failed;
    if (retry) retry.textContent = w.retry;
    if (stage.classList.contains('vs-image-error')) {
      status.textContent = w.failed;
      const card = cards[active], suffix = language === 'sl' ? 'Sl' : 'En';
      title.textContent = card.dataset['title' + suffix] || ''; caption.textContent = '';
      counter.textContent = String(active + 1).padStart(2, '0') + ' / ' + cards.length;
      download.setAttribute('aria-disabled', 'true'); download.setAttribute('tabindex', '-1');
    } else if (displayed) renderArtworkText();
    else if (pendingLoad) { status.textContent = w.loading; counter.textContent = String(active + 1).padStart(2, '0') + ' / ' + cards.length; }
    if (pendingLoad) {
      status.textContent = w.loading;
      download.setAttribute('aria-disabled', 'true'); download.setAttribute('tabindex', '-1');
    }
    updateState();
  }
  function renderArtworkText() {
    if (!displayed) return;
    const w = words[language], card = cards[displayed.index], suffix = language === 'sl' ? 'Sl' : 'En';
    title.textContent = card.dataset['title' + suffix] || '';
    caption.textContent = card.dataset['caption' + suffix] || '';
    photo.alt = w.image + ' ' + String(displayed.index + 1).padStart(2, '0') + ': ' + title.textContent;
    counter.textContent = String(displayed.index + 1).padStart(2, '0') + ' / ' + cards.length;
    download.href = displayed.src;
    download.download = displayed.src.split('/').pop();
    download.textContent = displayed.quality === '4k' ? w.saveFourK : w.saveHd;
    download.removeAttribute('aria-disabled'); download.removeAttribute('tabindex');
    status.textContent = displayed.fallback ? w.fallback : qualityMode === 'auto' ?
      (displayed.quality === '4k' ? w.autoFourK : w.autoHd) : displayed.quality === '4k' ? w.fourK : w.hd;
  }
  function clearTourTimer() { clearTimeout(tourTimer); tourTimer = null; }
  function cancelLoad() { pendingLoad?.cancel(); pendingLoad = null; }
  function loadImage(src) {
    return new Promise(resolve => {
      const image = new Image(); image.decoding = 'async';
      let done = false, timer = null;
      const settle = ok => {
        if (done) return; done = true; clearTimeout(timer);
        image.onload = null; image.onerror = null;
        resolve(ok ? image : null);
      };
      pendingLoad = { image, cancel: () => { settle(false); image.removeAttribute('src'); } };
      image.onload = async () => {
        try { if (image.decode) await image.decode(); } catch { settle(false); return; }
        settle(image.naturalWidth > 0);
      };
      image.onerror = () => settle(false);
      timer = setTimeout(() => settle(false), 18000);
      image.src = src;
      if (image.complete && image.naturalWidth > 0) image.onload();
    });
  }
  function scheduleTour() {
    clearTourTimer();
    if (!tour || !playing || document.hidden || !viewer.open || pendingLoad || !displayed || displayed.index !== active) return;
    tourTimer = setTimeout(() => {
      tourTimer = null;
      if (!tour || !playing || document.hidden) return;
      if (active === cards.length - 1) { tourEnded = true; pauseTour(); return; }
      go(active + 1);
    }, TOUR_MS);
  }
  function cancelPreload() {
    if (preload) { preload.onload = null; preload.onerror = null; preload.removeAttribute('src'); }
    preload = null; preloadKey = '';
  }
  function prefetchNext() {
    if (!viewer.open || document.hidden || constrainedNetwork() || !displayed || displayed.index === cards.length - 1) {
      cancelPreload(); return;
    }
    const card = cards[displayed.index + 1], src = sourceFor(card, 'hd', selectedOrientation());
    if (!src || src === preloadKey) return;
    cancelPreload();
    preloadKey = src; preload = new Image(); preload.decoding = 'async';
    preload.src = src;
  }
  async function updateViewer(force = false) {
    if (!viewer.open || !cards.length || document.hidden) return;
    const o = selectedOrientation(), desired = chooseQuality(o);
    const src = sourceFor(cards[active], desired, o);
    const key = active + ':' + o + ':' + desired;
    if (!force && requestedKey === key && (pendingLoad || (displayed && displayed.index === active && displayed.orientation === o))) {
      renderControls(); return;
    }
    requestedKey = key;
    const token = ++loadToken, index = active;
    cancelLoad(); clearTourTimer();
    stage.classList.add('vs-loading'); stage.classList.remove('vs-image-error');
    surface.setAttribute('aria-busy', 'true');
    message.hidden = true;
    download.setAttribute('aria-disabled', 'true'); download.setAttribute('tabindex', '-1');
    status.textContent = words[language].loading;
    renderControls();
    // renderControls preserves the old artwork's true metadata; mark it busy until the new frame commits.
    status.textContent = words[language].loading;
    let actual = desired, fallback = false, finalSrc = src;
    const load = loadImage(src);
    updateState();
    let image = await load;
    if (token !== loadToken || !viewer.open) return;
    if (!image && desired === '4k') {
      actual = 'hd'; fallback = true; finalSrc = sourceFor(cards[index], 'hd', o);
      image = await loadImage(finalSrc);
    }
    if (token !== loadToken || !viewer.open) return;
    pendingLoad = null;
    stage.classList.remove('vs-loading'); surface.setAttribute('aria-busy', 'false');
    if (!image) {
      stage.classList.add('vs-image-error'); message.hidden = false;
      status.textContent = words[language].failed;
      download.setAttribute('aria-disabled', 'true'); download.setAttribute('tabindex', '-1');
      if (displayed?.index !== index) { photo.hidden = true; outgoing.hidden = true; }
      pauseTour(); updateState(); return;
    }
    clearTimeout(outgoingTimer);
    const previousSrc = photo.getAttribute('src');
    const animate = previousSrc && previousSrc !== finalSrc && !reducedMotion() && !immersive;
    if (animate) {
      outgoing.src = previousSrc; outgoing.width = photo.width; outgoing.height = photo.height;
      outgoing.hidden = false; outgoing.classList.add('vs-photo-ready');
    } else { outgoing.hidden = true; outgoing.removeAttribute('src'); }
    photo.classList.remove('vs-photo-ready');
    photo.src = finalSrc; photo.hidden = false;
    const size = dimensions(cards[index], actual, o);
    photo.width = size.width; photo.height = size.height;
    displayed = { index, orientation: o, quality: actual, src: finalSrc, fallback };
    // decode has completed before replacing the visible image, so slow networks never show an empty frame.
    if (animate) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (token !== loadToken || !viewer.open) return;
        photo.classList.add('vs-photo-ready'); outgoing.classList.remove('vs-photo-ready');
      }));
      outgoingTimer = setTimeout(() => { outgoing.hidden = true; outgoing.removeAttribute('src'); }, 650);
    } else photo.classList.add('vs-photo-ready');
    renderControls(); updateState();
    prefetchNext(); scheduleTour();
  }
  function setLanguage(value, changeURL) {
    if (!valid(value)) return;
    language = value; root.lang = value;
    document.querySelectorAll('[data-language-content]').forEach(el => { el.hidden = el.dataset.languageContent !== value; });
    document.querySelectorAll('[data-aria-en]').forEach(el => { el.setAttribute('aria-label', value === 'sl' ? el.dataset.ariaSl : el.dataset.ariaEn); });
    document.querySelectorAll('[data-alt-en]').forEach(el => { el.alt = value === 'sl' ? el.dataset.altSl : el.dataset.altEn; });
    switcher?.querySelectorAll('[data-language]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.language === value)));
    document.title = value === 'sl' ? root.dataset.titleSl : root.dataset.titleEn;
    for (const [selector, slKey, enKey] of [
      ['meta[name="description"]', 'descriptionSl', 'descriptionEn'],
      ['meta[property="og:title"]', 'ogTitleSl', 'ogTitleEn'],
      ['meta[property="og:description"]', 'ogDescriptionSl', 'ogDescriptionEn']
    ]) {
      const el = document.querySelector(selector);
      if (el) el.content = value === 'sl' ? el.dataset[slKey] : el.dataset[enKey];
    }
    set('nara-daily-lang', value); set('nara-daily-language', value);
    if (changeURL) {
      try { const url = new URL(location.href); url.searchParams.set('lang', value); history.replaceState(null, '', url.pathname + url.search + url.hash); } catch {}
    }
    if (viewer?.open) renderControls();
  }
  switcher?.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language, true)));
  setLanguage(language, false); updateGalleryOrientation();
  if (!cards.length || !viewer || !stage || !surface || !photo) return;
  outgoing = document.createElement('img'); outgoing.className = 'vs-photo-layer vs-photo-outgoing';
  outgoing.alt = ''; outgoing.setAttribute('aria-hidden', 'true'); outgoing.hidden = true;
  surface.appendChild(outgoing); photo.classList.add('vs-photo-layer', 'vs-photo-incoming');
  message = document.createElement('span'); message.id = 'vs-image-message'; message.hidden = true;
  message.setAttribute('role', 'status'); messageText = document.createElement('span');
  retry = document.createElement('button'); retry.type = 'button';
  message.appendChild(messageText); message.appendChild(retry); stage.appendChild(message);
  retry.addEventListener('click', event => { event.stopPropagation(); updateViewer(true); });
  download.addEventListener('click', event => { if (download.getAttribute('aria-disabled') === 'true') event.preventDefault(); });

  function clearPendingTap() {
    clearTimeout(pendingDismiss); pendingDismiss = null; pendingTap = null;
  }
  function requestFullscreen() {
    if (!document.fullscreenElement) {
      try { stage.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {}); } catch {}
    }
  }
  function setImmersive(enabled) {
    if (!viewer.open) return;
    clearPendingTap(); immersive = enabled;
    viewer.classList.toggle('vs-immersive', enabled);
    if (enabled) { clearTimeout(hideTimer); viewer.classList.remove('vs-tour-controls-hidden'); surface.focus({ preventScroll: true }); requestFullscreen(); }
    else showControls();
    syncOverlays(); renderControls(); scheduleRefresh();
  }
  function pauseTour() {
    playing = false; clearTourTimer(); showControls(); renderControls(); updateState();
  }
  function playTour() {
    if (!viewer.open || document.hidden) return;
    tour = true; tourEnded = false; viewer.classList.add('vs-tour'); playing = true;
    renderControls(); surface.focus({ preventScroll: true }); showControls();
    if (displayed?.index === active && !pendingLoad) scheduleTour();
    else updateViewer();
  }
  function open(button, isTour = false) {
    if (viewer.open) return;
    const index = isTour ? 0 : Number(button.dataset.open);
    if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;
    origin = button; position = { x: window.scrollX, y: window.scrollY };
    active = index; qualityMode = 'auto'; orientationMode = button.dataset.heroComposition || 'auto';
    galleryOrientation = resolveAutomaticOrientation();
    tour = isTour; playing = isTour && !reducedMotion(); tourEnded = false;
    immersive = false; displayed = null; requestedKey = ''; savedFocus = null;
    viewer.classList.remove('vs-immersive', 'vs-tour-controls-hidden');
    viewer.classList.toggle('vs-tour', tour);
    photo.hidden = false;
    clearPendingTap(); suppressClickUntil = 0;
    if (!viewer.showModal) { location.href = sourceFor(cards[index], 'hd', selectedOrientation()); return; }
    try { viewer.showModal(); } catch { origin = null; position = null; return; }
    root.classList.add('vs-lightbox-open'); syncOverlays();
    title.textContent = ''; caption.textContent = '';
    updateGalleryOrientation(); updateViewer();
    if (tour) { surface.focus({ preventScroll: true }); showControls(); }
    else close.focus({ preventScroll: true });
    requestFullscreen();
  }
  function go(index) {
    if (!viewer.open) return;
    clearPendingTap(); tourEnded = false;
    active = tour ? Math.max(0, Math.min(cards.length - 1, index)) : (index + cards.length) % cards.length;
    updateViewer();
    if (!immersive) showControls();
  }
  function dismiss() {
    if (!viewer.open) return;
    viewer.close();
    if (document.fullscreenElement === stage) { try { document.exitFullscreen?.()?.catch(() => {}); } catch {} }
  }
  function cleanup() {
    ++loadToken; requestedKey = ''; cancelLoad(); cancelPreload();
    clearTourTimer(); clearPendingTap(); clearTimeout(hideTimer); clearTimeout(outgoingTimer);
    hideTimer = null; outgoingTimer = null; suppressClickUntil = 0; immersive = false; tour = false; playing = false;
    viewer.classList.remove('vs-immersive', 'vs-tour', 'vs-tour-controls-hidden');
    stage.classList.remove('vs-loading', 'vs-image-error'); surface.setAttribute('aria-busy', 'false');
    syncOverlays(); savedFocus = null;
    root.classList.remove('vs-lightbox-open'); photo.removeAttribute('src'); outgoing.removeAttribute('src');
    outgoing.hidden = true; message.hidden = true; displayed = null;
    const trigger = origin, scroll = position; origin = null; position = null;
    try { trigger?.focus({ preventScroll: true }); } catch {}
    if (scroll) requestAnimationFrame(() => window.scrollTo(scroll.x, scroll.y));
    updateState();
  }
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => open(button)));
  tourStart?.addEventListener('click', () => open(tourStart, true));
  tourToggle?.addEventListener('click', () => playing ? pauseTour() : playTour());
  cleanToggle?.addEventListener('click', () => setImmersive(!immersive));
  orientationControl?.querySelectorAll('[data-orientation]').forEach(button => {
    button.addEventListener('click', () => {
      orientationMode = button.dataset.orientation;
      if (!['auto', 'landscape', 'portrait'].includes(orientationMode)) orientationMode = 'auto';
      showControls(); updateViewer();
    });
  });
  qualityButton.addEventListener('click', () => {
    qualityMode = qualityMode === 'auto' ? 'hd' : qualityMode === 'hd' ? '4k' : 'auto';
    showControls(); updateViewer();
  });
  close.addEventListener('click', dismiss);
  prev.addEventListener('click', () => go(active - 1)); next.addEventListener('click', () => go(active + 1));
  viewer.addEventListener('click', event => { if (event.target === viewer && !immersive) dismiss(); });
  viewer.addEventListener('cancel', event => {
    event.preventDefault(); if (immersive) setImmersive(false); else dismiss();
  });
  viewer.addEventListener('close', cleanup);
  // Touch recognizer keeps the original single-tap close, swipe, and phone-only double-tap contract.
  surface.addEventListener('click', event => {
    if (event.target === retry || Date.now() < suppressClickUntil || immersive || Date.now() - lastSwipe < 550) return;
    if (tour) { showControls(); return; }
    if (phone) {
      clearTimeout(pendingDismiss);
      pendingDismiss = setTimeout(() => { pendingDismiss = null; pendingTap = null; if (viewer.open && !immersive && !tour) dismiss(); }, 380);
    } else dismiss();
  });
  viewer.addEventListener('touchstart', event => { if (!surface.contains(event.target)) clearPendingTap(); }, { capture: true, passive: true });
  surface.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  surface.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const point = event.changedTouches[0], dx = point.clientX - touchStart.x, dy = point.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      lastSwipe = Date.now(); clearPendingTap(); event.preventDefault(); go(active + (dx < 0 ? 1 : -1)); return;
    }
    if (!phone || !viewer.open || Math.abs(dx) > 28 || Math.abs(dy) > 28) { clearPendingTap(); return; }
    const now = Date.now(), previous = pendingTap;
    if (previous && now - previous.time <= 340 && Math.abs(point.clientX - previous.x) <= 44 && Math.abs(point.clientY - previous.y) <= 44) {
      clearPendingTap(); suppressClickUntil = now + 500; event.preventDefault(); setImmersive(!immersive);
    } else pendingTap = { time: now, x: point.clientX, y: point.clientY };
  }, { passive: false });
  surface.addEventListener('touchcancel', () => { touchStart = null; clearPendingTap(); });
  viewer.addEventListener('pointermove', event => { if (tour && playing && event.pointerType === 'mouse' && !immersive) showControls(); });
  viewer.addEventListener('focusin', event => { if (!immersive && event.target !== surface) showControls(); });
  document.addEventListener('keydown', event => {
    if (!viewer.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); go(active + (event.key === 'ArrowRight' ? 1 : -1));
    } else if (event.key === 'Escape') {
      event.preventDefault(); if (immersive) setImmersive(false); else dismiss();
    } else if ((event.key === ' ' || event.key === 'Spacebar') && (event.target === surface || event.target === viewer)) {
      event.preventDefault(); playing ? pauseTour() : playTour();
    } else if (event.key.toLowerCase() === 'f' && (event.target === surface || event.target === viewer)) {
      event.preventDefault(); setImmersive(!immersive);
    }
  });
  function refresh() {
    refreshPending = false;
    const o = resolveAutomaticOrientation();
    if (o !== galleryOrientation) { galleryOrientation = o; updateGalleryOrientation(); }
    if (viewer.open && (orientationMode === 'auto' || qualityMode === 'auto')) updateViewer();
  }
  function scheduleRefresh() {
    if (!refreshPending) { refreshPending = true; requestAnimationFrame(refresh); }
  }
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  window.addEventListener('orientationchange', scheduleRefresh, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleRefresh, { passive: true });
  screen.orientation?.addEventListener?.('change', scheduleRefresh);
  window.matchMedia?.('(orientation: portrait)').addEventListener?.('change', scheduleRefresh);
  document.addEventListener('fullscreenchange', scheduleRefresh);
  document.addEventListener('visibilitychange', () => {
    if (!viewer.open) return;
    if (document.hidden) {
      pauseTour(); cancelPreload();
      if (pendingLoad) { ++loadToken; cancelLoad(); requestedKey = ''; stage.classList.remove('vs-loading'); surface.setAttribute('aria-busy', 'false'); }
      renderControls(); updateState();
    } else { updateViewer(); prefetchNext(); }
  });
  connection?.addEventListener?.('change', () => { if (constrainedNetwork()) cancelPreload(); if (viewer.open) updateViewer(); });
  motion?.addEventListener?.('change', () => {
    if (reducedMotion()) { if (tour) pauseTour(); outgoing.hidden = true; photo.classList.add('vs-photo-ready'); }
  });
})();

