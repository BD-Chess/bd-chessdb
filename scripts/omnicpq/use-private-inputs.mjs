// Install only the original pinned v15 inputs supplied separately from source/.
// No network, credentials, provider call, or public output.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SKILL, hash } from '../../functions/lib/omnicpq/identity.mjs';
import { verifyPack } from '../../functions/lib/omnicpq/knowledge.mjs';
const folder = resolve(process.argv[2] || '../private-inputs');
const zip = await readFile(resolve(folder, 'AI_Pomocnik_za_OmniCPQ_SKILL_v15.zip'));
if (await hash(zip) !== SKILL.zipSha256) throw Error('Original v15 ZIP hash mismatch');
const text = await readFile(resolve(folder, 'knowledge.json'), 'utf8');
const verified = await verifyPack(text);
await mkdir('.private/omnicpq', { recursive: true, mode: 0o700 });
await writeFile('.private/omnicpq/knowledge.json', text, { mode: 0o600 });
console.log(JSON.stringify({ version: SKILL.version, release: SKILL.release, zipSha256: SKILL.zipSha256,
  runtimeTextFiles: Object.keys(verified.files).length, packSha256: verified.packSha256,
  output: '.private/omnicpq/knowledge.json', providerCalls: 0 }));
