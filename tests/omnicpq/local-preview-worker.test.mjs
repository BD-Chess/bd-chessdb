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
function fakeClock(){let t=0,id=0;const jobs=new Map();return {now:()=>t,schedule(fn,ms){const n=id++;jobs.set(n,{fn,at:t+ms});return n;},unschedule(n){jobs.delete(n);},advance(ms){t+=ms;for(const [n,j] of [...jobs].sort((a,b)=>a[1].at-b[1].at))if(j.at<=t&&jobs.has(n)){jobs.delete(n);j.fn();}}};}
const micro=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
async function actualWorkerHarness(){
 const f=fixture(),dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,c=fakeClock();let posts=0;
 Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,previewClock:c,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});Object.defineProperty(w,'crypto',{value:webcrypto});w.matchMedia=()=>({matches:false});
 w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
 w.fetch=async(path,options={})=>{if(options.method==='POST')posts++;return Response.json({ok:true,available:true,version:core.APP_VERSION,account:{id:'SYNTHETIC_OWNER',role:'owner'},privateKnowledge:'VERIFIED',starterPrompts:{version:starters.STARTER_VERSION,sha256:await core.digest(JSON.stringify(starters.STARTERS))},skill:{promptsSha256:prompts.PROMPTS_SHA256},services:[]});};
 const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\r?\n/gm,'').replace('now:()=>performance.now(),schedule:(fn,ms)=>window.setTimeout(fn,ms),unschedule:id=>window.clearTimeout(id),intervalMs:30000,focusDelayMs:100','now:()=>previewClock.now(),schedule:(fn,ms)=>previewClock.schedule(fn,ms),unschedule:id=>previewClock.unschedule(id),intervalMs:30000,focusDelayMs:100').replace('health(); installWorker();','window.ready=health();');
 w.eval(source+'\nwindow.testApp={state,connectBrowser,autoConnector,previewRefresher};');await w.ready;w.testApp.autoConnector.stop();await f.pair();await w.testApp.connectBrowser();
 return {f,w,dom,c,get posts(){return posts;},async settle(){await micro();await w.testApp.previewRefresher.whenSettled();await micro();},close(){w.testApp.previewRefresher.stop();w.testApp.autoConnector.stop();dom.window.close();f.dom.window.close();}};
}
test('REAL_WORKER_PREVIEW focus sees synthetic CPQ edit without AI or input',async()=>{const h=await actualWorkerHarness();try{const readRam=()=>h.w.testApp.state.browserObservation.controls.find(x=>x.label==='RAM')?.value;assert.equal(readRam(),'4');h.f.d.querySelector('#ram').value='12';h.w.dispatchEvent(new h.w.Event('focus'));h.c.advance(100);await h.settle();assert.equal(readRam(),'12');assert.equal(h.posts,0);assert.equal(h.f.sent.filter(e=>e.name.startsWith('Input.')).length,0);}finally{h.close();}});
test('REAL_WORKER_PREVIEW optout retains old preview after synthetic CPQ edit',async()=>{const h=await actualWorkerHarness();try{const input=h.w.document.querySelector('#browser-preview-auto');input.checked=false;input.onchange();h.f.d.querySelector('#ram').value='12';h.w.dispatchEvent(new h.w.Event('focus'));h.c.advance(30100);await h.settle();assert.equal(h.w.testApp.state.browserObservation.controls.find(x=>x.label==='RAM')?.value,'4');assert.equal(h.posts,0);assert.equal(h.f.sent.filter(e=>e.name.startsWith('Input.')).length,0);}finally{h.close();}});