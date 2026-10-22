// Binary assets are retained losslessly as text for connector-based commits.
// This step reproduces the original PNG bytes before tests and deployment.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = JSON.parse(await readFile(new URL('./icons.base64.json', import.meta.url), 'utf8'));
const root = new URL('../../public/OmniCPQ/icons/', import.meta.url);
await mkdir(root, { recursive: true });
for (const [name, item] of Object.entries(source)) {
  if (!/^[a-z0-9-]+\.png$/.test(name)) throw Error('Invalid icon filename');
  const bytes = Buffer.from(item.base64, 'base64');
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('Icon integrity');
  await writeFile(new URL(name, root), bytes);
}
console.log(JSON.stringify({ icons: Object.keys(source).length, integrity: 'PASS' }));
