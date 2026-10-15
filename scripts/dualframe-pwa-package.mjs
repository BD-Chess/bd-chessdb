// Refresh only this app's deterministic offline package after reviewed edits.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../public/Nara/dualframe-lab/',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
let sw=await read('sw.js'),release=JSON.parse(await read('release.json'));
const label=release.pwa.build_label,assets=JSON.parse(sw.match(/const ASSETS=(\[[\s\S]*?\]);/)[1]);
const hash=createHash('sha256');
for(const asset of assets){const name=asset.replace(/^\.\//,'').split('?')[0];if(name==='release.json')continue;const bytes=await readFile(new URL(name,root));hash.update(asset).update('\0').update(createHash('sha256').update(bytes).digest('hex')).update('\n');}
const digest=hash.digest('hex');release.pwa.offline_package_sha256=digest;
sw=sw.replace(/const BUILD_LABEL='[^']+';/,`const BUILD_LABEL='${label}';`).replace(/const PACKAGE_SHA='[^']+';/,`const PACKAGE_SHA='${digest}';`);
await writeFile(new URL('release.json',root),JSON.stringify(release,null,2)+'\n');await writeFile(new URL('sw.js',root),sw);
console.log(JSON.stringify({build_label:label,offline_package_sha256:digest,assets:assets.length}));
