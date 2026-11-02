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
const STAGE='https://cpq-stg.apps.test-ocp.ts.telekom.si',PROD='https://cpq.apps.prod-ocp.ts.telekom.si';
const NAV_APP_SOURCE='public/OmniCPQ/app.mjs';
async function harness({prefs={},origin=STAGE,paired=false,risk='navigate',operation='click',label=null,options=[],value='512',valueSource='user',currentValue='',extraControls=[],effectTitle='',navigationLocked=true,targetKind=null,targetVisible=true,targetEnabled=true}={}) {
  const dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:'https://www.mdlxdcc.org/omnicpq/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,$=id=>w.document.getElementById(id),calls={gui:0,legacy:0,status:[],observe:0,preview:0,execute:0,posts:0,requests:[]};
  let revision=0,token='pair-1';
  const observation=()=>({schema:'omnicpq.gui.observation.v2',observationId:'obs-'+revision,revision:String(revision+1).repeat(64).slice(0,64),url:origin+'/sl/order/details/view/SYNTHETIC',title:revision&&effectTitle?effectTitle:'OMNI-123 SYNTHETIC',scope:'order',dialogOpen:false,navigationLocked,documentKey:'SYNTHETIC-DOC',text:'SYNTHETIC',controls:[{id:'c1',label:label??(operation==='fill'?'RAM':risk==='irreversible'?'Oddaj':'Podrobnosti'),options,valueSource,value:currentValue,type:operation==='fill'?'text':'button',enabled:targetEnabled,kind:targetKind??(operation==='fill'?'field':'button'),visibleInViewport:targetVisible},...extraControls],frames:[],paging:{offset:0,limit:180}});
  const chromeRuntime={sendMessage(_extension,message,reply){
    if(message.type==='status'){calls.status.push(message.protocol);return reply(paired?{ok:true,protocol:gui.BRIDGE_PROTOCOL,token,capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3,cdpAvailable:true}}:{ok:false,error:'BRIDGE_NOT_PAIRED'});}
    if(message.type==='observe'){calls.observe++;return reply({ok:true,observation:observation()});}
    if(message.type==='preview'){calls.preview++;return reply({ok:true,prepared:{revision:observation().revision,documentKey:'SYNTHETIC-DOC',risk,label:label??(risk==='irreversible'?'Oddaj':'Podrobnosti')}});}
    if(message.type==='execute'){calls.execute++;revision++;return reply({ok:true,receipt:{status:'DISPATCHED',target:{operation:message.action.operation,label:'SYNTHETIC'}},observation:observation()});}
    return reply({ok:true});
  }};
  Object.assign(w,{...runtime,...core,...prompts,...starters,cpqLocation:gui.cpqLocation,Response,Blob,AbortController,
    createBrowserBridge:()=>{calls.gui++;return gui.createBrowserBridge({runtime:chromeRuntime});},
    createLegacyBridge:()=>{calls.legacy++;return legacy.createBrowserBridge({runtime:chromeRuntime});}});
  w.matchMedia=()=>({matches:false});w.confirm=()=>{throw Error('UNEXPECTED_CONFIRM');};
  w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{d.open=false;};d.showModal=()=>{d.open=true;};});
  w.localStorage.setItem('omnicpq:preferences:v1',JSON.stringify(prefs));
  w.fetch=async(path,options={})=>{
    if(options.method==='POST'&&String(path).includes('omnicpq-assistant')){
      calls.posts++;const body=JSON.parse(options.body);calls.requests.push(body);
      const action={schema:'omnicpq.gui.action.v2',observationId:body.browser?.id,revision:body.browser?.revision,targetId:'c1',operation,...(['fill','selectNative'].includes(operation)?{value}:{}),reason:'SYNTHETIC',expectedDocument:'SYNTHETIC-DOC'};
      const text=calls.posts===1?'SYNTHETIC\n```omnicpq_action\n'+JSON.stringify(action)+'\n```':'SYNTHETIC finished';
      const frames=[{type:'delta',text,clientRequestId:body.clientRequestId},{type:'done',status:'complete',clientRequestId:body.clientRequestId}];
      return new Response(frames.map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
    }
    return Response.json({ok:true,available:true,version:core.APP_VERSION,account:{id:'SYNTHETIC_OWNER',role:'owner'},privateKnowledge:'VERIFIED',starterPrompts:{version:starters.STARTER_VERSION,sha256:await core.digest(JSON.stringify(starters.STARTERS))},skill:{promptsSha256:prompts.PROMPTS_SHA256},services:[]});
  };
  const code=(await readFile(NAV_APP_SOURCE,'utf8')).replace(/^import .*;\r?\n/gm,'').replace('health(); installWorker();','window.boot=health();');
  w.eval(code+'\nwindow.app={state,setMode,send,connectBrowser,disconnectBrowser,autoConnector,automaticStageGoal,localWrite,startNewChat,navigationDestinationStatus,navigationRequest,navigationEffectStatus,rememberNavigationAmbiguities,navigationTargetAmbiguous};');
  await w.boot;await new Promise(r=>setImmediate(r));w.app.autoConnector.stop();
  return {dom,w,$,app:w.app,calls,setPair(value=true){paired=value;token='pair-'+(Number(token.split('-')[1])+1);},setOrigin(value){origin=value;},async pair(){paired=true;await w.app.connectBrowser();},async send(goal,mode='work',profile='fast'){w.app.setMode(mode);w.app.state.profile=profile;$('message').value=goal;await w.app.send();},close(){w.app.autoConnector.stop();dom.window.close();}};
}

const GOAL='Odpri zavihek Postavke v tem testnem naročilu.';
const extras=[{id:'c2',label:'Postavke',kind:'control',enabled:true,visibleInViewport:true},{id:'c3',label:'Postavke',kind:'control',enabled:true,visibleInViewport:true}];
for(const profile of ['fast','careful'])test('FULL_APP exact42 one tab, observed effect, '+profile,async()=>{
  const h=await harness({risk:'ordinary',label:'Postavke',targetKind:'tab',navigationLocked:false,effectTitle:'OMNI-123 SYNTHETIC - Postavke',extraControls:extras});
  try{await h.pair();await h.send(GOAL,'work',profile);assert.equal(h.calls.execute,1);assert.equal(h.app.state.agentRun.recoveries,0);assert(h.calls.posts>=1);assert(h.calls.posts<=2);assert.equal(h.calls.requests[0].profile,profile);}finally{h.close();}
});
test('FULL_APP exact42 dispatched without observed effect is not repeated',async()=>{
  const h=await harness({risk:'ordinary',label:'Postavke',targetKind:'tab',navigationLocked:false,extraControls:extras});
  try{await h.pair();await h.send(GOAL);assert.equal(h.calls.execute,1);assert.equal(h.calls.posts,1);assert.equal(h.app.state.agentRun.recoveries,0);assert.equal(h.app.state.guiCheckpoint.status,'DISPATCHED_EFFECT_UNPROVEN');}finally{h.close();}
});
for(const [name,overrides] of [
  ['duplicate tab',{extraControls:[...extras,{id:'c4',label:'Postavke',kind:'tab',enabled:true,visibleInViewport:true}]}],
  ['offscreen',{targetVisible:false}],['disabled',{targetEnabled:false}],['wrong kind',{targetKind:'button'}],['wrong label',{label:'Shrani'}],['navigation locked',{navigationLocked:true}]
])test('FULL_APP exact42 holds '+name,async()=>{
  const h=await harness({risk:'ordinary',label:'Postavke',targetKind:'tab',navigationLocked:false,extraControls:extras,...overrides});
  try{await h.pair();await h.send(GOAL);assert.equal(h.calls.execute,0);}finally{h.close();}
});
