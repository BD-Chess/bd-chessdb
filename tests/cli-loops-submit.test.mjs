import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {generateKeyPairSync,createHash} from 'node:crypto';import {JSDOM} from 'jsdom';
import {makeInboxHandler} from '../functions/cli-loops-inbox.mjs';import {REPOSITORY,BRANCH} from '../functions/lib/cli-loops-inbox.mjs';
const html=await readFile(new URL('../public/AI8/cli-loops.html',import.meta.url),'utf8'),code=await readFile(new URL('../public/AI8/cli-loops-submit.mjs',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));async function until(fn){for(let i=0;i<100;i++){if(fn())return;await tick();}throw Error('DOM integration condition not reached');}
function backend(){
 const {privateKey}=generateKeyPairSync('ed25519'),key=privateKey.export({type:'pkcs8',format:'der'}).toString('base64'),files=new Map();let puts=0,drop=false,loggedIn=true;
 const remote=async(url,o)=>{const path=url.split('/repos/'+REPOSITORY)[1];if(path==='')return Response.json({private:true,full_name:REPOSITORY});if(path==='/git/ref/heads/'+BRANCH)return Response.json({object:{sha:'a'.repeat(40)}});const name=path.replace(/^\/contents\//,'').split('?')[0];if(o.method==='PUT'){puts++;if(files.has(name))return Response.json({}, {status:422});const raw=Buffer.from(JSON.parse(o.body).content,'base64');files.set(name,{type:'file',encoding:'base64',content:raw.toString('base64'),size:raw.length,sha:createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex')});return Response.json({ok:true});}return files.has(name)?Response.json(files.get(name)):Response.json({}, {status:404});};
 const handler=makeInboxHandler({auth:async()=>{if(!loggedIn)throw Object.assign(Error(),{code:'AUTH_REQUIRED'});return {id:'owner',role:'owner'};},getEnv:k=>k==='CLI_LOOPS_GITHUB_TOKEN'?'local-test-not-a-token':k==='CLI_LOOPS_INBOX_SIGNING_KEY'?key:'',fetcher:remote});
 return {files,get puts(){return puts;},set drop(v){drop=v;},set loggedIn(v){loggedIn=v;},fetch:async(path,o={})=>{if(path.includes('mdlxdcc-guide-auth')){loggedIn=true;return Response.json({authenticated:true});}const result=await handler(new Request(new URL(path,'https://www.mdlxdcc.org'),{method:o.method||'GET',headers:o.headers,...(o.body?{body:o.body}:{})}));if(drop&&o.body?.includes('"action":"submit"')){drop=false;throw Error('simulated lost HTTP response after commit');}return result;}};
}
function page(server,storage){const dom=new JSDOM(html,{url:'https://www.mdlxdcc.org/AI8/cli-loops.html',runScripts:'outside-only'}),w=dom.window;w.fetch=server.fetch;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};if(storage)for(const [k,v] of storage)w.sessionStorage.setItem(k,v);w.eval(code);return dom;}
function input(dom,id,value){const x=dom.window.document.getElementById(id);x.value=value;x.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}
const el=(dom,id)=>dom.window.document.getElementById(id);
test('full UI preview/cancel/confirm uses a frozen WORK plan and one create on double click',async()=>{
 const server=backend(),dom=page(server);try{
  await until(()=>el(dom,'inbox-status').textContent.includes('Pripravljeno'));input(dom,'host','WORK');input(dom,'mode','MAX');input(dom,'topic','Celoten testni brief: A < B; šumniki ostanejo.');
  el(dom,'submit-plan').click();await until(()=>el(dom,'inbox-plan').open);assert.match(el(dom,'inbox-plan-fields').textContent,/WORK/);assert.match(el(dom,'inbox-plan-topic').textContent,/šumniki/);assert.equal(server.puts,0);
  el(dom,'inbox-plan-cancel').click();assert.equal(el(dom,'inbox-plan').open,false);assert.equal(server.puts,0);
  el(dom,'submit-plan').click();await until(()=>el(dom,'inbox-plan').open);el(dom,'inbox-confirm').click();el(dom,'inbox-confirm').click();await until(()=>el(dom,'inbox-status').textContent.includes('je zapisana'));
  assert.equal(server.puts,1);assert.equal(server.files.size,1);assert.equal(el(dom,'submit-plan').disabled,true);assert.equal(el(dom,'inbox-receipt').hidden,false);
 }finally{dom.window.close();}
});
test('lost response survives reload with only identity/hash persisted and no second upload',async()=>{
 const server=backend();let dom=page(server);try{
  await until(()=>el(dom,'inbox-status').textContent.includes('Pripravljeno'));input(dom,'topic','Private fixture topic must not enter session storage.');el(dom,'submit-plan').click();await until(()=>el(dom,'inbox-plan').open);
  server.drop=true;el(dom,'inbox-confirm').click();await until(()=>!el(dom,'inbox-check').hidden);assert.equal(server.puts,1);
  const record=dom.window.sessionStorage.getItem('cli-loops-pending');assert.ok(record);assert.equal(record.includes('Private fixture'),false);dom.window.close();dom=page(server,[['cli-loops-pending',record]]);
  await until(()=>!el(dom,'inbox-check').hidden);assert.equal(el(dom,'submit-plan').disabled,true);el(dom,'inbox-check').click();await until(()=>el(dom,'inbox-status').textContent.includes('je zapisana'));assert.equal(server.puts,1);assert.equal(server.files.size,1);assert.equal(dom.window.sessionStorage.getItem('cli-loops-pending'),null);
 }finally{dom.window.close();}
});
test('existing owner login is requested when absent and password is cleared after use',async()=>{
 const server=backend();server.loggedIn=false;const dom=page(server);try{
  await until(()=>el(dom,'inbox-status').textContent.includes('prijavi'));assert.equal(el(dom,'submit-plan').disabled,true);el(dom,'inbox-login-open').click();assert.equal(el(dom,'inbox-login').open,true);
  input(dom,'inbox-email','owner@example.test');input(dom,'inbox-password','fixture-password');el(dom,'inbox-login-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!el(dom,'inbox-login').open);assert.equal(el(dom,'inbox-password').value,'');assert.equal(server.puts,0);
 }finally{dom.window.close();}
});
