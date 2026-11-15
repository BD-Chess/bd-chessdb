import { getStore } from '@netlify/blobs';
import { createDemoAccess } from './lib/8ztsp-demo-access.mjs';

// Access requests for the password-protected 8zTSP demo; see functions/lib/8ztsp-demo-access.mjs.
// The read token itself is never in git or on Netlify: it lives only in a local private file. Here is its SHA-256;
// a hash of a 256-bit random token gives nothing away. DEMO_ACCESS_READ_TOKEN_SHA256 (functions scope) overrides it.
const READ_TOKEN_SHA256 = 'ef37e8a30bb688a10e8da37af78e737f6df8da6d3a79dc5f5921f4f8e12cfb4e';

export default async (req, context) => createDemoAccess({
  store: getStore({ name: '8ztsp-demo-access-v1', consistency: 'strong' }),
  readTokenSha256: Netlify.env.get('DEMO_ACCESS_READ_TOKEN_SHA256') || READ_TOKEN_SHA256
})(req, context);

export const config = {
  path: '/api/8ztsp-demo-access',
  method: ['GET', 'POST', 'DELETE'],
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
