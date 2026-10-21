// Use the same official CLI packaging code as the published production release.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve, join} from 'node:path';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// esbuild captures its working directory when imported. Select the pinned
// checkout before loading the packaging modules, matching the production CLI.
const root = resolve(process.env.ALBUM_FROZEN_ROOT);
process.chdir(root);
const require = createRequire(join(process.env.ALBUM_NETLIFY_TOOLS, 'package.json'));
const {zipFunctions} = await import(pathToFileURL(require.resolve('@netlify/zip-it-and-ship-it')));
const cliRoot = resolve(require.resolve('netlify-cli/package.json'), '..');
const {normalizeFunctionsConfig} = await import(pathToFileURL(join(cliRoot, 'dist/lib/functions/config.js')));
const raw = JSON.parse(execFileSync('python3', ['-c',
  'import json,tomllib;print(json.dumps({k:v for k,v in tomllib.load(open("netlify.toml","rb"))["functions"].items() if isinstance(v,dict)}))'], {encoding:'utf8'}));
const config = normalizeFunctionsConfig({functionsConfig:raw, projectRoot:root});
await mkdir('bundled-functions', {recursive:true});
const rows = await zipFunctions(resolve('functions'), resolve('bundled-functions'), {basePath:root, config, parallelLimit:1});
for (const row of rows) {
  row.path = resolve(row.path);
  const bytes = await readFile(row.path);
  if (bytes.length !== row.size) throw new Error(`Incomplete function ZIP: ${row.name}`);
  row.sha256 = createHash('sha256').update(bytes).digest('hex');
}
await writeFile('bundled-functions.json', JSON.stringify(rows, null, 2)+'\n');
console.log(`Bundled ${rows.length} pinned functions; no provider calls.`);
