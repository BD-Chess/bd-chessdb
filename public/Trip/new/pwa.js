(() => {
  'use strict';
  const notice = document.getElementById('offlineNotice');
  const update = () => {
    if (!notice) return;
    notice.hidden = navigator.onLine;
    if (!navigator.onLine) {
      notice.textContent = window.MDLxDCCLocale?.current() === 'sl'
        ? 'Brez povezave: na voljo so shranjene strani in način Direct Line z znanimi koordinatami. Zemljevid, cestne razdalje, AI in odklep potrebujejo internet.'
        : 'Offline: saved pages and Direct Line with known coordinates are available. Maps, road distances, AI and unlock need internet.';
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
