import { privateText } from './log.mjs';

// Never accept request headers, provider envelopes, reasoning or continuation tokens.
// Tool arguments and prose are untrusted; bound and redact them before persistence.
const secretKey = /authorization|cookie|password|secret|token|api.?key|credential/i;
const redact = value => privateText(value)
  .replace(/\b(?:sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{12,})\b/gi, '[credential]')
  .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [credential]')
  .replace(/\b(?:api[_ -]?key|authorization|cookie|password|token|secret)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, '[credential]')
  .replace(/\b(?:__Host-|__Secure-)[a-z0-9_-]+=[^\s,;]+/gi, '[cookie]')
  .slice(0, 8000);
export function diagnosticValue(value, depth = 0) {
  if (depth > 5) return '[depth limit]';
  if (typeof value === 'string') return redact(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.slice(0, 48).map(v => diagnosticValue(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40)
    .map(([k, v]) => [redact(k), secretKey.test(k) ? '[credential]' : diagnosticValue(v, depth + 1)]));
  return null;
}
// Usage holds only integer token counts; its *_tokens keys must not hit the credential-key redaction.
const usageValue = usage => usage && typeof usage === 'object' ? Object.fromEntries(Object.entries(usage).slice(0, 16)
  .filter(([k, v]) => /^[a-z0-9_]{1,32}$/.test(k) && (v === null || (Number.isSafeInteger(v) && v >= 0)))) : null;
export function diagnosticEvent(phase, fields) {
  const { usage, ...rest } = fields;
  const measured = usage !== undefined ? { usage: usageValue(usage), stop_reason: diagnosticValue(fields.stop_reason ?? null) } : {};
  const payload = { ...diagnosticValue({ ...rest, phase }), ...measured };
  // Stay below the database's 160000-byte event limit, including UTF-8 expansion.
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 120000) {
    return { kind: 'guide_trace', payload: { phase, provider: fields.provider, model: fields.model, effort: fields.effort, truncated: true, round_count: fields.round_count,
      ...measured, preview: JSON.stringify(payload).slice(0, 12000) } };
  }
  return { kind: 'guide_trace', payload };
}
