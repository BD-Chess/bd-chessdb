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
async function harness({prefs={},origin=STAGE,paired=false,risk='navigate',operation='click'}={}) {
  const dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:'https://www.mdlxdcc.org/omnicpq/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,$=id=>w.document.getElementById(id),calls={gui:0,legacy:0,status:[],observe:0,preview:0,execute:0,posts:0,requests:[]};
  let revision=0,token='pair-1';
  const observation=()=>({schema:'omnicpq.gui.observation.v2',observationId:'obs-'+revision,revision:String(revision+1).repeat(64).slice(0,64),url:origin+'/sl/order/details/view/SYNTHETIC',title:'OMNI-123 SYNTHETIC',scope:'order',documentKey:'SYNTHETIC-DOC',text:'SYNTHETIC',controls:[{id:'c1',label:risk==='irreversible'?'Oddaj':'Podrobnosti',type:'button',enabled:true}],frames:[],paging:{offset:0,limit:180}});
  const chromeRuntime={sendMessage(_extension,message,reply){
    if(message.type==='status'){calls.status.push(message.protocol);return reply(paired?{ok:true,protocol:gui.BRIDGE_PROTOCOL,token,capabilities:{schema:'omnicpq.gui.capabilities.v2',apiRevision:3,cdpAvailable:true}}:{ok:false,error:'BRIDGE_NOT_PAIRED'});}
    if(message.type==='observe'){calls.observe++;return reply({ok:true,observation:observation()});}
    if(message.type==='preview'){calls.preview++;return reply({ok:true,prepared:{revision:observation().revision,documentKey:'SYNTHETIC-DOC',risk,label:risk==='irreversible'?'Oddaj':'Podrobnosti'}});}
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
      const action={schema:'omnicpq.gui.action.v2',observationId:body.browser?.id,revision:body.browser?.revision,targetId:'c1',operation,...(operation==='fill'?{value:'SYNTHETIC_NEW_VALUE'}:{}),reason:'SYNTHETIC',expectedDocument:'SYNTHETIC-DOC'};
      const text=calls.posts===1?'SYNTHETIC\n```omnicpq_action\n'+JSON.stringify(action)+'\n```':'SYNTHETIC finished';
      const frames=[{type:'delta',text,clientRequestId:body.clientRequestId},{type:'done',status:'complete',clientRequestId:body.clientRequestId}];
      return new Response(frames.map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
    }
    return Response.json({ok:true,available:true,version:core.APP_VERSION,account:{id:'SYNTHETIC_OWNER',role:'owner'},privateKnowledge:'VERIFIED',starterPrompts:{version:starters.STARTER_VERSION,sha256:await core.digest(JSON.stringify(starters.STARTERS))},skill:{promptsSha256:prompts.PROMPTS_SHA256},services:[]});
  };
  const code=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\r?\n/gm,'').replace('health(); installWorker();','window.boot=health();');
  w.eval(code+'\nwindow.app={state,setMode,send,connectBrowser,disconnectBrowser,autoConnector,automaticStageGoal,localWrite,startNewChat};');
  await w.boot;await new Promise(r=>setImmediate(r));w.app.autoConnector.stop();
  return {dom,w,$,app:w.app,calls,setPair(value=true){paired=value;token='pair-'+(Number(token.split('-')[1])+1);},setOrigin(value){origin=value;},async pair(){paired=true;await w.app.connectBrowser();},async send(goal,mode='work',profile='fast'){w.app.setMode(mode);w.app.state.profile=profile;$('message').value=goal;await w.app.send();},close(){w.app.autoConnector.stop();dom.window.close();}};
}
test('fresh boot creates the genuine GUI bridge and default checkbox while external pair approval remains required',async()=>{
  const h=await harness();try{assert.equal(h.$('experimental-gui').checked,true);assert.equal(h.calls.gui,1);assert.equal(h.calls.legacy,0);assert(h.calls.status.length>0);assert(h.calls.status.every(p=>p===gui.BRIDGE_PROTOCOL));assert.equal(h.calls.observe,0);assert.equal(h.calls.execute,0);assert.equal(h.app.state.browserConnected,false);}finally{h.close();}
});
test('first real synthetic GUI STAGE pair enables automation, PROD never does',async()=>{
  for(const origin of [STAGE,PROD]){const h=await harness({origin});try{await h.pair();assert.equal(h.$('browser-auto').checked,origin===STAGE);assert.equal(h.$('browser-auto').disabled,origin!==STAGE);assert.equal(h.calls.execute,0);}finally{h.close();}}
});
test('explicit automatic opt-out survives a new pair and a fresh boot',async()=>{
  let prefs;const h=await harness();try{await h.pair();h.$('browser-auto').checked=false;h.$('browser-auto').onchange();prefs=JSON.parse(h.w.localStorage.getItem('omnicpq:preferences:v1'));assert.equal(prefs.browserAuto,false);h.setPair();await h.app.connectBrowser();assert.equal(h.$('browser-auto').checked,false);await h.send('Odpri podrobnosti');assert.equal(h.calls.execute,0);}finally{h.close();}
  const restored=await harness({prefs});try{await restored.pair();assert.equal(restored.$('browser-auto').checked,false);}finally{restored.close();}
});
test('explicit GUI opt-out is restored before first connection and default never overrides it',async()=>{
  const h=await harness({prefs:{experimentalGui:false,browserAuto:false}});try{assert.equal(h.$('experimental-gui').checked,false);assert.equal(h.calls.legacy,1);assert.equal(h.calls.execute,0);}finally{h.close();}
});
for(const mode of ['guide','jira','model','work','plm'])for(const profile of ['fast','careful'])test('direct STAGE task automatically executes without the manual action button: '+mode+'/'+profile,async()=>{
  const h=await harness();try{await h.pair();await h.send('Odpri podrobnosti',mode,profile);assert.equal(h.calls.execute,1);assert.equal(h.calls.preview,1);assert(h.calls.observe>=3);assert.equal(h.calls.posts,2);assert.equal(h.calls.requests[0].profile,profile);assert.equal(h.calls.requests[0].mode,mode);assert.equal(h.app.state.guiCheckpoint.status,'OBSERVED_NOT_BUSINESS_ATTESTED');}finally{h.close();}
});
for(const goal of ['Kako odprem podrobnosti?','Kaj pomeni nastavitev CPU','Razloži shranjevanje','Če nastavim CPU na 24','Ne spreminjaj ničesar','"Odpri podrobnosti"','Ali naj shranim naročilo?'])test('informational/conditional/quoted/negative goal cannot inherit model-proposed action: '+goal,async()=>{
  const h=await harness();try{await h.pair();await h.send(goal,'guide');assert.equal(h.calls.posts,1);assert.equal(h.calls.execute,0);assert.equal(h.calls.preview,0);}finally{h.close();}
});
test('forcing checkbox on PROD cannot turn a direct goal into automatic execution',async()=>{
  const h=await harness({origin:PROD});try{await h.pair();h.$('browser-auto').checked=true;await h.send('Odpri podrobnosti');assert.equal(h.calls.execute,0);assert.equal(h.calls.preview,0);}finally{h.close();}
});
test('irreversible action without the existing exact named-document goal grant still requires approval',async()=>{
  const h=await harness({risk:'irreversible'});try{await h.pair();await h.send('Klikni Oddaj');assert.equal(h.calls.preview,1);assert.equal(h.calls.execute,0);assert.equal(h.app.state.messages.findLast(m=>m.role==='assistant').meta.browserNavigation.error,'CPQ_EXPLICIT_APPROVAL_REQUIRED');}finally{h.close();}
});
test('switching all five modes preserves the explicit automatic opt-out and sends no requests',async()=>{
  const h=await harness();try{await h.pair();h.$('browser-auto').checked=false;h.$('browser-auto').onchange();for(const mode of ['guide','jira','model','work','plm']){h.app.setMode(mode);assert.equal(h.$('browser-auto').checked,false);}assert.equal(h.calls.posts,0);assert.equal(h.calls.execute,0);}finally{h.close();}
});

for(const goal of ['Ali lahko odpreš podrobnosti?','Can you open details?'])test('direct polite second-person request inherits STAGE task intent: '+goal,async()=>{
  const h=await harness();try{await h.pair();await h.send(goal,'model');assert.equal(h.calls.execute,1);}finally{h.close();}
});
for(const goal of ['Pokaži primer shranjevanja','Odpri primer in razloži kako deluje','Ali lahko odprem podrobnosti?','Can you explain how to save?'])test('instructional or first-person question remains informational: '+goal,async()=>{
  const h=await harness();try{await h.pair();await h.send(goal,'guide');assert.equal(h.calls.execute,0);}finally{h.close();}
});

test('polite imperative with question mark is a direct task',async()=>{
  const h=await harness();try{await h.pair();await h.send('Prosim, odpri Naročila?');assert.equal(h.calls.execute,1);}finally{h.close();}
});
test('explicit negative limit conservatively stops every model-proposed action',async()=>{
  for(const [risk,operation,expected] of [['navigate','click',0],['business_write','fill',0]]){const h=await harness({risk,operation});try{await h.pair();await h.send('Odpri podrobnosti, vendar ne spreminjaj RAM');assert.equal(h.calls.execute,expected);assert.equal(h.calls.preview,0);}finally{h.close();}}
});
test('new chat retaining context also retains STAGE automatic default, while explicit opt-out stays off',async()=>{
  const h=await harness();try{await h.pair();h.$('shared-model').value='SYNTHETIC_MODEL';h.app.startNewChat(true);assert.equal(h.$('shared-model').value,'SYNTHETIC_MODEL');assert.equal(h.$('browser-auto').checked,true);h.$('browser-auto').checked=false;h.$('browser-auto').onchange();h.app.startNewChat(true);assert.equal(h.$('browser-auto').checked,false);assert.equal(h.calls.posts,0);assert.equal(h.calls.execute,0);}finally{h.close();}
});

for(const goal of ['Pokaži mi v CPQ naročilo OMNI-123','Prikaži Naročila v CPQ','Show order OMNI-123 in CPQ'])test('explicit show-in-CPQ request performs navigation only: '+goal,async()=>{
  const h=await harness();try{await h.pair();await h.send(goal,'guide');assert.equal(h.calls.execute,1);}finally{h.close();}
});
test('show-in-CPQ never grants a model-proposed business write',async()=>{
  const h=await harness({risk:'business_write',operation:'fill'});try{await h.pair();await h.send('Pokaži mi v CPQ naročilo OMNI-123','guide');assert.equal(h.calls.execute,0);assert.equal(h.app.state.messages.findLast(m=>m.role==='assistant').meta.browserNavigation.error,'CPQ_NAVIGATION_GOAL_ONLY');}finally{h.close();}
});
test('negative navigation target constraint is held before any preview or execution',async()=>{
  const h=await harness();try{await h.pair();await h.send('Odpri meni, vendar ne klikni Nazaj');assert.equal(h.calls.execute,0);assert.equal(h.calls.preview,0);}finally{h.close();}
});
