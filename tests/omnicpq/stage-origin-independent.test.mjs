import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {cpqUrl as guiUrl,makeGuiBridgeHandler} from '../../public/OmniCPQ/extension/worker-v2.mjs';
import {cpqUrl as legacyUrl} from '../../public/OmniCPQ/extension/worker.mjs';
import {cpqPageV2} from '../../public/OmniCPQ/extension/page-v2.mjs';
import {cpqPage} from '../../public/OmniCPQ/extension/page.mjs';
import {PAIR_REQUESTS,pendingRequests} from '../../public/OmniCPQ/extension/pairing.mjs';
import {cpqLocation as guiLocation,createBrowserBridge,BRIDGE_EXTENSION_ID,BRIDGE_PROTOCOL} from '../../public/OmniCPQ/browser-bridge-v2.mjs';
import {cpqLocation as legacyLocation} from '../../public/OmniCPQ/browser-bridge.mjs';
import {validateGuiBrowser} from '../../functions/lib/omnicpq/browser-v2.mjs';
import {validateBrowser} from '../../functions/lib/omnicpq/browser.mjs';

const STAGE='https://cpq-stg.apps.test-ocp.ts.telekom.si';
const PROD='https://cpq.apps.prod-ocp.ts.telekom.si';
const APP='https://www.mdlxdcc.org/omnicpq/';
const popupSource=readFileSync(new URL('../../public/OmniCPQ/extension/popup.mjs',import.meta.url),'utf8');
const popupHtml=readFileSync(new URL('../../public/OmniCPQ/extension/popup.html',import.meta.url),'utf8');
const popupScript=popupSource.replace(/^import .*;\r?\n/gm,'').replace("tabs().catch(()=>status('Izbranega zavihka ni mogoče prebrati.'));","window.ready=tabs();");
assert(popupScript.includes('window.ready=tabs();'));
const matrix=[
 ['STAGE root',STAGE+'/',true],
 ['STAGE dashboard preview',STAGE+'/sl/dashboard-preview/default',true],
 ['STAGE arbitrary nested path',STAGE+'/other/module/example',true],
 ['STAGE query and fragment',STAGE+'/new-view?choice=1#section',true],
 ['STAGE order',STAGE+'/sl/order/details/view/SYNTHETIC/items',true],
 ['PROD old dashboard',PROD+'/sl/dashboard',true],
 ['PROD existing quote',PROD+'/sl/quote/details/view/SYNTHETIC',true],
 ['PROD preview remains blocked',PROD+'/sl/dashboard-preview/default',false],
 ['PROD arbitrary remains blocked',PROD+'/other/module/example',false],
 ['lookalike hostname',STAGE+'.evil.example/sl/dashboard',false],
 ['wrong scheme',STAGE.replace('https:','http:')+'/sl/dashboard',false],
 ['userinfo',STAGE.replace('https://','https://user:pass@')+'/sl/dashboard',false]
];
for(const [name,url,allowed] of matrix){
 test('exact origin boundary: '+name,()=>{
   assert.equal(guiUrl(url),allowed);assert.equal(legacyUrl(url),allowed);
   assert.equal(Boolean(guiLocation(url)),allowed);assert.equal(Boolean(legacyLocation(url)),allowed);
 });
}

test('manifest preserves existing browser permissions',()=>{
 const candidate=JSON.parse(readFileSync(new URL('../../public/OmniCPQ/extension/manifest.json',import.meta.url),'utf8'));
 assert.equal(candidate.version,'1.2.7');
 assert.deepEqual(candidate.permissions,['activeTab','scripting','storage','debugger']);
 assert.equal(candidate.host_permissions,undefined);
 assert.deepEqual(candidate.externally_connectable.matches,['https://www.mdlxdcc.org/*']);
});

function cpqFixture(url,scope='order'){
 const dom=new JSDOM('<main><h1>CPQ SYNTHETIC</h1><a href="/arbitrary/module?x=1">Other stage page</a><a href="/sl/order/list">Orders</a><a href="/sl/quote/list">Quotes</a><a href="https://foreign.invalid/steal">Foreign</a><a href="//foreign.invalid/steal">Foreign relative</a><button>Open</button></main>',{url,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;w.CSS={escape:x=>x};
 w.HTMLElement.prototype.getBoundingClientRect=function(){return {x:10,y:10,left:10,top:10,width:80,height:30,right:90,bottom:40};};
 w.HTMLElement.prototype.getClientRects=function(){return [this.getBoundingClientRect()];};
 d.elementFromPoint=()=>d.body;
 const v2=w.eval('('+cpqPageV2.toString()+')'),v1=w.eval('('+cpqPage.toString()+')');
 return {dom,w,d,v2,v1,scope};
}

async function runPopup(tabs,scope='order'){
 const dom=new JSDOM(popupHtml,{url:'https://extension.synthetic/',runScripts:'outside-only'});
 const request={id:23,url:APP,createdAt:Date.now()};
 Object.assign(dom.window,{PAIR_REQUESTS,pendingRequests,chrome:{
   tabs:{query:async()=>tabs,get:async id=>({id,url:APP,incognito:false})},
   storage:{session:{get:async k=>k===PAIR_REQUESTS?{[k]:[request]}:{requests:[]}}},
   runtime:{sendMessage:async()=>({ok:true})}
 }});
 dom.window.eval(popupScript);await dom.window.ready;
 const d=dom.window.document;
 const result={cpq:d.querySelector('#cpq').options.length,assistant:d.querySelector('#assistant').options.length,disabled:d.querySelector('#pair').disabled};
 dom.window.close();return result;
}
test('popup recognizes root, new paths and query but excludes hidden/foreign/incognito',async()=>{
 for(const url of [STAGE+'/',STAGE+'/sl/dashboard-preview/default',STAGE+'/other/module?x=1#part',PROD+'/sl/dashboard?view=1']){
   assert.deepEqual(await runPopup([{id:13,title:'SYNTHETIC',url,active:true}]),{cpq:1,assistant:1,disabled:false});
 }
 for(const tab of [{id:13,active:true},{id:13,active:true,url:'https://foreign.invalid/'},{id:13,active:true,url:STAGE+'/',incognito:true}]){
   assert.deepEqual(await runPopup([tab]),{cpq:0,assistant:1,disabled:true});
 }
});

test('synthetic real popup -> worker -> page -> assistant -> backend on dashboard-preview',async()=>{
 const f=cpqFixture(STAGE+'/sl/dashboard-preview/default');
 let pop;
 try{
  const storage={},sent=[];
  const api={
   runtime:{id:BRIDGE_EXTENSION_ID,getURL:x=>'chrome-extension://'+BRIDGE_EXTENSION_ID+'/'+x},
   tabs:{get:async id=>id===13?{id,active:true,url:f.w.location.href}:{id,url:APP}},
   storage:{session:{get:async k=>({[k]:structuredClone(storage[k])}),set:async o=>Object.assign(storage,structuredClone(o)),remove:async k=>{delete storage[k];}}},
   scripting:{executeScript:async p=>[{frameId:0,result:await f.v2(p.args[0])}]}
  };
  const handle=makeGuiBridgeHandler(api),sender={url:APP,frameId:0,tab:{id:23}},popupSender={id:BRIDGE_EXTENSION_ID,url:api.runtime.getURL('popup.html')};
  const client=createBrowserBridge({runtime:{sendMessage:(_,m,cb)=>{sent.push(m.type);handle(m,sender).then(cb);}}});
  await assert.rejects(client.connect(),/BRIDGE_NOT_PAIRED/);
  pop=new JSDOM(popupHtml,{url:'https://extension.synthetic/',runScripts:'outside-only'});
  Object.assign(pop.window,{PAIR_REQUESTS,pendingRequests,chrome:{...api,
   tabs:{...api.tabs,query:async()=>[{id:13,active:true,title:'CPQ SYNTHETIC',url:f.w.location.href}]},
   runtime:{...api.runtime,sendMessage:m=>handle(m,popupSender,true)}
  }});
  pop.window.eval(popupScript);await pop.window.ready;
  assert.equal(pop.window.document.querySelector('#cpq').options.length,1);
  assert.equal(pop.window.document.querySelector('#pair').disabled,false);
  await pop.window.document.querySelector('#pair').onclick();
  assert.match(pop.window.document.querySelector('#status').textContent,/Povezano/);
  assert.equal(storage.guiPair.origin,STAGE);assert.equal(storage.guiPair.cpqTabId,13);
  await client.connect();const observation=await client.observe();
  const cleaned=validateGuiBrowser(observation);
  assert.equal(cleaned.environment,'STAGE');
  assert(cleaned.controls.some(c=>c.href==='/arbitrary/module?x=1'));
  assert(cleaned.controls.some(c=>c.href==='/sl/order/list'));
  assert(!cleaned.controls.some(c=>c.label==='Quotes'));
  assert(!cleaned.controls.some(c=>/Foreign/.test(c.label)));
  assert.deepEqual(sent,['status','status','observe']);
  for(const bad of ['//foreign.invalid/steal','/\\foreign.invalid/steal','https://foreign.invalid/']){
    const example=cleaned.controls.find(c=>c.href);
    assert.throws(()=>validateGuiBrowser({...observation,controls:[{...example,href:bad}]}),/INVALID_BROWSER_CONTEXT/);
  }
 }finally{pop?.window.close();f.dom.window.close();}
});

test('real page observers admit all STAGE paths and keep order/quote scope',async()=>{
 for(const url of [STAGE+'/',STAGE+'/other/path',STAGE+'/sl/dashboard-preview/default']){
  for(const scope of ['order','quote']){
   const f=cpqFixture(url,scope);
   try{
    const a=await f.v2({type:'observe',scope,origin:STAGE});
    const b=await f.v1({type:'observe',scope,origin:STAGE});
    assert.equal(a.ok,true);assert.equal(b.ok,true);
    assert(a.observation.controls.some(c=>c.href==='/arbitrary/module?x=1'));
    assert(b.observation.controls.some(c=>c.href===STAGE+'/arbitrary/module?x=1'));
    const forbidden=scope==='order'?'Quotes':'Orders';
    const allowed=scope==='order'?'Orders':'Quotes';
    assert(!a.observation.controls.some(c=>c.label===forbidden));
    assert(!b.observation.controls.some(c=>c.label===forbidden));
    assert(a.observation.controls.some(c=>c.label===allowed));
    assert(b.observation.controls.some(c=>c.label===allowed));
    const v1=validateBrowser(b.observation);assert.equal(v1.environment,'STAGE');
    const v2=validateGuiBrowser({...a.observation,id:a.observation.observationId,routeScope:scope});
    assert.equal(v2.environment,'STAGE');
   }finally{f.dom.window.close();}
  }
 }
 const other=cpqFixture(STAGE+'/sl/quote/details/view/SYNTHETIC');
 try{assert.equal((await other.v2({type:'observe',scope:'order',origin:STAGE})).error,'CPQ_ROUTE_SCOPE_CHANGED');}
 finally{other.dom.window.close();}
});

test('many STAGE paths remain recognized without expanding host permissions',async()=>{
 const urls=[STAGE,STAGE+'/',STAGE+'/?q=1#x',STAGE+'/sl/dashboard-preview/default',
   STAGE+'/sl/order?filter=open',STAGE+'/sl/quote#section',STAGE+'/other/%E2%9C%93'];
 let state=0x194e23;
 for(let i=0;i<120;i++){
   state=(state*1664525+1013904223)>>>0;
   urls.push(STAGE+'/route-'+state.toString(16)+'/item_'+i+'?v='+i+'#part');
 }
 for(const url of urls){
   assert.equal(guiUrl(url),true);assert.equal(legacyUrl(url),true);
   assert.equal(guiLocation(url)?.environment,'STAGE');assert.equal(legacyLocation(url)?.environment,'STAGE');
 }
 const found=await runPopup(urls.map((url,i)=>({id:100+i,title:'SYNTHETIC '+i,url,active:i===0})));
 assert.equal(found.cpq,urls.length);assert.equal(found.assistant,1);assert.equal(found.disabled,false);
});

test('page rejects different origin and PROD new routes',async()=>{
 for(const url of [PROD+'/sl/dashboard-preview/default','https://foreign.invalid/other']){
   const f=cpqFixture(url);try{
    assert.equal((await f.v2({type:'observe',scope:'order',origin:new URL(url).origin})).error,'CPQ_ORIGIN_NOT_ALLOWED');
    assert.equal((await f.v1({type:'observe',scope:'order',origin:new URL(url).origin})).error,'CPQ_ORIGIN_NOT_ALLOWED');
   }finally{f.dom.window.close();}
 }
});
