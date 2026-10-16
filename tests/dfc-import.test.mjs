import {pairFixture} from './dfc-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,cp,rm,rename} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {SOURCE,STORY_ID,canonical,validateEdition,normalizeDialogue,hitTest,imageContentRect,pointerToNorm,restoreState,neighborAssets,AssetWindow,digest,safePath} from '../public/Nara/dualframe-lab/dfc-model.mjs';
import {sha} from '../scripts/dfc-build-overviews.mjs';
import {validatePairImport,validateSVG,readZip,importPairs} from '../scripts/dfc-import-pairs.mjs';
import {zipStore} from '../public/Nara/dualframe-lab/zip-store.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const content=new URL('../public/Nara/dualframe-lab/content/illuminara/',import.meta.url),read=p=>readFile(new URL(p,content));
const edition=JSON.parse(await read('edition.json')),original=JSON.parse(await read('sources/DFC_OVERVIEW_CATALOG.json')),dialogue=JSON.parse(await read('sources/DFC_DIALOGUE_SOURCE.json'));
test('real H1 edition: exact source hashes, 8 pages, 39 panels and all member bytes/dimensions',async()=>{
 validateEdition(edition);assert.equal(sha(await read('sources/DFC_OVERVIEW_CATALOG.json')),SOURCE.catalog);assert.equal(sha(await read('sources/DFC_DIALOGUE_SOURCE.json')),SOURCE.dialogue);assert.equal(sha(await read('sources/DFC_H1_RELEASE.json')),SOURCE.h1);
 const manifest=JSON.parse(await read('members.json'));for(const m of manifest.members){const bytes=await read(m.file);assert.equal(bytes.length,m.bytes);assert.equal(sha(bytes),m.sha256);if(m.width_px){const info=await sharp(bytes).metadata();assert.equal(info.width,m.width_px);assert.equal(info.height,m.height_px);}}
 assert.equal(edition.pages.length,8);assert.equal(edition.panels.length,39);assert.equal(edition.pair_count,2);assert.deepEqual(edition.panels.filter(p=>p.readiness.pair_ready).map(p=>p.panel_id),['P01-K01','P02-K04']);assert.ok(edition.panels.filter(p=>!p.readiness.pair_ready).every(p=>!p.P&&!p.L));
});
test('all 78 hotspots bind actual full 1024×1660 page geometry; no hit outside image',()=>{
 for(const p of edition.panels)for(const lang of ['SL','EN']){const h=p.hotspots[lang],x=h.polygon_norm.reduce((s,v)=>s+v[0],0)/h.polygon_norm.length,y=h.polygon_norm.reduce((s,v)=>s+v[1],0)/h.polygon_norm.length;assert.equal(hitTest(edition,p.page_id,x,y,lang).panel_id,p.panel_id);const box={left:57,top:113,width:840,height:420},rect=imageContentRect(box,1024,1660),point=pointerToNorm(rect,rect.left+x*rect.width,rect.top+y*rect.height);assert.equal(hitTest(edition,p.page_id,point.x,point.y,lang).panel_id,p.panel_id);assert.equal(pointerToNorm(rect,rect.left-1,rect.top),null);}
});
test('dialogue ownership/order preserved including 32 bilingual records and silent panels',()=>{const r=normalizeDialogue(original,dialogue);assert.equal(r.length,32);for(const p of edition.panels){assert.deepEqual(p.dialogue,r.filter(x=>x.panel_id===p.panel_id));assert.deepEqual(p.hotspots,original.panels.find(x=>x.panel_id===p.panel_id).hotspots);}const bad=structuredClone(dialogue);bad.records[0].panel_id='P08-K04';assert.throws(()=>normalizeDialogue(original,bad),/DIALOGUE_ID/);});
test('restored state rejects malformed IDs; visits deduplicate; source cache does not loop at boundaries',()=>{const s=restoreState({mode:'panel',panelId:'P01-K01',originPage:'P99',readIds:['P01-K01','P01-K01','bad'],language:'xx'},edition);assert.equal(s.language,'SL');assert.equal(s.originPage,'P01');assert.deepEqual(s.readIds,['P01-K01']);assert.equal(neighborAssets(edition,'P01-K01').length,3);assert.equal(neighborAssets(edition,'P08-K04').length,2);assert.equal(neighborAssets(edition,'P04-K02').length,3);});
test('cache aborts evicted loads, revokes URLs, retains overlap and rejects corrupt bytes/dimensions',async()=>{
 const bytes=Buffer.from('source-test'),h=await digest(bytes),assets=Array.from({length:7},(_,n)=>({file:`${n}.png`,sha256:h,width_px:10,height_px:20}));let created=0;const revoked=[];let held;
 class Img{naturalWidth=10;naturalHeight=20;async decode(){}removeAttribute(){this.src='';}}
 const cache=new AssetWindow('https://example.test/',{ImageClass:Img,createURL:()=>`blob:${++created}`,revokeURL:u=>revoked.push(u),fetcher:async(url,{signal})=>{if(url.pathname==='/0.png')await new Promise(resolve=>{held=resolve;signal.addEventListener('abort',resolve,{once:true});});return new Response(bytes);}});
 cache.reconcile(assets.slice(0,6));const late=cache.get(assets[0]);await Promise.resolve();cache.reconcile(assets.slice(1,7));held?.();await assert.rejects(late,/STALE_ASSET/);await Promise.all(assets.slice(1,7).map(a=>cache.get(a)));assert.equal(cache.entries.size,6);cache.clear();assert.equal(cache.entries.size,0);assert.equal(revoked.length,6);
 const bad=new AssetWindow('https://example.test/',{ImageClass:Img,fetcher:async()=>new Response('wrong')});await assert.rejects(bad.get(assets[0]),/ASSET_HASH/);assert.equal(bad.entries.size,0);
});
test('default fetch keeps the browser host receiver rather than the cache instance',async()=>{const original=globalThis.fetch,bytes=Buffer.from('host-fetch');class Img{naturalWidth=10;naturalHeight=20;async decode(){}removeAttribute(){}}try{globalThis.fetch=async function(){assert.equal(this,globalThis);return new Response(bytes);};const cache=new AssetWindow('https://example.test/',{ImageClass:Img,createURL:()=> 'blob:test',revokeURL:()=>{}});await cache.get({file:'host.png',sha256:sha(bytes),width_px:10,height_px:20});cache.clear();}finally{globalThis.fetch=original;}});
test('synthetic artwork is rejected by the production importer default',async()=>{const f=await pairFixture();f.allowFixtures=false;await assert.rejects(validatePairImport(f),/SYNTHETIC_PRODUCTION_FORBIDDEN/);});
test('complete synthetic test pair passes source/part/byte/text/state validation',async()=>{const f=await pairFixture(),r=await validatePairImport(f);assert.equal(r.imported.length,1);assert.equal(r.receipt.pair_count,1);assert.equal(readZip(f.zip).size,f.files.size);});
test('atomic imports retain earlier partial pairs and manifest coverage, repeat safely, recover rename stop, and leave bad import untouched',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'dfc-isolated-import-')),destination=path.join(dir,'edition');try{await cp(content,destination,{recursive:true});
  const run=async index=>{const f=await pairFixture(index),zip=path.join(dir,'part.zip'),catalog=path.join(dir,'catalog.json'),map=path.join(dir,'map.json');await writeFile(zip,f.zip);await writeFile(catalog,f.catalogBytes);await writeFile(map,JSON.stringify({SYNTHETIC_LOCAL_TEST:zip}));return {catalog,map,zip};};
  let f=await run(0);await importPairs(f.catalog,f.map,destination,{allowFixtures:true});const once=sha(await readFile(path.join(destination,'edition.json')));await importPairs(f.catalog,f.map,destination,{allowFixtures:true});assert.equal(sha(await readFile(path.join(destination,'edition.json'))),once);
  await rename(destination,destination+'.previous');await importPairs(f.catalog,f.map,destination,{allowFixtures:true});assert.equal(sha(await readFile(path.join(destination,'edition.json'))),once);
  f=await run(1);await importPairs(f.catalog,f.map,destination,{allowFixtures:true});const e=validateEdition(JSON.parse(await readFile(path.join(destination,'edition.json'))));assert.equal(e.pair_count,3);const manifest=JSON.parse(await readFile(path.join(destination,'members.json')));assert.equal(manifest.members.length,new Set(manifest.members.map(m=>m.file)).size);for(const m of manifest.members)assert.equal(sha(await readFile(path.join(destination,m.file))),m.sha256);const before=sha(await readFile(path.join(destination,'edition.json')));await writeFile(f.zip,'corrupt');await assert.rejects(importPairs(f.catalog,f.map,destination,{allowFixtures:true}),/PART_HASH/);assert.equal(sha(await readFile(path.join(destination,'edition.json'))),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
for(const [name,mutate,expected]of [
 ['source lineage',f=>f.catalog.overview_catalog_sha256='0'.repeat(64),/PAIR_SOURCE/],
 ['half pair',f=>delete f.catalog.panels[0].L,/PAIR_COUNTS/],
 ['wrong order',f=>f.catalog.panels[0].reading_order=2,/PAIR_ID/],
 ['missing part',f=>f.partsByDrive={},/UNRESOLVED_DRIVE_PART/],
 ['part hash',f=>f.catalog.delivery_parts[0].sha256='0'.repeat(64),/PART_HASH/],
 ['asset hash',f=>f.catalog.panels[0].P.sha256='0'.repeat(64),/PAIR_ASSET_HASH/],
 ['part binding',f=>f.catalog.panels[0].P.delivery_part_id='wrong',/ASSET_PART_BINDING/],
 ['source text order',f=>f.catalog.panels[0].text_ids=[],/PAIR_TEXT_IDS/],
 ['overlay size',f=>f.catalog.panels[0].overlays.L.EN.width_px=5,/OVERLAY_GEOMETRY/],
 ['wrong dimensions',f=>f.catalog.panels[0].P.width_px=20,/PAIR_IMAGE/],
 ['unreviewed',f=>f.catalog.panels[0].qa_status='PENDING',/PAIR_QA/],
 ['traversal',f=>f.catalog.panels[0].P.file='../unsafe.png',/UNSAFE_PATH/],
 ['story state',f=>f.catalog.panels[0].story_state_sha256='0'.repeat(64),/STORY_STATE_HASH/]
])test('reject '+name,async()=>{const f=await pairFixture();mutate(f);await assert.rejects(validatePairImport(f),expected);});
test('reject active/malformed/wrong-lettering SVG',async()=>{const f=await pairFixture(),a=f.catalog.panels[0].overlays.P.EN,b=f.files.get(a.file),records=edition.panels[0].dialogue;await assert.rejects(validateSVG(Buffer.from(b.toString().replace('</svg>','<script>alert(1)</script></svg>')),a,records,'EN'),/SVG_ACTIVE_CONTENT/);await assert.rejects(validateSVG(Buffer.from(b.toString().replace('KRAK!','wrong')),a,records,'EN'),/SVG_EXACT_TEXT/);await assert.rejects(validateSVG(Buffer.from('<svg>'),a,records,'EN'),/SVG_VIEWBOX/);});
test('portable paths and duplicate/corrupt ZIP entries fail closed',async()=>{for(const p of ['../x','/x','x/../y','https://x','x\\y','x//y','x%2fy'])assert.throws(()=>safePath(p));const f=await pairFixture(),bad=Buffer.from(f.zip);bad[40]^=255;assert.throws(()=>readZip(bad));});
