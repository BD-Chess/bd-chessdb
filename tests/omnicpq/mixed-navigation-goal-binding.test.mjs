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
  w.eval(code+'\nwindow.app={state,setMode,send,connectBrowser,disconnectBrowser,autoConnector,automaticStageGoal,localWrite,startNewChat,navigationDestinationStatus,navigationRequest,navigationEffectStatus,rememberNavigationAmbiguities,navigationTargetAmbiguous,observedKnownFieldClickStatus,explicitOrdinaryGoalTarget};');
  await w.boot;await new Promise(r=>setImmediate(r));w.app.autoConnector.stop();
  return {dom,w,$,app:w.app,calls,setPair(value=true){paired=value;token='pair-'+(Number(token.split('-')[1])+1);},setOrigin(value){origin=value;},async pair(){paired=true;await w.app.connectBrowser();},async send(goal,mode='work',profile='fast'){w.app.setMode(mode);w.app.state.profile=profile;$('message').value=goal;await w.app.send();},close(){w.app.autoConnector.stop();dom.window.close();}};
}

const requestedMixed={id:'c2',label:'Naročila',kind:'link',enabled:true,visibleInViewport:true};
const mixedGoals=['Odpri Naročila in nastavi RAM na 12','Pojdi na Naročila, nato nastavi RAM na 12','Open Naročila and set RAM to 12','Go to Naročila then set RAM to 12','Prosim, odpri Naročila in spremeni RAM na 12','V CPQ odpri Naročila in vnesi RAM 12','Ali lahko odpreš Naročila in nastaviš RAM na 12?','Odpri "Naročila" in nastavi RAM na "12"','Odpri »Naročila« in nato shrani','Nastavi RAM na 12 in odpri Naročila','Set RAM to 12 then open Naročila','Odpri Naročila in nastavi RAM na "12 in odpri Stranke"'];
for(const profile of ['fast','careful'])for(const goal of mixedGoals)test('MIXED_NAV wrong ordinary target stays unclicked '+profile+' '+goal,async()=>{const h=await harness({risk:'ordinary',label:'Stranke',extraControls:[requestedMixed]});try{await h.pair();await h.send(goal,'work',profile);assert.equal(h.calls.execute,0);assert.equal(h.app.navigationRequest(goal)?.nodes[0],'narocila');}finally{h.close();}});
for(const goal of ['Odpri Naročila in nastavi RAM na 12','Open Naročila and set RAM to 12','Nastavi RAM na 12 in odpri Naročila'])test('MIXED_NAV correct requested ordinary control remains executable '+goal,async()=>{const h=await harness({risk:'ordinary',label:'Naročila',effectTitle:'Naročila'});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,1);assert.equal(h.app.state.messages.find(m=>m.role==='assistant').meta.browserNavigation.receipt.status,'DISPATCHED');}finally{h.close();}});
for(const goal of ['Odpri Naročila ali Stranke in nastavi RAM na 12','Open Naročila or Stranke and set RAM to 12','Odpri Naročila in nastavi RAM na 12 in odpri Stranke','Nastavi RAM na 12 in odpri Naročila in spremeni CPU na 4','Preveri dovoljenja in odpri Naročila in nastavi RAM na 12'])test('MIXED_NAV non-contiguous or ambiguous plan is not stitched '+goal,async()=>{const h=await harness({risk:'ordinary',label:'Stranke',extraControls:[requestedMixed]});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,0);assert.equal(h.app.navigationRequest(goal)?.ambiguous,true);}finally{h.close();}});
test('MIXED_NAV quoted directive remains label data',async()=>{const h=await harness({risk:'ordinary',label:'Nastavi RAM na 12',effectTitle:'Nastavi RAM na 12'});try{await h.pair();await h.send('Odpri "Nastavi RAM na 12"');assert.equal(h.calls.execute,1);assert.deepEqual(Array.from(h.app.navigationRequest('Odpri "Nastavi RAM na 12"').nodes),['nastavi ram na 12']);}finally{h.close();}});
for(const goal of ['Nastavi RAM na 12','Set RAM to 12','Nastavi polje "odpri Naročila" na "x"','Nastavi RAM na "12 in odpri Stranke"'])test('MIXED_NAV no new route inferred from material-only or quoted data '+goal,async()=>{const h=await harness();try{assert.equal(h.app.navigationRequest(goal),null);}finally{h.close();}});
test('MIXED_NAV duplicate target held despite explicit material tail',async()=>{const h=await harness({risk:'ordinary',label:'Naročila',extraControls:[requestedMixed]});try{await h.pair();await h.send('Odpri Naročila in nastavi RAM na 12');assert.equal(h.calls.execute,0);assert.equal(h.app.state.messages.find(m=>m.role==='assistant').meta.browserNavigation.error,'CPQ_NAVIGATION_TARGET_AMBIGUOUS');}finally{h.close();}});

for(const label of ['Naročila in ponudbe','Open and set RAM'])test('MIXED_NAV quoted conjunction stays within named control '+label,async()=>{const h=await harness({risk:'ordinary',label,effectTitle:label});try{await h.pair();await h.send('Odpri '+JSON.stringify(label)+' in nastavi RAM na 12');assert.equal(h.calls.execute,1);assert.equal(h.app.navigationRequest('Odpri '+JSON.stringify(label)+' in nastavi RAM na 12').nodes[0],label.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''));}finally{h.close();}});

const visibleRam={id:'c2',label:'RAM',kind:'field',enabled:true,visibleInViewport:true,value:'4'};
for(const profile of ['fast','careful'])for(const goal of ['Nastavi RAM na 12','Set RAM to 12','Ali lahko nastaviš RAM na 12?','V CPQ spremeni RAM na 12','Nastavi RAM na 12 in shrani'])test('VISIBLE_FIELD unrelated ordinaryclick held '+profile+' '+goal,async()=>{const h=await harness({risk:'ordinary',label:'Stranke',extraControls:[visibleRam]});try{await h.pair();await h.send(goal,'work',profile);assert.equal(h.calls.execute,0);assert.equal(h.app.state.messages.find(m=>m.role==='assistant').meta.browserNavigation.error,'CPQ_VISIBLE_FIELD_UNRELATED_TARGET');assert.equal(h.app.state.agentRun.recoveries,1);}finally{h.close();}});
for(const goal of ['Nastavi RAM na 12 in klikni Podrobnosti','Klikni "Podrobnosti in pregled" in nastavi RAM na 12'])test('VISIBLE_FIELD separate explicit ordinary target retained '+goal,async()=>{const label=goal.includes('pregled')?'Podrobnosti in pregled':'Podrobnosti',h=await harness({risk:'ordinary',label,extraControls:[visibleRam]});try{await h.pair();await h.send(goal);assert.equal(h.calls.execute,1);}finally{h.close();}});
test('VISIBLE_FIELD focus the observed requested field is not unrelated',async()=>{const h=await harness();try{assert.equal(h.app.observedKnownFieldClickStatus('Nastavi RAM na 12',{schema:'omnicpq.gui.observation.v2',controls:[visibleRam]},{targetId:'c2'}),'REQUESTED_FIELD_FOCUS');}finally{h.close();}});
for(const [name,goal,controls,expected]of [['partly missing','Nastavi RAM na 12 in CPU na 4',[visibleRam],'NOT_ALL_REQUESTED_FIELDS_READY'],['unknown binding','Nastavi Discount na 12',[visibleRam],'NOT_APPLICABLE'],['offscreen','Nastavi RAM na 12',[{...visibleRam,visibleInViewport:false}],'NOT_ALL_REQUESTED_FIELDS_READY'],['disabled','Nastavi RAM na 12',[{...visibleRam,enabled:false}],'NOT_ALL_REQUESTED_FIELDS_READY'],['duplicate','Nastavi RAM na 12',[visibleRam,{...visibleRam,id:'c3'}],'NOT_ALL_REQUESTED_FIELDS_READY']])test('VISIBLE_FIELD narrow proof does not certify missing/unknown state '+name,async()=>{const h=await harness();try{assert.equal(h.app.observedKnownFieldClickStatus(goal,{schema:'omnicpq.gui.observation.v2',controls},{targetId:'c1'}),expected);}finally{h.close();}});
test('VISIBLE_FIELD all explicitly requested known fields present holds unrelated',async()=>{const h=await harness({risk:'ordinary',label:'Stranke',extraControls:[visibleRam,{id:'c3',label:'CPU',kind:'field',enabled:true,visibleInViewport:true,value:'1'}]});try{await h.pair();await h.send('Nastavi RAM na 12 in CPU na 4');assert.equal(h.calls.execute,0);}finally{h.close();}});
test('COMPLETED_NAV per-field focus proof stays local when another requested field is missing',async()=>{const h=await harness();try{assert.equal(h.app.observedKnownFieldClickStatus('Nastavi RAM na 12 in CPU na 4',{schema:'omnicpq.gui.observation.v2',controls:[visibleRam]},{targetId:'c2'}),'REQUESTED_FIELD_FOCUS');}finally{h.close();}});
