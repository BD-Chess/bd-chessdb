import * as appRuntime from './app-runtime-imports.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
import * as starters from '../../public/OmniCPQ/starters.mjs';
import * as bridge from '../../public/OmniCPQ/browser-bridge.mjs';
import {starterMetadata} from '../../functions/lib/omnicpq/browser.mjs';
test('real DOM: login gate, owner access, demo isolation and invitation handling',async()=>{
  const html=await readFile(new URL('../../public/OmniCPQ/index.html',import.meta.url),'utf8');
  const code=(await readFile(new URL('../../public/OmniCPQ/app.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  const dom=new JSDOM(html,{url:'https://example.test/OmniCPQ/#demo='+'a'.repeat(64),runScripts:'outside-only'});
  try {
    const w=dom.window;Object.assign(w,{...appRuntime,...core,...prompts,...starters,...bridge,Response,Blob,AbortController});
    w.matchMedia=()=>({matches:false});w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    let actor=null;const makeMetadata=()=>({ok:true,version:core.APP_VERSION,available:true,account:actor,starterPrompts:starterMetadata,skill:{release:'v16',version:'v0.1.6',files:194,promptsSha256:prompts.PROMPTS_SHA256},services:[],usage:actor?.role==='demo'?{expires_at:new Date(Date.now()+86400000).toISOString(),spent:0.1,reserved:0}: {exempt:true}});
    w.fetch=async()=>actor?Response.json(makeMetadata()):Response.json({error:{code:'AUTH_REQUIRED'}},{status:401});
    w.eval(code.replace('health(); installWorker();','window.bootHealth=health();')+'\nwindow.testApp={state,health};');
    await w.bootHealth;
    assert.equal(w.document.getElementById('workspace').hidden,true);assert.equal(w.document.getElementById('access-gate').hidden,false);
    assert.equal(w.document.getElementById('demo-code').value,'a'.repeat(64));assert.equal(w.location.hash,'');
    actor={id:'owner',role:'owner'};await w.testApp.health();
    assert.equal(w.document.getElementById('workspace').hidden,false);assert.equal(w.document.getElementById('access-gate').hidden,true);
    assert.equal(w.document.getElementById('start-cards').children.length,3);assert.equal(w.document.getElementById('demo-owner').hidden,false);
    w.testApp.state.messages.push({role:'user',content:'SYNTHETIC_OWNER_PRIVATE'});w.document.getElementById('message').value='SYNTHETIC_PRIVATE_DRAFT';
    actor={id:'demo-synthetic',role:'demo'};await w.testApp.health();
    assert.equal(w.testApp.state.messages.length,0);assert.equal(w.document.getElementById('message').value,'');
    assert.equal(w.document.getElementById('demo-owner').hidden,true);assert.equal(w.document.getElementById('persist').disabled,true);
    assert.equal(w.document.getElementById('demo-usage').hidden,false);
    actor=null;await w.testApp.health();assert.equal(w.document.getElementById('workspace').hidden,true);
    // Regression: a valid owner session must unlock the UI even if AI knowledge is offline.
    w.fetch=async path=>path === '/.netlify/functions/omnicpq-auth'
      ? Response.json({authenticated:true,account:{id:'owner',role:'owner'}})
      : Response.json({error:{code:'KNOWLEDGE_UNAVAILABLE'}},{status:503});
    await w.testApp.health();
    assert.equal(w.document.getElementById('workspace').hidden,false);
    assert.equal(w.document.getElementById('access-gate').hidden,true);
    assert.equal(w.testApp.state.ready,false);
    assert.match(w.document.getElementById('knowledge-status').textContent,/Prijava potrjena/);
  } finally {dom.window.close();}
});


