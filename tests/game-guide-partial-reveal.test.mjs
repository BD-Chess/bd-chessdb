import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSession} from '../functions/lib/game-guide/runtime.mjs';
import {stepTexts} from '../functions/lib/game-guide/content.mjs';
import {makeHandler} from '../functions/game-guide.mjs';
import {createLogStore} from '../functions/lib/game-guide/log.mjs';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const observed=JSON.parse(await read('./fixtures/game-partial-reveal.observed.json'));
const game=stepTexts(await read('../public/game/dayton1903/index.html'),JSON.parse(await read('../public/game/dayton1903/game.json')));
process.env.MDLXDCC_GUIDE_SESSION_SECRET='offline-partial-reveal-secret-'.repeat(3);
process.env.MDLXDCC_GUIDE_CLAUDE_MODEL='claude-sonnet-5-5';
globalThis.fetch=()=>assert.fail('No network or paid models in regression');
const body=()=>({slug:'dayton1903',provider:'claude',mode:'IZUMLJAJ',development:true,protocol:'game-guide-tools-v1',
 opened:['s1','s2','s3','s6','s7','s8','s9'],learning:{asked:[],cards:{s2:{card:'A',line:'Prejšnja kartica.'}}},
 message:observed.assessment.explanation,history:[],fair_play:{paste_events:0,paste_length:0,typing_ms:0,blur_ms:0}});

test('Observed successful partial assessment unlocks reveal and reports truthful transition',()=>{
 const s=createSession(game,body());const result=s.execute('assess_challenge',observed.assessment);
 assert.equal(result.ok,true);assert.ok(result.allowed_open_steps.some(x=>x.id==='s12'));
 assert.equal(result.reveal_after_assessment,null);assert.equal(s.needsReveal(),true);
 assert.equal(s.execute('open_step',{id:'s12'}).action.id,'s12');
});
test('Reveal remains closed before assessment',()=>{
 const s=createSession(game,body());assert.equal(s.needsReveal(),false);
 assert.throws(()=>s.execute('open_step',{id:'s12'}),/UNDERSTANDING_BEFORE_REVEAL/);
 assert.equal(s.transition().reveal_after_assessment.requires,'assess_challenge');
});
test('Prepared partial assessment survives next request without requiring the same assessment again',()=>{
 const s=createSession(game,body());s.execute('assess_challenge',observed.assessment);
 const next=createSession(game,{...s.snapshot(),message:'Pokaži naslednji korak.'});
 assert.ok(next.allowedOpenSteps().some(x=>x.id==='s12'));assert.equal(next.transition().reveal_after_assessment,null);
 assert.equal(next.execute('open_step',{id:'s12'}).action.id,'s12');
});
test('Native adapter: assessment then observed prose gets one correction and visible s12',async()=>{
 const tool=(name,input,id)=>({role:'assistant',content:[{type:'tool_use',id,name,input}],stop_reason:'tool_use',usage:{input_tokens:1,output_tokens:1}});
 const text=value=>({role:'assistant',content:[{type:'text',text:value}],stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1}});
 const sequence=[tool('assess_challenge',observed.assessment,'observed-assess'),text(observed.after_assessment_text),
   tool('open_step',{id:'s12'},'observed-reveal'),text('Preberi razkritje na desni.')];
 const logs=[];let calls=0;
 const handler=makeHandler({accessFactory:async()=>({role:'owner',id:'offline-partial'}),configured:{claude:true},
   continuationSecret:()=>process.env.MDLXDCC_GUIDE_SESSION_SECRET,gameFactory:async()=>structuredClone(game),
   budgetFactory:()=>({reserve:async()=>null,settle:async()=>{}}),
   logStore:createLogStore({rpc:async(action,data)=>{if(action==='game_log_append')logs.push(...structuredClone(data.events));return {ok:true};}}),
   clientFactory:async()=>({messages:{stream(){const reply=structuredClone(sequence[calls++]);assert.ok(reply);return {
     async *[Symbol.asyncIterator](){for(const c of reply.content)if(c.type==='text')yield {type:'content_block_delta',delta:{type:'text_delta',text:c.text}};},finalMessage:async()=>reply};}}})});
 const events=[];let value=body();
 for(let hop=0;hop<3;hop++){
   const response=await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)}));
   const raw=await response.text();assert.equal(response.status,200,raw);const batch=raw.split('\n\n').filter(Boolean).map(x=>JSON.parse(x.slice(6)));events.push(...batch);
   const token=batch.find(e=>e.type==='continue')?.token;if(!token)break;
   value={continuation:token,receipts:batch.filter(e=>e.type==='action').map(a=>({call_id:a.call_id,name:a.name,opened:a.id,ok:true,visible:true,already_open:false}))};
 }
 assert.equal(calls,4);assert.ok(events.some(e=>e.type==='action'&&e.id==='s12'));
 assert.ok(events.some(e=>e.type==='done'&&!e.recovered));assert.ok(!events.some(e=>e.type==='error'));
 assert.ok(logs.some(e=>e.kind==='open_step'&&e.payload.id==='s12'&&e.payload.visible));
 const round=logs.filter(e=>e.kind==='guide_trace'&&e.payload.phase==='model_round');assert.ok(round.every(e=>e.payload.repairs<=1));
});
