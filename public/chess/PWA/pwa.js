/* Applies only to this PWA; board, studies and games retain their own storage. */
(() => {
  const notice = document.getElementById('chessPwaNotice');
  const readyBadge = document.getElementById('chessPwaReady');
  const updateButton = document.getElementById('chessPwaUpdate');
  const workerURL = new URL('sw.js', document.baseURI).href;
  let registration, reloadRequested = false, reloading = false;
  function connection() { if (notice) notice.hidden = navigator.onLine !== false; }
  function showReady() {
    const controller = navigator.serviceWorker.controller;
    if (readyBadge) readyBadge.hidden = !controller || controller.scriptURL !== workerURL;
  }
  function showUpdate() {
    if (updateButton) updateButton.hidden = !registration?.waiting || !navigator.serviceWorker.controller;
  }
  connection();
  window.addEventListener('online', () => { connection(); registration?.update().catch(() => {}); });
  window.addEventListener('offline', connection);
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    showReady();
    if (reloadRequested && !reloading) { reloading = true; window.location.reload(); }
  });
  if (updateButton) updateButton.addEventListener('click', () => {
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
        if (!worker) return;
        worker.addEventListener('statechange', () => { showReady(); showUpdate(); });
      }
      watch(registration.installing);
      registration.addEventListener('updatefound', () => watch(registration.installing));
      await navigator.serviceWorker.ready;
      showReady(); showUpdate();
    } catch (error) {
      if (readyBadge) { readyBadge.hidden = false; readyBadge.textContent = '· Offline setup unavailable'; }
      console.warn('ChessBest offline setup unavailable:', error);
    }
  });
})();
