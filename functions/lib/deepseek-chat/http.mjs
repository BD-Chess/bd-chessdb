const headers = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie, Origin',
};

export function json(value, status = 200, extra = {}) {
  return Response.json(value, { status, headers: { ...headers, ...extra } });
}

export function originAllowed(req, allowedOrigin) {
  const requestOrigin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;
  if (requestOrigin === allowedOrigin) return true;
  const hasOrigin = requestOrigin !== null && requestOrigin !== 'null';
  if (hasOrigin) return false;
  return req.method === 'POST' ? fetchSite === 'same-origin' : requestOrigin === null;
}

export async function readJson(req, maxBytes) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') ?? '') ||
      !req.body || Number(req.headers.get('content-length')) > maxBytes) return null;
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
