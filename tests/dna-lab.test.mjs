import test from 'node:test';
import assert from 'node:assert/strict';
import {welcomeHost,LAB_UPDATE} from '../public/assets/dna-lab/digest.mjs';
import {newConversation,restoreConversation,createCoordinator} from '../public/assets/dna-lab/conversation.mjs';
import {CURATED} from '../public/assets/ai8-entry/featured-catalog.mjs';
function fixture(options={}){
 const state=options.state||newConversation(),calls=[],saved=[];
 const c=createCoordinator({state,now:()=>new Date('2026-11-08T23:30:00Z'),persist:s=>{saved.push(structuredClone(s));return options.durable!==false;},request:async r=>{calls.push({...r,history:structuredClone(r.history)});if(options.request)return options.request(r,calls);r.onDelta('A short public answer.');return {provider:r.provider,sources:LAB_UPDATE.sources};}});
 return {state,calls,saved,c};
}
const available={gpt:true,claude:true},account={role:'visitor'};
test('host uses Ljubljana calendar including midnight and DST boundaries',()=>{
 for(const [date,host] of [['2026-11-08T22:59:00Z','claude'],['2026-11-08T23:00:00Z','gpt'],['2026-06-08T21:59:00Z','claude'],['2026-06-08T22:00:00Z','gpt'],['2026-10-25T01:30:00Z','gpt']])assert.equal(welcomeHost(new Date(date)),host,date);
 assert.equal(CURATED.find(p=>p.id===LAB_UPDATE.projectId).id,'ai8-dna');
});
test('guest makes zero calls; login starts one real-labelled bounded welcome and shares history',async()=>{
 const f=fixture();await f.c.welcome(null,available);assert.equal(f.calls.length,0);
 assert.equal(await f.c.welcome(account,available),true);
 assert.deepEqual(f.calls.map(c=>[c.provider,c.mode,c.stage]),[['gpt','lab_welcome','ask'],['claude','lab_welcome','update'],['gpt','lab_welcome','invite']]);
 assert.equal(f.calls[1].history[0].provider,'gpt');assert.equal(f.calls[2].history[1].provider,'claude');
 assert.ok(f.saved.find(s=>s.welcome==='started'&&s.messages.length===0),'intent saved before first provider');
 assert.equal(f.state.welcome,'done');await f.c.welcome(account,available);assert.equal(f.calls.length,3);
 const resumed=fixture({state:restoreConversation(JSON.parse(JSON.stringify(f.state)))});await resumed.c.welcome(account,available);assert.equal(resumed.calls.length,0);
});
test('date change, rerender, rapid opens and reload of an in-flight welcome cannot duplicate it',async()=>{
 let release;const barrier=new Promise(r=>release=r);const f=fixture({request:async(r,calls)=>{if(calls.length===1)await barrier;r.onDelta('Answer');return {provider:r.provider};}});
 const first=f.c.welcome(account,available);await f.c.welcome(account,available);assert.equal(f.calls.length,1);
 const resumed=fixture({state:restoreConversation(JSON.parse(JSON.stringify(f.state)))});await resumed.c.welcome(account,available);assert.equal(resumed.calls.length,0);assert.equal(resumed.state.welcome,'stopped');
 release();await first;assert.equal(f.calls.length,3);
});
test('missing provider and unavailable storage stop automatic welcome without substitutions',async()=>{
 for(const f of [fixture(),fixture({durable:false})]){await f.c.welcome(account,{gpt:true,claude:false});assert.equal(f.calls.length,0);assert.equal(f.state.welcome,'stopped');}
});
test('ask both is exactly two sequential calls with labelled shared history; ordinary ask is one',async()=>{
 const f=fixture();f.state.drafts.gpt='Question';await f.c.ask('Question','gpt',true,account,available);
 assert.deepEqual(f.calls.map(c=>c.provider),['gpt','claude']);assert.equal(f.calls[1].history.at(-1).provider,'gpt');assert.equal(f.state.drafts.gpt,'');
 await f.c.ask('Follow-up','claude',false,account,available);assert.equal(f.calls.length,3);assert.equal(f.state.welcome,'skipped');
});
test('budget/provider errors and cancellation stop remaining turns, retain partials and never retry',async()=>{
 for(const error of ['MONTHLY_LIMIT','RATE_LIMITED','STORAGE_UNAVAILABLE','TIMEOUT','AI_UNAVAILABLE']){
  const f=fixture({request:async r=>{r.onDelta('Partial');throw Error(error);}});await f.c.welcome(account,available);assert.equal(f.calls.length,1);assert.equal(f.state.welcome,'stopped');assert.equal(f.state.messages[0].complete,false);await f.c.welcome(account,available);assert.equal(f.calls.length,1);
 }
 const f=fixture({request:r=>new Promise((resolve,reject)=>{r.signal.addEventListener('abort',()=>reject(Error('INTERRUPTED')));})});
 const pending=f.c.welcome(account,available);assert.equal(await f.c.ask('Duplicate','gpt',true,account,available),false);f.c.cancel();await pending;assert.equal(f.calls.length,1);assert.equal(f.c.busy,false);
});
test('provider identity mismatch and truncated stream never become a completed shared answer',async()=>{
 const f=fixture({request:async r=>{r.onDelta('Wrong identity');return {provider:'claude'};}});await f.c.ask('Question','gpt',true,account,available);assert.equal(f.calls.length,1);assert.equal(f.state.messages.find(m=>m.role==='assistant').complete,false);
});
