import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRetriever} from '../../functions/lib/omnicpq/knowledge.mjs';

const hash=text=>createHash('sha256').update(text).digest('hex');
const evidence1='references/SYNTHETIC_EVIDENCE_1.json';
const evidence2='references/SYNTHETIC_EVIDENCE_2.json';
function files(){
 const registry={product_modules:[{service_id:'SYNTH',title:'Synthetic service',aliases:['Synthetic service'],offering_prefixes:[],coverage:'SYNTHETIC',entrypoint:'references/SYNTHETIC_PRODUCT.md'}],process_modules:[{process_id:'V12_BUSINESS_REQUIREMENT',title:'Synthetic request',triggers:['poslovna zahteva'],entrypoint:'references/SYNTHETIC_REQUEST.md',evidence_paths:[evidence1,evidence2]}],context_modules:[]};
 const f={'references/SERVICE_REGISTRY.json':JSON.stringify(registry),'references/LIFECYCLE_OUTPUT.schema.json':'{}','copilot/PROMPTS.json':'{"prompts":[]}',[evidence1]:'{\n  "example": [1, 2]\n}',[evidence2]:'{"second":true}'};
 for(const name of ['SKILL.md','references/WORK_MODES.md','references/RESPONSE_CONTRACT.md','references/CONTEXT_PROTOCOL.md','references/SERVICE_ROUTING.md','references/INTEGRATION_CONFLICTS.md','references/SYNTHETIC_PRODUCT.md','references/SYNTHETIC_REQUEST.md','references/PROCESS_ROUTING.md','references/JIRA_REQUIREMENTS.md','references/POSLOVNA_ZAHTEVA_IT_PLM.md'])f[name]='# SYNTHETIC '+name+'\nNo product rules.';
 return f;
}
function retriever(f,{record=null,document=null}={}){
 const manifest={payload_files:Object.entries(f).map(([path,text])=>({path,sha256:hash(text)}))};
 const documentReader=async()=>{if(document===null)throw Error('NOT_AVAILABLE');return {bytes:Buffer.from(document),sha256:hash(document)}};
 const learningReader=async()=>({version:'SYNTHETIC_V1',sha256:hash('learning'),data:{records:record?[record]:[]}});
 return createRetriever({files:f,manifest,packSha256:hash('synthetic-pack')},{documentReader,learningReader});
}
const request=()=>({message:'Synthetic service poslovna zahteva',mode:'jira',context:{text:''},history:[]});
const record=n=>({id:'synthetic',serviceId:'SYNTH',title:'Synthetic',note:'X'.repeat(n),sources:[]});
function block(text,source){const prefix=`<source id="${source.id}" path="${source.path}" kind="${source.kind}"`;const start=text.indexOf(prefix);assert(start>=0);const a=text.indexOf('>\n',start),b=text.indexOf('\n</source>',a+2);assert(a>=0&&b>=0);return text.slice(a+2,b);}
function oracle(text){let out='',inside=false,escape=false;for(const c of text){if(inside){out+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inside=false;}else if(c==='"'){out+=c;inside=true;}else if(!' \t\r\n'.includes(c))out+=c;}return out;}

test('retrieval keeps an under-limit context and its original source identities',async()=>{
 const f=files(),r=await retriever(f).retrieve(request());assert(r.text.length<190000);assert(!r.text.includes('representation='));
 for(const source of r.sources){assert.equal(source.sha256,hash(f[source.path]));assert.equal(block(r.text,source),f[source.path]);assert.equal(source.contextRepresentation,undefined);}
});

test('oversized context compacts complete JSON without changing tokens or source identities',async()=>{
 const f=files();f['SKILL.md']='X'.repeat(90000);f[evidence1]=' \n'.repeat(55000)+'{ "dup" : 1, "dup" : 2, "escaped" : "\\u0061", "spaces" : "  keep  " }';
 const r=await retriever(f).retrieve(request()),source=r.sources.find(s=>s.path===evidence1);assert(r.text.length<=190000);assert(source?.contextRepresentation);assert(r.sources.some(s=>s.path===evidence2));
 const text=block(r.text,source);assert.equal(text,oracle(f[evidence1]));assert.equal(source.sha256,hash(f[evidence1]));assert.equal(source.contextRepresentation.inputSha256,hash(f[evidence1]));assert.equal(source.contextRepresentation.contextSha256,hash(text));assert.equal(source.contextRepresentation.rawSourceSha256,source.sha256);assert.equal(source.contextRepresentation.sourceLocators,'original_source');
});

test('an oversized required source is not clipped or silently dropped',async()=>{
 const f=files();f[evidence1]='{"required":"'+'X'.repeat(200000)+'"}';await assert.rejects(retriever(f).retrieve(request()),e=>e.code==='RETRIEVAL_LIMIT'&&e.status===422);
});

test('optional learning is admitted whole or left pending when it does not fit',async()=>{
 const f=files(),small=await retriever(f,{record:record(32)}).retrieve(request());assert.equal(small.learningStatus,'SYNTHETIC_V1');assert(small.sources.some(s=>s.path.includes('#synthetic')));assert(small.text.includes('X'.repeat(32)));
 const large=await retriever(f,{record:record(210000)}).retrieve(request());assert.equal(large.learningStatus,'PRIVATE_LEARNING_PENDING');assert(!large.sources.some(s=>s.path.includes('#synthetic')));assert(large.text.length<=190000);
});

test('complete rendered context counts headers and UTF-16 through the exact limit',async()=>{
 for(const compressed of [false,true]){
  const f=files();if(compressed){f['SKILL.md']='X'.repeat(90000);f[evidence1]=' \n'.repeat(55000)+'{"kept":true}';}
  const first=await retriever(f).retrieve(request());const needed=190000-first.text.length;assert(needed>=2);f['SKILL.md']+='P'.repeat(needed-2)+'😀';
  const atLimit=await retriever(f).retrieve(request());assert.equal(atLimit.text.length,190000);assert.equal(Array.from(atLimit.text).length,189999);if(compressed)assert(atLimit.sources.find(s=>s.path===evidence1).contextRepresentation);
  f['SKILL.md']+='P';await assert.rejects(retriever(f).retrieve(request()),e=>e.code==='RETRIEVAL_LIMIT'&&e.status===422);
 }
});
