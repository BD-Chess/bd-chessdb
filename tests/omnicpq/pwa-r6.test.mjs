import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {APP_VERSION} from '../../public/OmniCPQ/version.mjs';
import {verifyShell,verifyLiveShell} from '../../scripts/omnicpq/verify-shell.mjs';
test('final protected PWA bytes pass integrity; fresh install and explicit old-worker update preserve foreign caches and never intercept APIs',async()=>{
  const root='public/OmniCPQ',source=await readFile(root+'/sw.js','utf8'),manifest=JSON.parse(await readFile(root+'/shell-integrity.json','utf8'));
  assert.equal((await verifyShell(root)).status,'PASS');
  for(const prefix of ['/omnicpq/','/OmniCPQ/','/bd-chessdb/OmniCPQ/'])for(const update of [false,true]){
    const listeners={},foreign='another-app-cache',old='omnicpq-shell:'+prefix+':old',stores=new Map([[foreign,new Map()]]);
    if(update)stores.set(old,new Map());let corrupt=true,skips=0,claims=0;
    const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async key=>{
      if(!stores.has(key))stores.set(key,new Map());const cache=stores.get(key);return {put:async(u,r)=>cache.set(String(u),r),match:async u=>cache.get(String(u))};}};
    const fetcher=async value=>{const name=new URL(value).pathname.slice(prefix.length);return name==='shell-integrity.json'?Response.json(manifest):new Response(corrupt&&name==='index.html'?'CHANGED_AFTER_SEAL':await readFile(root+'/'+name));};
    vm.runInNewContext(source,{self:{registration:{scope:'https://example.test'+prefix},addEventListener:(n,f)=>{listeners[n]=f;},clients:{claim:async()=>{claims++;}},skipWaiting:()=>{skips++;}},caches,fetch:fetcher,crypto:webcrypto,URL,Response,Map,Set,Uint8Array,Promise});
    const install=()=>{let promise;listeners.install({waitUntil:p=>{promise=p;}});return promise;};
    await assert.rejects(install(),/Invalid shell hash/);assert(stores.has(foreign));if(update)assert(stores.has(old));assert.equal(skips,0);
    corrupt=false;await install();assert.equal(skips,0);if(update)assert(stores.has(old));
    listeners.message({data:{type:'APPLY_UPDATE'}});assert.equal(skips,1);
    let activation;listeners.activate({waitUntil:p=>{activation=p;}});await activation;
    assert(stores.has(foreign));assert(!stores.has(old));assert.equal(claims,1);
    let status;listeners.message({data:{type:'SHELL_STATUS'},ports:[{postMessage:v=>{status=v;}}]});
    assert.equal(status.release,manifest.release);assert.equal(status.appVersion,APP_VERSION);assert.equal(status.files,Object.keys(manifest.files).length);
    let help;listeners.fetch({request:new Request('https://example.test'+prefix+'browser-help'),respondWith:p=>{help=p;}});assert.equal((await help).ok,true);
    for(const url of ['https://example.test/.netlify/functions/omnicpq-assistant','https://cpq.example.test/sl/order']){
      let intercepted=false;listeners.fetch({request:new Request(url),respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
    }
  }
});
test('live byte verification includes HTML, worker, manifest and downloads; a provider URL rewrite cannot pass',async()=>{
  let altered=false;const fetcher=async value=>{
    const name=new URL(value).pathname.slice('/omnicpq/'.length);let bytes=await readFile('public/OmniCPQ/'+name);
    if(altered && name==='index.html')bytes=Buffer.concat([bytes,Buffer.from('PROVIDER_REWRITE')]);
    return new Response(bytes);
  };
  const result=await verifyLiveShell('https://example.test','public/OmniCPQ',{fetcher});
  assert.equal(result.status,'PASS');assert.equal(result.shell_files,18);assert.equal(result.public_files_checked,23);
  altered=true;await assert.rejects(verifyLiveShell('https://example.test','public/OmniCPQ',{fetcher}),/live shell differs.*index.html/);
});
