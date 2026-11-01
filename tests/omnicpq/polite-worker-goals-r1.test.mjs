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
import {validateGuiBrowser,guiInstructions} from '../../functions/lib/omnicpq/browser-v2.mjs';
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

test('POLITE_ACTUAL_WORKER VALUE_POSITIVE/SL',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='RAM').id,operation:'fill',value:'128'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Ali lahko nastaviš RAM na 128?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.d.querySelector('#ram').value,'128');
  } finally {dom.window.close();f.dom.window.close();}
});

test('POLITE_ACTUAL_WORKER VALUE_POSITIVE/EN',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='RAM').id,operation:'fill',value:'128'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Can you set RAM to 128?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.d.querySelector('#ram').value,'128');
  } finally {dom.window.close();f.dom.window.close();}
});

test('POLITE_ACTUAL_WORKER WRONG_FIELD/SL',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='CPU').id,operation:'fill',value:'12'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Ali lahko nastaviš RAM na 128?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.d.querySelector('#cpu').value,'1');
  } finally {dom.window.close();f.dom.window.close();}
});

test('POLITE_ACTUAL_WORKER WRONG_FIELD/EN',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='CPU').id,operation:'fill',value:'12'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Can you set RAM to 128?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.d.querySelector('#cpu').value,'1');
  } finally {dom.window.close();f.dom.window.close();}
});

test('POLITE_ACTUAL_WORKER WRONG_VALUE/SL',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='RAM').id,operation:'fill',value:'12'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Ali lahko nastaviš RAM na 128?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.d.querySelector('#ram').value,'4');
  } finally {dom.window.close();f.dom.window.close();}
});

test('POLITE_ACTUAL_WORKER WRONG_VALUE/EN',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='RAM').id,operation:'fill',value:'12'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Can you set RAM to 128?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.d.querySelector('#ram').value,'4');
  } finally {dom.window.close();f.dom.window.close();}
});

test('POLITE_ACTUAL_WORKER EARLY_SAVE/SL',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='Shrani').id,operation:'click'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Ali lahko nastaviš RAM 128 in nato shraniš?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.persisted(),null);
  } finally {dom.window.close();f.dom.window.close();}
});


test('POLITE_ACTUAL_WORKER EARLY_SAVE/EN',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='Shrani').id,operation:'click'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Can you set RAM to 128 and save?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.persisted(),null);
  } finally {dom.window.close();f.dom.window.close();}
});


test('POLITE_ACTUAL_WORKER WRONG_CLICK/SL',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='Shrani').id,operation:'click'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Ali lahko klikneš Podrobnosti?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.persisted(),null);
  } finally {dom.window.close();f.dom.window.close();}
});

test('POLITE_ACTUAL_WORKER WRONG_CLICK/EN',async()=>{
  const f=fixture(), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.find(c=>c.label==='Shrani').id,operation:'click'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Can you click Podrobnosti?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.persisted(),null);
  } finally {dom.window.close();f.dom.window.close();}
});

test('POLITE_ACTUAL_WORKER AMBIGUOUS_INSTANCE/SL',async()=>{
  const f=fixture('<label for="ram2">RAM</label><input id="ram2" type="number" value="8">'), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.filter(c=>c.label==='RAM').at(-1).id,operation:'fill',value:'128'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Ali lahko nastaviš RAM na 128?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.d.querySelector('#ram2').value,'8');
  } finally {dom.window.close();f.dom.window.close();}
});


test('POLITE_ACTUAL_WORKER AMBIGUOUS_INSTANCE/EN',async()=>{
  const f=fixture('<label for="ram2">RAM</label><input id="ram2" type="number" value="8">'), dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only'}); let calls=0;
  try {
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
        calls++; const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        const a={targetId:o.controls.filter(c=>c.label==='RAM').at(-1).id,operation:'fill',value:'128'};
        onText(calls===1?'Synthetic wrong proposal.\n```omnicpq_action\n'+JSON.stringify({schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',...a})+'\n```':'Synthetic complete.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window; Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.matchMedia=()=>({matches:false}); w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
    const source=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,''); w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser};'); await w.ready;
    w.document.querySelector('#experimental-gui').checked=true; w.document.querySelector('#experimental-gui').onchange(); await f.pair(); await w.testApp.connectBrowser();
    w.document.querySelector('#message').value="Can you set RAM to 128?"; w.document.querySelector('#browser-auto').checked=true; await w.testApp.send();
    assert.equal(f.d.querySelector('#ram2').value,'8');
  } finally {dom.window.close();f.dom.window.close();}
});


test('POLITE_ACTUAL_WORKER MULTI_SAVE/SL',async()=>{
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
    w.document.querySelector('#message').value="Ali lahko nastaviš CPU na 12 in RAM na 128 in nato shraniš?";w.document.querySelector('#browser-auto').checked=true;
    await w.testApp.send();assert.deepEqual(f.persisted(),{cpu:'12',ram:'128'});assert.equal(calls,4);assert.match(w.testApp.state.messages.at(-1).content,/Preverjeno: shranjeno/);
    assert.equal(w.testApp.state.agentRun.step,3);assert.equal(w.testApp.state.agentRun.modelCalls,4);assert.equal(w.testApp.state.busy,false);
  }finally{dom.window.close();f.dom.window.close();}
});
test('POLITE_ACTUAL_WORKER MULTI_SAVE/EN',async()=>{
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
    w.document.querySelector('#message').value="Can you set CPU to 12 and RAM to 128 and save?";w.document.querySelector('#browser-auto').checked=true;
    await w.testApp.send();assert.deepEqual(f.persisted(),{cpu:'12',ram:'128'});assert.equal(calls,4);assert.match(w.testApp.state.messages.at(-1).content,/Preverjeno: shranjeno/);
    assert.equal(w.testApp.state.agentRun.step,3);assert.equal(w.testApp.state.agentRun.modelCalls,4);assert.equal(w.testApp.state.busy,false);
  }finally{dom.window.close();f.dom.window.close();}
});
