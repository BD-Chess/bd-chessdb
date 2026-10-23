import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SHELL_FILES} from './shell-contract.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyShell(root) {
  const manifest=JSON.parse(await readFile(join(root,'shell-integrity.json'),'utf8'));
  if(manifest.schema!=='omnicpq.shell_integrity.v1' || JSON.stringify(Object.keys(manifest.files||{}))!==JSON.stringify(SHELL_FILES))throw Error('Incomplete OmniCPQ shell manifest');
  for(const name of SHELL_FILES)if(hash(await readFile(join(root,name)))!==manifest.files[name])throw Error('OmniCPQ final shell hash mismatch: '+name);
  const release=hash(JSON.stringify(manifest.files)).slice(0,20),sw=await readFile(join(root,'sw.js'),'utf8');
  const match=sw.match(/const FILES = (\[[\s\S]*?\]);/);
  if(manifest.release!==release || !sw.includes(`const RELEASE = '${release}';`) || !match || JSON.stringify(JSON.parse(match[1].replaceAll("'",'"')))!==JSON.stringify(SHELL_FILES))throw Error('OmniCPQ worker and final shell differ');
  return {status:'PASS',release,files:SHELL_FILES.length};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(await verifyShell(resolve(process.argv[2]||'public/OmniCPQ'))));
