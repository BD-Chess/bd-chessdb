/* Current score explanations live in the browser's modal top layer, outside card layout. */
(() => {
  'use strict';
  if (document.querySelector('[data-reader-ratings-dialog]')) return;
  const language = () => document.documentElement.lang === 'sl' ? 'sl' : 'en';
  const labels = () => language() === 'sl'
    ? {open: 'Odpri razlago ocene', close: 'Zapri razlago ocene', pending: 'Ocena še ni pripravljena'}
    : {open: 'Open score explanation', close: 'Close score explanation', pending: 'Score pending'};
  for (const pending of document.querySelectorAll('.reader-rating-pending')) {
    pending.textContent = '—';
    pending.title = labels().pending;
    pending.setAttribute('aria-label', labels().pending);
  }
  const ratings = document.querySelectorAll('details.reader-rating');
  if (!ratings.length) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'reader-rating-dialog';
  dialog.className = 'reader-rating-dialog';
  dialog.setAttribute('data-reader-ratings-dialog', '');
  dialog.setAttribute('aria-labelledby', 'reader-rating-dialog-title');
  const header = document.createElement('div');
  header.className = 'reader-rating-dialog-header';
  const heading = document.createElement('h2');
  heading.id = 'reader-rating-dialog-title';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'reader-rating-close';
  close.textContent = '×';
  header.append(heading, close);
  dialog.append(header);
  document.body.append(dialog);
  let trigger = null;
  let shownBody = null;
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => trigger?.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  for (const details of ratings) {
    const summary = details.querySelector('summary');
    const score = summary?.querySelector('strong');
    const body = details.querySelector('.reader-rating-body');
    if (!summary || !score || !body) continue;
    const value = score.textContent.trim().replace(/\s+/g, ' ');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reader-score-button';
    button.setAttribute('data-reader-rating', details.getAttribute('data-reader-rating'));
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'reader-rating-dialog');
    button.setAttribute('aria-label', value + ' — ' + labels().open);
    button.setAttribute('data-aria-en', value + ' — Open score explanation');
    button.setAttribute('data-aria-sl', value + ' — Odpri razlago ocene');
    button.title = labels().open;
    button.append(score);
    body.remove();
    details.replaceWith(button);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      trigger = button;
      shownBody?.remove();
      shownBody = body;
      for (const item of body.querySelectorAll('[data-language-content]')) item.hidden = item.getAttribute('data-language-content') !== language();
      heading.textContent = value;
      close.setAttribute('aria-label', labels().close);
      close.title = labels().close;
      dialog.append(body);
      if (!dialog.open) dialog.showModal();
      close.focus();
    });
  }
})();
