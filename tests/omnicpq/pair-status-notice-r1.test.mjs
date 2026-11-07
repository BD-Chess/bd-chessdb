import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const localRoot=fileURLToPath(new URL('../..',import.meta.url));
const appRoot=localRoot;
const baseRoot=localRoot;
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
  const includeStart=appSource.indexOf('function syncBrowserIncludeControl()'),includeEnd=appSource.indexOf('function setBusy(',includeStart);
  assert(includeStart>=0&&includeEnd>includeStart);vm.runInContext(appSource.slice(includeStart,includeEnd),context);
  const begin=appSource.indexOf('function browserProblem('),end=appSource.indexOf('async function send(');
  assert(begin>=0&&end>begin);const ws=appSource.indexOf('function showWorkspaceStatus()'),we=appSource.indexOf('async function readReleaseInfo()',ws),guardStart=appSource.indexOf('function unboundStageConstraint('),guardEnd=appSource.indexOf('function automaticStageGoal(',guardStart);assert(ws>=0&&we>ws&&guardStart>=0&&guardEnd>guardStart);vm.runInContext(appSource.slice(guardStart,guardEnd)+appSource.slice(ws,we)+appSource.slice(begin,end),context);
  const a=appSource.indexOf('const autoConnector='),b=appSource.indexOf('const element =',a);
  assert(a>=0&&b>a);vm.runInContext(appSource.slice(a,b)+'\nglobalThis.auto=autoConnector;',context);
  const cs=appSource.indexOf("for (const id of ['browser-include','browser-auto']) $(id).onchange"),ce=appSource.indexOf("$('settings-open')",cs);assert(cs>=0&&ce>cs);vm.runInContext(appSource.slice(cs,ce),context);
  const rs=appSource.indexOf("$('browser-read').onclick ="),re=appSource.indexOf('\n',rs);assert(rs>=0&&re>rs);vm.runInContext(appSource.slice(rs,re),context);
  return {context,state,$,nodes,bridge,calls,notices,clock,auto:context.auto,connect:context.connectBrowser,read:context.readBrowserObservation,disconnect:context.disconnectBrowser,execute:context.executeBrowserNavigation};
}

const PAIR_SUCCESS='CPQ povezava je potrjena. Pripravljeno za tvoj STAGE cilj.';
function noticeFixture(){
 const f=appFixture();f.$('notice').dataset={};
 const begin=appSource.indexOf('function notice('),end=appSource.indexOf('\n',begin);
 assert(begin>=0&&end>begin);vm.runInContext(appSource.slice(begin,end),f.context);
 return f;
}
test('PAIR_NOTICE revoked approval replaces connection-owned success',async()=>{
 const f=noticeFixture();await f.auto.check();assert.equal(f.$('notice').textContent,PAIR_SUCCESS);
 f.bridge.connect=async()=>{throw Error('BRIDGE_NOT_PAIRED');};await f.clock.next();
 assert.equal(f.auto.status,'WAITING_APPROVAL');assert.equal(f.state.browserConnected,false);
 assert.equal(f.state.browserObservation,null);assert.match(f.$('browser-status').textContent,/ČAKAM NA ODOBRITEV/);
 assert.match(f.$('notice').textContent,/ČAKAM NA ODOBRITEV/);
 assert.equal(f.$('browser-read').disabled,true);assert.equal(f.calls.disconnect,0);f.auto.stop();
});
test('PAIR_NOTICE transport failure replaces connection-owned success',async()=>{
 const f=noticeFixture();await f.connect();f.bridge.observe=async()=>{throw Error('BRIDGE_TIMEOUT');};
 await assert.rejects(f.read(),/BRIDGE_TIMEOUT/);
 assert.match(f.$('notice').textContent,/se ni odzvala/);assert.equal(f.state.browserConnected,false);
 assert.equal(f.$('browser-preview').hidden,true);assert.equal(f.calls.disconnect,0);
});
test('PAIR_NOTICE different current notice survives unrelated pair failure',async()=>{
 const f=noticeFixture();await f.auto.check();f.context.notice('SYNTHETIC_SAVED_DRAFT');
 f.bridge.connect=async()=>{throw Error('BRIDGE_NOT_PAIRED');};await f.clock.next();
 assert.equal(f.$('notice').textContent,'SYNTHETIC_SAVED_DRAFT');
 assert.match(f.$('browser-status').textContent,/ČAKAM NA ODOBRITEV/);f.auto.stop();
});
test('PAIR_NOTICE fresh recovery replaces its own lost-pair notice',async()=>{
 const f=noticeFixture();await f.auto.check();f.$('browser-include').checked=false;
 f.bridge.connect=async()=>{throw Error('BRIDGE_NOT_PAIRED');};await f.clock.next();
 f.bridge.connect=async()=>({token:'synthetic-pair',capabilities:{cdpAvailable:true}});
 await f.clock.next();assert.equal(f.state.browserConnected,true);
 assert.equal(f.$('notice').textContent,PAIR_SUCCESS);assert.equal(f.$('browser-read').disabled,false);
 assert.equal(f.$('browser-include').checked,false);assert.equal(f.calls.disconnect,0);f.auto.stop();
});
test('PAIR_NOTICE manual disconnect clears only connection-owned notice',async()=>{
 const f=noticeFixture();await f.connect();f.disconnect(true);
 assert.equal(f.$('notice').hidden,true);assert.equal(f.state.browserConnected,false);
 const g=noticeFixture();await g.connect();g.context.notice('SYNTHETIC_UNRELATED_WARNING');g.disconnect(true);
 assert.equal(g.$('notice').textContent,'SYNTHETIC_UNRELATED_WARNING');assert.equal(g.$('notice').hidden,false);
});
test('PAIR_NOTICE logout plus late old failure preserves current auth notice',async()=>{
 const f=noticeFixture();await f.auto.check();let reject;
 f.bridge.observe=()=>new Promise((_,r)=>reject=r);const pending=f.read();
 f.state.ownerVerified=false;f.state.role=null;f.context.accessEpoch++;f.disconnect(true);
 f.context.notice('SYNTHETIC_SIGNED_OUT');reject(Error('BRIDGE_TIMEOUT'));
 await assert.rejects(pending,/BRIDGE_TIMEOUT/);
 assert.equal(f.$('notice').textContent,'SYNTHETIC_SIGNED_OUT');assert.equal(f.state.browserConnected,false);
 assert.equal(f.clock.jobs.size,0);
});
test('PAIR_NOTICE update-required background status replaces old success',async()=>{
 const f=noticeFixture();await f.auto.check();f.bridge.connect=async()=>{throw Error('BRIDGE_UPDATE_REQUIRED');};
 await f.clock.next();assert.equal(f.auto.status,'UPDATE_REQUIRED');assert.equal(f.state.browserConnected,false);
 assert.match(f.$('notice').textContent,/Posodobi celotno mapo/);f.auto.stop();
});

test('PAIR_NOTICE stale read-only handshake preserves newer owner notice',async()=>{
 const f=noticeFixture();let release;f.bridge.connect=()=>new Promise(r=>release=r);
 const pending=f.connect();await flush();f.state.ownerVerified=false;f.state.role=null;
 f.context.accessEpoch++;f.disconnect(true);f.context.notice('SYNTHETIC_NEW_OWNER_STATE');
 release({token:'synthetic-old',capabilities:{cdpAvailable:false}});await pending;
 assert.equal(f.$('notice').textContent,'SYNTHETIC_NEW_OWNER_STATE');assert.equal(f.state.browserConnected,false);
 assert.equal(f.calls.observe,0);
});
test('PAIR_NOTICE stale manual rejection preserves newer owner notice',async()=>{
 const f=noticeFixture();let reject;f.bridge.connect=()=>new Promise((_,r)=>reject=r);
 const pending=f.connect();await flush();f.state.ownerVerified=false;f.state.role=null;
 f.context.accessEpoch++;f.disconnect(true);f.context.notice('SYNTHETIC_NEW_OWNER_STATE');
 reject(Error('BRIDGE_TIMEOUT'));await pending;
 assert.equal(f.$('notice').textContent,'SYNTHETIC_NEW_OWNER_STATE');assert.equal(f.state.browserConnected,false);
 assert.equal(f.calls.observe,0);
});
