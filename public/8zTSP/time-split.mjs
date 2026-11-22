// Keep edited decimal values intact; derive the other duration without binary rounding artefacts.
const MAX = 86400;
function decimal(value) {
  const text = String(value).trim(), numeric = Number(text);
  if (!text || text.length > 128 || !Number.isFinite(numeric) || numeric < 0 || numeric > MAX) return null;
  const m = /^\+?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
  if (!m || !(m[1] || m[2]) || Math.abs(Number(m[3] || 0)) > 128) return null;
  let n = BigInt((m[1] || '0') + (m[2] || '')), scale = (m[2] || '').length - Number(m[3] || 0);
  if (scale < 0) { n *= 10n ** BigInt(-scale); scale = 0; }
  while (scale && n % 10n === 0n) { n /= 10n; scale--; }
  return { n, scale, text };
}
function format(n, scale) {
  let text = n.toString().padStart(scale + 1, '0');
  if (scale) text = text.slice(0, -scale) + '.' + text.slice(-scale);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}
function aligned(a, b) {
  const scale = Math.max(a.scale, b.scale);
  return [a.n * 10n ** BigInt(scale - a.scale), b.n * 10n ** BigInt(scale - b.scale), scale];
}
function compare(a, b) { const [x, y] = aligned(a, b); return x < y ? -1 : x > y ? 1 : 0; }
function difference(a, b) { const [x, y, scale] = aligned(a, b); return format(x - y, scale); }
function totalValue(value) {
  const d = decimal(value);
  return d && compare(d, decimal('0.1')) >= 0 && compare(d, decimal('86400')) <= 0 ? d : null;
}
function minimum(t) {
  return compare(t, decimal('0.2')) < 0 ? decimal(format(t.n * 5n, t.scale + 1)) : decimal('0.1');
}
export function minimumPart(total) { const t = totalValue(total); return t ? format(minimum(t).n, minimum(t).scale) : '0.1'; }
export function validSplit(total, first, second) {
  const t = totalValue(total), a = decimal(first), b = decimal(second);
  if (!t || !a || !b) return null;
  const min = minimum(t);
  if (compare(a, min) < 0 || compare(b, min) < 0 || compare(a, t) >= 0) return null;
  if (compare(decimal(difference(t, a)), b) !== 0) return null;
  return { total: t.text, first: a.text, second: b.text, minimum: format(min.n, min.scale) };
}
export function fromFirst(total, first) {
  const t = totalValue(total), a = decimal(first);
  if (!t || !a || compare(a, t) >= 0) return null;
  return validSplit(t.text, a.text, difference(t, a));
}
export function fromSecond(total, second) {
  const t = totalValue(total), b = decimal(second);
  if (!t || !b || compare(b, t) >= 0) return null;
  return validSplit(t.text, difference(t, b), b.text);
}
export function alignSplit(total, duration, part = 'first') {
  const t = totalValue(total); if (!t) return null;
  const min = minimum(t), max = decimal(difference(t, min));
  let a = decimal(duration) || min;
  if (compare(a, min) < 0) a = min;
  if (compare(a, max) > 0) a = max;
  return (part === 'second' ? fromSecond : fromFirst)(t.text, a.text || format(a.n, a.scale));
}
export function suggestSplit(total) {
  const t = totalValue(total); if (!t) return null;
  const first = Math.min(300, Number(t.text) / 12).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return alignSplit(t.text, first);
}
export function runPlan(split, enabled) {
  return {
    enabled, totalSeconds: Number(split.total),
    firstBudgetSeconds: enabled ? Number(split.first) : 0,
    secondBudgetSeconds: enabled ? Number(split.second) : Number(split.total),
    configured: { total: split.total, first: split.first, second: split.second },
    minimumPassSeconds: Number(split.minimum),
  };
}
