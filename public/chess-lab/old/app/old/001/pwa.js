/* Installation and offline status belong to APP's More dialog. */
(function () {
  'use strict';

  // APP shell polish shared by browser preview, installed PWA and native donor.
  // Keep scroll functional but hide browser scrollbar chrome inside the phone surface.
  const shellStyle = document.createElement('style');
  shellStyle.id = 'app-shell-polish';
  shellStyle.textContent = 'html,body.app-mobile{scrollbar-width:none}html::-webkit-scrollbar,body.app-mobile::-webkit-scrollbar{width:0;height:0;display:none}';
  document.head.appendChild(shellStyle);

  // Canonical channel order: CURRENT · PREVIOUS · LAB · APP.
  const channelNav = document.querySelector('.app-channel-nav');
  if (channelNav) {
    const links = Object.fromEntries([...channelNav.querySelectorAll('a')].map(a => [a.textContent.trim(), a]));
    if (links.CURRENT && links.PREVIOUS && links.LAB && links.APP) {
      const dot = () => { const span = document.createElement('span'); span.setAttribute('aria-hidden', 'true'); span.textContent = '·'; return span; };
      channelNav.replaceChildren(links.CURRENT, dot(), links.PREVIOUS, dot(), links.LAB, dot(), links.APP);
    }
  }

  if (window.Capacitor?.isNativePlatform?.()) return;
  const panel = document.getElementById('appPwaPanel');
  if (!panel) return;
  panel.hidden = false;
  const install = document.getElementById('appPwaInstall');
  const hint = document.getElementById('appPwaHint');
  const status = document.getElementById('appPwaStatus');
  const update = document.getElementById('appPwaUpdate');
  let prompt = null, registration = null, failure = '';
  const standalone = () => window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone;
  function render() {
    install.hidden = !!standalone();
    const ready = !!registration?.active;
    status.textContent = failure || (ready
      ? (navigator.onLine === false
        ? 'Offline · Board, saved studies, bundled games and local Stockfish are available. ChessDB needs internet.'
        : 'Offline files ready · Board, saved studies, bundled games and local Stockfish are available without internet.')
      : 'Preparing offline files… Keep APP open until ready.');
    update.hidden = !registration?.waiting;
    if (standalone()) hint.textContent = 'ChessBest APP is installed.';
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); prompt = event; render();
  });
  window.addEventListener('appinstalled', () => { prompt = null; render(); });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  install.addEventListener('click', async () => {
    if (window.self !== window.top) {
      hint.textContent = 'The desktop frame is for APP preview. Install ChessBest APP from Safari on iPhone or from the browser install menu on Android/desktop.';
      return;
    }
    if (prompt) {
      const current = prompt; prompt = null;
      try { await current.prompt(); await current.userChoice; }
      catch (_) { hint.textContent = 'Use your browser menu to install ChessBest APP.'; }
    } else {
      hint.textContent = 'On iPhone: open this page in Safari → Share → Add to Home Screen. On desktop or Android: use the browser’s Install app menu.';
    }
  });
  async function start() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      failure = 'Offline installation is unavailable in this browser. APP still works online.';
      render(); return;
    }
    try {
      registration = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {
        scope: new URL('./', document.baseURI).href, updateViaCache: 'none'
      });
      function watch() {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'redundant') failure = 'Offline download did not finish. Existing files were retained. Reconnect and reopen APP to retry.';
          render();
        });
        render();
      }
      registration.addEventListener('updatefound', watch);
      watch();
      // Registration.ready is scope-specific; no forced controller switch/reload.
      navigator.serviceWorker.ready.then(render);
    } catch (_) {
      failure = 'Offline setup failed. Reconnect and reopen APP to retry; your saved data was retained.';
      render();
    }
  }
  render();
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
