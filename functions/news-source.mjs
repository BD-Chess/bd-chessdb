import {loadSource, SourceError} from './lib/news-source.mjs';
import {createHmac, randomBytes} from 'node:crypto';
import {isIP} from 'node:net';

// Best effort per warm function instance, not a distributed or provider-enforced
// limit. Existing edge rules remain untouched. Only the trusted Netlify context
// supplies the IP; request headers do not choose another visitor's bucket.
export function createWarmThrottle({now = Date.now, limit = 20, windowMs = 60000, capacity = 2048} = {}) {
  const buckets = new Map();
  const salt = randomBytes(32);
  let lastSweep = now();
  return {
    take(ip) {
      if (typeof ip !== 'string' || !isIP(ip)) return {allowed: true};
      const time = now();
      if (time - lastSweep >= windowMs || buckets.size >= capacity) {
        for (const [key, row] of buckets) if (row.until <= time) buckets.delete(key);
        lastSweep = time;
      }
      const key = createHmac('sha256', salt).update(ip).digest('hex');
      let bucket = buckets.get(key);
      if (!bucket || bucket.until <= time) {
        if (!bucket && buckets.size >= capacity) buckets.delete(buckets.keys().next().value);
        bucket = {count: 0, until: time + windowMs};
        buckets.set(key, bucket);
      }
      if (bucket.count >= limit) return {allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.until - time) / 1000))};
      bucket.count++;
      return {allowed: true};
    },
    size: () => buckets.size,
  };
}

export function createNewsSourceHandler({load = loadSource, throttle = createWarmThrottle()} = {}) {
  return async function newsSource(request, context) {
    const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
    if (request.method !== 'GET') return Response.json({ok: false, error: 'METHOD_NOT_ALLOWED'}, {status: 405, headers: {...headers, Allow: 'GET'}});
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return Response.json({ok: false, error: 'Zajem je namenjen strani AI8 News.'}, {status: 403, headers});
    if (url.searchParams.getAll('url').length !== 1) return Response.json({ok: false, error: 'Vnesi eno povezavo do članka.'}, {status: 400, headers});
    const budget = throttle.take(context?.ip);
    if (!budget.allowed) return Response.json({ok: false, code: 'SOURCE_RATE_LIMIT', error: 'Preveč zajemov zapored. Poskusi znova čez minuto.'},
      {status: 429, headers: {...headers, 'Retry-After': String(budget.retryAfter)}});
    try {
      const article = await load(url.searchParams.get('url'));
      return Response.json({ok: true, article}, {headers});
    } catch (error) {
      return Response.json({ok: false, error: error instanceof SourceError ? error.message : 'Vira ni mogoče prebrati.',
        code: error instanceof SourceError ? error.code : 'SOURCE_UNAVAILABLE'}, {status: error instanceof SourceError ? error.status : 422, headers});
    }
  };
}

export default createNewsSourceHandler();
export const config = {path: '/api/news-source'};
