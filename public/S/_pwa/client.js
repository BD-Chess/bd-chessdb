'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const status = $('pwaStatus'), panel = $('pwaUpdate'), message = $('pwaUpdateMessage'), button = $('pwaUpdateButton');
  const frame = $('sudokuGame');
  let registration, installPrompt, ready = false, failed = false, reloadRequested = false, replaced = false, checking = false, lastCheck = 0;
  const expectedScope = new URL('./', location.href).href;
  let hadController = false;
  const ownController = () => navigator.serviceWorker?.controller?.scriptURL === new URL('./sw.js', location.href).href;
  function render() {
    status.textContent = ready ? (navigator.onLine ? 'OFFLINE READY' : 'OFFLINE') : failed ? 'OFFLINE SETUP FAILED' : navigator.onLine ? 'PREPARING OFFLINE' : 'OFFLINE NOT READY';
  }
  function show(text = 'A new version of this channel is ready. Save your game and update when convenient.') {
    panel.hidden = false; message.textContent = text; button.disabled = false; button.textContent = replaced ? 'Save & reload' : 'Save & update';
  }
  async function flush() {
    try {
      if (document.body.dataset.channel === 'legacy' && !frame.getAttribute('src')) return true;
      const app = frame.contentWindow?.SudokuNavigator || frame.contentWindow?.SudokuCurrentPWA;
      return typeof app?.flushForUpdate === 'function' && await app.flushForUpdate() === true;
    } catch (_) { return false; }
  }
  async function check() {
    if (!registration || !navigator.onLine || checking || Date.now() - lastCheck < 30000) return;
    checking = true; lastCheck = Date.now();
    try { await registration.update(); } catch (_) { /* Keep the installed complete release. */ }
    finally { checking = false; }
    if (registration.waiting) show();
  }
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && registration?.active) show();
      if (worker.state === 'activated') { ready = true; failed = false; render(); }
      if (worker.state === 'redundant' && !ready && !registration?.active) { failed = true; render(); }
    });
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    if (!await flush()) { show('Your game could not be saved yet. Finish the current action or pause the solver. If storage is full, export your game, then retry.'); return; }
    if (replaced || !registration?.waiting) { location.reload(); return; }
    reloadRequested = true; message.textContent = 'Game saved. Updating…';
    registration.waiting.postMessage({type: 'ACTIVATE_UPDATE'});
  });
  const install = $('pwaInstall'), installPanel = $('pwaInstallPanel');
  install?.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt; installPrompt = null;
      await prompt.prompt(); await prompt.userChoice;
    } else { installPanel.hidden = !installPanel.hidden; }
  });
  $('pwaInstallClose')?.addEventListener('click', () => { installPanel.hidden = true; });
  window.addEventListener('beforeinstallprompt', event => { if (install) { event.preventDefault(); installPrompt = event; } });
  window.addEventListener('appinstalled', () => { installPrompt = null; if (install) install.textContent = 'INSTALLED'; installPanel.hidden = true; });
  if (new URL(location.href).searchParams.has('install') && installPanel) installPanel.hidden = false;
  $('legacyRecover')?.addEventListener('click', () => {
    $('legacyLanding').hidden = true; frame.hidden = false; frame.src = './app.html';
  });
  if (!('serviceWorker' in navigator)) { status.textContent = 'OFFLINE UNAVAILABLE'; return; }
  hadController = ownController(); render();
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (!ownController()) return;
    ready = true; failed = false; render();
    if (reloadRequested) {
      reloadRequested = false;
      if (await flush()) { location.reload(); return; }
      replaced = true; show('Update activated. Finish the current action or resolve the save issue, then save and reload.');
    } else if (hadController) { replaced = true; show('An update is active. Save and reload to use it in this window.'); }
    hadController = true;
  });
  navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'}).then(reg => {
    if (reg.scope !== expectedScope) throw Error('Unexpected channel scope');
    registration = reg; ready = reg.active?.state === 'activated'; render();
    watch(reg.installing); watch(reg.active);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    if (reg.waiting) show(); check();
  }).catch(() => { failed = true; render(); });
  window.addEventListener('online', () => { render(); check(); });
  window.addEventListener('offline', render);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
})();
