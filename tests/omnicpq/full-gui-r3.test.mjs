import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,webcrypto,createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {cpqPageV2} from '../../public/OmniCPQ/extension/page-v2.mjs';
import {makeGuiBridgeHandler} from '../../public/OmniCPQ/extension/worker-v2.mjs';
import {createBrowserBridge,BRIDGE_EXTENSION_ID,BRIDGE_PROTOCOL,navigationProposal} from '../../public/OmniCPQ/browser-bridge-v2.mjs';
import {pendingRequests} from '../../public/OmniCPQ/extension/pairing.mjs';
import {createAutoConnector} from '../../public/OmniCPQ/auto-connect.mjs';
import {createAgentRun,runLimit,actionSignature,explicitGoalGrant,goalGrantCovers} from '../../public/OmniCPQ/agent-session.mjs';
import {readFile} from 'node:fs/promises';
import * as appRuntime from './app-runtime-imports.mjs';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
import * as starters from '../../public/OmniCPQ/starters.mjs';
import {makeHandler} from '../../functions/omnicpq-assistant.mjs';
import {SKILL} from '../../functions/lib/omnicpq/identity.mjs';
import {cpqLocation} from '../../public/OmniCPQ/browser-bridge-v2.mjs';
const origin='https://cpq-stg.apps.test-ocp.ts.telekom.si',app='https://www.mdlxdcc.org/omnicpq/';
function fixture(extra=''){
  const dom=new JSDOM(`<main><h1>Test configuration</h1><button id="add"><mat-icon>add</mat-icon></button><div id="card" style="cursor:pointer">Dodaj postavko</div><button id="menu"><mat-icon>more_vert</mat-icon></button><div role="group" aria-label="VM TEST"><label for="cpu">CPU</label><input id="cpu" type="number" min="1" max="24" value="1"><label for="ram">RAM</label><input id="ram" type="number" min="1" max="256" value="4"><button id="save">Shrani</button><p id="result"></p></div><a href="/sl/order/list">Naročila</a></main>${extra}`,{url:origin+'/sl/order/details/view/SYNTHETIC/configure',runScripts:'outside-only'});
  const w=dom.window,d=w.document;Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;w.CSS={escape:x=>x};
  let sequence=0;const positions=new WeakMap();
  w.HTMLElement.prototype.getBoundingClientRect=function(){if(!positions.has(this))positions.set(this,{x:20+(sequence++%9)*90,y:80+Math.floor(sequence/9)*38,width:70,height:30});const r=positions.get(this);return {...r,left:r.x,top:r.y,right:r.x+r.width,bottom:r.y+r.height};};
  w.HTMLElement.prototype.scrollIntoView=function(){positions.set(this,{x:20,y:300,width:70,height:30});};
  d.elementFromPoint=(x,y)=>[...d.querySelectorAll('*')].find(e=>{const r=positions.get(e);return r&&Math.round(r.x+r.width/2)===x&&Math.round(r.y+r.height/2)===y;})||d.body;
  let persisted=null,events=0;d.querySelector('#cpu').addEventListener('input',()=>events++);
  d.querySelector('#save').onclick=()=>{if(d.querySelector('#cpu').checkValidity()){persisted={cpu:d.querySelector('#cpu').value,ram:d.querySelector('#ram').value};d.querySelector('#result').textContent='Shranjeno';}else d.querySelector('#result').textContent='Validation failed';};
  d.querySelector('#menu').onclick=()=>{const menu=d.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<div role="menuitem" id="nested">Synthetic category</div>';d.body.append(menu);d.querySelector('#nested').onclick=()=>{menu.innerHTML='<button id="leaf">Synthetic product</button>';};};
  d.querySelector('#card').onclick=()=>{d.querySelector('h1').textContent='Item qualification';};
  const page=w.eval('('+cpqPageV2.toString()+')');
  const storage={},sent=[];let allSelected=false,lastMouse=null,onInput=null;
  const api={runtime:{id:BRIDGE_EXTENSION_ID,getURL:x=>'chrome-extension://'+BRIDGE_EXTENSION_ID+'/'+x},
    tabs:{get:async id=>id===13?{id,active:true,url:w.location.href}:{id,url:app}},
    storage:{session:{get:async k=>({[k]:structuredClone(storage[k])}),set:async o=>Object.assign(storage,structuredClone(o)),remove:async k=>{delete storage[k];}}},
    scripting:{executeScript:async p=>[{frameId:0,result:await page(p.args[0])}]},
    debugger:{attach:async()=>{},detach:async()=>{},sendCommand:async(_,name,p)=>{
      sent.push({name,...p});
      if(name==='Input.dispatchMouseEvent'&&p.type==='mousePressed'){lastMouse=d.elementFromPoint(p.x,p.y);lastMouse?.focus();await onInput?.();}
      if(name==='Input.dispatchMouseEvent'&&p.type==='mouseReleased')lastMouse?.click();
      if(name==='Input.dispatchKeyEvent'&&p.type==='rawKeyDown'){
        if(p.key==='a'&&p.modifiers===2)allSelected=true;
        if(p.key==='Backspace'){d.activeElement.value='';d.activeElement.dispatchEvent(new w.Event('input',{bubbles:true}));}
        if(p.key==='Tab'){d.activeElement.dispatchEvent(new w.Event('change',{bubbles:true}));d.activeElement.blur();}
      }
      if(name==='Input.insertText'){const e=d.activeElement;e.value=allSelected?p.text:e.value+p.text;allSelected=false;e.dispatchEvent(new w.Event('input',{bubbles:true}));}
    }}};
  const handle=makeGuiBridgeHandler(api),sender={url:app,frameId:0,tab:{id:23}},popup={id:BRIDGE_EXTENSION_ID,url:api.runtime.getURL('popup.html')};
  const request=(type,data={})=>handle({protocol:BRIDGE_PROTOCOL,type,...data},sender);
  const client=createBrowserBridge({runtime:{sendMessage:(_,m,cb)=>handle(m,sender).then(cb)}});
  const pair=async()=>{await client.connect().catch(()=>{});assert.equal((await handle({protocol:BRIDGE_PROTOCOL,type:'pair',cpqTabId:13,assistantTabId:23,scope:'order',allowWrites:true},popup,true)).ok,true);await client.connect();};
  const action=(o,label,operation,other={})=>({schema:'omnicpq.gui.action.v2',actionId:randomUUID(),observationId:o.id,revision:o.revision,targetId:o.controls.find(c=>c.label===label)?.id,operation,reason:'SYNTHETIC GOAL',expectedDocument:o.documentKey,...other});
  return {dom,w,d,page,client,pair,action,request,storage,sent,positions,api,handle,popup,persisted:()=>persisted,events:()=>events,setOnInput:f=>onInput=f};
}
test('real observer finds icon-only FAB, Angular div card and nested live overlay; hit-tested worker changes DOM',async()=>{
  const f=fixture();try{await f.pair();let o=await f.client.observe();assert(o.controls.some(c=>c.label==='Dodaj (+)'));assert(o.controls.some(c=>c.label==='Dodaj postavko'));
    let r=await f.client.execute(f.action(o,'Dodaj postavko','click'),{guidedAuthorization:true});assert.match(r.observation.text,/Item qualification/);
    o=await f.client.observe();await f.client.execute(f.action(o,'Ikona more_vert','click'));
    o=await f.client.observe();assert(o.controls.some(c=>c.kind==='menuitem'&&c.label==='Synthetic category'));
    await f.client.execute(f.action(o,'Synthetic category','click'));o=await f.client.observe();assert(o.controls.some(c=>c.label==='Synthetic product'));
  }finally{f.dom.window.close();}
});
test('Angular offering anchors without href remain individual hit-tested controls inside a Material card',async()=>{
  const f=fixture('<mat-card><section><a class="trow clickable" style="cursor:pointer" id="other"><div><span>Other offering</span></div></a><a class="trow clickable" style="cursor:pointer" id="so"><div><span>TS Suvereni oblak (paket) (Ikt.SO.Pck)</span></div></a><a href="https://outside.invalid/sl/order/list">External offering</a></section></mat-card>');
  try{let selected=null;f.d.querySelector('#other').onclick=()=>{selected='other';};f.d.querySelector('#so').onclick=()=>{selected='so';f.d.querySelector('#result').textContent='SO selected';};
    await f.pair();let o=await f.client.observe(0,180,'TS Suvereni oblak');
    const row=o.controls.find(c=>c.label==='TS Suvereni oblak (paket) (Ikt.SO.Pck)');assert(row,'offering row must be distinct from its Material container');assert.equal(row.kind,'button');assert.equal(row.href,undefined);
    const r=await f.client.execute(f.action(o,row.label,'click'),{guidedAuthorization:true});assert.equal(selected,'so');assert.match(r.observation.text,/SO selected/);
    o=await f.client.observe();assert(o.controls.some(c=>c.label==='Other offering'));assert(!o.controls.some(c=>c.label==='External offering'));
  }finally{f.dom.window.close();}
});
test('same-document editor fill reaches input listeners, clears previous value, validates and saves actual values',async()=>{
  const f=fixture();try{await f.pair();let o=await f.client.observe();assert(o.navigationLocked);
    assert.deepEqual(JSON.parse(JSON.stringify(o.controls.find(c=>c.label==='CPU').constraints)),{min:'1',max:'24'});
    const tooMany=f.action(o,'CPU','fill',{value:'32'});await assert.rejects(f.client.execute(tooMany,{guidedAuthorization:true}),/UI_CONSTRAINT_CONFLICT/);
    assert.equal(f.d.querySelector('#cpu').value,'1');
    o=await f.client.observe();let r=await f.client.execute(f.action(o,'CPU','fill',{value:'12'}),{guidedAuthorization:true});assert.equal(r.receipt.outcome,'OBSERVED_UI_VALUE_MATCH');assert(f.events()>0);
    o=await f.client.observe();await f.client.execute(f.action(o,'RAM','fill',{value:''}),{guidedAuthorization:true});assert.equal(f.d.querySelector('#ram').value,'');
    o=await f.client.observe();await f.client.execute(f.action(o,'RAM','fill',{value:'128'}),{guidedAuthorization:true});
    o=await f.client.observe();await f.client.execute(f.action(o,'Shrani','click'),{guidedAuthorization:true});assert.deepEqual(f.persisted(),{cpu:'12',ram:'128'});
    o=await f.client.observe();assert.match(o.text,/Shranjeno/);
  }finally{f.dom.window.close();}
});
test('multiline textarea keeps exact whitespace for observation and verified fill receipt',async()=>{
  const f=fixture('<label for="notes">Notes</label><textarea id="notes">old</textarea>');
  try{let committed;f.d.querySelector('#notes').onchange=e=>{committed=e.target.value;};await f.pair();const o=await f.client.observe(),value='  first line\nsecond line  ';
    const r=await f.client.execute(f.action(o,'Notes','fill',{value}),{guidedAuthorization:true});assert.equal(committed,value);assert.equal(r.observation.controls.find(c=>c.label==='Notes').value,value);assert.equal(r.receipt.outcome,'OBSERVED_UI_VALUE_MATCH');
  }finally{f.dom.window.close();}
});
test('fresh revision detects a human field edit; coverage prevents a wrong click; lock protects departure',async()=>{
  const f=fixture();try{await f.pair();let o=await f.client.observe(),a=f.action(o,'CPU','fill',{value:'12'});
    f.d.querySelector('#ram').value='17';await assert.rejects(f.client.execute(a,{guidedAuthorization:true}),/CPQ_SCREEN_CHANGED/);assert.equal(f.d.querySelector('#cpu').value,'1');
    o=await f.client.observe();a=f.action(o,'Shrani','click');const old=f.d.elementFromPoint;f.d.elementFromPoint=()=>f.d.body;
    await assert.rejects(f.client.execute(a,{guidedAuthorization:true}),/CPQ_TARGET_COVERED/);assert.equal(f.persisted(),null);f.d.elementFromPoint=old;
    o=await f.client.observe();const nav=f.action(o,'Naročila','click');await assert.rejects(f.client.execute(nav,{humanApproved:true}),/CPQ_UNSAVED_WORK_PROTECTED/);
  }finally{f.dom.window.close();}
});
test('targeted read reaches a field beyond first 180 controls and binds filtered action to its current revision',async()=>{
  const f=fixture(Array.from({length:220},(_,i)=>`<button>Extra ${i}</button>`).join('')+'<label for="needle">Needle destination</label><input id="needle">');
  try{await f.pair();let o=await f.client.observe();assert(o.paging.hasMore);assert(!o.controls.some(c=>c.label==='Needle destination'));
    const read={schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,operation:'read',query:'Needle destination',reason:'Find the requested field'};
    assert(navigationProposal('```omnicpq_action\n'+JSON.stringify(read)+'\n```',o));
    const r=await f.client.execute({...read,actionId:randomUUID()});o=r.observation;assert(o.controls.some(c=>c.label==='Needle destination'));
    // Offscreen target is scrolled into view before input.
    const scroll=f.action(o,'Needle destination','ensureVisible');await f.client.execute(scroll);o=await f.client.observe(0,180,'Needle destination');
    await f.client.execute(f.action(o,'Needle destination','fill',{value:'found'}),{guidedAuthorization:true});assert.equal(f.d.querySelector('#needle').value,'found');
  }finally{f.dom.window.close();}
});
test('STOP cancels remaining CDP inputs, consumes observation and requires resume plus fresh observation',async()=>{
  const f=fixture();try{await f.pair();let o=await f.client.observe();let once=false;
    f.setOnInput(async()=>{if(!once){once=true;await f.client.suspend();}});
    await assert.rejects(f.client.execute(f.action(o,'CPU','fill',{value:'12'}),{guidedAuthorization:true}),/OUTCOME_UNKNOWN/);
    assert.equal(f.d.querySelector('#cpu').value,'1');assert(!f.sent.some(p=>p.name==='Input.insertText'));
    await assert.rejects(f.client.execute(f.action(o,'CPU','fill',{value:'12'}),{guidedAuthorization:true}),/PAUSED/);
    f.setOnInput(null);await f.client.resume();await assert.rejects(f.client.execute(f.action(o,'CPU','fill',{value:'12'}),{guidedAuthorization:true}),/SCREEN_CHANGED/);
    o=await f.client.observe();await f.client.execute(f.action(o,'CPU','fill',{value:'12'}),{guidedAuthorization:true});assert.equal(f.d.querySelector('#cpu').value,'12');
  }finally{f.dom.window.close();}
});
test('real worker request registry feeds popup; local polling connects after exactly one pair and manual disconnect stays stopped',async()=>{
  const f=fixture();try{let scheduled,delay,checks=0;const statuses=[];
    const auto=createAutoConnector({eligible:()=>true,connect:async()=>{checks++;return f.client.connect();},changed:s=>statuses.push(s),schedule:(fn,ms)=>{scheduled=fn;delay=ms;return 1;},unschedule:()=>{scheduled=null;}});
    await auto.check();assert.equal(auto.status,'WAITING_APPROVAL');assert.equal(delay,4000);assert.equal(pendingRequests(f.storage.guiRequests).length,1);
    await f.pair();await scheduled();assert.equal(auto.status,'CONNECTED');assert.equal(delay,30000);assert.equal(f.sent.length,0);
    auto.stop();const count=checks;auto.wake();assert.equal(checks,count);assert.equal(scheduled,null);
    f.client.setIdentity('changed-owner');await assert.rejects(f.client.connect(),/NOT_PAIRED/);assert.equal(f.storage.guiPair,undefined);
  }finally{f.dom.window.close();}
});
test('budgets and no-progress signatures distinguish differing intended field values and preserve bounded goals',()=>{
  const run=createAgentRun('synthetic',{accountId:'owner',epoch:1,budget:{actions:2,modelCalls:3,durationMs:100},now:1000});
  assert.equal(runLimit(run,1001),null);assert.notEqual(actionSignature({revision:'r',targetId:'c0',operation:'fill',value:'1'}),actionSignature({revision:'r',targetId:'c0',operation:'fill',value:'2'}));
  run.step=2;assert.equal(runLimit(run,1001),'ACTION_BUDGET');run.step=0;run.modelCalls=3;assert.equal(runLimit(run,1001),'MODEL_BUDGET');assert.equal(runLimit(run,1100),'TIME_BUDGET');
});
test('actual popup consumes worker registration in split-screen and pairs once without a second PWA click',async()=>{
  const f=fixture(),dom=new JSDOM(await readFile('public/OmniCPQ/extension/popup.html','utf8'),{url:'https://extension.synthetic/',runScripts:'outside-only'});
  try{
    await f.client.connect().catch(()=>{});
    Object.assign(dom.window,{PAIR_REQUESTS:'guiRequests',pendingRequests,chrome:{...f.api,
      tabs:{...f.api.tabs,query:async()=>[{id:13,active:false,title:'SYNTHETIC CPQ SPLIT',url:f.w.location.href}]},
      runtime:{...f.api.runtime,sendMessage:m=>f.handle(m,f.popup,true)}}});
    const source=(await readFile('public/OmniCPQ/extension/popup.mjs','utf8')).replace(/^import .*;\n/gm,'').replace("tabs().catch(()=>status('Izbranega zavihka ni mogoče prebrati.'));","window.ready=tabs();");
    dom.window.eval(source);await dom.window.ready;
    const d=dom.window.document;assert.equal(d.querySelector('#assistant').options.length,1);assert.equal(d.querySelector('#pair').disabled,false);d.querySelector('#allow-writes').checked=true;
    await d.querySelector('#pair').onclick();assert.match(d.querySelector('#status').textContent,/Povezano/);assert((await f.client.connect()).capabilities.allowWrites);
  }finally{dom.window.close();f.dom.window.close();}
});
test('integrated PWA -> synthetic model handler -> actual worker -> DOM inputs/validation/save -> observed result',async()=>{
  const f=fixture(),dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'});let calls=0;
  try{
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC BUSINESS CONTEXT',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++;const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        let a;if(o.controls.find(c=>c.label==='CPU').value!=='12')a={targetId:o.controls.find(c=>c.label==='CPU').id,operation:'fill',value:'12'};
        else if(o.controls.find(c=>c.label==='RAM').value!=='128')a={targetId:o.controls.find(c=>c.label==='RAM').id,operation:'fill',value:'128'};
        else if(!o.text.includes('Shranjeno'))a={targetId:o.controls.find(c=>c.label==='Shrani').id,operation:'click'};
        onText(a?'Naslednji dovoljen korak.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC GOAL',...a})+'\n```':'Preverjeno: shranjeno 12 CPU in 128 RAM.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window;Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto});w.matchMedia=()=>({matches:false});w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,'');w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};');await w.ready;
    w.document.querySelector('#experimental-gui').checked=true;w.document.querySelector('#experimental-gui').onchange();await f.pair();await w.testApp.connectBrowser();
    w.document.querySelector('#message').value='Nadaljuj isti testni strežnik: 12 CPU, 128 RAM in shrani konfiguracijo.';w.document.querySelector('#browser-auto').checked=true;
    await w.testApp.send();assert.deepEqual(f.persisted(),{cpu:'12',ram:'128'});assert.equal(calls,4);assert.match(w.testApp.state.messages.at(-1).content,/Preverjeno: shranjeno/);
    assert.equal(w.testApp.state.agentRun.step,3);assert.equal(w.testApp.state.agentRun.modelCalls,4);assert.equal(w.testApp.state.busy,false);
  }finally{dom.window.close();f.dom.window.close();}
});
test('visible same-origin frame observation binds frame geometry and retains the same top document without reload',async()=>{
  const f=fixture('<iframe title="Synthetic embedded editor"></iframe>');try{
    const frame=f.d.querySelector('iframe'),fw=frame.contentWindow,fd=frame.contentDocument;
    fd.body.innerHTML='<label for="inside">Embedded value</label><input id="inside" value="kept">';
    fw.HTMLElement.prototype.getBoundingClientRect=function(){return {x:10,y:15,left:10,top:15,width:60,height:25,right:70,bottom:40};};
    fd.elementFromPoint=()=>fd.querySelector('input');
    const top=(await f.page({type:'observe',origin,scope:'order'})).observation;assert.equal(top.frames[0].path,'0');assert(top.frames[0].accessible);
    const r=await f.page({type:'observe',origin,scope:'order',framePath:'0'});assert(r.ok);assert.equal(r.observation.framePath,'0');
    assert.equal(r.observation.controls.find(c=>c.label==='Embedded value').value,'kept');assert.equal(r.observation.documentKey,'SYNTHETIC');
    assert.equal(r.observation.runtime.pageVersion,'1.2.2');assert.equal(f.d.querySelector('#cpu').value,'1');
    assert.equal((await f.page({type:'observe',origin,scope:'order',framePath:'99'})).error,'CPQ_FRAME_CHANGED');
  }finally{f.dom.window.close();}
});
test('STOP arriving while target preparation awaits cannot be overwritten by an older pair snapshot',async()=>{
  const f=fixture();try{
    await f.pair();const o=await f.client.observe(),original=f.api.scripting.executeScript;let stopped=false;
    f.api.scripting.executeScript=async p=>{const r=await original(p);if(p.args[0].type==='prepare'&&!stopped){stopped=true;await f.client.suspend();}return r;};
    await assert.rejects(f.client.execute(f.action(o,'CPU','fill',{value:'12'}),{guidedAuthorization:true}),/PAUSED/);
    assert.equal(f.d.querySelector('#cpu').value,'1');assert.equal(f.sent.length,0);
    const fresh=await f.client.observe();await assert.rejects(f.client.execute(f.action(fresh,'CPU','fill',{value:'12'}),{guidedAuthorization:true}),/PAUSED/);
  }finally{f.dom.window.close();}
});
test('explicit named STAGE goal inherits the matching business effect, never a different document or a negated/quoted request',()=>{
  const o={url:origin+'/sl/order/details/view/SYNTHETIC',title:'OMNI-99999 test',documentKey:'SYNTHETIC'};
  const grant=explicitGoalGrant('Prosim oddaj testno naročilo OMNI-99999',o);assert(grant);assert(goalGrantCovers(grant,{label:'Oddaj naročilo'},o));
  assert(!goalGrantCovers(grant,{label:'Izbriši'},o));assert(!goalGrantCovers(grant,{label:'Oddaj naročilo'},{...o,documentKey:'OTHER'}));
  for(const s of ['Ne oddaj OMNI-99999','Razloži kako oddaj OMNI-99999','»oddaj OMNI-99999«','Oddaj OMNI-00000','Če oddaj OMNI-99999'])assert.equal(explicitGoalGrant(s,o),null,s);
  assert.equal(explicitGoalGrant('Oddaj OMNI-99999',{...o,url:'https://cpq.apps.prod-ocp.ts.telekom.si/sl/order'}),null);
});
