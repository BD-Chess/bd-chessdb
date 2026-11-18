import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadReaderRatings,readerRating,ratingMarkup,requireCurrentReaderEvaluation,registerReaderRating,setReaderAlias,loadZborRatings,zborRating} from '../scripts/nara-reader-ratings.mjs';
import {loadFormatEditions} from '../scripts/nara-format-editions.mjs';
import {renderVersionArchive} from '../scripts/nara-version-history.mjs';
const root=path.resolve(import.meta.dirname,'..');
test('all 35 current ratings have two attributed reasons and exact equal-weight means',()=>{
 const d=loadReaderRatings(root);assert.ok(Object.keys(d.stories).length>=35);
 for(const r of Object.values(d.stories)){
  assert.equal(r.combined,(r.gpt+r.claude)/2);
  assert.ok(r.comments.gpt.trim()&&r.comments.claude.trim());
  assert.match(r.assessed_text_sha256??r.source_content_sha256,/^[a-f0-9]{64}$/);
  const html=ratingMarkup(r);assert.ok(html.includes('GPT '+r.gpt)&&html.includes('Claude '+r.claude));
  assert.doesNotMatch(html,/score-trend|SA1|PEC-6/);
 }
 for(const item of loadFormatEditions(root))assert.equal(readerRating(root,item.paths.story_id).source_content_sha256,item.en.content_sha256);
});
test('publication rejects obsolete or incomplete final scoring before registration',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nara-reader-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const p=path.join(dir,'public/Nara/daily/reader-ratings.json');fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(root,'public/Nara/daily/reader-ratings.json'),p);
 const before=fs.readFileSync(p,'utf8');
 assert.throws(()=>requireCurrentReaderEvaluation(dir,{gpt:{score:90,rubric:'SA1'},claude:{score:80,rubric:'PEC6'},combined:85}),/READER_APPEAL_R1/);
 assert.throws(()=>requireCurrentReaderEvaluation(dir,{gpt:{score:90,rubric:'READER_APPEAL_R1'},claude:{score:80,rubric:'READER_APPEAL_R1'},combined:86}),/mean/);
 assert.equal(fs.readFileSync(p,'utf8'),before);
 const evaluation={gpt:{score:76,rubric:'READER_APPEAL_R1'},claude:{score:61,rubric:'READER_APPEAL_R1'},combined:68.5};
 const record={id:'NARA-D-2099-01-01:S2',title:'Test fixture',content_sha256:'a'.repeat(64),literary_score:{combined:68.5,shared_strengths:['Claude reason','GPT reason'],shared_reservations:['Claude suggestion','GPT suggestion']}};
 registerReaderRating(dir,record,evaluation);setReaderAlias(dir,'NARA-D-2099-01-01',record.id);
 const actual=readerRating(dir,'NARA-D-2099-01-01');assert.equal(actual.combined,68.5);assert.equal(actual.comments.gpt,'GPT reason');assert.equal(actual.source_content_sha256,record.content_sha256);
});
test('missing judgments remain pending and version archives cannot restore retired grades',()=>{
 assert.equal(readerRating(root,'UNASSESSED-TEST-ONLY'),null);
 assert.match(ratingMarkup(null),/pending/);
 assert.doesNotMatch(renderVersionArchive(root),/score-chip|version-grade|SA1|PEC-6|[0-9]\/100/);
});
test('Zbor panel ratings validate, render beside the old score and change nothing when absent',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nara-zbor-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const d=path.join(dir,'public/Nara/daily');fs.mkdirSync(d,{recursive:true});
 fs.copyFileSync(path.join(root,'public/Nara/daily/reader-ratings.json'),path.join(d,'reader-ratings.json'));
 assert.equal(loadZborRatings(dir),null);assert.equal(zborRating(dir,'NARA-D-2026-11-17:S3'),null);
 const z={story_id:'NARA-D-2026-11-17:S3',n_voices:3,voices:{chatgpt:80,gemini:70,qwen:75},mean:75,complete:false};
 const write=zz=>fs.writeFileSync(path.join(d,'reader-ratings-zbor.json'),JSON.stringify({schema:'nara.reader-ratings-zbor.v1',policy:{id:'ZBOR_PANEL_R1'},stories:{[zz.story_id]:zz}}));
 write(z);const got=zborRating(dir,'NARA-D-2026-11-17:S3');assert.equal(got.mean,75);
 const old=readerRating(root,'NARA-D-2026-11-17:S3');
 const html=ratingMarkup(old,{zbor:got});assert.ok(html.includes('Zbor 75')&&html.includes('ChatGPT 80')&&html.includes('GPT '+old.gpt)&&html.includes('3 of 6 voices'));
 assert.equal(ratingMarkup(old),ratingMarkup(old,{zbor:null}));
 assert.match(ratingMarkup(null,{zbor:got}),/reader-rating--zbor-only/);assert.match(ratingMarkup(null),/pending/);
 write({...z,mean:76});assert.throws(()=>loadZborRatings(dir),/arithmetic/);
 write({...z,voices:{...z.voices,unknown:50},n_voices:4,mean:68.75});assert.throws(()=>loadZborRatings(dir),/arithmetic/);
 write({...z,voices:{chatgpt:80,gemini:70.5,qwen:75},mean:75.17});assert.throws(()=>loadZborRatings(dir),/arithmetic/);
});
test('the published Zbor catalog is valid and holds at least five voices per story',()=>{
 const d=loadZborRatings(root);if(!d)return;
 assert.ok(Object.keys(d.stories).length>=1);
 for(const z of Object.values(d.stories))assert.ok(z.n_voices>=5&&z.n_voices<=6);
});
