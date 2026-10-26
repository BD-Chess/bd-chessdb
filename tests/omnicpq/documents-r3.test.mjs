import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {makeDocumentHandler} from '../../functions/omnicpq-documents.mjs';
import {verifyDocuments,DOCUMENT_KEY} from '../../functions/lib/omnicpq/private-documents.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const name='b2b-pokritost-v17.html',bytes=Buffer.from('<html><body>SYNTHETIC PRIVATE DOCUMENT<script>document.title="SYNTHETIC";</script></body></html>');
const spec={mime:'text/html; charset=utf-8',size:bytes.length,sha256:hash(bytes)};
const text=JSON.stringify({schema:'omnicpq.private_documents.v1',documentVersion:'v17',files:{[name]:{...spec,base64:bytes.toString('base64')}}});
const expected={bundleSha256:hash(text),files:{[name]:spec}};
const owner=async()=>({id:'synthetic-owner',role:'owner'});
const request=(method='GET',headers={},file=name)=>new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-documents?file='+encodeURIComponent(file),{method,headers});
test('owner gets verified private bytes and CSP; HEAD is bodyless; cross-site and demo cannot read',async()=>{
  let reads=0;const reader=async()=>{reads++;return text;};const handler=makeDocumentHandler({auth:owner,reader,expected});
  let r=await handler(request());assert.equal(r.status,200);assert.equal(await r.text(),bytes.toString());assert.match(r.headers.get('content-security-policy'),/script-src 'sha256-/);assert.match(r.headers.get('cache-control'),/no-store/);
  r=await handler(request('HEAD'));assert.equal(await r.text(),'');assert.equal(r.headers.get('content-length'),String(bytes.length));
  const count=reads;r=await handler(request('GET',{origin:'https://evil.test'}));assert.equal(r.status,403);assert.equal(reads,count);
  assert.equal((await makeDocumentHandler({auth:async()=>({role:'demo'}),reader,expected})(request())).status,403);
  assert.equal((await makeDocumentHandler({auth:async()=>{throw {code:'AUTH_REQUIRED'};},reader,expected})(request())).status,401);
  assert.equal((await handler(request('GET',{},'../private.json'))).status,404);
});
test('missing/tampered private store fails closed without document body or public fallback',async()=>{
  for(const value of [null,text+' ',text.replace('"v17"','"v18"')]){
    const r=await makeDocumentHandler({auth:owner,reader:async()=>value,expected})(request());assert.equal(r.status,503);assert(!(await r.text()).includes('SYNTHETIC PRIVATE DOCUMENT'));
  }
  assert.throws(()=>verifyDocuments(text+' ',expected));
});
test('owner seed accepts only pinned bytes, writes once to immutable key and verifies actual readback',async()=>{
  let stored=null,writes=0;const store={get:async key=>{assert.equal(key,DOCUMENT_KEY);return stored;},set:async(key,value,options)=>{assert(options.onlyIfNew);writes++;stored=value;return {modified:true};}};
  const handler=makeDocumentHandler({auth:owner,expected,storeFactory:async()=>store});
  const post=(body=text,origin='https://www.mdlxdcc.org')=>new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-documents',{method:'POST',headers:{origin,'content-type':'application/json'},body});
  assert.equal((await handler(post())).status,200);assert.equal(stored,text);assert.equal(writes,1);
  assert.equal((await handler(post())).status,200);assert.equal(writes,1);
  assert.equal((await handler(post(text+' '))).status,503);assert.equal(writes,1);
  assert.equal((await handler(post(text,'https://evil.test'))).status,403);
  stored='CONCURRENT_CONTENT';assert.equal((await handler(post())).status,409);assert.equal(writes,1);
});
test('protected links preserve workspace; document bundle is not imported by a public module or cached shell',async()=>{
  const html=await readFile('public/OmniCPQ/index.html','utf8');assert.match(html,/omnicpq-documents\?file=b2b-pokritost-v17\.html" target="_blank"/);assert.match(html,/omnicpq-documents\?file=b2b-vodic-v17\.html" target="_blank"/);
  const endpoint=await readFile('functions/omnicpq-documents.mjs','utf8');assert(!endpoint.includes("import bundle"));
  const shell=JSON.parse(await readFile('public/OmniCPQ/shell-integrity.json'));assert(!Object.keys(shell.files).some(k=>/b2b-|documents/.test(k)));
  for(const file of await readdir('public/OmniCPQ'))assert(!/documents-v17\.json|B2B_.*\.(?:docx|md)/.test(file));
});
