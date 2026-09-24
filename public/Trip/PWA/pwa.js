(() => {
  'use strict';
  const notice = document.getElementById('offlineNotice');
  const pagesOnly = location.hostname === 'bd-chess.github.io';
  if (pagesOnly) document.body.classList.add('pwa-pages-mode');
  const update = () => {
    if (!notice) return;
    notice.hidden = navigator.onLine && !pagesOnly;
    if (!navigator.onLine) {
      notice.textContent = window.MDLxDCCLocale?.current() === 'sl'
        ? 'Brez povezave: shranjene strani in Direct Line z vnesenimi koordinatami delujejo. Spletna navigacija, zemljevid in AI potrebujejo povezavo.'
        : 'Offline: saved pages and Direct Line with entered coordinates work. Online navigation, maps and AI need a connection.';
    } else if (pagesOnly) {
      notice.textContent = window.MDLxDCCLocale?.current() === 'sl'
        ? 'GitHub Pages: optimizacija Direct Line deluje z vnesenimi koordinatami. Cestne razdalje, vgrajeni zemljevid in AI tukaj niso na voljo.'
        : 'GitHub Pages: Direct Line works with entered coordinates. Road distances, the embedded map and AI are unavailable here.';
    }
  };
  addEventListener('online', update);
  addEventListener('offline', update);
  window.MDLxDCCLocale?.subscribe(update);
  update();
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', {scope:'./', updateViaCache:'none'})
        .catch(error => console.warn('[8Z Trip] Offline setup unavailable:', error));
    }, {once:true});
  }
})();
