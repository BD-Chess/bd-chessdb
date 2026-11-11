import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {renderEditionPage,editionPaths,pairedAssessment} from '../scripts/nara-format-editions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {hash,validDate,authorForDate,localParts,validateRecord,validateCatalog,validateLog,validateTranslation,loadTranslations,latestPage,monthlyPage,logPage,initialize,publish,loadRecords,dailyDisplayTitle,featuredStoryFilename,renderFeaturedStoryPage,featuredStoryPageOutputs} from '../scripts/nara-daily.mjs';

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
test('Daily keeps only one winning story; S2/S3 never leak into the landing',t=>{
 const root=temp(t),n=path.join(root,'public/Nara'),files=['daily/days/2026-10-09.json',...['S1','S2','S3'].flatMap(instance=>['daily/records/2026-10-09/'+instance+'.json','daily/translations/sl/2026-10-09/'+instance+'.json'])];
 for(const file of files){fs.mkdirSync(path.dirname(path.join(n,file)),{recursive:true});fs.copyFileSync(path.join(editionRoot,'public/Nara',file),path.join(n,file));}
 const source=JSON.parse(fs.readFileSync(path.join(n,'daily/records/2026-10-09/S1.json'),'utf8')),featured={...source,schema:'nara.daily.record.v1',id:'NARA-D-2026-10-09'};
 const frozen=JSON.stringify(source),render=()=>latestPage([record('2026-10-20','2026-10-20T20:00:00Z'),featured],'2026-10',{},root),html=render();
 assert.equal((html.match(/class="notice daily-index-item"/g)||[]).length,2);
 assert.match(html,/Eleven Minutes Of Peace/);
 assert.match(html,/Nara-AI-2026-10-09-S1-format-R1.html/);
 assert.match(html,/class="score-chip[^"]*"[^>]*>65<\/span>/);
 assert.ok(!html.includes(source.scenes[0].paragraphs[0]));
 for(const instance of ['S2','S3'])assert.ok(!html.includes('id="NARA-D-2026-10-09:'+instance+'"'));
 assert.doesNotMatch(html,/class="archive-item daily-item"|batch-other-stories/);
 assert.equal(render(),html);assert.equal(JSON.stringify(source),frozen);
 fs.appendFileSync(path.join(n,'daily/records/2026-10-09/S2.json'),' ');
 assert.equal(render(),html);
});

function illustratedOct9S1(){
 const paths=editionPaths('2026-10-09-S1'),read=f=>JSON.parse(fs.readFileSync(path.join(editionRoot,'public/Nara',f),'utf8'));
 const en=read(paths.en),sl=read(paths.sl),binding=read(paths.binding);
 return {paths,en,sl,binding,originalEn:read(paths.source_en),originalSl:read(paths.source_sl),combined:pairedAssessment(binding.assessment,en.content_sha256)};
}
test('public edition artwork keeps private provenance out and binds all three bilingual anchors',()=>{
 const item=illustratedOct9S1(),art=JSON.parse(fs.readFileSync(path.join(editionRoot,'public/Nara',item.paths.artwork),'utf8'));
 assert.ok(['nara.format.edition.artwork.v3','nara.format.edition.artwork.v5'].includes(art.schema));
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
 const current=JSON.parse(fs.readFileSync(path.join(editionRoot,'public/Nara',item.paths.artwork),'utf8'));
 const art=current.landscape_hd_source?JSON.parse(fs.readFileSync(path.join(editionRoot,'public/Nara',current.landscape_hd_source.src),'utf8')):current;
 fs.mkdirSync(path.dirname(manifestPath),{recursive:true});
  const dayPath=path.join(n,'daily/days',item.paths.date+'.json');fs.mkdirSync(path.dirname(dayPath),{recursive:true});fs.copyFileSync(path.join(editionRoot,'public/Nara/daily/days',item.paths.date+'.json'),dayPath);
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
test('log preserves split failover roles and still requires an independent close',()=>{const l=logRecord();l.proposer='CLAUDE';l.selector='GPT';assert.equal(validateLog(l).author,'GPT');const same=logRecord();same.critic='GPT';assert.throws(()=>validateLog(same),/independent/);const missing=logRecord();missing.rounds=missing.rounds.filter(r=>r.stage!=='CRITIC_CLOSE');assert.throws(()=>validateLog(missing),/final\/close/)});

test('13 and 14 October selected stories have full source-bound standalone readers',()=>{
 const {records}=loadRecords(editionRoot),translations=loadTranslations(editionRoot,records);
 const result=featuredStoryPageOutputs(editionRoot,records,translations);
 const expected=[['2026-10-13','S2',88],['2026-10-14','S1',92]];
 for(const [date,instance,grade] of expected){
   const r=records.find(x=>x.date===date),t=translations[r.id],file='Nara-AI-'+date+'-'+instance+'-story.html';
   assert.equal(featuredStoryFilename(editionRoot,r),file);
   const html=result[file]??renderFeaturedStoryPage(editionRoot,r,t);
   assert.ok(html.includes(r.content_sha256)&&html.includes(t.content_sha256));
   assert.ok(html.includes('data-reader-rating='));
   assert.ok(!html.includes('>Reader score</span>'));
   assert.ok(html.includes('<strong>'+r.literary_score.combined));
   assert.equal((html.match(/<figure class="daily-scene-figure">/g)||[]).length,6);
   assert.ok(html.includes('data-language-content="en"')&&html.includes('data-language-content="sl"'));
   assert.ok(html.includes('<article class="story"')&&!html.includes('class="archive-item'));
   assert.ok(html.includes('href="Nara-AI-daily.html"'));
   assert.ok(html.includes('data-story-id="'+r.id+'"'));
   assert.ok(fs.existsSync(path.join(editionRoot,'public/Nara',file)),'published reader missing '+file);
   const current=fs.readFileSync(path.join(editionRoot,'public/Nara',file),'utf8');
   assert.ok(current.includes(r.content_sha256)&&current.includes(t.content_sha256));
 }
 const daily=fs.readFileSync(path.join(editionRoot,'public/Nara/Nara-AI-daily.html'),'utf8');
 assert.equal((daily.match(/class="notice daily-index-item"/g)||[]).length,records.length);
 const links=[...daily.matchAll(/<h2 class="daily-index-title"><a href="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(links.length,records.length);
 for(const href of links){
   assert.ok(!href.includes('#'),'Daily must never deep-link to a collapsed archive section');
   assert.ok(fs.existsSync(path.join(editionRoot,'public/Nara',href)),'missing linked reading page '+href);
 }
 for(const [date,instance] of expected)assert.ok(daily.includes('href="Nara-AI-'+date+'-'+instance+'-story.html"'));
});

test('Daily is a bilingual score-aware index without inline prose',()=>{
 const r=record('2026-10-20','2026-10-20T20:00:00Z');
 r.literary_score=literaryScore();r.translation_sl=translationSl(r);validateRecord(r);
 const p=latestPage(r,'2026-10');
 assert.ok(!p.includes('&lt;script&gt;alert(1)&lt;/script&gt;')&&!p.includes('<script>alert(1)'));
 assert.ok(!/<img\b|<iframe\b|<svg\b/i.test(p));assert.ok(!p.includes(r.critic_line));
 assert.ok(!p.includes('<details class="archive-item'));
 assert.ok(p.includes('Fixture Only — Not A Real Story')&&p.includes('Preskusna zgodba'));
 assert.ok(p.includes('ILLUMINARA / DAILY')&&p.includes('Nara-AI-log.html'));
 assert.ok(p.includes('Nara-AI-2026-10.html#NARA-D-2026-10-20'));
 assert.ok(p.includes('class="score-chip score-trend--neutral"')&&p.includes('>87</span>'));
 assert.ok(p.includes('data-language="sl"')&&p.includes('lang="sl"'));
});
test('Daily EN title case and SL sentence case are display-only',()=>{
 assert.equal(dailyDisplayTitle('THE SMALL GOD IN THE LOST-AND-FOUND','en'),'The Small God In The Lost-And-Found');
 assert.equal(dailyDisplayTitle("WHAT THE OLD WOMAN'S TERRACES KNEW",'en'),"What The Old Woman's Terraces Knew");
 assert.equal(dailyDisplayTitle('KAJ SO VEDELE STARKINE TERASE','sl'),'Kaj so vedele starkine terase');
 assert.equal(dailyDisplayTitle('MALI BOG V URADU ZA NAJDENE PREDMETE','sl'),'Mali bog v uradu za najdene predmete');
 assert.equal(dailyDisplayTitle('NARA IN ILLUMINARA TER GPT','sl'),'Nara in Illuminara ter GPT');
});

test('Daily renders one linked graded title per date, with archive fallback for pending editions',()=>{
 const linked=['2026-10-05','2026-10-06','2026-10-07','2026-10-08'].map(d=>record(d,d+'T20:00:00Z'));
 const other=record('2026-10-10','2026-10-10T20:00:00Z');
 linked.forEach((r,i)=>{r.deck='INLINE_BODY_MUST_NOT_RENDER_'+i;r.literary_score=literaryScore()});
 other.literary_score=literaryScore();
 const p=latestPage([...linked,other],'2026-10');
 assert.equal((p.match(/class="notice daily-index-item"/g)||[]).length,5);
 for(const r of linked){
   const start=p.indexOf('<article class="notice daily-index-item" id="'+r.id+'"');
   assert.ok(start>=0);
   const card=p.slice(start,p.indexOf('</article>',start)+10);
   assert.equal((card.match(/<a\b/g)||[]).length,1);
   assert.ok(card.includes('<time datetime="'+r.date+'">'+r.date+'</time>'));
   assert.ok(card.includes('href="Nara-AI-'+r.date+'-format-R1.html"'));
   assert.ok(!card.includes('Nara-AI-archive.html'));
   assert.ok(!p.includes(r.deck));
 }
 assert.ok(p.includes('href="Nara-AI-2026-10.html#NARA-D-2026-10-10"'));
 assert.doesNotMatch(p,/class="archive-item daily-item"|batch-other-stories/);
 assert.ok(p.indexOf(other.id)<p.indexOf(linked[3].id));
 assert.ok(p.indexOf(linked[3].id)<p.indexOf(linked[2].id));
 const month=monthlyPage('2026-10',linked);
 for(const r of linked)assert.ok(month.includes('<details class="archive-item" id="'+r.id+'">'));
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
test('Daily displays bilingual titles; monthly archive retains fully escaped story text',()=>{
 const r=record('2026-10-20','2026-10-20T20:00:00Z'),t=translation(r),translations={[r.id]:t};
 const daily=latestPage(r,'2026-10',translations),monthly=monthlyPage('2026-10',[r],translations);
 for(const html of [daily,monthly]){
   assert.ok(html.includes('data-language="en"')&&html.includes('data-language="sl"'));
   assert.ok(html.includes(t.title)&&html.includes('lang="sl"')&&html.includes(r.content_sha256));
   assert.ok(!html.includes('<script>prevod()'));
 }
 assert.ok(!daily.includes('&lt;script&gt;prevod()&lt;/script&gt;'));
 assert.ok(monthly.includes('&lt;script&gt;prevod()&lt;/script&gt;'));
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
    if(file==='Nara-AI-2026-10.html')assert.ok(html.includes('Ta zgodba je trenutno na voljo v angleščini.'));
    else assert.ok(!html.includes('Ta zgodba je trenutno na voljo v angleščini.'));
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

test('Daily calendar after the cards: weekday grid, story counts and every story of a day',t=>{
 const root=temp(t),n=path.join(root,'public/Nara'),files=['daily/days/2026-10-09.json',...['S1','S2','S3'].flatMap(instance=>['daily/records/2026-10-09/'+instance+'.json','daily/translations/sl/2026-10-09/'+instance+'.json'])];
 for(const file of files){fs.mkdirSync(path.dirname(path.join(n,file)),{recursive:true});fs.copyFileSync(path.join(editionRoot,'public/Nara',file),path.join(n,file));}
 const source=JSON.parse(fs.readFileSync(path.join(n,'daily/records/2026-10-09/S1.json'),'utf8')),featured={...source,schema:'nara.daily.record.v1',id:'NARA-D-2026-10-09'};
 const html=latestPage([record('2026-10-20','2026-10-20T20:00:00Z'),featured],'2026-10',{},root);
 const start=html.indexOf('<section class="daily-calendar"');
 assert.ok(start>html.lastIndexOf('class="notice daily-index-item"'),'calendar follows the cards');
 const cards=html.slice(0,start),cal=html.slice(start,html.indexOf('</main>'));
 assert.equal((cal.match(/class="cal-month"/g)||[]).length,1);
 assert.equal((cal.match(/class="cal-blank"/g)||[]).length,3,'1 October 2026 is a Thursday');
 assert.equal((cal.match(/class="cal-day cal-day--empty"/g)||[]).length,18);
 assert.equal((cal.match(/class="cal-day cal-day--future"/g)||[]).length,11);
 assert.match(cal,/data-dow="5" data-count="3"><a class="cal-day-link" href="Nara-AI-2026-10-09-S1-format-R1.html"><span class="cal-day-top"><span class="cal-date">9<\/span>/);
 assert.match(cal,/data-dow="2" data-count="1"><a class="cal-day-link" href="Nara-AI-2026-10.html#NARA-D-2026-10-20"><span class="cal-day-top"><span class="cal-date">20<\/span>/);
 const day9=cal.slice(cal.indexOf('data-count="3"'),cal.indexOf('</ul>',cal.indexOf('data-count="3"')));
 assert.equal((day9.match(/<li>/g)||[]).length,3);
 assert.match(day9,/<ul><li><a href="Nara-AI-2026-10-09-S1-format-R1.html" class="cal-featured">/,'selected story first');
 for(const instance of ['S2','S3']){
  assert.ok(day9.includes('href="Nara-AI-2026-10.html#NARA-D-2026-10-09:'+instance+'"'),'calendar lists '+instance);
  assert.ok(!cards.includes('NARA-D-2026-10-09:'+instance),'cards keep only the winner');
 }
 for(const s of ['>3 stories<','>3 zgodbe<','>1 story<','>1 zgodba<','>4 stories<','>4 zgodbe<','>2 days<','>2 dneva<'])assert.ok(cal.includes(s),s);
 assert.ok(!cal.includes(source.scenes[0].paragraphs[0]),'no story prose in the calendar');
});

test('late publication: only a BD decision allows a later publication date; a same-model close must be a recorded stand-in',()=>{
  const late={decided_by:'BD',decided_on:'2026-10-08',reason:'Published later by BD decision.',reason_sl:'Objavljeno naknadno po odločitvi BD.'};
  const r=record('2026-10-06','2026-10-08T10:00:00Z');
  assert.throws(()=>validateRecord(r),/wrong local date/);
  assert.equal(validateRecord({...r,late_publication:late}).date,'2026-10-06');
  assert.throws(()=>validateRecord({...r,late_publication:{...late,decided_by:'GPT'}}),/BD decision/);
  assert.throws(()=>validateRecord({...r,late_publication:{...late,decided_on:'2026-10-07'}}),/wrong local date/);
  assert.throws(()=>validateRecord({...r,late_publication:{...late,decided_on:'2026-10-06'}}),/decision date/);
  const l=logRecord('2026-10-06');
  assert.throws(()=>validateLog({...l,critic:'GPT'}),/independent/);
  assert.equal(validateLog({...l,critic:'GPT',stand_in_for:'CLAUDE'}).stand_in_for,'CLAUDE');
  assert.throws(()=>validateLog({...l,stand_in_for:'CLAUDE'}),/stand-in/);
  assert.ok(logPage([{...l,critic:'GPT',stand_in_for:'CLAUDE'}]).includes('selected and edited, standing in for Claude'));
  assert.ok(!logPage([l]).includes('standing in'));
});

test('late publication publishes a held day once, on the decision date, with its note and without a reader score',async t=>{
  const {publishLate}=await import('../scripts/nara-daily-late.mjs');
  const root=temp(t);
  for(const date of ['2026-10-20','2026-10-22']){const r=record(date,date+'T20:00:00Z');publish(root,r,logRecord(date),new Date(r.published_at))}
  const date='2026-10-21',id='NARA-D-2026-10-21:S1',at='2026-10-23T09:00:00Z',base=record(date,at),tr=translationSl(base);
  const late={decided_by:'BD',decided_on:'2026-10-23',reason:'Published later by BD decision; no reader score yet.',reason_sl:'Objavljeno naknadno po odločitvi BD; bralske ocene še ni.'};
  const translation={schema:'nara.daily.translation.v1',story_id:id,date,language:'sl',translated_by:'GPT',source_content_sha256:base.content_sha256,title:tr.title,deck:tr.deck,shape:tr.shape,scenes:tr.scenes,critic_line:tr.critic_line,content_sha256:tr.content_sha256};
  const rec={schema:'nara.daily.instance_record.v1',id,day_id:'NARA-D-'+date,date,instance:'S1',published_at:at,closed_at:date+'T06:00:00Z',title:base.title,deck:base.deck,shape:base.shape,scenes:base.scenes,critic_line:base.critic_line,content_sha256:base.content_sha256,translation_sl:translation,late_publication:late};
  const log={schema:'nara.daily.instance_log.v1',id:id+'-LOG',story_id:id,day_id:'NARA-D-'+date,date,instance:'S1',title:base.title,proposer:'GPT',selector:'GPT',author:'GPT',critic:'GPT',stand_in_for:'CLAUDE',
    rounds:[{actor:'GPT',stage:'STORY_SELECTION',summary:'Selected.'},{actor:'GPT',stage:'AUTHOR_FINAL',summary:'Final.'},{actor:'GPT',stage:'CRITIC_CLOSE',summary:'Closed.'}],final_critic_line:base.critic_line};
  const candidates=logRecord(date).candidates.map((c,i)=>i===2?{...c,title:base.title}:c);
  const batch={schema:'nara.daily.late_publish.v1',date,published_at:at,late_publication:late,featured_instance:'S1',candidates,selection:{title:base.title,reason:'Clear conflict.',risk:'Easy ending.'},instances:[{instance:'S1',record:rec,log}]};
  assert.throws(()=>publishLate(root,batch,new Date('2026-10-24T09:00:00Z')),/decision date/);
  assert.throws(()=>publishLate(root,{...batch,instances:[{instance:'S1',record:rec,log:{...log,evaluation:{}}}]},new Date('2026-10-23T10:00:00Z')),/no reader evaluation/);
  assert.equal(publishLate(root,batch,new Date('2026-10-23T10:00:00Z')).status,'LOCAL_LATE_PUBLICATION_READY');
  const {n,records}=loadRecords(root);
  assert.deepEqual(records.map(r=>r.date),['2026-10-22','2026-10-21','2026-10-20']);
  const day=JSON.parse(fs.readFileSync(path.join(n,'daily/days/2026-10-21.json'),'utf8'));
  assert.equal(day.instances[0].combined,null);assert.equal(day.late_publication.decided_by,'BD');
  const daily=fs.readFileSync(path.join(n,'Nara-AI-daily.html'),'utf8');
  assert.ok(daily.includes('href="Nara-AI-2026-10-21-S1-story.html"'),'card links the story page');
  const month=fs.readFileSync(path.join(n,'Nara-AI-2026-10.html'),'utf8'),at22=month.indexOf('id="NARA-D-2026-10-22"'),at21=month.indexOf('id="NARA-D-2026-10-21"'),at20=month.indexOf('id="NARA-D-2026-10-20"');
  assert.ok(at22<at21&&at21<at20,'monthly order');assert.ok(month.includes('late-publication-note'));
  assert.ok(fs.readFileSync(path.join(n,'Nara-AI-2026-10-21-S1-story.html'),'utf8').includes('Objavljeno naknadno'));
  assert.ok(fs.readFileSync(path.join(n,'Nara-AI-log.html'),'utf8').includes('standing in for Claude'));
  assert.throws(()=>publishLate(root,batch,new Date('2026-10-23T11:00:00Z')),/already published/);
});

test('late backfill keeps all unrated companions and an untranslated companion through later refresh',async t=>{
  const {publishLate}=await import('../scripts/nara-daily-late.mjs');
  const {refreshIllustratedPages}=await import('../scripts/nara-daily-batch.mjs');
  const root=temp(t),date='2026-10-21',at='2026-10-23T09:00:00Z';
  for(const d of ['2026-10-20','2026-10-22'])publish(root,record(d,d+'T20:00:00Z'),logRecord(d),new Date(d+'T20:00:00Z'));
  const late={decided_by:'BD',decided_on:'2026-10-23',reason:'Published later; reader scores are pending.',reason_sl:'Objavljeno naknadno; bralske ocene še niso pripravljene.'};
  const instances=['S1','S2','S3'].map((s,i)=>{
    const id=`NARA-D-${date}:${s}`,base=record(date,at);base.title=`Late story ${s}`;base.content_sha256=hash(JSON.stringify({title:base.title,deck:base.deck,shape:base.shape,scenes:base.scenes}));
    const tr=translationSl(base),translation={schema:'nara.daily.translation.v1',story_id:id,date,language:'sl',source_content_sha256:base.content_sha256,title:tr.title,deck:tr.deck,shape:tr.shape,scenes:tr.scenes,critic_line:tr.critic_line,content_sha256:tr.content_sha256};
    const rec={schema:'nara.daily.instance_record.v1',id,day_id:`NARA-D-${date}`,date,instance:s,published_at:at,closed_at:date+'T06:00:00Z',title:base.title,deck:base.deck,shape:base.shape,scenes:base.scenes,critic_line:base.critic_line,content_sha256:base.content_sha256,...(i===2?{}:{translation_sl:translation}),late_publication:late};
    const log={schema:'nara.daily.instance_log.v1',id:id+'-LOG',story_id:id,day_id:`NARA-D-${date}`,date,instance:s,title:base.title,proposer:'GPT',selector:'CLAUDE',author:'GPT',critic:'CLAUDE',rounds:[{actor:'CLAUDE',stage:'STORY_SELECTION',summary:'Selected.'},{actor:'GPT',stage:'AUTHOR_FINAL',summary:'Final.'},{actor:'CLAUDE',stage:'CRITIC_CLOSE',summary:'Closed.'}],final_critic_line:base.critic_line};
    return {instance:s,record:rec,log};
  });
  const candidates=logRecord(date).candidates.map((c,i)=>i<3?{...c,title:`Late story S${i+1}`}:c);
  const batch={schema:'nara.daily.late_publish.v1',date,published_at:at,late_publication:late,featured_instance:'S1',candidates,selection:{title:'Late story S1',reason:'First available story.',risk:'Score pending.'},instances};
  publishLate(root,batch,new Date('2026-10-23T10:00:00Z'));
  const n=path.join(root,'public/Nara'),day=JSON.parse(fs.readFileSync(path.join(n,`daily/days/${date}.json`),'utf8'));
  assert.equal(day.story_count,3);assert.equal(day.instances[2].translation_file,null);assert.ok(day.instances.every(x=>x.combined===null));
  let monthly=fs.readFileSync(path.join(n,'Nara-AI-2026-10.html'),'utf8');
  for(const s of ['S2','S3'])assert.ok(monthly.includes(`id="NARA-D-${date}:${s}"`));
  assert.match(monthly,/independent reader scores are pending/);assert.match(monthly,/Ta zgodba je trenutno na voljo v angleščini/);
  const {archiveDaySections}=await import('../scripts/nara-daily-batch.mjs');
  const archive=fs.readFileSync(path.join(n,'Nara-AI-archive.html'),'utf8'),archived=archiveDaySections(archive).find(s=>s.date===date);
  assert.ok(archived);for(const s of ['S1','S2','S3'])assert.ok(archived.html.includes(`#NARA-D-${date}:${s}`));
  assert.match(archived.html,/stories published later/);
  refreshIllustratedPages(root,'2026-10');monthly=fs.readFileSync(path.join(n,'Nara-AI-2026-10.html'),'utf8');
  for(const s of ['S2','S3'])assert.ok(monthly.includes(`id="NARA-D-${date}:${s}"`));
  assert.match(monthly,/independent reader scores are pending/);assert.match(monthly,/Ta zgodba je trenutno na voljo v angleščini/);
});

test('batch path: a BD-decided late day with three scored stories and a recorded stand-in is published on the decision date, a normal day still on its own date',async t=>{
  const {publishBatch,validateBatch,archiveDaySections}=await import('../scripts/nara-daily-batch.mjs');
  const root=temp(t),n=path.join(root,'public/Nara');
  for(const date of ['2026-10-20','2026-10-21']){const r=record(date,date+'T20:00:00Z');publish(root,r,logRecord(date),new Date(r.published_at))}
  const scores={S1:[80,70],S2:[90,84],S3:[85,80]},titles={S1:'Fixture story one',S2:'Fixture story two',S3:'Fixture story three'};
  const makeBatch=(date,at,late,stand=true)=>{
    const candidates=logRecord(date).candidates.map((c,i)=>i<3?{...c,title:titles['S'+(i+1)]}:c);
    const instances=['S1','S2','S3'].map(S=>{
      const id=`NARA-D-${date}:${S}`,base={...record(date,at),title:titles[S]};base.content_sha256=hash(JSON.stringify({title:base.title,deck:base.deck,shape:base.shape,scenes:base.scenes}));
      const tr=translationSl(base),[g,c]=scores[S],combined=(g+c)/2,display=Math.floor(combined+.5);
      const translation={schema:'nara.daily.translation.v1',story_id:id,date,language:'sl',translated_by:'GPT',source_content_sha256:base.content_sha256,title:tr.title,deck:tr.deck,shape:tr.shape,scenes:tr.scenes,critic_line:tr.critic_line,content_sha256:tr.content_sha256};
      const rec={schema:'nara.daily.instance_record.v1',id,day_id:'NARA-D-'+date,date,instance:S,published_at:at,closed_at:date+'T17:00:00Z',title:base.title,deck:base.deck,shape:base.shape,scenes:base.scenes,critic_line:base.critic_line,content_sha256:base.content_sha256,
        literary_score:{combined,display,method:'READER_APPEAL_R1 equal 50/50 mean',blind:true,weights:{gpt:.5,claude:.5},shared_strengths:['Strong.','Warm.'],shared_reservations:['Dense.','No specific drop-off passage identified.']},translation_sl:translation,...(late?{late_publication:late}:{})};
      const own=S==='S2'&&stand;
      const log={schema:'nara.daily.instance_log.v1',id:id+'-LOG',story_id:id,day_id:'NARA-D-'+date,date,instance:S,title:base.title,proposer:'GPT',selector:'CLAUDE',author:own?'CLAUDE':'GPT',critic:'CLAUDE',...(own?{stand_in_for:'GPT'}:{}),
        rounds:[{actor:'CLAUDE',stage:'STORY_SELECTION',summary:'Selected.'},{actor:own?'CLAUDE':'GPT',stage:'AUTHOR_FINAL',summary:'Final.'},{actor:'CLAUDE',stage:'CRITIC_CLOSE',summary:'Closed.'}],final_critic_line:base.critic_line,
        evaluation:{blind:true,method:'equal_weight_mean',gpt:{score:g,rubric:'READER_APPEAL_R1'},claude:{score:c,rubric:'READER_APPEAL_R1'},weights:{gpt:.5,claude:.5},combined,display,note:'Locked blind scores only.'}};
      return {instance:S,record:rec,log};
    });
    return {schema:'nara.daily.batch.publish.v1',date,published_at:at,cutoff_local:'20:30',...(late?{late_publication:late}:{}),candidates,selections:['S1','S2','S3'].map(S=>({instance:S,title:titles[S],reason:'Clear conflict.',risk:'Easy ending.'})),instances};
  };
  const late={decided_by:'BD',decided_on:'2026-10-23',reason:'Published later by BD decision; the day freeze was never created.',reason_sl:'Objavljeno naknadno po odločitvi BD; zamrznitev dneva ni nastala.'};
  const lateBatch=makeBatch('2026-10-22','2026-10-23T00:30:00Z',late);
  assert.doesNotThrow(()=>validateBatch(lateBatch));
  assert.throws(()=>publishBatch(root,lateBatch,new Date('2026-10-24T09:00:00Z')),/not current local date/);
  assert.throws(()=>validateBatch({...lateBatch,late_publication:{...late,decided_by:'GPT'}}),/BD decision/);
  assert.throws(()=>validateBatch({...lateBatch,published_at:'2026-10-22T20:00:00Z'}),/published_at local date/);
  assert.throws(()=>validateBatch({...lateBatch,instances:lateBatch.instances.map(x=>x.instance==='S2'?{...x,log:{...x.log,stand_in_for:undefined}}:x)}),/independent or a recorded stand-in/);
  assert.throws(()=>validateBatch({...lateBatch,instances:lateBatch.instances.map(x=>x.instance==='S2'?{...x,log:{...x.log,stand_in_for:'CLAUDE'}}:x)}),/stand-in model/);
  assert.throws(()=>validateBatch({...lateBatch,instances:lateBatch.instances.map(x=>({...x,record:{...x.record,late_publication:undefined}}))}),/wrong local date/);
  assert.throws(()=>validateBatch({...lateBatch,instances:lateBatch.instances.map(x=>({...x,record:{...x.record,late_publication:{...late,reason:'A different reason.'}}}))}),/record late publication binding/);
  assert.throws(()=>validateBatch(makeBatch('2026-10-22','2026-10-22T20:00:00Z',null).instances.length&&{...makeBatch('2026-10-22','2026-10-22T20:00:00Z',null),instances:makeBatch('2026-10-22','2026-10-22T20:00:00Z',null).instances.map(x=>({...x,record:{...x.record,late_publication:late}}))}),/late publication/);
  const result=publishBatch(root,lateBatch,new Date('2026-10-23T01:00:00Z'));
  assert.equal(result.status,'LOCAL_BATCH_CANDIDATE_READY');assert.equal(result.featured,'S2');
  const day=JSON.parse(fs.readFileSync(path.join(n,'daily/days/2026-10-22.json'),'utf8'));
  assert.equal(day.featured_instance,'S2');assert.equal(day.story_count,3);assert.deepEqual(day.late_publication,late);
  assert.deepEqual(day.instances.map(x=>x.combined),[75,87,82.5]);
  assert.equal(day.published_at,'2026-10-23T00:30:00Z');
  const daily=fs.readFileSync(path.join(n,'Nara-AI-daily.html'),'utf8');
  assert.ok(daily.includes('Nara-AI-2026-10-22-S2-story.html'),'Daily card links the featured story');
  assert.ok(fs.readFileSync(path.join(n,'Nara-AI-2026-10-22-S2-story.html'),'utf8').includes('late-publication-note'),'the featured story page shows the late note');
  assert.ok(!daily.includes('id="NARA-D-2026-10-22:S1"'),'companions stay off the Daily landing');
  const month=fs.readFileSync(path.join(n,'Nara-AI-2026-10.html'),'utf8');
  assert.ok(month.includes('Other stories of 2026-10-22')&&month.includes('id="NARA-D-2026-10-22:S1"')&&month.includes('id="NARA-D-2026-10-22:S3"'),'companions are listed in the month');
  assert.ok((month.match(/late-publication-note/g)||[]).length>=3,'featured and both companions show the late note');
  assert.ok(fs.existsSync(path.join(n,'Nara-AI-2026-10-22-S2-story.html')));
  assert.match(fs.readFileSync(path.join(n,'Nara-AI-log.html'),'utf8'),/standing in for GPT/);
  assert.equal(publishBatch(root,lateBatch,new Date('2026-10-23T02:00:00Z')).status,'ALREADY_PUBLISHED_BATCH');
  const archive=()=>fs.readFileSync(path.join(n,'Nara-AI-archive.html'),'utf8');
  const afterLate=archiveDaySections(archive());
  assert.deepEqual(afterLate.map(x=>x.date),['2026-10-22']);
  for(const S of ['S1','S2','S3'])assert.ok(afterLate[0].html.includes(`href="Nara-AI-2026-10.html#NARA-D-2026-10-22:${S}"`),'archive links every story of the late day');
  // a normal day keeps its own date: it publishes on that date, never the next one, carries no late note and keeps the strict independence rule
  const next=makeBatch('2026-10-24','2026-10-24T19:20:00Z',null,false);
  assert.throws(()=>validateBatch(makeBatch('2026-10-24','2026-10-24T19:20:00Z',null,true)),/stand-in is allowed only in a validated late batch/);
  assert.throws(()=>publishBatch(root,next,new Date('2026-10-25T09:00:00Z')),/not current local date/);
  assert.equal(publishBatch(root,next,new Date('2026-10-24T19:30:00Z')).status,'LOCAL_BATCH_CANDIDATE_READY');
  assert.equal(JSON.parse(fs.readFileSync(path.join(n,'daily/days/2026-10-24.json'),'utf8')).late_publication,undefined);
  // the archive keeps every earlier published day, byte for byte, and adds the new one last
  const afterNext=archiveDaySections(archive());
  assert.deepEqual(afterNext.map(x=>x.date),['2026-10-22','2026-10-24']);
  assert.equal(afterNext[0].html,afterLate[0].html,'the earlier day section is carried over unchanged');
  for(const S of ['S1','S2','S3'])assert.ok(afterNext[1].html.includes(`href="Nara-AI-2026-10.html#NARA-D-2026-10-24:${S}"`));
  const third=makeBatch('2026-10-25','2026-10-25T19:20:00Z',null,false);
  assert.equal(publishBatch(root,third,new Date('2026-10-25T19:30:00Z')).status,'LOCAL_BATCH_CANDIDATE_READY');
  assert.deepEqual(archiveDaySections(archive()).map(x=>x.date),['2026-10-22','2026-10-24','2026-10-25'],'no day is dropped or duplicated');
  assert.equal(publishBatch(root,third,new Date('2026-10-25T20:30:00Z')).status,'ALREADY_PUBLISHED_BATCH');
  assert.deepEqual(archiveDaySections(archive()).map(x=>x.date),['2026-10-22','2026-10-24','2026-10-25']);
});

test('optional Slovenian easy-reading edition is source-bound and leaves the published story untouched',async()=>{
  const {validateLightEdition,loadLightEdition}=await import('../scripts/nara-daily.mjs');
  const {records}=loadRecords(editionRoot),translations=loadTranslations(editionRoot,records);
  const r=records.find(x=>x.date==='2026-11-04'),light=loadLightEdition(editionRoot,r);
  assert.ok(light,'2026-11-04 carries a light edition');
  assert.equal(light.source_content_sha256,r.content_sha256);
  const file='Nara-AI-2026-11-04-S1-story.html',html=renderFeaturedStoryPage(editionRoot,r,translations[r.id]);
  assert.equal(html,fs.readFileSync(path.join(editionRoot,'public/Nara',file),'utf8'),'committed page is the generator output');
  assert.equal((html.match(/<details class="light-edition" id="lahko-branje"/g)||[]).length,1);
  assert.ok(html.includes('data-light-content-sha256="'+light.content_sha256+'"'));
  // The block sits between the reading controls and the unchanged original; removing it restores the plain page.
  const start=html.indexOf('<link rel="stylesheet" href="assets/css/nara-light-edition.css'),endMark='<script defer src="assets/js/nara-light-edition.js?v=1"></script>',end=html.indexOf(endMark)+endMark.length;
  assert.ok(start>0&&end>start&&end<html.indexOf('<article class="story" lang="en" data-story-id="'+r.id+'"'));
  const plain=html.slice(0,start)+html.slice(end);
  assert.ok(!plain.includes('light-edition')&&plain.includes(r.content_sha256)&&plain.includes(translations[r.id].content_sha256));
  for(const asset of ['assets/css/nara-light-edition.css','assets/js/nara-light-edition.js'])assert.ok(fs.existsSync(path.join(editionRoot,'public/Nara',asset)),'missing '+asset);
  // A story without the sidecar renders without any trace of the feature.
  const other=records.find(x=>x.date==='2026-11-03');
  assert.equal(loadLightEdition(editionRoot,other),null);
  assert.ok(!renderFeaturedStoryPage(editionRoot,other,translations[other.id]).includes('light-edition'));
  // The sidecar cannot drift from the published source, carry private fields or change silently.
  assert.throws(()=>validateLightEdition({...light,source_content_sha256:'0'.repeat(64)},r),/source mismatch/);
  assert.throws(()=>validateLightEdition({...light,drive_id:'PRIVATE'},r),/unexpected\/private/);
  assert.throws(()=>validateLightEdition({...light,scenes:[...light.scenes.slice(1)]},r),/content hash mismatch/);
});
