import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeHandler } from '../functions/game-guide.mjs';
import { gameProviderKey, gameProviderModel, createGameProviderClient } from '../functions/lib/game-guide/provider.mjs';
import { providerModel } from '../functions/lib/mdlxdcc-guide/provider.mjs';
import { reservation, charge, createBudget } from '../functions/lib/mdlxdcc-guide/cost.mjs';
import { diagnosticEvent } from '../functions/lib/game-guide/diagnostics.mjs';

// All SDKs, keys, ledgers and sessions below are offline synthetic doubles.
globalThis.fetch = () => assert.fail('No network or paid provider is permitted');
const names = ['GAME_GUIDE_ANTHROPIC_API_KEY','GAME_GUIDE_OPENAI_API_KEY','ANTHROPIC_API_KEY','OPENAI_API_KEY',
  'GAME_GUIDE_CLAUDE_MODEL','GAME_GUIDE_GPT_MODEL','MDLXDCC_GUIDE_CLAUDE_MODEL','MDLXDCC_GUIDE_MODEL'];
async function withEnv(values, run) {
  const prior = Object.fromEntries(names.map(k => [k, process.env[k]]));
  const netlify = globalThis.Netlify; delete globalThis.Netlify;
  try {
    for (const k of names) delete process.env[k];
    Object.assign(process.env, values); return await run();
  } finally {
    for (const k of names) if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k];
    if (netlify === undefined) delete globalThis.Netlify; else globalThis.Netlify = netlify;
  }
}
const shared = { ANTHROPIC_API_KEY:'synthetic-shared-claude', OPENAI_API_KEY:'synthetic-shared-gpt' };
const dedicated = { GAME_GUIDE_ANTHROPIC_API_KEY:'synthetic-game-claude', GAME_GUIDE_OPENAI_API_KEY:'synthetic-game-gpt' };
class FakeSDK { constructor(options) { this.options = options; } }
for (const provider of ['claude','gpt']) test(`R3.3 ${provider}: dedicated key wins, empty/missing key falls back, missing both stays absent`, async () => {
  const name = provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  for (const gameKey of [undefined, '', dedicated['GAME_GUIDE_' + name]]) {
    const values = { ...shared, ...(gameKey === undefined ? {} : { ['GAME_GUIDE_' + name]:gameKey }) };
    await withEnv(values, async () => {
      const expected = gameKey || shared[name];
      assert.deepEqual(gameProviderKey(provider), { apiKey:expected, key_source:gameKey ? 'dedicated' : 'shared' });
      const client = await createGameProviderClient(provider, { Anthropic:FakeSDK, OpenAI:FakeSDK });
      assert.deepEqual(client.options, { apiKey:expected, maxRetries:0, timeout:45000 });
    });
  }
  await withEnv({}, async () => assert.deepEqual(gameProviderKey(provider), { apiKey:undefined, key_source:'shared' }));
});

test('R3.3 Netlify env keys are honored without revealing values in GET availability', async () => {
  const handler = makeHandler({ accessFactory:async () => ({role:'owner',id:'synthetic-owner'}) });
  for (const values of [{},shared,dedicated,{...shared,...dedicated},{...shared,GAME_GUIDE_OPENAI_API_KEY:dedicated.GAME_GUIDE_OPENAI_API_KEY}]) {
    await withEnv(values, async () => {
      globalThis.Netlify = { env:{ get:k => values[k] } };
      const response = await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide'));
      assert.equal(response.status,200); const data = await response.json();
      for (const provider of ['claude','gpt']) {
        const name = provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
        assert.deepEqual(data.providers[provider], { available:Boolean(values['GAME_GUIDE_'+name] || values[name]), key_source:values['GAME_GUIDE_'+name] ? 'dedicated' : 'shared' });
      }
      for (const value of Object.values(values)) assert.ok(!JSON.stringify(data).includes(value));
    });
  }
});

test('R3.3 game model defaults and overrides stay independent of Guide/Andaluzija model selection', async () => {
  await withEnv({}, async () => {
    assert.equal(gameProviderModel('claude'),'claude-opus-5-5'); assert.equal(gameProviderModel('gpt'),'gpt-6.1-sol');
    assert.equal(providerModel('claude'),'claude-sonnet-5-5'); assert.equal(providerModel('gpt'),'gpt-6-luna');
  });
  await withEnv({ MDLXDCC_GUIDE_CLAUDE_MODEL:'claude-shared-test', MDLXDCC_GUIDE_MODEL:'gpt-shared-test' }, async () => {
    assert.equal(gameProviderModel('claude'),'claude-opus-5-5'); assert.equal(gameProviderModel('gpt'),'gpt-6.1-sol');
    process.env.GAME_GUIDE_CLAUDE_MODEL='claude-game-test'; process.env.GAME_GUIDE_GPT_MODEL='gpt-game-test';
    assert.equal(gameProviderModel('claude'),'claude-game-test'); assert.equal(gameProviderModel('gpt'),'gpt-game-test');
    assert.equal(providerModel('claude'),'claude-shared-test'); assert.equal(providerModel('gpt'),'gpt-shared-test');
  });
});

test('R3.3 Sol reservation covers output plus long-context/cache-write/region rates; settlement uses Sol', async () => {
  const payload = { model:'gpt-6.1-sol', input:[], max_output_tokens:2400 };
  const bytes = Buffer.byteLength(JSON.stringify(payload),'utf8')+4096;
  const held = reservation('gpt','gpt-6.1-sol',payload);
  assert.equal(held,Math.ceil(bytes*11000+2400*16500));
  const usage = { input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:200,cache_write_tokens:100} };
  // Standard short context $2/$10/$0.10/$2.50 per MTok, existing 10% regional allowance.
  assert.equal(charge('gpt',usage,held,'gpt-6.1-sol'),Math.ceil((700*2000+200*100+100*2500)*1.1+100*10000*1.1));
  const longUsage = {...usage,input_tokens:300000};
  assert.equal(charge('gpt',longUsage,held,'gpt-6.1-sol'),Math.ceil((299700*2000+200*100+100*2500)*2*1.1+100*10000*1.5*1.1));
  assert.equal(charge('gpt',null,held,'gpt-6.1-sol'),held);
  assert.throws(() => reservation('gpt','unknown-model',payload),{code:'UNPRICED_MODEL'});
  assert.throws(() => charge('gpt',usage,held,'unknown-model'),{code:'UNPRICED_MODEL'});
  const rpc = [], budget = createBudget({id:'synthetic-player',role:'visitor'},'gpt','gpt-6.1-sol',{rpc:async (action,data) => rpc.push({action,...data})});
  const reservationID = await budget.reserve(payload); await budget.settle(reservationID,usage);
  assert.equal(rpc[0].model,'gpt-6.1-sol'); assert.equal(rpc[0].amount,held);
  assert.equal(rpc[1].amount,charge('gpt',usage,held,'gpt-6.1-sol'));
  await budget.settle(reservationID,null,true); assert.equal(rpc.at(-1).amount,0);
  await budget.settle(reservationID,null); assert.equal(rpc.at(-1).amount,held); assert.equal(rpc.at(-1).unknown,true);
});

test('R3.3 legacy Luna and Claude charging and owner exemption stay identical', async () => {
  const usage = {input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:200,cache_write_tokens:100}};
  assert.equal(charge('gpt',usage,999999),Math.ceil((700*100+200*10+100*125)*1.1+100*500*1.1));
  assert.equal(charge('gpt',usage,999999,'gpt-6-luna'),charge('gpt',usage,999999));
  const claude = {input_tokens:100,output_tokens:50,cache_creation_input_tokens:60,cache_read_input_tokens:20,cache_creation:{ephemeral_5m_input_tokens:10}};
  assert.equal(charge('claude',claude,999999),Math.ceil((100*2000+10*2500+50*4000+20*100+50*10000)*1.1));
  const owner = createBudget({role:'owner'},'gpt','gpt-6.1-sol',{rpc:() => assert.fail('owner must stay exempt')});
  assert.equal(await owner.reserve({}),null); await owner.settle(null,usage);
});

const game = JSON.parse(await readFile(new URL('../public/game/_fixture/game.json',import.meta.url)));
for (const provider of ['claude','gpt']) test(`R3.3 ${provider}: actual adapter keeps low/thinking and emits model/effort in cost and guide_trace`, async () => withEnv({},async () => {
  const logs=[],payloads=[],model=gameProviderModel(provider),usage={input_tokens:10,output_tokens:2};
  const client = provider === 'claude' ? {messages:{stream(payload) {
    payloads.push(payload); return {async *[Symbol.asyncIterator]() { yield {type:'content_block_delta',delta:{type:'text_delta',text:'Pozdrav.'}}; },finalMessage:async () => ({content:[],usage})};
  }}} : {responses:{async create(payload) {
    payloads.push(payload); return (async function*() {yield {type:'response.output_text.delta',delta:'Pozdrav.'};yield {type:'response.completed',response:{output:[],status:'completed',usage}};})();
  }}};
  const handler = makeHandler({accessFactory:async () => ({role:'owner',id:'synthetic-owner'}),configured:{claude:true,gpt:true},
    gameFactory:async () => game,clientFactory:async () => client,
    logStore:{start:async () => ({id:'synthetic-session'}),append:async (_,events) => logs.push(...structuredClone(events))}});
  const response = await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:'_fixture',provider,message:'Pozdrav.',protocol:'game-guide-tools-v1'})}));
  assert.equal(response.status,200);
  const events=(await response.text()).split('\n\n').filter(Boolean).map(x=>JSON.parse(x.slice(6)));
  assert.equal(events.at(-1).type,'done'); assert.equal(events.at(-1).model,model); assert.equal(payloads.length,1);
  const payload=payloads[0]; assert.equal(payload.model,model);
  if (provider==='claude') {assert.equal(payload.output_config.effort,'low');assert.equal(payload.thinking,undefined); /* Opus uses provider-default adaptive thinking. */}
  else assert.equal(payload.reasoning.effort,'low');
  const costs=logs.filter(e=>e.kind==='cost');assert.equal(costs.length,2);
  assert.deepEqual(costs.map(e=>e.payload.phase),['reserved','settled']);
  assert.equal(costs[1].payload.nanos,charge(provider,usage,costs[0].payload.nanos,model));
  const traces=logs.filter(e=>e.kind==='guide_trace');assert.ok(traces.length);
  for(const e of [...costs,...traces]) {assert.equal(e.payload.model,model);assert.equal(e.payload.effort,'low');}
}));

test('R3.3 game override reaches handler budget and invalid model is refused before client creation', async () => {
  await withEnv({GAME_GUIDE_GPT_MODEL:'gpt-6-luna'},async () => {
    let seenModel;
    const h=makeHandler({accessFactory:async()=>({role:'owner'}),configured:{gpt:true},logStore:{start:async()=>null},gameFactory:async()=>game,
      clientFactory:async()=>({}),budgetFactory:(_,__,model)=>{seenModel=model;return {};},
      round:async({model})=>{assert.equal(model,'gpt-6-luna');return {response:{output:[]},text:'Pozdrav.',calls:[]};}});
    const req=()=>new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:'_fixture',provider:'gpt',message:'Pozdrav.',protocol:'game-guide-tools-v1'})});
    assert.match(await (await h(req())).text(),/"type":"done"/);assert.equal(seenModel,'gpt-6-luna');
    process.env.GAME_GUIDE_GPT_MODEL='invalid model';const bad=await h(req());assert.equal(bad.status,503);assert.equal((await bad.json()).error.code,'MODEL_UNAVAILABLE');
  });
});

// Large traces must retain the measurement identity after bounded truncation.
test('R3.3 truncated guide_trace retains provider, model and effort', () => {
  const event=diagnosticEvent('model_round',{provider:'gpt',model:'gpt-6.1-sol',effort:'low',round_count:1,
    tool_uses:Array.from({length:48},()=>({args:'x'.repeat(8000)}))});
  assert.equal(event.payload.truncated,true); assert.equal(event.payload.provider,'gpt');
  assert.equal(event.payload.model,'gpt-6.1-sol'); assert.equal(event.payload.effort,'low');
});
