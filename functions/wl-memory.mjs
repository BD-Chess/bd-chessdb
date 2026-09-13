import { requestPasswordOK } from './wl-auth.mjs';
import { makeOwnerStore } from './wl-managed.mjs';
import { createMemoryHandler } from './_wl/service.mjs';
export default createMemoryHandler({ authenticate: requestPasswordOK, makeStore: makeOwnerStore });
export const config = { path: '/api/wl/memory', rateLimit: { windowLimit: 15, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
