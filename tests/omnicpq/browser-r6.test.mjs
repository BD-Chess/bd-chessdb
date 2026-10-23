import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash,randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {cpqPage} from '../../public/OmniCPQ/extension/page.mjs';
import {makeBridgeHandler} from '../../public/OmniCPQ/extension/worker.mjs';
import * as bridge from '../../public/OmniCPQ/browser-bridge.mjs';
import * as starters from '../../public/OmniCPQ/starters.mjs';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
import {validateBrowser,browserInstructions,starterMetadata} from '../../functions/lib/omnicpq/browser.mjs';
import {makeHandler,validateBody} from '../../functions/omnicpq-assistant.mjs';
import {SKILL} from '../../functions/lib/omnicpq/identity.mjs';
const ORIGIN=bridge.CPQ_ORIGINS.STAGE,APP='https://www.mdlxdcc.org/omnicpq/',PROTOCOL=bridge.BRIDGE_PROTOCOL;
function fixture(){
  const dom=new JSDOM('<nav><a href="/sl/order">Naročila</a><a href="/sl/quote">Ponudbe</a><a href="/sl/order/delete/123">Izbriši naročilo</a><a href="https://outside.test/">Drug sistem</a></nav><main><h1>Naročila</h1><a id="target" href="/sl/order/details/view/synthetic">OMNI-SYN · TS Suvereni oblak</a></main><input type="password" aria-label="Geslo" value="NEVER_READ_PASSWORD"><input type="hidden" value="NEVER_READ_HIDDEN">',{url:ORIGIN+'/sl/order',runScripts:'outside-only'});
  const w=dom.window;Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;
  w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{width:10,height:10}];};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){const c=this.cloneNode(true);c.querySelectorAll('[hidden],script,style').forEach(e=>e.remove());return c.textContent;}});
  let clicks=0;
  w.document.getElementById('target').addEventListener('click',e=>{e.preventDefault();clicks++;w.document.querySelector('main').innerHTML='<h1>OMNI-SYN · TS Suvereni oblak</h1><p>Postavke naročila</p>';w.document.title='OMNI-SYN · TS Suvereni oblak';});
  const page=w.eval('('+cpqPage.toString()+')');
  return {dom,w,page,clicks:()=>clicks,observe:()=>page({type:'observe',scope:'order',origin:ORIGIN})};
}
function extension(f){
  const saved={},calls=[],tabs=new Map([[1,{id:1,active:true,url:ORIGIN+'/sl/order'}],[2,{id:2,url:APP}]]);
  const api={runtime:{id:bridge.BRIDGE_EXTENSION_ID,getURL:path=>'chrome-extension://'+bridge.BRIDGE_EXTENSION_ID+'/'+path},
    tabs:{get:async id=>tabs.get(id)},storage:{session:{get:async key=>({[key]:structuredClone(saved[key])}),set:async value=>Object.assign(saved,structuredClone(value)),remove:async key=>{delete saved[key];}}},
    scripting:{executeScript:async options=>{calls.push(options);assert.equal(options.world,'ISOLATED');assert.deepEqual(options.target.frameIds,[0]);return [{frameId:0,result:await f.page(options.args[0])}];}}};
  const handle=makeBridgeHandler(api),sender={url:APP,frameId:0,tab:{id:2}},internal={id:api.runtime.id,url:api.runtime.getURL('popup.html')};
  const message=(type,data={})=>({protocol:PROTOCOL,type,...data});
  const pair=async()=>{await handle(message('status'),sender);assert.equal((await handle(message('pair',{cpqTabId:1,assistantTabId:2,scope:'order'}),internal,true)).ok,true);return (await handle(message('status'),sender)).token;};
  return {saved,calls,tabs,api,handle,sender,internal,message,pair};
}
test('12 user starters: ten CPQ/B2B tasks, ECM penultimate, tests last; stable extension ID and minimal installation boundary',async()=>{
  const s=starters.STARTERS;assert.equal(s.length,12);assert.equal(new Set(s.map(p=>p.id)).size,12);
  assert(s.slice(0,10).every(p=>p.mode==='work'));assert.deepEqual(s.slice(-2).map(p=>p.id),['JIRA_REQUIREMENT','PLM_TESTS']);
  assert.match(s.find(p=>p.id==='COVERAGE').message,/B2B_pokritost_in_kandidati_OmniCPQ_vXX\.docx/);
  assert.equal(starterMetadata.sha256,createHash('sha256').update(JSON.stringify(s)).digest('hex'));
  const m=JSON.parse(await readFile('public/OmniCPQ/extension/manifest.json','utf8'));
  assert.deepEqual(m.permissions,['activeTab','scripting','storage','debugger']);assert.equal(m.host_permissions,undefined);assert.equal(m.optional_host_permissions,undefined);
  const id=createHash('sha256').update(Buffer.from(m.key,'base64')).digest('hex').slice(0,32).split('').map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
  assert.equal(id,bridge.BRIDGE_EXTENSION_ID);assert.deepEqual(m.externally_connectable,{matches:['https://www.mdlxdcc.org/*']});
});
test('real DOM read excludes secrets and wrong route; a proposed current navigation dispatches one actual DOM click',async()=>{
  const f=fixture();try{
    const r=await f.observe();assert(r.ok);const o=r.observation;
    assert(!JSON.stringify(o).includes('NEVER_READ'));assert(o.controls.some(c=>c.label==='Naročila'));
    assert(!o.controls.some(c=>/Ponudbe|Izbriši|Drug sistem/.test(c.label)));
    const target=o.controls.find(c=>c.label.startsWith('OMNI-SYN'));
    const action={schema:'omnicpq.navigation.v1',observationId:o.id,revision:o.revision,targetId:target.id,reason:'Odpri obstoječe naročilo.'};
    const result=await f.page({type:'navigate',scope:'order',origin:ORIGIN,action});
    assert.equal(result.receipt.outcome,'CLICK_DISPATCHED');assert.equal(f.clicks(),1);
    const after=(await f.observe()).observation;assert.notEqual(after.revision,o.revision);assert.match(after.text,/Postavke naročila/);
  }finally{f.dom.window.close();}
});
test('stale screen, wrong origin, submit controls and active editor block unsafe or stale navigation',async()=>{
  const f=fixture();try{
    let o=(await f.observe()).observation;
    const target=o.controls.find(c=>c.label.startsWith('OMNI-SYN'));
    f.w.document.querySelector('h1').textContent='SPREMENJEN DOKUMENT';
    assert.equal((await f.page({type:'navigate',origin:ORIGIN,scope:'order',action:{schema:'omnicpq.navigation.v1',revision:o.revision,targetId:target.id}})).error,'CPQ_SCREEN_CHANGED');assert.equal(f.clicks(),0);
    assert.equal((await f.page({type:'observe',origin:bridge.CPQ_ORIGINS.PROD,scope:'order'})).error,'CPQ_ORIGIN_NOT_ALLOWED');
    f.w.document.body.insertAdjacentHTML('beforeend','<form><button role="tab">Postavke</button><button aria-expanded="false">Razdelek</button></form><button type="button">Shrani</button>');
    o=(await f.observe()).observation;assert.equal(o.navigationLocked,true);assert(!o.controls.some(c=>['link','view','tab'].includes(c.kind)));assert(!o.controls.some(c=>c.label==='Razdelek'));
  }finally{f.dom.window.close();}
});
test('worker binds explicit pairing, origin, frame, two tab IDs, token, expiry and one attempt; foreign pages never inject',async()=>{
  const f=fixture(),e=extension(f);try{
    for(const sender of [{...e.sender,url:'https://evil.test/omnicpq/'},{...e.sender,frameId:1},{...e.sender,url:'https://www.mdlxdcc.org/BD/private.html'}])
      assert.equal((await e.handle(e.message('observe'),sender)).error,'BRIDGE_SENDER_NOT_ALLOWED');
    assert.equal(e.calls.length,0);
    assert.equal((await e.handle(e.message('pair',{cpqTabId:1,assistantTabId:2,scope:'order'}),e.sender,true)).error,'BRIDGE_SENDER_NOT_ALLOWED');
    const token=await e.pair();const count=e.calls.length;
    assert.equal((await e.handle(e.message('observe',{token:'forged'}),e.sender)).error,'BRIDGE_NOT_PAIRED');assert.equal(e.calls.length,count);
    const o=(await e.handle(e.message('observe',{token}),e.sender)).observation;
    const action={schema:'omnicpq.navigation.v1',observationId:o.id,revision:o.revision,targetId:o.controls.find(c=>c.label.startsWith('OMNI-SYN')).id,reason:'Odpri naročilo.'};
    assert.equal((await e.handle(e.message('navigate',{token,action}),e.sender)).ok,true);assert.equal(f.clicks(),1);
    assert.equal((await e.handle(e.message('navigate',{token,action}),e.sender)).error,'CPQ_ACTION_ALREADY_ATTEMPTED');assert.equal(f.clicks(),1);
    e.saved.pair.expiresAt=Date.now()-1;
    assert.equal((await e.handle(e.message('observe',{token}),e.sender)).error,'BRIDGE_NOT_PAIRED');
  }finally{f.dom.window.close();}
});
test('backend treats bounded fresh DOM as client evidence, not attestation; no browser capability without the observation',async()=>{
  const f=fixture();try{
    const o=(await f.observe()).observation,valid=validateBrowser(o);
    assert.equal(valid.origin,'client_reported_extension_DOM_not_server_attested');assert.match(browserInstructions({browser:valid}),/NAROČILA/);
    assert.match(browserInstructions({browser:null}),/NI vzpostavljena/);
    for(const changed of [{...o,url:'https://evil.test/sl/order'},{...o,capturedAt:new Date(Date.now()-130000).toISOString()},
      {...o,controls:[{id:'n0',kind:'link',label:'Ponudbe',href:ORIGIN+'/sl/quote'}]}, {...o,fields:[{label:'x',value:'a'.repeat(501)}]}])
      assert.throws(()=>validateBrowser(changed),{code:'INVALID_BROWSER_CONTEXT'});
    const good={schema:'omnicpq.navigation.v1',observationId:o.id,revision:o.revision,targetId:o.controls[0].id,reason:'Odpri.'};
    const block=a=>'```omnicpq_navigation\n'+JSON.stringify(a)+'\n```';
    assert(bridge.navigationProposal(block(good),o));
    for(const bad of [{...good,targetId:'n999'},{...good,selector:'body'},{...good,observationId:randomUUID()}])assert.equal(bridge.navigationProposal(block(bad),o),null);
    assert.equal(bridge.navigationProposal(block(good)+'\n'+block(good),o),null);
    assert.throws(()=>validateBody({message:'x',clientRequestId:randomUUID(),browser:{...o,url:'http://internal.invalid/'}}),{code:'INVALID_BROWSER_CONTEXT'});
  }finally{f.dom.window.close();}
});
test('complete synthetic UI -> authenticated handler -> proposal -> extension -> real DOM click -> new observation; no fake live claim',async()=>{
  const f=fixture(),e=extension(f);const html=await readFile('public/OmniCPQ/index.html','utf8');
  const dom=new JSDOM(html,{url:APP,runScripts:'outside-only'});let modelCalls=0,charges=0;
  try{
    await e.pair();
    const runtime={sendMessage:(id,message,reply)=>{assert.equal(id,bridge.BRIDGE_EXTENSION_ID);e.handle(message,e.sender).then(reply);}};
    const k={skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[],canonicalPrompts:prompts.CANONICAL_PROMPTS,
      retrieve:async()=>({skill:SKILL,text:'SYNTHETIC TEST CONTEXT ONLY',sources:[],intent:{mode:'work'}}),validateLifecycleAnswer:()=>({state:'ABSENT'})};
    const handler=makeHandler({enabled:true,accessFactory:async()=>({id:'synthetic-owner',role:'owner'}),knowledgeFactory:async()=>k,
      budgetFactory:()=>({reserve:async()=>{charges++;return null;},settle:async()=>null}),
      transport:async({payload,onText,onIdentity})=>{
        modelCalls++;const input=payload.input.at(-1).content[0].text;
        const o=JSON.parse(input.slice(input.indexOf('\n')+1,input.indexOf('\n\nVPRAŠANJE:'))).browser;
        assert.match(payload.instructions,/omejeno navigacijo/);assert.equal(o.routeScope,'order');
        onIdentity({model:'SYNTHETIC_TRANSPORT',reasoning:'low'});
        const target=o.controls.find(c=>c.label.startsWith('OMNI-SYN'));
        onText(target?'Odprl bom obstoječe naročilo.\n```omnicpq_navigation\n'+JSON.stringify({schema:'omnicpq.navigation.v1',observationId:o.id,revision:o.revision,targetId:target.id,reason:'Odpri obstoječe naročilo.'})+'\n```':'Cilj je dosežen: odprta je postavka TS Suvereni oblak v naročilu OMNI-SYN.');
        return {model:'SYNTHETIC_TRANSPORT',status:'complete',usage:{input_tokens:1,output_tokens:1}};
      }});
    const w=dom.window;Object.assign(w,{...core,...prompts,...starters,...bridge,createBrowserBridge:()=>bridge.createBrowserBridge({runtime}),Response,Blob,AbortController,TextEncoder});
    Object.defineProperty(w,'crypto',{value:webcrypto});w.matchMedia=()=>({matches:false});
    w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    w.fetch=async(path,options={})=>{assert.equal(path,'/.netlify/functions/omnicpq-assistant');return handler(new Request('https://www.mdlxdcc.org'+path,{...options,headers:{...options.headers,origin:'https://www.mdlxdcc.org'}}));};
    const code=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,'');
    w.eval(code.replace('health(); installWorker();','window.bootHealth=health();')+'\nwindow.appTest={state,connectBrowser,send};');
    await w.bootHealth;assert.equal(w.appTest.state.ready,true);
    assert.equal(w.document.querySelectorAll('[data-prompt]').length,12);
    assert.deepEqual([...w.document.getElementById('mode-nav').children].map(b=>b.dataset.mode),['work','jira','plm']);
    await w.appTest.connectBrowser();assert.equal(w.appTest.state.browserConnected,true);assert.equal(modelCalls,0);
    w.document.getElementById('message').value='Pokaži Suvereni oblak v obstoječem naročilu prek Naročil.';
    w.document.getElementById('browser-auto').checked=true;
    await w.appTest.send();
    assert.equal(f.clicks(),1);assert.equal(modelCalls,2);assert.equal(charges,2);
    assert.match(w.appTest.state.messages.at(-1).content,/Cilj je dosežen/);
    assert.equal(w.appTest.state.messages[1].meta.browserNavigation.receipt.outcome,'CLICK_DISPATCHED');
    assert.equal(w.appTest.state.messages[2].input.automaticContinuation,true);
    assert.equal(w.appTest.state.busy,false);
  }finally{dom.window.close();f.dom.window.close();}
});

const origin='https://cpq-stg.apps.test-ocp.ts.telekom.si';
// Structural reproduction of the observed Material stepper; no customer content.
function materialFixture({save='disabled',route='/sl/order/details/view/synthetic/info'}={}) {
  const dom=new JSDOM(`<nav><a href="/sl/order">Naročila</a></nav>
    <div role="tablist" class="mat-horizontal-stepper-header-container">
      <mat-step-header role="tab" aria-selected="true"><div class="mat-step-icon"><mat-icon role="img" aria-hidden="true">format_list_bulleted</mat-icon></div><div class="mat-step-text-label">Podatki</div></mat-step-header>
      <mat-step-header id="items" role="tab" aria-selected="false"><div class="mat-step-icon"><span class="cdk-visually-hidden">Editable</span><mat-icon role="img" aria-hidden="true">create</mat-icon></div><div class="mat-step-text-label">Postavke</div></mat-step-header>
      <mat-step-header role="tab" aria-selected="false"><mat-icon aria-hidden="true">topic</mat-icon><div class="mat-step-text-label">Generiranje</div></mat-step-header>
    </div><main><p>Podatki testnega naročila</p></main>
    <button id="save" type="button" ${save==='disabled'?'disabled':save==='aria'?'aria-disabled="true"':save==='fieldset'?'form="disabled-form"':''}><mat-icon role="img" aria-hidden="true">save</mat-icon></button>
    <input type="password" aria-label="Geslo" value="NEVER_READ_PASSWORD">`,{url:origin+route,runScripts:'outside-only'});
  let digestHook;const w=dom.window;
  Object.defineProperty(w,'crypto',{value:{randomUUID:()=>webcrypto.randomUUID(),subtle:{digest:async(...args)=>{const value=await webcrypto.subtle.digest(...args);digestHook?.();return value;}}}});w.TextEncoder=TextEncoder;
  w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{width:10,height:10}];};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
  let clicks=0;w.document.getElementById('items').addEventListener('click',()=>{clicks++;w.document.querySelector('main').innerHTML='<h1>Postavke</h1>';});
  const page=w.eval('('+cpqPage.toString()+')');
  return {w,page,setDigestHook:hook=>{digestHook=hook;},close:()=>w.close(),clicks:()=>clicks,observe:async()=>{const r=await page({type:'observe',origin,scope:'order'});assert(r.ok);return r.observation;}};
}
test('observed Material step labels survive decorative icons and a disabled save does not lock a saved order',async()=>{
  const f=materialFixture();try{
    const o=await f.observe();assert.equal(o.navigationLocked,false);
    assert.deepEqual(Array.from(o.controls).filter(c=>c.kind==='tab').map(c=>c.label),['Podatki','Postavke','Generiranje']);
    assert(!JSON.stringify(o).includes('NEVER_READ_PASSWORD'));
    const t=o.controls.find(c=>c.label==='Postavke');assert(t);
    const result=await f.page({type:'navigate',origin,scope:'order',action:{schema:'omnicpq.navigation.v1',revision:o.revision,observationId:o.id,targetId:t.id}});
    assert.equal(result.receipt.outcome,'CLICK_DISPATCHED');assert.equal(f.clicks(),1);
    assert.match((await f.observe()).text,/Postavke/);
  }finally{f.close();}
});
test('aria-disabled and native fieldset-disabled save controls do not lock; enabling an icon-only save does',async()=>{
  const f=materialFixture({save:'aria'});try{
    assert.equal((await f.observe()).navigationLocked,false);
    f.w.document.getElementById('save').removeAttribute('aria-disabled');
    assert.equal((await f.observe()).navigationLocked,true);
    const fieldset=f.w.document.createElement('fieldset');fieldset.disabled=true;f.w.document.body.append(fieldset);fieldset.append(f.w.document.getElementById('save'));
    assert.equal((await f.observe()).navigationLocked,false);
  }finally{f.close();}
});
test('active configurator and enabled confirmation retain the editor departure lock and never offer save/confirm',async()=>{
  const f=materialFixture({route:'/sl/order/details/view/synthetic/items/item/configure'});try{
    let o=await f.observe();assert.equal(o.navigationLocked,true);assert(!o.controls.some(c=>['tab','link','view'].includes(c.kind)));
    f.w.history.replaceState(null,'','/sl/order/details/view/synthetic/info');
    f.w.document.body.insertAdjacentHTML('beforeend','<button type="button">Potrdi</button>');
    o=await f.observe();assert.equal(o.navigationLocked,true);assert(!o.controls.some(c=>/Shrani|Potrdi|save/i.test(c.label)));
  }finally{f.close();}
});
test('an observed tab becomes unclickable when a save action is enabled or the target is disabled before dispatch',async()=>{
  const f=materialFixture();try{
    const o=await f.observe(),target=o.controls.find(c=>c.label==='Postavke');assert(target);
    f.w.document.getElementById('save').disabled=false;
    const action={schema:'omnicpq.navigation.v1',revision:o.revision,targetId:target.id};
    assert.equal((await f.page({type:'navigate',origin,scope:'order',action})).error,'CPQ_SCREEN_CHANGED');assert.equal(f.clicks(),0);
    f.w.document.getElementById('save').disabled=true;
    f.w.document.getElementById('items').setAttribute('aria-disabled','true');
    assert.equal((await f.page({type:'navigate',origin,scope:'order',action})).error,'CPQ_SCREEN_CHANGED');assert.equal(f.clicks(),0);
  }finally{f.close();}
});
test('newly enabled saving during the asynchronous revision check blocks departure before the click',async()=>{
  const f=materialFixture();try{
    const o=await f.observe(),target=o.controls.find(c=>c.label==='Postavke');assert(target);
    f.setDigestHook(()=>{f.w.document.getElementById('save').disabled=false;});
    const result=await f.page({type:'navigate',origin,scope:'order',action:{schema:'omnicpq.navigation.v1',revision:o.revision,targetId:target.id}});
    assert.equal(result.error,'CPQ_SCREEN_CHANGED');assert.equal(f.clicks(),0);
  }finally{f.close();}
});
