// Packaging-only regression check. No handler is invoked and no key is read.
import { zipFunction } from '@netlify/zip-it-and-ship-it';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const destination = resolve(process.env.RUNNER_TEMP || '.tmp', 'omnicpq-function-preflight');
const entries = (await readdir('functions')).filter(name => /\.(?:mjs|mts|js|ts)$/.test(name)).sort();
for (const name of entries) {
  console.log('Packaging function: ' + name);
  await zipFunction(resolve('functions', name), destination, {
    config: {
      'omnicpq-*': { nodeBundler: 'esbuild' },
      'dualframe-*': { nodeBundler: 'esbuild', externalNodeModules: ['sharp'] },
    },
    repositoryRoot: process.cwd(),
  });
}
console.log(JSON.stringify({ packaged: entries.length, handlerInvocations: 0 }));
