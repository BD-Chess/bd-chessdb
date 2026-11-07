import { getStore } from '@netlify/blobs';
import { createStartSync } from './lib/bd-start-sync.mjs';

// End-to-end encrypted BD Start sync; see functions/lib/bd-start-sync.mjs.
export default async req => createStartSync({ store: getStore({ name: 'bd-start-sync-v1', consistency: 'strong' }) })(req);

export const config = { path: '/api/bd-start-sync', rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
