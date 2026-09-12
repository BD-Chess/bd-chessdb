import { pbkdf2Sync, timingSafeEqual } from 'node:crypto';

const WL_SALT = '666QQVR-KaMq-6zT3ShbB9J9CgfFR6nL';
const WL_ITERATIONS = 900000;
const WL_EXPECTED = 'ugok6Ee3ktkqvXdwbw-RIO6xYC_mV6zhIBDufQL5_Lg';

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
