import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {MODEL_PROFILES as profiles,DEFAULT_PROFILE,modelProfile} from '../../public/OmniCPQ/model-profiles.mjs';
import {makeDemoHandler} from '../../functions/lib/omnicpq/demo-assistant.mjs';
import {makeDemoRequest,projectDemoObservation,validateDemoObservation,DEMO_EXTENSION_ID,DEMO_PROTOCOL,DEMO_PRODUCT,protection} from '../../public/OmniCPQ/extension-demo/privacy.mjs';

// Actual public function bodies, isolated from native credentials/private KB and real HTTP.
// VM is a test fixture, not a claimed production security sandbox.
const backend=await readFile(new URL('../../functions/omnicpq-assistant.mjs',import.meta.url),'utf8');
const provider=await readFile(new URL('../../functions/lib/omnicpq/provider.mjs',import.meta.url),'utf8');
const problem=(code,status=503)=>Object.assign(Error(code),{code,status});
const deny=()=>{throw Error('SYNTHETIC_NATIVE_DEPENDENCY_DENIED');};
function personalFactory(){
 let source=backend.replace(/\r\n/g,'\n');
 const imports=source.match(/^import [^\n]+;\n/gm);assert.equal(imports.length,11);
 source=source.replace(/^import [^\n]+;\n/gm,'');
 const boundary='\nconst requestGate={seen:new Map(),active:new Set()};';assert.equal(source.split(boundary).length,2);
 source=source.split(boundary)[0].replaceAll('export function ','function ');
 assert.doesNotMatch(source,/\bimport\s*(?:\(|[{'*])/);
 const context=vm.createContext({TextEncoder,TextDecoder,Buffer,Response,URL,ReadableStream,AbortController,performance,setTimeout,clearTimeout,randomUUID,createHash,
  profiles,DEFAULT_PROFILE,modelProfile,error:problem,APP_VERSION:'SYNTHETIC',SKILL:{},ADAPTER_DELTA:'SYNTHETIC',makeDeliveryMetadata:()=>({}),
  authenticateOmni:deny,loadKnowledge:deny,callOpenAI:deny,demoBudget:deny,makeDemoHandler:deny,
  instructions:()=> 'SYNTHETIC_PUBLIC_INSTRUCTIONS',validateBrowser:()=>null,starterMetadata:[],allowedStarter:()=>false,
  normalizeMode:v=>v==='work'?'work':null,normalizeWorkspace:v=>v,CONTEXT_FIELDS:{},
  process:{env:new Proxy({},{get:deny})},Netlify:{env:{get:deny}},console:{warn(){}}});
 vm.runInContext(source+'\n;globalThis.make=makeHandler;globalThis.route=assistantRoute;',context);context.make.route=context.route;return context.make;
}
function providerFactory(){
 const header="import { error } from './identity.mjs';\n";assert.ok(provider.startsWith(header));
 const source=provider.slice(header.length).replaceAll('export async ','async ');
 const scope=vm.createContext({TextDecoder,error:problem,Netlify:{env:{get:name=>{assert.equal(name,'OPENAI_API_KEY');return 'SYNTHETIC_DUMMY_NOT_A_CREDENTIAL';}}},process:{env:new Proxy({},{get:deny})},fetch:deny});
 vm.runInContext(source+'\n;globalThis.call=callOpenAI;',scope);return scope.call;
}
const actor={id:'invented-owner',role:'owner'};
const knowledge={skill:{},services:[],canonicalPrompts:[],retrieve:async()=>({sources:[],service:null}),validateLifecycleAnswer:()=>({status:'SYNTHETIC'})};
function deps(extra={}){return {enabled:true,accessFactory:async()=>actor,knowledgeFactory:async()=>knowledge,budgetFactory:()=>({reserve:async()=>({synthetic:true}),settle:async()=>({synthetic:true})}),...extra};}
function personalRequest(extra={},signal){return new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'SYNTHETIC_PUBLIC_TASK',mode:'work',clientRequestId:randomUUID(),...extra}),signal});}
function demoData(){
 const wire=projectDemoObservation({schema:'omnicpq.gui.observation.v2',observationId:randomUUID(),revision:'a'.repeat(64),capturedAt:new Date().toISOString(),url:'https://cpq-stg.apps.test-ocp.ts.telekom.si/sl/order',scope:'order',documentKey:'INVENTED_TEST_ONLY',navigationLocked:false,dialogOpen:false,controls:[]}).wire;
 return makeDemoRequest({task:'READ_CURRENT',observation:wire,handshake:{ok:true,protocol:DEMO_PROTOCOL,extensionId:DEMO_EXTENSION_ID,product:DEMO_PRODUCT,version:'1.0.0',token:randomUUID(),protection:protection()}});
}
const demoRequest=data=>new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-demo-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const events=async response=>(await response.text()).trim().split('\n\n').filter(Boolean).map(x=>JSON.parse(x.slice(6)));
for(const [label,id,model,effort]of [['default',undefined,'gpt-6.1-terra','high'],['careful','careful','gpt-6.1-terra','high'],['fast','fast','gpt-6-luna','medium']]){
 test('actual personal payload '+label+' uses exact fixed model and effort',async()=>{
  let calls=0;const handler=personalFactory()(deps({transport:async({payload,onText,onIdentity})=>{calls++;assert.equal(payload.model,model);assert.equal(payload.reasoning.effort,effort);assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,6000);assert.equal(payload.service_tier,'default');onIdentity({model,reasoning:effort});onText('SYNTHETIC');return {model,reasoning:effort,status:'complete',usage:{input_tokens:10,output_tokens:2}};}}));
  const stream=await events(await handler(personalRequest(id===undefined?{}:{profile:id})));
  assert.equal(calls,1);assert.equal(stream.filter(e=>e.type==='done').length,1);assert.equal(stream[0].configuredModel,model);
 });
}
test('arbitrary model, low profile, Auto and object profile cause zero model calls',async()=>{
 let calls=0;const handler=personalFactory()(deps({transport:async()=>{calls++;throw Error();}}));
 for(const body of [{model:'gpt-6-luna'},{profile:'low'},{profile:'auto'},{profile:{toString:'fast'}},{reasoning:'low'}])assert.equal((await handler(personalRequest(body))).status,400);
 assert.equal(calls,0);
});
test('both route handlers share active and duplicate guards without increasing spending scope',async()=>{
 const requestGate={seen:new Map(),active:new Set()};let finish,started;const begin=new Promise(r=>{started=r;});
 const transport=async({payload,onText})=>{started();await new Promise(r=>{finish=r;});onText('SYNTHETIC');return {model:payload.model,status:'complete',usage:null};};
 const personal=personalFactory()(deps({requestGate,transport})),demo=makeDemoHandler(deps({requestGate,transport}));
 const data=demoData(),first=await personal(personalRequest({clientRequestId:data.clientRequestId}));
 await begin;
 const blocked=await demo(demoRequest({...data,clientRequestId:randomUUID()}));assert.equal(blocked.status,409);assert.equal((await blocked.json()).error.code,'REQUEST_IN_PROGRESS');
 finish();await events(first);
 const duplicate=await demo(demoRequest(data));assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).error.code,'DUPLICATE_REQUEST');
});
const sseResponse=list=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(list.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')));c.close();}}),{headers:{'x-request-id':'synthetic'}});
const payload={model:'gpt-6.1-terra',reasoning:{effort:'high'},input:[],stream:true,store:false,max_output_tokens:6000};
const identity=(model=payload.model,effort='high',status)=>({type:status?'response.'+status:'response.created',response:{id:'synthetic',model,reasoning:{effort},...(status?{status,usage:{input_tokens:5,output_tokens:3,output_tokens_details:{reasoning_tokens:2}}}:{})}});
test('actual provider returns observed Terra High and usage through intercepted one-request transport',async()=>{
 let n=0;const ids=[],texts=[];
 const result=await providerFactory()({payload,signal:new AbortController().signal,onIdentity:x=>ids.push(x),onText:x=>texts.push(x),fetcher:async(url,init)=>{n++;assert.equal(url,'https://api.openai.com/v1/responses');assert.deepEqual(JSON.parse(init.body),payload);return sseResponse([identity(),{type:'response.output_text.delta',delta:'SYNTHETIC'},identity(payload.model,'high','completed')]);}});
 assert.equal(n,1);assert.equal(result.model,payload.model);assert.equal(result.reasoning,'high');assert.equal(result.usage.output_tokens_details.reasoning_tokens,2);assert.equal(ids.length,2);assert.deepEqual(texts,['SYNTHETIC']);
});
for(const [model,effort,code]of [['gpt-6-luna','high','MODEL_IDENTITY_MISMATCH'],['gpt-6.1-terra','low','MODEL_REASONING_MISMATCH']]){
 test('returned '+code+' is blocked before text, without fallback',async()=>{
  let n=0,text=0;
  await assert.rejects(providerFactory()({payload,signal:new AbortController().signal,onIdentity:()=>{},onText:()=>text++,fetcher:async()=>{n++;return sseResponse([identity(model,effort),{type:'response.output_text.delta',delta:'SHOULD_NOT_APPEAR'}]);}}),e=>e.code===code);
  assert.equal(n,1);assert.equal(text,0);
 });
}
for(const [status,code]of [[400,'MODEL_PROFILE_UNAVAILABLE'],[404,'MODEL_UNAVAILABLE'],[422,'MODEL_PROFILE_UNAVAILABLE'],[429,'RATE_LIMITED']]){
 test('provider HTTP '+status+' gives finite '+code+' with no raw error/fallback',async()=>{
  let n=0,reads=0;const response=new Response('INVENTED_PRIVATE_ERROR',{status});response.text=()=>{reads++;throw Error();};
  await assert.rejects(providerFactory()({payload,signal:new AbortController().signal,onIdentity:()=>{},onText:()=>{},fetcher:async()=>{n++;return response;}}),e=>e.code===code&&e.message===code);
  assert.equal(n,1);assert.equal(reads,0);
 });
}
for(const mode of ['timeout','abort']){
 test('personal '+mode+' emits one terminal and settles reservation without a second call',async()=>{
  let calls=0,settles=0,start;const begun=new Promise(r=>{start=r;});
  const controller=new AbortController();
  const handler=personalFactory()(deps({timeoutMs:mode==='timeout'?15:1000,budgetFactory:()=>({reserve:async()=>({id:'synthetic'}),settle:async()=>{settles++;}}),transport:async({signal,onText})=>{calls++;onText('SYNTHETIC_PART');start();await new Promise((_,reject)=>{signal.addEventListener('abort',()=>reject(problem('CANCELLED')),{once:true});});}}));
  const response=await handler(personalRequest({},controller.signal));await begun;if(mode==='abort')controller.abort();
  const messages=await events(response),terminal=messages.filter(x=>['done','error'].includes(x.type));
  assert.equal(terminal.length,1);assert.equal(terminal[0].code,mode==='timeout'?'TIMEOUT':'CANCELLED');assert.equal(calls,1);assert.equal(settles,1);
 });
}
test('closed datetime and control ids reject covert text/callbacks before egress',()=>{
 const data=demoData();data.observation.capturedAt=new Date().toUTCString();assert.throws(()=>validateDemoObservation(data.observation),e=>e.code==='DEMO_OBSERVATION_STALE');
 let calls=0;assert.throws(()=>projectDemoObservation({schema:'omnicpq.gui.observation.v2',observationId:randomUUID(),revision:'a'.repeat(64),capturedAt:new Date().toISOString(),url:'https://cpq-stg.apps.test-ocp.ts.telekom.si/sl/order',scope:'order',navigationLocked:false,dialogOpen:false,controls:[{id:{toString(){calls++;return 'c1';}},label:'Postavke',kind:'tab',enabled:true,visibleInViewport:true}]}));assert.equal(calls,0);
});
test('production dispatch uses one original rate limit and the same request gate',()=>{
 assert.match(backend,/makeHandler\(\{requestGate\}\),demoHandler=makeDemoHandler\(\{requestGate\}\)/);
 assert.match(backend,/windowLimit: 12, windowSize: 60/);
 assert.doesNotMatch(backend,/config\s*=\s*\{\s*path:/);
 assert.match(backend,/assistantRoute\(req.url\)/);
});

test('actual dispatcher distinguishes the fixed demo URL and rejects bad/obsolete aliases',()=>{
 const route=personalFactory().route,base='https://www.mdlxdcc.org/.netlify/functions/omnicpq-assistant';
 assert.equal(route(base),'PERSONAL');
 assert.equal(route(base+'?omnicpq_demo=local-v1'),'DEMO');
 for(const value of [base+'?omnicpq_demo=wrong',base+'?omnicpq_demo=local-v1&extra=1',base+'?omnicpq_demo=local-v1&omnicpq_demo=local-v1','https://www.mdlxdcc.org/wrong?omnicpq_demo=local-v1','https://www.mdlxdcc.org/.netlify/functions/omnicpq-demo-assistant','not a URL'])assert.equal(route(value),'INVALID_DEMO');
});
