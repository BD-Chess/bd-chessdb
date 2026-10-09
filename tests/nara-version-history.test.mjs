import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deriveVersionTrend,listVersionSeries,storyScoreTrend,renderVersionArchive} from '../scripts/nara-version-history.mjs';
import {archivePage,latestPage} from '../scripts/nara-daily.mjs';

const grade=n=>({instrument:'SA1',gpt:n,claude:n,combined:n});
const item=(version,n,sha)=>({version,source_content_sha256:sha,stage:version==='FINAL'?'AUTHOR_FINAL':'AUTHOR_REVISION',story:{title:'Test <Story>',deck:'Test',shape:'Test',scenes:[{title:'Opening',paragraphs:['A safe <paragraph>.']}]},grade:n===null?null:grade(n),coverage:n===null?'PENDING_BOTH':'COMPLETE'});
const series=(versions,extra={})=>({schema:'nara.daily.version_series.v1',story_id:'NARA-D-2026-10-12:S1',date:'2026-10-12',published_title:'Test Story',final_version:'FINAL',accepted_lineage:versions.map(([id,num],i)=>item(id,num,'s'+i)),...extra});

test('strict comparison uses the best of every preceding score',()=>{
 assert.equal(deriveVersionTrend(series([['V1',80],['V2',95],['FINAL',91]])),'orange');
 assert.equal(deriveVersionTrend(series([['V1',80],['V2',88],['FINAL',90]])),'green');
 assert.equal(deriveVersionTrend(series([['V1',90],['V2',88],['FINAL',90]])),'green');
});
test('unknown grade stays neutral except an already proven higher predecessor',()=>{
 assert.equal(deriveVersionTrend(series([['V1',80],['V2',null],['FINAL',90]])),'neutral');
 assert.equal(deriveVersionTrend(series([['V1',93],['V2',null],['FINAL',90]])),'orange');
 assert.equal(deriveVersionTrend(series([['FINAL',90]])),'neutral');
});
test('quarter point comparison is prior to visible integer rounding',()=>{
 assert.equal(deriveVersionTrend(series([['V1',84.5],['FINAL',84.25]])),'orange');
});
test('unrelated abandoned launch is not a prior version of selected story',()=>{
 const unrelated=item('OLD',95,'old');
 assert.equal(deriveVersionTrend(series([['V1',80],['FINAL',90]],{parallel_branches:[{name:'Abandoned separate launch story; NOT an earlier draft',versions:[unrelated]}]})),'green');
});
test('archive includes all source text, honest pending and distinct R8 identities',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nara-version-test-'));
 try{
  const dir=path.join(root,'public/Nara/daily/versions');fs.mkdirSync(dir,{recursive:true});
  const s=series([['V1',80],['V2',null],['FINAL',90]]);
  fs.writeFileSync(path.join(dir,'2026-10-12-S1.json'),JSON.stringify(s));
  assert.equal(listVersionSeries(root).length,1);
  assert.equal(storyScoreTrend(root,'NARA-D-2026-10-12:S1'),'neutral');
  const html=renderVersionArchive(root);
  assert.match(html,/Test &lt;Story&gt;/);
  assert.match(html,/A safe &lt;paragraph&gt;/);
  assert.match(html,/No comparable paired SA1 grade yet/);
  assert.match(archivePage([{date:'2026-10-12',title:'Test Story',id:s.story_id}],null,root),/id="version-history"/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
