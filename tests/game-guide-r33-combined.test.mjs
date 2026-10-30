import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reservation, charge } from '../functions/lib/mdlxdcc-guide/cost.mjs';
import { gameProviderModel } from '../functions/lib/game-guide/provider.mjs';
import { validateGame, createSession, validateBody, modelContext } from '../functions/lib/game-guide/runtime.mjs';
import { stepTexts } from '../functions/lib/game-guide/content.mjs';
const read = path => readFile(new URL(path,import.meta.url),'utf8');
const game = stepTexts(await read('../public/game/dayton1903/index.html'),validateGame(JSON.parse(await read('../public/game/dayton1903/game.json')),'dayton1903'));
globalThis.fetch=()=>assert.fail('network forbidden');
test('Opus reservation, five-minute/one-hour cache and game-only model selection',()=>{
  const old=process.env.GAME_GUIDE_CLAUDE_MODEL;delete process.env.GAME_GUIDE_CLAUDE_MODEL;
  try { assert.equal(gameProviderModel('claude'),'claude-opus-5-5');process.env.GAME_GUIDE_CLAUDE_MODEL='claude-sonnet-5-5';assert.equal(gameProviderModel('claude'),'claude-sonnet-5-5'); }
  finally {if(old===undefined)delete process.env.GAME_GUIDE_CLAUDE_MODEL;else process.env.GAME_GUIDE_CLAUDE_MODEL=old;}
  const payload={max_tokens:2400},bytes=Buffer.byteLength(JSON.stringify(payload))+4096;
  const held=reservation('claude','claude-opus-5-5',payload);assert.equal(held,Math.ceil(bytes*8800+2400*22000));
  const usage={input_tokens:100,output_tokens:50,cache_creation_input_tokens:60,cache_read_input_tokens:20,cache_creation:{ephemeral_5m_input_tokens:10}};
  assert.equal(charge('claude',usage,held,'claude-opus-5-5'),Math.ceil((100*4000+10*5000+50*8000+20*200+50*20000)*1.1));
  assert.equal(charge('claude',null,held,'claude-opus-5-5'),held);
  assert.equal(charge('claude',usage,held,'claude-sonnet-5-5'),charge('claude',usage,held));
});
test('actual R7 nested hint IDs cover only their milestones, preserving score and reveal',()=>{
  assert.match(game.release,/^R7(?:\.|$)/);
  for(const c of game.steps.filter(s=>s.kind==='challenge')) for(const annotation of c.key.hints){
    const hint=game.steps.find(s=>s.id===annotation.step_id);
    const opened=game.steps.slice(0,game.steps.indexOf(c)+1).filter(s=>s.kind!=='hint').map(s=>s.id).concat(hint.id);
    const request=validateBody({slug:game.slug,message:'Prosim za presojo moje razlage.',opened,mode:'IZUMLJAJ'});
    const session=createSession(game,request);
    const result=session.execute('assess_challenge',{step:c.id,path:'historical',achieved:c.key_ideas,why:'Povezal sem vse ključne mehanizme.',advantages:[]});
    assert.equal(result.score,5);assert.equal(result.stars,c.key_ideas.length-new Set(annotation.covers).size,annotation.step_id);
    const covered=annotation.covers.map(id=>c.key.key_ideas.find(x=>x.id===id).text);
    const context=modelContext(game,session);assert.deepEqual(context.sealed_key.hints.find(x=>x.id===hint.id).covers,covered);
    const reveal=game.steps.find(s=>s.kind==='reveal'&&s.for===c.id);
    assert.ok(result.allowed_open_steps.some(x=>x.id===reveal.id));
  }
});
test('R7 malformed coverage stays conservative, legacy unannotated games remain supported',()=>{
  const g=structuredClone(game),c=g.steps.find(s=>s.id==='s8'),h=g.steps.find(s=>s.id==='s9');
  c.key.hints.find(x=>x.step_id===h.id).covers=['unknown-id'];
  const opened=g.steps.slice(0,g.steps.indexOf(c)+1).filter(s=>s.kind!=='hint').map(s=>s.id).concat(h.id);
  const session=createSession(g,validateBody({slug:g.slug,message:'Presodi razlago.',opened}));
  assert.equal(session.execute('assess_challenge',{step:c.id,path:'historical',achieved:c.key_ideas,why:'Povezal sem mehanizme.',advantages:[]}).stars,0);
});
