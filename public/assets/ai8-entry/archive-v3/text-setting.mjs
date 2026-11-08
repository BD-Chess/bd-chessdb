const key = 'ai8-dna-text';
export function textEnabled() {
  try { return localStorage.getItem(key) !== 'off'; } catch { return true; }
}
export function setTextEnabled(enabled) {
  try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch {}
  apply(enabled);
}
function apply(enabled = textEnabled()) {
  document.documentElement.classList.toggle('dna-text-off', !enabled);
  document.querySelectorAll('[data-dna-text]').forEach(input => { input.checked = enabled; });
  document.dispatchEvent(new CustomEvent('ai8-dna:text', {detail: {enabled}}));
}
document.addEventListener('change', event => {
  if (event.target.matches('[data-dna-text]')) setTextEnabled(event.target.checked);
});
window.addEventListener('storage', event => { if (event.key === key || event.key === null) apply(); });
apply();
