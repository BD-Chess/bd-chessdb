/* Desktop/tablet preview only. iPhone 16 Pro portrait: 402 x 874 CSS px.
 * 52/34 safe-area simulation is calibrated to BD's 2026-09-30 Home Screen
 * screenshot, not a claim that every iOS/Safari presentation uses these insets.
 * A smaller desktop scales the whole frame; it never resizes the phone height.
 * Normal phone browsers and installed/native play.html keep their real insets.
 */
(function () {
  'use strict';
  if (document.documentElement.classList.contains('app-phone-browser')) return;
  const stage = document.getElementById('previewStage');
  const frame = document.getElementById('phoneFrame');
  const iframe = frame?.querySelector('iframe');
  const selector = document.getElementById('previewWidth');
  const main = document.querySelector('main');
  if (!stage || !frame || !iframe || !selector || !main) return;
  const reference = { width: 402, height: 874, top: 52, bottom: 34 };
  const allowedWidths = new Set([375, 390, 402, 430]);
  let width = reference.width, height = reference.height, scheduled = false;

  function applyInsets() {
    try {
      const page = iframe.contentDocument;
      if (!page?.body?.classList.contains('app-mobile')) return;
      const root = page.documentElement;
      root.style.setProperty('--app-preview-safe-top', reference.top + 'px');
      root.style.setProperty('--app-preview-safe-bottom', reference.bottom + 'px');
      root.dataset.previewDevice = width === reference.width ? 'iphone-16-pro' : 'generic-width';
    } catch (_) { /* Sibling channel navigation must not be modified. */ }
  }
  function fit() {
    scheduled = false;
    const style = getComputedStyle(main), rect = main.getBoundingClientRect();
    const availableWidth = Math.max(1, main.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0));
    const availableHeight = Math.max(1, innerHeight - rect.top - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0));
    const outerWidth = width + 14, outerHeight = height + 14;
    const scale = Math.min(1, availableWidth / outerWidth, availableHeight / outerHeight);
    stage.style.width = outerWidth * scale + 'px';
    stage.style.height = outerHeight * scale + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    stage.dataset.previewScale = String(scale);
  }
  function scheduleFit() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(fit); }
  }
  function selectSize() {
    const selected = Number(selector.value);
    width = allowedWidths.has(selected) ? selected : reference.width;
    // Alternate widths retain the reference aspect ratio, not an unverified
    // named-device profile. The default is the exact 402 x 874 reference.
    height = Math.round(width * reference.height / reference.width);
    frame.style.setProperty('--phone-width', width + 'px');
    frame.style.setProperty('--phone-height', height + 'px');
    stage.dataset.viewport = width + 'x' + height;
    applyInsets(); scheduleFit();
  }
  const previewKeyTarget = {
    ArrowLeft: 'prev',
    ArrowRight: 'next',
    ArrowUp: 'first',
    ArrowDown: 'last'
  };
  document.addEventListener('keydown', event => {
    const targetId = previewKeyTarget[event.key];
    if (!targetId || event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target;
    if (target?.closest?.('input, select, textarea, button, a[href], [contenteditable="true"]')) return;
    try {
      const page = iframe.contentDocument;
      const button = page?.getElementById(targetId);
      if (!page?.body?.classList.contains('app-mobile') || !button || button.disabled) return;
      event.preventDefault();
      button.click();
    } catch (_) { /* Same-origin APP preview only; sibling channels are untouched. */ }
  });
  selector.addEventListener('change', selectSize);
  iframe.addEventListener('load', () => { applyInsets(); scheduleFit(); });
  addEventListener('resize', scheduleFit);
  if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleFit).observe(document.querySelector('body > header'));
  document.fonts?.ready.then(scheduleFit);
  selectSize();
})();
