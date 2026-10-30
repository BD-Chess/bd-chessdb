import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeHandler } from '../functions/game-guide.mjs';
import { validateBody, loadGame, createSession, instructions, modelContext, finalSummary, invitation } from '../functions/lib/game-guide/runtime.mjs';
import { stepTexts } from '../functions/lib/game-guide/content.mjs';
import { sealContinuation, openContinuation } from '../functions/lib/game-guide/continuation.mjs';
import { safeMarkdown } from '../public/assets/game-guide/markdown.mjs';

const secret = 'offline-fixture-only-'.repeat(4), actor = { role: 'owner', id: 'fixture' };
const game = { schema: 'ai8.game.v1', slug: '_fixture', title: 'Fixture', acts: [1,2,3,4,5].map(act => ({ act })), steps: [
  { id: 's1', act: 1, kind: 'story', title: 'Delavnica', for_agent: 'Začetek.', text: 'Meritev je 0,0054 → 0,0033. Odprto besedilo v celoti.' },
  ...[1,2,3,4,5].flatMap(n => [
    { id: `c${n}`, act: n, kind: 'challenge', title: `Izziv ${n}`, for_agent: `Presodi izziv ${n}.`, text: `Javno vprašanje ${n}.`, key_ideas: [`Zapečateni mehanizem ${n} ima pet skritih sestavin.`, `Drugi mejnik ${n}.`], alternatives_ok: ['En propeler ali katapult je drugačna pravilna pot.'], refs: [{ref:`c${n}.q`,kind:'q',label:'Vprašanje'}] },
    { id: `h${n}`, act: n, kind: 'hint', title: `Namig ${n}`, for: `c${n}`, for_agent: `Ključ namiga ${n}.`, text: `SKRITI_NAMIG_${n} z natančnim postopkom rešitve.` },
    { id: `r${n}`, act: n, kind: 'reveal', title: `Razkritje ${n}`, for: `c${n}`, for_agent: `Ključ razkritja ${n}.`, text: `SKRITO_RAZKRITJE_${n} s celotnim potekom zgodovine.` }
  ]), { id: 'end', act: 5, kind: 'epilogue', title: 'Epilog', for_agent: 'SKRITI_EPILOG', text: 'SKRITI_EPILOG prihodnja dejstva.' }
] };
const request = (extra = {}) => validateBody({ slug: '_fixture', message: 'Začniva.', provider: 'claude', mode: 'IZUMLJAJ', development: true, opened: ['s1'], protocol: 'game-guide-tools-v1', ...extra });
function responseFor(provider, text, calls) {
  return provider === 'claude' ? { content: [...(text ? [{type:'text',text}] : []), ...calls.map(c => ({type:'tool_use',id:c.call_id,name:c.name,input:c.arguments}))] }
    : { output: [...(text ? [{type:'message',role:'assistant',content:[{type:'output_text',text}]}] : []), ...calls.map(c => ({type:'function_call',...c,arguments:JSON.stringify(c.arguments)}))] };
}
const call = (name, args, id = 'tool_1') => ({ name, arguments: args, call_id: id });
function harness(outputs, options = {}) {
  let at = 0; const seen = [];
  const handler = makeHandler({ accessFactory: async () => actor, configured: {claude:true,gpt:true}, continuationSecret: () => secret,
    gameFactory: async () => structuredClone(game), clientFactory: async () => ({}), budgetFactory: () => ({}),
    logStore: {start:async()=>null}, round: async args => {
      seen.push({system:args.system,input:structuredClone(args.input)});
      const value = outputs[at++]; assert.ok(value, `Unexpected provider round ${at}`);
      const text = value.text || '', calls = value.calls || []; args.onText(text);
      return {text,calls:args.provider === 'gpt' ? calls.map(c=>({...c,arguments:JSON.stringify(c.arguments)})) : calls,response:responseFor(args.provider,text,calls)};
    }, ...options });
  return { seen, handler, async post(body) {
    const response = await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) }));
    const raw = await response.text();
    return {status:response.status,raw,events:response.headers.get('content-type')?.includes('text/event-stream') ? raw.split('\n\n').filter(Boolean).map(frame=>JSON.parse(frame.slice(6))) : []};
  } };
}
async function finish(h, first, visible = true) {
  const events = [...first.events]; let result = first;
  for (let n = 0; n < 4; n++) {
    const token = result.events.find(e=>e.type==='continue')?.token; if (!token) return events;
    const receipts = result.events.filter(e=>e.type==='action').map(a=>({call_id:a.call_id,name:a.name,ok:visible,opened:a.id,visible,already_open:false}));
    result = await h.post({continuation:token,receipts}); events.push(...result.events);
  }
  throw Error('Unexpected continuation loop');
}
const textOf = events => events.filter(e=>e.type==='delta').map(e=>e.text).join('');

test('P0-1: suppress claimed opening, require additional provider round, actual receipt reaches model (Claude/GPT)', async () => {
  for (const provider of ['claude','gpt']) {
    const h = harness([{text:'Odprl sem prvi izziv na desni.'},{calls:[call('open_step',{id:'c1'})]},{text:'Predolga ponovitev besedila strani. '.repeat(100)}]);
    const first = await h.post(request({provider})); assert.equal(textOf(first.events),'');
    const events = await finish(h,first); assert.equal(h.seen.length,3);
    assert.equal(events.filter(e=>e.type==='action'&&e.name==='open_step').length,1);
    const input = JSON.stringify(h.seen[2].input); assert.match(input,/opened/); assert.match(input,/visible/); assert.match(input,/true/);
    assert.equal(textOf(events),'Na desni se je odprl nov korak. Preberi in mi povej, ko si pripravljen.');
    assert.ok(events.some(e=>e.type==='done')); assert.ok(!events.some(e=>e.type==='error'));
  }
});
test('P0-1: unresolved opening claim is withheld after four rounds', async () => {
  const h=harness(Array.from({length:4},()=>({text:'Odpiram naslednji izziv.'})));
  const r=await h.post(request()); assert.equal(textOf(r.events),''); assert.equal(h.seen.length,4); assert.ok(r.events.some(e=>e.code==='TOOL_LIMIT'));
});
test('P0-2: hint/reveal require open challenge in development as well; mock recovers by opening challenge', async () => {
  for (const development of [true,false]) {
    const s=createSession(game,request({development}));
    assert.throws(()=>s.execute('open_step',{id:'h1'}),/CHALLENGE_NOT_OPEN/);
    assert.throws(()=>s.execute('open_step',{id:'r1'}),/CHALLENGE_NOT_OPEN/);
    const h=harness([{calls:[call('open_step',{id:'h1'})]},{calls:[call('open_step',{id:'c1'},'tool_2')]},{text:'Preberi.'}]);
    const events=await finish(h,await h.post(request({development})));
    assert.deepEqual(events.filter(e=>e.type==='action').map(e=>e.id),['c1']); assert.match(JSON.stringify(h.seen[1].input),/CHALLENGE_NOT_OPEN/);
  }
});
test('P0-3: full open text and current sealed key only; no later reveal/epilogue; pre-open leak repaired', async () => {
  const req=request({opened:['s1','c1']}); const s=createSession(game,req), ctx=modelContext(game,s);
  assert.match(JSON.stringify(ctx),/0,0054 → 0,0033/); assert.match(JSON.stringify(ctx),/SKRITO_RAZKRITJE_1/);
  for (const token of ['SKRITO_RAZKRITJE_2','SKRITI_NAMIG_2','SKRITI_EPILOG','Izziv 5']) assert.ok(!JSON.stringify(ctx).includes(token));
  const h=harness([{text:game.steps.find(s=>s.id==='r1').text},{text:'Kako bi tvoja zamisel delovala?'}]);
  const r=await h.post(req); assert.equal(h.seen.length,2); assert.ok(!r.raw.includes('SKRITO_RAZKRITJE_1')); assert.match(textOf(r.events),/Kako bi/);
});
test('P0-4: page carries content; buffered prose never arrives before receipt, single short invitation after it', async () => {
  const h=harness([{text:'Javno vprašanje 1. '+('Spoiler '.repeat(100)),calls:[call('open_step',{id:'c1'})]},{text:'Odjemalec je potrdil open_step c1.'}]);
  const first=await h.post(request()); assert.equal(textOf(first.events),'');
  const events=await finish(h,first); const text=textOf(events); assert.ok(text.length<130); assert.ok(!text.includes('Javno vprašanje')); assert.ok(!text.includes('odjemalec')); assert.ok(!text.includes('c1'));
});
test('failed client display is returned as failure, no false opening invitation', async () => {
  const h=harness([{calls:[call('open_step',{id:'c1'})]},{text:'Poskusiva znova, ko boš pripravljen.'}]);
  const events=await finish(h,await h.post(request()),false); assert.ok(!textOf(events).includes('se je odprl'));
  assert.match(JSON.stringify(h.seen[1].input),/DISPLAY_FAILED/); assert.ok(!h.seen[1].system.includes('SKRITO_RAZKRITJE_1'));
});
test('already_open is silent no-op with tool_result, no duplicate UI action', async () => {
  const h=harness([{calls:[call('open_step',{id:'c1'})]},{text:'Odprl sem izziv še enkrat.'}]);
  const r=await h.post(request({opened:['s1','c1']})); assert.equal(textOf(r.events),''); assert.ok(!r.events.some(e=>e.type==='action'));
  assert.match(JSON.stringify(h.seen[1].input),/already_open/);
});
test('P1: understanding precedes reveal, one clarifying question, hints explicit/tiered, card B in development without result action', async () => {
  let req=request({opened:['s1','c1'],message:'Krilca na žico.'}); let s=createSession(game,req);
  assert.throws(()=>s.execute('open_step',{id:'r1'}),/UNDERSTANDING_BEFORE_REVEAL/);
  assert.throws(()=>s.execute('open_step',{id:'h1'}),/HINT_ON_REQUEST/);
  s.execute('ask_understanding',{step:'c1',question:'Zakaj bi tvoja zamisel delovala?'});
  assert.throws(()=>s.execute('ask_understanding',{step:'c1',question:'Še eno vprašanje?'}),/INVALID_QUESTION/);
  req=request({opened:['s1','c1'],message:'Ker bi bila moja lastna pot drugačna in bi vseeno delovala.',learning:s.learning});
  const card=call('assess_challenge',{step:'c1',card:'B',achieved:2,stars:2,why:'Drugačna pravilna pot iz ključa.',explanation:'',bonus:'test_needed',advantage:'izkoristek'});
  const h=harness([{calls:[card]},{calls:[call('open_step',{id:'r1'},'tool_2')]},{text:'mark_result nimam, zapiši sam.'}]);
  const events=await finish(h,await h.post(req));
  assert.match(textOf(events),/Kartica B · tvoja pot · drugače, a deluje · 5\/5/); assert.match(textOf(events),/odklene ga preizkus/);
  assert.ok(!textOf(events).includes('mark_result')); assert.ok(!events.some(e=>e.type==='action'&&e.name==='mark_result'));
  assert.ok(!h.seen[0].system.includes('SKRITO_RAZKRITJE_2'));
  s=createSession(game,request({opened:['s1','c1'],message:'Brez namiga prosim.'})); assert.throws(()=>s.execute('open_step',{id:'h1'}),/HINT_ON_REQUEST/);
});
test('P1: A uses half-points, all five cards in coded summary, no negative points', () => {
  const req=request({opened:['s1','c1'],message:'Moja dovolj dolga razlaga mehanizma deluje takole.'}); const s=createSession(game,req);
  s.execute('assess_challenge',{step:'c1',card:'A',achieved:1,stars:1,why:'Prvi mejnik.',explanation:req.message,bonus:'none',advantage:''});
  assert.match(s.learning.cards.c1.line,/mejniki 1\/2 ✦ · 2,5\/5/);
  const learning={asked:[],cards:Object.fromEntries([1,2,3,4,5].map(n=>[`c${n}`,{card:n===2?'B':'A',line:`Kartica ${n===2?'B':'A'} · ${n}`}]))};
  const lines=finalSummary(game,learning).split('\n'); assert.equal(lines.length,5); assert.ok(lines.every(x=>x.includes('Kartica')));
  const end=createSession(game,request({opened:game.steps.map(s=>s.id),learning})); end.restoreTurn('end'); assert.match(invitation(game,end),/5\. Izziv 5 · Kartica A/);
});
test('grounding prompt and safe markdown subset; technical text is repaired', async () => {
  const prompt=instructions(game,request({opened:['s1','c1']}));
  for(const text of ['UTEMELJENOST','SPRAŠUJ','STRAN nosi vsebino','PANEL samo pogovor','nikoli ne citiraj','največ enim ask_understanding','alternatives_ok']) assert.ok(prompt.includes(text),text);
  const html=safeMarkdown('**Krepko** *poševno* `**koda**`\n- ena\n- <img src=x onerror=alert(1)>\n1. dve\n<script>alert(1)</script>');
  assert.match(html,/<strong>Krepko<\/strong>/); assert.match(html,/<em>poševno<\/em>/); assert.match(html,/<code>\*\*koda\*\*<\/code>/); assert.match(html,/<ul>/); assert.match(html,/<ol>/); assert.ok(!/<(?:img|script)\b/.test(html));
  const h=harness([{text:'Odjemalec čaka na potrditev open_step c1.'},{text:'Kaj misliš ti?'}]); const r=await h.post(request({message:'Razvijava igro.'})); assert.equal(textOf(r.events),'Kaj misliš ti?');
});
test('continuation is encrypted, actor-bound, expiring, tamper-resistant; forged receipt is refused', async () => {
  const token=sealContinuation({deadline:200000,rounds:1,private:'SKRITI_KLJUC'},actor,secret,100000);
  assert.ok(!token.includes('SKRITI')); assert.equal(openContinuation(token,actor,secret,100001).private,'SKRITI_KLJUC');
  assert.throws(()=>openContinuation(token,{...actor,id:'other'},secret,100001)); assert.throws(()=>openContinuation(token,actor,secret,300000)); assert.throws(()=>openContinuation(token.slice(0,10)+'x'+token.slice(11),actor,secret,100001));
  const h=harness([{calls:[call('open_step',{id:'c1'})]}]); const first=await h.post(request());
  const result=await h.post({continuation:first.events.find(e=>e.type==='continue').token,receipts:[]}); assert.equal(result.status,400);
  const stale=await h.post(request({protocol:undefined})); assert.equal(stale.status,409); assert.match(stale.raw,/REFRESH_REQUIRED/); assert.equal(h.seen.length,1);
});
test('trusted page extraction covers actual Dayton/Faraday text; server fetch is fixed-origin and redirect-denied', async () => {
  for (const slug of ['dayton1903','faraday1831']) {
    const manifest=JSON.parse(await readFile(new URL(`../public/game/${slug}/game.json`,import.meta.url),'utf8'));
    const html=await readFile(new URL(`../public/game/${slug}/index.html`,import.meta.url),'utf8');
    const enriched=stepTexts(html,manifest); assert.equal(enriched.steps.length,manifest.steps.length); assert.ok(enriched.steps.every(s=>s.text.length>20));
    if(slug==='dayton1903') assert.ok(enriched.steps.some(s=>s.text.includes('0,0033')));
  }
  const tiny={...game};const html=game.steps.map(s=>`<section class="g-step" id="${s.id}"><h2>${s.title}</h2><p>A &amp; B &#x2192; vrednost</p><script>NE_VKLJUCI</script></section>`).join('');
  const urls=[];await loadGame('_fixture',{fetcher:async(url,opts)=>{urls.push(url);assert.equal(opts.redirect,'error');return new Response(url.endsWith('json')?JSON.stringify(tiny):html);}});
  assert.ok(urls.every(url=>url.startsWith('https://www.mdlxdcc.org/game/_fixture/'))); assert.ok(!stepTexts(html,structuredClone(game)).steps[0].text.includes('NE_VKLJUCI'));
});
