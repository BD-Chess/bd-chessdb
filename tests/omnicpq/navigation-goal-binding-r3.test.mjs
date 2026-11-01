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
async function harness({prefs={},origin=STAGE,paired=false,risk='navigate',operation='click',label=null,options=[],value='512',valueSource='user',currentValue='',extraControls=[],effectTitle=''}={}) {
  const dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:'https://www.mdlxdcc.org/omnicpq/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,$=id=>w.document.getElementById(id),calls={gui:0,legacy:0,status:[],observe:0,preview:0,execute:0,posts:0,requests:[]};
  let revision=0,token='pair-1';
  const observation=()=>({schema:'omnicpq.gui.observation.v2',observationId:'obs-'+revision,revision:String(revision+1).repeat(64).slice(0,64),url:origin+'/sl/order/details/view/SYNTHETIC',title:revision&&effectTitle?effectTitle:'OMNI-123 SYNTHETIC',scope:'order',dialogOpen:false,navigationLocked:true,documentKey:'SYNTHETIC-DOC',text:'SYNTHETIC',controls:[{id:'c1',label:label??(operation==='fill'?'RAM':risk==='irreversible'?'Oddaj':'Podrobnosti'),options,valueSource,value:currentValue,type:operation==='fill'?'text':'button',enabled:true,kind:operation==='fill'?'field':'button',visibleInViewport:true},...extraControls],frames:[],paging:{offset:0,limit:180}});
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

const requested={id:'c2',label:'Naročila',kind:'link',enabled:true,visibleInViewport:true};
for(const goal of ['Odpri Naročila','Pojdi na Naročila','Open Naročila','Go to Naročila','Prosim, odpri Naročila','V CPQ odpri Naročila','Can you open Naročila?','Ali lahko odpreš Naročila?','Odpri "Naročila"'])test('NAV_CONFLICT held when explicit requested destination is observed '+goal,async()=>{const h=await harness({risk:'ordinary',operation:'click',label:'Stranke',extraControls:[requested]});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,0);assert.equal(h.calls.preview,1);assert.equal(h.calls.posts,2);assert.equal(h.app.state.agentRun.recoveries,1);assert.equal(h.app.state.guiCheckpoint.step,0);assert.equal(h.app.state.guiCheckpoint.status,'GOAL_ACCEPTED');assert.equal(h.app.state.messages.find(m=>m.role==='assistant').meta.browserNavigation.error,'CPQ_OBSERVED_DESTINATION_MISMATCH');}finally{h.close();}});
for(const operation of ['click','doubleClick'])test('NAV_MATCH requested ordinary control remains executable '+operation,async()=>{const h=await harness({risk:'ordinary',operation,label:'Naročila',effectTitle:'Naročila'});try{await h.pair();await h.send('Odpri Naročila');assert.equal(h.calls.execute,1);assert.equal(h.app.state.agentRun.recoveries,0);}finally{h.close();}});
test('NAV_CONFLICT also holds ordinary doubleClick',async()=>{const h=await harness({risk:'ordinary',operation:'doubleClick',label:'Stranke',extraControls:[requested]});try{await h.pair();await h.send('Odpri Naročila');assert.equal(h.calls.execute,0);assert.equal(h.app.state.agentRun.recoveries,1);}finally{h.close();}});
for(const [label,expected] of [['Naročila','REQUESTED_CONTROL_OBSERVED'],['Stranke','CONFLICT']])test('NAV_EVIDENCE returns status, never arrival attestation '+label,async()=>{const h=await harness();try{const o={schema:'omnicpq.gui.observation.v2',dialogOpen:false,controls:[requested,{id:'c1',label:'Stranke',kind:'button',enabled:true,visibleInViewport:true}]};const r=h.app.navigationDestinationStatus('Odpri Naročila',o,{operation:'click',targetId:label==='Naročila'?'c2':'c1'});assert.equal(r,expected);assert(!/REACHED|COMPLETE|APPROVED/.test(r));}finally{h.close();}});
for(const [name,goal,patch,operation,expected] of [['missing','Odpri Ponudbe',{},'click','TARGET_NOT_OBSERVED'],['offscreen','Odpri Naročila',{visibleInViewport:false},'click','TARGET_NOT_OBSERVED'],['disabled','Odpri Naročila',{enabled:false},'click','TARGET_NOT_OBSERVED'],['multi','Odpri Naročila in nato odpri Stranke',{},'click','CONFLICT'],['read','Odpri Naročila',{},'read','NOT_APPLICABLE_OPERATION'],['scroll','Odpri Naročila',{},'scroll','NOT_APPLICABLE_OPERATION'],['ensureVisible','Odpri Naročila',{},'ensureVisible','NOT_APPLICABLE_OPERATION']])test('NAV_BOUNDARY does not invent route authority '+name,async()=>{const h=await harness();try{assert.equal(h.app.navigationDestinationStatus(goal,{schema:'omnicpq.gui.observation.v2',dialogOpen:false,controls:[{...requested,...patch}]},{operation,targetId:'c1'}),expected);}finally{h.close();}});
test('NAV_BOUNDARY unknown dialog context is not a proven conflict',async()=>{const h=await harness();try{assert.equal(h.app.navigationDestinationStatus('Odpri Naročila',{schema:'omnicpq.gui.observation.v2',controls:[requested]},{operation:'click',targetId:'c1'}),'UNRESOLVED_CONTEXT');}finally{h.close();}});

for(const goal of ['Odpri Podrobnosti','Klikni Podrobnosti'])test('NAV_DUP ordinary duplicate stays held '+goal,async()=>{const h=await harness({risk:'ordinary',label:'Podrobnosti',extraControls:[{id:'c2',label:'Podrobnosti',kind:'button',enabled:true,visibleInViewport:true}]});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,0);assert.equal(h.calls.posts,1);assert.equal(h.app.state.messages.find(m=>m.role==='assistant').meta.browserNavigation.error,'CPQ_NAVIGATION_TARGET_AMBIGUOUS');}finally{h.close();}});
for(const patch of [{},{visibleInViewport:false},{enabled:false}])test('NAV_DUP status cannot attest unique target '+JSON.stringify(patch),async()=>{const h=await harness();try{assert.equal(h.app.navigationDestinationStatus('Odpri Naročila',{schema:'omnicpq.gui.observation.v2',dialogOpen:false,controls:[requested,{...requested,id:'c3',...patch}]},{operation:'click',targetId:'c2'}),'AMBIGUOUS_TARGET');}finally{h.close();}});
test('NAV_DUP remembered per run/document/frame; filtering cannot erase known ambiguity',async()=>{const h=await harness();try{const run={},o={schema:'omnicpq.gui.observation.v2',documentKey:'D',framePath:'',controls:[requested,{...requested,id:'c3'}]};h.app.rememberNavigationAmbiguities(run,o);assert.equal(h.app.navigationTargetAmbiguous(run,{...o,controls:[requested]},{targetId:'c2'}),true);assert.equal(h.app.navigationTargetAmbiguous({},{...o,controls:[requested]},{targetId:'c2'}),false);}finally{h.close();}});
test('NAV_EFFECT revision alone and already visible next control do not prove progress',async()=>{const h=await harness();try{const r=h.app.navigationRequest('Odpri A in nato odpri B'),base={schema:'omnicpq.gui.observation.v2',dialogOpen:false,revision:'1',title:'Other',controls:[{...requested,label:'b'}]};assert.equal(h.app.navigationEffectStatus(r,0,base,{...base,revision:'2',title:'Unrelated'}),'EFFECT_UNPROVEN');assert.equal(h.app.navigationEffectStatus(r,0,base,{...base,revision:'1',title:'A'}),'EFFECT_UNPROVEN');assert.equal(h.app.navigationEffectStatus(r,0,{...base,controls:[]},{...base,revision:'2'}),'NEXT_REQUESTED_CONTROL_NEWLY_OBSERVED');assert.equal(h.app.navigationEffectStatus(r,1,base,{...base,revision:'2',title:'B'}),'DESTINATION_TITLE_OBSERVED');}finally{h.close();}});
test('NAV_EFFECT no-op dispatch retained; no recovery or subsequent model call',async()=>{const h=await harness({risk:'ordinary',label:'Naročila'});try{await h.pair();await h.send('Odpri Naročila');assert.equal(h.calls.execute,1);assert.equal(h.calls.posts,1);assert.equal(h.app.state.agentRun.recoveries,0);const m=h.app.state.messages.find(m=>m.role==='assistant').meta.browserNavigation;assert.equal(m.error,'CPQ_NAVIGATION_EFFECT_UNPROVEN');assert.equal(m.receipt.status,'DISPATCHED');assert.equal(m.effect,'UNPROVEN');assert.equal(h.app.state.guiCheckpoint.status,'DISPATCHED_EFFECT_UNPROVEN');}finally{h.close();}});
