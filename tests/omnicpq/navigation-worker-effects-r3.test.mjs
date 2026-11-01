import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,webcrypto,createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {cpqPageV2} from '../../public/OmniCPQ/extension/page-v2.mjs';
import {makeGuiBridgeHandler} from '../../public/OmniCPQ/extension/worker-v2.mjs';
import {createBrowserBridge,BRIDGE_EXTENSION_ID,BRIDGE_PROTOCOL,navigationProposal} from '../../public/OmniCPQ/browser-bridge-v2.mjs';
import {pendingRequests} from '../../public/OmniCPQ/extension/pairing.mjs';
import {createAutoConnector} from '../../public/OmniCPQ/auto-connect.mjs';
import {createAgentRun,runLimit,actionSignature,explicitGoalGrant,goalGrantCovers,configuredChoiceGuard,conversationForModel} from '../../public/OmniCPQ/agent-session.mjs';
import {readFile} from 'node:fs/promises';
import * as appRuntime from './app-runtime-imports.mjs';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
import * as starters from '../../public/OmniCPQ/starters.mjs';
import {makeHandler} from '../../functions/omnicpq-assistant.mjs';
import {SKILL} from '../../functions/lib/omnicpq/identity.mjs';
import {cpqLocation} from '../../public/OmniCPQ/browser-bridge-v2.mjs';
import {validateGuiBrowser,guiInstructions} from '../../functions/lib/omnicpq/browser-v2.mjs';const origin='https://cpq-stg.apps.test-ocp.ts.telekom.si',app='https://www.mdlxdcc.org/omnicpq/';
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
test('NAV_WORKER_NEGATIVE wrong navigation destination must stay unclicked',async()=>{
 const f=fixture('<button id="unrelated">Stranke</button>'),dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only',pretendToBeVisual:true});let calls=0,clicked=0;
 try{
  f.d.querySelector('#unrelated').onclick=()=>{clicked++;f.d.querySelector('#result').textContent='Unrelated synthetic view';};
  const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
  const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
   calls++;const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
   if(calls===1){const requested=o.controls.filter(c=>c.label==='Naročila');console.log('NAV_SCOPE_METADATA',JSON.stringify({requestedCount:requested.length,requestedKinds:requested.map(c=>c.kind),requestedVisible:requested.map(c=>c.visibleInViewport),requestedEnabled:requested.map(c=>c.enabled),dialogOpen:o.dialogOpen,navigationLocked:o.navigationLocked}));}
   const a={targetId:o.controls.find(c=>c.label==='Stranke').id,operation:'click'};
   onText(calls===1?'Synthetic wrong target.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
  }});
  const w=dom.window;Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});Object.defineProperty(w,'crypto',{value:webcrypto});w.matchMedia=()=>({matches:false});w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
  w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
  const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,'');w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser,autoConnector};');await w.ready;w.testApp.autoConnector.stop();
  w.document.querySelector('#experimental-gui').checked=true;w.document.querySelector('#experimental-gui').onchange();await f.pair();await w.testApp.connectBrowser();
  w.document.querySelector('#message').value='Odpri Naročila';w.document.querySelector('#browser-auto').checked=true;await w.testApp.send();
  console.log('NAV_WORKER_RESULT',JSON.stringify({clicked,modelCalls:calls,events:f.sent.filter(e=>e.name==='Input.dispatchMouseEvent').length}));assert.equal(clicked,0);
 }finally{dom.window.testApp?.autoConnector.stop();dom.window.close();f.dom.window.close();}
});

const NAV_SOURCE='public/OmniCPQ/app.mjs';
async function auditNavigation({html='',goal,actions,setup=()=>{},profile='fast'}){
 const f=fixture(html),dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only',pretendToBeVisual:true}),stats={calls:0,clicks:{},observations:[]};
 try{
  setup(f,stats);
  const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
  const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
   stats.calls++;const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;stats.observations.push({revision:o.revision,labels:o.controls.map(c=>c.label),query:o.paging?.query});
   const next=actions[stats.calls-1];let text='Synthetic complete.';
   if(next){const target=next.label?o.controls.find(c=>c.label===next.label):o.controls[0];assert(target,'SYNTHETIC_TARGET_NOT_FOUND');const {label,...rest}=next;
    const a={schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',operation:'click',targetId:target.id,...rest};text='Synthetic step.\n'+String.fromCharCode(96).repeat(3)+'omnicpq_action\n'+JSON.stringify(a)+'\n'+String.fromCharCode(96).repeat(3);}
   onText(text);return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
  }});
  const w=dom.window;Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});Object.defineProperty(w,'crypto',{value:webcrypto});w.matchMedia=()=>({matches:false});w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
  w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
  const source=(await readFile(NAV_SOURCE,'utf8')).replace(/^import .*;\r?\n/gm,'');w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser,autoConnector};');await w.ready;w.testApp.autoConnector.stop();
  w.document.querySelector('#experimental-gui').checked=true;w.document.querySelector('#experimental-gui').onchange();await f.pair();await w.testApp.connectBrowser();w.testApp.state.profile=profile;
  w.document.querySelector('#message').value=goal;w.document.querySelector('#browser-auto').checked=true;await w.testApp.send();
  stats.checkpoint=w.testApp.state.guiCheckpoint;stats.navigation=w.testApp.state.messages.filter(m=>m.role==='assistant').map(m=>m.meta.browserNavigation);stats.mouseEvents=f.sent.filter(e=>e.name==='Input.dispatchMouseEvent').length;return stats;
 }finally{dom.window.testApp?.autoConnector.stop();dom.window.close();f.dom.window.close();}
}
const twoButtons='<button id="a">A</button><button id="b">B</button>';
const listen=(f,s,id,effect=()=>{})=>{f.d.querySelector('#'+id).onclick=()=>{s.clicks[id]=(s.clicks[id]||0)+1;effect();};};
for(const profile of ['fast','careful']){
 test('NAV_WORKER no-op first step never dispatches next '+profile,async()=>{const r=await auditNavigation({html:twoButtons,goal:'Odpri A in nato odpri B',actions:[{label:'A'},{label:'B'}],profile,setup:(f,s)=>{listen(f,s,'a');listen(f,s,'b');}});assert.deepEqual(r.clicks,{a:1});assert.equal(r.calls,1);assert.equal(r.navigation[0].error,'CPQ_NAVIGATION_EFFECT_UNPROVEN');assert.equal(r.navigation[0].receipt.status,'DISPATCHED');assert.equal(r.checkpoint.status,'DISPATCHED_EFFECT_UNPROVEN');});
 test('NAV_WORKER unrelated revision change cannot advance path '+profile,async()=>{const r=await auditNavigation({html:twoButtons,goal:'Odpri A in nato odpri B',actions:[{label:'A'},{label:'B'}],profile,setup:(f,s)=>{listen(f,s,'a',()=>{f.d.title='Unrelated synthetic update';});listen(f,s,'b');}});assert.deepEqual(r.clicks,{a:1});assert.equal(r.calls,1);assert.equal(r.navigation[0].effect,'UNPROVEN');});
 test('NAV_WORKER explicit path advances after new dependent control is observed '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button>',goal:'Odpri A in nato odpri B',actions:[{label:'A'},{label:'B'}],profile,setup:(f,s)=>{listen(f,s,'a',()=>{const b=f.d.createElement('button');b.id='b';b.textContent='B';f.d.body.append(b);listen(f,s,'b',()=>{f.d.title='B';});});}});assert.deepEqual(r.clicks,{a:1,b:1});assert.equal(r.calls,3);assert.notEqual(r.observations[0].revision,r.observations[1].revision);assert.equal(r.navigation[0].receipt.status,'DISPATCHED');assert.equal(r.navigation[1].receipt.status,'DISPATCHED');});
 test('NAV_WORKER exact newly observed destination title supports listed path '+profile,async()=>{const r=await auditNavigation({html:twoButtons,goal:'Odpri A in nato odpri B',actions:[{label:'A'},{label:'B'}],profile,setup:(f,s)=>{listen(f,s,'a',()=>{f.d.title='A';});listen(f,s,'b',()=>{f.d.title='B';});}});assert.deepEqual(r.clicks,{a:1,b:1});assert.equal(r.calls,3);});
}
for(const goal of ['Klikni Podrobnosti','Odpri Podrobnosti'])test('NAV_WORKER duplicate same-label target held '+goal,async()=>{const r=await auditNavigation({html:'<button id="a">Podrobnosti</button><button id="b">Podrobnosti</button>',goal,actions:[{label:'Podrobnosti'}],setup:(f,s)=>{listen(f,s,'a');listen(f,s,'b');}});assert.deepEqual(r.clicks,{});assert.equal(r.mouseEvents,0);assert.equal(r.calls,1);assert.equal(r.navigation[0].error,'CPQ_NAVIGATION_TARGET_AMBIGUOUS');});
test('NAV_WORKER observed aria-qualified instance selects exactly named B',async()=>{const r=await auditNavigation({html:'<button id="a" aria-label="Podrobnosti SYNTHETIC ROW A">Podrobnosti</button><button id="b" aria-label="Podrobnosti SYNTHETIC ROW B">Podrobnosti</button>',goal:'Odpri "Podrobnosti SYNTHETIC ROW B"',actions:[{label:'Podrobnosti SYNTHETIC ROW B'}],setup:(f,s)=>{listen(f,s,'a');listen(f,s,'b',()=>{f.d.title='Podrobnosti SYNTHETIC ROW B';});}});assert.deepEqual(r.clicks,{b:1});assert.equal(r.calls,2);assert.equal(r.navigation[0].receipt.status,'DISPATCHED');});
test('NAV_WORKER read-query cannot discard previously observed duplicate',async()=>{const r=await auditNavigation({html:'<div role="group">ROW A<button id="a">Podrobnosti</button></div><div role="group">ROW B<button id="b">Podrobnosti</button></div>',goal:'Klikni Podrobnosti',actions:[{operation:'read',query:'ROW A'},{label:'Podrobnosti'}],setup:(f,s)=>{listen(f,s,'a');listen(f,s,'b');}});assert.deepEqual(r.clicks,{});assert.equal(r.calls,2);assert.equal(r.navigation[0].receipt.status,'READ_ONLY');assert.equal(r.navigation[1].error,'CPQ_NAVIGATION_TARGET_AMBIGUOUS');});
test('NAV_WORKER missing target cannot authorize unrelated ordinary intermediate',async()=>{const r=await auditNavigation({html:'<button id="a">Stranke</button>',goal:'Odpri Ponudbe',actions:[{label:'Stranke'}],setup:(f,s)=>listen(f,s,'a')});assert.deepEqual(r.clicks,{});assert.equal(r.calls,2);assert.equal(r.navigation[0].error,'CPQ_NAVIGATION_PATH_UNPROVEN');});
