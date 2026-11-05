import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DEMO_PROTOCOL,DEMO_PRODUCT,DEMO_EXTENSION_ID,DEMO_POLICY,DEMO_TASKS,protection,projectDemoObservation,validateDemoObservation,validateDemoRequest,makeDemoRequest,parseDemoAction} from '../../public/OmniCPQ/extension-demo/privacy.mjs';
import {makeDemoBridgeHandler} from '../../public/OmniCPQ/extension-demo/worker.mjs';
import {makeGuiBridgeHandler} from '../../public/OmniCPQ/extension/worker-v2.mjs';
import {makeDemoClient,DEMO_API} from '../../public/OmniCPQ/demo/app.mjs';
import {makeDemoHandler,buildDemoPayload} from '../../functions/lib/omnicpq/demo-assistant.mjs';
import {MODEL_PROFILES,modelProfile,modelChargeCeilings} from '../../public/OmniCPQ/model-profiles.mjs';
import {maximumCharge,demoBudget} from '../../functions/lib/omnicpq/runtime.mjs';

const STAGE='https://cpq-stg.apps.test-ocp.ts.telekom.si';
const DEMO='https://www.mdlxdcc.org/omnicpq/demo/';
const PERSONAL='https://www.mdlxdcc.org/omnicpq/';
const CANARIES=['Jože Testni','Testna Organizacija','sample@example.invalid','+999 123 456 789','1.234,56 €','OMNI-TEST-99112','256 GB','C:/invented/private','secret_invented_token'];
function rawObservation(){
 return {schema:'omnicpq.gui.observation.v2',observationId:randomUUID(),revision:'a'.repeat(64),capturedAt:new Date().toISOString(),url:STAGE+'/sl/order/details/view/OMNI-TEST-99112?contact=sample@example.invalid',
 title:CANARIES.join(' '),text:CANARIES.join('\n'),scope:'order',documentKey:'OMNI-TEST-99112',navigationLocked:false,dialogOpen:false,
 controls:[{id:'c1',label:'Postavke',kind:'tab',inputType:'',enabled:true,visibleInViewport:true,rect:{x:0,y:0,w:100,h:30,cx:50,cy:15},value:CANARIES[4],href:'/secret?email=sample@example.invalid',group:CANARIES[1]},
 {id:'c2',label:CANARIES[0],kind:'field',inputType:'text',enabled:true,visibleInViewport:true,rect:{x:0,y:30,w:100,h:30,cx:50,cy:45},value:CANARIES[2]},
 {id:'c3',label:'Shrani',kind:'button',inputType:'',enabled:true,visibleInViewport:true,rect:{x:0,y:60,w:100,h:30,cx:50,cy:75}}],
 paging:{offset:0,limit:180,totalFound:3,hasMore:false,query:''},viewport:{width:800,height:600,scrollX:0,scrollY:0},framePath:'',frames:[],parentContext:CANARIES[1],runtime:{pageVersion:'1.2.7'},capabilities:{allowWrites:false}};
}
function handshake(){return {ok:true,protocol:DEMO_PROTOCOL,extensionId:DEMO_EXTENSION_ID,product:DEMO_PRODUCT,version:'1.0.0',protection:protection(),token:randomUUID()};}
function request(){return makeDemoRequest({task:'READ_CURRENT',profile:'careful',observation:projectDemoObservation(rawObservation()).wire,handshake:handshake()});}
function noCanaries(value){const s=JSON.stringify(value);for(const c of CANARIES)assert.ok(!s.includes(c),'leaked invented canary');}
function chromeFixture({personal=false}={}){
 const id=personal?'emoohebdiggbcppgphmdemdiakdamfnb':DEMO_EXTENSION_ID;
 const url=personal?PERSONAL:DEMO,storage={},calls={pages:0,cdp:[]};
 let raw=rawObservation();
 const api={runtime:{id,getURL:path=>'chrome-extension://'+id+'/'+path},storage:{session:{
  async get(key){return {[key]:structuredClone(storage[key])};},
  async set(value){Object.assign(storage,structuredClone(value));},
  async remove(key){delete storage[key];}
 }},tabs:{async get(id){if(id===1)return {id,url:STAGE+'/sl/order/details/view/OMNI-TEST-99112',incognito:false};if(id===2)return {id,url,incognito:false};throw Error('invented');}},
 scripting:{async executeScript(options){calls.pages++;const cmd=options.args[0];
  if(cmd.type==='observe'){raw={...raw,observationId:randomUUID(),capturedAt:new Date().toISOString()};return [{frameId:0,result:{ok:true,observation:structuredClone(raw)}}];}
  if(cmd.type==='prepare'){
   if(cmd.action.revision!==raw.revision)return [{frameId:0,result:{ok:false,error:'CPQ_SCREEN_CHANGED'}}];
   return [{frameId:0,result:{ok:true,prepared:{label:'Postavke',kind:'tab',risk:'ordinary',visibleInViewport:true,rect:{x:0,y:0,w:100,h:30,cx:50,cy:15}}}}];
  }return [{frameId:0,result:{ok:false,error:'BRIDGE_INVALID_COMMAND'}}];
 }},debugger:{async attach(){},async detach(){},async sendCommand(target,name,params){calls.cdp.push({name,params});if(params.type==='mouseReleased')raw={...raw,revision:'b'.repeat(64)};return {};}}};
 const sender={url,frameId:0,tab:{id:2,incognito:false}};
 const internal={id,url:api.runtime.getURL('popup.html')};
 return {api,sender,internal,calls,storage,setRaw:value=>{raw=value;}};
}
async function paired(){
 const f=chromeFixture(),handle=makeDemoBridgeHandler(f.api),identity=randomUUID();
 assert.equal((await handle({protocol:DEMO_PROTOCOL,type:'status',identity},f.sender)).ok,false);
 const p=await handle({protocol:DEMO_PROTOCOL,type:'pair',cpqTabId:1,assistantTabId:2,scope:'order',allowWrites:false},f.internal,true);
 assert.equal(p.ok,true);
 const h=await handle({protocol:DEMO_PROTOCOL,type:'status',identity},f.sender);
 assert.equal(h.ok,true);
 return {...f,handle,identity,h};
}
function browserRuntime(f){
 return {sendMessage(id,message,callback){assert.equal(id,DEMO_EXTENSION_ID);f.handle(message,f.sender).then(callback);}};
}
function serverFixture(){
 const transported=[],reserved=[],settled=[];
 const handler=makeDemoHandler({enabled:true,accessFactory:async()=>({id:'invented-owner',role:'owner'}),
 budgetFactory:(actor,provider,model)=>({reserve:async p=>{reserved.push({model,p});return null;},settle:async(...v)=>{settled.push(v);return null;}}),
 transport:async({payload,onText,onIdentity})=>{transported.push(payload);onIdentity({model:payload.model,reasoning:payload.reasoning.effort});onText('Dovoljeni podatki so minimizirani.');return {model:payload.model,reasoning:payload.reasoning.effort,usage:{input_tokens:20,output_tokens:10},status:'complete'};}});
 return {handler,transported,reserved,settled};
}
const http=(data,method='POST')=>new Request('https://www.mdlxdcc.org'+DEMO_API,{method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(data)}:{})});

test('closed projection excludes every personal, commercial, URL, attribute and resource canary',()=>{
 const {wire}=projectDemoObservation(rawObservation());noCanaries(wire);assert.equal(wire.prices,'[CENA SKRITA]');assert.deepEqual(wire.controls,[{id:'d1',label:'Postavke',enabled:true}]);assert.equal(wire.documentKey,'NAROCILO_1');
});
test('opaque observation and revision do not reuse original identifiers or source hash',()=>{
 const raw=rawObservation(),one=projectDemoObservation(raw).wire,two=projectDemoObservation(raw).wire;
 assert.notEqual(one.observationId,raw.observationId);assert.notEqual(one.revision,raw.revision);assert.notEqual(one.revision,two.revision);
});
test('consistent document aliases stay local across two observations',()=>{
 const docs=new Map(),raw=rawObservation();const one=projectDemoObservation(raw,docs).wire,two=projectDemoObservation(raw,docs).wire;
 assert.equal(one.documentKey,two.documentKey);assert.equal(docs.get(raw.documentKey),'NAROCILO_1');noCanaries(one);
});
test('Slovenian names, currencies, hidden strings, encoded URLs and unknown labels are omitted',()=>{
 const raw=rawObservation();raw.text+=' Janez Novak; 12.50 USD; 50% popust; sample%40example.invalid';
 raw.controls.push({...raw.controls[0],id:'c4',label:'Postavke Jože Testni'});const wire=projectDemoObservation(raw).wire;assert.equal(wire.controls.length,1);noCanaries(wire);
});
test('unknown top-level observation field blocks',()=>{const raw=rawObservation();raw.unclassified='invented';assert.throws(()=>projectDemoObservation(raw),{code:'DEMO_UNKNOWN_FIELD'});});
test('untrusted getter is not invoked',()=>{let n=0;const raw=rawObservation();Object.defineProperty(raw.controls[0],'label',{get(){n++;return 'Postavke';},enumerable:true});assert.throws(()=>projectDemoObservation(raw));assert.equal(n,0);});
test('PROD and unsupported frame block',()=>{let raw=rawObservation();raw.url='https://cpq.apps.prod-ocp.ts.telekom.si/sl/order';assert.throws(()=>projectDemoObservation(raw));raw=rawObservation();raw.framePath='0';assert.throws(()=>projectDemoObservation(raw),{code:'DEMO_FRAME_BLOCKED'});});
test('stale observation and disabled protection block',()=>{
 const v=request().observation;assert.throws(()=>validateDemoObservation({...v,capturedAt:'2020-01-01T00:00:00Z'}));
 assert.throws(()=>validateDemoObservation({...v,protection:{...v.protection,enabled:false}}),{code:'DEMO_PROTECTION_REQUIRED'});
});
for(const field of ['message','history','snapshot','attachments','diagnostic','telemetry','context','import','model','reasoning']){
 test('outbound extra field '+field+' blocked before forwarding',()=>{const v=request();v[field]=CANARIES.join(' ');assert.throws(()=>validateDemoRequest(v),{code:'DEMO_UNKNOWN_FIELD'});});
}
test('constructor refuses extra image field',()=>{assert.throws(()=>makeDemoRequest({task:'READ_CURRENT',observation:request().observation,handshake:handshake(),snapshot:'invented'}),{code:'DEMO_UNKNOWN_FIELD'});});
test('old extension identity is rejected',()=>{const h=handshake();h.extensionId='emoohebdiggbcppgphmdemdiakdamfnb';assert.throws(()=>makeDemoRequest({task:'READ_CURRENT',observation:request().observation,handshake:h}),{code:'DEMO_BRIDGE_IDENTITY'});});
test('model actions permit only present navigation target; values and writes block',()=>{
 const o=request().observation,a={schema:'omnicpq.demo.action.v1',observationId:o.observationId,revision:o.revision,operation:'navigate',targetId:'d1'};
 assert.equal(parseDemoAction('~~~omnicpq_demo_action\n'+JSON.stringify(a)+'\n~~~',o).targetId,'d1');
 assert.throws(()=>parseDemoAction('~~~omnicpq_demo_action\n'+JSON.stringify({...a,operation:'fill',value:'1 €'})+'\n~~~',o));
});
test('both actual manifest keys give distinct fixed extension identities',async()=>{
 for(const [folder,expected]of [['extension','emoohebdiggbcppgphmdemdiakdamfnb'],['extension-demo',DEMO_EXTENSION_ID]]){
  const m=JSON.parse(await readFile(new URL('../../public/OmniCPQ/'+folder+'/manifest.json',import.meta.url),'utf8'));
  const id=[...createHash('sha256').update(Buffer.from(m.key,'base64')).digest('hex').slice(0,32)].map(c=>'abcdefghijklmnop'[parseInt(c,16)]).join('');assert.equal(id,expected);
 }
});
test('original bridge source stays byte-identical',async()=>{const b=await readFile(new URL('../../public/OmniCPQ/extension/worker-v2.mjs',import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),'37edf58d4713e23ae8facc5a0955764de1679f095f237c5f17b17438502ed4dc');});
test('two installed-code handlers reject cross-page/cross-protocol traffic',async()=>{
 const demo=chromeFixture(),personal=chromeFixture({personal:true});const d=makeDemoBridgeHandler(demo.api),p=makeGuiBridgeHandler(personal.api);
 const a=await d({protocol:'omnicpq.gui.v2',type:'status',identity:randomUUID()},personal.sender);assert.equal(a.ok,false);
 const b=await p({protocol:'omnicpq.gui.v2',type:'status',identity:'personal'},demo.sender);assert.equal(b.ok,false);assert.equal(demo.calls.pages,0);assert.equal(personal.calls.pages,0);
});
test('demo pairing rejects writes; actual protected observation contains no canaries',async()=>{
 const f=await paired();const bad=await f.handle({protocol:DEMO_PROTOCOL,type:'pair',cpqTabId:1,assistantTabId:2,scope:'order',allowWrites:true},f.internal,true);
 assert.equal(bad.error,'DEMO_READ_ONLY');
 const result=await f.handle({protocol:DEMO_PROTOCOL,type:'observe',token:f.h.token},f.sender);
 assert.equal(result.ok,true);noCanaries(result);validateDemoObservation(result.observation);
});
test('local navigation maps to real local target, rechecks and does not type synthetic data',async()=>{
 const f=await paired(),r=await f.handle({protocol:DEMO_PROTOCOL,type:'observe',token:f.h.token},f.sender),o=r.observation;
 const a={schema:'omnicpq.demo.action.v1',observationId:o.observationId,revision:o.revision,operation:'navigate',targetId:'d1',actionId:randomUUID()};
 assert.equal((await f.handle({protocol:DEMO_PROTOCOL,type:'execute',token:f.h.token,action:a,humanApproved:false},f.sender)).error,'DEMO_APPROVAL_REQUIRED');
 const result=await f.handle({protocol:DEMO_PROTOCOL,type:'execute',token:f.h.token,action:a,humanApproved:true},f.sender);
 assert.equal(result.ok,true);noCanaries(result);
 assert.ok(f.calls.cdp.some(c=>c.name==='Input.dispatchMouseEvent'));assert.ok(!f.calls.cdp.some(c=>/insertText|dispatchKey/.test(c.name)));
});
test('worker restart requires fresh observation rather than rescuing old action',async()=>{
 const f=await paired(),r=await f.handle({protocol:DEMO_PROTOCOL,type:'observe',token:f.h.token},f.sender),o=r.observation;
 const again=makeDemoBridgeHandler(f.api),a={schema:'omnicpq.demo.action.v1',observationId:o.observationId,revision:o.revision,operation:'navigate',targetId:'d1',actionId:randomUUID()};
 assert.equal((await again({protocol:DEMO_PROTOCOL,type:'execute',token:f.h.token,action:a,humanApproved:true},f.sender)).error,'DEMO_FRESH_OBSERVATION_REQUIRED');
});
test('browser client sends only fully validated payload over intercepted local HTTP stub',async()=>{
 const f=await paired(),s=serverFixture(),sent=[];
 const client=makeDemoClient({runtime:browserRuntime(f),fetcher:async(url,options)=>{assert.equal(url,DEMO_API);sent.push(JSON.parse(options.body));return s.handler(http(sent.at(-1)));}});
 // Register client fresh identity then re-pair in the same fake browser.
 await assert.rejects(client.connect());
 await f.handle({protocol:DEMO_PROTOCOL,type:'pair',cpqTabId:1,assistantTabId:2,scope:'order',allowWrites:false},f.internal,true);
 await client.connect();await client.ask('READ_CURRENT','careful');
 assert.equal(sent.length,1);noCanaries(sent[0]);validateDemoRequest(sent[0]);assert.equal(s.transported[0].model,'gpt-6.1-terra');assert.equal(s.transported[0].reasoning.effort,'high');noCanaries(s.transported[0]);assert.equal(s.transported[0].input.length,1);assert.equal(s.transported[0].store,false);
});
test('arbitrary manual text produces zero outbound calls',async()=>{
 let calls=0;const c=makeDemoClient({runtime:null,fetcher:async()=>{calls++;throw Error();}});
 await assert.rejects(c.ask(CANARIES.join(' ')),{code:'DEMO_FREE_TEXT_BLOCKED'});assert.equal(calls,0);
});
test('wrong bridge blocks before data POST',async()=>{
 let calls=0;const c=makeDemoClient({runtime:{sendMessage(id,m,cb){cb({...handshake(),extensionId:'emoohebdiggbcppgphmdemdiakdamfnb'});}},fetcher:async()=>{calls++;}});
 await assert.rejects(c.connect());await assert.rejects(c.ask('READ_CURRENT'));assert.equal(calls,0);
});
test('STOP clears proposed actions and requires explicit reconnection',async()=>{
 const f=await paired(),c=makeDemoClient({runtime:browserRuntime(f),fetcher:async()=>{throw Error('not used');}});
 await assert.rejects(c.connect());await f.handle({protocol:DEMO_PROTOCOL,type:'pair',cpqTabId:1,assistantTabId:2,scope:'order',allowWrites:false},f.internal,true);await c.connect();await c.read();await c.stop();assert.equal(c.state().connected,false);assert.equal(c.state().observation,null);await assert.rejects(c.ask('READ_CURRENT'));await c.connect();await c.read();
});
test('fixed distinct model routes and careful default; low and model objects rejected',()=>{
 assert.equal(modelProfile().model,'gpt-6.1-terra');assert.equal(modelProfile('careful').reasoning,'high');assert.equal(modelProfile('fast').model,'gpt-6-luna');assert.equal(modelProfile('fast').reasoning,'medium');
 assert.throws(()=>modelProfile('low'));assert.throws(()=>modelProfile({model:'anything'}));
});
test('model-specific conservative prices preserve token limits and reject unknown model',()=>{
 const x={model:'gpt-6-luna',service_tier:'default',max_output_tokens:6000,input:[]};const luna=maximumCharge(x),terra=maximumCharge({...x,model:'gpt-6.1-terra'});assert.ok(terra>luna);assert.throws(()=>maximumCharge({...x,max_output_tokens:6001}));assert.throws(()=>maximumCharge({...x,model:'anything'}));assert.equal(modelChargeCeilings('gpt-6-luna').input,275);
});
test('server selects fast only by profile, with no tools/images/history or private KB',async()=>{
 const s=serverFixture(),r=request();r.profile='fast';const response=await s.handler(http(r));assert.equal(response.status,200);const text=await response.text();assert.match(text,/"type":"done"/);assert.equal(s.transported[0].model,'gpt-6-luna');assert.equal(s.transported[0].reasoning.effort,'medium');assert.equal(s.transported[0].input.length,1);assert.equal(s.transported[0].tools,undefined);
});
test('invalid protected request never calls model transport',async()=>{
 const s=serverFixture(),r=request();r.history=[{role:'user',content:CANARIES[0]}];const response=await s.handler(http(r));assert.equal(response.status,400);assert.equal(s.transported.length,0);assert.doesNotMatch(await response.text(),/Jože/);
});
test('auth and unknown role fail without model',async()=>{
 const r=request();for(const factory of [async()=>({id:'x',role:'visitor'}),async()=>{throw Object.assign(Error(),{code:'AUTH_REQUIRED',status:401});}]){
  let calls=0;const h=makeDemoHandler({enabled:true,accessFactory:factory,transport:async()=>{calls++;}});assert.ok((await h(http(r))).status>=400);assert.equal(calls,0);
 }
});
test('model unavailability is finite and has no fallback/retry',async()=>{
 let calls=0,settles=0;const h=makeDemoHandler({enabled:true,accessFactory:async()=>({id:'x',role:'demo'}),budgetFactory:()=>({reserve:async()=>({id:'held'}),settle:async()=>{settles++;}}),transport:async()=>{calls++;throw Object.assign(Error('invented private error'),{code:'MODEL_UNAVAILABLE',status:404});}});
 const response=await h(http(request())),text=await response.text();assert.match(text,/"code":"MODEL_UNAVAILABLE"/);assert.doesNotMatch(text,/invented private error/);assert.equal(calls,1);assert.equal(settles,1);
});
test('duplicate request is not retried and stream reaches one terminal',async()=>{
 const s=serverFixture(),r=request();const first=await s.handler(http(r));const text=await first.text();assert.equal((text.match(/"type":"done"/g)||[]).length,1);assert.equal((await s.handler(http(r))).status,409);assert.equal(s.transported.length,1);
});
test('demo UI contains no uploads, screenshots, telemetry or old transport fallback',async()=>{
 const ui=await readFile(new URL('../../public/OmniCPQ/demo/index.html',import.meta.url),'utf8'),js=await readFile(new URL('../../public/OmniCPQ/demo/app.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/<input[^>]+type=["']file/);assert.doesNotMatch(js,/sendBeacon|WebSocket|XMLHttpRequest|localStorage|sessionStorage|createLegacyBridge/);assert.equal((js.match(/fetcher\(DEMO_API/g)||[]).length,2);
});
