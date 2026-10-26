import * as appRuntime from './app-runtime-imports.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
import * as starters from '../../public/OmniCPQ/starters.mjs';
import * as bridge from '../../public/OmniCPQ/browser-bridge.mjs';
import {APP_VERSION,SKILL} from '../../functions/lib/omnicpq/identity.mjs';
import {starterMetadata} from '../../functions/lib/omnicpq/browser.mjs';
async function harness(){
  const html=await readFile('public/OmniCPQ/index.html','utf8'),dom=new JSDOM(html,{url:'https://www.mdlxdcc.org/omnicpq/',runScripts:'outside-only'});
  const w=dom.window,$=id=>w.document.getElementById(id),requests=[];let disconnects=0,posts=0;
  const fakeBridge={disconnect:async()=>{disconnects++;},connect:async()=>{throw Error('BRIDGE_NOT_INSTALLED');}};
  Object.assign(w,{...appRuntime,...core,...prompts,...starters,...bridge,createBrowserBridge:()=>fakeBridge,Response,Blob,AbortController});
  w.matchMedia=()=>({matches:false});w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{d.open=false;};d.showModal=()=>{d.open=true;};});
  w.fetch=async(path,options={})=>{
    requests.push({path,method:options.method||'GET'});if(options.method==='POST')posts++;
    if(path==='/.well-known/bd-deploy.json')return Response.json({schema:'bd.deploy.v1',site:'mdlxdcc',source_sha:'a'.repeat(40),fingerprint:'b'.repeat(64)});
    return Response.json({ok:true,available:true,version:APP_VERSION,account:{id:'synthetic-owner',role:'owner'},privateKnowledge:'VERIFIED',starterPrompts:starterMetadata,
      skill:{...SKILL,promptsSha256:prompts.PROMPTS_SHA256},services:[{id:'TS_SO',title:'TS Suvereni oblak'},{id:'VPI',title:'VPI'}]});
  };
  const code=(await readFile('public/OmniCPQ/app.mjs','utf8')).replace(/^import .*;\n/gm,'');
  w.eval(code.replace('health(); installWorker();','window.bootHealth=health();')+'\nwindow.testApp={state,bodyForInput,setDraft,comparisonReady,installWorker,readReleaseInfo};');
  await w.bootHealth;
  return {w,$,dom,app:w.testApp,requests,posts:()=>posts,disconnects:()=>disconnects};
}
test('Nov pogovor protects a draft without messages, then clears every previous business input and stops captures only on reset',async()=>{
  const h=await harness();try{
    let stops=0;h.$('message').value='SYNTHETIC_OLD_DRAFT';h.$('context-text').value='SYNTHETIC_OLD_CONTEXT';h.$('manual-url').value='https://example.test/old-order';
    h.$('service').value='TS_SO';h.$('environment').value='PROD';h.$('capture-on-send').checked=true;
    h.app.state.capture={getTracks:()=>[{stop:()=>{stops++;}}]};h.app.state.snapshot={id:'OLD_SNAPSHOT'};h.app.state.browserConnected=true;
    h.app.state.promptId='CONFIGURE';h.app.state.browserObservation={text:'OLD_BROWSER_CONTEXT'};h.$('browser-include').checked=true;
    h.$('new-chat').click();assert.equal(h.$('new-chat-dialog').open,true);assert.equal(stops,0);assert.equal(h.$('message').value,'SYNTHETIC_OLD_DRAFT');
    h.$('new-chat-reset').click();assert.equal(stops,1);assert.equal(h.app.state.capture,null);assert.equal(h.app.state.snapshot,null);assert.equal(h.app.state.browserConnected,false);
    assert.equal(h.$('manual-url').value,'');assert.equal(h.$('service').value,'');assert.equal(h.$('environment').value,'UNKNOWN');assert.equal(h.$('capture-on-send').checked,false);
    h.$('message').value='NOVA NALOGA';const body=h.app.bodyForInput();assert.equal(body.promptId,null);assert.equal(body.browser,null);assert.equal(body.history.length,0);
    assert(!JSON.stringify(body).includes('OLD'));assert.equal(h.$('new-chat-dialog').open,false);
  }finally{h.dom.window.close();}
});
test('explicit same-context conversation retains chosen context but ends automatic navigation authority',async()=>{
  const h=await harness();try{
    let stops=0;h.$('manual-url').value='https://example.test/current';h.$('service').value='VPI';h.$('environment').value='STAGE';
    h.app.state.capture={getTracks:()=>[{stop:()=>{stops++;}}]};h.app.state.browserConnected=true;h.$('browser-auto').checked=true;h.app.state.promptId='ABOUT';
    h.$('new-chat').click();h.$('new-chat-keep').click();
    assert.equal(h.$('manual-url').value,'https://example.test/current');assert.equal(h.$('service').value,'VPI');assert.equal(stops,0);
    assert.equal(h.app.state.promptId,null);assert.equal(h.$('browser-auto').checked,false);assert.equal(h.app.state.browserStop,true);
  }finally{h.dom.window.close();}
});
test('starter and pilot never silently overwrite an existing draft; add/cancel/replace are explicit',async()=>{
  const h=await harness();try{
    h.$('message').value='MOJ NEDOKONČANI OSNUTEK';h.app.state.promptId=null;
    h.w.document.querySelector('[data-prompt="COVERAGE"]').click();
    assert.equal(h.$('message').value,'MOJ NEDOKONČANI OSNUTEK');assert.equal(h.$('draft-dialog').open,true);
    h.$('draft-keep').click();assert.equal(h.$('message').value,'MOJ NEDOKONČANI OSNUTEK');
    h.w.document.querySelector('[data-prompt="COVERAGE"]').click();h.$('draft-add').click();
    assert.match(h.$('message').value,/MOJ NEDOKONČANI OSNUTEK/);assert.match(h.$('message').value,/B2B_pokritost/);assert.equal(h.app.state.promptId,null);
    h.$('load-pilot').click();assert.equal(h.$('draft-dialog').open,true);h.$('draft-replace').click();
    assert.equal(h.$('message').value,prompts.PILOT[0].message);assert.equal(h.app.state.promptId,null);
  }finally{h.dom.window.close();}
});
test('comparison evidence belongs to the selected partner; wrong hash blocks and Copilot evidence cannot authorize ChatGPT/API',async()=>{
  const h=await harness();try{
    const evidence=title=>{h.$('partner-v16-confirmed').checked=true;h.$('partner-import-evidence').value='SYNTHETIC '+title+' import evidence with observed retrieval';h.$('partner-zip-hash').value=SKILL.zipSha256;h.$('partner-zip-hash').dispatchEvent(new h.w.Event('input'));};
    evidence('Copilot');assert.equal(h.app.comparisonReady(),true);h.$('other-answer').value='SYNTHETIC_COPILOT_ANSWER';
    h.$('other-platform').value='chatgpt_native';h.$('other-platform').dispatchEvent(new h.w.Event('change'));
    assert.equal(h.app.comparisonReady(),false);assert.equal(h.$('other-answer').value,'');assert.match(h.$('partner-evidence-label').textContent,/ChatGPT/);
    evidence('ChatGPT');assert.equal(h.app.comparisonReady(),true);h.$('partner-zip-hash').value='0'.repeat(64);assert.equal(h.app.comparisonReady(),false);
    h.$('other-platform').value='api_other';h.$('other-platform').dispatchEvent(new h.w.Event('change'));assert.equal(h.app.comparisonReady(),false);
    h.$('other-platform').value='copilot';h.$('other-platform').dispatchEvent(new h.w.Event('change'));assert.equal(h.app.comparisonReady(),true);assert.equal(h.$('other-answer').value,'SYNTHETIC_COPILOT_ANSWER');
  }finally{h.dom.window.close();}
});
test('version has one generated source; refresh and release provenance use only GET and do not call a model',async()=>{
  const h=await harness();try{
    assert.equal(core.APP_VERSION,APP_VERSION);await h.$('refresh-status').onclick();
    assert.equal(h.posts(),0);assert(h.requests.every(r=>r.method==='GET'));assert.equal(h.app.state.release.source_sha,'a'.repeat(40));
    assert.equal(core.exportSession(h.app.state).appVersion,APP_VERSION);assert.equal(core.exportSession(h.app.state).release.source_sha,'a'.repeat(40));
    assert.match(h.$('workspace-status').textContent,/Znanje v16/);assert.match(h.$('workspace-status').textContent,/API pripravljen/);
  }finally{h.dom.window.close();}
});
test('safe update waits for an unsaved draft and a connected CPQ, then requests activation after explicit local preservation',async()=>{
  const h=await harness();try{
    let applied=0;const registration={waiting:{postMessage:()=>{applied++;}},addEventListener:()=>{},active:{state:'activated'}};
    Object.defineProperty(h.w,'isSecureContext',{value:true});Object.defineProperty(h.w.navigator,'serviceWorker',{value:{register:async()=>registration,addEventListener:()=>{}}});
    await h.app.installWorker();h.$('message').value='UNSAVED_SYNTHETIC_DRAFT';h.$('apply-update').click();assert.equal(applied,0);
    h.$('persist').checked=true;h.$('persist').dispatchEvent(new h.w.Event('change'));h.app.state.browserConnected=true;
    h.$('apply-update').click();assert.equal(applied,0);
    h.app.state.browserConnected=false;h.$('apply-update').click();assert.equal(applied,1);
    assert.match(h.w.localStorage.getItem('omnicpq:workspace:v1'),/UNSAVED_SYNTHETIC_DRAFT/);
  }finally{h.dom.window.close();}
});
test('first-install state listener reports a failed integrity install even when updatefound preceded registration',async()=>{
  const h=await harness();try{
    let changed;const worker={state:'installing',addEventListener:(name,fn)=>{changed=fn;}};
    const registration={installing:worker,addEventListener:()=>{}};
    Object.defineProperty(h.w,'isSecureContext',{value:true});Object.defineProperty(h.w.navigator,'serviceWorker',{value:{register:async()=>registration,addEventListener:()=>{}}});
    await h.app.installWorker();assert.equal(typeof changed,'function');worker.state='redundant';registration.installing=null;changed();
    assert.match(h.$('worker-status').textContent,/ni bilo mogoče aktivirati/);
  }finally{h.dom.window.close();}
});
test('activation clears a previously visible update banner when no waiting worker remains',async()=>{
  const h=await harness();try{
    let controllerChanged;const registration={waiting:{postMessage:()=>{}},active:{state:'activated'},addEventListener:()=>{}};
    Object.defineProperty(h.w,'isSecureContext',{value:true});
    Object.defineProperty(h.w.navigator,'serviceWorker',{value:{register:async()=>registration,addEventListener:(name,fn)=>{if(name==='controllerchange')controllerChanged=fn;}}});
    await h.app.installWorker();assert.equal(h.$('update-bar').hidden,false);
    registration.waiting=null;controllerChanged();
    assert.equal(h.$('update-bar').hidden,true);assert.match(h.$('worker-status').textContent,/aktiviran/);
  }finally{h.dom.window.close();}
});
