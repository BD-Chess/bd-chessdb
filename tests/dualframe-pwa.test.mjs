import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {adjacentImageIndices,syncImageCache} from '../public/Nara/dualframe-lab/image-cache.mjs?v=3.0-r1';
import {createHash} from 'node:crypto';
const root=new URL('../public/Nara/dualframe-lab/',import.meta.url);
const text=async path=>readFile(new URL(path,root),'utf8');
const bytes=async path=>readFile(new URL(path,root));
const [html,app,sw,releaseText,manifestText]=await Promise.all([text('index.html'),text('app.mjs'),text('sw.js'),text('release.json'),text('manifest.webmanifest')]);
const release=JSON.parse(releaseText),manifest=JSON.parse(manifestText);
const passwordManager=await readFile(new URL('../scripts/inject_password_manager.py',import.meta.url),'utf8');
const match=sw.match(/const ASSETS=(\[[\s\S]*?\]);/);
assert.ok(match,'service worker must declare an explicit offline asset package');
const assets=JSON.parse(match[1]),paths=new Set(assets.map(path=>path.replace(/^\.\//,'').split('?')[0]));
test('manifest keeps DualFrame installed at the existing app path',async()=>{
 assert.equal(manifest.name,'DualFrame Photos');assert.equal(manifest.id,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
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
 assert.equal(release.pwa.offline_package_sha256,expected);assert.equal(sw.match(/const PACKAGE_SHA='([a-f0-9]{64})'/)?.[1],expected);assert.equal(release.pwa.build_label,'2026-10-17-r4.19');
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

test('gateway secret fields are excluded from password-manager rewriting',()=>{
 const fields=[...html.matchAll(/<input[^>]*type="password"[^>]*>/gi)].map(match=>match[0]);
 assert.equal(fields.length,2);assert.ok(fields.every(field=>field.includes('data-bd-pm-skip="1"')));
 assert.match(passwordManager,/data-bd-pm-skip/);
});

test('the image window preloads exactly one previous and one next item',()=>{
 assert.deepEqual(adjacentImageIndices(5,0),[4,1]);assert.deepEqual(adjacentImageIndices(5,2),[1,3]);
 assert.deepEqual(adjacentImageIndices(2,0),[1]);assert.deepEqual(adjacentImageIndices(1,0),[]);
 assert.deepEqual(adjacentImageIndices(0,0),[]);assert.deepEqual(adjacentImageIndices(3,-1),[]);
});
test('the decoded image cache retains overlap and releases images outside the two-item window',()=>{
 class FakeImage{constructor(){this.src='';this.removed=false;}removeAttribute(name){if(name==='src'){this.src='';this.removed=true;}}decode(){return Promise.resolve();}}
 const cache=new Map();syncImageCache(cache,['previous','next'],FakeImage);const previous=cache.get('previous'),next=cache.get('next');
 syncImageCache(cache,['next','following'],FakeImage);
 assert.equal(cache.size,2);assert.equal(cache.get('next'),next);assert.equal(cache.has('previous'),false);assert.equal(previous.removed,true);assert.ok(cache.has('following'));
 syncImageCache(cache,[],FakeImage);assert.equal(cache.size,0);assert.equal(next.removed,true);
});

test('Gallery Preview controls personal and Nara cards without changing Create controls',()=>{
 const start=app.indexOf('function galleryCard('),end=app.indexOf('function renderOwnGallery(');
 assert.ok(start>0&&end>start);
 const galleryCard=app.slice(start,end);
 assert.match(galleryCard,/const target=galleryFrame\(\),state=selectAsset\(pair,target,'hd'\)/);
 assert.doesNotMatch(galleryCard,/targetFrame\(/);
 assert.match(app,/function galleryFrame\(\).*?simulation:\$\('reference-device'\)\.value/);
 assert.match(app,/\$\('reference-device'\)\.addEventListener\('change',\(\)=>\{scheduleGalleryOrientation\(\);if\(viewerPair\)updateViewer\(\);/);
 assert.match(app,/activeView==='showcase'\|\|pair.reference_only\?\$\('reference-device'\)\.value:\$\('device'\)\.value/);
 assert.match(galleryCard,/state.missing&&state.orientation!==target/);
});
test('name editing is localized, stored separately from original filename and queued for cloud Sync',()=>{
 for(const id of ['rename-dialog','rename-input','rename-save','rename-cancel'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(app,/function openRename\(pair\)/);
 assert.match(app,/async function saveRename\(event\)/);
 assert.match(app,/pair.display_name=name;pair.title_sync_pending=true;/);
 assert.match(app,/base_revision:pair.title_revision\|\|0/);
 assert.match(app,/pair.title_sync_pending=true/);
 assert.match(app,/const cloudName=data.titles\?\.\[p.original.sha256\]/);
 assert.match(app,/Object.assign\(dictionary.sl,\{rename:'Preimenuj'/);
 assert.match(app,/const displayTitle = pair => pair.display_name \|\| pair.title \|\| pair.original\?\.filename/);
});

test('Settings have quick Delay, real model filters and safely bounded cloud Sync',()=>{
 for(const id of ['delay-quick','settings-open','settings-dialog','settings-model','settings-mode','settings-delay','settings-storage-check','settings-api-check'])assert.ok(html.includes('id="'+id+'"'),'missing Settings control: '+id);
 assert.match(app,/const modelKeys=MODELS\.filter\(m=>m\.direct\)/);
 assert.match(app,/prefs\.enabledModels\.includes\(m\.key\)/);
 assert.match(app,/prefs\.enabledModels\.includes\(model\.key\)/);
 assert.match(app,/function scheduleGalleryOrientation\(\)/);
 assert.match(app,/viewerFrameTimer=setTimeout/);
 assert.match(app,/galleryFrameTimer=setTimeout/);
 assert.match(app,/function actualGalleryFrame\(\)/);
 assert.match(app,/API\.request\('\/session'\)/);
 const syncStart=app.indexOf('async function syncCloud(ask=true)'),syncEnd=app.indexOf('async function loadRemotePair(remote)',syncStart);
 assert.ok(syncStart>0&&syncEnd>syncStart);
 const sync=app.slice(syncStart,syncEnd);
 assert.match(sync,/if\(ask\)\{/);assert.match(sync,/engine\.sync\(\{signal:transferController\.signal\}\)/,'manual Sync must reconcile byte assets');
 assert.match(sync,/syncEngine.catalog\(\)/);
 assert.match(app,/createSyncEngine\(\{api:API\.captureAPI\(\)\.syncTransport,store:scopedStore,owner:scopeOwner/);
 assert.match(app,/if\(prefs\.autoSyncMetadata\)syncCloud\(false\)/);
});


test('one-click portrait/landscape viewer swap is before fullscreen and bypasses automatic delay',()=>{
 const viewerIndex=html.indexOf('id="viewer-swap"'),fullscreenIndex=html.indexOf('id="fullscreen"');
 assert.ok(viewerIndex>=0&&viewerIndex<fullscreenIndex);
 assert.match(html,/id="viewer-swap"[^>]+aria-label="Switch landscape and portrait compositions"/);
 assert.match(app,/function swapViewerFrame\(\)/);
 assert.match(app,/\$\('viewer-orientation'\)\.value=next/);
 assert.match(app,/clearTimeout\(viewerFrameTimer\);viewerFrameTimer=null;viewerShownPair=pair.pair_id;viewerShownTarget=next/);
 assert.match(app,/\$\('viewer-swap'\)\.addEventListener\('click',swapViewerFrame\)/);
 assert.match(app,/if\(state.missing\)notify\('frameNotSaved'\)/);
});
test('API access shows only selected model tests and does not invoke generation',()=>{
 assert.match(html,/id="settings-api-table"/);
 const a=app.indexOf('async function checkApiAccess()'),b=app.indexOf('function initSettingsUI()',a);
 assert.ok(a>=0&&b>a);
 const body=app.slice(a,b);
 assert.match(body,/querySelectorAll\('input:checked'\)/);
 assert.match(body,/API.request\('\/model-probe',\{method:'POST',body:\{models:active\}\}\)/);
 assert.match(body,/response.schema!=='bd.dualframe.provider-probes.v1'/);
 assert.match(body,/node\('table',undefined,'api-check-table'\)/);
 assert.doesNotMatch(body,/API.request\('\/(?:generate|expand)'/);
 assert.doesNotMatch(body,/lines.join\(' · '\)/);
});

// Pages prepares every HTML file before verifying the sealed offline package.
test('password-manager preparation preserves every byte in the sealed account login package',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'dualframe-package-prep-'));
 try{
  const target=path.join(directory,'dualframe');await cp(fileURLToPath(root),target,{recursive:true});
  // Run the exact HTML transform used by Pages, without unrelated site runtime patching.
  const transform=['import runpy,sys','from pathlib import Path',"hooks=runpy.run_path(sys.argv[1],run_name='dualframe_pm_fixture')",'root=Path(sys.argv[2])',"for page in root.rglob('*.html'): hooks['patch_html'](page,root)"].join('\n');
  execFileSync('python3',['-c',transform,fileURLToPath(new URL('../scripts/inject_password_manager.py',import.meta.url)),target],{stdio:'pipe'});
  for(const asset of assets){const name=asset.replace(/^\.\//,'').split('?')[0];assert.deepEqual(await readFile(path.join(target,name)),await bytes(name),'host preparation changed sealed asset '+name);}
 }finally{await rm(directory,{recursive:true,force:true});}
});
