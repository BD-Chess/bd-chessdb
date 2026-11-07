import {MODEL_PROFILES as profiles,DEFAULT_PROFILE,modelProfile} from '../../public/OmniCPQ/model-profiles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
import {posix} from 'node:path';

// Real admitted public bodies; native private runtime/provider/pack imports are denied.
const read=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
const [deliverySource,businessSource,instructionSource,knowledgeSource,jsonSource,identitySource,handlerSource,appSource,modesSource]=await Promise.all([
  'functions/lib/omnicpq/delivery-release.mjs','functions/lib/omnicpq/so-business-knowledge.mjs',
  'functions/lib/omnicpq/instructions.mjs','functions/lib/omnicpq/knowledge.mjs','functions/lib/omnicpq/json-context.mjs',
  'functions/lib/omnicpq/identity.mjs','functions/omnicpq-assistant.mjs','public/OmniCPQ/app.mjs','public/OmniCPQ/work-modes.mjs'
].map(read));
const digest=value=>createHash('sha256').update(value).digest('hex');
const deny=()=>{throw Error('NATIVE_IO_DENIED');};
const plain=value=>JSON.parse(JSON.stringify(value));
const actualSkill=JSON.parse(identitySource.match(/export const SKILL = Object\.freeze\((\{[\s\S]*?\})\);/)[1]);
const APP_VERSION=identitySource.match(/export const APP_VERSION = '([^']+)'/)[1];
const ADAPTER_DELTA=identitySource.match(/export const ADAPTER_DELTA = '([^']+)'/)[1];
const syntheticSkill={...actualSkill,zipSha256:digest('SYNTHETIC_MEMORY_PACK')};
const stripExports=source=>source.replace(/^export /gm,'');
const noImports=source=>assert.doesNotMatch(source,/\bimport\s*(?:\(|[{'"*])/);
function removeImports(source,lines){
  let code=source.replaceAll('\r\n','\n');
  for(const line of lines){assert.equal(code.split(line).length,2,line);code=code.replace(line,'');}
  noImports(code);return code;
}
const modeScope=vm.createContext({fetch:deny,process:{env:new Proxy({},{get:deny})}});
noImports(modesSource);
vm.runInContext(stripExports(modesSource)+'\nglobalThis.modes={normalizeMode,normalizeWorkspace,CONTEXT_FIELDS,MODE_CONTRACT};',modeScope);
const modes=modeScope.modes;
const instructionCode=removeImports(instructionSource,[
  "import { soBusinessSupplement } from './so-business-knowledge.mjs';",
  "import { ADAPTER_DELTA, APP_VERSION } from './identity.mjs';",
  "import { deliveryReferenceContext } from './delivery-release.mjs';",
  "import { browserInstructions } from './browser.mjs';",
  "import {MODE_CONTRACT} from '../../../public/OmniCPQ/work-modes.mjs';"
]);
noImports(deliverySource);noImports(businessSource);
const promptScope=vm.createContext({APP_VERSION,ADAPTER_DELTA,MODE_CONTRACT:modes.MODE_CONTRACT,browserInstructions:()=> 'SYNTHETIC_BROWSER_NO_EXECUTION_AUTHORITY',fetch:deny,process:{env:new Proxy({},{get:deny})}});
vm.runInContext(stripExports(businessSource)+'\n'+stripExports(deliverySource)+'\n'+stripExports(instructionCode)+'\nglobalThis.actual={instructions,currentSourceManifest,makeDeliveryMetadata,deliveryQuestionKind,deliveryAnswer,deliverySupplement,deliveryReferenceContext,soBusinessSupplement,SO2026_DATA,DELIVERY_RELEASE};',promptScope);
const api=promptScope.actual;

// Execute the exact pure public retrieval section on an invented in-memory package.
const boundary='const words = text => norm(text).match';
assert.equal(knowledgeSource.split(boundary).length,2);
const retrievalCode=stripExports(knowledgeSource.slice(knowledgeSource.indexOf(boundary)));
noImports(retrievalCode);noImports(jsonSource);
const retrieverScope=vm.createContext({
  norm:value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase(),
  activeSkill:()=>syntheticSkill,SKILL:syntheticSkill,SKILL_V15:{},resolve:posix.resolve,
  validateLifecycleAnswer:()=>({status:'SYNTHETIC_NOT_BUSINESS_PROOF'}),
  catalogExtracts:()=>[],resolveCatalogQuery:()=>'',categoryQuestion:()=>false,
  error:(code,status=503)=>Object.assign(Error(code),{code,status}),hash:async value=>digest(value),
  openSealedKnowledge:deny,gunzipSync:deny,runtime:deny,readPrivateDocument:deny,readLearning:deny,
  Netlify:{env:{get:name=>{assert.equal(name,'OMNICPQ_ACTIVE_RELEASE');return 'SYNTHETIC';}}},fetch:deny,process:{env:new Proxy({},{get:deny})}
});
vm.runInContext(stripExports(jsonSource)+'\n'+retrievalCode+'\nglobalThis.actualCreateRetriever=createRetriever;',retrieverScope);
const commonRefs=['SKILL.md','references/WORK_MODES.md','references/RESPONSE_CONTRACT.md','references/CONTEXT_PROTOCOL.md','references/SERVICE_ROUTING.md'];
function createMemoryRetriever(){
  const registry={product_modules:[
    {service_id:'TS_SO',title:'SYNTHETIC_SO',aliases:['Suvereni oblak'],offering_prefixes:['Ikt.SO'],entrypoint:'references/ts-suvereni-oblak/MODULE.md',coverage:'SYNTHETIC'},
    {service_id:'SDWAN',title:'SYNTHETIC_SDWAN',aliases:['SD-WAN'],entrypoint:'references/sdwan/MODULE.md',coverage:'SYNTHETIC'},
    {service_id:'VPI',title:'SYNTHETIC_VPI',aliases:['VPI'],entrypoint:'references/vpi/MODULE.md',coverage:'SYNTHETIC'}
  ],process_modules:[],context_modules:[]};
  const paths=[...commonRefs,'references/INTEGRATION_CONFLICTS.md','references/PLM_EXPORTS_20261022.md','references/PLM_SO_20261022.json','references/ts-suvereni-oblak/PLM_RULEBOOK_R2.md','references/ts-suvereni-oblak/EVIDENCE_LIMITS.md',...registry.product_modules.map(r=>r.entrypoint)];
  const files=Object.fromEntries(paths.map(p=>[p,'SYNTHETIC_REFERENCE '+p+'\nNO_REAL_PRODUCT_RULE']));
  files['references/SERVICE_REGISTRY.json']=JSON.stringify(registry);
  files['references/LIFECYCLE_OUTPUT.schema.json']='{"type":"object"}';
  files['copilot/PROMPTS.json']='{"prompts":[]}';
  return retrieverScope.actualCreateRetriever({files,manifest:{payload_files:Object.entries(files).map(([path,text])=>({path,sha256:digest(text)}))},packSha256:digest('SYNTHETIC_MEMORY_PACK')},{documentReader:deny,learningReader:async()=>({data:{records:[]},version:'SYNTHETIC'})});
}
const request=changes=>({message:'Katero verzijo pomočnika uporabljam?',mode:'guide',profile:'fast',context:{text:''},history:[],...changes});
const emptyKnowledge=()=>({text:'',sources:[],skill:syntheticSkill,service:null,serviceResolution:{},intent:{mode:'guide'}});
const components={appVersion:APP_VERSION,adapterDelta:ADAPTER_DELTA};
function emittedSnapshot(prompt){const m=prompt.match(/<so_business_snapshot_v1>[\s\S]*?\n(\{"source":[^\n]+)\n(?:BD_DESIGN_PLAN[^\n]*\n)?<\/so_business_snapshot_v1>/);assert(m,'real emitted snapshot JSON');return JSON.parse(m[1]);}
function sources(prompt){const m=prompt.match(/<current_sources_json>\n([^]*?)\n<\/current_sources_json>/);assert(m);return JSON.parse(m[1]);}

test('V19 current delivery is v19 while actual core/application/schema components stay separate',()=>{
  const data=api.makeDeliveryMetadata({skill:syntheticSkill,...components});
  assert.equal(data.schema,'omnicpq.delivery-release.v1');assert.equal(data.release_id,'OmniCPQ-v19-20261103');assert.equal(data.issued_on,'2026-11-03');
  assert.equal(data.delivery_version,'v19');assert.equal(data.components.core.release,'v16');assert.equal(data.components.core.version,'v0.1.6');
  assert.equal(data.components.application.version,APP_VERSION);assert.equal(data.components.schema.version,'UNKNOWN');
  const legacy=api.makeDeliveryMetadata({skill:{release:'v18',version:'v0.1.7'},...components});
  const answer=api.deliveryAnswer(legacy,'VERSION');assert.match(answer,/izdaja pomočnika je v19/);assert.match(answer,/jedro: v18\/v0\.1\.7/);
  assert.doesNotMatch(answer,/izdaja pomočnika je v0\.1\.7/);
});
test('V19 unknown or malformed component labels stay UNKNOWN without object coercion',()=>{
  const bad={toString:deny};const d=api.makeDeliveryMetadata({skill:{release:bad,version:'<img>'},appVersion:bad,adapterDelta:bad});
  assert.equal(d.components.core.release,'UNKNOWN');assert.equal(d.components.core.version,'UNKNOWN');assert.equal(d.components.application.version,'UNKNOWN');
  assert.equal(d.delivery_version,'v19');assert.equal(d.evidence_limits.Copilot_host_install,'UNKNOWN');assert.equal(d.evidence_limits.user_open_PWA_adoption,'UNKNOWN');
});
test('V19 real caller on SDWAN and VPI version requests never gains historical SO price context',async()=>{
  for(const service of ['SDWAN','VPI']){
    const req=request({service,history:[{role:'user',content:'Ikt.SO.Pck3'}]});
    const k=await createMemoryRetriever().retrieve(req);assert.equal(k.service.id,service);
    const prompt=api.instructions(k,req);assert.match(prompt,/OmniCPQ-v19-20261103/);assert.doesNotMatch(prompt,/<so_business_snapshot_v1>/);
    assert.deepEqual(sources(prompt).sources.map(s=>s.path),plain(k.sources).map(s=>s.path));
  }
});
test('V19 actual caller empty, conflict, unknown and ambiguous cases cannot acquire SO prices',async()=>{
  for(const req of [request({message:''}),request({message:'SD-WAN',service:'TS_SO'}),request({message:'SD-WAN in Suvereni oblak'}),request({message:'Nova storitev Quantum Cloud'})]){
    const k=await createMemoryRetriever().retrieve(req);const prompt=api.instructions(k,req);
    assert.match(prompt,/"delivery_version":"v19"/);assert.doesNotMatch(prompt,/<so_business_snapshot_v1>/);
  }
});
test('V19 actual TS_SO and relevant Pck3 followup preserve the five-child twelve-price snapshot',async()=>{
  for(const req of [request({message:'Ikt.SO.Pck3',service:'TS_SO'}),request({message:'Kakšne so cene?',service:'TS_SO',history:[{role:'user',content:'Ikt.SO.Pck3'}]}),request({message:'Katera različica pomočnika in kakšne so cene Ikt.SO.Pck3?',service:'TS_SO'})]){
    const k=await createMemoryRetriever().retrieve(req);assert.equal(k.service.id,'TS_SO');
    const json=emittedSnapshot(api.instructions(k,req));assert.equal(json.packages.length,1);assert.equal(json.packages[0].code,'Ikt.SO.Pck3');assert.equal(json.prices.length,12);
    assert.equal(json.hierarchy.filter(r=>r[1]==='Ikt.SO.Pck3').length,5);
    if(req.message.includes('pomočnika')){assert.equal(api.deliveryQuestionKind(req),'VERSION');assert.match(api.instructions(k,req),/Točen omejeni okvir odgovora/);}
  }
  const req=request({message:'Ikt.SO.Pck30',service:'TS_SO'}),k=await createMemoryRetriever().retrieve(req);
  assert.doesNotMatch(api.instructions(k,req),/<so_business_snapshot_v1>/);
});
test('V19 helper-version classification stays separate from product and component versions',()=>{
  for(const message of ['Katero verzijo imaš?','Katera različica AI pomočnika za CPQ je to?','Ali si v0.1.7?','Katero izdajo pomočnika uporabljaš?','Katero verzijo AI agenta uporabljam?','Katera je tvoja različica?','Pomočnik, katero verzijo imaš?','Katera je tvoja trenutna različica?','Ti kot naš pomočnik: povej svojo trenutno izdajo.'])assert.equal(api.deliveryQuestionKind({message}),'VERSION',message);
  for(const message of ['', 'Pozdravljen', 'Katera verzija SQL je podprta?', 'Katero verzijo Windows uporabljaš?', 'Katera izdaja OmniCPQ je na STAGE?', 'Ali imaš podatke za verzijo Bridge?', 'Katera verzija sheme je to?', 'Katera verzija SD-WAN je na voljo?', 'Katera različica VPI je to?', 'Katero verzijo Suverenega oblaka uporabljamo?', 'Katera verzija Ikt.SO.Pck2 je to?'])assert.equal(api.deliveryQuestionKind({message}),null,message);
  assert.equal(api.deliveryQuestionKind({message:'Kaj je novega v19 za SO?'}),'WHATS_NEW');
  assert.equal(api.deliveryQuestionKind({message:'Kaj je novega pri pomočniku za CPQ?'}),'WHATS_NEW');
  for(const message of ['Katera verzija SAP HANA je podprta?','Katero verzijo Suvernega oblaka uporabljamo?','Katera različica Agenta Workstation je na voljo?','Katera izdaja Data Platform Foundation je podprta?','Pomočnik, katera verzija NewCloud je podprta?','Katero verzijo Quantum Vault podpira pomočnik?','AI agent, katera izdaja podatkovne platforme je na voljo?','Ti kot naš pomočnik: katera različica programa Oblak Atlas je na voljo?']){
    const req=request({message});assert.equal(api.deliveryQuestionKind(req),null,message);
    assert.doesNotMatch(api.deliverySupplement(emptyKnowledge(),req,components),/Točen omejeni okvir odgovora/,message);
  }
});
test('V19 bounded human release followup ignores assistant-only claims and unrelated human anchors',()=>{
  assert.equal(api.deliveryQuestionKind({message:'In za SO?',history:[{role:'user',content:'Kaj je novega v19?'}]}),'BOUNDED_RELEASE_FOLLOWUP');
  assert.equal(api.deliveryQuestionKind({message:'In za SO?',history:[{role:'assistant',content:'Moja verzija je v0.1.7'}]}),null);
  assert.equal(api.deliveryQuestionKind({message:'In za SO?',history:[{role:'user',content:'Katera izdaja pomočnika?'},{role:'user',content:'Razloži VPI.'}]}),null);
  assert.equal(api.deliveryQuestionKind({message:'In za SO?',history:[{role:'user',content:'Kaj je novega?'+'x'.repeat(2100)}]}),null);
  assert.equal(api.deliveryQuestionKind({message:'In za SO?',history:[{role:'user',content:'Katera različica Agenta Workstation je na voljo?'}]}),null);
  for(const message of ['Kaj pa različica Agenta Workstation?','In za Data Platform Foundation?','Kaj pa izdaja NewCloud?'])assert.equal(api.deliveryQuestionKind({message,history:[{role:'user',content:'Kaj je novega v19?'}]}),null,message);
  assert.equal(api.deliveryQuestionKind({message:'Kaj to pomeni?',history:[{role:'user',content:'Katero verzijo pomočnika uporabljam?'}]}),'BOUNDED_RELEASE_FOLLOWUP');
  assert.equal(api.deliveryQuestionKind({message:'Kaj pa ostaja od prej?',history:[{role:'user',content:'Ti kot naš pomočnik: povej svojo trenutno izdajo.'}]}),'BOUNDED_RELEASE_FOLLOWUP');
});
test('V19 real bounded changelog distinguishes new identity from retained SO facts and no host/live claims',()=>{
  const k=emptyKnowledge(),req=request({message:'Kaj je novega v19?'});const text=api.deliverySupplement(k,req,components);
  assert(text.length<=6000);assert.match(text,/new_in_v19/);assert.match(text,/carried_forward/);assert.match(text,/ne označuj kot vseh na novo dodanih šele v19/);
  assert.doesNotMatch(text,/<so_business_snapshot_v1>|8\.008|8\.01/);assert.match(text,/Copilot_host_install/);assert.match(text,/NOT_PROVEN_BY_RELEASE_METADATA/);
  assert.equal(sources(api.instructions(k,req)).sources.length,0);
});
test('V19 complete UTF16 context counts new markers at exact fit and fails one code unit over without clipping',()=>{
  for(const so of [false,true]){
    const k=emptyKnowledge();if(so)k.service={id:'TS_SO'};
    const req=request({message:so?'Ikt.SO.Pck3':'Katero verzijo imaš?',service:so?'TS_SO':undefined});
    const supplement=api.soBusinessSupplement(k,req),release=api.deliverySupplement(k,req,components);
    const room=190000-supplement.length-release.length;
    k.text='😀'.repeat(Math.floor(room/2))+'x'.repeat(room%2);
    const result=api.deliveryReferenceContext(k,req,components,supplement);assert.equal(result.length,190000);assert(result.startsWith(k.text));assert(result.endsWith(release));
    assert.doesNotThrow(()=>api.instructions(k,req));
    assert.throws(()=>api.instructions({...k,text:k.text+'x'},req),e=>e.status===413&&e.code==='DELIVERY_RELEASE_COMPLETE_CONTEXT_TOO_LARGE');
  }
});

function backend(){
  let code=removeImports(handlerSource,[
    "import { randomUUID, createHash } from 'node:crypto';",
    "import { authenticateOmni, demoBudget } from './lib/omnicpq/runtime.mjs';",
    "import { APP_VERSION, SKILL, ADAPTER_DELTA, error } from './lib/omnicpq/identity.mjs';",
    "import { makeDeliveryMetadata } from './lib/omnicpq/delivery-release.mjs';",
    "import { loadKnowledge } from './lib/omnicpq/knowledge.mjs';",
    "import { instructions } from './lib/omnicpq/instructions.mjs';",
    "import { callOpenAI } from './lib/omnicpq/provider.mjs';",
    "import { validateBrowser, starterMetadata, allowedStarter } from './lib/omnicpq/browser.mjs';",
    "import {normalizeMode,normalizeWorkspace,CONTEXT_FIELDS} from '../public/OmniCPQ/work-modes.mjs';",
    "import {MODEL_PROFILES as profiles,DEFAULT_PROFILE,modelProfile} from '../public/OmniCPQ/model-profiles.mjs';",
    "import {makeDemoHandler} from './lib/omnicpq/demo-assistant.mjs';",
    "import {makeLearningHandler,learningRoute,learningPayloadFactory} from './lib/omnicpq/ai-learning.mjs';"
  ]);
  const initializer='\nconst requestGate={seen:new Map(),active:new Set()};';assert.equal(code.split(initializer).length,2);code=code.split(initializer)[0];
  const scope=vm.createContext({randomUUID,createHash,profiles,DEFAULT_PROFILE,modelProfile,APP_VERSION,SKILL:syntheticSkill,ADAPTER_DELTA,error:(code,status=503)=>Object.assign(Error(code),{code,status}),
    makeDeliveryMetadata:api.makeDeliveryMetadata,instructions:api.instructions,authenticateOmni:deny,demoBudget:deny,loadKnowledge:deny,callOpenAI:deny,
    validateBrowser:()=>null,starterMetadata:{version:'SYNTHETIC'},allowedStarter:()=>false,...modes,
    Netlify:{env:{get:key=>key==='OMNICPQ_MODEL'?'gpt-6-luna':undefined}},process:{env:new Proxy({},{get:deny})},fetch:deny,
    Request,Response,Headers,Buffer,ReadableStream,TextEncoder,AbortController,performance,setTimeout,clearTimeout,console:{warn:()=>{}}
  });
  vm.runInContext(stripExports(code)+'\nglobalThis.handlerApi={makeHandler,validateBody,buildPayload};',scope);return scope.handlerApi;
}
test('V19 actual health and SSE metadata report delivery separately without provider/config/auth changes',async()=>{
  const b=backend(),k=createMemoryRetriever();let mockTransportCalls=0,expectedProfile='fast';
  const handler=b.makeHandler({accessFactory:async()=>({id:'SYNTHETIC_OWNER',role:'owner'}),knowledgeFactory:async()=>k,enabled:true,
    budgetFactory:()=>({reserve:async()=>({id:'SYNTHETIC_HOLD'}),settle:async()=>({status:'SYNTHETIC'})}),
    transport:async({payload,onText})=>{mockTransportCalls++;assert.equal(payload.model,modelProfile(expectedProfile).model);assert.equal(payload.reasoning.effort,modelProfile(expectedProfile).reasoning);assert.equal(payload.max_output_tokens,6000);assert.equal(payload.store,false);onText('SYNTHETIC_TRANSPORT_NOT_MODEL_REPLY');return{usage:{inputTokens:1,outputTokens:1}};}});
  const health=await (await handler(new Request('https://example.test/.netlify/functions/omnicpq-assistant'))).json();
  assert.equal(health.deliveryRelease.delivery_version,'v19');assert.equal(health.version,APP_VERSION);assert.equal(health.skill.release,'v16');assert.equal(health.skill.version,'v0.1.6');assert.equal(mockTransportCalls,0);
  for(const profile of ['fast','careful']){
    expectedProfile=profile;
    const body={message:'Katero verzijo pomočnika uporabljam?',mode:'guide',profile,clientRequestId:randomUUID(),context:{text:''},history:[],service:'SDWAN'};
    const response=await handler(new Request('https://example.test/.netlify/functions/omnicpq-assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
    const events=(await response.text()).split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
    const meta=events.find(e=>e.type==='meta');assert(meta);assert.equal(meta.deliveryRelease.release_id,'OmniCPQ-v19-20261103');assert.equal(meta.skill.release,'v16');assert.equal(meta.requestedReasoning,modelProfile(profile).reasoning);assert.equal(meta.observedModel,'UNKNOWN');assert(events.some(e=>e.type==='done'),JSON.stringify(events.map(e=>({type:e.type,code:e.code,partial:e.partial}))));
  }
  assert.equal(mockTransportCalls,2,'Two source-free mocks, zero actual provider calls');
  const unauthorized=b.makeHandler({accessFactory:async()=>{throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED',status:401});},knowledgeFactory:deny,enabled:true});
  assert.equal((await unauthorized(new Request('https://example.test/.netlify/functions/omnicpq-assistant'))).status,401);
});
test('V19 real UI formatter accepts only exact current metadata and clears stale release on fresh observation',()=>{
  const start=appSource.indexOf('function unconfirmedDelivery('),end=appSource.indexOf('async function readReleaseInfo()',start);assert(start>=0&&end>start);
  const scope=vm.createContext({});vm.runInContext(appSource.slice(start,end)+'\nglobalThis.ui={deliveryDisplay,unconfirmedDelivery};',scope);
  const health={version:APP_VERSION,skill:syntheticSkill,deliveryRelease:plain(api.makeDeliveryMetadata({skill:syntheticSkill,...components})),available:true};
  assert.equal(scope.ui.deliveryDisplay(health),'Izdaja v19');
  for(const mutation of [null,{}, {...health.deliveryRelease,issued_on:'2026-11-02'},{...health.deliveryRelease,schema:'wrong'},{...health.deliveryRelease,release_id:'OmniCPQ-v19-FAKE'},{...health.deliveryRelease,delivery_version:'v0.1.7'},{...health.deliveryRelease,components:[]}])assert.equal(scope.ui.deliveryDisplay({...health,deliveryRelease:mutation}),'Izdaja UNKNOWN');
  assert.equal(scope.ui.deliveryDisplay({version:APP_VERSION,skill:{release:'v18',version:'v0.1.7'}}),'Izdaja UNKNOWN');
  const cleared=scope.ui.unconfirmedDelivery(health);assert.equal(scope.ui.deliveryDisplay(cleared),'Izdaja UNKNOWN');assert.equal(cleared.available,true);assert.equal(cleared.skill,health.skill);
  const getter={get deliveryRelease(){throw Error('SYNTHETIC_GETTER');}};assert.equal(scope.ui.deliveryDisplay(getter),'Izdaja UNKNOWN');
  assert.match(appSource,/\$\('knowledge-status'\)\.textContent = `\$\{deliveryDisplay\(data\)\}/);
  assert.match(appSource,/state\.health = unconfirmedDelivery\(state\.health\)/);
  assert.doesNotMatch(appSource.slice(start,end),/innerHTML|insertAdjacentHTML/);
});
