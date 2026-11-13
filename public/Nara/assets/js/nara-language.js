/* Nara main pages · EN / SL as progressive enhancement. English stays readable without JavaScript.
   Shares the reader's choice with Illuminara Daily and the visual series: ?lang=en|sl wins, then the
   stored nara-daily-lang (legacy nara-daily-language). Links to other Nara pages carry ?lang= so the
   choice also survives a move between bd-chess.github.io and www.mdlxdcc.org. */
(() => {
  'use strict';
  const root = document.documentElement;
  const switcher = document.querySelector('[data-language-switch]');
  if (!switcher) return;
  const get = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const set = (key, value) => { try { localStorage.setItem(key, value); } catch { /* still works for this view */ } };
  const valid = (value) => value === 'en' || value === 'sl';
  const requested = new URLSearchParams(location.search).get('lang');
  const saved = get('nara-daily-lang', get('nara-daily-language', 'en'));
  let language = valid(requested) ? requested : valid(saved) ? saved : 'en';
  const description = document.querySelector('meta[name="description"][data-description-en]');
  const hosts = new Set([location.hostname, 'bd-chess.github.io', 'www.mdlxdcc.org', 'mdlxdcc.org']);
  // Pages directly inside a Nara folder (/Nara/x.html, /bd-chessdb/Nara/x.html, pretty /nara/x).
  const naraPage = (url) => hosts.has(url.hostname) && /\/nara\/[^/]*$/i.test(url.pathname);

  const apply = (updateURL = false) => {
    root.lang = language;
    document.querySelectorAll('[data-language-content]').forEach((el) => {
      el.hidden = el.dataset.languageContent !== language;
    });
    // The head bootstrap's first-paint mark (nara-cinematic.css) is no longer needed: hidden now decides.
    delete root.dataset.languageEarly;
    document.querySelectorAll('[data-aria-en]').forEach((el) => {
      el.setAttribute('aria-label', language === 'sl' ? el.dataset.ariaSl : el.dataset.ariaEn);
    });
    document.querySelectorAll('img[data-alt-sl]').forEach((img) => {
      if (img.dataset.altEn === undefined) img.dataset.altEn = img.getAttribute('alt') ?? '';
      img.alt = language === 'sl' ? img.dataset.altSl : img.dataset.altEn;
    });
    // Episode lightbox captions: nara-reader.js reads data-lightbox-caption when an image opens.
    document.querySelectorAll('[data-lightbox-caption-sl]').forEach((el) => {
      if (el.dataset.lightboxCaptionEn === undefined) el.dataset.lightboxCaptionEn = el.dataset.lightboxCaption ?? '';
      el.dataset.lightboxCaption = language === 'sl' ? el.dataset.lightboxCaptionSl : el.dataset.lightboxCaptionEn;
    });
    switcher.querySelectorAll('[data-language]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
    if (root.dataset.titleEn) document.title = language === 'sl' ? root.dataset.titleSl : root.dataset.titleEn;
    if (description) description.content = language === 'sl' ? description.dataset.descriptionSl : description.dataset.descriptionEn;
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      let url;
      try { url = new URL(href, location.href); } catch { return; }
      if (!naraPage(url)) return;
      url.searchParams.set('lang', language);
      a.setAttribute('href', url.origin === location.origin ? url.pathname + url.search + url.hash : url.href);
    });
    set('nara-daily-lang', language);
    set('nara-daily-language', language);
    if (updateURL) {
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      try { history.replaceState(history.state, '', url.pathname + url.search + url.hash); } catch { /* file:// */ }
    }
    switcher.hidden = false;
    // Page scripts with their own labels (episode music) re-render on this event.
    if (typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent('nara:language', {detail: {language}}));
  };

  switcher.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => {
    if (!valid(button.dataset.language)) return;
    language = button.dataset.language;
    apply(true);
  }));
  apply();
})();
