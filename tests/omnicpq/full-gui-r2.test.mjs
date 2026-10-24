import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {makeGuiBridgeHandler,validateAction} from '../../public/OmniCPQ/extension/worker-v2.mjs';
import {navigationProposal,createBrowserBridge,BRIDGE_EXTENSION_ID,BRIDGE_PROTOCOL} from '../../public/OmniCPQ/browser-bridge-v2.mjs';
import {validateGuiBrowser,guiInstructions} from '../../functions/lib/omnicpq/browser-v2.mjs';
const origin='https://cpq-stg.apps.test-ocp.ts.telekom.si', app='https://www.mdlxdcc.org/omnicpq/';
const sha='a'.repeat(64),doc='SYNTHETIC-ONLY';
const baseControl=(id,label,kind='button',additional={})=>({id,kind,label,enabled:true,inputType:'',visibleInViewport:true,rect:{x:12,y:21,w:40,h:32,cx:32,cy:37},...additional});
const observation=()=>({schema:'omnicpq.gui.observation.v2',observationId:randomUUID(),revision:sha,capturedAt:new Date().toISOString(),
  url:origin+'/sl/order/details/view/'+doc+'/info',title:'SYNTHETIC CPQ',scope:'order',documentKey:doc,text:'Testni obrazec',dialogOpen:false,navigationLocked:false,
  controls:[baseControl('c0','Dodaj (+)'),baseControl('c1','Ime stranke','field',{value:'PREVIOUS'}),
  baseControl('c2','Shrani'),baseControl('c3','Izbriši'),baseControl('c4','Backup','checkbox',{checked:false})],
  viewport:{width:1200,height:800,scrollX:0,scrollY:0},paging:{offset:0,limit:180,totalFound:5,hasMore:false}});
const action=(o,targetId,operation,extra={})=>({schema:'omnicpq.gui.action.v2',actionId:randomUUID(),observationId:o.observationId,revision:o.revision,
  targetId,operation,expectedDocument:doc,reason:'SINTETIČNI TEST',...extra});
function env({allowCdp=true,allowWrites=true,changeGeometryOnAttach=false}={}){
  const storage={},events=[],pages=[],tab={id:13,active:true,url:origin+'/sl/order/details/view/'+doc+'/info'};
  const obs=observation(),api={runtime:{id:BRIDGE_EXTENSION_ID,getURL:x=>'chrome-extension://'+BRIDGE_EXTENSION_ID+'/'+x},
    tabs:{get:async id=>id===13?tab:{id:23,url:app,incognito:false}},
    scripting:{executeScript:async p=>{pages.push(p);assert.equal(p.world,'ISOLATED');assert.deepEqual(p.target.frameIds,[0]);
      const command=p.args[0];let result;
      if(command.type==='observe')result={ok:true,observation:{...obs,observationId:randomUUID()}};
      else if(command.type==='prepare')result={ok:true,prepared:{targetId:command.action.targetId,revision:sha,documentKey:doc,
        label:obs.controls.find(c=>c.id===command.action.targetId).label,rect:changeGeometryOnAttach&&events.filter(x=>x==='attach').length>=2?{...obs.controls.find(c=>c.id===command.action.targetId).rect,cx:33}:obs.controls.find(c=>c.id===command.action.targetId).rect,
        visibleInViewport:true,risk:command.action.targetId==='c3'?'irreversible':command.action.targetId==='c2'?'business_write':'ordinary',
        checked:command.action.targetId==='c4'?false:null}};
      else result={ok:true,method:'DOM_VALUE_EVENTS'};
      return [{frameId:0,result}];}},
    storage:{session:{get:async key=>({[key]:structuredClone(storage[key])}),set:async obj=>Object.assign(storage,structuredClone(obj)),remove:async key=>{delete storage[key]}}},
    debugger:{attach:async()=>{if(!allowCdp)throw Error('denied');events.push('attach')},
      sendCommand:async (_,name,params)=>events.push({name,params}),detach:async()=>events.push('detach')}};
  const handler=makeGuiBridgeHandler(api),sender={url:app,frameId:0,tab:{id:23}},popup={id:BRIDGE_EXTENSION_ID,url:api.runtime.getURL('popup.html')};
  const request=(type,other={})=>({protocol:BRIDGE_PROTOCOL,type,...other});
  const pair=async()=>{await handler(request('status'),sender);const r=await handler(request('pair',{cpqTabId:13,assistantTabId:23,scope:'order',allowWrites}),popup,true);assert.equal(r.ok,true);return (await handler(request('status'),sender)).token};
  return {handler,sender,popup,request,pair,storage,events,pages,obs,api};
}
test('validation preserves bounded scope and rejects foreign origin, stale and forged controls',()=>{
  const o=observation(),v=validateGuiBrowser({...o,id:o.observationId,routeScope:'order',fields:[]});
  assert.equal(v.environment,'STAGE');assert.match(guiInstructions(v),/cN/);assert.match(guiInstructions(v),/omnicpq_action/);
  for(const change of [{url:'https://evil.test/sl/order'}, {capturedAt:'2001-01-01T00:00:00Z'},
    {controls:[{...o.controls[0],id:'c99999'}]},{controls:[o.controls[0],o.controls[0]]}, {scope:'quote'}]){
    assert.throws(()=>validateGuiBrowser({...o,id:o.observationId,routeScope:'order',...change}),{code:'INVALID_BROWSER_CONTEXT'});
  }
});
test('model actions bind to exact observed revision and IDs; no arbitrary code, binary or fallback selectors',()=>{
  const o={...observation(),id:randomUUID()};o.observationId=o.id;
  const a={schema:'omnicpq.gui.action.v2',observationId:o.id,revision:o.revision,targetId:'c0',operation:'click',reason:'Odpri novo naročilo',expectedDocument:doc};
  const block=x=>'```omnicpq_action\n'+JSON.stringify(x)+'\n```';
  assert.equal(navigationProposal(block(a),o)?.targetId,'c0');
  for(const bad of [{...a,targetId:'c999'},{...a,selector:'button'},{...a,operation:'javascript'},
    {...a,expectedDocument:'DIFFERENT'},{...a,actionId:randomUUID()},{...a,operation:'upload',file:{name:'x'}}])
    assert.equal(navigationProposal(block(bad),o),null);
  assert.equal(navigationProposal(block(a)+block(a),o),null);
  assert(!validateAction({...a,actionId:randomUUID(),javascript:'alert(1)'}));
});
test('pair handshake proves capabilities, selected tabs, and valid origin; unpaired messages rejected',async()=>{
  const e=env(),s=e.sender;assert.equal((await e.handler(e.request('observe'),s)).error,'BRIDGE_NOT_PAIRED');
  assert.equal((await e.handler(e.request('status'),{...s,url:'https://evil.test/omnicpq/'})).error,'BRIDGE_SENDER_NOT_ALLOWED');
  const token=await e.pair();assert.equal(typeof token,'string');
  const r=await e.handler(e.request('status'),s);assert.equal(r.capabilities.cdpAvailable,true);
  assert.equal((await e.handler(e.request('observe',{token:'wrong'}),s)).error,'BRIDGE_NOT_PAIRED');
  assert(e.events.includes('attach'));assert(e.events.includes('detach'));
});
test('visible icon +: observe, preview, trusted CDP click, new observation, replay fails',async()=>{
  const e=env();const token=await e.pair(),observed=(await e.handler(e.request('observe',{token}),e.sender)).observation;
  assert.equal(observed.controls[0].label,'Dodaj (+)');const a=action(observed,'c0','click');
  const preview=await e.handler(e.request('preview',{token,action:a}),e.sender);assert.equal(preview.prepared.risk,'ordinary');
  const done=await e.handler(e.request('execute',{token,action:a,authorizedRole:'owner'}),e.sender);
  assert.equal(done.ok,true);assert.equal(done.receipt.method,'TRUSTED_BROWSER_CDP');
  assert.equal(done.receipt.outcome,'OBSERVATION_AVAILABLE_NOT_BUSINESS_ATTESTED');
  assert.equal(e.events.filter(x=>x.name==='Input.dispatchMouseEvent'&&x.params.type==='mousePressed').length,1);
  assert.equal((await e.handler(e.request('execute',{token,action:a}),e.sender)).error,'CPQ_ACTION_ALREADY_ATTEMPTED');
  const differentIdSameScreen=action(observed,'c0','click');
  assert.equal((await e.handler(e.request('execute',{token,action:differentIdSameScreen}),e.sender)).error,'CPQ_SCREEN_CHANGED');
  assert.equal(e.events.filter(x=>x.name==='Input.dispatchMouseEvent'&&x.params.type==='mousePressed').length,1);
});
test('destructive action blocked until explicit human approval; write actions respect guided grant',async()=>{
  const e=env(),token=await e.pair(),o=(await e.handler(e.request('observe',{token}),e.sender)).observation;
  const del=action(o,'c3','click');assert.equal((await e.handler(e.request('execute',{token,action:del,authorizedRole:'owner'}),e.sender)).error,'CPQ_EXPLICIT_APPROVAL_REQUIRED');
  const save=action(o,'c2','click');assert.equal((await e.handler(e.request('execute',{token,action:save,authorizedRole:'owner'}),e.sender)).error,'CPQ_WRITE_APPROVAL_REQUIRED');
  const dispatched=await e.handler(e.request('execute',{token,action:save,authorizedRole:'owner',guidedAuthorization:true}),e.sender);
  assert.equal(dispatched.ok,true);
});
test('form fill issues focus, Ctrl+A, text via CDP and never uses arbitrary DOM script',async()=>{
  const e=env(),token=await e.pair(),o=(await e.handler(e.request('observe',{token}),e.sender)).observation;
  const a=action(o,'c1','fill',{value:'SINTETIČNA VREDNOST'}),r=await e.handler(e.request('execute',{token,action:a,authorizedRole:'owner'}),e.sender);
  assert.equal(r.ok,true);assert(e.events.some(x=>x.name==='Input.insertText'&&x.params.text==='SINTETIČNA VREDNOST'));
  assert(e.events.some(x=>x.name==='Input.dispatchKeyEvent'&&x.params.modifiers===2&&x.params.key==='a'&&x.params.windowsVirtualKeyCode===65));
});
test('denied debugger fails closed; does not claim full GUI despite pairing',async()=>{
  const e=env({allowCdp:false}),token=await e.pair();
  assert.equal((await e.handler(e.request('status'),e.sender)).capabilities.cdpAvailable,false);
  const o=(await e.handler(e.request('observe',{token}),e.sender)).observation;
  assert.equal((await e.handler(e.request('execute',{token,action:action(o,'c0','click')}),e.sender)).error,'CPQ_ACTION_OUTCOME_UNKNOWN');
});
test('client transport requires the v2 handshake and preserves evidence boundary',async()=>{
  const e=env(),token=await e.pair();
  const runtime={sendMessage:(_id,msg,cb)=>e.handler(msg,e.sender).then(cb)};
  const client=createBrowserBridge({runtime});const connected=await client.connect();assert(connected.capabilities.schema.endsWith('.v2'));
  const o=await client.observe();assert.equal(o.id,o.observationId);assert.equal(o.routeScope,'order');
  const a=action(o,'c0','click');const preview=await client.preview(a);assert.equal(preview.targetId,'c0');
  const result=await client.execute(a,{authorizedRole:'owner'});assert.equal(result.receipt.status,'DISPATCHED');
  await client.disconnect();assert.equal(e.storage.guiPair,undefined);
});

test('read-only pairing rejects spoofed owner writes but allows harmless navigation proposals',async()=>{
  const e=env({allowWrites:false}),token=await e.pair(),o=(await e.handler(e.request('observe',{token}),e.sender)).observation;
  const a=action(o,'c1','fill',{value:'NE SME SPREMENITI'});
  const denied=await e.handler(e.request('execute',{token,action:a,authorizedRole:'owner',humanApproved:true,guidedAuthorization:true}),e.sender);
  assert.equal(denied.error,'CPQ_WRITE_MODE_NOT_PAIRED');assert(!e.events.some(x=>x.name==='Input.insertText'));
  const add=action(o,'c0','click');assert.equal((await e.handler(e.request('execute',{token,action:add,authorizedRole:'owner'}),e.sender)).error,'CPQ_WRITE_MODE_NOT_PAIRED');
});
test('changed geometry at dispatch after debugger attach rejects stale target before pointer event',async()=>{
  const e=env({changeGeometryOnAttach:true}),token=await e.pair(),o=(await e.handler(e.request('observe',{token}),e.sender)).observation;
  const r=await e.handler(e.request('execute',{token,action:action(o,'c0','click')}),e.sender);
  assert.equal(r.error,'CPQ_SCREEN_CHANGED');assert(!e.events.some(x=>x.name==='Input.dispatchMouseEvent'));
});