import { pbkdf2Sync, timingSafeEqual } from 'node:crypto';

const WL_SALT = 'XxwTbo-NM9C76A6jRevw65WFYA1do7gm';
const WL_ITERATIONS = 900000;
const WL_EXPECTED = 'T7FGZgHoRYr23aVKTlLNOvz9DxOZjWt4KPt7fAmC6oc';

function fromBase64Url(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

const SALT = fromBase64Url(WL_SALT);
const EXPECTED = fromBase64Url(WL_EXPECTED);

export function passwordOK(value) {
  const raw = String(value || '');
  if (!raw || raw.length > 200) return false;
  const derived = pbkdf2Sync(raw, SALT, WL_ITERATIONS, EXPECTED.length, 'sha256');
  return derived.length === EXPECTED.length && timingSafeEqual(derived, EXPECTED);
}

export function requestPasswordOK(req) {
  return passwordOK(req.headers.get('x-wl-password'));
}
