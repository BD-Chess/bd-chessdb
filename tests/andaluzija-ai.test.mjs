import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {travelKnowledge} from '../functions/lib/andaluzija-ai-knowledge.mjs';
import {makeTravelHandler,sealContinuation,openContinuation,safeContext,validateAction} from '../functions/andaluzija-ai.mjs';
import {seedDay,mapsForStop} from '../public/BD/O/izleti/andaluzija-poi.mjs';
import {publicPath} from '../functions/lib/mdlxdcc-guide/runtime.mjs';
process.env.MDLXDCC_GUIDE_SESSION_SECRET='synthetic-isolated-session-secret-'.repeat(3);
const context=()=>({schema:'andaluzija-ai-context-v1',tripId:'andaluzija-2027',revision:0,selection:{variant:'gpt',day:3,city:'cordoba'},city:'Córdoba',entry:{id:'cordoba-entry',name:'Puerta del Puente'},stops:seedDay('cordoba',3).stops,capabilities:{write:true,save:true},flightTimesVerified:false});
const req=b=>new Request('https://www.mdlxdcc.org/.netlify/functions/andaluzija-ai',{method:'POST',headers:{Origin:'https://www.mdlxdcc.org','Content-Type':'application/json'},body:JSON.stringify(b)});
const parse=async r=>(await r.text()).trim().split('\n\n').filter(Boolean).map(x=>JSON.parse(x.slice(6)));
const noBudget=()=>({reserve:async()=>null,settle:async()=>{}});
import {scriptedClient} from './andaluzija-ai-provider-fixture.mjs';

test('public skill and every reference hash match; city knowledge is progressively loaded',async()=>{
 const k=await travelKnowledge();assert(k.skill.includes('Version 1.0.0'));assert(!JSON.stringify(k.receipt()).includes('cordoba.md'));assert((await k.reference('cordoba')).includes('Palacio de Viana'));assert(Object.keys(k.visits).length===10);assert(Object.keys(k.receipt().files).includes('references/cordoba.md'));assert(k.visits.cordoba.length>=12);
 await assert.rejects(k.reference('../private'));const bad=async path=>{const data=await readFile('public/ai/skills/'+path,'utf8');return path.endsWith('SKILL.md')?data+'x':data;};await assert.rejects(travelKnowledge({read:bad}),/HASH/);
 const reg=JSON.parse(await readFile('public/ai/skills/registry.json','utf8')),entry=reg.skills.find(s=>s.id==='andaluzija-2027-guide');for(const [p,h]of Object.entries(entry.file_hashes))assert.equal(createHash('sha256').update(await readFile('public/ai/skills/andaluzija-2027-guide/'+p)).digest('hex'),h);
});
test('context strips private fields, roles, booking data and markup observations; global private route block stays',()=>{
 const v=context();v.private='SYNTHETIC_PRIVATE_MARKER';v.bookings=[{secret:'SYNTHETIC_PRIVATE_MARKER'}];v.page={path:'/BD/O/',excerpt:'SYNTHETIC_PRIVATE_MARKER'};v.role='owner';assert(!JSON.stringify(safeContext(v)).includes('SYNTHETIC_PRIVATE_MARKER'));assert.throws(()=>publicPath('/BD/O/izleti/andaluzija-2027.html'));assert.throws(()=>validateAction('apply_visit_changes',{changes:[{op:'booking',id:'x',minutes:null}],optimize:false,segment:0}));
});
test('continuations are confidential, tamper resistant, expire and bind actor',async()=>{
 const v={expires:Date.now()+1000,actor:'a',private:'SYNTHETIC_PRIVATE_MARKER'},t=sealContinuation(v);assert(!t.includes('SYNTHETIC'));assert.deepEqual(openContinuation(t),v);assert.throws(()=>openContinuation(t.slice(0,-5)+'xxxxx'));assert.throws(()=>openContinuation(sealContinuation({...v,expires:Date.now()-1})));
 const handler=makeTravelHandler({actor:()=>({id:'b'})});assert.equal((await handler(req({continuation:t}))).status,400);
});
test('unauthenticated, visitor and forged page/role never invoke provider; origins remain constrained',async()=>{
 let called=false;const h=makeTravelHandler({actor:()=>null,clientFactory:()=>{called=true;}});assert.equal((await h(req({role:'owner',page:{path:'/BD/O/'},context:context()}))).status,401);assert.equal(called,false);
 const x=makeTravelHandler({actor:()=>({id:'a'})});assert.equal((await x(new Request('https://www.mdlxdcc.org/.netlify/functions/andaluzija-ai',{method:'POST',headers:{Origin:'https://evil.invalid'}}))).status,403);
});
for(const provider of ['gpt','claude'])test(provider+': skill, action -> execution receipt -> independently checked save -> continuation, signed prefix intact',async()=>{
 const payloads=[];let verified=0;const handler=makeTravelHandler({actor:()=>({id:'a'}),configured:{gpt:true,claude:true},clientFactory:()=>scriptedClient(provider,payloads),budgetFactory:noBudget,stateReader:async()=>{verified++;return Response.json({revision:1,receipts:[{requestId:'server-save-id',revision:1}]},{headers:{ETag:'"saved-1"'}});}});
 const first=await parse(await handler(req({message:'Dodaj Viana in preuredi oglede.',provider,context:context(),epoch:1,allowChanges:true})));const event=first.find(e=>e.type==='client_action');assert(event);assert.equal(event.action.name,'apply_visit_changes');assert.equal(event.action.allowWrite,true);assert(!first.some(e=>e.type==='delta'));
 const receipt={...event.action,status:'saved',changedIds:['cordoba-viana'],save:{requestId:'server-save-id',revision:1,etag:'"saved-1"'}};delete receipt.args;delete receipt.name;
 const c=context();c.revision=1;const last=await parse(await handler(req({continuation:event.continuation,receipt,context:c})));assert.equal(last.at(-1).type,'done');assert.equal(last.at(-1).serverSaveVerified,true);assert.equal(verified,1);assert(payloads.every(p=>(p.instructions||p.system).includes('Version 1.0.0')));assert.equal(payloads[0].instructions||payloads[0].system,payloads[1].instructions||payloads[1].system);
 const serial=JSON.stringify(payloads[1]);assert(serial.includes(provider==='gpt'?'synthetic-signed-reasoning':'synthetic-signature'));assert(serial.includes('server-save-id'));assert(!serial.includes('SYNTHETIC_PRIVATE_MARKER'));
 const wrong=await handler(req({continuation:event.continuation,receipt:{...receipt,save:{...receipt.save,etag:'"forged"'}},context:c}));assert.equal(wrong.status,400);
});
test('recommendation and locked public context do not grant writes; provider missing has no fallback',async()=>{
 const h=makeTravelHandler({actor:()=>({id:'a'}),configured:{gpt:true,claude:false},clientFactory:()=>scriptedClient('gpt'),budgetFactory:noBudget});
 assert.equal((await h(req({message:'Dodaj Viana',provider:'claude',context:context(),epoch:0,allowChanges:true}))).status,503);
 const c=context();c.capabilities.write=false;const lockedEvents=await parse(await h(req({message:'Dodaj Viana',provider:'gpt',context:c,epoch:0,allowChanges:true})));assert(!lockedEvents.some(x=>x.type==='client_action'));assert(!lockedEvents.some(x=>x.type==='delta'&&x.text.includes('Načrt je shranjen')));
 const e=await parse(await h(req({message:'Kaj priporočaš?',provider:'gpt',context:context(),epoch:0,allowChanges:true})));assert(!e.some(x=>x.type==='client_action'));assert(e.some(x=>x.type==='done'));
});
