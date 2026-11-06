import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {makeGuiBridgeHandler} from '../../public/OmniCPQ/extension/worker-v2.mjs';
import {makeBridgeHandler} from '../../public/OmniCPQ/extension/worker.mjs';
const THREE_DAYS=72*60*60*1000;
const APP='https://www.mdlxdcc.org/omnicpq/';
const CPQ='https://cpq-stg.apps.test-ocp.ts.telekom.si';
function fixture(kind,{currentEntry=false}={}){
 let clock=1800000000000,scripts=0,hook=null,reads=0;
 const start=clock,saved={},tabMap=new Map([[13,{id:13,active:true,url:CPQ+'/sl/order/details/view/SYNTHETIC'}],[23,{id:23,url:APP}]]);
 const protocol=kind==='gui'?'omnicpq.gui.v2':'omnicpq.browser.v1';
 const key=kind==='gui'?'guiPair':'pair';
 const api={runtime:{id:'synthetic-extension',getURL:p=>'chrome-extension://synthetic-extension/'+p},
  tabs:{get:async id=>{const t=tabMap.get(id);if(!t)throw Error('closed');return {...t};}},
  storage:{session:{get:async name=>{if(name===key){reads++;hook?.(reads);}return {[name]:structuredClone(saved[name])};},
   set:async values=>Object.assign(saved,structuredClone(values)),remove:async name=>{delete saved[name];}}},
  scripting:{executeScript:async req=>{scripts++;assert.equal(req.world,'ISOLATED');assert.equal(req.target.tabId,13);
   const id=randomUUID();return [{frameId:0,result:{ok:true,observation:{schema:kind==='gui'?'omnicpq.gui.observation.v2':'omnicpq.browser-observation.v1',
    id,observationId:id,revision:'a'.repeat(64),capturedAt:new Date(clock).toISOString(),scope:'order',url:tabMap.get(13).url,
    title:'SYNTHETIC',text:'SYNTHETIC',documentKey:'SYNTHETIC',controls:[],fields:[],paging:{offset:0,limit:180}}}}];}}};
 const make=kind==='gui'||currentEntry?makeGuiBridgeHandler:makeBridgeHandler;
 let handle=make(api,()=>clock),token;
 const sender={url:APP,frameId:0,tab:{id:23}},internal={id:api.runtime.id,url:api.runtime.getURL('popup.html')};
 const request=(type,data={},from=sender)=>handle({protocol,type,token,identity:'synthetic-owner',...data},from);
 return {saved,key,start,api,sender,tabMap,request,now:()=>clock,at:offset=>{clock=start+offset;},scripts:()=>scripts,
  restart(){handle=make(api,()=>clock);},afterGet(fn){reads=0;hook=fn;},
  async pair(){await request('status');const result=await handle({protocol,type:'pair',cpqTabId:13,assistantTabId:23,scope:'order',allowWrites:false},internal,true);
   assert.equal(result.ok,true);token=saved[key].token;return result;},
  unpair:()=>handle({protocol,type:'unpair'},internal,true)};
}
for(const kind of ['gui','legacy']){
 test(kind+' pairing lasts for 72 hours and remains usable beyond the former 30-minute limit',async()=>{
  const f=fixture(kind),paired=await f.pair();
  assert.equal(paired.expiresAt-f.start,THREE_DAYS);
  for(const offset of [30*60*1000+1,90*60*1000,71*60*60*1000,THREE_DAYS-1]){
   f.at(offset);const status=await f.request('status');assert.equal(status.ok,true,'approved pair must survive at '+offset);
   assert.equal(status.expiresAt,f.start+THREE_DAYS);
   assert.equal((await f.request('observe')).ok,true);
   assert.equal(f.saved[f.key].expiresAt,f.start+THREE_DAYS,'status/read must not silently extend the fixed 3-day boundary');
  }
 });
 test(kind+' expires exactly at the 72-hour boundary and blocks before page access',async()=>{
  const f=fixture(kind);await f.pair();const before=f.scripts();
  f.at(THREE_DAYS);assert.equal((await f.request('status')).error,'BRIDGE_NOT_PAIRED');
  assert.equal((await f.request('observe')).error,'BRIDGE_NOT_PAIRED');
  f.at(THREE_DAYS+1);assert.equal((await f.request('observe')).error,'BRIDGE_NOT_PAIRED');
  assert.equal(f.scripts(),before);
 });
 test(kind+' worker recreation keeps the same approved pair after two days',async()=>{
  const f=fixture(kind);await f.pair();const token=f.saved[f.key].token;
  f.at(48*60*60*1000);f.restart();const status=await f.request('status');
  assert.equal(status.ok,true);assert.equal(status.token,token);assert.equal(status.expiresAt,f.start+THREE_DAYS);
  assert.equal((await f.request('observe')).ok,true);
 });
 test(kind+' disconnect and explicit unpair still invalidate a three-day pair immediately',async()=>{
  for(const operation of ['disconnect','unpair']){
   const f=fixture(kind);await f.pair();f.at(24*60*60*1000);
   assert.equal((operation==='unpair'?await f.unpair():await f.request('disconnect')).ok,true);
   const before=f.scripts();assert.equal((await f.request('status')).error,'BRIDGE_NOT_PAIRED');
   assert.equal((await f.request('observe')).error,'BRIDGE_NOT_PAIRED');assert.equal(f.scripts(),before);
  }
 });
 test(kind+' a longer lifetime never authorizes another sender, tab, token or target origin',async()=>{
  const f=fixture(kind);await f.pair();f.at(24*60*60*1000);const before=f.scripts();
  assert.equal((await f.request('observe',{token:'forged'})).error,'BRIDGE_NOT_PAIRED');
  assert.equal((await f.request('observe',{}, {...f.sender,tab:{id:24}})).error,'BRIDGE_NOT_PAIRED');
  assert.equal((await f.request('observe',{}, {...f.sender,url:'https://outside.invalid/'})).error,'BRIDGE_SENDER_NOT_ALLOWED');
  assert.equal((await f.request('observe',{}, {...f.sender,frameId:1})).error,'BRIDGE_SENDER_NOT_ALLOWED');
  f.tabMap.set(13,{id:13,active:true,url:'https://outside.invalid/sl/order'});
  assert.equal((await f.request('observe')).error,'BRIDGE_TARGET_CHANGED');assert.equal(f.scripts(),before);
 });
 test(kind+' expiry reached during asynchronous validation still prevents page access',async()=>{
  const f=fixture(kind);await f.pair();f.at(THREE_DAYS-1);const before=f.scripts();
  f.afterGet(n=>{if(n===2)f.at(THREE_DAYS);});
  assert.equal((await f.request('observe')).error,'BRIDGE_NOT_PAIRED');assert.equal(f.scripts(),before);
 });
 test(kind+' cleared browser-session storage cannot be revived by the longer deadline',async()=>{
  const f=fixture(kind);await f.pair();f.at(24*60*60*1000);delete f.saved[f.key];f.restart();const before=f.scripts();
  assert.equal((await f.request('status')).error,'BRIDGE_NOT_PAIRED');
  assert.equal((await f.request('observe')).error,'BRIDGE_NOT_PAIRED');assert.equal(f.scripts(),before);
 });
}
test('GUI STOP keeps execution paused within a valid three-day pair',async()=>{
 const f=fixture('gui');await f.pair();f.at(48*60*60*1000);
 assert.equal((await f.request('suspend')).ok,true);assert.equal((await f.request('status')).paused,true);
 const before=f.scripts(),action={schema:'omnicpq.gui.action.v2',actionId:randomUUID(),observationId:randomUUID(),revision:'a'.repeat(64),targetId:'c0',operation:'click'};
 assert.equal((await f.request('execute',{action})).error,'CPQ_ACTION_PAUSED');assert.equal(f.scripts(),before);
});
test('GUI account identity change revokes a still-valid three-day pair',async()=>{
 const f=fixture('gui');await f.pair();f.at(48*60*60*1000);const before=f.scripts();
 assert.equal((await f.request('status',{identity:'different-owner'})).error,'BRIDGE_NOT_PAIRED');
 assert.equal(f.saved.guiPair,undefined);assert.equal((await f.request('observe')).error,'BRIDGE_NOT_PAIRED');assert.equal(f.scripts(),before);
});
test('the current GUI entry point also delegates the full three-day lifetime to legacy navigation',async()=>{
 const f=fixture('legacy',{currentEntry:true}),paired=await f.pair();
 assert.equal(paired.expiresAt-f.start,THREE_DAYS);f.at(71*60*60*1000);assert.equal((await f.request('observe')).ok,true);
});
test('the delivered manifest keeps the existing extension identity and permission boundary',async()=>{
 const m=JSON.parse(await readFile(new URL('../../public/OmniCPQ/extension/manifest.json',import.meta.url),'utf8'));
 const id=createHash('sha256').update(Buffer.from(m.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 assert.equal(id,'emoohebdiggbcppgphmdemdiakdamfnb');
 assert.deepEqual(m.permissions,['activeTab','scripting','storage','debugger']);assert.equal(m.host_permissions,undefined);
 assert.deepEqual(m.externally_connectable,{matches:['https://www.mdlxdcc.org/*']});
});

