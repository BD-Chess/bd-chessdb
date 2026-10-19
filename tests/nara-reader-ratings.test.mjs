import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadReaderRatings,readerRating,ratingMarkup,requireCurrentReaderEvaluation,registerReaderRating,setReaderAlias} from '../scripts/nara-reader-ratings.mjs';
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
