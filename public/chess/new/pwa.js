/* Each chess channel installs only its own service worker and keeps its own data. */
(() => {
  const notice = document.getElementById('chessPwaNotice');
  const readyBadge = document.getElementById('chessPwaReady');
  const installButton = document.getElementById('chessPwaInstall');
  const installHint = document.getElementById('chessPwaHint');
  const updateButton = document.getElementById('chessPwaUpdate');
  const workerURL = new URL('sw.js', document.baseURI).href;
  let registration, installPrompt, reloadRequested = false, reloading = false;

  function connection() {
    if (notice) notice.hidden = navigator.onLine !== false;
  }
  function showReady() {
    const controller = navigator.serviceWorker?.controller;
    if (readyBadge) readyBadge.hidden = !controller || controller.scriptURL !== workerURL;
  }
  function showUpdate() {
    if (updateButton) updateButton.hidden = !registration?.waiting || !navigator.serviceWorker?.controller;
  }
  function showInstall() {
    if (installButton) installButton.hidden = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  }
  connection(); showInstall();
  window.addEventListener('online', () => { connection(); registration?.update().catch(() => {}); });
  window.addEventListener('offline', connection);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    showInstall();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (installButton) installButton.hidden = true;
    if (installHint) installHint.hidden = true;
  });
  installButton?.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      await prompt.prompt();
      return;
    }
    if (installHint) {
      installHint.textContent = /iPad|iPhone|iPod/.test(navigator.userAgent)
        ? 'In Safari, tap Share, then Add to Home Screen. Install CURRENT and LAB from their own pages.'
        : 'Open your browser menu and choose Install app or Add to Home Screen.';
      installHint.hidden = !installHint.hidden;
    }
  });
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    showReady(); showUpdate();
    if (reloadRequested && !reloading) { reloading = true; window.location.reload(); }
  });
  updateButton?.addEventListener('click', () => {
    if (!registration?.waiting) return;
    reloadRequested = true;
    updateButton.disabled = true;
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  });
  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' });
      showReady(); showUpdate();
      function watch(worker) {
        worker?.addEventListener('statechange', () => { showReady(); showUpdate(); });
      }
      watch(registration.installing);
      registration.addEventListener('updatefound', () => watch(registration.installing));
      await navigator.serviceWorker.ready;
      showReady(); showUpdate();
    } catch (error) {
      if (readyBadge) { readyBadge.hidden = false; readyBadge.textContent = 'Offline setup unavailable'; }
      console.warn('ChessBest offline setup unavailable:', error);
    }
  });
})();
