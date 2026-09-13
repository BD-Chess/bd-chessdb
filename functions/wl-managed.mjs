import { getStore } from '@netlify/blobs-wl';
import { requestPasswordOK } from './wl-auth.mjs';
import { createAtomicStore, passwordDataKey } from './_wl/store.mjs';
import { createManagedHandler, initialState } from './_wl/service.mjs';

export function makeOwnerStore(req) {
  // No persistent root key or password is written to tasks, GitHub, or logs.
  // This verified owner-only mode intentionally does not claim unattended access.
  return createAtomicStore({ blobs: getStore({ name: 'wl-managed-v1', consistency: 'strong' }),
    key: passwordDataKey(req.headers.get('x-wl-password')), initial: initialState });
}
async function getSnapshot(req) {
  try {
    const response = await fetch(new URL('/data/PREAI8_STATUS.json', req.url), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const body = await response.text(); if (body.length > 65536) return null;
    return JSON.parse(body);
  } catch { return null; }
}
export default createManagedHandler({ authenticate: requestPasswordOK, makeStore: makeOwnerStore, getSnapshot });
export const config = { path: '/api/wl/managed', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
