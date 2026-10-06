import {test} from 'node:test';
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

test('dates reject invalid calendar days and traversal',()=>{for(const d of ['2026-02-30','2026-13-01','../2026-01-01','2026-1-01'])assert.equal(validDate(d),false);assert.equal(validDate('2028-02-29'),true)});
test('authors alternate across month and year boundaries',()=>{assert.equal(authorForDate('2026-10-05'),'GPT');assert.equal(authorForDate('2026-10-06'),'CLAUDE');assert.notEqual(authorForDate('2026-10-31'),authorForDate('2026-11-01'));assert.notEqual(authorForDate('2026-12-31'),authorForDate('2027-01-01'))});
test('22:00 stays local across autumn and spring DST',()=>{assert.equal(localParts('2026-10-24T20:00:00Z').hour,'22');assert.equal(localParts('2026-10-25T21:00:00Z').hour,'22');assert.equal(localParts('2027-03-27T21:00:00Z').hour,'22');assert.equal(localParts('2027-03-28T20:00:00Z').hour,'22')});
test('record and prose hash validate',()=>{assert.equal(validateRecord(record()).id,'NARA-D-2026-10-05');const r=record();r.scenes[0].paragraphs[0]='changed';assert.throws(()=>validateRecord(r),/hash mismatch/)});
test('Slovenian translation preserves scene and paragraph topology and hash',()=>{const r=record();r.translation_sl=translationSl(r);assert.equal(validateRecord(r).translation_sl.title,'Preskusna zgodba');const bad=record();bad.translation_sl=translationSl(bad);bad.translation_sl.scenes[0].paragraphs.pop();assert.throws(()=>validateRecord(bad),/translation_sl scene structure/);const badHash=record();badHash.translation_sl=translationSl(badHash);badHash.translation_sl.title='Spremenjeno';assert.throws(()=>validateRecord(badHash),/translation_sl content hash mismatch/)});
test('private fields never enter public story records',()=>{const r=record();r.drive_id='PRIVATE';assert.throws(()=>validateRecord(r),/unexpected\/private/)});
test('publication gate rejects missing peer closing line',()=>{const r=record();r.critic_line='';assert.throws(()=>validateRecord(r),/critic/)});
test('record rejects early local time and missing timezone',()=>{assert.throws(()=>validateRecord(record('2026-10-05','2026-10-05T19:59:00Z')),/before 22/);assert.throws(()=>validateRecord(record('2026-10-05','2026-10-05T22:00:00')),/timezone/)});
test('editorial log validates ten candidates and rejects private fields',()=>{assert.equal(validateLog(logRecord()).candidates.length,10);const short=logRecord();short.candidates.pop();assert.throws(()=>validateLog(short),/candidates/);const priv=logRecord();priv.task_id='PRIVATE';assert.throws(()=>validateLog(priv),/unexpected\/private/)});
test('log requires paired author and critic roles plus final close',()=>{const l=logRecord();l.selector='GPT';assert.throws(()=>validateLog(l),/pairing/);const missing=logRecord();missing.rounds=missing.rounds.filter(r=>r.stage!=='CRITIC_CLOSE');assert.throws(()=>validateLog(missing),/final\/close/)});
test('rendered peer text is inert, image-free, score-aware and bilingual',()=>{const r=record();r.literary_score=literaryScore();r.translation_sl=translationSl(r);validateRecord(r);const p=latestPage(r,'2026-10');assert.ok(p.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!p.includes('<script>alert(1)'));assert.ok(!/<img\b|<iframe\b|<svg\b/i.test(p));assert.ok(p.includes(r.critic_line));assert.ok(p.includes('ILLUMINARA / DAILY'));assert.ok(p.includes('Nara-AI-log.html'));assert.ok(p.includes('<details class="archive-item daily-item"'));assert.ok(!p.includes('<details class="archive-item daily-item" open'));assert.ok(p.includes('>87</button>'));assert.ok(p.includes('data-score-open'));assert.ok(p.includes('Combined blind literary score'));assert.ok(p.includes('data-language="sl"'));assert.ok(p.includes('Preskusna zgodba'));assert.ok(p.includes('lang="sl"'))});
test('Daily page keeps all supplied stories collapsed and newest first',()=>{const older=record('2026-10-05','2026-10-05T20:00:00Z'),newer=record('2026-10-06','2026-10-06T20:00:00Z');const p=latestPage([older,newer],'2026-10');assert.ok(p.includes('id="NARA-D-2026-10-05"'));assert.ok(p.includes('id="NARA-D-2026-10-06"'));assert.ok(p.indexOf('NARA-D-2026-10-06')<p.indexOf('NARA-D-2026-10-05'));assert.equal((p.match(/<details class="archive-item daily-item"/g)||[]).length,2);assert.ok(!/<details class="archive-item daily-item"[^>]*\sopen(?:\s|>)/.test(p))});
test('log page escapes summaries and exposes no operational fields',()=>{const l=logRecord();l.rounds[1].summary='<script>private()</script>';const p=logPage([l]);assert.ok(p.includes('&lt;script&gt;private()&lt;/script&gt;'));assert.ok(!p.includes('<script>private()'));assert.ok(!p.includes('drive_id'));assert.ok(p.includes('Illuminara Daily · Log'))});
test('empty initialization creates Daily, Archive and Log without inventing a story',t=>{const root=temp(t);const {records,n}=loadRecords(root);assert.equal(records.length,0);assert.ok(fs.readFileSync(path.join(n,'Nara-AI-daily.html'),'utf8').includes('not published yet'));assert.ok(fs.readFileSync(path.join(n,'Nara-AI-log.html'),'utf8').includes('not published yet'));assert.throws(()=>initialize(root,'2026-99'),/invalid month/)});
test('publish requires story and log to agree',t=>{const root=temp(t),r=record(),l=logRecord();l.title='Wrong';assert.throws(()=>publish(root,r,l,new Date(r.published_at)),/story\/log mismatch/);l.title=r.title;l.final_critic_line='Wrong';assert.throws(()=>publish(root,r,l,new Date(r.published_at)),/critic line mismatch/)});
test('publish writes seven outputs, is idempotent and conflicting replay fails',t=>{const root=temp(t),r=record(),l=logRecord();assert.match(publish(root,r,l,new Date(r.published_at)),/SEVEN_FILES/);const {n}=loadRecords(root);for(const f of ['daily/records/2026-10-05.json','daily/log/2026-10-05.json','daily/catalog.json','Nara-AI-daily.html','Nara-AI-2026-10.html','Nara-AI-archive.html','Nara-AI-log.html'])assert.ok(fs.existsSync(path.join(n,f)),f);const state=fs.readFileSync(path.join(n,'daily/catalog.json'),'utf8');assert.equal(publish(root,r,l,new Date(r.published_at)),'ALREADY_PUBLISHED');assert.equal(fs.readFileSync(path.join(n,'daily/catalog.json'),'utf8'),state);const other=logRecord();other.rounds[0].summary='changed';assert.throws(()=>publish(root,r,other,new Date(r.published_at)),/different log/)});
test('old days and future timestamps cannot be published',t=>{const root=temp(t),l=logRecord();assert.throws(()=>publish(root,record(),l,new Date('2026-10-05T19:59:00Z')),/future/);assert.throws(()=>publish(root,record(),l,new Date('2026-10-06T20:00:00Z')),/current local/)});
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
  const r=record(),t=translation(r),translations={[r.id]:t};
  for(const html of [latestPage(r,'2026-10',translations),monthlyPage('2026-10',[r],translations)]){
    assert.ok(html.includes('data-language="en"')&&html.includes('data-language="sl"'));
    assert.ok(html.includes(t.title));
    assert.ok(html.includes('&lt;script&gt;prevod()&lt;/script&gt;'));
    assert.ok(!html.includes('<script>prevod()'));
    assert.ok(html.includes('lang="sl"')&&html.includes(r.content_sha256));
  }
});
test('next nightly publication retains an earlier SL translation and marks untranslated stories honestly',t=>{
  const root=temp(t),older=record(),oldLog=logRecord();
  publish(root,older,oldLog,new Date(older.published_at));
  const dir=path.join(root,'public/Nara/daily/translations/sl');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,older.date+'.json'),JSON.stringify(translation(older)));
  const englishPath=path.join(root,'public/Nara/daily/records',older.date+'.json'),englishBefore=fs.readFileSync(englishPath,'utf8');
  const newer=record('2026-10-06','2026-10-06T20:00:00Z'),newLog=logRecord('2026-10-06');
  publish(root,newer,newLog,new Date(newer.published_at));
  for(const file of ['Nara-AI-daily.html','Nara-AI-2026-10.html']){
    const html=fs.readFileSync(path.join(root,'public/Nara',file),'utf8');
    assert.ok(html.includes('Slovenska zgodba'));
    assert.ok(html.includes('Ta zgodba je trenutno na voljo v angleščini.'));
  }
  assert.equal(fs.readFileSync(englishPath,'utf8'),englishBefore);
  assert.equal(Object.keys(loadTranslations(root,[older,newer])).length,1);
});
