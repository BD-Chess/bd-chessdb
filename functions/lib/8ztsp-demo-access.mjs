// Access requests for the password-protected »8zTSP in your browser« demo (BD × AI Lab, 15 Nov 2026).
// POST is public (the lock page's request form): one request = one record in Netlify Blobs, BD decides per person.
// GET (list) and DELETE (one record) need the read token. Netlify holds only the token's SHA-256
// (DEMO_ACCESS_READ_TOKEN_SHA256); the token itself is only in a local file, never in git.
// What is stored, as the form's note says: e-mail and message, date and time, IP address and the approximate location
// Netlify derives from it (city, region, country, timezone), browser (user agent) and languages, the page the visitor
// came from. No cookies, no fingerprinting. Blobs have no expiry, so every call deletes records older than 365 days.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const KEEP_DAYS = 365;
const DAY_MS = 86400000;
const PREFIX = 'req/';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^\d{8}T\d{6}Z-[0-9a-f]{12}$/;
export const LIMITS = { body: 4096, email: 254, why: 500, ua: 500, lang: 200, tz: 64, ref: 300, page: 200 };

// Plain one-line text: control characters become spaces, then trimmed and cut.
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extra
    }
  });
}

// 2026-11-15T12:01:02.345Z -> 20261115T120102Z (keys sort by time)
const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
function keyTime(key) {
  const m = /^req\/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/.exec(key);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
}

export function createDemoAccess({ store, readTokenSha256 = '', now = () => Date.now(), newId = () => randomBytes(6).toString('hex') }) {
  async function purge() {
    const { blobs } = await store.list({ prefix: PREFIX });
    const oldest = now() - KEEP_DAYS * DAY_MS;
    let purged = 0;
    for (const { key } of blobs) {
      const t = keyTime(key);
      if (Number.isFinite(t) && t < oldest) { await store.delete(key); purged++; }
    }
    return purged;
  }

  // null = not configured (no valid hash in the environment), else true/false.
  function authorized(req) {
    const want = String(readTokenSha256 || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(want)) return null;
    const m = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.headers.get('authorization') || '');
    const have = createHash('sha256').update(m ? m[1] : '', 'utf8').digest();
    return timingSafeEqual(have, Buffer.from(want, 'hex')) && m !== null;
  }

  async function post(req, context) {
    const text = await req.text();
    if (text.length > LIMITS.body) return json({ ok: false, error: 'size' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ ok: false, error: 'json' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'json' }, 400);
    // Honeypot: a field people never see. Answer as if accepted, store nothing, notify nobody.
    if (clip(body.company, 200)) return json({ ok: true });
    const email = clip(body.email, LIMITS.email + 1).toLowerCase();
    if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) return json({ ok: false, error: 'email' }, 400);

    const t = now();
    const geo = context?.geo || {};
    const page = clip(body.page, LIMITS.page);
    const record = {
      v: 1,
      receivedAt: new Date(t).toISOString(),
      email,
      why: clip(body.why, LIMITS.why),
      ip: clip(context?.ip, 80),
      location: {
        city: clip(geo.city, 80),
        region: clip(geo.subdivision?.name, 80),
        country: clip(geo.country?.name, 80),
        countryCode: clip(geo.country?.code, 8),
        timezone: clip(geo.timezone, LIMITS.tz)
      },
      userAgent: clip(req.headers.get('user-agent'), LIMITS.ua),
      acceptLanguage: clip(req.headers.get('accept-language'), LIMITS.lang),
      browserLanguages: clip(body.lang, LIMITS.lang),
      browserTimezone: clip(body.tz, LIMITS.tz),
      referrer: clip(body.ref, LIMITS.ref),
      page: page.startsWith('/') ? page : ''
    };
    const id = `${stamp(t)}-${newId()}`;
    await store.setJSON(PREFIX + id, record);
    try { await purge(); } catch (err) { console.error('8ztsp-demo-access: purge failed', err); }
    const where = [record.location.city, record.location.region, record.location.country].filter(Boolean).join(', ');
    // The lock page passes these to the hidden Netlify form, whose e-mail notification reaches BD at once.
    const notify = {
      email,
      why: record.why,
      received_at: record.receivedAt,
      ip: record.ip,
      location: where,
      user_agent: record.userAgent,
      language: record.browserLanguages || record.acceptLanguage,
      timezone: record.browserTimezone || record.location.timezone,
      referrer: record.referrer,
      page: record.page,
      request_id: id
    };
    return json({ ok: true, id, receivedAt: record.receivedAt, notify });
  }

  async function list() {
    const purged = await purge();
    const { blobs } = await store.list({ prefix: PREFIX });
    const requests = [];
    for (const key of blobs.map(b => b.key).sort()) {
      const r = await store.get(key, { type: 'json' });
      if (r) requests.push({ id: key.slice(PREFIX.length), ...r });
    }
    return json({ ok: true, keepDays: KEEP_DAYS, purged, count: requests.length, requests });
  }

  return async (req, context) => {
    const method = req.method;
    if (method === 'POST') return post(req, context);
    if (method !== 'GET' && method !== 'DELETE') return json({ ok: false, error: 'method' }, 405, { Allow: 'GET, POST, DELETE' });
    const ok = authorized(req);
    if (ok === null) return json({ ok: false, error: 'unavailable' }, 503);
    if (!ok) return json({ ok: false, error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });
    if (method === 'GET') return list();
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!ID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);
    await store.delete(PREFIX + id);
    return json({ ok: true, deleted: id });
  };
}
