import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {resolve} from 'node:path';
const SOURCE=process.env.TS_SO_PUBLIC_SOURCE || 'functions/lib/omnicpq/knowledge.mjs';
const source=await readFile(SOURCE,'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
// Runs only the public source with synthetic dependency globals; no ESM private
// dependency is imported, no loadKnowledge/readPrivatePack entry point is called.
function publicHarness(){
 const calls={defaultDocument:0,defaultLearning:0,dynamicImport:0,syntheticLearning:0};
 const denied=name=>()=>{calls[name]++;throw Error('SYNTHETIC_UNEXPECTED_DEFAULT_IO');};
 const sandbox={Buffer,process:{env:{}},resolve,SKILL:{release:'SYNTHETIC',version:'SYNTHETIC'},SKILL_V15:{release:'SYNTHETIC_V15'},error:(code,status)=>Object.assign(Error(code),{code,status}),hash:async value=>sha(value),validateLifecycleAnswer:()=>({state:'SYNTHETIC'}),catalogExtracts:()=>[],resolveCatalogQuery:(_files,text)=>text,categoryQuestion:()=>false,readPrivateDocument:denied('defaultDocument'),readLearning:denied('defaultLearning'),runtime:()=>{throw Error('SYNTHETIC_RUNTIME_DENIED');},openSealedKnowledge:()=>{throw Error('SYNTHETIC_SEALED_DENIED');},gunzipSync:()=>{throw Error('SYNTHETIC_GZIP_DENIED');}};
 const code=source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 assert(!/^import\s/m.test(code),'SYNTHETIC_IMPORT_BOUNDARY');
 const context=vm.createContext(sandbox);new vm.Script(code+'\nglobalThis.api={selectService,resolveIntent,createRetriever};',{importModuleDynamically:()=>{calls.dynamicImport++;throw Error('SYNTHETIC_DYNAMIC_IMPORT_DENIED');}}).runInContext(context,{timeout:1000});
 return {api:sandbox.api,calls};
}
const row=(service_id,alias,entrypoint)=>({service_id,title:alias,coverage:'SYNTHETIC_ONLY',aliases:[alias],offering_prefixes:[],entrypoint});
const registry=()=>({product_modules:[row('TS_SO','TS Suvereni oblak','references/ts-suvereni-oblak/MODULE.md'),row('VPN_L3','VPN L3','references/vpn-l3/MODULE.md'),row('VPI_DDOS_VPS','VPI DDOS VPS','references/vpi/MODULE.md')],process_modules:[],context_modules:[]});
const supported=['TS Suvereni oblak','TS Suverenega oblaka','TS Suverenemu oblaku','v TS Suverenem oblaku','s TS Suverenim oblakom','TS SUVERENEGA OBLAKA','TS\tSuverenem\noblaku'];
for(const text of supported)test('TS_SO full registered singular inflection '+JSON.stringify(text),()=>{const h=publicHarness();assert.equal(h.api.selectService(registry(),'Pojasni licenco '+text)?.service_id,'TS_SO');assert.equal(h.calls.dynamicImport+h.calls.defaultDocument+h.calls.defaultLearning,0);});
for(const text of ['oblak','javni oblak','splošni oblak','v javnem oblaku','suvereni oblak','v suverenem oblaku','TS Suverenega oblak','TS Suvereni oblaki','TS Suverenim oblaku','xTS Suverenega oblaka','TS Suverenega oblakaSuffix','TS_Suverenega oblaka','TS Suverenega_ oblaka','SO','VPS','VPN'])test('TS_SO no generic or malformed inference '+text,()=>{const h=publicHarness();assert.equal(h.api.selectService(registry(),text),null);});
for(const text of ['TS Suverenega oblaka in VPN L3','VPN L3 in TS Suverenem oblaku','s TS Suverenim oblakom in VPI DDOS VPS','TS Suvereni oblak in VPN L3'])test('TS_SO multiple independently named services stay ambiguous '+text,()=>{assert.equal(publicHarness().api.selectService(registry(),text),null);});
test('TS_SO alias belongs to registry row; no implicit alias injection',()=>{const h=publicHarness(),r=registry();r.product_modules[0].aliases=['SYNTHETIC OTHER NAME'];assert.equal(h.api.selectService(r,'TS Suverenega oblaka'),null);r.product_modules[0].aliases=[];r.product_modules[0].offering_prefixes=['TS Suvereni oblak'];assert.equal(h.api.selectService(r,'TS Suverenega oblaka')?.service_id,'TS_SO');});
test('TS_SO long overlap still suppresses contained generic alias, not another service',()=>{const h=publicHarness(),r=registry();r.product_modules.push(row('SYNTHETIC_GENERIC','oblak','references/generic.md'));assert.equal(h.api.selectService(r,'TS Suvereni oblak')?.service_id,'TS_SO');assert.equal(h.api.selectService(r,'TS Suvereni oblak in oblak'),null);});
test('TS_SO registry and request remain unchanged; repeat mentions one service',()=>{const h=publicHarness(),r=registry(),before=JSON.stringify(r);assert.equal(h.api.selectService(r,'TS Suverenega oblaka / TS Suverenem oblaku')?.service_id,'TS_SO');assert.equal(JSON.stringify(r),before);});
function retriever(h){
 const r=registry(),paths=['SKILL.md','references/WORK_MODES.md','references/RESPONSE_CONTRACT.md','references/CONTEXT_PROTOCOL.md','references/SERVICE_ROUTING.md','references/ts-suvereni-oblak/MODULE.md','references/ts-suvereni-oblak/PLM_RULEBOOK_R2.md','references/ts-suvereni-oblak/EVIDENCE_LIMITS.md','references/ts-suvereni-oblak/PRICE_GUIDE.md','references/PLM_EXPORTS_20261022.md','references/PLM_SO_20261022.json','references/vpn-l3/MODULE.md'];
 const files=Object.fromEntries(paths.map(path=>[path,'SYNTHETIC_ONLY '+path+'\n']));files['references/SERVICE_REGISTRY.json']=JSON.stringify(r);files['references/LIFECYCLE_OUTPUT.schema.json']='{}';files['copilot/PROMPTS.json']='{"prompts":[]}';
 const manifest={payload_files:Object.entries(files).map(([path,text])=>({path,bytes:Buffer.byteLength(text),sha256:sha(text)}))};
 return h.api.createRetriever({files,manifest,packSha256:'SYNTHETIC_PACK_NOT_PRIVATE_V16'},{documentReader:()=>{throw Error('SYNTHETIC_DOCUMENT_DENIED');},learningReader:async()=>{h.calls.syntheticLearning++;return {data:{records:[]},sha256:'SYNTHETIC_EMPTY',version:'SYNTHETIC'};}});
}
const request=(message,extra={})=>({message,mode:'guide',promptId:null,service:null,context:{text:''},history:[],...extra});
const rulebook=result=>result.sources.some(s=>s.path==='references/ts-suvereni-oblak/PLM_RULEBOOK_R2.md');
for(const text of supported.slice(0,5))test('TS_SO synthetic retrieval includes proper source for '+text,async()=>{const h=publicHarness(),k=retriever(h),result=await k.retrieve(request('Pojasni licenco '+text));assert.equal(result.service?.id,'TS_SO');assert.equal(rulebook(result),true);assert(result.text.includes('SYNTHETIC_ONLY'));assert.equal(h.calls.defaultDocument+h.calls.defaultLearning+h.calls.dynamicImport,0);});
for(const text of ['javni oblak','splošni oblak','TS Suverenega oblaka in VPN L3'])test('TS_SO synthetic retrieval does not select rulebook for '+text,async()=>{const h=publicHarness(),result=await retriever(h).retrieve(request(text));assert.equal(result.service,null);assert.equal(rulebook(result),false);assert.equal(h.calls.defaultDocument+h.calls.defaultLearning+h.calls.dynamicImport,0);});
test('TS_SO current inflected message replaces old VPN context/history',async()=>{const result=await retriever(publicHarness()).retrieve(request('Pojasni TS Suverenega oblaka',{context:{text:'VPN L3'},history:[{role:'user',content:'VPN L3'}]}));assert.equal(result.service?.id,'TS_SO');assert.equal(rulebook(result),true);});
test('TS_SO new VPN message replaces old inflected SO context/history',async()=>{const result=await retriever(publicHarness()).retrieve(request('Pojasni VPN L3',{context:{text:'v TS Suverenem oblaku'},history:[{role:'user',content:'TS Suverenega oblaka'}]}));assert.equal(result.service?.id,'VPN_L3');assert.equal(rulebook(result),false);});
test('TS_SO explicit selected service conflict stays null',async()=>{const result=await retriever(publicHarness()).retrieve(request('Pojasni VPN L3',{service:'TS_SO',context:{text:'TS Suverenega oblaka'}}));assert.equal(result.service,null);assert.equal(result.serviceResolution.conflict,true);assert.equal(rulebook(result),false);});
test('TS_SO conflicting selected VPN and inflected current SO stay null',async()=>{const result=await retriever(publicHarness()).retrieve(request('Pojasni TS Suverenega oblaka',{service:'VPN_L3'}));assert.equal(result.service,null);assert.equal(result.serviceResolution.conflict,true);assert.equal(rulebook(result),false);});
test('TS_SO ambiguous current request cannot inherit context to force match',async()=>{const result=await retriever(publicHarness()).retrieve(request('TS Suverenega oblaka in VPN L3',{context:{text:'TS Suvereni oblak'}}));assert.equal(result.service,null);assert.equal(result.serviceResolution.ambiguous,true);assert.equal(rulebook(result),false);});
test('TS_SO unknown new cloud service does not inherit previous service',async()=>{const result=await retriever(publicHarness()).retrieve(request('Nova neznana cloud storitev',{context:{text:'TS Suverenega oblaka'},history:[{role:'user',content:'TS Suverenem oblaku'}]}));assert.equal(result.service,null);assert.equal(result.serviceResolution.unknownNewService,true);assert.equal(rulebook(result),false);});
test('TS_SO unchanged followup can inherit explicit unambiguous inflected context',async()=>{const result=await retriever(publicHarness()).retrieve(request('Kaj pa licenca?',{context:{text:'v TS Suverenem oblaku'}}));assert.equal(result.service?.id,'TS_SO');assert.equal(rulebook(result),true);});
