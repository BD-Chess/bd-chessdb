import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { database, env } from '../mdlxdcc-guide/access.mjs';
import { charge, reservation } from '../mdlxdcc-guide/cost.mjs';

export const sessionID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function readerAllowed(req, secret = env('GAME_LOG_READ_TOKEN')) {
  const supplied = req.headers.get('authorization')?.match(/^Bearer ([^\s]{32,512})$/)?.[1];
  if (!secret || secret.length < 32 || secret.length > 512 || !supplied) return false;
  const hash = x => createHash('sha256').update(x).digest();
  return timingSafeEqual(hash(secret), hash(supplied));
}
export function actorKey(actor) {
  const secret = env('MDLXDCC_GUIDE_SESSION_SECRET');
  if (!secret || secret.length < 48) throw Error('STORAGE_UNAVAILABLE');
  return createHmac('sha256', secret).update(`game-log-v1:${actor.role}:${actor.id}`).digest('hex');
}
// No account email, IP, cookie, token, history or arbitrary request metadata is stored.
export function privateText(value) {
  return String(value).slice(0, 32000)
    .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, value => isIP(value) ? '[ip]' : value)
    .replace(/[0-9a-f:]*:[0-9a-f:.]+(?:%[a-z0-9]+)?/gi, value => isIP(value) ? '[ip]' : value);
}
export function createLogStore({ rpc = database } = {}) {
  return {
    async start(actor, request) {
      if (actor.role !== 'owner' && request.log_consent !== true) return null;
      const id = request.game_session_id || randomUUID();
      const result = await rpc('game_log_start', { id, actor_key: actorKey(actor), owner: actor.role === 'owner', consent: actor.role === 'owner' || request.log_consent === true, slug: request.slug, development: request.development });
      if (!result?.ok) throw Error('STORAGE_UNAVAILABLE');
      return { id, actor_key: actorKey(actor) };
    },
    async append(log, events) {
      if (!log || !events.length) return;
      const result = await rpc('game_log_append', { id: log.id, actor_key: log.actor_key, events });
      if (!result?.ok) throw Error('STORAGE_UNAVAILABLE');
    },
    read: (id, since) => rpc('game_log_read', { id, since }),
    recent: () => rpc('game_log_recent'),
    remove: (actor, id) => rpc('game_log_delete', { id, actor_key: actorKey(actor) })
  };
}
// Reuse Guide pricing without changing owner exemption or the visitor budget.
export function costRecorder(budget, provider, model, events) {
  const estimates = new WeakMap(); let ownerEstimate;
  return {
    async reserve(payload) {
      const held = await budget.reserve(payload);
      let maximum = null;
      try { maximum = reservation(provider, model, payload); } catch {}
      if (held && typeof held === 'object') estimates.set(held, maximum); else ownerEstimate = maximum;
      events.push({ kind: 'cost', payload: { provider, model, currency: 'USD', nanos: maximum, basis: 'reservation', phase: 'reserved' } });
      return held;
    },
    async settle(held, usage, rejected = false) {
      await budget.settle(held, usage, rejected);
      const maximum = held ? estimates.get(held) ?? held.amount ?? null : ownerEstimate;
      const amount = rejected ? 0 : maximum === null ? null : charge(provider, usage, maximum);
      events.push({ kind: 'cost', payload: { provider, model, currency: 'USD', nanos: amount, phase: 'settled', basis: rejected ? 'rejected' : !usage ? 'reserved_unknown' : maximum === null ? 'unpriced' : 'guide_usage_estimate' } });
    }
  };
}
export function logReadResponse(result) {
  const rows = result?.events;
  if (!Array.isArray(rows)) throw Error('STORAGE_UNAVAILABLE');
  const text = rows.map(row => JSON.stringify(row)).join('\n');
  return new Response(text ? text + '\n' : '', { headers: {
    'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Game-Log-Next-Seq': String(rows.at(-1)?.seq ?? result.since ?? 0)
  } });
}
