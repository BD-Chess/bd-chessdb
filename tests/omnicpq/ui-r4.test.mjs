import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
test('real DOM: login gate, owner access, demo isolation and invitation handling',async()=>{
  const html=await readFile(new URL('../../public/OmniCPQ/index.html',import.meta.url),'utf8');
  const code=(await readFile(new URL('../../public/OmniCPQ/app.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  const dom=new JSDOM(html,{url:'https://example.test/OmniCPQ/#demo='+'a'.repeat(64),runScripts:'outside-only'});
  try {
    const w=dom.window;Object.assign(w,{...core,...prompts,Response,Blob,AbortController});
    w.matchMedia=()=>({matches:false});w.document.querySelectorAll('dialog').forEach(d=>{d.close=()=>{};d.showModal=()=>{};});
    let actor=null;const makeMetadata=()=>({ok:true,available:true,account:actor,skill:{release:'v15',version:'v0.1.5',files:194,promptsSha256:prompts.PROMPTS_SHA256},services:[],usage:actor?.role==='demo'?{expires_at:new Date(Date.now()+86400000).toISOString(),spent:0.1,reserved:0}: {exempt:true}});
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
  } finally {dom.window.close();}
});
