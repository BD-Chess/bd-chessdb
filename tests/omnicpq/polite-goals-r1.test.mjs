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
async function harness({prefs={},origin=STAGE,paired=false,risk='navigate',operation='click',label=null,options=[],value='512',valueSource='user',currentValue='',extraControls=[]}={}) {
  const dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:'https://www.mdlxdcc.org/omnicpq/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,$=id=>w.document.getElementById(id),calls={gui:0,legacy:0,status:[],observe:0,preview:0,execute:0,posts:0,requests:[]};
  let revision=0,token='pair-1';
  const observation=()=>({schema:'omnicpq.gui.observation.v2',observationId:'obs-'+revision,revision:String(revision+1).repeat(64).slice(0,64),url:origin+'/sl/order/details/view/SYNTHETIC',title:'OMNI-123 SYNTHETIC',scope:'order',documentKey:'SYNTHETIC-DOC',text:'SYNTHETIC',controls:[{id:'c1',label:label??(operation==='fill'?'RAM':risk==='irreversible'?'Oddaj':'Podrobnosti'),options,valueSource,value:currentValue,type:operation==='fill'?'text':'button',enabled:true},...extraControls],frames:[],paging:{offset:0,limit:180}});
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
  const code=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\r?\n/gm,'').replace('health(); installWorker();','window.boot=health();');
  w.eval(code+'\nwindow.app={state,setMode,send,connectBrowser,disconnectBrowser,autoConnector,automaticStageGoal,localWrite,startNewChat};');
  await w.boot;await new Promise(r=>setImmediate(r));w.app.autoConnector.stop();
  return {dom,w,$,app:w.app,calls,setPair(value=true){paired=value;token='pair-'+(Number(token.split('-')[1])+1);},setOrigin(value){origin=value;},async pair(){paired=true;await w.app.connectBrowser();},async send(goal,mode='work',profile='fast'){w.app.setMode(mode);w.app.state.profile=profile;$('message').value=goal;await w.app.send();},close(){w.app.autoConnector.stop();dom.window.close();}};
}

for(const goal of ['Ali lahko nastaviš RAM na 128?','Can you set RAM to 128?','Prosim, ali lahko nastaviš RAM na 128?','V CPQ can you set RAM to 128?','Ali lahko nastaviš RAM na "128"?'])test('POLITE_FIXED numeric exact '+goal,async()=>{const h=await harness({risk:'business_write',operation:'fill',label:'RAM',value:'128',currentValue:'4'});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,1);}finally{h.close();}});
for(const goal of ['Ali lahko shraniš?','Can you save?'])test('POLITE_FIXED standalone explicit save '+goal,async()=>{const h=await harness({risk:'business_write',operation:'click',label:'Shrani'});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,1);}finally{h.close();}});
for(const [goal,label,value] of [['Can you set RAM to 128 and CPU to 12?','RAM','128'],['Can you set RAM to 128 and CPU to 12?','CPU','12']])test('POLITE_FIXED multi field '+label+'='+value,async()=>{const h=await harness({risk:'business_write',operation:'fill',label,value,currentValue:'4'});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,1);}finally{h.close();}});
for(const goal of ['Ali lahko nastaviš RAM 128 in nato shraniš?','Can you set RAM to 128 and save?'])test('POLITE_FIXED explicit save after observed requested values '+goal,async()=>{const h=await harness({risk:'business_write',operation:'click',label:'Shrani',extraControls:[{id:'c2',label:'RAM GB',type:'number',enabled:true,value:'128'}]});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,1);}finally{h.close();}});
for(const goal of ['Ali lahko nastavim RAM na 128?','Ali lahko shranim?','Can you explain how to save?','Če lahko nastaviš RAM na 128','Can you set RAM to 128 if possible?','Ali lahko ne spreminjaš RAM?','"Ali lahko nastaviš RAM na 128?"','Ali lahko nastaviš RAM na "128 in nato shraniš"?','Can you set RAM to "128?'])test('POLITE_NEGATIVE no authority from question/quote/condition '+goal,async()=>{const h=await harness({risk:'business_write',operation:'fill',label:'RAM',value:'128',currentValue:'4'});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,0);}finally{h.close();}});
for(const [goal,label,value] of [['Can you set RAM to 128?','CPU','128'],['Can you set RAM to 128?','RAM','12'],['Can you set RAM to 128 and CPU to 12?','RAM','12'],['Can you set RAM to 128 and CPU to 12?','CPU','128'],['Can you set Discount to 128?','Discount','128']])test('POLITE_NEGATIVE wrong field/value stays held '+label+'='+value,async()=>{const h=await harness({risk:'business_write',operation:'fill',label,value,currentValue:'4'});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,0);}finally{h.close();}});
for(const goal of ['Ali lahko nastaviš RAM 128 in nato shraniš?','Can you set RAM to 128 and save?'])test('POLITE_NEGATIVE early save remains held '+goal,async()=>{const h=await harness({risk:'business_write',operation:'click',label:'Shrani',extraControls:[{id:'c2',label:'RAM GB',type:'number',enabled:true,value:'4'}]});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,0);}finally{h.close();}});
test('POLITE_NEGATIVE duplicate RAM instance remains held',async()=>{const h=await harness({risk:'business_write',operation:'fill',label:'RAM',value:'128',currentValue:'4',extraControls:[{id:'c2',label:'RAM GB',type:'number',enabled:true,value:'8'}]});try{await h.pair();await h.send('Ali lahko nastaviš RAM na 128?');assert.equal(h.calls.execute,0);}finally{h.close();}});
for(const [goal,risk,label] of [['Can you save?','business_write','Dodaj'],['Ali lahko shraniš?','business_write','Oddaj'],['Can you save?','irreversible','Oddaj'],['Ali lahko izbrišeš OMNI-123?','irreversible','Oddaj']])test('POLITE_NEGATIVE save never grants unrelated or irreversible '+goal+'/'+label,async()=>{const h=await harness({risk,operation:'click',label});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,0);}finally{h.close();}});
