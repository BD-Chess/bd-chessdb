/* LAB is unchanged; this registration applies only to the /chess/PWA/ copy. */
(() => {
  const notice = document.getElementById('chessPwaNotice');
  const readyBadge = document.getElementById('chessPwaReady');
  function updateConnection() { notice.hidden = navigator.onLine !== false; }
  updateConnection();
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);

  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
      if (readyBadge) readyBadge.hidden = false;
    } catch (error) {
      console.warn('ChessBest offline setup unavailable:', error);
    }
  });
})();
