/* PWA bootstrap. Gameplay, AI, and stored experiments remain in the LAB-derived app. */
(() => {
  'use strict';
  const status = document.getElementById('pwa-status');
  const update = () => {
    if (status) status.textContent = navigator.onLine
      ? 'Offline ready · pripravljeno brez povezave'
      : 'Brez povezave · lokalna igra deluje';
  };
  if (!('serviceWorker' in navigator)) {
    if (status) status.textContent = 'Način brez povezave v tem brskalniku ni na voljo';
    return;
  }
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
    })
    .catch(error => {
      console.warn('Flip4M PWA setup failed:', error);
      if (status) status.textContent = 'Način brez povezave ni pripravljen';
    });
})();
