import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSession, validateBody, gameTools, instructions, cleanLearning } from '../functions/lib/game-guide/runtime.mjs';
import { stepTexts } from '../functions/lib/game-guide/content.mjs';
import { makeHandler } from '../functions/game-guide.mjs';
const read = path => readFile(new URL(path,import.meta.url),'utf8');
const game = stepTexts(await read('../public/game/dayton1903/index.html'),JSON.parse(await read('../public/game/dayton1903/game.json')));
const fixture = JSON.parse(await read('./fixtures/r4fix-trace.excerpt.json'));
globalThis.fetch = () => assert.fail('network forbidden');
const ideas = step => game.steps.find(s => s.id === step).key_ideas;
const before = step => game.steps.slice(0,game.steps.findIndex(s => s.id === step)+1).filter(s => s.kind !== 'hint').map(s => s.id);
const body = (step='s8', extra={}) => ({slug:'dayton1903',provider:'claude',mode:'IZUMLJAJ',development:true,protocol:'game-guide-tools-v1',opened:before(step),history:[],message:'Predlagam lastno razlago in sem pripravljen na presojo.',...extra});
const session = (step='s8',extra={},g=game) => createSession(g,validateBody(body(step,extra)));
const assessment = (step='s8',d=3,extra={}) => ({step,achieved:step === 's8' && d === 3 ? [0,1,3].map(i=>ideas(step)[i]) : ideas(step).slice(0,d),path:'historical',why:'Razlaga poveže dosežene mejnike.',advantages:[],...extra});

test('trace seq81/84 excerpt: legacy free card is actionable; corrected s8 3/5 deterministically derives A and unlocks s12', () => {
  for (const old of [fixture.seq81,fixture.seq84]) {
    const s=session();
    assert.throws(() => s.execute('assess_challenge',{...old,why:'Kratka razlaga.'}),e => e.message === 'INVALID_ASSESSMENT' && e.details.allowed.path.includes('historical') && e.details.allowed.achieved.length === 5 && e.details.rule.includes('round'));
    const r=s.execute('assess_challenge',assessment());
    assert.equal(r.ok,true);assert.equal(r.card,'A');assert.equal(r.score,3);assert.equal(r.stars,3);
    assert.match(s.learning.cards.s8.line,/mejniki 3\/5 ✦✦✦ · 3\/5/);
    assert.ok(r.allowed_open_steps.some(x => x.id === 's12'));assert.equal(r.reveal_after_assessment,null);
    assert.equal(s.execute('open_step',{id:'s12'}).action.id,'s12');
  }
});
test('trace seq36 s2 full achievement; half-point rounding and zero-hit reveal remain valid in both modes', () => {
  for (const development of [true,false]) {
    const s=session('s2',{development});const r=s.execute('assess_challenge',assessment('s2',4));
    assert.equal(r.score,5);assert.equal(r.stars,4);assert.equal(r.record_result,!development);
    assert.equal(s.execute('open_step',{id:'s6'}).action.id,'s6');
  }
  const half=session('s2');assert.equal(half.execute('assess_challenge',assessment('s2',3)).score,4);
  const zero=session();const r=zero.execute('assess_challenge',assessment('s8',0));assert.equal(r.score,null);assert.equal(r.card,'none');assert.match(zero.learning.cards.s8.line,/Ta korak še ni zadet/);assert.equal(zero.execute('open_step',{id:'s12'}).action.id,'s12');
});
test('stars use per-hint covers, unannotated hints cover all; score is unchanged; achieved independence survives later hints', () => {
  const g=structuredClone(game),hint=g.steps.find(s => s.kind === 'hint' && s.for === 's8');delete g.steps.find(s=>s.id==='s8').key;hint.covers=[ideas('s8')[0]]; // Legacy unannotated fixture; R7 coverage is tested separately.
  const s=session('s8',{opened:[...before('s8'),hint.id]},g);const r=s.execute('assess_challenge',assessment());assert.equal(r.score,3);assert.equal(r.stars,2);
  delete hint.covers;const all=session('s8',{opened:[...before('s8'),hint.id]},g);assert.equal(all.execute('assess_challenge',assessment()).stars,0);
  hint.covers=['unknown'];assert.equal(session('s8',{opened:[...before('s8'),hint.id]},g).execute('assess_challenge',assessment()).stars,0);
  const first=session();first.execute('assess_challenge',assessment());const resumed=session('s8',{learning:first.learning,opened:[...before('s8'),hint.id]});assert.equal(resumed.execute('assess_challenge',assessment('s8',2)).stars,3);
});
test('own working path: evident and needs_test give 5/5 +1 and pending test; invented or duplicate advantage never inflates bonus', () => {
  const s=session();const r=s.execute('assess_challenge',assessment('s8',0,{path:'own',advantages:[{text:ideas('s8')[0],kind:'evident'},{text:'nižji hrup',kind:'needs_test'},{text:ideas('s8')[0],kind:'evident'},{text:'izmišljena prednost',kind:'evident'}]}));
  assert.equal(r.card,'B');assert.equal(r.score,6);assert.match(s.learning.cards.s8.line,/5\/5 · \+1 boljše/);assert.match(s.learning.cards.s8.line,/\+\? odprto/);
  s.execute('assess_challenge',assessment('s8',1));assert.equal(s.learning.cards.s8.score,6);
});
test('at most two distinct missing-idea questions, separate turns; legacy asked consumes one slot; no question after assessment', () => {
  const q=idea => ({step:'s8',idea,question:'Kako bi preveril svojo zamisel?'});
  const a=session();a.execute('ask_understanding',q(ideas('s8')[0]));assert.throws(() => a.execute('assess_challenge',assessment()),/WAIT_FOR_PLAYER/);
  const b=session('s8',{learning:a.learning});assert.throws(() => b.execute('ask_understanding',q(ideas('s8')[0])),/INVALID_QUESTION/);b.execute('ask_understanding',q(ideas('s8')[1]));
  const c=session('s8',{learning:b.learning});assert.throws(() => c.execute('ask_understanding',q(ideas('s8')[2])),/INVALID_QUESTION/);c.execute('assess_challenge',assessment());
  assert.throws(() => c.execute('ask_understanding',q(ideas('s8')[3])),/INVALID_QUESTION/);
  const legacy=session('s8',{learning:{asked:['s8'],cards:{}}});assert.equal(legacy.execute('ask_understanding',q(ideas('s8')[1])).ok,true);
});
test('schema/prompt remove free card and old one-question rule; validation and persisted high-water metadata survive cleanLearning', () => {
  const tool=gameTools(false).find(x => x.name === 'assess_challenge');assert.equal(tool.parameters.properties.card,undefined);assert.equal(tool.parameters.properties.achieved.type,'array');
  assert.ok(Object.keys(tool.parameters.properties).every(k => tool.parameters.required.includes(k)));
  const s=session();const prompt=instructions(game,s.snapshot(),s);assert.ok(!prompt.includes('največ enim'));assert.match(prompt,/največ dve/);
  for (const extra of [{path:'partial'},{achieved:[ideas('s8')[0],ideas('s8')[0]]},{achieved:['invented']},{why:'x'.repeat(201)},{card:'A'},{advantages:[{kind:'other',text:'a'}]}]) assert.throws(() => s.execute('assess_challenge',assessment('s8',3,extra)),e => Boolean(e.details?.allowed && e.details?.rule));
  s.execute('assess_challenge',assessment());const resumed=session('s8',{learning:cleanLearning(s.learning)});resumed.execute('assess_challenge',assessment('s8',2));assert.equal(resumed.learning.cards.s8.score,3);assert.equal(resumed.learning.cards.s8.achieved.length,3);
});

function harness(sequence) {
  const seen=[];let i=0;
  const handler=makeHandler({accessFactory:async()=>({role:'owner',id:'offline-r4fix'}),configured:{claude:true},gameFactory:async()=>structuredClone(game),budgetFactory:()=>({reserve:async()=>null,settle:async()=>{}}),logStore:{start:async()=>null},continuationSecret:()=> 'offline-r4fix-secret-'.repeat(4),clientFactory:async()=>({messages:{stream(payload){
    seen.push(structuredClone(payload));const block=sequence[i++];assert.ok(block,'unexpected round');const response={content:[block],stop_reason:'end_turn',usage:{input_tokens:0,output_tokens:0}};
    return {async *[Symbol.asyncIterator](){if(block.type==='text')yield {type:'content_block_delta',delta:{type:'text_delta',text:block.text}};},finalMessage:async()=>response};
  }}})});
  return {seen,async run(value){const events=[];let next=value;for(let n=0;n<3;n++){
    const response=await handler(new Request('https://offline.test/.netlify/functions/game-guide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)}));assert.equal(response.status,200);const batch=(await response.text()).split('\n\n').filter(Boolean).map(x=>JSON.parse(x.slice(6)));events.push(...batch);
    const token=batch.find(x=>x.type==='continue')?.token;if(!token)return events;
    next={continuation:token,receipts:batch.filter(x=>x.type==='action').map(x=>({call_id:x.call_id,name:x.name,opened:x.id,ok:true,visible:true,already_open:false}))};
  }assert.fail('continuation bound');}};
}
const call=(id,name,input)=>({type:'tool_use',id,name,input});
test('native SDK mock: legacy seq81 rejection returns allowed/rule, one structured correction scores and visibly opens s12 within four rounds',async()=>{
  const h=harness([call('old','assess_challenge',{...fixture.seq81,why:'Kratka razlaga.'}),call('fixed','assess_challenge',assessment()),call('reveal','open_step',{id:'s12'}),{type:'text',text:'Preberi novi korak.'}]);
  const events=await h.run(body());assert.ok(events.some(x=>x.type==='done'));assert.ok(!events.some(x=>x.type==='error'||x.recovered));assert.deepEqual(events.filter(x=>x.type==='action').map(x=>x.id),['s12']);assert.equal(h.seen.length,4);
  const results=h.seen[1].messages.flatMap(x=>Array.isArray(x.content)?x.content.filter(c=>c.type==='tool_result').map(c=>JSON.parse(c.content)):[]);const rejection=results.at(-1);
  assert.equal(rejection.error,'INVALID_ASSESSMENT');assert.ok(rejection.details.allowed.path.includes('historical'));assert.match(rejection.details.rule,/No free card/);
  const state=events.find(x=>x.type==='state');assert.equal(state.learning.cards.s8.score,3);
});
