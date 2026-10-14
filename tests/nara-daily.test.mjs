import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {renderEditionPage,editionPaths,pairedAssessment} from '../scripts/nara-format-editions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {hash,validDate,authorForDate,localParts,validateRecord,validateCatalog,validateLog,validateTranslation,loadTranslations,latestPage,monthlyPage,logPage,initialize,publish,loadRecords} from '../scripts/nara-daily.mjs';

function record(date='2026-10-05',published_at='2026-10-05T20:00:00Z'){
  const r={schema:'nara.daily.record.v1',id:'NARA-D-'+date,date,published_at,title:'Fixture only — not a real story',deck:'A local renderer test.',shape:'Test fixture',scenes:[{title:'A safe string',paragraphs:['<script>alert(1)</script>','A choice & its cost.']}],critic_line:'This is a test, not a peer review.'};
  r.content_sha256=hash(JSON.stringify({title:r.title,deck:r.deck,shape:r.shape,scenes:r.scenes}));
  return r;
}
function translationSl(r){const tr={title:'Preskusna zgodba',deck:'Lokalni preskus prevoda.',shape:'Preskusna oblika',scenes:r.scenes.map((sc,i)=>({title:'Prizor '+(i+1),paragraphs:sc.paragraphs.map((p,j)=>j===0?'Preveden varen niz.':'Izbira in njena cena.')})),critic_line:'To je preskus, ne strokovna recenzija.'};tr.content_sha256=hash(JSON.stringify({title:tr.title,deck:tr.deck,shape:tr.shape,scenes:tr.scenes}));return tr}
function literaryScore(){return {combined:86.5,display:87,method:'Equal-weight mean of two independent blind evaluations',blind:true,weights:{gpt:0.5,claude:0.5},shared_strengths:['Strong central idea.'],shared_reservations:['Character individuality can improve.']}}
function evaluation(){return {blind:true,method:'equal_weight_mean',gpt:{score:93,rubric:'GPT rubric'},claude:{score:80,rubric:'Claude rubric'},weights:{gpt:0.5,claude:0.5},combined:86.5,display:87,note:'Locked blind scores only.'}}
function logRecord(date='2026-10-05'){
  const candidates=Array.from({length:10},(_,i)=>({title:'Candidate '+(i+1),premise:'Distinct premise '+(i+1)+'.'}));
  return {schema:'nara.daily.log.v1',id:'NARA-D-'+date+'-LOG',date,story_id:'NARA-D-'+date,title:'Fixture only — not a real story',proposer:'GPT',selector:'CLAUDE',author:'GPT',critic:'CLAUDE',candidates,selection:{title:'Candidate 3',reason:'It creates the sharpest conflict.',risk:'Do not resolve it too easily.'},rounds:[{actor:'CLAUDE',stage:'STORY_SELECTION',summary:'Selected candidate 3 and named the central risk.'},{actor:'GPT',stage:'AUTHOR_DRAFT',summary:'Built a complete first draft.'},{actor:'CLAUDE',stage:'CRITIC_REVIEW',summary:'Pressed agency, third-party cost and the ending.'},{actor:'GPT',stage:'AUTHOR_REVISION',summary:'Reworked the middle and consequence.'},{actor:'GPT',stage:'AUTHOR_FINAL',summary:'Committed the final author pass.'},{actor:'CLAUDE',stage:'CRITIC_CLOSE',summary:'Closed the reviewed final with no hard blocker.'}],final_critic_line:'This is a test, not a peer review.'};
}
function temp(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'nara-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));initialize(root,'2026-10');return root}

const editionRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('completed S1 keeps its two original companion stories on Daily across refreshes',t=>{
 const root=temp(t),n=path.join(root,'public/Nara'),files=['daily/days/2026-10-09.json',...['S1','S2','S3'].flatMap(instance=>['daily/records/2026-10-09/'+instance+'.json','daily/translations/sl/2026-10-09/'+instance+'.json'])];
 for(const file of files){fs.mkdirSync(path.dirname(path.join(n,file)),{recursive:true});fs.copyFileSync(path.join(editionRoot,'public/Nara',file),path.join(n,file));}
 const source=JSON.parse(fs.readFileSync(path.join(n,'daily/records/2026-10-09/S1.json'),'utf8')),featured={...source,schema:'nara.daily.record.v1',id:'NARA-D-2026-10-09'};
 const bodyBefore=JSON.stringify(source),render=()=>latestPage([record('2026-10-20','2026-10-20T20:00:00Z'),featured],'2026-10',{},root),html=render();
 assert.ok(html.includes('<article class="notice daily-index-item" id="NARA-D-2026-10-09"'));
 assert.ok(html.includes('href="Nara-AI-2026-10-09-S1-format-R1.html"'));
 assert.ok(!html.includes(source.scenes[0].paragraphs[0]));
 for(const instance of ['S2','S3']){
  const r=JSON.parse(fs.readFileSync(path.join(n,'daily/records/2026-10-09/'+instance+'.json'),'utf8'));
  assert.ok(html.includes('<details class="archive-item daily-item" id="'+r.id+'">'));
  assert.ok(html.includes(r.title));assert.ok(html.includes(r.translation_sl.title));
 }
 assert.ok(!html.includes('pre-format-R1.html'));
 assert.equal(render(),html);assert.equal(JSON.stringify(source),bodyBefore);
 fs.appendFileSync(path.join(n,'daily/records/2026-10-09/S2.json'),' ');
 assert.throws(render,/companion Daily record hash mismatch/);
});
function illustratedOct9S1(){
 const paths=editionPaths('2026-10-09-S1'),read=f=>JSON.parse(fs.readFileSync(path.join(editionRoot,'public/Nara',f),'utf8'));
 const en=read(paths.en),sl=read(paths.sl),binding=read(paths.binding);
 return {paths,en,sl,binding,originalEn:read(paths.source_en),originalSl:read(paths.source_sl),combined:pairedAssessment(binding.assessment,en.content_sha256)};
}
test('public edition artwork v3 keeps private provenance out and binds all three bilingual anchors',()=>{
 const item=illustratedOct9S1(),art=JSON.parse(fs.readFileSync(path.join(editionRoot,'public/Nara',item.paths.artwork),'utf8'));
 assert.equal(art.schema,'nara.format.edition.artwork.v3');
 assert.doesNotMatch(JSON.stringify(art),/drive_id|full_prompt|claude_review|model_reported|generation_prompt/);
 const before=JSON.stringify([item.en,item.sl]),html=renderEditionPage(editionRoot,item);
 assert.equal((html.match(/<figure class="daily-scene-figure">/g)||[]).length,6);
 assert.doesNotMatch(html,/data-nara-image-4k/);
 const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 for(const im of art.images)for(const [lang,data]of [['en',item.en],['sl',item.sl]]){
  const para=data.scenes[im.scene-1].paragraphs[im['after_paragraph_'+lang]-1];
  assert.equal(hash(para),im['paragraph_sha256_'+lang]);
  assert.ok(html.includes('<p>'+escape(para)+'</p><figure class="daily-scene-figure">'));
 }
 assert.equal(JSON.stringify([item.en,item.sl]),before);
 assert.equal(renderEditionPage(editionRoot,item),html);
});
test('direct artwork rejects private fields, stale bindings and corrupted assets while retaining v2 compatibility',t=>{
 const root=temp(t),item=illustratedOct9S1(),n=path.join(root,'public/Nara'),manifestPath=path.join(n,item.paths.artwork);
 const art=JSON.parse(fs.readFileSync(path.join(editionRoot,'public/Nara',item.paths.artwork),'utf8'));
 fs.mkdirSync(path.dirname(manifestPath),{recursive:true});
 for(const im of art.images){fs.mkdirSync(path.dirname(path.join(n,im.src)),{recursive:true});fs.copyFileSync(path.join(editionRoot,'public/Nara',im.src),path.join(n,im.src));}
 const write=a=>fs.writeFileSync(manifestPath,JSON.stringify(a));
 write(art);assert.doesNotThrow(()=>renderEditionPage(root,item));
 const privateField=structuredClone(art);privateField.images[0].drive_id='PRIVATE';write(privateField);assert.throws(()=>renderEditionPage(root,item),/image fields/);
 const stale=structuredClone(art);stale.en_content_sha256='0'.repeat(64);write(stale);assert.throws(()=>renderEditionPage(root,item),/language binding/);
 const para=structuredClone(art);para.images[0].paragraph_sha256_en='0'.repeat(64);write(para);assert.throws(()=>renderEditionPage(root,item),/paragraph binding/);
 const unsafe=structuredClone(art);unsafe.images[0].src='../secret.webp';write(unsafe);assert.throws(()=>renderEditionPage(root,item),/unsafe direct edition artwork source/);
 const otherInstance=structuredClone(art);otherInstance.images[0].src=otherInstance.images[0].src.replace('/S1/','/S2/');write(otherInstance);assert.throws(()=>renderEditionPage(root,item),/unsafe direct edition artwork source/);
 const legacy=structuredClone(art);legacy.schema='nara.format.edition.artwork.v2';for(const im of legacy.images){im.generation_prompt_sha256='0'.repeat(64);im.model_reported='TEST_FIXTURE';im.claude_review='MISSING';}
 write(legacy);assert.doesNotThrow(()=>renderEditionPage(root,item));
 write(art);fs.appendFileSync(path.join(n,art.images[0].src),'corrupt');assert.throws(()=>renderEditionPage(root,item),/asset hash mismatch/);
});


test('dates reject invalid calendar days and traversal',()=>{for(const d of ['2026-02-30','2026-13-01','../2026-01-01','2026-1-01'])assert.equal(validDate(d),false);assert.equal(validDate('2028-02-29'),true)});
test('authors alternate across month and year boundaries',()=>{assert.equal(authorForDate('2026-10-05'),'GPT');assert.equal(authorForDate('2026-10-06'),'CLAUDE');assert.notEqual(authorForDate('2026-10-31'),authorForDate('2026-11-01'));assert.notEqual(authorForDate('2026-12-31'),authorForDate('2027-01-01'))});
test('22:00 stays local across autumn and spring DST',()=>{assert.equal(localParts('2026-10-24T20:00:00Z').hour,'22');assert.equal(localParts('2026-10-25T21:00:00Z').hour,'22');assert.equal(localParts('2027-03-27T21:00:00Z').hour,'22');assert.equal(localParts('2027-03-28T20:00:00Z').hour,'22')});
test('record and prose hash validate',()=>{assert.equal(validateRecord(record()).id,'NARA-D-2026-10-05');const r=record();r.scenes[0].paragraphs[0]='changed';assert.throws(()=>validateRecord(r),/hash mismatch/)});
test('Slovenian translation preserves scene and paragraph topology and hash',()=>{const r=record();r.translation_sl=translationSl(r);assert.equal(validateRecord(r).translation_sl.title,'Preskusna zgodba');const bad=record();bad.translation_sl=translationSl(bad);bad.translation_sl.scenes[0].paragraphs.pop();assert.throws(()=>validateRecord(bad),/translation_sl scene structure/);const badHash=record();badHash.translation_sl=translationSl(badHash);badHash.translation_sl.title='Spremenjeno';assert.throws(()=>validateRecord(badHash),/translation_sl content hash mismatch/)});
test('private fields never enter public story records',()=>{const r=record();r.drive_id='PRIVATE';assert.throws(()=>validateRecord(r),/unexpected\/private/)});
test('publication gate rejects missing peer closing line',()=>{const r=record();r.critic_line='';assert.throws(()=>validateRecord(r),/critic/)});
test('record accepts first-ready publication time but rejects wrong local date and missing timezone',()=>{assert.equal(validateRecord(record('2026-10-05','2026-10-05T18:15:00Z')).date,'2026-10-05');assert.throws(()=>validateRecord(record('2026-10-05','2026-10-04T18:15:00Z')),/wrong local date/);assert.throws(()=>validateRecord(record('2026-10-05','2026-10-05T22:00:00')),/timezone/)});
test('editorial log validates ten candidates and rejects private fields',()=>{assert.equal(validateLog(logRecord()).candidates.length,10);const short=logRecord();short.candidates.pop();assert.throws(()=>validateLog(short),/candidates/);const priv=logRecord();priv.task_id='PRIVATE';assert.throws(()=>validateLog(priv),/unexpected\/private/)});
test('log requires paired author and critic roles plus final close',()=>{const l=logRecord();l.selector='GPT';assert.throws(()=>validateLog(l),/pairing/);const missing=logRecord();missing.rounds=missing.rounds.filter(r=>r.stage!=='CRITIC_CLOSE');assert.throws(()=>validateLog(missing),/final\/close/)});
test('rendered peer text is inert, image-free, score-aware and bilingual',()=>{const r=record('2026-10-20','2026-10-20T20:00:00Z');r.literary_score=literaryScore();r.translation_sl=translationSl(r);validateRecord(r);const p=latestPage(r,'2026-10');assert.ok(p.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!p.includes('<script>alert(1)'));assert.ok(!/<img\b|<iframe\b|<svg\b/i.test(p));assert.ok(p.includes(r.critic_line));assert.ok(p.includes('ILLUMINARA / DAILY'));assert.ok(p.includes('Nara-AI-log.html'));assert.ok(p.includes('<details class="archive-item daily-item"'));assert.ok(!p.includes('<details class="archive-item daily-item" open'));assert.ok(p.includes('>87</button>'));assert.ok(p.includes('data-score-open'));assert.ok(p.includes('Combined blind literary score'));assert.ok(p.includes('data-language="sl"'));assert.ok(p.includes('Preskusna zgodba'));assert.ok(p.includes('lang="sl"'))});
test('Daily links illustrated stories for 5 through 8 October with date and title only',()=>{
  const linked=['2026-10-05','2026-10-06','2026-10-07','2026-10-08'].map(d=>record(d,d+'T20:00:00Z'));
  const other=record('2026-10-10','2026-10-10T20:00:00Z');
  linked.forEach((r,i)=>r.deck='INLINE_BODY_MUST_NOT_RENDER_'+i);
  const p=latestPage([...linked,other],'2026-10');
  for(const r of linked){
    const start=p.indexOf('<article class="notice daily-index-item" id="'+r.id+'"');
    assert.ok(start>=0);
    const card=p.slice(start,p.indexOf('</article>',start)+10);
    assert.equal((card.match(/<a\b/g)||[]).length,1);
    assert.ok(card.includes('<time datetime="'+r.date+'">'+r.date+'</time>'));
    assert.ok(card.includes('href="Nara-AI-'+r.date+'-format-R1.html"'));
    assert.ok(!/class="(?:lede|daily-index-actions|daily-edition-link)"/.test(card));
    assert.ok(!card.includes('Nara-AI-archive.html'));
    assert.ok(!p.includes(r.deck));
    assert.ok(!p.includes('<details class="archive-item daily-item" id="'+r.id+'"'));
  }
  assert.equal((p.match(/<details class="archive-item daily-item"/g)||[]).length,1);
  assert.ok(p.includes('id="'+other.id+'"'));
  assert.ok(p.indexOf(other.id)<p.indexOf(linked[3].id));
  assert.ok(p.indexOf(linked[3].id)<p.indexOf(linked[2].id));
  assert.ok(p.indexOf(other.id)<p.indexOf(linked[2].id));
  assert.ok(p.indexOf(linked[2].id)<p.indexOf(linked[1].id));
  assert.ok(p.indexOf(linked[1].id)<p.indexOf(linked[0].id));
  const month=monthlyPage('2026-10',linked);
  for(const r of linked){assert.ok(month.includes('<details class="archive-item" id="'+r.id+'">'));assert.ok(month.includes(r.deck));}
});
test('monthly, latest and log projections match the published story',t=>{const root=temp(t),r=record(),l=logRecord();publish(root,r,l,new Date(r.published_at));const {n,records}=loadRecords(root);for(const f of ['Nara-AI-daily.html','Nara-AI-2026-10.html'])assert.ok(fs.readFileSync(path.join(n,f),'utf8').includes(records[0].content_sha256));const lp=fs.readFileSync(path.join(n,'Nara-AI-log.html'),'utf8');assert.ok(lp.includes(l.selection.title));assert.ok(lp.includes('Read the published story'));const mp=monthlyPage('2026-10',records);assert.ok(mp.includes('id="NARA-D-2026-10-05"'));assert.ok(!mp.includes('scoreChips'));assert.ok(!mp.includes('scoreDialogs'))});
test('combined score metadata is optional but validated when present',()=>{const r=record();r.literary_score=literaryScore();assert.equal(validateRecord(r).literary_score.display,87);const bad=record();bad.literary_score={...literaryScore(),display:86};assert.throws(()=>validateRecord(bad),/display rounding/)});
test('public log evaluation preserves raw blind scores and exact 50-50 mean',()=>{const l=logRecord();l.evaluation=evaluation();assert.equal(validateLog(l).evaluation.combined,86.5);const p=logPage([l]);assert.ok(p.includes('GPT:</strong> 93'));assert.ok(p.includes('Claude:</strong> 80'));assert.ok(p.includes('combined 87'))});
test('catalog blocks duplicate dates, unsafe story paths and unsafe log paths',()=>{const e={date:'2026-10-05',id:'NARA-D-2026-10-05',file:'daily/records/2026-10-05.json',title:'Test',record_sha256:'a'.repeat(64),log_file:'daily/log/2026-10-05.json',log_sha256:'b'.repeat(64)};assert.throws(()=>validateCatalog({schema:'nara.daily.catalog.v1',records:[e,e]}),/duplicate/);assert.throws(()=>validateCatalog({schema:'nara.daily.catalog.v1',records:[{...e,file:'../secret'}]}),/unsafe record/);assert.throws(()=>validateCatalog({schema:'nara.daily.catalog.v1',records:[{...e,log_file:'../secret'}]}),/unsafe log/)});
test('byte corruption in stored story or log is rejected on replay',t=>{const root=temp(t),r=record(),l=logRecord();publish(root,r,l,new Date(r.published_at));const {n}=loadRecords(root);fs.appendFileSync(path.join(n,'daily/log/2026-10-05.json'),' ');assert.throws(()=>publish(root,r,l,new Date(r.published_at)),/different log/)});

function translation(r){
  const t={schema:'nara.daily.translation.v1',story_id:r.id,date:r.date,language:'sl',source_content_sha256:r.content_sha256,translated_by:'GPT',title:'Slovenska zgodba',deck:'Slovenski uvod.',shape:'Zasnova.',scenes:[{title:'Prizor',paragraphs:['<script>prevod()</script>','Izbira in njena cena.']}],critic_line:'Uredniška opomba.'};
  t.content_sha256=hash(JSON.stringify({title:t.title,deck:t.deck,shape:t.shape,scenes:t.scenes}));
  return t;
}
test('SL edition is complete, source-bound and leaves the English record unchanged',()=>{
  const r=record(),before=JSON.stringify(r),t=translation(r);
  assert.equal(validateTranslation(t,r).language,'sl');
  assert.equal(JSON.stringify(r),before);
  assert.throws(()=>validateTranslation({...t,source_content_sha256:'0'.repeat(64)},r),/source mismatch/);
  const incomplete=structuredClone(t);incomplete.scenes[0].paragraphs.pop();
  assert.throws(()=>validateTranslation(incomplete,r),/paragraph count/);
});
test('Daily and monthly editions expose both languages and escape translated prose',()=>{
  const r=record('2026-10-20','2026-10-20T20:00:00Z'),t=translation(r),translations={[r.id]:t};
  for(const html of [latestPage(r,'2026-10',translations),monthlyPage('2026-10',[r],translations)]){
    assert.ok(html.includes('data-language="en"')&&html.includes('data-language="sl"'));
    assert.ok(html.includes(t.title));
    assert.ok(html.includes('&lt;script&gt;prevod()&lt;/script&gt;'));
    assert.ok(!html.includes('<script>prevod()'));
    assert.ok(html.includes('lang="sl"')&&html.includes(r.content_sha256));
  }
});
test('next nightly publication retains an earlier SL translation and marks untranslated stories honestly',t=>{
  const root=temp(t),older=record('2026-10-20','2026-10-20T20:00:00Z'),oldLog=logRecord('2026-10-20');
  publish(root,older,oldLog,new Date(older.published_at));
  const dir=path.join(root,'public/Nara/daily/translations/sl');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,older.date+'.json'),JSON.stringify(translation(older)));
  const englishPath=path.join(root,'public/Nara/daily/records',older.date+'.json'),englishBefore=fs.readFileSync(englishPath,'utf8');
  const newer=record('2026-10-21','2026-10-21T20:00:00Z'),newLog=logRecord('2026-10-21');
  publish(root,newer,newLog,new Date(newer.published_at));
  for(const file of ['Nara-AI-daily.html','Nara-AI-2026-10.html']){
    const html=fs.readFileSync(path.join(root,'public/Nara',file),'utf8');
    assert.ok(html.includes('Slovenska zgodba'));
    assert.ok(html.includes('Ta zgodba je trenutno na voljo v angleščini.'));
  }
  assert.equal(fs.readFileSync(englishPath,'utf8'),englishBefore);
  assert.equal(Object.keys(loadTranslations(root,[older,newer])).length,1);
});

test('approved R3 illustrations stay in the monthly story while Daily links to the standalone edition',t=>{
  const root=temp(t),r=record();
  r.revision={date:'2026-10-06',edition:'R3',original_url:'Nara-AI-2026-10-05-original.html',original_log_url:'Nara-AI-2026-10-05-original-log.html'};
  r.scenes=Array.from({length:6},(_,i)=>({title:'Scene '+(i+1),paragraphs:['Paragraph '+(i+1),'Last sentence '+(i+1)]}));
  r.content_sha256=hash(JSON.stringify({title:r.title,deck:r.deck,shape:r.shape,scenes:r.scenes}));
  const tr=translation(r);
  tr.scenes=r.scenes.map((s,i)=>({title:'Prizor '+(i+1),paragraphs:['Odstavek '+(i+1),'Zadnji stavek '+(i+1)]}));
  tr.content_sha256=hash(JSON.stringify({title:tr.title,deck:tr.deck,shape:tr.shape,scenes:tr.scenes}));
  validateRecord(r);validateTranslation(tr,r);
  const base=path.join(root,'public/Nara'),imagesDir=path.join(base,'assets/img/daily/2026-10-05');
  fs.mkdirSync(imagesDir,{recursive:true});
  const items=Array.from({length:5},(_,i)=>{const raw='fixture-image-'+i,filename='fixture-'+i+'.png';fs.writeFileSync(path.join(imagesDir,filename),raw);return {scene:i+1,src:'assets/img/daily/2026-10-05/'+filename,width:1672,height:941,alt_en:'English scene '+(i+1),alt_sl:'Slovenska scena '+(i+1),sha256:hash(raw)}});
  const m={schema:'nara.daily.illustrations.v1',story_id:r.id,date:r.date,edition:'R3',en_content_sha256:r.content_sha256,sl_content_sha256:tr.content_sha256,images:items};
  const manifestPath=path.join(base,'daily/illustrations/2026-10-05.json');fs.mkdirSync(path.dirname(manifestPath),{recursive:true});fs.writeFileSync(manifestPath,JSON.stringify(m));
  const original=JSON.stringify(r),originalTr=JSON.stringify(tr),translations={[r.id]:tr};
  const daily=latestPage([r],'2026-10',translations,root);
  const monthly=monthlyPage('2026-10',[r],translations,root);
  assert.ok(daily.includes('Nara-AI-2026-10-05-format-R1.html'));
  assert.ok(!daily.includes('<figure class="daily-scene-figure">'));
  assert.equal((monthly.match(/<figure class="daily-scene-figure">/g)||[]).length,10);
  for(const lang of ['en','sl']){
    const a=monthly.match(new RegExp('<article class="story" lang="'+lang+'"[^>]*>[\\s\\S]*?<\\/article>'))?.[0];
    assert.ok(a);assert.equal((a.match(/<figure class="daily-scene-figure">/g)||[]).length,5);
    assert.equal((a.match(/loading="lazy" decoding="async"/g)||[]).length,5);
    assert.ok(!a.split('<h2>06 ·')[1].includes('<figure'));
    for(let i=0;i<5;i++)assert.ok(a.includes(lang==='en'?items[i].alt_en:items[i].alt_sl));
  }
  assert.equal(JSON.stringify(r),original);assert.equal(JSON.stringify(tr),originalTr);
  assert.equal(latestPage([r],'2026-10',translations,root),daily);
  const wrongHash={...m,en_content_sha256:'0'.repeat(64)};fs.writeFileSync(manifestPath,JSON.stringify(wrongHash));
  assert.doesNotThrow(()=>latestPage([r],'2026-10',translations,root));
  assert.throws(()=>monthlyPage('2026-10',[r],translations,root),/language content binding/);
  fs.writeFileSync(manifestPath,JSON.stringify(m));fs.writeFileSync(path.join(imagesDir,'fixture-0.png'),'corrupted');
  assert.throws(()=>monthlyPage('2026-10',[r],translations,root),/source hash mismatch/);
});
