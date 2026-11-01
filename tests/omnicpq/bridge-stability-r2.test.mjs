import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const localRoot=fileURLToPath(new URL('../..',import.meta.url));
const appRoot=process.env.BRIDGE_STABILITY_APP_ROOT||localRoot;
const baseRoot=process.env.BRIDGE_STABILITY_BASE_ROOT||localRoot;
const read=(root,name)=>readFile(path.join(root,'public/OmniCPQ',name),'utf8');
const {createAutoConnector}=await import(pathToFileURL(path.join(appRoot,'public/OmniCPQ/auto-connect.mjs')));
const {makeGuiBridgeHandler}=await import(pathToFileURL(path.join(baseRoot,'public/OmniCPQ/extension/worker-v2.mjs')));
const {configuredChoiceGuard,goalGrantCovers}=await import(pathToFileURL(path.join(baseRoot,'public/OmniCPQ/agent-session.mjs')));
const {cpqLocation}=await import(pathToFileURL(path.join(baseRoot,'public/OmniCPQ/browser-bridge-v2.mjs')));
const appSource=await read(appRoot,'app.mjs');
const APP='https://www.mdlxdcc.org/omnicpq/',ORIGIN='https://cpq-stg.apps.test-ocp.ts.telekom.si';
function scheduler(){let id=0,now=0;const jobs=new Map();return {jobs,get now(){return now;},schedule(fn,ms){jobs.set(++id,{fn,ms,at:now+ms});return id;},unschedule(id){jobs.delete(id);},async next(){assert(jobs.size,'expected scheduled status check');const [id,job]=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];jobs.delete(id);now=job.at;await job.fn();return job.ms;}};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const observation=()=>({schema:'omnicpq.gui.observation.v2',id:randomUUID(),revision:'a'.repeat(64),url:ORIGIN+'/sl/order/details/view/SYNTHETIC',title:'SYNTHETIC unsaved document',text:'SYNTHETIC ONLY',routeScope:'order',controls:[],fields:[],paging:{offset:0,limit:180},documentKey:'SYNTHETIC',navigationLocked:true});
function appFixture(){
  const nodes=new Map(),notices=[],clock=scheduler(),calls={connect:0,observe:0,disconnect:0,clearFrozen:0};
  const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,checked:false,open:false,replaceChildren(...children){this.children=children;}});return nodes.get(id);};
  const state={ownerVerified:true,role:'owner',busy:false,browserConnected:false,browserObservation:null,browserStop:false,browserPaused:false};
  const bridge={connect:async()=>{calls.connect++;return {token:'synthetic-pair',capabilities:{cdpAvailable:true}};},observe:async()=>{calls.observe++;return observation();},disconnect:async()=>{calls.disconnect++;}};
  $('experimental-gui').checked=true; $('environment').value='STAGE';
  const context=vm.createContext({state,$,browserBridge:bridge,accessEpoch:0,browserConnectionEpoch:0,browserPairToken:null,browserChoiceEpoch:0,cpqLocation,Option:function(label,value){this.label=label;this.value=value;},uuid:randomUUID,configuredChoiceGuard,goalGrantCovers,confirm:()=>{throw Error('unexpected human confirmation');},localWrite:()=>{},notice:text=>notices.push(text),clearFrozen:()=>calls.clearFrozen++,document:{visibilityState:'visible'},navigator:{onLine:true},window:{setTimeout:clock.schedule,clearTimeout:clock.unschedule},createAutoConnector});
  const begin=appSource.indexOf('function browserProblem('),end=appSource.indexOf('async function send(');
  assert(begin>=0&&end>begin);const ws=appSource.indexOf('function showWorkspaceStatus()'),we=appSource.indexOf('async function readReleaseInfo()',ws);assert(ws>=0&&we>ws);vm.runInContext(appSource.slice(ws,we)+appSource.slice(begin,end),context);
  const a=appSource.indexOf('const autoConnector='),b=appSource.indexOf('const element =',a);
  assert(a>=0&&b>a);vm.runInContext(appSource.slice(a,b)+'\nglobalThis.auto=autoConnector;',context);
  const cs=appSource.indexOf("for (const id of ['browser-include','browser-auto']) $(id).onchange"),ce=appSource.indexOf("$('settings-open')",cs);assert(cs>=0&&ce>cs);vm.runInContext(appSource.slice(cs,ce),context);
  const rs=appSource.indexOf("$('browser-read').onclick ="),re=appSource.indexOf('\n',rs);assert(rs>=0&&re>rs);vm.runInContext(appSource.slice(rs,re),context);
  return {context,state,$,nodes,bridge,calls,notices,clock,auto:context.auto,connect:context.connectBrowser,read:context.readBrowserObservation,disconnect:context.disconnectBrowser,execute:context.executeBrowserNavigation};
}

test('actual PWA wiring keeps one status timer through eight minutes of a busy task, then recovers without a wake event',async()=>{
 const f=appFixture();await f.auto.check();assert.equal(f.calls.connect,1);f.state.busy=true;
 for(let i=0;i<16;i++){assert.equal(await f.clock.next(),30000);assert.equal(f.calls.connect,1);assert.equal(f.clock.jobs.size,1);}
 assert.equal(f.clock.now,480000);f.state.busy=false;await f.clock.next();assert.equal(f.calls.connect,2);assert.equal(f.clock.jobs.size,1);f.auto.stop();
});
test('a busy owner at initial start is deferred and receives a status check after becoming available',async()=>{
 const f=appFixture();f.state.busy=true;f.auto.start();await flush();assert.equal(f.calls.connect,0);assert.equal(f.clock.jobs.size,1);f.state.busy=false;await f.clock.next();assert.equal(f.calls.connect,1);f.auto.stop();
});
test('visibility and offline skips preserve one timer and wake never overlaps a pending status request',async()=>{
 const clock=scheduler();let visible=false,online=true,checks=0,release;
 const auto=createAutoConnector({eligible:()=>true,visible:()=>visible,online:()=>online,connect:async()=>{checks++;if(checks===1)await new Promise(r=>release=r);},schedule:clock.schedule,unschedule:clock.unschedule});
 await auto.check();assert.equal(checks,0);visible=true;online=false;await clock.next();assert.equal(checks,0);online=true;auto.wake();await flush();auto.wake();await flush();assert.equal(checks,1);assert.equal(clock.jobs.size,1);release();await flush();assert.equal(clock.jobs.size,1);auto.stop();assert.equal(clock.jobs.size,0);
});
test('manual disconnect stops polling; a late connect response cannot restore app connection or controls',async()=>{
 const f=appFixture();let release;f.bridge.connect=()=>new Promise(r=>release=r);const pending=f.auto.check();await flush();f.disconnect(true);release({token:'synthetic-pair',capabilities:{cdpAvailable:true}});await pending;assert.equal(f.state.browserConnected,false);assert.equal(f.$('browser-read').disabled,true);assert.equal(f.auto.status,'DISCONNECTED');assert.equal(f.clock.jobs.size,0);assert.equal(f.calls.disconnect,1);f.auto.wake();assert.equal(f.clock.jobs.size,0);
});
test('an in-flight status response after owner loss is disconnected and cannot expose connected controls',async()=>{
 const f=appFixture();let release;f.bridge.connect=()=>new Promise(r=>release=r);const pending=f.auto.check();await flush();f.state.ownerVerified=false;f.state.role=null;f.context.accessEpoch++;f.disconnect(true);release({token:'synthetic-pair',capabilities:{cdpAvailable:true}});await pending;assert.equal(f.state.browserConnected,false);assert.equal(f.$('browser-read').disabled,true);assert.equal(f.calls.disconnect,2);assert.equal(f.clock.jobs.size,0);
});
test('owner loss ends polling and stale failure cannot overwrite the disconnected UI',async()=>{
 const f=appFixture();await f.auto.check();let reject;f.bridge.observe=()=>new Promise((_,r)=>reject=r);const pending=f.read();f.state.ownerVerified=false;f.state.role=null;f.context.accessEpoch++;f.disconnect(true);const status=f.$('browser-status').textContent;reject(Error('BRIDGE_TIMEOUT'));await assert.rejects(pending,/BRIDGE_TIMEOUT/);assert.equal(f.$('browser-status').textContent,status);assert.equal(f.clock.jobs.size,0);
});
for(const code of ['BRIDGE_TIMEOUT','BRIDGE_NOT_INSTALLED','BRIDGE_NOT_PAIRED'])test('observation failure '+code+' clears stale connected UI without revoking pair or changing choices',async()=>{
 const f=appFixture();await f.connect();f.$('browser-include').checked=false;f.$('browser-auto').checked=false;const oldStatus=f.$('browser-status').textContent;f.bridge.observe=async()=>{throw Error(code);};await assert.rejects(f.read(),new RegExp(code));assert.equal(f.state.browserConnected,false);assert.equal(f.state.browserObservation,null);assert.notEqual(f.$('browser-status').textContent,oldStatus);assert.equal(f.$('browser-preview').hidden,true);assert.equal(f.$('browser-observation').textContent,'');for(const id of ['browser-include','browser-auto','browser-read'])assert.equal(f.$(id).disabled,true);assert.equal(f.$('browser-include').checked,false);assert.equal(f.$('browser-auto').checked,false);assert.equal(f.calls.disconnect,0);
});
test('a malformed observation also invalidates connected UI',async()=>{
 const f=appFixture();await f.connect();f.bridge.observe=async()=>({...observation(),controls:null});await assert.rejects(f.read(),/BRIDGE_UNAVAILABLE/);assert.equal(f.state.browserConnected,false);assert.equal(f.$('browser-preview').hidden,true);
});
test('failed automatic handshake shows unconfirmed status and rechecks after four seconds',async()=>{
 const f=appFixture();await f.auto.check();f.bridge.connect=async()=>{f.calls.connect++;throw Error('BRIDGE_NOT_INSTALLED');};await f.clock.next();assert.equal(f.auto.status,'NOT_INSTALLED');assert.equal(f.state.browserConnected,false);assert.equal(f.$('browser-read').disabled,true);assert.match(f.$('browser-status').textContent,/ni dosegljiva/);assert.equal([...f.clock.jobs.values()][0].ms,4000);f.auto.stop();
});
test('status polling and recovery of the same approved pair preserve explicit unchecked choices and never dispatch CPQ actions',async()=>{
 const f=appFixture();await f.auto.check();f.$('browser-include').checked=false;f.$('browser-auto').checked=false;const frozen=f.calls.clearFrozen;await f.clock.next();assert.equal(f.calls.clearFrozen,frozen);assert.equal(f.calls.observe,1);f.bridge.observe=async()=>{throw Error('BRIDGE_TIMEOUT');};await assert.rejects(f.read(),/BRIDGE_TIMEOUT/);f.bridge.observe=async()=>{f.calls.observe++;return observation();};await f.clock.next();assert.equal(f.state.browserConnected,true);assert.equal(f.calls.observe,2);assert.equal(f.$('browser-include').checked,false);assert.equal(f.$('browser-auto').checked,false);assert.equal(f.calls.disconnect,0);assert.equal(f.calls.clearFrozen,frozen);assert.equal(f.$('browser-setup').open,false);f.auto.stop();
});
test('a newly approved pair gets fresh defaults, while manual disconnect requires pairing again',async()=>{
 const f=appFixture();await f.connect();f.$('browser-auto').checked=false;f.disconnect(true);assert.equal(f.$('browser-auto').checked,false);f.bridge.connect=async()=>({token:'new-explicit-pair',capabilities:{cdpAvailable:true}});await f.connect();assert.equal(f.$('browser-auto').checked,true);assert.equal(f.$('browser-include').checked,true);
});

function workerFixture(){let now=1000000,scripts=0,targetUrl=ORIGIN+'/sl/order/details/view/SYNTHETIC';const token='synthetic-pair',storage={guiPair:{cpqTabId:13,assistantTabId:23,origin:ORIGIN,scope:'order',token,expiresAt:now+30*60000,identity:'synthetic-owner',cdpAvailable:true,allowWrites:false,paused:false,attempted:[],lastObserved:null}};
 const api={runtime:{id:'synthetic-extension',getURL:x=>'chrome-extension://synthetic-extension/'+x},tabs:{get:async id=>({id,url:id===13?targetUrl:APP})},storage:{session:{get:async k=>({[k]:structuredClone(storage[k])}),set:async o=>Object.assign(storage,structuredClone(o)),remove:async k=>{delete storage[k];}}},scripting:{executeScript:async()=>{scripts++;const o=observation();return [{frameId:0,result:{ok:true,observation:{...o,observationId:o.id,scope:'order'}}}];}}};
 let handle=makeGuiBridgeHandler(api,()=>now);const sender={url:APP,frameId:0,tab:{id:23}},message=(type,data={})=>({protocol:'omnicpq.gui.v2',type,token,identity:'synthetic-owner',...data});
 return {storage,api,sender,message,request:(type,data={},s=sender)=>handle(message(type,data),s),advance:ms=>now+=ms,restart:()=>{handle=makeGuiBridgeHandler(api,()=>now);},scripts:()=>scripts,setTargetUrl:value=>targetUrl=value};
}
test('real MV3 handler re-creation retains the session pair at eight minutes and does not extend its 30-minute expiry',async()=>{
 const f=workerFixture(),expiry=f.storage.guiPair.expiresAt;assert.equal((await f.request('status')).ok,true);f.advance(8*60000);f.restart();const status=await f.request('status');assert.equal(status.ok,true);assert.equal(status.expiresAt,expiry);assert.equal((await f.request('observe')).ok,true);assert.equal(f.storage.guiPair.expiresAt,expiry);f.advance(22*60000);assert.equal((await f.request('status')).error,'BRIDGE_NOT_PAIRED');assert.equal(f.scripts(),1);
});
test('worker re-creation retains paused state, attempted IDs and exact tab/identity/origin protections',async()=>{
 const f=workerFixture();f.storage.guiPair.paused=true;f.storage.guiPair.attempted=[randomUUID()];f.restart();assert.equal((await f.request('status')).paused,true);assert.equal((await f.request('observe',{}, {...f.sender,tab:{id:24}})).error,'BRIDGE_NOT_PAIRED');assert.equal((await f.request('observe',{}, {...f.sender,url:'https://outside.invalid/'})).error,'BRIDGE_SENDER_NOT_ALLOWED');assert.equal((await f.request('observe',{token:'wrong'})).error,'BRIDGE_NOT_PAIRED');assert.equal(f.scripts(),0);assert.equal((await f.request('status',{identity:'different-owner'})).error,'BRIDGE_NOT_PAIRED');assert.equal(f.storage.guiPair,undefined);
});
test('a consumed action ID remains rejected after worker re-creation',async()=>{
 const f=workerFixture();const o=(await f.request('observe')).observation,id=randomUUID();f.storage.guiPair.attempted=[id];f.restart();const r=await f.request('execute',{action:{schema:'omnicpq.gui.action.v2',actionId:id,observationId:o.observationId,revision:o.revision,targetId:'c0',operation:'scroll',deltaY:400,reason:'SYNTHETIC ONLY'}});assert.equal(r.error,'CPQ_ACTION_ALREADY_ATTEMPTED');assert.equal(f.scripts(),1);
});
test('status is pair metadata only; a changed CPQ origin remains blocked on observation',async()=>{
 const f=workerFixture();f.setTargetUrl('https://outside.invalid/sl/order');assert.equal((await f.request('status')).ok,true);assert.equal((await f.request('observe')).error,'BRIDGE_TARGET_CHANGED');assert.equal(f.scripts(),0);
});
for(const name of ['browser-bridge-v2.mjs','browser-bridge.mjs'])test(name+' sends a timed-out write exactly once and ignores a late callback',async()=>{
 const source=await read(appRoot,name),clock=scheduler(),messages=[];let late;
 const context=vm.createContext({URL,Set,Map,Error,Number,JSON,globalThis:{},setTimeout:clock.schedule,clearTimeout:clock.unschedule});vm.runInContext(source.replace(/^export /gm,''),context);
 const protocol=name.includes('v2')?'omnicpq.gui.v2':'omnicpq.browser.v1';
 const runtime={sendMessage:(_,m,cb)=>{messages.push(m);if(m.type==='status')cb({ok:true,protocol,token:'synthetic-pair',scope:'order',capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3}});else late=cb;}};
 const client=context.createBrowserBridge({runtime});await client.connect();const action={actionId:randomUUID()};const pending=name.includes('v2')?client.execute(action):client.navigate(action);const rejection=assert.rejects(pending,/BRIDGE_TIMEOUT/);assert.equal(clock.jobs.size,1);await clock.next();await rejection;late({ok:true,receipt:{status:'DISPATCHED'}});await flush();assert.equal(messages.filter(m=>m.type==='execute'||m.type==='navigate').length,1);assert.equal(clock.jobs.size,0);
});


test('actual workspace-status follows successful read, failed read, recovery and manual disconnect',async()=>{
 const f=appFixture();await f.connect();f.context.showWorkspaceStatus();assert.match(f.$('workspace-status').textContent,/povezan CPQ/);f.bridge.observe=async()=>{throw Error('BRIDGE_NOT_INSTALLED');};await assert.rejects(f.read(),/BRIDGE_NOT_INSTALLED/);assert.doesNotMatch(f.$('workspace-status').textContent,/povezan CPQ/);f.bridge.observe=async()=>observation();await f.connect(true);assert.match(f.$('workspace-status').textContent,/povezan CPQ/);f.disconnect(true);assert.doesNotMatch(f.$('workspace-status').textContent,/povezan CPQ/);
});
function clientFromSource(source,clock,runtime){const context=vm.createContext({URL,Set,Map,Error,Number,JSON,globalThis:{},setTimeout:clock.schedule,clearTimeout:clock.unschedule});vm.runInContext(source.replace(/^export /gm,''),context);return context.createBrowserBridge({runtime});}
async function realClientFixture(name,{failMethod,failCode,hold=false}={}){
 const f=appFixture(),messages=[];let late=null;
 const v2=name.includes('v2'),protocol=v2?'omnicpq.gui.v2':'omnicpq.browser.v1';
 const obs=()=>{const o=observation();return {...o,schema:v2?'omnicpq.gui.observation.v2':'omnicpq.browser-observation.v1',observationId:o.id,scope:'order',controls:[{id:v2?'c0':'n0',label:'SYNTHETIC scroll target',enabled:true}]};};
 const runtime={sendMessage:(_,m,cb)=>{
   messages.push(m);
   if(m.type===failMethod){if(hold)late=cb;else cb({ok:false,error:failCode});return;}
   if(m.type==='status')cb({ok:true,protocol,token:'synthetic-pair',scope:'order',capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3,cdpAvailable:true}});
   else if(m.type==='observe')cb({ok:true,observation:obs()});
   else if(m.type==='preview')cb({ok:true,prepared:{revision:'a'.repeat(64),documentKey:'SYNTHETIC',label:'SYNTHETIC scroll target',risk:'ordinary'}});
   else if(m.type==='execute')cb({ok:true,receipt:{status:'DISPATCHED',target:{operation:'scroll',label:'SYNTHETIC scroll target'}},observation:obs()});
   else if(m.type==='navigate')cb({ok:true,receipt:{outcome:'CLICK_DISPATCHED',target:{label:'SYNTHETIC link'}}});
   else if(m.type==='disconnect')cb({ok:true});else throw Error('unexpected synthetic method '+m.type);
 }};
 f.context.browserBridge=clientFromSource(await read(appRoot,name),f.clock,runtime);await f.connect();f.context.showWorkspaceStatus();
 return {...f,messages,proposal:{schema:v2?'omnicpq.gui.action.v2':'omnicpq.navigation.v1',revision:'a'.repeat(64),targetId:v2?'c0':'n0',operation:'scroll',deltaY:300,reason:'SYNTHETIC ONLY'},late:()=>late};
}
for(const [name,method] of [['browser-bridge-v2.mjs','execute'],['browser-bridge-v2.mjs','preview'],['browser-bridge.mjs','navigate']])test('actual executeBrowserNavigation '+method+' timeout clears both status areas, ignores late callback and recovers without another action',async()=>{
 const f=await realClientFixture(name,{failMethod:method,hold:true});assert.match(f.$('workspace-status').textContent,/povezan CPQ/);
 const pending=f.execute(f.proposal,0,true),rejection=assert.rejects(pending,/BRIDGE_TIMEOUT/);await flush();assert.equal(f.messages.filter(m=>m.type===method).length,1);await f.clock.next();await rejection;
 assert.equal(f.state.browserConnected,false);assert.equal(f.state.browserObservation,null);assert.doesNotMatch(f.$('workspace-status').textContent,/povezan CPQ/);assert.match(f.$('browser-status').textContent,/ne ponavljamo/);assert.equal(f.$('browser-read').disabled,true);assert.equal(f.state.guiCheckpoint,undefined);
 f.late()({ok:true,receipt:{status:'DISPATCHED',outcome:'CLICK_DISPATCHED',target:{label:'SYNTHETIC late response',operation:'scroll'}},prepared:{revision:'a'.repeat(64),documentKey:'SYNTHETIC'}});await flush();assert.equal(f.state.browserConnected,false);
 await f.auto.check();assert.equal(f.state.browserConnected,true);assert.match(f.$('workspace-status').textContent,/povezan CPQ/);assert.match(f.$('browser-status').textContent,/SYNTHETIC unsaved document/);assert.equal(f.messages.filter(m=>m.type===method).length,1);assert.equal(f.messages.filter(m=>m.type==='execute'||m.type==='navigate').length,method==='preview'?0:1);assert.equal(f.state.guiCheckpoint,undefined);f.auto.stop();
});
for(const code of ['CPQ_TARGET_COVERED','CPQ_SCREEN_CHANGED','CPQ_TARGET_OFFSCREEN','BRIDGE_BUSY','CPQ_ACTION_OUTCOME_UNKNOWN'])test('actual action failure '+code+' preserves a reachable connection and is not classified as transport loss',async()=>{
 const f=await realClientFixture('browser-bridge-v2.mjs',{failMethod:'preview',failCode:code});await assert.rejects(f.execute(f.proposal,0,true),new RegExp(code));assert.equal(f.state.browserConnected,true);assert.match(f.$('workspace-status').textContent,/povezan CPQ/);assert.equal(f.messages.filter(m=>m.type==='execute').length,0);if(code==='CPQ_TARGET_OFFSCREEN'){const text=f.context.browserProblem(Error(code));assert.match(text,/Tarča ni v vidnem območju/);assert.doesNotMatch(text,/ni dosegljiva|ponovno vzpostavi/);}
});
for(const [method,code] of [['preview','BRIDGE_NOT_INSTALLED'],['execute','BRIDGE_UNAVAILABLE'],['navigate','BRIDGE_NOT_PAIRED']])test('actual '+method+' '+code+' invalidates both status areas without sending disconnect',async()=>{
 const f=await realClientFixture(method==='navigate'?'browser-bridge.mjs':'browser-bridge-v2.mjs',{failMethod:method,failCode:code});await assert.rejects(f.execute(f.proposal,0,true),new RegExp(code));assert.equal(f.state.browserConnected,false);assert.doesNotMatch(f.$('workspace-status').textContent,/povezan CPQ/);assert.equal(f.messages.filter(m=>m.type==='disconnect').length,0);assert.equal(f.messages.filter(m=>m.type===method).length,1);
});
for(const name of ['browser-bridge-v2.mjs','browser-bridge.mjs'])test(name+' late cancelled status revokes only its old pair; a waiting connect accepts a newly approved pair',async()=>{
 const clock=scheduler(),messages=[];let callback,pair='old-pair',first=true;const protocol=name.includes('v2')?'omnicpq.gui.v2':'omnicpq.browser.v1';
 const status=token=>({ok:true,protocol,token,scope:'order',capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3}});
 const runtime={sendMessage:(_,m,cb)=>{messages.push(m);if(m.type==='status'){if(first){first=false;callback=()=>cb(status('old-pair'));}else cb(pair?status(pair):{ok:false,error:'BRIDGE_NOT_PAIRED'});}else if(m.type==='disconnect'){if(m.token===pair){pair=null;cb({ok:true});}else cb({ok:false,error:'BRIDGE_NOT_PAIRED'});}else if(m.type==='observe'){const o=observation();cb({ok:true,observation:{...o,observationId:o.id,scope:'order'}});}else throw Error('unexpected '+m.type);}};
 const client=clientFromSource(await read(appRoot,name),clock,runtime),old=client.connect(),oldRejected=assert.rejects(old,/BRIDGE_CONNECTION_CHANGED/),disconnected=client.disconnect();pair='new-explicit-pair';const current=client.connect();await flush();assert.equal(messages.filter(m=>m.type==='status').length,1);callback();await oldRejected;await disconnected;await current;assert.equal(pair,'new-explicit-pair');await client.observe();assert.equal(messages.at(-1).token,'new-explicit-pair');assert.deepEqual(messages.filter(m=>m.type==='disconnect').map(m=>m.token),['old-pair']);assert.equal(clock.jobs.size,0);
});
for(const name of ['browser-bridge-v2.mjs','browser-bridge.mjs'])test(name+' late status after manual disconnect closes the remote old pair and cannot be silently restored by the next check',async()=>{
 const clock=scheduler(),messages=[];let callback,pair='old-pair',first=true;const protocol=name.includes('v2')?'omnicpq.gui.v2':'omnicpq.browser.v1';
 const status=()=>({ok:true,protocol,token:pair,scope:'order',capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3}});
 const runtime={sendMessage:(_,m,cb)=>{messages.push(m);if(m.type==='status'){if(first){first=false;const snapshot=status();callback=()=>cb(snapshot);}else cb(pair?status():{ok:false,error:'BRIDGE_NOT_PAIRED'});}else if(m.type==='disconnect'){assert.equal(m.token,'old-pair');pair=null;cb({ok:true});}else throw Error('unexpected '+m.type);}};
 const client=clientFromSource(await read(appRoot,name),clock,runtime),pending=client.connect(),rejection=assert.rejects(pending,/BRIDGE_CONNECTION_CHANGED/),disconnected=client.disconnect();callback();await rejection;await disconnected;assert.equal(pair,null);await assert.rejects(client.observe(),/BRIDGE_NOT_PAIRED/);await assert.rejects(client.connect(),/BRIDGE_NOT_PAIRED/);assert.equal(messages.filter(m=>m.type==='disconnect').length,1);assert.equal(clock.jobs.size,0);
});
test('v2 identity change invalidates an in-flight status and leaves token, scope and capabilities empty',async()=>{
 const clock=scheduler();let callback;const client=clientFromSource(await read(appRoot,'browser-bridge-v2.mjs'),clock,{sendMessage:(_,m,cb)=>{if(m.type==='status')callback=cb;else if(m.type==='disconnect')cb({ok:true});else throw Error('unexpected '+m.type);}});const pending=client.connect(),rejection=assert.rejects(pending,/BRIDGE_CONNECTION_CHANGED/);client.setIdentity('different-synthetic-owner');callback({ok:true,protocol:'omnicpq.gui.v2',token:'old-owner-pair',scope:'order',capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3}});await rejection;await assert.rejects(client.observe(),/BRIDGE_NOT_PAIRED/);assert.equal(client.scope,null);assert.equal(client.capabilities,null);
});
for(const name of ['browser-bridge-v2.mjs','browser-bridge.mjs'])test('actual app plus '+name+' remains disconnected after a late status and has no cached read token',async()=>{
 const f=appFixture(),messages=[];let callback;const protocol=name.includes('v2')?'omnicpq.gui.v2':'omnicpq.browser.v1';const client=clientFromSource(await read(appRoot,name),f.clock,{sendMessage:(_,m,cb)=>{messages.push(m);if(m.type==='status')callback=cb;else if(m.type==='observe'){const o=observation();cb({ok:true,observation:{...o,observationId:o.id,scope:'order'}});}else if(m.type==='disconnect')cb({ok:true});else throw Error('unexpected '+m.type);}});f.context.browserBridge=client;
 const pending=f.auto.check();await flush();f.disconnect(true);const text=f.$('browser-status').textContent;callback({ok:true,protocol,token:'late-old-pair',capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3}});await pending;await assert.rejects(client.observe(),/BRIDGE_NOT_PAIRED/);assert.equal(f.state.browserConnected,false);assert.equal(f.$('browser-status').textContent,text);assert.doesNotMatch(f.$('workspace-status').textContent,/povezan CPQ/);assert.equal(messages.filter(m=>m.type==='observe').length,0);assert.equal(messages.filter(m=>m.type==='disconnect').length,1);assert.equal(f.clock.jobs.size,0);
});

for(const code of ['CPQ_SCREEN_CHANGED','CPQ_TARGET_COVERED'])test('fresh handshake plus '+code+' observation error preserves transport and retries reading on the next status',async()=>{
 const f=appFixture();f.bridge.observe=async()=>{throw Error(code);};await assert.rejects(f.connect(true),new RegExp(code));assert.equal(f.state.browserConnected,true);assert.equal(f.state.browserObservation,null);assert.equal(f.$('browser-preview').hidden,true);assert.equal(f.$('browser-observation').textContent,'');f.bridge.observe=async()=>observation();await f.connect(true);assert.equal(f.state.browserConnected,true);assert(f.state.browserObservation);assert.match(f.$('browser-status').textContent,/SYNTHETIC unsaved document/);assert.match(f.$('workspace-status').textContent,/povezan CPQ/);
});

test('an automatic handshake returning a different pair always discards old observation and reads the new PROD document before enabling controls',async()=>{
 const f=appFixture();await f.connect();const old=f.state.browserObservation;assert.equal(f.$('browser-auto').checked,true);f.bridge.connect=async()=>({token:'new-explicit-prod-pair',capabilities:{cdpAvailable:true}});let release;f.bridge.observe=()=>new Promise(r=>release=r);const pending=f.connect(true);await flush();assert.equal(f.state.browserObservation,null);assert.equal(f.$('browser-auto').disabled,true);assert.equal(f.$('browser-read').disabled,true);assert.doesNotMatch(f.$('browser-status').textContent,/SYNTHETIC unsaved document/);assert.doesNotMatch(f.$('workspace-status').textContent,/povezan CPQ/);release({...observation(),url:'https://cpq.apps.prod-ocp.ts.telekom.si/sl/order/details/view/SYNTHETIC-PROD',title:'SYNTHETIC PROD',documentKey:'SYNTHETIC-PROD'});await pending;assert.notEqual(f.state.browserObservation,old);assert.equal(f.state.browserObservation.documentKey,'SYNTHETIC-PROD');assert.equal(f.$('browser-auto').checked,false);assert.match(f.$('workspace-status').textContent,/PROD.*povezan CPQ/);
});
test('actual checkbox opt-out during pending automatic status survives a new STAGE pair and its delayed observation',async()=>{
 const f=appFixture();await f.connect();let status,observe;f.bridge.connect=()=>new Promise(r=>status=r);f.bridge.observe=()=>new Promise(r=>observe=r);const pending=f.connect(true);f.$('browser-auto').checked=false;f.$('browser-auto').onchange();f.$('browser-include').checked=false;f.$('browser-include').onchange();status({token:'different-explicit-stage-pair',capabilities:{cdpAvailable:true}});await flush();assert.equal(f.$('browser-auto').disabled,true);observe({...observation(),documentKey:'SYNTHETIC-B'});await pending;assert.equal(f.$('browser-auto').checked,false);assert.equal(f.$('browser-include').checked,false);assert.equal(f.state.browserStop,true);
});
test('initial connection keeps consent controls disabled while first observation is pending',async()=>{
 const f=appFixture();let release;f.bridge.observe=()=>new Promise(r=>release=r);const pending=f.connect(true);await flush();assert.equal(f.$('browser-auto').disabled,true);assert.equal(f.$('browser-include').disabled,true);release(observation());await pending;assert.equal(f.$('browser-auto').disabled,false);assert.equal(f.$('browser-include').disabled,false);
});

for(const lateFailure of [false,true])test('a late old-pair observation '+(lateFailure?'failure':'success')+' cannot overwrite or disconnect the newly observed pair',async()=>{
 const f=appFixture();await f.connect();let release,reject;f.bridge.observe=()=>new Promise((r,j)=>{release=r;reject=j;});const old=f.read(),oldRejected=assert.rejects(old,lateFailure?/BRIDGE_TIMEOUT/:/BRIDGE_NOT_PAIRED/);f.bridge.connect=async()=>({token:'new-pair-B',capabilities:{cdpAvailable:true}});f.bridge.observe=async()=>({...observation(),documentKey:'SYNTHETIC-B',title:'SYNTHETIC B'});await f.connect(true);const status=f.$('browser-status').textContent;if(lateFailure)reject(Error('BRIDGE_TIMEOUT'));else release({...observation(),documentKey:'SYNTHETIC-A',title:'SYNTHETIC A'});await oldRejected;assert.equal(f.state.browserConnected,true);assert.equal(f.state.browserObservation.documentKey,'SYNTHETIC-B');assert.equal(f.$('browser-status').textContent,status);assert.match(f.$('workspace-status').textContent,/povezan CPQ/);
});
test('actual manual refresh clears an inherited targeted query and offset while explicit agent reads retain their query',async()=>{
 const f=appFixture();await f.connect();const requests=[];f.state.browserObservation={...observation(),controls:[],fields:[],paging:{offset:360,limit:180,query:'targeted synthetic label'}};f.bridge.observe=async(offset,limit,query,framePath)=>{requests.push({offset,limit,query,framePath});return {...observation(),controls:query?[]:[{id:'c0',label:'SYNTHETIC visible control',enabled:true}],paging:{offset,limit,query}};};f.$('browser-read').onclick();await flush();assert.equal(requests[0].offset,0);assert.equal(requests[0].query,'');assert.equal(f.state.browserObservation.controls.length,1);await f.read({offset:180,query:'agent target'});assert.equal(requests[1].offset,180);assert.equal(requests[1].query,'agent target');await f.read();assert.equal(requests[2].query,'agent target');assert.equal(requests[2].offset,180);
});
