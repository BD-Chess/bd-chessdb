import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {makeLearningHandler,learningRoute,learningPayloadFactory} from '../../functions/lib/omnicpq/ai-learning.mjs';
import {LEARNING_PROTOCOL,AI_CASES,runCodeCase,CODE_CASES,gradeAICase,parseDecision,parseReview} from '../../public/OmniCPQ/ai-learning-contract.mjs';
import {modelProfile} from '../../public/OmniCPQ/model-profiles.mjs';
import {WORK_MODES} from '../../public/OmniCPQ/work-modes.mjs';
const BASE='https://www.mdlxdcc.org/.netlify/functions/omnicpq-assistant?omnicpq_learning=control-v1';
const context={site:{name:'mdlxdcc'},deploy:{context:'production',id:'SYNTHETIC'}};
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(extra={}){
 const map=new Map(),trace=[],calls=[];let role='owner',who='SYNTHETIC_OWNER',time=10000,stores=0;
 const store={get:async k=>{trace.push(['get',k]);return map.has(k)?structuredClone(map.get(k)):null;},put:async(k,v)=>{trace.push(['create-only',k]);if(map.has(k))return false;map.set(k,structuredClone(v));return true;}};
 const payloadFactory=request=>({model:modelProfile(request.profile).model,reasoning:{effort:modelProfile(request.profile).reasoning},instructions:'FIXED_SYNTHETIC_ONLY',input:[{role:'user',content:[{type:'input_text',text:request.message}]}],max_output_tokens:6000,store:false,service_tier:'default',stream:true});
 const transport=async({payload,onText,onIdentity})=>{calls.push(structuredClone(payload));const grader=payload.reasoning.effort==='max';
  const c=AI_CASES.find(x=>payload.input[0].content[0].text.includes(x.prompt));
  const identity={model:payload.model,reasoning:payload.reasoning.effort};onIdentity(identity);onText(JSON.stringify(grader?{verdict:'PASS'}:{decision:c?.expected||'UNKNOWN'}));return {...identity,status:'complete',usage:{input_tokens:20,output_tokens:10}};
 };
 const deps={auth:async()=>{if(role==='anonymous')throw Object.assign(Error(),{code:'AUTH_REQUIRED',status:401});return {id:who,role};},storeFactory:async()=>{stores++;return store;},transport,payloadFactory,apiEnabled:true,now:()=>time,...extra};
 const handler=makeLearningHandler(deps);
 const request=(body,options={})=>new Request(options.url||BASE,{method:options.method||'POST',headers:{'content-type':'application/json',origin:'https://www.mdlxdcc.org',...options.headers},...(options.method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),signal:options.signal});
 async function send(body,options={}){
  const response=await handler(request(body,options),context);
  const text=await response.text();
  if(response.headers.get('content-type').startsWith('text/event-stream')){
   const terminal=text.split('\n\n').filter(Boolean).map(x=>JSON.parse(x.slice(6))).find(x=>x.type==='result'||x.type==='error');
   return {response,data:terminal,text};
  }return {response,data:JSON.parse(text),text};
 }
 const begin=async(kind='code',fields={})=>{const runId=randomUUID();const r=await send({action:'start',runId,kind,profile:'careful',maxTests:6,minutes:10,budgetNanoUSD:kind==='api'?1e9:0,ackCost:kind==='api',...fields});return {runId,...r};};
 return {map,trace,calls,store,deps,handler,request,send,begin,get stores(){return stores;},setRole:r=>role=r,setWho:w=>who=w,setTime:t=>time=t};
}
test('AI_LEARNING sixth mode is in the existing ordered host; previous five and aliases remain',()=>{
 assert.deepEqual(WORK_MODES.map(x=>x.short),['Vodič','Zahteve','Modeliranje','OmniCPQ','Testiranje','AI učenje']);
 assert.equal(WORK_MODES[5].ownerOnly,true);
});
test('AI_LEARNING real pure helper checks execute six scoped synthetic contracts',()=>{
 assert.equal(CODE_CASES.length,6);
 for(const c of CODE_CASES)assert.equal(runCodeCase(c.id).status,'PASS',c.id);
});
test('AI_LEARNING discriminator is closed and mixed demo/foreign routes are invalid',()=>{
 assert.equal(learningRoute(BASE),'LEARNING');assert.equal(learningRoute('https://www.mdlxdcc.org/x'),null);
 for(const url of [BASE+'&omnicpq_demo=local-v1',BASE+'&extra=1',BASE.replace('control-v1','other'),BASE.replace('/omnicpq-assistant','/other')])assert.equal(learningRoute(url),'INVALID'); 
});
test('AI_LEARNING every operation denies demo visitor and anonymous before storage or model',async()=>{
 const f=fixture();
 for(const role of ['demo','visitor','anonymous']){
  f.setRole(role);
  for(const action of ['start','status','step','pause','resume','stop','export']){
   const r=await f.send({action,runId:randomUUID(),role:'owner',email:'SYNTHETIC_BYPASS'});
   assert([401,403].includes(r.response.status));assert.equal(f.stores,0);assert.equal(f.calls.length,0);
  }
  const r=await f.send(null,{method:'GET'});assert([401,403].includes(r.response.status));
 }
});
test('AI_LEARNING forged fields images history and invalid budgets reject before storage',async()=>{
 for(const extra of [{role:'owner'},{context:{text:'SYNTHETIC_PRIVATE_MARKER'}},{snapshot:'SYNTHETIC_IMAGE'},{history:[]},{budgetNanoUSD:1e9+1},{minutes:61},{maxTests:true},{profile:'invented'}]){
  const f=fixture();const r=await f.begin('code',extra);assert.notEqual(r.response.status,200);assert.equal(f.stores,0);assert.equal(f.calls.length,0);assert(!r.text.includes('SYNTHETIC_PRIVATE_MARKER'));
 }
});
test('AI_LEARNING cross-origin and oversized payload cannot open a store',async()=>{
 const f=fixture();
 assert.equal((await f.send({action:'status',runId:randomUUID()},{headers:{origin:'https://foreign.invalid'}})).response.status,403);
 assert.equal((await f.send('x'.repeat(4097))).response.status,413);
 assert.equal(f.stores,0);
});
test('AI_LEARNING start and controls do not call a provider; synthetic run closes real helper results',async()=>{
 const f=fixture(),s=await f.begin();assert.equal(s.data.state.counts.NOT_RUN,6);let state=s.data.state;
 for(let i=0;i<6;i++){const r=await f.send({action:'step',runId:s.runId,revision:state.revision});assert.equal(r.data.ok,true);state=r.data.state;}
 assert.equal(state.status,'COMPLETE');assert.equal(state.counts.PASS,6);assert.equal(state.counts.NOT_RUN,0);assert.equal(state.reservedCalls,0);assert.equal(state.reservedNanoUSD,0);assert.equal(f.calls.length,0);
 assert.equal((await f.send({action:'step',runId:s.runId,revision:state.revision})).response.status,409);
});
test('AI_LEARNING pause resume export and new handler restore persisted run without replay',async()=>{
 const f=fixture(),s=await f.begin();let r=await f.send({action:'pause',runId:s.runId,revision:0});assert.equal(r.data.state.status,'PAUSED');
 assert.equal((await f.send({action:'step',runId:s.runId,revision:1})).response.status,409);
 const restored=makeLearningHandler(f.deps),req=f.request({action:'export',runId:s.runId});const rr=await restored(req,context);const data=await rr.json();
 assert.equal(data.report.status,'PAUSED');assert.equal(data.report.automaticInstallation,false);assert.equal(data.report.actualCPQ,'NOT_RUN');
 r=await f.send({action:'resume',runId:s.runId,revision:1});assert.equal(r.data.state.status,'RUNNING');
 assert.equal(f.calls.length,0);
});
test('AI_LEARNING old revision and repeated start never overwrite immutable records',async()=>{
 const f=fixture(),s=await f.begin();const before=structuredClone([...f.map]);
 assert.equal((await f.send({action:'start',runId:s.runId,kind:'code',profile:'careful',maxTests:6,minutes:10,budgetNanoUSD:0})).response.status,409);
 assert.deepEqual([...f.map],before);
 await f.send({action:'pause',runId:s.runId,revision:0});
 assert.equal((await f.send({action:'resume',runId:s.runId,revision:0})).response.status,409);assert.equal(f.calls.length,0);
});
test('AI_LEARNING owner binding and version binding prevent adopting another or older run',async()=>{
 const f=fixture(),s=await f.begin();f.setWho('OTHER_SYNTHETIC_OWNER');
 assert.equal((await f.send({action:'status',runId:s.runId})).response.status,404);f.setWho('SYNTHETIC_OWNER');
 const key=[...f.map.keys()].find(k=>k.endsWith('/header'));f.map.get(key).appVersion='OLD_SYNTHETIC';
 const r=await f.send({action:'status',runId:s.runId});assert.equal(r.data.state.status,'BLOCKED');assert.equal(r.data.state.reason,'LEARNING_VERSION_CHANGED');assert.equal(f.calls.length,0);
});
test('AI_LEARNING duration cap and tiny API budget hold before provider dispatch',async()=>{
 const f=fixture(),s=await f.begin('api',{budgetNanoUSD:1,maxTests:1});
 assert.equal((await f.send({action:'step',runId:s.runId,revision:0})).data.error.code,'LEARNING_BUDGET');assert.equal(f.calls.length,0);
 f.setTime(610000);assert.equal((await f.send({action:'step',runId:s.runId,revision:0})).data.error.code,'LEARNING_TIME');
});
test('AI_LEARNING fixed model pair records separate identity usage and strict deterministic verdict',async()=>{
 const f=fixture(),s=await f.begin('api',{maxTests:1});const r=await f.send({action:'step',runId:s.runId,revision:0});
 assert.equal(r.data.state.status,'COMPLETE');assert.equal(r.data.state.counts.PASS,1);assert.equal(f.calls.length,2);
 assert.equal(f.calls[0].reasoning.effort,'high');assert.equal(f.calls[1].model,'gpt-6.1-terra');assert.equal(f.calls[1].reasoning.effort,'max');
 assert.equal(r.data.state.results[0].calls.length,2);assert(r.data.state.reservedNanoUSD>0);assert.equal(r.data.state.actualCPQ,'NOT_RUN');
});
test('AI_LEARNING model claim does not replace deterministic oracle; untrusted outputs are not exported',async()=>{
 assert.equal(gradeAICase('empty-panel','{"decision":"EMPTY"}','{"verdict":"PASS"}').status,'FAIL');
 assert.equal(parseDecision('{"decision":"SYNTHETIC_SECRET_MARKER"}'),'INVALID');assert.equal(parseReview('{"verdict":"PASS","extra":"SYNTHETIC_SECRET_MARKER"}'),'UNKNOWN');
 const f=fixture({transport:async({payload,onText})=>{onText(payload.reasoning.effort==='max'?'{"verdict":"PASS"}':'{"decision":"SYNTHETIC_SECRET_MARKER"}');return {model:payload.model,reasoning:payload.reasoning.effort,status:'complete',usage:null};}});
 const s=await f.begin('api',{maxTests:1});const r=await f.send({action:'step',runId:s.runId,revision:0});assert.equal(r.data.state.counts.FAIL,1);assert.equal(r.data.state.proposals[0].status,'PROPOSED_NOT_INSTALLED');assert(!r.text.includes('SYNTHETIC_SECRET_MARKER'));
});
test('AI_LEARNING wrong model identity blocks and never falls back',async()=>{
 let calls=0;const f=fixture({transport:async({onText})=>{calls++;onText('{"decision":"UNKNOWN"}');return {model:'WRONG_MODEL_SYNTHETIC_SECRET',reasoning:'high',status:'complete'};}});
 const s=await f.begin('api',{maxTests:1});const r=await f.send({action:'step',runId:s.runId,revision:0});
 assert.equal(calls,1);assert.equal(r.data.state.status,'BLOCKED');assert(!r.text.includes('WRONG_MODEL_SYNTHETIC_SECRET'));
});
test('AI_LEARNING STOP is terminal across handlers; late first response cannot dispatch reviewer',async()=>{
 let release,started;const gate=new Promise(r=>started=r);let calls=0;
 const f=fixture({transport:async({payload,onText})=>{calls++;started();await new Promise(r=>release=r);onText('{"decision":"UNKNOWN"}');return {model:payload.model,reasoning:payload.reasoning.effort,status:'complete'};}});
 const s=await f.begin('api',{maxTests:1});
 const pending=f.send({action:'step',runId:s.runId,revision:0});await gate;
 const stop=await f.send({action:'stop',runId:s.runId});assert.equal(stop.data.state.status,'STOPPED');release();
 const r=await pending;assert.equal(r.data.state.status,'STOPPED');assert.equal(calls,1);
 assert.equal((await f.send({action:'resume',runId:s.runId,revision:r.data.state.revision})).data.error.code,'LEARNING_STOPPED');
});
test('AI_LEARNING simultaneous step requests dispatch one pair only',async()=>{
 const f=fixture(),s=await f.begin('api',{maxTests:1});const rs=await Promise.all([f.send({action:'step',runId:s.runId,revision:0}),f.send({action:'step',runId:s.runId,revision:0})]);
 assert.equal(rs.filter(x=>x.response.status===409).length,1);assert.equal(f.calls.length,2);
});
test('AI_LEARNING missing receipt never replays spent attempt or treats unknown as PASS',async()=>{
 const f=fixture(),s=await f.begin('api',{maxTests:2});await f.send({action:'step',runId:s.runId,revision:0});const receipt=[...f.map.keys()].find(k=>k.includes('/receipt/'));f.map.delete(receipt);
 const before=f.calls.length,r=await f.send({action:'step',runId:s.runId,revision:1});assert.equal(r.data.error.code,'LEARNING_UNCERTAIN');assert.equal(f.calls.length,before);
 const state=(await f.send({action:'status',runId:s.runId})).data.state;assert.equal(state.pending,true);assert.equal(state.counts.PASS,0);
});
test('AI_LEARNING absent API and unacknowledged spend cannot start a paid run',async()=>{
 const f=fixture({apiEnabled:false});assert.equal((await f.begin('api')).data.error.code,'AI_UNAVAILABLE');assert.equal(f.stores,0);
 const g=fixture();assert.equal((await g.begin('api',{ackCost:false})).data.error.code,'LEARNING_BUDGET');assert.equal(g.calls.length,0);assert.equal(g.stores,0);
});
test('AI_LEARNING public request contract and private finite report omit business context',async()=>{
 const s=await readFile(new URL('../../public/OmniCPQ/ai-learning.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/captureFrame|readBrowserObservation|browserBridge\./);assert.match(s,/PROPOSED_ONLY|PROPOSED_NOT_INSTALLED|sprejetja/);
 const p=learningPayloadFactory((knowledge,request)=>({knowledge,request}))({mode:'work'});assert.equal(p.knowledge.sources.length,0);assert.match(p.knowledge.text,/izmišljeni/);
 const html=await readFile(new URL('../../public/OmniCPQ/index.html',import.meta.url),'utf8');assert.match(html,/id="ai-learning-panel"/);assert.match(html,/omogoča|izmišljene/);
});
let JSDOM;try{({JSDOM}=await import('jsdom'));}catch{}
test('AI_LEARNING actual integrated panel starts synthetic run, exports and keeps main draft intact',{skip:!JSDOM&&'jsdom is available in required CI; not installed locally'},async()=>{
 const {createLearningUI}=await import('../../public/OmniCPQ/ai-learning.mjs');
 const dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:'https://www.mdlxdcc.org/omnicpq/'}),w=dom.window,$=id=>w.document.getElementById(id);const f=fixture();let access=true;
 w.fetch=async(url,opts={})=>f.handler(new Request(new URL(url,BASE),{method:opts.method||'GET',headers:opts.headers,...(opts.body?{body:opts.body}:{}),signal:opts.signal}),context);
 $('message').value='SYNTHETIC_KEEP_DRAFT';
 const ui=createLearningUI({document:w.document,window:w,authorized:()=>access,account:()=> 'SYNTHETIC_OWNER'});ui.setAccess(true);await ui.open();await ui.start();
 assert.equal(ui.state.status,'COMPLETE');assert.equal(ui.state.counts.PASS,6);assert.equal(f.calls.length,0);assert.equal($('message').value,'SYNTHETIC_KEEP_DRAFT');assert.equal($('ai-learning-panel').hidden,false);
 access=false;ui.setAccess(false);assert.equal($('ai-learning-panel').hidden,true);assert.equal(ui.state,null);dom.window.close();
});

test('AI_LEARNING expired owner between model roles prevents the second dispatch',async()=>{
 let f,calls=0;
 f=fixture({transport:async({payload,onText})=>{calls++;onText('{"decision":"UNKNOWN"}');f.setRole('demo');return {model:payload.model,reasoning:payload.reasoning.effort,status:'complete',usage:null};}});
 const s=await f.begin('api',{maxTests:1});const r=await f.send({action:'step',runId:s.runId,revision:0});assert.equal(calls,1);
 assert.equal(r.data.error.code,'OWNER_REQUIRED');assert.equal(r.data.state,undefined);
 assert.equal((await f.send({action:'export',runId:s.runId})).response.status,403);
});
test('AI_LEARNING pause during an authorized pair finishes that pair but blocks the next test',async()=>{
 let release,entered;const gate=new Promise(r=>entered=r);let n=0;
 const f=fixture({transport:async({payload,onText})=>{n++;if(n===1){entered();await new Promise(r=>release=r);}onText(n===1?'{"decision":"UNKNOWN"}':'{"verdict":"PASS"}');return {model:payload.model,reasoning:payload.reasoning.effort,status:'complete',usage:{input_tokens:10,output_tokens:5}};}});
 const s=await f.begin('api',{maxTests:2});const pending=f.send({action:'step',runId:s.runId,revision:0});await gate;
 const paused=await f.send({action:'pause',runId:s.runId,revision:1});assert.equal(paused.data.state.status,'PAUSED');release();
 const result=await pending;assert.equal(result.data.state.status,'PAUSED');assert.equal(n,2);
 assert.equal((await f.send({action:'step',runId:s.runId,revision:2})).data.error.code,'LEARNING_PAUSED');
});
test('AI_LEARNING request abort retains reserved attempt and no reviewer or replay',async()=>{
 let began;const gate=new Promise(r=>began=r);let calls=0;
 const f=fixture({transport:async({signal})=>{calls++;began();await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error(),{code:'CANCELLED'})),{once:true}));}});
 const s=await f.begin('api',{maxTests:1}),c=new AbortController();
 const pending=f.send({action:'step',runId:s.runId,revision:0},{signal:c.signal});await gate;c.abort();
 const r=await pending;assert.equal(calls,1);assert.equal(r.data.state.status,'BLOCKED');assert(r.data.state.reservedNanoUSD>0);
 assert.equal((await f.send({action:'step',runId:s.runId,revision:1})).data.error.code,'LEARNING_UNCERTAIN');assert.equal(calls,1);
});

test('AI_LEARNING lost owner receives no private result after a started request',async()=>{
 let f;f=fixture({transport:async({payload,onText})=>{onText('{"decision":"UNKNOWN"}');f.setRole('demo');return {model:payload.model,reasoning:payload.reasoning.effort,status:'complete',usage:null};}});
 const s=await f.begin('api',{maxTests:1}),r=await f.send({action:'step',runId:s.runId,revision:0});
 assert.equal(r.data.ok,false);assert.equal(r.data.error.code,'OWNER_REQUIRED');assert.equal(r.data.state,undefined);
});

async function pureUIFixture(backend,fetchHook){
 const {createLearningUI}=await import('../../public/OmniCPQ/ai-learning.mjs');
 const nodes=new Map(),listeners=new Map(),saved=new Map(),defaults={'learning-kind':'code','learning-tests':'6','learning-minutes':'10','learning-profile':'careful','learning-budget':'1000000000'};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:defaults[id]||'',checked:false,hidden:true,disabled:false,textContent:'',children:[],append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},click(){}});return nodes.get(id);};
 const doc={getElementById:node,createElement:()=>node(randomUUID())};
 const win={localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},addEventListener:(n,f)=>listeners.set(n,f),setTimeout,URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}},
  fetch:async(url,opts={})=>{if(fetchHook)await fetchHook(opts);return backend.handler(new Request(new URL(url,BASE),{method:opts.method||'GET',headers:opts.headers,...(opts.body?{body:opts.body}:{}),signal:opts.signal}),context);}};
 const ui=createLearningUI({document:doc,window:win,authorized:()=>true,account:()=> 'SYNTHETIC_OWNER'});ui.setAccess(true);await ui.open();return {ui,node,saved};
}
test('AI_LEARNING actual UI coalesces double Start into one persisted run',async()=>{
 const f=fixture();let releases=[],seen,starts=0;const gate=new Promise(r=>seen=r);
 const h=await pureUIFixture(f,async opts=>{if(opts.method==='POST'&&JSON.parse(opts.body).action==='start'){starts++;seen();await new Promise(r=>releases.push(r));}});
 const a=h.ui.start();await gate;const b=h.ui.start();await flush();const observedStarts=starts;for(const release of releases)release();await Promise.all([a,b]);assert.equal(observedStarts,1);
assert.equal(h.ui.state.status,'COMPLETE');
});
test('AI_LEARNING actual UI pause reconciles the in-flight revision and persists pause',async()=>{
 let release,entered,n=0;const gate=new Promise(r=>entered=r);
 const f=fixture({transport:async({payload,onText})=>{n++;if(n===1){entered();await new Promise(r=>release=r);}onText(n===1?'{"decision":"UNKNOWN"}':'{"verdict":"PASS"}');return {model:payload.model,reasoning:payload.reasoning.effort,status:'complete',usage:{input_tokens:10,output_tokens:5}};}});
 const h=await pureUIFixture(f);h.node('learning-kind').value='api';h.node('learning-kind').onchange();h.node('learning-tests').value='2';h.node('learning-cost-ack').checked=true;
 const running=h.ui.start();await gate;await h.ui.pause();const observedStatus=h.ui.state.status;release();await running;assert.equal(observedStatus,'PAUSED');assert.equal(n,2);assert.equal(h.ui.state.status,'PAUSED');
});

test('AI_LEARNING owner recheck failure at start returns only a finite denial',async()=>{
 let reads=0;const f=fixture({auth:async()=>({id:'SYNTHETIC_OWNER',role:++reads===1?'owner':'demo'})});
 const r=await f.begin();assert.equal(r.response.status,403);assert.equal(r.data.error.code,'OWNER_REQUIRED');assert.equal(r.data.state,undefined);assert.equal(f.calls.length,0);
});

test('AI_LEARNING leaving the mode invalidates a late capability response',async()=>{
 const f=fixture();let gate,entered;let armed=false;const ready=new Promise(r=>entered=r);
 const h=await pureUIFixture(f,async opts=>{if(armed&&opts.method!=='POST'){entered();await new Promise(r=>gate=r);}});
 const before=h.node('learning-status').textContent;armed=true;
 const opening=h.ui.open();await ready;h.ui.hide();gate();await opening;
 assert.equal(h.node('ai-learning-panel').hidden,true);assert.equal(h.node('learning-status').textContent,before);assert.equal(f.calls.length,0);
});
