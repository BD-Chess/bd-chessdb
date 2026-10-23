import { APP_VERSION } from './version.mjs';
export { APP_VERSION };
export const uuid = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
// Hashing is also useful in a plain HTTP preview where SubtleCrypto is absent.
// This fallback is only SHA-256; it never implements login or encryption.
export function sha256Portable(input) {
  const length = input.length, padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64); padded.set(input); padded[length] = 128;
  const view = new DataView(padded.buffer); view.setUint32(padded.length - 8, Math.floor(length / 0x20000000)); view.setUint32(padded.length - 4, length << 3);
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Uint32Array(64);
  const rot = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) { const x = w[i-15], y = w[i-2]; w[i] = (w[i-16] + (rot(x,7)^rot(x,18)^(x>>>3)) + w[i-7] + (rot(y,17)^rot(y,19)^(y>>>10))) >>> 0; }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (j + (rot(e,6)^rot(e,11)^rot(e,25)) + ((e&f)^((~e)&g)) + k[i] + w[i]) >>> 0;
      const t2 = ((rot(a,2)^rot(a,13)^rot(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0;
      j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    const temp=[a,b,c,d,e,f,g,j]; for (let i=0;i<8;i++) h[i]=(h[i]+temp[i])>>>0;
  }
  return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
export async function digest(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  if (!globalThis.crypto?.subtle) return sha256Portable(bytes);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function canonicalInput({ message, mode, service, context, snapshot, browser = null, history = [] }) {
  return JSON.stringify({ message: message.trim(), mode, service: service || null,
    history: history.map(({ role, content }) => ({ role, content })),
    context: { text: context.text || '', manualUrl: context.manualUrl || '', environment: context.environment || 'UNKNOWN' },
    snapshot: snapshot ? { id: snapshot.id, sha256: snapshot.sha256, capturedAt: snapshot.capturedAt, method: snapshot.method } : null,
    ...(browser ? {browser} : {}) });
}
export async function* sseEvents(body, signal) {
  const reader = body.getReader(), decoder = new TextDecoder(); let buffer = '';
  try { while (true) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const { value, done } = await reader.read(); buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n'); let end;
    if (buffer.length > 1_000_000) throw Error('Neveljaven odgovor strežnika.');
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
      if (data) yield JSON.parse(data);
    }
    if (done) break;
  }} finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function structured(text) {
  if (typeof text !== 'string') return null;
  for (const m of text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)) {
    try {
      const data = JSON.parse(m[1]);
      if (data.schema === 'omnicpq.lifecycle-output.v1' && ['TEST_PLAN','BUSINESS_REQUIREMENT'].includes(data.kind)) return data;
    } catch {}
  }
  try { const data = JSON.parse(text.trim()); if (data.schema === 'omnicpq.lifecycle-output.v1' && ['TEST_PLAN','BUSINESS_REQUIREMENT'].includes(data.kind)) return data; } catch {}
  return null;
}
// Non-mutating checks. Format checks never manufacture business approval or execution.
export { lifecycleIssues } from './lifecycle-validation.mjs';

// The private server checked its pinned schema and graph; bind that verdict to
// this exact complete answer. Old/unverified/partial exports remain raw-only.
export function hasValidLifecycle(message) {
  const v = message?.meta?.lifecycleValidation;
  return Boolean(message?.status === 'complete' && typeof message.content === 'string' &&
    v?.state === 'VALID' && typeof v.schemaSha256 === 'string' && v.schemaSha256 === message.meta?.skill?.outputSchemaSha256 &&
    v.contentSha256 === sha256Portable(new TextEncoder().encode(message.content)));
}
export function canExportTests(message) {
  const data = structured(message?.content || '');
  return Boolean(hasValidLifecycle(message) && data?.kind === 'TEST_PLAN' && Array.isArray(data.tests) && data.tests.length &&
    data.tests.every(t => t && typeof t === 'object' && !Array.isArray(t)));
}
export function csv(rows) {
  if (!rows.length) return '';
  const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const cell = value => {
    let str = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(str)) str = "'" + str;
    return '"' + str.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [fields, ...rows.map(row => fields.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\r\n');
}
export function exportSession(state) {
  // Explicit export is the only path out of memory. No cookies, images, or credentials.
  return { schema: 'omnicpq.session.v1', appVersion: APP_VERSION, exportedAt: new Date().toISOString(),
    release: state.release || {source_sha:'UNKNOWN',fingerprint:'UNKNOWN'},
    mode: state.mode, messages: state.messages.map(({ role, content, meta, status, input, startedAt, ttftMs, totalMs }) =>
      ({ role, content, meta, status, input, startedAt, ttftMs, totalMs })), comparisons: state.comparisons || [] };
}

