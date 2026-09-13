export const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
export function checkOrigin(req) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) throw Object.assign(Error('ORIGIN_DENIED'), { code: 'ORIGIN_DENIED', status: 403 });
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw Object.assign(Error('ORIGIN_DENIED'), { code: 'ORIGIN_DENIED', status: 403 });
}
export async function readJSON(req, maxBytes = 256 * 1024) {
  if (!/^application\/json(?:;|$)/i.test(req.headers.get('content-type') || '')) throw Object.assign(Error('CONTENT_TYPE_REQUIRED'), { code: 'CONTENT_TYPE_REQUIRED', status: 415 });
  const reader = req.body?.getReader();
  if (!reader) throw Object.assign(Error('INVALID_JSON'), { code: 'INVALID_JSON', status: 400 });
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw Object.assign(Error('PAYLOAD_TOO_LARGE'), { code: 'PAYLOAD_TOO_LARGE', status: 413 }); }
    chunks.push(Buffer.from(value));
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(Error('INVALID_JSON'), { code: 'INVALID_JSON', status: 400 }); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(Error('OBJECT_REQUIRED'), { code: 'OBJECT_REQUIRED', status: 400 });
  return value;
}
export function errorResponse(error) {
  // Never serialize exception stacks, request headers, private payload or SDK errors.
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,100}$/.test(error.code) ? error.code : 'SERVICE_UNAVAILABLE';
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 503;
  return json({ ok: false, error: code }, status);
}
