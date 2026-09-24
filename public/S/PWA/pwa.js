'use strict';

if ('serviceWorker' in navigator) {
  const status = document.getElementById('pwaStatus');
  const updateStatus = () => {
    if (!status) return;
    status.hidden = false;
    status.textContent = navigator.onLine ? 'OFFLINE READY' : 'OFFLINE';
  };

  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      updateStatus();
      window.addEventListener('online', updateStatus);
      window.addEventListener('offline', updateStatus);
    })
    .catch(error => console.warn('Sudoku offline setup failed:', error));
}
