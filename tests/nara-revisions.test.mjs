import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hash,validateRecord,validateLog,latestPage,monthlyPage,archivePage,logPage,originalEditionPage} from '../scripts/nara-daily.mjs';

function record(){
  const story={title:'The original',deck:'A complete story.',shape:'A tested choice.',scenes:[{title:'The door',paragraphs:['The original paragraph is preserved.']}]};
  return {schema:'nara.daily.record.v1',id:'NARA-D-2026-10-05',date:'2026-10-05',published_at:'2026-10-05T22:00:00+02:00',...story,critic_line:'The original verdict.',content_sha256:hash(JSON.stringify(story))};
}
function log(){return {schema:'nara.daily.log.v1',id:'NARA-D-2026-10-05-LOG',date:'2026-10-05',story_id:'NARA-D-2026-10-05',title:'The original',proposer:'GPT',selector:'CLAUDE',author:'GPT',critic:'CLAUDE',candidates:Array.from({length:10},(_,i)=>({title:'Candidate '+i,premise:'A possible story.'})),selection:{title:'Candidate 0',reason:'Selected after review.',risk:'A substantive challenge.'},rounds:[{actor:'GPT',stage:'AUTHOR_DRAFT',summary:'Drafted.'},{actor:'GPT',stage:'AUTHOR_FINAL',summary:'Finalized.'},{actor:'CLAUDE',stage:'CRITIC_CLOSE',summary:'Closed.'}],final_critic_line:'The original verdict.'};}
const revision={date:'2026-10-06',edition:'R3',original_url:'Nara-AI-2026-10-05-original.html',original_log_url:'Nara-AI-2026-10-05-original-log.html'};

test('revision notices persist in Daily, monthly archive, archive index and Log without changing story content',()=>{
  const r=record(),l=log(),bodyHash=r.content_sha256;
  r.revision=revision;l.revision=revision;
  validateRecord(r);validateLog(l);
  assert.equal(r.content_sha256,bodyHash);
  for(const html of [latestPage([r],'2026-10'),monthlyPage('2026-10',[r]),archivePage([{...r,file:'daily/records/2026-10-05.json'}],'2026-10'),logPage([l])]){
    assert.ok(html.includes('revised 2026-10-06'));
    assert.ok(html.includes(revision.original_url));
  }
  assert.ok(latestPage([r],'2026-10').includes('prenovljeno 2026-10-06'));
});

test('original editions preserve original paragraphs and verdict with links to their own archive and current revision',()=>{
  const r=record(),l=log(),before=JSON.stringify({r,l});
  const page=originalEditionPage(r,{},'2026-10-06'),oldLog=logPage([l],{original:true});
  assert.ok(page.includes('Preserved original edition'));
  assert.ok(page.includes(r.scenes[0].paragraphs[0])&&page.includes(r.critic_line));
  assert.ok(page.includes('Nara-AI-2026-10.html#NARA-D-2026-10-05'));
  assert.ok(oldLog.includes('Nara-AI-2026-10-05-original-log.html'));
  assert.ok(oldLog.includes('Nara-AI-2026-10-05-original.html#NARA-D-2026-10-05'));
  assert.equal(JSON.stringify({r,l}),before);
});

test('revision metadata cannot introduce private fields or unsafe archive URLs',()=>{
  for(const change of [{original_url:'javascript:alert(1)'},{original_log_url:'../private.json'},{date:'2026-10-04'},{drive_id:'private'}]){
    const r={...record(),revision:{...revision,...change}};
    assert.throws(()=>validateRecord(r),/revision|original edition/);
  }
});
