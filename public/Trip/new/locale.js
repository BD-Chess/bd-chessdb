
/* MDLxDCC shared language preference v1.0 · 2026-09-08
   Explicit choice > remembered choice > Netlify country (SI → sl, else en).
   No IP, city or location is stored. No third-party calls. */
(function () {
  'use strict';
  if (window.MDLxDCCLocale) return;
  const root = document.documentElement;
  const KEY = 'mdlxdcc-locale-v1', LEGACY = 'mdlxdcc-lang', COOKIE = 'mdlxdcc_locale';
  const listeners = new Set();
  let selection = null, generation = 0, controller = null;
  const valid = value => value === 'en' || value === 'sl';
  const get = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  function parse(value) {
    try {
      const x = JSON.parse(value);
      return x && valid(x.lang) && ['manual', 'geo'].includes(x.source) &&
        Number.isFinite(x.at) && x.at >= 0 ? {lang:x.lang, source:x.source, at:x.at} : null;
    } catch (_) { return null; }
  }
  function cookieSelection() {
    try {
      const item = document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
      return item ? parse(decodeURIComponent(item.slice(COOKIE.length + 1))) : null;
    } catch (_) { return null; }
  }
  function read() {
    const local = parse(get(KEY)), cookie = cookieSelection();
    let value = !local ? cookie : !cookie ? local : cookie.at > local.at ? cookie : local;
    const legacy = get(LEGACY);
    // A legacy page may still save just the original shared key. Adopt its explicit change.
    if (valid(legacy) && (!value || (value.lang !== legacy && (!cookie || (local && local.at >= cookie.at))))) {
      value = {lang:legacy, source:'manual', at:Date.now()};
    }
    return value;
  }
  function persist() {
    if (!selection) return;
    const data = JSON.stringify(selection);
    try {
      localStorage.setItem(LEGACY, selection.lang);
      localStorage.setItem('bdPortraitLang', selection.lang);
      localStorage.setItem(KEY, data);
    } catch (_) {}
    try {
      if (!/^https?:$/.test(location.protocol)) return;
      const host = location.hostname.toLowerCase();
      const domain = host === 'mdlxdcc.org' || host === 'www.mdlxdcc.org' ? '; Domain=mdlxdcc.org' : '';
      document.cookie = COOKIE + '=' + encodeURIComponent(data) + '; Path=/; Max-Age=31536000; SameSite=Lax' + domain +
        (location.protocol === 'https:' ? '; Secure' : '');
    } catch (_) {}
  }
  function current() { return selection ? selection.lang : 'en'; }
  function apply() {
    const lang = current();
    root.lang = lang; root.dataset.lang = lang;
    root.dataset.localeSource = selection ? selection.source : 'fallback';
    listeners.forEach(fn => { try { fn(lang); } catch (error) { console.warn('Language view could not update.', error); } });
    window.dispatchEvent(new CustomEvent('mdlxdcc:language', {detail:{lang, source:root.dataset.localeSource}}));
  }
  function choose(lang) {
    if (!valid(lang)) return;
    generation++;
    if (controller) controller.abort();
    selection = {lang, source:'manual', at:Math.max(Date.now(), (selection ? selection.at : 0) + 1)};
    persist(); apply();
  }
  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn); fn(current());
    return () => listeners.delete(fn);
  }
  function refresh() {
    const next = read();
    if (next && (!selection || next.at > selection.at || next.lang !== selection.lang)) {
      generation++; if (controller) controller.abort();
      selection = next; persist(); apply();
    }
  }
  selection = read();
  try {
    const requested = new URLSearchParams(location.search).get('lang');
    if (valid(requested)) selection = {lang:requested, source:'manual', at:Math.max(Date.now(), (selection ? selection.at : 0) + 1)};
  } catch (_) {}
  window.MDLxDCCLocale = Object.freeze({current, choose, subscribe, refresh, version:'1.0'});
  root.classList.add('js');
  if (selection) persist();
  apply();
  window.addEventListener('storage', event => { if ([KEY, LEGACY, null].includes(event.key)) refresh(); });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
  if (!selection && /^https?:$/.test(location.protocol) && typeof fetch === 'function') {
    const start = generation;
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    let expired = false;
    const timeout = setTimeout(() => { expired = true; if (controller) controller.abort(); }, 2200);
    fetch('/api/entry-locale', {cache:'no-store', credentials:'omit', headers:{'Accept':'application/json'},
      ...(controller ? {signal:controller.signal} : {})})
      .then(response => {
        if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) throw new Error('No country response');
        return response.json();
      })
      .then(data => {
        // A late response must never replace a manual choice or a choice made in another tab.
        if (expired || generation !== start || selection || !data || !valid(data.language)) return;
        const saved = read();
        selection = saved || {lang:data.language, source:'geo', at:Date.now()};
        persist(); apply();
      })
      .catch(() => { /* English stays usable when offline, unknown, or unavailable. */ })
      .finally(() => clearTimeout(timeout));
  }
})();

