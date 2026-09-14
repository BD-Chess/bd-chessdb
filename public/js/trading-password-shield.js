/*
  8Z Shield — Trading password-only runtime.
  Supports encrypted HTML fragments and encrypted complete documents.
  No plaintext passphrase or derived credential is stored in this file.
*/
(function () {
  'use strict';

  const STORE = '8z-shield:bd-trading:password-only:v1';
  const ITERS = 500000;
  const ROUNDS = 1024;
  const MASK = (1n << 64n) - 1n;
  const sections = [...document.querySelectorAll('[data-trading-shield][data-8z-blob]')];
  if (!sections.length || !window.crypto || !crypto.subtle || !window.DecompressionStream) return;

  let busy = false;
  let authorized = false;
  let target = null;

  const LANGUAGE = 'bd-trading-protected-shell-language-v1';
  const copies = {
    en: {
      title: 'Trading technical access',
      body: 'Enter the Trading passphrase to open protected mechanics or a paper-trading engine. This is a separate password-only Trading session; it does not use the site email gate.',
      label: 'Trading passphrase',
      unlock: 'Unlock',
      cancel: 'Cancel',
      wrong: 'The passphrase did not unlock this page.',
      working: 'Decrypting protected Trading content…',
      open: 'Open protected section',
      protected: 'Technical depth — protected',
      sub: 'Exact mechanics and engine implementation are encrypted before access.',
      engineHold: 'Engine migration hold. This protected historic interface is preserved, but its separately encrypted legacy engine is not activated in this release.'
    },
    sl: {
      title: 'Trading tehnični dostop',
      body: 'Vnesi Trading geslo za odprtje zaščitene mehanike ali paper-trading engina. To je ločena Trading seja samo z geslom; ne uporablja site-wide email gatea.',
      label: 'Trading geslo',
      unlock: 'Odkleni',
      cancel: 'Prekliči',
      wrong: 'Geslo te strani ni odklenilo.',
      working: 'Dešifriram zaščiteno Trading vsebino …',
      open: 'Odpri zaščiten odsek',
      protected: 'Tehnična globina — zaščiteno',
      sub: 'Natančna mehanika in izvedba engina sta pred dostopom šifrirani.',
      engineHold: 'Migracija engina čaka. Ta zaščiten zgodovinski vmesnik je ohranjen, vendar njegov ločeno šifrirani legacy engine v tej izdaji ni aktiviran.'
    }
  };

  let language = (() => {
    try { return localStorage.getItem(LANGUAGE) === 'sl' ? 'sl' : 'en'; }
    catch (_) { return 'en'; }
  })();
  let copy = copies[language];

  function isBBSHPage() {
    return /BB Surfing Hedge/i.test(document.title) ||
      /\/bd\/(?:bbsh(?:\.html)?|trading\/bb-surfing-hedge)\/?$/i.test(location.pathname);
  }

  function injectStyle() {
    if (document.getElementById('trading-shield-style')) return;
    const style = document.createElement('style');
    style.id = 'trading-shield-style';
    style.textContent = `
      [data-trading-shield]{margin:1rem 0;border:1px solid rgba(184,145,60,.42);border-left:3px solid #c99a3b;border-radius:.8rem;background:rgba(17,25,39,.68);color:inherit;overflow:hidden}
      [data-trading-shield].trading-shield-opened{border-left-color:#3faf83}
      .trading-shield-shell{display:grid;grid-template-columns:auto 1fr auto;gap:.8rem;align-items:center;padding:1rem 1.05rem}
      .trading-shield-icon{font-size:1.15rem;line-height:1}
      .trading-shield-copy{min-width:0}
      .trading-shield-copy strong{display:block;font:700 .72rem/1.25 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#c99a3b}
      .trading-shield-copy span{display:block;margin-top:.28rem;font-size:.83rem;line-height:1.4;opacity:.78}
      .trading-shield-button{appearance:none;border:1px solid rgba(201,154,59,.75);border-radius:.55rem;background:transparent;color:#e6c16e;padding:.55rem .66rem;font:700 .68rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;white-space:nowrap}
      .trading-shield-content{display:none}
      [data-trading-shield].trading-shield-opened>.trading-shield-content{display:block}
      .trading-shield-engine-hold{margin:0 0 1rem;padding:1rem 1.05rem;border-left:3px solid #c99a3b;border-radius:.55rem;background:#101722;color:#e6edf3;font:500 .88rem/1.5 ui-sans-serif,system-ui,sans-serif}
      .trading-shield-dialog{width:min(32rem,calc(100vw - 2rem));border:1px solid rgba(201,154,59,.46);border-radius:1rem;background:#101722;color:#eef3f8;box-shadow:0 24px 80px rgba(0,0,0,.58);padding:0}
      .trading-shield-dialog::backdrop{background:rgba(2,6,12,.76);backdrop-filter:blur(4px)}
      .trading-shield-dialog form{padding:1.25rem}
      .trading-shield-dialog h2{margin:0;font-size:1.18rem}
      .trading-shield-dialog p{margin:.65rem 0 1rem;line-height:1.5;font-size:.9rem;color:#c6d0db}
      .trading-shield-dialog label{display:block;font:700 .67rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#c6d0db}
      .trading-shield-dialog input{box-sizing:border-box;width:100%;margin-top:.45rem;border:1px solid #445064;border-radius:.55rem;background:#080d15;color:#eef3f8;padding:.7rem .75rem;font:inherit}
      .trading-shield-dialog-actions{display:flex;justify-content:flex-end;gap:.55rem;margin-top:1rem}
      .trading-shield-dialog-actions button{border:1px solid #4b5668;border-radius:.55rem;background:transparent;color:#eef3f8;padding:.57rem .75rem;cursor:pointer;font:700 .7rem/1 ui-monospace,SFMono-Regular,Menlo,monospace}
      .trading-shield-dialog-actions button[type=submit]{border-color:#c99a3b;color:#e6c16e}
      .trading-shield-status{min-height:1.25rem;margin:.65rem 0 0;color:#efb05a;font-size:.8rem}
      @media print{[data-trading-shield] .trading-shield-content{display:none!important}.trading-shield-dialog{display:none!important}}
      @media(max-width:600px){.trading-shield-shell{grid-template-columns:auto 1fr}.trading-shield-button{grid-column:2;justify-self:start}}
    `;
    if (isBBSHPage()) {
      style.textContent += `
        @media(min-width:981px){
          body.trading-protected-outer .trading-protected-page{max-width:1500px!important;width:calc(100% - 32px)!important;padding-left:0!important;padding-right:0!important}
          body.trading-protected-outer .trading-protected-card{padding:clamp(1.2rem,2.2vw,2.2rem)!important}
        }
      `;
    }
    document.head.append(style);
  }

  function setLanguage(next) {
    language = next === 'sl' ? 'sl' : 'en';
    copy = copies[language];
    document.documentElement.dataset.tradingLang = language;
    try { localStorage.setItem(LANGUAGE, language); } catch (_) {}
    for (const toggle of document.querySelectorAll('[data-trading-language-toggle]')) {
      toggle.textContent = language === 'en' ? 'SL' : 'EN';
    }
    for (const section of sections) {
      if (section.dataset.mounted === '1') continue;
      const label = section.querySelector('.trading-shield-copy strong');
      const sub = section.querySelector('.trading-shield-copy span');
      const button = section.querySelector('.trading-shield-button');
      if (label) label.textContent = section.dataset.shieldLabel || copy.protected;
      if (sub) sub.textContent = section.dataset.shieldSub || copy.sub;
      if (button) button.textContent = copy.open;
    }
    const dialog = document.getElementById('trading-password-dialog');
    if (dialog) {
      dialog.querySelector('h2').textContent = copy.title;
      dialog.querySelector('p').textContent = copy.body;
      dialog.querySelector('label').textContent = copy.label;
      dialog.querySelector('button[type=button]').textContent = copy.cancel;
      dialog.querySelector('button[type=submit]').textContent = copy.unlock;
    }
  }

  function from64(text) {
    const raw = atob(text);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }
  function b64(bytes) {
    let text = '';
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text);
  }
  function merge(...arrays) {
    const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
    let p = 0;
    for (const a of arrays) { out.set(a, p); p += a.length; }
    return out;
  }
  async function digest(value) {
    const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  }
  function bytesToU64(bytes) {
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    return value;
  }
  function u64ToBytes(value) {
    const bytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) { bytes[i] = Number(value & 0xffn); value >>= 8n; }
    return bytes;
  }
  function nextState(value) {
    let x = value;
    x = (x ^ ((x >> 12n) & MASK)) & MASK;
    x = (x ^ ((x << 25n) & MASK)) & MASK;
    x = (x ^ ((x >> 27n) & MASK)) & MASK;
    return x;
  }
  async function deriveKey(passHash, salt) {
    const seed = await digest(merge(passHash, salt, new TextEncoder().encode('8Z_AUTH_V1')));
    let state = bytesToU64(seed.slice(0, 8)) || 0x9E3779B97F4A7C15n;
    for (let i = 0; i < ROUNDS; i++) state = nextState(state);
    const stateHash = await digest(u64ToBytes(state));
    const material = merge(passHash, stateHash);
    const keyMaterial = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations:ITERS, hash:'SHA-256' }, keyMaterial, 256));
  }
  async function decompress(data) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function decrypt(blob, passHash) {
    const bytes = from64(blob);
    if (bytes.length < 60) throw new Error('Invalid protected payload');
    const salt = bytes.slice(0, 32);
    const iv = bytes.slice(32, 44);
    const ciphertext = bytes.slice(44);
    const keyBytes = await deriveKey(passHash, salt);
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const compressed = new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv, tagLength:128 }, key, ciphertext));
    return new TextDecoder().decode(await decompress(compressed));
  }

  function storedHash() {
    try {
      const r = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (!r || r.v !== 2 || r.origin !== location.origin || typeof r.p !== 'string') return null;
      const value = from64(r.p);
      return value.length === 32 ? value : null;
    } catch (_) { return null; }
  }
  function remember(passHash) {
    try { sessionStorage.setItem(STORE, JSON.stringify({ v:2, origin:location.origin, p:b64(passHash) })); }
    catch (_) {}
  }

  function activateScripts(root) {
    for (const oldScript of [...root.querySelectorAll('script')]) {
      const replacement = document.createElement('script');
      for (const a of oldScript.attributes) replacement.setAttribute(a.name, a.value);
      replacement.textContent = oldScript.textContent;
      oldScript.replaceWith(replacement);
    }
  }

  function isCompleteDocument(html) {
    return /^\s*<!doctype\s+html/i.test(html) || /<html(?:\s|>)/i.test(html);
  }
  function replaceWithDocument(html) {
    document.open();
    document.write(html);
    document.close();
  }
  function mount(section, html) {
    if (isCompleteDocument(html)) {
      replaceWithDocument(html);
      return;
    }
    const content = section.querySelector('.trading-shield-content');
    if (!content || section.dataset.mounted === '1') return;
    content.innerHTML = html;
    content.style.display = 'block';
    section.querySelector('.trading-shield-shell')?.remove();
    section.classList.add('trading-shield-opened');
    section.dataset.mounted = '1';
    if (section.dataset.enginePending === 'true') {
      const hold = document.createElement('div');
      hold.className = 'trading-shield-engine-hold';
      hold.textContent = copy.engineHold;
      content.prepend(hold);
    } else {
      activateScripts(content);
    }
  }

  async function openSection(section, passHash) {
    if (busy || section.dataset.mounted === '1') return;
    busy = true;
    try { mount(section, await decrypt(section.getAttribute('data-8z-blob'), passHash)); }
    finally { busy = false; }
  }

  function makeDialog() {
    let dialog = document.getElementById('trading-password-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'trading-password-dialog';
    dialog.className = 'trading-shield-dialog';
    dialog.innerHTML = '<form method="dialog" novalidate><h2></h2><p></p><label for="trading-password-input"></label><input id="trading-password-input" type="password" autocomplete="current-password" required><div class="trading-shield-status" aria-live="polite"></div><div class="trading-shield-dialog-actions"><button type="button"></button><button type="submit"></button></div></form>';
    document.body.append(dialog);
    dialog.querySelector('button[type=button]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      dialog.querySelector('input').value = '';
      dialog.querySelector('.trading-shield-status').textContent = '';
    });
    dialog.querySelector('form').addEventListener('submit', unlockFromDialog);
    return dialog;
  }

  async function unlockFromDialog(event) {
    event.preventDefault();
    if (busy) return;
    const dialog = document.getElementById('trading-password-dialog');
    const input = dialog.querySelector('input');
    const status = dialog.querySelector('.trading-shield-status');
    const passphrase = input.value;
    if (!passphrase) return;
    busy = true;
    status.textContent = copy.working;
    try {
      const passHash = await digest(passphrase);
      const section = target || sections[0];
      const html = await decrypt(section.getAttribute('data-8z-blob'), passHash);
      remember(passHash);
      authorized = true;
      input.value = '';
      if (!isCompleteDocument(html)) dialog.close();
      mount(section, html);
    } catch (_) {
      input.value = '';
      status.textContent = copy.wrong;
      input.focus();
    } finally {
      busy = false;
    }
  }

  async function requestOpen(section) {
    const passHash = storedHash();
    if (authorized && passHash) return openSection(section, passHash);
    target = section;
    const dialog = makeDialog();
    setLanguage(language);
    dialog.showModal();
    setTimeout(() => dialog.querySelector('input').focus(), 0);
  }

  async function resume() {
    const passHash = storedHash();
    if (!passHash) return;
    try {
      await decrypt(sections[0].getAttribute('data-8z-blob'), passHash);
      authorized = true;
      for (const section of sections) section.classList.add('trading-shield-authorized');
    } catch (_) {
      try { sessionStorage.removeItem(STORE); } catch (__) {}
    }
  }

  function renderShell(section) {
    const label = section.dataset.shieldLabel || copy.protected;
    const sub = section.dataset.shieldSub || copy.sub;
    section.innerHTML = '<div class="trading-shield-shell"><div class="trading-shield-icon" aria-hidden="true">🔐</div><div class="trading-shield-copy"><strong></strong><span></span></div><button type="button" class="trading-shield-button"></button></div><div class="trading-shield-content"></div>';
    section.querySelector('strong').textContent = label;
    section.querySelector('span').textContent = sub;
    const button = section.querySelector('button');
    button.textContent = copy.open;
    button.addEventListener('click', () => requestOpen(section));
  }

  injectStyle();
  for (const section of sections) renderShell(section);
  for (const toggle of document.querySelectorAll('[data-trading-language-toggle]')) {
    toggle.addEventListener('click', () => setLanguage(language === 'en' ? 'sl' : 'en'));
  }
  setLanguage(language);
  resume();
})();
