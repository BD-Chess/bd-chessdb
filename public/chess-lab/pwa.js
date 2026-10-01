/* One LAB PWA. Phone browsers share the LAB release; Capacitor native builds bypass service workers. */
(() => {
  const notice = document.getElementById('chessPwaNotice');
  const labLink = document.getElementById('chessPwaLabLink');
  const labHint = document.getElementById('chessPwaLabHint');
  const installButton = document.getElementById('chessPwaInstall');
  const installHint = document.getElementById('chessPwaHint');
  const updateButton = document.getElementById('chessPwaUpdate');
  const mobilePanel = document.getElementById('appPwaPanel');
  const mobileInstall = document.getElementById('appPwaInstall');
  const mobileHint = document.getElementById('appPwaHint');
  const mobileStatus = document.getElementById('appPwaStatus');
  const mobileUpdate = document.getElementById('appPwaUpdate');
  const workerURL = new URL('sw.js', document.baseURI).href;
  const native = !!window.Capacitor?.isNativePlatform?.();
  let registration, installPrompt, reloadRequested = false, reloading = false;
  const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const mobileMode = () => document.body.classList.contains('app-mobile');

  function render() {
    if (notice) notice.hidden = navigator.onLine !== false;
    const controller = navigator.serviceWorker?.controller;
    const ready = !!controller && controller.scriptURL === workerURL;
    const message = ready ? 'LAB · Offline ready' : 'LAB · Installable; offline after the first complete download';
    if (labLink?.getAttribute('aria-current') === 'page') labLink.title = message;
    if (labHint) labHint.textContent = message;
    const installed = standalone(), waiting = !!registration?.waiting && !!controller;
    if (installButton) installButton.hidden = installed || native;
    if (updateButton) updateButton.hidden = !waiting || native;
    if (mobilePanel) mobilePanel.hidden = !mobileMode() || native;
    if (mobileInstall) mobileInstall.hidden = installed || native;
    if (mobileUpdate) mobileUpdate.hidden = !waiting || native;
    if (mobileStatus && mobileMode() && !native) mobileStatus.textContent = ready
      ? (navigator.onLine === false ? 'Offline · Board, saved studies, bundled games and local Stockfish are available.' : 'Offline files ready · same LAB release as the browser.')
      : 'Preparing offline files… Keep LAB open until ready.';
  }
  function manualHelp() {
    const text = /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'In Safari, tap Share, then Add to Home Screen.' : 'Open your browser menu and choose Install app or Add to Home Screen.';
    if (installHint) { installHint.textContent = text; installHint.hidden = false; }
    if (mobileHint) mobileHint.textContent = text;
  }
  async function requestInstall() {
    if (!installPrompt) { manualHelp(); return; }
    const prompt = installPrompt; installPrompt = null;
    try { await prompt.prompt(); await prompt.userChoice; } catch (_) {}
    render();
  }
  function activateUpdate() {
    if (!registration?.waiting) return;
    reloadRequested = true;
    if (updateButton) updateButton.disabled = true;
    if (mobileUpdate) mobileUpdate.disabled = true;
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  }

  document.addEventListener('chess:mobile-ready', render);
  window.addEventListener('online', () => { render(); registration?.update().catch(() => {}); });
  window.addEventListener('offline', render);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; render(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; render(); });
  installButton?.addEventListener('click', requestInstall);
  mobileInstall?.addEventListener('click', requestInstall);
  updateButton?.addEventListener('click', activateUpdate);
  mobileUpdate?.addEventListener('click', activateUpdate);

  if (native) {
    if (installButton) installButton.hidden = true;
    if (updateButton) updateButton.hidden = true;
    if (mobilePanel) mobilePanel.hidden = true;
    return;
  }
  render();
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    render();
    if (reloadRequested && !reloading) { reloading = true; window.location.reload(); }
  });
  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' });
      const watch = worker => worker?.addEventListener('statechange', render);
      watch(registration.installing);
      registration.addEventListener('updatefound', () => watch(registration.installing));
      await navigator.serviceWorker.ready;
      render();
    } catch (error) {
      if (labLink?.getAttribute('aria-current') === 'page') {
        labLink.title = 'LAB · Offline setup unavailable; reopen while connected';
        if (labHint) labHint.textContent = labLink.title;
      }
      if (mobileStatus) mobileStatus.textContent = 'Offline setup unavailable; reconnect and reopen LAB.';
      console.warn('ChessBest offline setup unavailable:', error);
    }
  });
})();
