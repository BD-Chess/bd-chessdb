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
        ? 'Brez povezave: knjižnični TSP in Direct Line delujeta lokalno. Za odklep MDL potrebuješ povezavo.'
        : 'Offline: library TSP and Direct Line run locally. Unlocking MDL requires a connection.';
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
