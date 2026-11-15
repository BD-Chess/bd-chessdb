/* Page-scoped adapter: existing MDLxDCC locale contract + AI8 toolbar keys/controls.
 * Shared AI8 toolbar CSS is reused. Its legacy script is left unchanged because
 * it owns a separate language state; this page subscribes to MDLxDCCLocale.
 */
const root = document.documentElement;
const toolbar = document.querySelector('[data-ai8-toolbar]');
const locale = window.MDLxDCCLocale;
const get = key => { try { return localStorage.getItem(key); } catch { return null; } };
const put = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
const validScale = value => Number.isFinite(value) && value >= .8 && value <= 1.5;
let theme = get('mdlxdcc-theme') === 'light' ? 'light' : 'dark';
let scale = Number(get('mdlxdcc-font'));
if (!validScale(scale)) scale = 1;
let lang = locale.current();
function apply() {
  root.lang = lang;
  root.dataset.lang = lang;
  root.dataset.theme = theme;
  root.style.setProperty('--scale', String(scale));
  document.querySelectorAll('[data-lang]').forEach(item => {
    if (item === root) return;
    item.hidden = item.dataset.lang !== lang;
    if (item.dataset.lang === lang) item.removeAttribute('hidden');
  });
  document.querySelectorAll('[data-aria-sl][data-aria-en]').forEach(item => {
    item.setAttribute('aria-label', lang === 'sl' ? item.dataset.ariaSl : item.dataset.ariaEn);
  });
  document.querySelectorAll('[data-text-sl][data-text-en]').forEach(item => {
    item.textContent = lang === 'sl' ? item.dataset.textSl : item.dataset.textEn;
  });
  toolbar.querySelectorAll('[data-ai8-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ai8Lang === lang)));
  toolbar.querySelectorAll('[data-ai8-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ai8Theme === theme)));
  toolbar.querySelector('[data-ai8-reset]').textContent = `${Math.round(scale * 100)}%`;
  toolbar.querySelector('[data-ai8-down]').disabled = scale <= .8;
  toolbar.querySelector('[data-ai8-up]').disabled = scale >= 1.5;
  document.title = lang === 'sl' ? root.dataset.titleSl : root.dataset.titleEn;
  document.querySelector('meta[property="og:title"]').content = document.title;
  const description = document.querySelector('meta[name="description"]');
  description.content = lang === 'sl' ? description.dataset.descriptionSl : description.dataset.descriptionEn;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0b1220' : '#f5f7f9';
  document.dispatchEvent(new CustomEvent('ai8:display', {detail: {lang, theme, scale}}));
}
toolbar.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !toolbar.contains(button)) return;
  if (button.dataset.ai8Lang) { locale.choose(button.dataset.ai8Lang); return; }
  if (button.dataset.ai8Theme) { theme = button.dataset.ai8Theme; put('mdlxdcc-theme', theme); }
  else if (button.hasAttribute('data-ai8-reset')) { scale = 1; put('mdlxdcc-font', scale); }
  else if (button.hasAttribute('data-ai8-down') || button.hasAttribute('data-ai8-up')) {
    scale = Math.round(Math.min(1.5, Math.max(.8, scale + (button.hasAttribute('data-ai8-up') ? .05 : -.05))) * 100) / 100;
    put('mdlxdcc-font', scale);
  }
  apply();
});
window.addEventListener('storage', event => {
  if (!['mdlxdcc-theme', 'mdlxdcc-font', null].includes(event.key)) return;
  theme = get('mdlxdcc-theme') === 'light' ? 'light' : 'dark';
  const next = Number(get('mdlxdcc-font'));
  scale = validScale(next) ? next : 1;
  apply();
});
locale.subscribe(value => { lang = value; apply(); });
