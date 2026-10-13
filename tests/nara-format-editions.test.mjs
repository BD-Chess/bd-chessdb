import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {loadFormatEditions,editionPaths,editionBodyHash,pairedAssessment,renderEditionPage,formatDayLinks,renderFormatArchive,refreshFormatArchiveSection,generateFormatEditions} from '../scripts/nara-format-editions.mjs';
import {latestPage,monthlyPage,publish,hash} from '../scripts/nara-daily.mjs';
import {refreshIllustratedPages} from '../scripts/nara-daily-batch.mjs';
import {renderStoryScene} from '../scripts/nara-illustrations.mjs';
const root=path.resolve(import.meta.dirname,'..'),n=path.join(root,'public/Nara');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stable=(r)=>Object.fromEntries(['daily/catalog.json',...fs.readdirSync(path.join(r,'public/Nara/daily/records')).filter(x=>x.endsWith('.json')).map(x=>'daily/records/'+x)].map(rel=>[rel,sha(fs.readFileSync(path.join(r,'public/Nara',rel)))]));
function fixture(t,{art=false}={}){const r=fs.mkdtempSync(path.join(os.tmpdir(),'nara-format-'));t.after(()=>fs.rmSync(r,{recursive:true,force:true}));fs.mkdirSync(path.join(r,'public/Nara'),{recursive:true});fs.cpSync(path.join(n,'daily'),path.join(r,'public/Nara/daily'),{recursive:true});for(const f of fs.readdirSync(n).filter(x=>x.endsWith('-pre-format-R1.html')||x==='Nara-AI-archive.html'))fs.copyFileSync(path.join(n,f),path.join(r,'public/Nara',f));if(art)fs.cpSync(path.join(n,'assets/img/daily/2026-10-05'),path.join(r,'public/Nara/assets/img/daily/2026-10-05'),{recursive:true});return r}

test('all 16 source-bound EN/SL editions have complete anchors and genuine pending status',()=>{
 const items=loadFormatEditions(root);assert.equal(items.length,16);assert.equal(items.filter(x=>x.paths.date==='2026-10-11').length,3);
 assert.equal(items.filter(x=>x.paths.date==='2026-10-12').length,3);
 for(const x of items){assert.equal(x.combined,null);assert.equal(x.binding.assessment.status,'PENDING');assert.equal(editionBodyHash(x.en),x.en.content_sha256);assert.equal(editionBodyHash(x.sl),x.sl.content_sha256);for(let i=0;i<x.en.scenes.length;i++)assert.equal(x.en.scenes[i].paragraphs.length,x.sl.scenes[i].paragraphs.length)}
});
test('untrusted manifest dates, paths and modified source bytes are rejected',t=>{
 const r=fixture(t),mp=path.join(r,'public/Nara/daily/format-editions/manifest.json'),original=fs.readFileSync(mp,'utf8'),m=JSON.parse(original);
 assert.throws(()=>editionPaths('../2026-10-05'),/unsafe/);assert.throws(()=>editionPaths('2026-10-12'),/instance/);assert.throws(()=>editionPaths('2026-10-13-S1'),/unsafe/);
 m.authorized_dates=['2026-10-04'];fs.writeFileSync(mp,JSON.stringify(m));assert.throws(()=>loadFormatEditions(r),/allowlist/);fs.writeFileSync(mp,original);
 fs.appendFileSync(path.join(r,'public/Nara/daily/records/2026-10-05.json'),' ');assert.throws(()=>loadFormatEditions(r),/binding/);
});
test('rendering applies R10 only to the edition and escapes hostile prose and speaker labels',()=>{
 const item=structuredClone(loadFormatEditions(root)[0]);item.en.title='<img src=x onerror=alert(1)>';item.en.scenes[0].paragraphs[1]='**<svg onload=alert(1)>**  \n<script>alert(1)</script>';item.en.content_sha256=editionBodyHash(item.en);
 const html=renderEditionPage(root,item);assert.doesNotMatch(html,/<(?:svg|script>alert|img src=x)/);assert.match(html,/&lt;svg/);assert.match(html,/&lt;script&gt;/);assert.match(html,/class="subtitle"/);assert.match(html,/class="speaker"/);
 const legacy=renderStoryScene({title:'Legacy',paragraphs:['*Here · now*','**Name**  \nWords']},1,[],'en',2,'2026-10-12');assert.doesNotMatch(legacy,/class="subtitle"|class="speaker"/);
});
test('scores are withheld until both sealed instruments bind the exact new English body',()=>{
 const h='a'.repeat(64),d={premise:13,character:13,structure:13,prose:13,world:8,moral_intellectual_depth:13,ending:13},g={score:86,dimensions:d,rubric_id:'GPT_LITERARY_7_100_V1',anchor_revision:'SHARED_ANCHOR_V1',sealed:true,en_content_sha256:h,output_sha256:'b'.repeat(64)},c={score:90,rubric_id:'PEC-6_V2',sealed:true,en_content_sha256:h,output_sha256:'c'.repeat(64),prompt_sha256:'d'.repeat(64)},a={status:'PAIRED',en_content_sha256:h,gpt:g,claude:c,combined:88};
 assert.equal(pairedAssessment({status:'PENDING'},h),null);assert.throws(()=>pairedAssessment({status:'PENDING',combined:88},h),/inherited/);assert.equal(pairedAssessment(a,h),88);assert.throws(()=>pairedAssessment(a,'e'.repeat(64)),/binding/);assert.throws(()=>pairedAssessment({...a,combined:90},h),/mean/);assert.throws(()=>pairedAssessment({...a,claude:{...c,sealed:false}},h),/unsealed/);assert.throws(()=>pairedAssessment({...a,gpt:{...g,score:87}},h),/arithmetic/);
});
test('manual Oct5 artwork is bound to the final EN/SL edition and preserves verified HD/4K variants',()=>{
 const item=loadFormatEditions(root)[0],old=JSON.parse(fs.readFileSync(path.join(n,'daily/illustrations/2026-10-05.json'),'utf8')),art=JSON.parse(fs.readFileSync(path.join(n,item.paths.artwork),'utf8')),html=renderEditionPage(root,item);
 assert.equal(art.edition_id,item.binding.edition_id);assert.equal(art.en_content_sha256,item.en.content_sha256);assert.equal(art.sl_content_sha256,item.sl.content_sha256);
 assert.equal((html.match(/data-nara-image-4k=/g)||[]).length,6);assert.doesNotMatch(JSON.stringify(art),/prompt|drive_id/i);
 for(const im of art.images){
  const source=old.images.find(x=>x.scene===im.scene&&x.after_paragraph===im.source_after_paragraph);assert.ok(source);
  for(const field of ['src','width','height','sha256','src_4k','width_4k','height_4k','sha256_4k','alt_en','alt_sl'])assert.equal(im[field],source[field]);
  assert.ok(html.includes(im.src));assert.ok(html.includes(im.src_4k));
  const enPara=item.en.scenes[im.scene-1].paragraphs[im.after_paragraph_en-1],slPara=item.sl.scenes[im.scene-1].paragraphs[im.after_paragraph_sl-1];
  assert.equal(sha(enPara),im.paragraph_sha256_en);assert.equal(sha(slPara),im.paragraph_sha256_sl);assert.equal(im.after_paragraph_en,im.after_paragraph_sl);
  for(const [lang,para] of [['en',enPara],['sl',slPara]]){
   const data=lang==='en'?item.en:item.sl,sceneHtml=renderStoryScene(data.scenes[im.scene-1],im.scene,[{...im,after_paragraph:im['after_paragraph_'+lang]}],lang,2,'2026-10-13');
   assert.ok(sceneHtml.indexOf('<figure')>sceneHtml.indexOf(para.replace(/^\*\*[^*]+\*\*  \n/,'')));
  }
 }
});
test('edition artwork rejects stale edition, paragraph, anchor and asset bindings',t=>{
 const r=fixture(t,{art:true}),item=loadFormatEditions(r)[0],file=path.join(r,'public/Nara',item.paths.artwork),saved=fs.readFileSync(file,'utf8');
 const stale=JSON.parse(saved);stale.en_content_sha256='0'.repeat(64);fs.writeFileSync(file,JSON.stringify(stale));assert.throws(()=>renderEditionPage(r,item),/edition artwork language binding/);
 const paragraph=JSON.parse(saved);paragraph.images[0].paragraph_sha256_en='0'.repeat(64);fs.writeFileSync(file,JSON.stringify(paragraph));assert.throws(()=>renderEditionPage(r,item),/edition artwork paragraph binding/);
 const anchor=JSON.parse(saved);anchor.images[1].after_paragraph_sl+=1;fs.writeFileSync(file,JSON.stringify(anchor));assert.throws(()=>renderEditionPage(r,item),/edition artwork bilingual anchor binding/);
 const asset=JSON.parse(saved);asset.images[2].src='../private.webp';fs.writeFileSync(file,JSON.stringify(asset));assert.throws(()=>renderEditionPage(r,item),/edition artwork asset binding src/);
});
test('missing optional artwork leaves legacy text editions renderable and required Oct5 artwork fails closed',t=>{
 const r=fixture(t),items=loadFormatEditions(r);for(const item of items){if(item.paths.date==='2026-10-05'){assert.throws(()=>renderEditionPage(r,item),/illustration missing static file/);continue}const html=renderEditionPage(r,item);assert.match(html,/lang="sl"/);assert.match(html,/class="story"/);assert.doesNotMatch(html,/data-nara-image-4k/)}
});
test('regeneration is idempotent and daily/monthly refresh retains all links without changing originals',t=>{
 const r=fixture(t,{art:true}),before=stable(r),originalPages=Object.fromEntries(fs.readdirSync(path.join(r,'public/Nara')).filter(x=>x.endsWith('-pre-format-R1.html')).map(x=>[x,sha(fs.readFileSync(path.join(r,'public/Nara',x)))]));
 assert.equal(generateFormatEditions(r).edition_count,16);assert.deepEqual(generateFormatEditions(r).changed,[]);
 refreshIllustratedPages(r,'2026-10');const daily=fs.readFileSync(path.join(r,'public/Nara/Nara-AI-daily.html'),'utf8'),monthly=fs.readFileSync(path.join(r,'public/Nara/Nara-AI-2026-10.html'),'utf8'),archive=fs.readFileSync(path.join(r,'public/Nara/Nara-AI-archive.html'),'utf8');
 for(const item of loadFormatEditions(r)){assert.ok(daily.includes(item.paths.page));assert.ok(monthly.includes(item.paths.page));assert.ok(archive.includes(item.paths.page));assert.ok(archive.includes(item.paths.original_page))}
 assert.match(daily,/NARA-D-2026-10-12/);assert.deepEqual(stable(r),before);for(const [f,h]of Object.entries(originalPages))assert.equal(sha(fs.readFileSync(path.join(r,'public/Nara',f))),h);
 const a=refreshFormatArchiveSection(archive,r);assert.equal(refreshFormatArchiveSection(a,r),a);assert.equal((a.match(/id="format-editions"/g)||[]).length,1);
});
test('day links cover non-featured instances and archive regeneration uses separate original links',()=>{
 const links=formatDayLinks(root,'2026-10-11');for(const s of ['S1','S2','S3'])assert.ok(links.includes('2026-10-11-'+s+'-format-R1.html'));
 const day12=formatDayLinks(root,'2026-10-12');for(const s of ['S1','S2','S3'])assert.ok(day12.includes('2026-10-12-'+s+'-format-R1.html'));
 assert.equal((formatDayLinks(root,'2026-10-11','NARA-D-2026-10-11:S2').match(/format-R1\.html/g)||[]).length,2);assert.equal((renderFormatArchive(root).match(/-pre-format-R1\.html/g)||[]).length,16);
});
test('ordinary next-day publication preserves historical editions and refuses old-date backfill',t=>{
 const r=fixture(t,{art:true}),nr=path.join(r,'public/Nara'),record=JSON.parse(fs.readFileSync(path.join(nr,'daily/records/2026-10-12.json'),'utf8')),log=JSON.parse(fs.readFileSync(path.join(nr,'daily/log/2026-10-12.json'),'utf8'));
 const original=stable(r),editionBytes=Object.fromEntries(loadFormatEditions(r).map(x=>[x.paths.en,sha(fs.readFileSync(path.join(nr,x.paths.en)))]));
 record.date='2026-10-14';record.id='NARA-D-2026-10-14';record.published_at='2026-10-14T20:00:00Z';log.date=record.date;log.id=record.id+'-LOG';log.story_id=record.id;
 assert.match(publish(r,record,log,new Date('2026-10-14T20:01:00Z')),/LOCAL_CANDIDATE_READY/);
 for(const [f,h]of Object.entries(original))if(f!=='daily/catalog.json')assert.equal(sha(fs.readFileSync(path.join(nr,f))),h);
 for(const [f,h]of Object.entries(editionBytes))assert.equal(sha(fs.readFileSync(path.join(nr,f))),h);
 assert.equal(loadFormatEditions(r).length,16);assert.match(fs.readFileSync(path.join(nr,'Nara-AI-archive.html'),'utf8'),/id="format-editions"/);
 const old=JSON.parse(fs.readFileSync(path.join(nr,'daily/records/2026-10-05.json'),'utf8')),oldLog=JSON.parse(fs.readFileSync(path.join(nr,'daily/log/2026-10-05.json'),'utf8'));
 assert.throws(()=>publish(r,old,oldLog,new Date('2026-10-14T20:01:00Z')),/not current local publication date/);
});
