import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {adjacentImageIndices,syncImageCache} from '../public/Nara/dualframe-lab/image-cache.mjs?v=3.0-r1';
import {validateSettings,readSettings,saveSettings,storageBudget,delayTransition,SETTINGS_DEFAULTS,DEFAULT_MODELS} from '../public/Nara/dualframe-lab/preferences.mjs';
import {storageError} from '../public/Nara/dualframe-lab/store.mjs';
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
 assert.equal(release.pwa.offline_package_sha256,expected);assert.equal(sw.match(/const PACKAGE_SHA='([a-f0-9]{64})'/)?.[1],expected);assert.equal(release.pwa.build_label,'2026-10-14-r4.4');
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
 assert.match(app,/function desiredGalleryFrame\(\).*?simulation:\$\('reference-device'\)\.value/);
 assert.match(app,/\$\('reference-device'\)\.addEventListener\('change',scheduleGalleryFrame\)/);
 assert.match(app,/activeView==='showcase'\|\|pair.reference_only\?\$\('reference-device'\)\.value:\$\('device'\)\.value/);
 assert.match(galleryCard,/state.missing&&state.orientation!==target/);
});
test('name editing is localized, stored separately from original filename and queued for cloud Sync',()=>{
 for(const id of ['rename-dialog','rename-input','rename-save','rename-cancel'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(app,/function openRename\(pair\)/);
 assert.match(app,/async function saveRename\(event\)/);
 assert.match(app,/pair.display_name=name;pair.title_sync_pending=true;/);
 assert.match(app,/API.request\('\/titles\/'\+pair.original.sha256,\{method:'PUT',body:\{title\}\}\)/);
 assert.match(app,/for\(const p of pairs\)if\(p.title_sync_pending\)await syncPendingTitle\(p\)/);
 assert.match(app,/const cloudName=data.titles\?\.\[p.original.sha256\]/);
 assert.match(app,/Object.assign\(dictionary.sl,\{rename:'Preimenuj'/);
 assert.match(app,/const displayTitle = pair => pair.display_name \|\| pair.title \|\| pair.original\?\.filename/);
});


test('Settings default to four BD-tested models and safely validate persisted preferences',()=>{
 assert.deepEqual(DEFAULT_MODELS,['wan-image-pro','grok-imagine','openai-flare','openai-sunburst']);
 assert.deepEqual(SETTINGS_DEFAULTS.enabledModels,DEFAULT_MODELS);
 const store=new Map();const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const models=['wan-image-pro','grok-imagine','openai-flare','openai-sunburst','gemini-nano'];
 let settings=readSettings(storage,models);
 assert.equal(settings.delaySeconds,2);assert.equal(settings.model,'openai-sunburst');assert.equal(settings.metadataSyncOnStart,true);
 settings=saveSettings({...settings,enabledModels:['wan-image-pro','gemini-nano'],model:'gemini-nano',mode:'faithful',delaySeconds:5},storage,models);
 assert.equal(readSettings(storage,models).model,'gemini-nano');assert.equal(settings.mode,'faithful');
 assert.deepEqual(validateSettings({enabledModels:['untrusted'],model:'untrusted',delaySeconds:999},models).enabledModels,['openai-sunburst']);
 assert.equal(validateSettings({quality:'invalid',mode:'unknown',delaySeconds:-1},models).delaySeconds,2);
});
test('Delay preserves the old frame for 1–5s and cancels immediately when disabled or unchanged',()=>{
 for(let seconds=1;seconds<=5;seconds++)assert.deepEqual(delayTransition('landscape','portrait',seconds),{show:'landscape',waitMs:seconds*1000});
 assert.deepEqual(delayTransition('landscape','portrait',0),{show:'portrait',waitMs:0});
 assert.deepEqual(delayTransition('portrait','portrait',5),{show:'portrait',waitMs:0});
 assert.match(app,/galleryDelayTimer=setTimeout/);assert.match(app,/galleryShownFrame=desired/);
 assert.match(app,/const target=galleryFrame\(\);list.classList.toggle\('portrait',desiredGalleryFrame\(\)==='portrait'\)/);
 assert.match(app,/const target=galleryFrame\(\),state=selectAsset\(pair,target,'hd'\)/);
});
test('IndexedDB separates quota from aborted transactions, denial and database failures',()=>{
 for(const [name,expected] of [['QuotaExceededError','STORAGE_QUOTA_EXCEEDED'],['AbortError','STORAGE_TRANSACTION_ABORTED'],['SecurityError','STORAGE_ACCESS_DENIED'],['InvalidStateError','STORAGE_DATABASE_ERROR'],['ConstraintError','STORAGE_WRITE_FAILURE']]){
  assert.equal(storageError({name},true).message,expected);
 }
 assert.doesNotMatch(await text('store.mjs'),/STORAGE_QUOTA_OR_FAILURE/);
});
test('Sync only reads metadata until a per-image quota-checked Load action',()=>{
 const a=app.indexOf('async function syncCloud(ask=true)'),b=app.indexOf('function updateSettingsDefaultModelChoices()',a);
 assert.ok(a>0&&b>a);const sync=app.slice(a,b);
 assert.doesNotMatch(sync,/API\.asset\(/);
 assert.match(sync,/API\.request\('\/library'\)/);
 assert.match(app,/async function loadCloudPair\(remote\)/);
 assert.match(app,/await guardCloudBudget\(\[remote.original,remote.normalized/);
 assert.match(app,/await putPair\(p\);pairs.push\(p\)/);
 assert.deepEqual(storageBudget({usage:80*2**20,quota:100*2**20},10*2**20,96).allowed,false);
 assert.deepEqual(storageBudget({usage:1*2**20,quota:400*2**20},20*2**20,96).allowed,true);
 assert.equal(storageBudget(null,300*2**20,96).reason,'STORAGE_TRANSFER_LIMIT');
 assert.match(html,/id="cloud-inventory"/);
});
test('Phone has an independent visible exit button after pinch zoom and returning from immersive',async()=>{
 assert.match(html,/id="viewer-floating-close"/);
 assert.match(app,/\$\('viewer-floating-close'\)\.addEventListener\('click',closeViewer\)/);
 assert.match(app,/visualViewport\?\.addEventListener\('scroll',syncMobileClose\)/);
 assert.match(app,/visibleLeft\+visibleWidth/);
 const style=await text('styles.css');
 assert.match(style,/#viewer-floating-close\{display:flex;position:fixed/);
 assert.match(style,/\.immersion-open #viewer-floating-close\{display:none\}/);
 assert.match(style,/#viewer .viewer-toolbar #viewer-close\{display:none\}/);
});
test('Settings API access test is read-only and hidden models are absent from Create and Compare',()=>{
 for(const id of ['settings-open','settings-dialog','settings-mode','settings-model-list','settings-api-check','settings-diagnostics','gallery-delay'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/async function runFreeApiCheck\(\)/);
 const start=app.indexOf('async function runFreeApiCheck()'),end=app.indexOf('async function initR5()',start);
 const access=app.slice(start,end);
 assert.doesNotMatch(access,/API\.request\('\/(generate|expand)'/);
 assert.match(access,/API\.capabilities\(\)/);
 assert.match(app,/function visibleModels\(\)\{return MODELS\.filter\(m=>m\.direct&&settings\.enabledModels\.includes\(m\.key\)\)/);
 assert.match(app,/for\(const model of visibleModels\(\)\.filter\(x=>x\.edit!==false\)\)/);
});
