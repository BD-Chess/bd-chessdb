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

const NAV_SOURCE='public/OmniCPQ/app.mjs';
async function auditNavigation({html='',goal,actions,setup=()=>{},profile='fast',onModelStep=()=>{}}){
 const f=fixture(html),dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:app,runScripts:'outside-only',pretendToBeVisual:true}),stats={calls:0,clicks:{},observations:[]};
 try{
  setup(f,stats);
  const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,retrieve:async()=>({skill:SKILL,text:'SYNTHETIC ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
  const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'owner',role:'owner'}),knowledgeFactory:async()=>k,budgetFactory:()=>({reserve:async()=>null,settle:async()=>null}),transport:async({payload,onText})=>{
   stats.calls++;const input=payload.input.at(-1).content[0].text,o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;stats.observations.push({revision:o.revision,labels:o.controls.map(c=>c.label),query:o.paging?.query});
   onModelStep(f,stats,stats.calls,o);const next=actions[stats.calls-1];let text='Synthetic complete.';
   if(next){const target=next.label?o.controls.find(c=>c.label===next.label):o.controls[0];assert(target,'SYNTHETIC_TARGET_NOT_FOUND');const {label,...rest}=next;
    const a={schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,expectedDocument:o.documentKey,reason:'SYNTHETIC',operation:'click',targetId:target.id,...rest};text='Synthetic step.\n'+String.fromCharCode(96).repeat(3)+'omnicpq_action\n'+JSON.stringify(a)+'\n'+String.fromCharCode(96).repeat(3);}
   onText(text);return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
  }});
  const w=dom.window;Object.assign(w,{...appRuntime,...core,...prompts,...starters,cpqLocation,createBrowserBridge:()=>f.client,Response,Blob,AbortController,TextEncoder});Object.defineProperty(w,'crypto',{value:webcrypto});w.matchMedia=()=>({matches:false});w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
  w.fetch=(path,options={})=>handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));
  const source=(await readFile(NAV_SOURCE,'utf8')).replace(/^import .*;\r?\n/gm,'');w.eval(source.replace('health(); installWorker();','window.ready=health();')+'\nwindow.testApp={state,send,connectBrowser,autoConnector};');await w.ready;w.testApp.autoConnector.stop();
  w.document.querySelector('#experimental-gui').checked=true;w.document.querySelector('#experimental-gui').onchange();await f.pair();await w.testApp.connectBrowser();w.testApp.state.profile=profile;
  w.document.querySelector('#message').value=goal;w.document.querySelector('#browser-auto').checked=true;await w.testApp.send();
  stats.checkpoint=w.testApp.state.guiCheckpoint;stats.navigation=w.testApp.state.messages.filter(m=>m.role==='assistant').map(m=>m.meta.browserNavigation);stats.mouseEvents=f.sent.filter(e=>e.name==='Input.dispatchMouseEvent').length;stats.finalRam=f.d.querySelector('#ram').value;return stats;
 }finally{dom.window.testApp?.autoConnector.stop();dom.window.close();f.dom.window.close();}
}
const twoButtons='<button id="a">A</button><button id="b">B</button>';
const listen=(f,s,id,effect=()=>{})=>{f.d.querySelector('#'+id).onclick=()=>{s.clicks[id]=(s.clicks[id]||0)+1;effect();};};

for(const profile of ['fast','careful']){
 test('MIXED_WORKER wrong ordinary navigation before edit is not dispatched '+profile,async()=>{const r=await auditNavigation({html:'<button id="wrong">Stranke</button>',goal:'Odpri Naročila in nastavi RAM na 12',actions:[{label:'Stranke'}],profile,setup:(f,s)=>listen(f,s,'wrong')});assert.deepEqual(r.clicks,{});assert.equal(r.mouseEvents,0);assert.equal(r.finalRam,'4');assert.equal(r.navigation[0].error,'CPQ_OBSERVED_DESTINATION_MISMATCH');});
 test('MIXED_WORKER observed navigation prefix then exact RAM write preserved '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button>',goal:'Odpri A in nastavi RAM na 12',actions:[{label:'A'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>listen(f,s,'a',()=>{f.d.title='A';})});assert.deepEqual(r.clicks,{a:1});assert.equal(r.finalRam,'12');assert.equal(r.calls,3);});
 test('MIXED_WORKER dependent explicit multistep prefix then exact write '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button>',goal:'Odpri A in nato odpri B in nastavi RAM na 12',actions:[{label:'A'},{label:'B'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>listen(f,s,'a',()=>{const b=f.d.createElement('button');b.id='b';b.textContent='B';f.d.body.append(b);listen(f,s,'b',()=>{f.d.title='B';});})});assert.deepEqual(r.clicks,{a:1,b:1});assert.equal(r.finalRam,'12');assert.equal(r.calls,4);});
 test('MIXED_WORKER explicit edit followed by exact navigation suffix preserved '+profile,async()=>{const r=await auditNavigation({html:'<button id="b">B</button>',goal:'Nastavi RAM na 12 in odpri B',actions:[{label:'RAM',operation:'fill',value:'12'},{label:'B'}],profile,setup:(f,s)=>listen(f,s,'b',()=>{f.d.title='B';})});assert.deepEqual(r.clicks,{b:1});assert.equal(r.finalRam,'12');assert.equal(r.calls,3);});
 test('MIXED_WORKER no-op prefix never reaches next target or field '+profile,async()=>{const r=await auditNavigation({html:twoButtons,goal:'Odpri A in nato odpri B in nastavi RAM na 12',actions:[{label:'A'},{label:'B'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>{listen(f,s,'a');listen(f,s,'b');}});assert.deepEqual(r.clicks,{a:1});assert.equal(r.finalRam,'4');assert.equal(r.calls,1);assert.equal(r.navigation[0].receipt.status,'DISPATCHED');assert.equal(r.navigation[0].effect,'UNPROVEN');});
 test('MIXED_WORKER interleaved unmodeled route is reviewed '+profile,async()=>{const r=await auditNavigation({html:twoButtons,goal:'Odpri A in nastavi RAM na 12 in odpri B',actions:[{label:'A'}],profile,setup:(f,s)=>{listen(f,s,'a');listen(f,s,'b');}});assert.deepEqual(r.clicks,{});assert.equal(r.finalRam,'4');assert.equal(r.calls,1);assert.equal(r.navigation[0].error,'CPQ_NAVIGATION_PATH_UNPROVEN');});
 test('MIXED_WORKER duplicate destination remains held with edit tail '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">Podrobnosti</button><button id="b">Podrobnosti</button>',goal:'Odpri Podrobnosti in nastavi RAM na 12',actions:[{label:'Podrobnosti'}],profile,setup:(f,s)=>{listen(f,s,'a');listen(f,s,'b');}});assert.deepEqual(r.clicks,{});assert.equal(r.finalRam,'4');assert.equal(r.mouseEvents,0);assert.equal(r.navigation[0].error,'CPQ_NAVIGATION_TARGET_AMBIGUOUS');});
}

for(const profile of ['fast','careful'])for(const [label,goal]of [['Naročila','Odpri "Naročila" in nastavi RAM na 12'],['Naročila','Odpri »Naročila« in nastavi RAM na 12']])test('MIXED_WORKER quoted requested target cannot be swallowed '+profile+' '+goal,async()=>{const r=await auditNavigation({html:'<button id="wrong">Stranke</button>',goal,actions:[{label:'Stranke'}],profile,setup:(f,s)=>listen(f,s,'wrong')});assert.deepEqual(r.clicks,{});assert.equal(r.mouseEvents,0);assert.equal(r.finalRam,'4');assert.equal(r.navigation[0].error,'CPQ_OBSERVED_DESTINATION_MISMATCH');});
for(const profile of ['fast','careful'])for(const goal of ['Odpri "A" in nastavi RAM na 12','Odpri »A« in nastavi RAM na 12'])test('MIXED_WORKER quoted prefix then exact field stays usable '+profile+' '+goal,async()=>{const r=await auditNavigation({html:'<button id="a">A</button>',goal,actions:[{label:'A'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>listen(f,s,'a',()=>{f.d.title='A';})});assert.deepEqual(r.clicks,{a:1});assert.equal(r.finalRam,'12');assert.equal(r.calls,3);});

for(const profile of ['fast','careful']){
 test('VISIBLE_WORKER requestedRAM already visible blocks unrelatedStranke '+profile,async()=>{const r=await auditNavigation({html:'<button id="wrong">Stranke</button>',goal:'Nastavi RAM na 12',actions:[{label:'Stranke'}],profile,setup:(f,s)=>listen(f,s,'wrong')});assert.deepEqual(r.clicks,{});assert.equal(r.mouseEvents,0);assert.equal(r.finalRam,'4');assert.equal(r.navigation[0].error,'CPQ_VISIBLE_FIELD_UNRELATED_TARGET');});
 test('VISIBLE_WORKER all known requestedfields visible blocks unrelated '+profile,async()=>{const r=await auditNavigation({html:'<button id="wrong">Stranke</button>',goal:'Nastavi RAM na 12 in CPU na 4',actions:[{label:'Stranke'}],profile,setup:(f,s)=>listen(f,s,'wrong')});assert.deepEqual(r.clicks,{});assert.equal(r.mouseEvents,0);assert.equal(r.finalRam,'4');});
 test('VISIBLE_WORKER direct exact write remains executable '+profile,async()=>{const r=await auditNavigation({goal:'Nastavi RAM na 12',actions:[{label:'RAM',operation:'fill',value:'12'}],profile});assert.equal(r.finalRam,'12');assert.equal(r.calls,2);});
 test('VISIBLE_WORKER requestedfield focus then exact write preserved '+profile,async()=>{const r=await auditNavigation({goal:'Nastavi RAM na 12',actions:[{label:'RAM'},{label:'RAM',operation:'fill',value:'12'}],profile});assert.equal(r.finalRam,'12');assert.equal(r.calls,3);});
 test('VISIBLE_WORKER explicit named ordinary step remains allowed '+profile,async()=>{const r=await auditNavigation({html:'<button id="step">Podrobnosti</button>',goal:'Klikni Podrobnosti in nastavi RAM na 12',actions:[{label:'Podrobnosti'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>listen(f,s,'step')});assert.deepEqual(r.clicks,{step:1});assert.equal(r.finalRam,'12');assert.equal(r.calls,3);});
 test('VISIBLE_WORKER quoted named ordinary step cannot be split '+profile,async()=>{const r=await auditNavigation({html:'<button id="step">Podrobnosti in pregled</button>',goal:'Klikni "Podrobnosti in pregled" in nastavi RAM na 12',actions:[{label:'Podrobnosti in pregled'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>listen(f,s,'step')});assert.deepEqual(r.clicks,{step:1});assert.equal(r.finalRam,'12');});
 test('VISIBLE_WORKER missingfield can use observed configuration container then fill '+profile,async()=>{const r=await auditNavigation({html:'<button id="config">Konfiguracija</button>',goal:'Nastavi RAM na 12',actions:[{label:'Konfiguracija'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>{f.d.querySelector('#ram').remove();f.d.querySelector('label[for="ram"]').remove();listen(f,s,'config',()=>{const label=f.d.createElement('label'),input=f.d.createElement('input');label.htmlFor='ram';label.textContent='RAM';input.id='ram';input.type='number';input.min='1';input.max='256';input.value='4';f.d.querySelector('[role="group"]').append(label,input);});}});assert.deepEqual(r.clicks,{config:1});assert.equal(r.finalRam,'12');assert.equal(r.calls,3);});
}

for(const profile of ['fast','careful']){
 test('COMPLETED_NAV requestedfield focus then fill remains executable '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button>',goal:'Odpri A in nastavi RAM na 12',actions:[{label:'A'},{label:'RAM'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>listen(f,s,'a',()=>{f.d.title='A';})});assert.deepEqual(r.clicks,{a:1});assert.equal(r.finalRam,'12');assert.equal(r.calls,4);assert.equal(r.navigation[1].receipt.status,'DISPATCHED');});
 test('COMPLETED_NAV dependent multistep then requestedfield focus '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button>',goal:'Odpri A in nato odpri B in nastavi RAM na 12',actions:[{label:'A'},{label:'B'},{label:'RAM'},{label:'RAM',operation:'fill',value:'12'}],profile,setup:(f,s)=>listen(f,s,'a',()=>{const b=f.d.createElement('button');b.id='b';b.textContent='B';f.d.body.append(b);listen(f,s,'b',()=>{f.d.title='B';});})});assert.deepEqual(r.clicks,{a:1,b:1});assert.equal(r.finalRam,'12');assert.equal(r.calls,5);});
 test('COMPLETED_NAV no fieldfocus exception before requestednav completed '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button>',goal:'Odpri A in nastavi RAM na 12',actions:[{label:'RAM'}],profile,setup:(f,s)=>listen(f,s,'a',()=>{f.d.title='A';})});assert.deepEqual(r.clicks,{});assert.equal(r.finalRam,'4');assert.equal(r.mouseEvents,0);assert.equal(r.navigation[0].error,'CPQ_OBSERVED_DESTINATION_MISMATCH');});
 test('COMPLETED_NAV unrelated target remains held after provennavigation '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button><button id="wrong">Stranke</button>',goal:'Odpri A in nastavi RAM na 12',actions:[{label:'A'},{label:'Stranke'}],profile,setup:(f,s)=>{listen(f,s,'a',()=>{f.d.title='A';});listen(f,s,'wrong');}});assert.deepEqual(r.clicks,{a:1});assert.equal(r.finalRam,'4');assert.equal(r.calls,2);assert.equal(r.navigation[1].error,'CPQ_NAVIGATION_PATH_UNPROVEN');});
 test('COMPLETED_NAV duplicate requestedfield does not get focusexception '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button><label for="other-ram">RAM</label><input id="other-ram" type="number" value="8">',goal:'Odpri A in nastavi RAM na 12',actions:[{label:'A'},{label:'RAM'}],profile,setup:(f,s)=>listen(f,s,'a',()=>{f.d.title='A';})});assert.deepEqual(r.clicks,{a:1});assert.equal(r.finalRam,'4');assert.equal(r.navigation[1].error,'CPQ_NAVIGATION_PATH_UNPROVEN');});
 test('COMPLETED_NAV changed document cannot reuse priorfocus proof '+profile,async()=>{const r=await auditNavigation({html:'<button id="a">A</button>',goal:'Odpri A in nastavi RAM na 12',actions:[{label:'A'},{label:'RAM'},{label:'RAM'}],profile,setup:(f,s)=>listen(f,s,'a',()=>{f.d.title='A';}),onModelStep:(f,s,n)=>{if(n===2)f.w.history.replaceState({},'',origin+'/sl/order/details/view/SYNTHETIC_OTHER/configure');}});assert.deepEqual(r.clicks,{a:1});assert.equal(r.finalRam,'4');assert.equal(r.calls,3);assert.equal(r.navigation.at(-1).error,'CPQ_NAVIGATION_PATH_UNPROVEN');});
}
