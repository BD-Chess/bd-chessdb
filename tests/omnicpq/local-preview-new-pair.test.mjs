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

test('PREVIEW_QUEUE new pair observes before an already-started old observation settles',async()=>{
 const f=appFixture();await f.connect();let releaseOld;f.bridge.observe=()=>new Promise(r=>releaseOld=r);const old=f.read();const oldRejected=assert.rejects(old,/BRIDGE_NOT_PAIRED/);await flush();assert.equal(typeof releaseOld,'function');
 f.bridge.connect=async()=>({token:'new-pair-B',capabilities:{cdpAvailable:true}});let newStarted=false;f.bridge.observe=async()=>{newStarted=true;return {...observation(),documentKey:'SYNTHETIC-B',title:'SYNTHETIC B'};};
 const connecting=f.connect(true);await flush();const beganBeforeRelease=newStarted;releaseOld({...observation(),documentKey:'SYNTHETIC-A'});await oldRejected;await connecting;assert.equal(f.state.browserObservation.documentKey,'SYNTHETIC-B');console.log('PREVIEW_QUEUE_NEW_PAIR',JSON.stringify({beganBeforeRelease}));assert.equal(beganBeforeRelease,true);
});