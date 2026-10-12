(() => {
  'use strict';
  const cards = [...document.querySelectorAll('.vs-card')];
  const dialog = document.getElementById('vs-viewer');
  const photo = document.getElementById('vs-viewer-image');
  const title = document.getElementById('vs-viewer-title');
  const caption = document.getElementById('vs-viewer-caption');
  const counter = document.getElementById('vs-counter');
  const modeButton = document.getElementById('vs-quality');
  const qualityState = document.getElementById('vs-quality-state');
  const download = document.getElementById('vs-download');
  if (!dialog || !cards.length) return;
  let active = 0;
  let quality = 'hd';
  let origin = null;
  const filename = url => url.split('/').pop();
  const refresh = () => {
    const card = cards[active];
    const src = quality === '4k' ? card.dataset['4k'] : card.dataset.hd;
    const label = quality === '4k' ? '4K original' : 'HD preview';
    photo.alt = 'Illuminara visual series image ' + String(active + 1).padStart(2, '0') + ': ' + card.dataset.title;
    photo.src = src;
    title.textContent = card.dataset.title;
    caption.textContent = card.dataset.caption;
    counter.textContent = String(active + 1).padStart(2, '0') + ' / ' + cards.length;
    modeButton.textContent = quality === '4k' ? 'Return to HD' : 'Load 4K original';
    modeButton.setAttribute('aria-pressed', String(quality === '4k'));
    qualityState.textContent = label;
    download.href = src;
    download.download = filename(src);
    download.textContent = quality === '4k' ? 'Save 4K' : 'Save HD';
  };
  const go = next => {
    active = (next + cards.length) % cards.length;
    quality = 'hd'; // Always return to HD when navigating.
    refresh();
  };
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
    active = Number(button.dataset.open);
    quality = 'hd';
    origin = button;
    refresh();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { window.location.href = cards[active].dataset.hd; }
  }));
  document.getElementById('vs-close').addEventListener('click', () => dialog.close());
  document.getElementById('vs-prev').addEventListener('click', () => go(active - 1));
  document.getElementById('vs-next').addEventListener('click', () => go(active + 1));
  modeButton.addEventListener('click', () => {
    quality = quality === 'hd' ? '4k' : 'hd';
    refresh();
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { photo.removeAttribute('src'); if (origin) origin.focus(); });
  document.addEventListener('keydown', event => {
    if (!dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(active - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(active + 1); }
  });
  let touchStart = null;
  dialog.addEventListener('touchstart', event => {
    if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  dialog.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) go(active + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();