'use strict';

(() => {
  const status = document.getElementById('pwaStatus');
  const panel = document.getElementById('pwaUpdate');
  const message = document.getElementById('pwaUpdateMessage');
  const button = document.getElementById('pwaUpdateButton');
  const frame = document.getElementById('sudokuApp');
  let registration = null, ready = false, offlineSetupFailed = false, reloadRequested = false, controllerReplaced = false, lastCheck = 0;
  let hadController = !!navigator.serviceWorker?.controller;

  function renderStatus() {
    status.hidden = false;
    status.textContent = ready ? (navigator.onLine ? 'OFFLINE READY' : 'OFFLINE') : offlineSetupFailed ? 'OFFLINE SETUP FAILED' : (navigator.onLine ? 'PREPARING OFFLINE' : 'OFFLINE NOT READY');
  }
  function showUpdate(text = 'A new 8zSudoku version is ready. Save your game and update when convenient.') {
    panel.hidden = false; message.textContent = text;
    button.disabled = false; button.textContent = controllerReplaced ? 'Save & reload' : 'Save & update';
  }
  async function checkUpdate() {
    if (!registration || !navigator.onLine || Date.now() - lastCheck < 30000) return;
    lastCheck = Date.now();
    try { await registration.update(); } catch (_) { /* Keep the verified offline release available. */ }
    if (registration.waiting) showUpdate();
  }
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
      if (worker.state === 'redundant' && !ready && !registration?.active && !navigator.serviceWorker.controller) { offlineSetupFailed = true; renderStatus(); }
    });
  }
  function flushGame() {
    try { const app = frame.contentWindow?.SudokuNavigator; return typeof app?.flushForUpdate === 'function' && app.flushForUpdate() === true; }
    catch (_) { return false; }
  }

  button.addEventListener('click', () => {
    if (!flushGame()) {
      showUpdate('Your game could not be saved yet. Finish the current action or pause the solver. If device storage is full, export your game, then retry.');
      return;
    }
    if (controllerReplaced || !registration?.waiting) { window.location.reload(); return; }
    reloadRequested = true; button.disabled = true; message.textContent = 'Game saved. Updating…';
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  });

  if (!('serviceWorker' in navigator)) {
    status.hidden = false; status.textContent = 'OFFLINE UNAVAILABLE'; return;
  }
  renderStatus();
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    ready = true; renderStatus();
    if (reloadRequested) {
      // Activation is asynchronous: a new move or storage failure may have
      // occurred after the click. Recheck before discarding the current page.
      if (flushGame()) { window.location.reload(); return; }
      reloadRequested = false; controllerReplaced = true;
      showUpdate('Update activated. Finish the current action or resolve the save issue, then save and reload.');
      return;
    }
    // First-install claim is expected. Another tab's update must not reload us.
    if (hadController) { controllerReplaced = true; showUpdate('An update is active. Save and reload to use it in this window.'); }
    hadController = true;
  });
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then(async reg => {
      registration = reg; watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      if (reg.waiting) showUpdate();
      await navigator.serviceWorker.ready; ready = true; renderStatus();
      await checkUpdate();
    })
    .catch(() => { offlineSetupFailed = true; renderStatus(); });
  window.addEventListener('online', () => { renderStatus(); checkUpdate(); });
  window.addEventListener('offline', renderStatus);
  window.addEventListener('focus', checkUpdate);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
})();
