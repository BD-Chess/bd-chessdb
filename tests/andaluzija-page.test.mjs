import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pageRequest,validatePageTarget,pageSections} from '../public/BD/O/izleti/andaluzija-page.mjs';
import {createTravelExecutor} from '../public/BD/O/izleti/andaluzija-ai-actions.mjs';
import {travelKnowledge,travelTopics} from '../functions/lib/andaluzija-ai-knowledge.mjs';
import {makeTravelHandler,validateAction} from '../functions/andaluzija-ai.mjs';
import {scriptedClient} from './andaluzija-ai-provider-fixture.mjs';
process.env.MDLXDCC_GUIDE_SESSION_SECRET='synthetic-isolated-session-secret-'.repeat(3);
const ctx=()=>({schema:'andaluzija-ai-context-v1',tripId:'andaluzija-2027',revision:0,selection:{variant:'gpt',day:0,city:'malaga'},city:'Málaga',entry:{id:'malaga-entry',name:'Entrada'},stops:[],capabilities:{write:false,save:false},flightTimesVerified:false});
const req=b=>new Request('https://www.mdlxdcc.org/.netlify/functions/andaluzija-ai',{method:'POST',headers:{Origin:'https://www.mdlxdcc.org','Content-Type':'application/json'},body:JSON.stringify(b)});
const parse=async r=>(await r.text()).trim().split('\n\n').filter(Boolean).map(x=>JSON.parse(x.slice(6)));
const budgetFactory=()=>({reserve:async()=>null,settle:async()=>{}});

test('literal Slovenian page request and declined/ambiguous/external requests',()=>{
 for(const message of ['premakni mi HTML stran na mesto kjer je zemljevid','Pokaži zemljevid','Pomakni se do zemljevida','Prosim pojdi na zemljevid'])assert.deepEqual(pageRequest(message),{section:'zemljevid',day:null});
 assert.deepEqual(pageRequest('Pokaži 4. dan'),{section:'dnevi',day:4});
 for(const message of ['Ne pokaži zemljevida','Pokaži zemljevid v Google Maps','Pokaži zemljevid in shrani oglede','Pokaži zemljevid in primerjavo','Pokaži dan 14','Pokaži <script>zemljevid</script>'])assert.equal(pageRequest(message),null);
});

test('fixed section targets only: no selector, code, URL, unknown day or extra properties',()=>{
 for(const args of [{section:'#zemljevid',day:null},{section:'https://example.invalid',day:null},{section:'zemljevid',day:1},{section:'dnevi',day:11},{section:'dnevi',day:0},{section:'__proto__',day:null},{section:'zemljevid',day:null,selector:'body'}])assert.throws(()=>validatePageTarget(args));
 assert.deepEqual(validateAction('show_page_section',{section:'zemljevid',day:null}),{section:'zemljevid',day:null});
 assert.throws(()=>validateAction('read_travel_topic',{topic:'../private'}));assert.equal(Object.keys(pageSections).length,15);
});

test('page action is read-only even with locked/conflicted planner; no sync, catalogue, save or solver',async()=>{
 let epoch=1,called=0;const c=ctx();c.revision=5;
 const api={getContext:()=>c,getExecutionState:()=>({epoch}),sync:()=>{throw Error('MUST_NOT_SYNC');},getState:()=>{throw Error('MUST_NOT_READ_PLAN');}};
 const ex=createTravelExecutor({adapter:()=>api,fetcher:()=>{throw Error('MUST_NOT_FETCH');},navigate:async args=>{called++;return {...args,locked:false};}});
 const a={actor:'owner',requestId:'page-action-0001',tripId:'andaluzija-2027',name:'show_page_section',args:{section:'zemljevid',day:null},selection:c.selection,baseRevision:0,epoch:9,allowWrite:false};
 const r=await ex.execute(a,{epoch:9});assert.equal(r.status,'shown');assert.deepEqual(r.changedIds,[]);assert.deepEqual(await ex.execute(a,{epoch:9}),r);assert.equal(called,1);assert.equal(c.revision,5);
 const delayed=createTravelExecutor({adapter:()=>api,navigate:async args=>{epoch++;return {...args,locked:false};}});assert.equal((await delayed.execute({...a,requestId:'page-action-0002'},{epoch:9})).status,'cancelled');
});

for(const provider of ['gpt','claude'])test(provider+': tool -> visible-target receipt -> continuation, no writes; mismatched section rejected',async()=>{
 const payloads=[],handler=makeTravelHandler({actor:()=>({id:'owner'}),configured:{gpt:true,claude:true},clientFactory:()=>scriptedClient(provider,payloads,{name:'show_page_section',args:{section:'zemljevid',day:null}},'Prikazal sem zemljevid na tej strani.'),budgetFactory,stateReader:()=>{throw Error('NO_STATE_READ');}});
 const events=await parse(await handler(req({message:'Ali lahko pokažeš vgrajeni zemljevid?',provider,context:ctx(),epoch:8,allowChanges:false}))),e=events.find(e=>e.type==='client_action');assert(e);assert.equal(e.action.allowWrite,false);
 const receipt={...e.action,status:'shown',navigation:{section:'zemljevid',day:null,locked:false}};
 assert.equal((await handler(req({continuation:e.continuation,receipt:{...receipt,navigation:{...receipt.navigation,section:'potrjeno'}},context:ctx()}))).status,400);
 const final=await parse(await handler(req({continuation:e.continuation,receipt,context:ctx()})));assert(final.some(x=>x.type==='delta'&&x.text.includes('Prikazal')));assert.equal(final.at(-1).serverSaveVerified,false);assert.equal(final.at(-1).skill.version,'1.2.0');assert(payloads.every(p=>(p.instructions||p.system).includes('show_page_section')));
});

test('six hashed topics load progressively; city guides contain reasoning; protected schedule cipher is pinned',async()=>{
 const k=await travelKnowledge();assert.equal(travelTopics.length,6);assert(!Object.keys(k.receipt().files).some(p=>p.endsWith('overview.md')));
 for(const t of travelTopics)assert((await k.topic(t)).length>1700,t);
 for(const city of Object.keys(k.visits)){const r=await k.reference(city);assert(r.length>1800,city);assert(r.includes('Naš')||r.includes('naš'));}
 await assert.rejects(k.topic('../private'));
 assert.equal(createHash('sha256').update(await readFile('public/BD/O/izleti/andaluzija-private.8zs.json')).digest('hex'),'3d90570f96a6353d5767415157a6f9685f019a84d3fe9151f8499beaec2117ff');
});
