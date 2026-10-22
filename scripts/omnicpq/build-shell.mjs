import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../public/OmniCPQ/', import.meta.url);
const files = ['index.html','app.css','app.mjs','core.mjs','lifecycle-validation.mjs','prompts.mjs','manifest.webmanifest',
  'icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png','icons/original.png'];
const hashes = {};
for (const name of files) hashes[name] = createHash('sha256').update(await readFile(new URL(name, root))).digest('hex');
const release = createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0, 20);
let sw = await readFile(new URL('sw.js', root), 'utf8');
sw = sw.replace(/const RELEASE = '[^']+';/, `const RELEASE = '${release}';`);
await writeFile(new URL('sw.js', root), sw);
await writeFile(new URL('shell-integrity.json', root), JSON.stringify({ schema: 'omnicpq.shell_integrity.v1', release, files: hashes }, null, 2) + '\n');
console.log(JSON.stringify({ release, files: files.length }));
