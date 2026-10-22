// Run on an extracted ORIGINAL shared v15 folder; never writes to public/.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { SKILL, hash } from '../../functions/lib/omnicpq/identity.mjs';
import { verifyPack } from '../../functions/lib/omnicpq/knowledge.mjs';
const [folder, zip, output = '.private/omnicpq/knowledge.json'] = process.argv.slice(2);
if (!folder || !zip) throw Error('Usage: node scripts/omnicpq/prepare-knowledge.mjs EXTRACTED_V15 ORIGINAL_V15_ZIP [OUTPUT]');
const dest = resolve(output), publicRoot = resolve('public');
if (dest === publicRoot || dest.startsWith(publicRoot + sep)) throw Error('Private output must be outside public/');
if (await hash(await readFile(zip)) !== SKILL.zipSha256) throw Error('Original ZIP hash mismatch');
const manifestText = await readFile(resolve(folder, 'MANIFEST.json'), 'utf8');
if (await hash(manifestText) !== SKILL.manifestSha256) throw Error('Manifest mismatch');
const manifest = JSON.parse(manifestText), files = {};
const root = await realpath(folder);
for (const spec of manifest.payload_files) {
  const filename = await realpath(resolve(root, spec.path));
  if (!filename.startsWith(root + sep)) throw Error('Unsafe source path');
  const bytes = await readFile(filename);
  if (bytes.length !== spec.bytes || await hash(bytes) !== spec.sha256) throw Error('Invalid payload: ' + spec.path);
  if (/^(?:SKILL\.md|copilot\/PROMPTS\.json|references\/[a-zA-Z0-9_./-]+\.(?:md|json))$/.test(spec.path)) files[spec.path] = bytes.toString('utf8');
}
const text = JSON.stringify({ schema: 'omnicpq.private_knowledge.v1', zipSha256: SKILL.zipSha256, manifestText, files });
await verifyPack(text);
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, text, { mode: 0o600 });
console.log(JSON.stringify({ output: dest, files: Object.keys(files).length, verifiedPayloads: manifest.payload_files.length, sha256: await hash(text) }));
