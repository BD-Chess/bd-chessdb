import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash,webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
import * as runtime from './app-runtime-imports.mjs';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
import * as starters from '../../public/OmniCPQ/starters.mjs';
import * as bridge from '../../public/OmniCPQ/browser-bridge.mjs';
import {WORK_MODES,normalizeMode} from '../../public/OmniCPQ/work-modes.mjs';
import {createTour,SCENES} from '../../public/OmniCPQ/tour.mjs';
import {createExperience} from '../../public/OmniCPQ/experience.mjs';
import {validateBody} from '../../functions/omnicpq-assistant.mjs';
import {allowedStarter,starterMetadata} from '../../functions/lib/omnicpq/browser.mjs';
import {SKILL,APP_VERSION} from '../../functions/lib/omnicpq/identity.mjs';
import {verifyLearning,readLearning,enrichGuide,LEARNING_NAME,LEARNING_KEY} from '../../functions/lib/omnicpq/learning.mjs';
import {makeDocumentHandler} from '../../functions/omnicpq-documents.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const owner=async()=>({role:'owner',id:'SYNTHETIC_OWNER'});
const record={id:'vpi',serviceId:'VPI',title:'SYNTHETIC',coverage:'DATIRANO_DELNO',purpose:{status:'RAZLAGA',text:'SYNTHETIC_PURPOSE',example:'SYNTHETIC_EXAMPLE'},operation:{status:'RAZLAGA',text:'SYNTHETIC_MECHANISM'},ts:{status:'DATIRANO_DELNO',text:'SYNTHETIC_TS',limits:'SYNTHETIC_LIMIT'},lifecycle:{status:'PREDLOG',text:'SYNTHETIC_LIFECYCLE'},systems:{status:'PREDLOG',text:'SYNTHETIC_SYSTEMS'},questions:['SYNTHETIC_QUESTION'],sources:[{path:'references/synthetic.md',text:'SYNTHETIC_SOURCE',sha256:hash('SYNTHETIC_SOURCE'),locator:'https://example.test/source',status:'DATIRANO'}],gaps:['UNKNOWN'],provenance:{originalArchiveAccess:'NOT_VERIFIED'}};
const learning=JSON.stringify({schema:'omnicpq.learning.v1',version:'SYNTHETIC_R1',records:[record]});
const learningExpected={name:LEARNING_NAME,version:'SYNTHETIC_R1',size:Buffer.byteLength(learning),sha256:hash(learning)};
async function appHarness(){
  const dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:'https://www.mdlxdcc.org/omnicpq/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,$=id=>w.document.getElementById(id);let posts=0;
  Object.assign(w,{...runtime,...core,...prompts,...starters,...bridge,Response,Blob,AbortController});
  w.matchMedia=()=>({matches:false});
  w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{d.open=false;d.dispatchEvent(new w.Event('close'));};d.showModal=()=>{d.open=true;};});
  w.fetch=async(path,options={})=>{if(options.method==='POST')posts++;return Response.json({ok:true,available:true,version:APP_VERSION,account:{id:'synthetic-owner',role:'owner'},privateKnowledge:'VERIFIED',starterPrompts:starterMetadata,skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[{id:'VPI',title:'VPI'}]});};
  let code=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,'').replace('health(); installWorker();','window.boot=health();');
  w.eval(code+'\nwindow.app={state,setMode,getContext,bodyForInput,localWrite,experience};');await w.boot;
  return {dom,w,$,app:w.app,posts:()=>posts};
}
test('five ordered modes retain the same service, draft, multiline decisions, model, document and conversation without model requests',async()=>{
  const h=await appHarness();try{
    assert.deepEqual([...h.$('mode-nav').querySelectorAll('button')].map(b=>b.textContent.replace(/^\d+/,'')),['Vodič','Zahteve','Modeliranje','OmniCPQ','Testiranje']);
    h.$('service').value='VPI';h.$('message').value='UNSAVED_DRAFT';h.$('shared-decisions').value='A  B\nC';h.$('shared-model').value='MODEL_V1';h.$('shared-documentItem').value='DOC_ITEM';h.app.state.messages.push({role:'user',content:'ORIGINAL_QUESTION'});
    const before=h.app.bodyForInput();for(const mode of WORK_MODES){h.$('mode-nav').querySelector(`[data-mode="${mode.mode}"]`).click();assert.equal(h.app.state.mode,mode.mode);assert.equal(h.$('message').value,'UNSAVED_DRAFT');assert.equal(h.$('service').value,'VPI');assert.equal(h.app.getContext().workspace.decisions,'A  B\nC');assert.equal(h.app.state.messages.length,1);}
    assert.equal(h.posts(),0);assert.equal(h.app.bodyForInput().context.workspace.model,'MODEL_V1');assert.equal(h.app.bodyForInput().context.workspace.documentItem,'DOC_ITEM');
    h.app.state.persist=true;h.app.localWrite();const stored=JSON.parse(h.w.localStorage.getItem('omnicpq:workspace:v1'));assert.equal(stored.context.workspace.decisions,'A  B\nC');
    assert.notEqual(core.canonicalInput(before),core.canonicalInput({...before,context:{...before.context,workspace:{...before.context.workspace,decisions:'changed'}}}));
  }finally{h.dom.window.close();}
});
test('public author explanation restores focus and makes zero AI/CPQ requests; all original prompts remain usable',async()=>{
  const h=await appHarness();try{
    h.$('about-open').focus();h.$('about-open').click();assert.equal(h.$('about-dialog').open,true);
    const text=h.$('about-dialog').textContent;assert(text.indexOf('Pomočnik je zaklenjen.')<text.indexOf('Po uspešni prijavi'));assert.match(text,/dovoljenim e-poštnim naslovom in pravilnim geslom/);assert.match(text,/Bojan Dobrečevič/);
    h.$('about-close').click();assert.equal(h.w.document.activeElement,h.$('about-open'));assert.equal(h.posts(),0);
    assert.equal(prompts.CANONICAL_PROMPTS.length,19);assert.equal(starters.STARTERS.length,12);
    for(const p of [...starters.STARTERS,...starters.ADDITIONAL_STARTERS,...prompts.CANONICAL_PROMPTS])assert(allowedStarter(p.id,p.message,prompts.CANONICAL_PROMPTS));
  }finally{h.dom.window.close();}
});
test('legacy session modes normalize and server rejects oversized/unknown shared fields without changing product values',()=>{
  for(const [input,result] of [['CPQ_HELP','work'],['PLM_TESTS','plm'],['JIRA_REQUIREMENT','jira'],['modeling','model'],['testing','plm']]){
    assert.equal(normalizeMode(input),result);
    const value=validateBody({message:'Keep 32 vCPU and 1 TB; OS UNKNOWN',mode:input,clientRequestId:randomUUID(),context:{workspace:{decisions:'32 vCPU; TB UNKNOWN'}}});assert.equal(value.mode,result);assert.equal(value.context.workspace.decisions,'32 vCPU; TB UNKNOWN');
  }
  for(const workspace of [{model:'x'.repeat(2001)},{token:'SYNTHETIC'},[],null])assert.throws(()=>validateBody({message:'a',clientRequestId:randomUUID(),context:{workspace}}),/INVALID_CONTEXT/);
  for(const mode of ['__proto__','constructor','unknown'])assert.throws(()=>validateBody({message:'a',mode,clientRequestId:randomUUID()}),/INVALID_MODE/);
});
test('tour never narrates an unopened scene and Stop/question invalidate pending acknowledgements while retaining the place',async()=>{
  let resolve,spoken=[],silences=0;
  const t=createTour({show:()=>new Promise(r=>{resolve=r;}),caption:s=>spoken.push(s.id),silence:()=>{silences++;}});
  const start=t.start();assert.equal(t.state.status,'opening');assert.deepEqual(spoken,[]);t.stop();resolve({scene:'intro',visible:true});await start;assert.deepEqual(spoken,[]);assert.equal(t.state.status,'stopped');
  const a=t.next();resolve({scene:'guide',visible:false});await a;assert.equal(t.state.status,'paused');assert.deepEqual(spoken,[]);
  const b=t.resume();resolve({scene:'guide',visible:true});await b;assert.deepEqual(spoken,['guide']);t.question();assert.equal(t.state.index,1);assert.equal(t.state.status,'paused');assert(silences>=4);
  assert.deepEqual(SCENES.filter(s=>s.id!=='intro'&&s.id!=='finish').map(s=>s.mode),['guide','jira','model','work','plm']);
});
test('popup blocker preserves the workspace and exposes a named-window fallback; no voice means text fallback',async()=>{
  const h=await appHarness();try{
    h.w.open=()=>null;h.$('message').value='KEEP_DRAFT';h.$('shared-requirement').value='KEEP_REQ';
    assert.equal(await h.app.experience.start(),false);assert.equal(h.$('presentation-fallback').hidden,false);assert.equal(h.$('presentation-fallback').target,'TS_B2B_PRESENTATION');assert.equal(h.$('message').value,'KEEP_DRAFT');assert.equal(h.$('shared-requirement').value,'KEEP_REQ');assert.equal(h.$('tour-sound').disabled,true);assert.match(h.$('tour-voice-status').textContent,/Besedilo in podnapisi/);assert.equal(h.posts(),0);
  }finally{h.dom.window.close();}
});
test('one presentation window is reused and only the matching source/origin acknowledgement unlocks narration',async()=>{
  const h=await appHarness();try{
    let opens=0,frames=[];
    const popup={closed:false,focus(){},postMessage(message){frames.push(message);queueMicrotask(()=>h.w.dispatchEvent(new h.w.MessageEvent('message',{origin:'https://www.mdlxdcc.org',source:popup,data:message.type==='ts-b2b:ping'?{type:'ts-b2b:ready',requestId:message.requestId}:{type:'ts-b2b:visible',requestId:message.requestId,scene:message.scene?.id,visible:true}})));}};
    h.w.open=()=>{opens++;return popup;};assert.equal(await h.app.experience.start(),true);assert.match(h.$('tour-status').textContent,/Prizor je viden/);await h.app.experience.tour.next();assert.equal(h.app.experience.tour.state.lastVisible,'guide');
    h.w.dispatchEvent(new h.w.MessageEvent('message',{origin:'https://evil.test',source:popup,data:{type:'ts-b2b:question',text:'FOREIGN'}}));assert.notEqual(h.$('message').value,'FOREIGN');
    await h.app.experience.start();assert.equal(opens,1);assert(frames.some(m=>m.scene?.service==='vpi'));assert.equal(h.posts(),0);
  }finally{h.dom.window.close();}
});
test('private learning seed is pinned, immutable, read back and protected from anonymous/demo/foreign access',async()=>{
  assert.equal(verifyLearning(learning,learningExpected).records[0].id,'vpi');assert.throws(()=>verifyLearning(learning+' ',learningExpected));
  const corrupted=learning.replace('SYNTHETIC_SOURCE','CHANGED');assert.throws(()=>verifyLearning(corrupted,{...learningExpected,size:Buffer.byteLength(corrupted),sha256:hash(corrupted)}),/LEARNING_SOURCE_INTEGRITY/);
  let stored=null,writes=0;
  const handler=makeDocumentHandler({auth:owner,learningReader:async()=>stored,learningExpected,storeFactory:async()=>({get:async key=>{assert.equal(key,LEARNING_KEY);return stored;},set:async(key,value)=>{stored=value;writes++;}})});
  const request=(method='GET',body,origin='https://www.mdlxdcc.org')=>new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-documents?file='+LEARNING_NAME,{method,headers:{origin,'content-type':'application/json'},...(body?{body}:{})});
  assert.equal((await handler(request())).status,503);assert.equal((await handler(request('POST',learning))).status,200);assert.equal((await handler(request('POST',learning))).status,200);assert.equal(writes,1);
  const response=await handler(request());assert.equal(await response.text(),learning);assert.equal(response.headers.get('X-Document-SHA256'),learningExpected.sha256);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal((await handler(request('GET',null,'https://evil.test'))).status,403);
  for(const auth of [async()=>({role:'demo'}),async()=>{throw {code:'AUTH_REQUIRED'};}])assert.notEqual((await makeDocumentHandler({auth,learningReader:async()=>learning,learningExpected})(request())).status,200);
  const item={bytes:Buffer.from('<html><title>old</title><main><details id="vpi"><summary>VPI</summary><p>KEEP_ORIGINAL</p></details></main></html>')};
  const enriched=enrichGuide(item,verifyLearning(learning,learningExpected));assert.match(enriched.bytes.toString(),/KEEP_ORIGINAL/);assert.match(enriched.bytes.toString(),/SYNTHETIC_LIFECYCLE/);assert.equal(enriched.sha256,hash(enriched.bytes));
});
