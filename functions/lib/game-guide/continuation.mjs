import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Domain-separated encryption reuses the existing session secret; no new key/config.
// Tokens contain private conversation state and must never be logged or persisted.
const key = secret => {
  if (typeof secret !== 'string' || secret.length < 48) throw Error('CONTINUATION_UNAVAILABLE');
  return createHmac('sha256', secret).update('game-guide-tool-continuation-v1').digest();
};
export function sealContinuation(state, actor, secret, now = Date.now()) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const raw = JSON.stringify({ ...state, actor: `${actor.role}:${actor.id}`, expires: now + 120000 });
  if (Buffer.byteLength(raw) > 140000) throw Error('TOOL_LIMIT');
  const bytes = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url');
}
export function openContinuation(token, actor, secret, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 200000 || !/^[\w-]+$/.test(token)) throw Error();
    const bytes = Buffer.from(token, 'base64url'), decipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const state = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    if (state.actor !== `${actor.role}:${actor.id}` || state.expires < now || state.deadline < now || !Number.isSafeInteger(state.rounds) || state.rounds > 4) throw Error();
    return state;
  } catch { throw Error('INVALID_CONTINUATION'); }
}
