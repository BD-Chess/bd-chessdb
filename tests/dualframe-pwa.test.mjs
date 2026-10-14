import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../public/Nara/dualframe-lab/',import.meta.url);
const text=async path=>readFile(new URL(path,root),'utf8');
const bytes=async path=>readFile(new URL(path,root));
const [html,app,sw,releaseText,manifestText]=await Promise.all([text('index.html'),text('app.mjs'),text('sw.js'),text('release.json'),text('manifest.webmanifest')]);
const release=JSON.parse(releaseText),manifest=JSON.parse(manifestText);
const match=sw.match(/const ASSETS=(\[[\s\S]*?\]);/);
assert.ok(match,'service worker must declare an explicit offline asset package');
const assets=JSON.parse(match[1]),paths=new Set(assets.map(path=>path.replace(/^\.\//,'').split('?')[0]));
test('manifest keeps DualFrame installed at the existing app path',async()=>{
 assert.equal(manifest.name,'DualFrame AI');assert.equal(manifest.id,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
 assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/);assert.match(html,/apple-touch-icon/);assert.match(html,/id="pwa-install"/);assert.match(html,/id="pwa-help"/);
 for(const icon of manifest.icons){const data=await bytes(icon.src.replace(/^\.\//,''));assert.equal(data.toString('ascii',1,4),'PNG');assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(data.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}
});
test('offline package includes the local module, style, schema and icon closure only',()=>{
 const entry=html.match(/<script type="module" src="([^"]+)"/),style=html.match(/<link rel="stylesheet" href="([^"]+)"/);
 assert.ok(entry&&style);for(const path of [entry[1],style[1],'./manifest.webmanifest','./pair.schema.json','./release.json',...manifest.icons.map(icon=>icon.src)])assert.ok(paths.has(path.replace(/^\.\//,'').split('?')[0]),'missing precache asset '+path);
 const imports=[...app.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match=>match[1]).filter(path=>path.startsWith('./'));
 for(const path of imports)assert.ok(assets.includes(path),'missing module dependency '+path);
 assert.ok(assets.every(path=>!/^https?:/i.test(path)),'offline package must not fetch cross-origin files');
 assert.ok(sw.includes("url.origin!==BASE.origin")&&sw.includes("url.pathname.startsWith(BASE.pathname)"),'worker must stay inside this app and origin');
});
test('content hash binds the complete offline package to release metadata and worker cache identity',async()=>{
 const hash=createHash('sha256');
 for(const path of assets){const name=path.replace(/^\.\//,'').split('?')[0];if(name==='release.json')continue;const file=await bytes(name);const digest=createHash('sha256').update(file).digest('hex');hash.update(path).update('\0').update(digest).update('\n');}
 const expected=hash.digest('hex');
 assert.equal(release.pwa.offline_package_sha256,expected);assert.equal(sw.match(/const PACKAGE_SHA='([a-f0-9]{64})'/)?.[1],expected);assert.equal(release.pwa.build_label,'2026-10-14-r4.2');
});
test('worker bypasses auth, cloud API and non-app origins and only activates after saved update',()=>{
 assert.match(sw,/request\.headers\.has\('authorization'\)/);assert.match(sw,/url\.pathname\.startsWith\('\/api\/df\/'\)/);assert.match(sw,/url\.origin!==BASE\.origin/);
 const install=sw.slice(sw.indexOf("self.addEventListener('install'"),sw.indexOf("self.addEventListener('activate'"));
 assert.doesNotMatch(install,/skipWaiting/);assert.match(sw,/ACTIVATE_SAVED/);assert.match(sw,/VERIFY_PACKAGE/);assert.match(app,/prepareForUpdate\(\)/);assert.match(app,/getPairs\(\),getScores\(\)/);
 assert.ok(app.includes("register('./sw.js',{scope:'./',updateViaCache:'none'})"));
 assert.ok(sw.includes("return await cache.match(INDEX)||fetch(request)"),'offline navigation must use a complete installed package');
});
test('offline reference failure leaves the private local gallery available',()=>{
 assert.ok(app.includes("t('referenceOffline')"));assert.ok(app.includes('renderOwnGallery();return;}throw error;'));
 assert.ok(html.includes('pwaInstallHelp'));assert.ok(release.pwa.network_required.includes('cloud Sync'));
});
