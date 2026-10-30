import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeHandler } from '../functions/game-guide.mjs';
import { createSession, gameTools } from '../functions/lib/game-guide/runtime.mjs';
import { createLogStore } from '../functions/lib/game-guide/log.mjs';
import { stepTexts } from '../functions/lib/game-guide/content.mjs';

globalThis.fetch = () => assert.fail('No network or paid provider in this regression');
process.env.MDLXDCC_GUIDE_CLAUDE_MODEL = 'claude-sonnet-5-5';
process.env.MDLXDCC_GUIDE_SESSION_SECRET = 'offline-observed-card-secret-'.repeat(3);
const read = p => readFile(new URL(p, import.meta.url), 'utf8');
const game = stepTexts(await read('../public/game/dayton1903/index.html'), JSON.parse(await read('../public/game/dayton1903/game.json')));
const observed = JSON.parse(await read('./fixtures/game-card-why.observed.json'));
const request = () => ({ slug:'dayton1903', provider:'claude', mode:'IZUMLJAJ', development:true,
  protocol:'game-guide-tools-v1', opened:['s1','s2','s3','s6','s7','s8'],
  learning:{asked:['s2','s8'],cards:{s2:{card:'A',line:'Prejšnja kartica.'}}},
  message:observed.args.explanation, history:[], fair_play:{paste_events:0,paste_length:0,typing_ms:0,blur_ms:0} });
// Observed legacy call stays immutable; the repaired call uses the new schema.
const corrected = why => ({step:'s8',path:'historical',achieved:[0,1,3].map(i=>game.steps.find(s=>s.id==='s8').key_ideas[i]),why,advantages:[]});
const response = (name, args, id) => ({ role:'assistant',content:[{type:'tool_use',id,name,input:args}],stop_reason:'tool_use',usage:{input_tokens:1,output_tokens:1} });
const done = { role:'assistant',content:[{type:'text',text:'Preberi razkritje na desni.'}],stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1} };
function replay(sequence) {
  const logs=[],seen=[];
  const handler=makeHandler({accessFactory:async()=>({role:'owner',id:'offline-observed-card'}),configured:{claude:true},
    continuationSecret:()=> 'offline-observed-card-secret-'.repeat(3), gameFactory:async()=>structuredClone(game),
    budgetFactory:()=>({reserve:async()=>null,settle:async()=>{}}),
    logStore:createLogStore({rpc:async(action,data)=>{if(action==='game_log_append')logs.push(...structuredClone(data.events));return {ok:true};}}),
    clientFactory:async()=>({messages:{stream(payload){
      seen.push(structuredClone(payload));const item=structuredClone(sequence[seen.length-1]);assert.ok(item,'Unexpected provider round');
      return {async *[Symbol.asyncIterator](){for(const c of item.content)if(c.type==='text')yield {type:'content_block_delta',delta:{type:'text_delta',text:c.text}};},finalMessage:async()=>item};
    }}})});
  return {logs,seen,async run(){
    const all=[];let body=request();
    for(let hop=0;hop<3;hop++){
      const res=await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
      const raw=await res.text();assert.equal(res.status,200,raw);const batch=raw.split('\n\n').filter(Boolean).map(s=>JSON.parse(s.slice(6)));all.push(...batch);
      const token=batch.find(e=>e.type==='continue')?.token;if(!token)return all;
      body={continuation:token,receipts:batch.filter(e=>e.type==='action').map(a=>({call_id:a.call_id,name:a.name,opened:a.id,ok:true,visible:true,already_open:false}))};
    }
    assert.fail('Unexpected continuation loop');
  }};
}

test('Observed 216-character why: schema declares the actual server limit',()=>{
  assert.equal(observed.args.why.length,216);
  assert.equal(gameTools(true).find(t=>t.name==='assess_challenge').parameters.properties.why.maxLength,200);
});
test('Observed valid assessment fails only its why length and reports a precise repair',()=>{
  const session=createSession(game,request());
  assert.throws(()=>session.execute(observed.name,observed.args),e=>e.message==='INVALID_ASSESSMENT'&&e.details.field==='why'&&e.details.maxLength===200&&e.details.actualLength===216);
  assert.equal(session.learning.cards.s8,undefined);
});
test('One informed correction shortens why and migrates legacy arguments, derives scores, then reaches visible s12',async()=>{
  // The first call is observed. This corrected reply is synthetic, not a claimed real-provider recording.
  const repaired=corrected('Predlagal je enakomeren zračni tok, majhne modele in primerjavo oblik; manjkata referenčna ploščica ter preverjanje konstante.');
  const h=replay([response(observed.name,observed.args,'observed-call'),response(observed.name,repaired,'synthetic-correction'),response('open_step',{id:'s12'},'synthetic-reveal'),done]);
  const events=await h.run();assert.equal(h.seen.length,4);
  assert.ok(events.some(e=>e.type==='action'&&e.id==='s12'));assert.ok(events.some(e=>e.type==='done'&&!e.recovered));assert.ok(!events.some(e=>e.type==='error'));
  const errorResults=h.seen[1].messages.flatMap(m=>Array.isArray(m.content)?m.content.filter(c=>c.type==='tool_result').map(c=>JSON.parse(c.content)):[]);
  assert.equal(errorResults[0].details.field,'why');assert.equal(errorResults[0].details.maxLength,200);
  const assessment=h.logs.filter(e=>e.kind==='guide_trace').flatMap(e=>e.payload.tool_uses||[]).find(t=>t.name==='assess_challenge'&&t.result.ok);
  assert.deepEqual(assessment.args.achieved,repaired.achieved);assert.equal(assessment.result.card,'A');assert.equal(assessment.result.score,3);
  assert.ok(h.logs.some(e=>e.kind==='open_step'&&e.payload.id==='s12'&&e.payload.visible));
});
test('Repeating the actual overlong why remains bounded and cannot invent a card or reveal',async()=>{
  const h=replay([response(observed.name,observed.args,'observed-first'),response(observed.name,observed.args,'observed-repeat')]);
  const events=await h.run();assert.equal(h.seen.length,2);assert.ok(events.some(e=>e.type==='done'&&e.recovered));
  assert.ok(!events.some(e=>e.type==='action'||e.type==='error'));assert.ok(!h.logs.some(e=>e.kind==='open_step'&&e.payload.id==='s12'));
});
