import {verifyDFC} from '../scripts/dfc-verify-live.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const raw=process.env.PWA_BASE_URL||'https://bd-chess.github.io/bd-chessdb/';
const base=new URL(raw.endsWith('/')?raw:raw+'/',raw);
const appRoot=new URL('Nara/dualframe-lab/',base);
const get=async path=>{const response=await fetch(new URL(path,appRoot),{cache:'no-store',redirect:'error'});if(!response.ok)throw Error('PWA_LIVE_HTTP_'+response.status+' '+path);return response;};
const [htmlResponse,manifestResponse,releaseResponse,workerResponse]=await Promise.all(['','manifest.webmanifest','release.json','sw.js'].map(get));
const html=await htmlResponse.text(),manifest=await manifestResponse.json(),release=await releaseResponse.json(),worker=await workerResponse.text();
const found=worker.match(/const ASSETS=(\[[\s\S]*?\]);/);if(!found)throw Error('PWA_LIVE_ASSET_LIST_MISSING');
const assets=JSON.parse(found[1]),hash=createHash('sha256');
for(const path of assets){const file=path.replace(/^\.\//,'').split('?')[0];if(file==='release.json')continue;const response=await get(path);const bytes=Buffer.from(await response.arrayBuffer());hash.update(path).update('\0').update(createHash('sha256').update(bytes).digest('hex')).update('\n');}
const actual=hash.digest('hex'),expected=release.pwa?.offline_package_sha256;
assert.ok(html.includes('rel="manifest"')&&html.includes('id="pwa-install"'),'install UI missing');
assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./');assert.equal(expected,actual,'deployed offline package content hash mismatch');
assert.ok(worker.includes("const PACKAGE_SHA='"+expected+"'"),'worker package ID mismatch');
for(const icon of manifest.icons){const response=await get(icon.src),png=Buffer.from(await response.arrayBuffer());assert.equal(png.toString('ascii',1,4),'PNG');assert.equal(png.readUInt32BE(16),Number(icon.sizes.split('x')[0]));}
console.log(JSON.stringify({status:'PWA_LIVE_PACKAGE_VERIFIED',base:appRoot.href,package_sha256:actual,assets:assets.length,manifest:manifest.name}));

console.log(JSON.stringify({cartoons:await verifyDFC(appRoot.href)}));
