import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {hash,latestPage,monthlyPage} from '../scripts/nara-daily.mjs';
import {loadIllustrations} from '../scripts/nara-illustrations.mjs';
import {instanceStoryHtml,refreshIllustratedPages} from '../scripts/nara-daily-batch.mjs';
import {renderVersionArchive} from '../scripts/nara-version-history.mjs';

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nara-images-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const date='2026-10-12',instance='S1',id=`NARA-D-${date}:${instance}`;
  const r={schema:'nara.daily.instance.record.v1',id,date,instance,published_at:'2026-10-12T21:10:00+02:00',title:'Fixture story',deck:'A renderer fixture.',shape:'Early, turn, result.',scenes:Array.from({length:6},(_,i)=>({title:'Scene '+(i+1),paragraphs:['Fixture paragraph '+i]})),critic_line:'Fixture only.',literary_score:{combined:80,display:80,method:'Fixture',blind:true,weights:{gpt:0.5,claude:0.5},shared_strengths:['Fixture'],shared_reservations:['Fixture']}};
  const bodyHash=x=>hash(JSON.stringify({title:x.title,deck:x.deck,shape:x.shape,scenes:x.scenes}));r.content_sha256=bodyHash(r);
  const sl={schema:'nara.daily.translation.v1',story_id:id,date,language:'sl',source_content_sha256:r.content_sha256,title:'Preskusna zgodba',deck:'Preizkus prikaza.',shape:'Začetek, preobrat, konec.',scenes:r.scenes.map((s,i)=>({title:'Prizor '+(i+1),paragraphs:['Preskusni odstavek '+i]})),critic_line:'Samo preskus.'};sl.content_sha256=bodyHash(sl);r.translation_sl=sl;
  const n=path.join(root,'public/Nara'),write=(file,value)=>{fs.mkdirSync(path.dirname(path.join(n,file)),{recursive:true});fs.writeFileSync(path.join(n,file),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value))};
  const png=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(1672,16);png.writeUInt32BE(941,20);
  const images=[1,3,6].map(scene=>{const src=`assets/img/daily/${date}/${instance}/scene-${scene}.png`;write(src,png);return {scene,src,width:1672,height:941,alt_en:'Scene '+scene,alt_sl:'Prizor '+scene,sha256:hash(png),claude_review:'MISSING',generation_prompt_sha256:'a'.repeat(64),model_reported:'fixture only'}});
  const m={schema:'nara.daily.illustrations.v2',story_id:id,date,edition:null,instance,en_content_sha256:r.content_sha256,sl_content_sha256:sl.content_sha256,images};
  const manifest=`daily/illustrations/${date}-${instance}.json`;write(manifest,m);write(`daily/days/${date}.json`,{schema:'nara.daily.day.v1',id:`NARA-D-${date}`,date,featured_instance:instance});write(`daily/translations/sl/${date}/${instance}.json`,sl);
  const projection={...r,schema:'nara.daily.record.v1',id:`NARA-D-${date}`};delete projection.instance;
  const pt={...sl,story_id:projection.id};
  return {root,r,sl,projection,pt,write,m,manifest,images};
}
const count=s=>(s.match(/<figure class="daily-scene-figure">/g)||[]).length;
test('v3 places WebP figures after their exact EN/SL paragraph, with invalid anchors safely rejected',t=>{
  const f=fixture(t);
  f.r.scenes[0].paragraphs=['Opening one.','Opening two.','Opening three.'];
  f.sl.scenes[0].paragraphs=['Začetek ena.','Začetek dve.','Začetek tri.'];
  const bodyHash=x=>hash(JSON.stringify({title:x.title,deck:x.deck,shape:x.shape,scenes:x.scenes}));
  f.r.content_sha256=bodyHash(f.r);f.sl.content_sha256=bodyHash(f.sl);f.sl.source_content_sha256=f.r.content_sha256;
  // Bounded WebP container-header fixture: decoder-level validation belongs to the publisher.
  const webp=Buffer.alloc(30);webp.write('RIFF');webp.writeUInt32LE(22,4);webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUInt32LE(10,16);webp.writeUIntLE(1671,24,3);webp.writeUIntLE(940,27,3);
  const images=f.images.map((x,i)=>({...x,after_paragraph:i?1:2,src:x.src.replace('.png','.webp'),sha256:hash(webp)}));
  images.forEach(x=>f.write(x.src,webp));
  const m={...f.m,schema:'nara.daily.illustrations.v3',en_content_sha256:f.r.content_sha256,sl_content_sha256:f.sl.content_sha256,images};
  f.write(f.manifest,m);assert.equal(loadIllustrations(f.root,f.r,f.sl).length,3);
  const html=instanceStoryHtml({record:f.r},f.root);
  assert.match(html,/<p>Opening two\.<\/p><figure[\s\S]*?<\/figure>\s*<p>Opening three\.<\/p>/);
  assert.match(html,/<p>Začetek dve\.<\/p><figure[\s\S]*?<\/figure>\s*<p>Začetek tri\.<\/p>/);
  for(const bad of [0,4,1.5]){
    f.write(f.manifest,{...m,images:images.map((x,i)=>i?x:{...x,after_paragraph:bad})});
    assert.throws(()=>loadIllustrations(f.root,f.r,f.sl),/paragraph anchor/);assert.equal(count(instanceStoryHtml({record:f.r},f.root)),0);
  }
  f.write(f.manifest,{...m,images:images.map((x,i)=>i?x:{...x,src:f.images[0].src})});
  assert.throws(()=>loadIllustrations(f.root,f.r,f.sl),/WebP delivery/);
  f.write(f.manifest,m);const badSl={...f.sl,scenes:f.sl.scenes.map((s,i)=>i?s:{...s,paragraphs:['Different structure.']})};badSl.content_sha256=bodyHash(badSl);
  f.write(f.manifest,{...m,sl_content_sha256:badSl.content_sha256});assert.throws(()=>loadIllustrations(f.root,f.r,badSl),/paragraph structure/);
});
test('instance images survive featured projection and bilingual non-featured monthly rendering',t=>{
  const f=fixture(t),before=JSON.stringify(f.r);
  assert.deepEqual(loadIllustrations(f.root,f.r,f.sl).map(x=>x.scene),[1,3,6]);
  for(const html of [latestPage(f.projection,'2026-10',{[f.projection.id]:f.pt},f.root),monthlyPage('2026-10',[f.projection],{[f.projection.id]:f.pt},f.root),instanceStoryHtml({record:f.r},f.root)]){
    assert.equal(count(html),6);assert.ok(html.includes('alt="Prizor 6"'));assert.ok(html.includes('data-language-content="sl" lang="sl" hidden'));
  }
  assert.equal(JSON.stringify(f.r),before,'images never mutate frozen prose or grade');
  const s2={...f.r,id:f.r.id.replace(':S1',':S2'),instance:'S2'};assert.deepEqual(loadIllustrations(f.root,s2,f.sl),[],'S2 cannot inherit S1 images');
});
test('source, instance, PNG dimension and private-field violations are rejected but never hold rendering',t=>{
  const f=fixture(t);
  for(const invalid of [{...f.m,en_content_sha256:'0'.repeat(64)},{...f.m,instance:'S2'},{...f.m,images:f.images.map(x=>({...x,drive_id:'private'}))}]){
    f.write(f.manifest,invalid);assert.throws(()=>loadIllustrations(f.root,f.r,f.sl));assert.equal(count(instanceStoryHtml({record:f.r},f.root)),0);
  }
  f.write(f.manifest,f.m);f.write(f.images[0].src,'corrupt');assert.throws(()=>loadIllustrations(f.root,f.r,f.sl),/hash mismatch/);assert.equal(count(instanceStoryHtml({record:f.r},f.root)),0);
  const wrong=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(wrong);wrong.write('IHDR',12);wrong.writeUInt32BE(1024,16);wrong.writeUInt32BE(941,20);f.write(f.images[0].src,wrong);f.write(f.manifest,{...f.m,images:f.images.map((x,i)=>i?x:{...x,sha256:hash(wrong)})});assert.throws(()=>loadIllustrations(f.root,f.r,f.sl),/PNG dimensions/);
  f.write(f.manifest,'{broken json');assert.equal(count(instanceStoryHtml({record:f.r},f.root)),0);
});
test('post-release refresh is repeatable and never writes frozen text, scores or catalog',t=>{
  const f=fixture(t),p={...f.projection};delete p.translation_sl;
  const rb=JSON.stringify(p),catalog=JSON.stringify({schema:'nara.daily.catalog.v1',records:[{id:p.id,date:p.date,title:p.title,file:`daily/records/${p.date}.json`,record_sha256:hash(rb)}]});
  const ir=JSON.stringify(f.r),tr=JSON.stringify(f.sl);
  f.write(`daily/records/${p.date}.json`,rb);f.write('daily/catalog.json',catalog);f.write(`daily/records/${p.date}/S1.json`,ir);f.write(`daily/translations/sl/${p.date}/S1.json`,tr);f.write(`daily/translations/sl/${p.date}.json`,f.pt);
  f.write(`daily/days/${p.date}.json`,{schema:'nara.daily.day.v1',date:p.date,id:p.id,featured_instance:'S1',instances:[{instance:'S1',record_file:`daily/records/${p.date}/S1.json`,record_sha256:hash(ir),translation_file:`daily/translations/sl/${p.date}/S1.json`,translation_sha256:hash(tr)}]});
  f.write('Nara-AI-archive.html','<main><section class="version-history" id="version-history"><section>old archive</section></section><section class="notice">Preserved originals</section></main>');
  const before=[rb,catalog,ir,tr].join('');assert.ok(refreshIllustratedPages(f.root,'2026-10').changed.includes('Nara-AI-daily.html'));assert.deepEqual(refreshIllustratedPages(f.root,'2026-10').changed,[]);assert.ok(fs.readFileSync(path.join(f.root,'public/Nara/Nara-AI-archive.html'),'utf8').includes('Preserved originals'));
  const n=path.join(f.root,'public/Nara');assert.equal([`daily/records/${p.date}.json`,'daily/catalog.json',`daily/records/${p.date}/S1.json`,`daily/translations/sl/${p.date}/S1.json`].map(x=>fs.readFileSync(path.join(n,x),'utf8')).join(''),before);assert.equal(count(fs.readFileSync(path.join(n,'Nara-AI-daily.html'),'utf8')),6);
});
test('archive illustrates only the exact final EN/SL and leaves earlier author versions image-free',t=>{
  const f=fixture(t),body=({title,deck,shape,scenes})=>({title,deck,shape,scenes});
  const earlier={...body(f.r),title:'Earlier fixture'};
  f.write('daily/versions/2026-10-12-S1.json',{schema:'nara.daily.version_series.v1',story_id:f.r.id,date:f.r.date,published_title:f.r.title,final_version:'T03',accepted_lineage:[{version:'T01',story:earlier,source_content_sha256:hash(JSON.stringify(earlier))},{version:'T03',story:body(f.r),source_content_sha256:f.r.content_sha256}],parallel_branches:[]});
  const html=renderVersionArchive(f.root);assert.equal(count(html),6);assert.equal(count(html.slice(0,html.indexOf('T03</strong>'))),0);assert.ok(html.includes('data-language-content="en"'));assert.ok(html.includes('lang="sl" data-language-content="sl" hidden'));assert.ok(!html.includes('generation_prompt_sha256'));
});
