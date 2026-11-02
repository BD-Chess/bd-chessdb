import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as runtime from './app-runtime-imports.mjs';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
import * as starters from '../../public/OmniCPQ/starters.mjs';
import * as gui from '../../public/OmniCPQ/browser-bridge-v2.mjs';
import * as legacy from '../../public/OmniCPQ/browser-bridge.mjs';
const PREVIEW_APP='public/OmniCPQ/app.mjs',PREVIEW_INDEX='public/OmniCPQ/index.html';
function clock(){let t=0,id=0;const jobs=new Map();return {now:()=>t,schedule(fn,ms){const n=id++;jobs.set(n,{fn,at:t+ms});return n;},unschedule:n=>jobs.delete(n),advance(ms){t+=ms;for(const [n,j]of [...jobs].sort((a,b)=>a[1].at-b[1].at))if(j.at<=t&&jobs.has(n)){jobs.delete(n);j.fn();}},get timers(){return jobs.size;}};}
const micro=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function harness({prefs={},newIndex=true}={}){
 const markup=await readFile(PREVIEW_INDEX,'utf8');
 const dom=new JSDOM(newIndex?markup:markup.replace(/<label class="check-row"><input type="checkbox" id="browser-preview-auto"[^\n]*?<\/label>/,''),{url:'https://www.mdlxdcc.org/omnicpq/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id),c=clock();
 const calls={observe:0,posts:0,execute:0,preview:0,types:[],requests:[],observeArgs:[]};let paired=false,token='SYNTHETIC_PAIR_1',pairIndex=1,view={text:'SYNTHETIC_OLD',title:'SYNTHETIC_OLD_TITLE',revision:0},defer=false,visibility='visible',online=true,pending=[],lastSend=null;
 Object.defineProperty(w.document,'visibilityState',{get:()=>visibility,configurable:true});Object.defineProperty(w.navigator,'onLine',{get:()=>online,configurable:true});
 const observation=message=>({schema:'omnicpq.gui.observation.v2',observationId:'SYNTHETIC_OBS_'+calls.observe,revision:(view.revision%16).toString(16).repeat(64),capturedAt:new Date(1700000000000+calls.observe).toISOString(),url:gui.CPQ_ORIGINS.STAGE+'/sl/order/details/view/SYNTHETIC',title:view.title,scope:'order',documentKey:'SYNTHETIC_DOC',navigationLocked:true,dialogOpen:false,text:view.text,controls:[{id:'c1',label:'RAM',kind:'field',type:'number',inputType:'number',enabled:true,visibleInViewport:true,value:'4'}],frames:[{path:'0',accessible:true,title:'SYNTHETIC_FRAME'}],framePath:message.framePath||'',paging:{offset:message.offset||0,limit:message.limit||180,query:message.query||''}});
 const chromeRuntime={sendMessage(_extension,message,reply){calls.types.push(message.type);
  if(message.type==='status')return reply(paired?{ok:true,protocol:gui.BRIDGE_PROTOCOL,token,capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3,cdpAvailable:true}}:{ok:false,error:'BRIDGE_NOT_PAIRED'});
  if(message.type==='observe'){if(!paired)return reply({ok:false,error:'BRIDGE_NOT_PAIRED'});calls.observe++;calls.observeArgs.push({offset:message.offset,limit:message.limit,query:message.query,framePath:message.framePath});const o=observation(message);if(defer){defer=false;pending.push({reply,o});}else reply({ok:true,observation:o});return;}
  if(message.type==='preview')calls.preview++;if(message.type==='execute')calls.execute++;reply({ok:true});
 }};
 Object.assign(w,{...runtime,...core,...prompts,...starters,cpqLocation:gui.cpqLocation,Response,Blob,AbortController,previewClock:c,createBrowserBridge:()=>gui.createBrowserBridge({runtime:chromeRuntime}),createLegacyBridge:()=>legacy.createBrowserBridge({runtime:chromeRuntime})});
 w.matchMedia=()=>({matches:false});w.confirm=()=>{throw Error('SYNTHETIC_UNEXPECTED_CONFIRM');};w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>d.open=false;d.showModal=()=>d.open=true;});
 w.localStorage.setItem('omnicpq:preferences:v1',JSON.stringify(prefs));
 w.fetch=async(path,options={})=>{if(options.method==='POST'&&String(path).includes('omnicpq-assistant')){calls.posts++;const body=JSON.parse(options.body);calls.requests.push(body);const frames=[{type:'delta',text:'SYNTHETIC ANSWER ONLY',clientRequestId:body.clientRequestId},{type:'done',status:'complete',clientRequestId:body.clientRequestId}];return new Response(frames.map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});}return Response.json({ok:true,available:true,version:core.APP_VERSION,account:{id:'SYNTHETIC_OWNER',role:'owner'},privateKnowledge:'VERIFIED',starterPrompts:{version:starters.STARTER_VERSION,sha256:await core.digest(JSON.stringify(starters.STARTERS))},skill:{promptsSha256:prompts.PROMPTS_SHA256},services:[]});};
 const source=(await readFile(PREVIEW_APP,'utf8')).replace(/^import .*;\r?\n/gm,'').replace('now:()=>performance.now(),schedule:(fn,ms)=>window.setTimeout(fn,ms),unschedule:id=>window.clearTimeout(id),intervalMs:30000,focusDelayMs:100','now:()=>previewClock.now(),schedule:(fn,ms)=>previewClock.schedule(fn,ms),unschedule:id=>previewClock.unschedule(id),intervalMs:30000,focusDelayMs:100').replace('health(); installWorker();','window.boot=health();');
 w.eval(source+'\nwindow.app={state,setMode,send,connectBrowser,disconnectBrowser,autoConnector,previewRefresher,readBrowserObservation,setBusy,stopAgent,clearFrozen};');await w.boot;await new Promise(r=>setImmediate(r));w.app.autoConnector.stop();
 return {w,$,dom,c,app:w.app,calls,expirePair(){paired=false;},async pair(){paired=true;token='SYNTHETIC_PAIR_'+(++pairIndex);await w.app.connectBrowser();},setView(text){view={...view,text,title:text+'_TITLE',revision:view.revision+1};},deferNext(){defer=true;},release(error=null){assert(pending.length,'SYNTHETIC_NO_PENDING_OBSERVE');const p=pending.shift();p.reply(error?{ok:false,error}:{ok:true,observation:p.o});},get pending(){return pending.length;},setVisibility(value){visibility=value;w.document.dispatchEvent(new w.Event('visibilitychange'));},setOnline(value){online=value;w.dispatchEvent(new w.Event(value?'online':'offline'));},focus(){w.dispatchEvent(new w.Event('focus'));},async settle(){await micro();await w.app.previewRefresher.whenSettled();await micro();},async send(goal,profile='fast'){w.app.setMode('work');w.app.state.profile=profile;$('message').value=goal;lastSend=w.app.send();return lastSend;},async close(){w.app.previewRefresher.stop();w.app.autoConnector.stop();w.app.state.browserStop=true;w.app.state.ownerVerified=false;w.app.state.browserConnected=false;for(const p of pending.splice(0))p.reply({ok:false,error:'BRIDGE_NOT_PAIRED'});await w.app.previewRefresher.whenSettled();if(lastSend)await lastSend.catch(()=>{});dom.window.close();}};
}


test('independent full app: expired pair preserves draft and allows explicit no-CPQ send',async()=>{
  const h=await harness();try{
    await h.pair();const box=h.$('browser-include');assert.equal(box.checked,true);assert.equal(box.disabled,false);
    h.$('message').value='SYNTHETIC_DRAFT_1';h.expirePair();await assert.rejects(h.app.readBrowserObservation(),/BRIDGE_NOT_PAIRED/);
    assert.equal(h.app.state.browserConnected,false);assert.equal(h.$('message').value,'SYNTHETIC_DRAFT_1');
    assert.equal(box.checked,true);assert.equal(box.disabled,false);assert.equal(box.closest('[hidden]'),null);
    const before=h.calls.types.filter(x=>x==='resume').length;box.click();assert.equal(box.checked,false);
    await h.app.send();assert.equal(h.calls.posts,1);assert.equal(h.calls.requests[0].browser,null);
    assert.equal(h.calls.types.filter(x=>x==='resume').length,before);assert.equal(h.calls.execute,0);
  }finally{await h.close();}
});

test('independent full app: explicit no-CPQ choice survives new synthetic pair',async()=>{
  const h=await harness();try{
    await h.pair();const box=h.$('browser-include');h.expirePair();await assert.rejects(h.app.readBrowserObservation(),/BRIDGE_NOT_PAIRED/);
    box.click();assert.equal(box.checked,false);await h.pair();assert.equal(box.checked,false);assert.equal(box.disabled,false);
    h.$('message').value='SYNTHETIC_DRAFT_2';await h.app.send();assert.equal(h.calls.posts,1);
    assert.equal(h.calls.requests[0].browser,null);assert.equal(h.calls.execute,0);
  }finally{await h.close();}
});

test('independent full app: while busy no opt-out and no send',async()=>{
  const h=await harness();try{
    await h.pair();const box=h.$('browser-include');h.expirePair();await assert.rejects(h.app.readBrowserObservation(),/BRIDGE_NOT_PAIRED/);
    h.$('message').value='SYNTHETIC_DRAFT_3';h.app.setBusy(true);assert.equal(box.disabled,true);box.click();assert.equal(box.checked,true);
    await h.app.send();assert.equal(h.calls.posts,0);assert.equal(h.$('message').value,'SYNTHETIC_DRAFT_3');h.app.setBusy(false);
  }finally{await h.close();}
});
