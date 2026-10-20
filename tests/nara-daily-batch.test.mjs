import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {chooseFeatured,instanceId,instanceRecordPath,dayManifestPath,publishedBatchDays} from '../scripts/nara-daily-batch.mjs';
const item=(instance,gpt,claude,closed)=>({instance,record:{closed_at:closed},log:{evaluation:{blind:true,method:'equal_weight_mean',gpt:{score:gpt,rubric:'GPT'},claude:{score:claude,rubric:'PEC-6 v2'},weights:{gpt:.5,claude:.5},combined:(gpt+claude)/2,display:Math.floor((gpt+claude)/2+.5),note:'x'}}});
test('paths and ids are deterministic',()=>{assert.equal(instanceId('2026-10-09','S2'),'NARA-D-2026-10-09:S2');assert.equal(instanceRecordPath('2026-10-09','S2'),'daily/records/2026-10-09/S2.json');assert.equal(dayManifestPath('2026-10-09'),'daily/days/2026-10-09.json')});
test('highest combined wins',()=>{assert.equal(chooseFeatured([item('S1',90,90,'2026-10-09T05:00:00Z'),item('S2',94,92,'2026-10-09T09:00:00Z')]),'S2')});
test('tie uses higher minimum score',()=>{assert.equal(chooseFeatured([item('S1',98,86,'2026-10-09T05:00:00Z'),item('S2',93,91,'2026-10-09T09:00:00Z')]),'S2')});
test('remaining tie uses earlier close',()=>{assert.equal(chooseFeatured([item('S1',92,92,'2026-10-09T05:00:00Z'),item('S2',92,92,'2026-10-09T09:00:00Z')]),'S1')});
test('monthly batch archive keeps companions from every published day',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nara-batch-days-'));
  try{
    const n=path.join(root,'public/Nara'),story={title:'A',deck:'D',shape:'S',scenes:[{title:'One',paragraphs:['P']}]};
    for(const [date,featured] of [['2026-10-19','S1'],['2026-10-20','S3']]){
      const entries=[];
      for(const instance of ['S1','S2','S3']){
        const record={schema:'nara.daily.instance_record.v1',id:instanceId(date,instance),day_id:'NARA-D-'+date,date,instance,published_at:date+'T19:10:00Z',closed_at:date+'T18:00:00Z',...story,title:story.title+instance,content_sha256:crypto.createHash('sha256').update(JSON.stringify({...story,title:story.title+instance})).digest('hex'),critic_line:'Closed',literary_score:{combined:80,display:80,method:'R1',blind:true,weights:{gpt:.5,claude:.5},shared_strengths:['a','b'],shared_reservations:['c','d']}};
        const rel=instanceRecordPath(date,instance);fs.mkdirSync(path.dirname(path.join(n,rel)),{recursive:true});fs.writeFileSync(path.join(n,rel),JSON.stringify(record));
        entries.push({instance,id:record.id,record_file:rel});
      }
      fs.mkdirSync(path.join(n,'daily/days'),{recursive:true});fs.writeFileSync(path.join(n,'daily/days',date+'.json'),JSON.stringify({schema:'nara.daily.day.v1',id:'NARA-D-'+date,date,featured_instance:featured,instances:entries}));
    }
    const days=publishedBatchDays(root,'2026-10');
    assert.deepEqual(days.map(d=>[d.date,d.featured,d.items.length]),[['2026-10-20','S3',3],['2026-10-19','S1',3]]);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
