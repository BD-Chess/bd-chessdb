/* BD Start sync (BD, 2026-11-07, R7). BD's content follows BD between browsers
   through an end-to-end encrypted copy on this site's Netlify Blobs store
   (/api/bd-start-sync). The sync password never leaves the browser: PBKDF2
   turns it into a master secret, and HKDF splits that into the vault id (sent
   to the server) and the AES-GCM content key (never sent). Appearance, open
   panels and the shown calendar month stay with each device. */
(function (scope) {
  'use strict';
  const API = '/api/bd-start-sync';
  const LOCAL = 'bd-start-sync-v1';
  const BACKUP = 'bd-start-sync-backup-v1';
  const SALT = 'mdlxdcc.org/Start sync v1';
  const ITERATIONS = 600000;
  const AAD = 'bd-start-sync-v1|';
  const DELAY = 2500;
  const encode = text => new TextEncoder().encode(text);
  const subtle = () => scope.crypto.subtle;
  function b64(buffer) {
    const bytes = new Uint8Array(buffer); let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(text);
  }
  function unb64(text) { const raw = atob(text), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); return bytes; }
  const hex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');

  async function deriveKeys(password) {
    const material = await subtle().importKey('raw', encode(String(password).normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
    const master = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encode(SALT), iterations: ITERATIONS }, material, 256);
    const hkdf = await subtle().importKey('raw', master, 'HKDF', false, ['deriveBits']);
    const part = info => subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encode(info) }, hkdf, 256);
    return { vault: hex(await part('bd-start sync vault')), key: b64(await part('bd-start sync content key')) };
  }
  const contentKey = keys => subtle().importKey('raw', unb64(keys.key), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function seal(keys, content) {
    const iv = scope.crypto.getRandomValues(new Uint8Array(12));
    const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: encode(AAD + keys.vault) }, await contentKey(keys), encode(JSON.stringify({ v: 1, content })));
    return { iv: b64(iv), data: b64(data) };
  }
  async function open(keys, record) {
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(record.iv), additionalData: encode(AAD + keys.vault) }, await contentKey(keys), unb64(record.data));
    const doc = JSON.parse(new TextDecoder().decode(plain));
    if (!doc || doc.v !== 1 || !doc.content || typeof doc.content !== 'object') throw new Error('syncFormat');
    return doc.content;
  }
  // BD's content follows BD; appearance, open panels and the shown month stay per device.
  function pick(state) {
    const p = state.preferences;
    return { links: state.links, events: state.events, notes: state.notes, saved: state.saved, favoriteUrls: Array.isArray(p.favoriteUrls) ? p.favoriteUrls : null, lang: p.lang, city: p.city };
  }
  function merge(state, content) {
    const next = JSON.parse(JSON.stringify(state));
    next.links = content.links; next.events = content.events; next.notes = content.notes; next.saved = content.saved;
    next.preferences.lang = content.lang; next.preferences.city = content.city;
    if (Array.isArray(content.favoriteUrls)) next.preferences.favoriteUrls = content.favoriteUrls; else delete next.preferences.favoriteUrls;
    return next;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const TEXT = {
    sl: {
      title: 'Sinhronizacija med brskalniki',
      help: 'Koledar, beležka, bližnjice, povezave in zaznamki se prenašajo med tvojimi brskalniki. Šifrira jih ta brskalnik z geslom za sinhronizacijo; strežnik hrani samo šifrirano kopijo in gesla ne pozna. Videz in odprti razdelki ostanejo ločeni za vsako napravo. Ta brskalnik si geslo zapomni.',
      password: 'Geslo za sinhronizacijo', connect: 'Poveži ta brskalnik', now: 'Sinhroniziraj zdaj', disconnect: 'Prekini v tem brskalniku',
      off: 'Sinhronizacija ni vklopljena. Podatki so samo v tem brskalniku.', short: 'Geslo mora imeti vsaj 8 znakov.',
      deriving: 'Pripravljam ključ …', checking: 'Preverjam strežnik …', saving: 'Shranjujem šifrirano kopijo …', synced: 'Sinhronizirano · {time}',
      offline: 'Strežnik ni dosegljiv. Spremembe ostanejo tukaj in se pošljejo pozneje.',
      noVault: 'Za to geslo na strežniku še ni podatkov. Ustvarim nov sinhroniziran prostor s podatki tega brskalnika? Če si se zatipkal, prekliči.',
      create: 'Ustvari', cancel: 'Prekliči', serverHas: 'Na strežniku so podatki, shranjeni {time}. Ta brskalnik ima drugačne.',
      useServer: 'Uporabi podatke s strežnika', useLocal: 'Pošlji podatke tega brskalnika',
      conflict: 'Na drugi napravi so novejši podatki, ta brskalnik pa ima neposlane spremembe.', takeServer: 'Naloži novejše', keepLocal: 'Obdrži to napravo',
      locked: 'Podatkov na strežniku ni mogoče odkleniti.', limit: 'Strežnik ne sprejme novega sinhroniziranega prostora.', tooLarge: 'Podatki so preveliki za sinhronizacijo.',
      gone: 'Kopija na strežniku ne obstaja več. Podatki ostanejo v tem brskalniku.', stale: 'Ta zavihek ni zadnji. Naloži shranjene podatke, nato sinhroniziraj.',
      failed: 'Sinhronizacija ni uspela. Podatki ostanejo v tem brskalniku.',
      badge: 'sinhronizirano', badgeWaiting: 'čaka na sinhronizacijo', badgeConflict: 'preveri sinhronizacijo'
    },
    en: {
      title: 'Sync between browsers',
      help: 'Calendar, notes, favorites, links and bookmarks follow you between your browsers. This browser encrypts them with your sync password; the server keeps only an encrypted copy and never knows the password. Appearance and open panels stay separate on each device. This browser remembers the password.',
      password: 'Sync password', connect: 'Connect this browser', now: 'Sync now', disconnect: 'Disconnect this browser',
      off: 'Sync is off. Data stays in this browser.', short: 'The password needs at least 8 characters.',
      deriving: 'Preparing the key …', checking: 'Checking the server …', saving: 'Saving the encrypted copy …', synced: 'Synced · {time}',
      offline: 'The server is unreachable. Changes stay here and are sent later.',
      noVault: 'The server has no data for this password yet. Create a new synced space from this browser\'s data? If you mistyped, cancel.',
      create: 'Create', cancel: 'Cancel', serverHas: 'The server has data saved {time}. This browser has different data.',
      useServer: 'Use the server data', useLocal: 'Send this browser\'s data',
      conflict: 'Another device has newer data, and this browser has unsent changes.', takeServer: 'Load the newer data', keepLocal: 'Keep this device',
      locked: 'The server data cannot be unlocked.', limit: 'The server does not accept another synced space.', tooLarge: 'The data is too large to sync.',
      gone: 'The server copy no longer exists. Data stays in this browser.', stale: 'This tab is not the latest. Load the saved data, then sync.',
      failed: 'Sync failed. Data stays in this browser.',
      badge: 'synced', badgeWaiting: 'waiting to sync', badgeConflict: 'check sync'
    }
  };

  function createController() {
    let app = null, record = null, state = 'off', detail = '', choice = null, conflict = null, timer = null, running = null, again = false;
    const el = id => document.getElementById(id);
    const lang = () => app && app.lang() === 'en' ? 'en' : 'sl';
    function t(key, vars) { let text = TEXT[lang()][key] || TEXT.sl[key] || key; Object.keys(vars || {}).forEach(k => { text = text.replace('{' + k + '}', vars[k]); }); return text; }
    function when(iso) { try { return new Intl.DateTimeFormat(lang() === 'sl' ? 'sl-SI' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Ljubljana' }).format(new Date(iso)); } catch (_) { return ''; } }
    function load() {
      try { const r = JSON.parse(localStorage.getItem(LOCAL) || 'null'); return r && /^[a-f0-9]{64}$/.test(r.vault) && typeof r.key === 'string' && Number.isSafeInteger(r.revision) ? r : null; } catch (_) { return null; }
    }
    function save() { try { if (record) localStorage.setItem(LOCAL, JSON.stringify(record)); else localStorage.removeItem(LOCAL); } catch (_) {} }
    function backup() { try { localStorage.setItem(BACKUP, JSON.stringify({ savedAt: new Date().toISOString(), content: pick(app.snapshot()) })); } catch (_) {} }
    async function call(method, vault, body) {
      const headers = { 'X-BD-Start-Vault': vault }; if (body) headers['Content-Type'] = 'application/json';
      const response = await fetch(API, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'same-origin' });
      let json = null; try { json = await response.json(); } catch (_) {}
      return { status: response.status, json: json || {} };
    }
    function render(next, key) {
      if (next) { state = next; detail = key || ''; }
      const host = el('bs-sync'); if (!host) return;
      host.dataset.syncState = state;
      el('bs-sync-form').hidden = !!record || !!choice;
      el('bs-sync-connected').hidden = !record;
      el('bs-sync-choice').hidden = !choice;
      if (choice) {
        el('bs-sync-choice-text').textContent = choice.kind === 'new' ? t('noVault') : t('serverHas', { time: when(choice.server.updatedAt) });
        el('bs-sync-choice-primary').textContent = t(choice.kind === 'new' ? 'create' : 'useServer');
        el('bs-sync-choice-secondary').hidden = choice.kind === 'new';
        el('bs-sync-choice-secondary').textContent = t('useLocal');
        el('bs-sync-choice-cancel').textContent = t('cancel');
      }
      const messages = { off: t('off'), deriving: t('deriving'), checking: t('checking'), saving: t('saving'), waiting: t('saving'), synced: t('synced', { time: when(record && record.syncedAt) }), offline: t('offline'), conflict: t('conflict'), stale: t('stale'), choice: '', error: t(detail || 'failed') };
      el('bs-sync-status').textContent = messages[state] || '';
      el('bs-sync-status').classList.toggle('bs-error', state === 'error');
      el('bs-sync-alert').hidden = state !== 'conflict';
      el('bs-sync-alert-text').textContent = t('conflict');
      el('bs-sync-take-server').textContent = t('takeServer');
      el('bs-sync-keep-local').textContent = t('keepLocal');
      const badge = !record ? '' : state === 'conflict' ? t('badgeConflict') : state === 'synced' ? t('badge') : t('badgeWaiting');
      document.querySelectorAll('[data-sync-badge]').forEach(b => { b.textContent = badge; });
    }
    function localize() {
      if (!el('bs-sync')) return;
      el('bs-sync-title').textContent = t('title'); el('bs-sync-help').textContent = t('help');
      el('bs-sync-password-label').textContent = t('password'); el('bs-sync-connect').textContent = t('connect');
      el('bs-sync-now').textContent = t('now'); el('bs-sync-disconnect').textContent = t('disconnect');
      render();
    }
    function schedule(delay) { clearTimeout(timer); timer = setTimeout(push, delay === undefined ? DELAY : delay); }
    function applyServer(content, server) {
      backup();
      app.applySynced(merge(app.snapshot(), content));
      record = load() || record; record.revision = server.revision; record.pending = false; record.syncedAt = server.updatedAt; save();
    }
    async function push() {
      clearTimeout(timer); timer = null;
      record = load(); if (!record) { render('off'); return; }
      if (conflict) { render('conflict'); return; }
      if (!record.pending) { render('synced'); return; }
      if (app.stale()) { render('stale'); return; }
      if (running) { again = true; return; }
      const mark = record.mark || 0;
      render('saving');
      running = (async function () {
        try {
          const sealed = await seal(record, pick(app.snapshot()));
          const got = await call('PUT', record.vault, { baseRevision: record.revision, iv: sealed.iv, data: sealed.data });
          record = load(); if (!record) { render('off'); return; }
          if (got.status === 200 && got.json.ok) {
            record.revision = got.json.revision; record.syncedAt = got.json.updatedAt;
            if ((record.mark || 0) === mark) record.pending = false;
            save(); render(record.pending ? 'waiting' : 'synced'); if (record.pending) schedule(); return;
          }
          if (got.status === 409) { await pull(true); return; }
          render('error', got.status === 403 ? 'limit' : got.status === 413 ? 'tooLarge' : 'failed');
        } catch (_) { render('offline'); }
      })();
      try { await running; } finally { running = null; if (again) { again = false; schedule(0); } }
    }
    async function pull(afterConflict) {
      record = load(); if (!record) { render('off'); return; }
      if (app.stale()) { render('stale'); return; }
      if (!afterConflict) render('checking');
      let got; try { got = await call('GET', record.vault); } catch (_) { render('offline'); return; }
      if (got.status !== 200 || !got.json.ok) { render('error', 'failed'); return; }
      record = load(); if (!record) { render('off'); return; }
      if (!got.json.exists) {
        if (record.revision === 0) { record.pending = true; save(); return push(); }
        record = null; save(); render('error', 'gone'); return;
      }
      if (got.json.revision === record.revision) { if (record.pending) return push(); render('synced'); return; }
      let content; try { content = await open(record, got.json); } catch (_) { render('error', 'locked'); return; }
      if (same(pick(app.snapshot()), content)) { record.revision = got.json.revision; record.pending = false; record.syncedAt = got.json.updatedAt; save(); render('synced'); return; }
      if (!record.pending) { try { applyServer(content, got.json); render('synced'); } catch (_) { render('error', 'locked'); } return; }
      conflict = { server: got.json, content }; render('conflict');
    }
    async function connect(password) {
      if (String(password).length < 8) { render('error', 'short'); return; }
      choice = null; render('deriving');
      let keys; try { keys = await deriveKeys(password); } catch (_) { render('error', 'failed'); return; }
      render('checking');
      let got; try { got = await call('GET', keys.vault); } catch (_) { render('offline'); return; }
      if (got.status !== 200 || !got.json.ok) { render('error', 'failed'); return; }
      if (!got.json.exists) { choice = { kind: 'new', keys }; render('choice'); return; }
      let content; try { content = await open(keys, got.json); } catch (_) { render('error', 'locked'); return; }
      if (same(pick(app.snapshot()), content)) { record = { vault: keys.vault, key: keys.key, revision: got.json.revision, pending: false, syncedAt: got.json.updatedAt, mark: 0 }; save(); render('synced'); return; }
      choice = { kind: 'server', keys, server: got.json, content }; render('choice');
    }
    function choose(kind) {
      const c = choice; choice = null; if (!c) return;
      if (kind === 'cancel') { render('off'); return; }
      if (c.kind === 'new') { record = { vault: c.keys.vault, key: c.keys.key, revision: 0, pending: true, mark: 1 }; save(); push(); return; }
      record = { vault: c.keys.vault, key: c.keys.key, revision: c.server.revision, pending: kind === 'local', syncedAt: c.server.updatedAt, mark: 1 }; save();
      if (kind === 'local') { push(); return; }
      try { applyServer(c.content, c.server); render('synced'); } catch (_) { render('error', 'locked'); }
    }
    function resolve(keepLocal) {
      const c = conflict; conflict = null; if (!c) return;
      record = load(); if (!record) { render('off'); return; }
      if (keepLocal) { record.revision = c.server.revision; record.pending = true; record.mark = (record.mark || 0) + 1; save(); push(); return; }
      try { applyServer(c.content, c.server); render('synced'); } catch (_) { render('error', 'locked'); }
    }
    function changed() {
      if (!app) return;
      const fresh = load(); if (!fresh) return;
      record = fresh; record.pending = true; record.mark = (record.mark || 0) + 1; save();
      if (conflict) { render('conflict'); return; }
      render('waiting'); schedule();
    }
    function start(api) {
      if (app || !el('bs-sync')) return;
      app = api;
      el('bs-sync-form').addEventListener('submit', function (e) { e.preventDefault(); const field = el('bs-sync-password'), value = field.value; field.value = ''; connect(value); });
      el('bs-sync-now').addEventListener('click', function () { pull(); });
      el('bs-sync-disconnect').addEventListener('click', function () { clearTimeout(timer); record = null; conflict = null; choice = null; save(); render('off'); });
      el('bs-sync-choice-primary').addEventListener('click', function () { choose(choice && choice.kind === 'new' ? 'create' : 'server'); });
      el('bs-sync-choice-secondary').addEventListener('click', function () { choose('local'); });
      el('bs-sync-choice-cancel').addEventListener('click', function () { choose('cancel'); });
      el('bs-sync-take-server').addEventListener('click', function () { resolve(false); });
      el('bs-sync-keep-local').addEventListener('click', function () { resolve(true); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && load() && !running) pull(); });
      scope.addEventListener('online', function () { if (load() && !running) pull(); });
      scope.addEventListener('storage', function (e) { if (e.key === LOCAL) { record = load(); render(record ? state : 'off'); } });
      record = load(); localize();
      if (record) pull(); else render('off');
    }
    return { start, changed, localize };
  }

  const api = { API, LOCAL, BACKUP, SALT, ITERATIONS, deriveKeys, seal, open, pick, merge, same };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.BDStartSync = Object.freeze(Object.assign(createController(), api));
})(typeof window === 'object' ? window : globalThis);
