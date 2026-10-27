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

// The visual release carries layout and artwork, while legacy prose stays private.
import visualRelease from '../../functions/lib/omnicpq/documents/visual-release-v18.json' with {type:'json'};
import visualAssets from '../../functions/lib/omnicpq/documents/visual-assets-v18.json' with {type:'json'};
import {renderVisualGuide,readVisualAsset} from '../../functions/lib/omnicpq/visual-documents.mjs';

function syntheticVisual(){
  const base=Buffer.from('PREFIX:<p>SYNTHETIC PRIVATE DESCRIPTION</p>:SUFFIX');
  const fragment=Buffer.from('<p>SYNTHETIC PRIVATE DESCRIPTION</p>');
  const template='<html><body><!--OMNICPQ-LEGACY:service--><script>document.title="VISUAL SYNTHETIC";</script></body></html>';
  const rendered=template.replace('<!--OMNICPQ-LEGACY:service-->',fragment.toString());
  return {base,rendered,release:{version:'v18',baseSize:base.length,baseSha256:hash(base),template,templateSha256:hash(template),fragments:{service:{offset:7,size:fragment.length,sha256:hash(fragment)}},renderedSha256:hash(rendered)}};
}

test('visual template reconstructs only pinned private fragments and fails closed on corruption',()=>{
  const fixture=syntheticVisual();
  const item=renderVisualGuide({bytes:fixture.base},fixture.release);
  assert.equal(item.bytes.toString(),fixture.rendered);assert.equal(item.version,'v18');assert.equal(item.sha256,hash(item.bytes));
  for(const release of [
    {...fixture.release,baseSha256:'0'.repeat(64)},
    {...fixture.release,template:fixture.release.template+' '},
    {...fixture.release,fragments:{service:{...fixture.release.fragments.service,offset:8}}},
    {...fixture.release,renderedSha256:'0'.repeat(64)},
  ])assert.throws(()=>renderVisualGuide({bytes:fixture.base},release),/INTEGRITY/);
});

test('v17 guide URL and v18 alias return the same visual release with fresh CSP and byte hash',async()=>{
  const fixture=syntheticVisual(),guide='b2b-vodic-v17.html';
  const spec={mime:'text/html; charset=utf-8',size:fixture.base.length,sha256:hash(fixture.base)};
  const privateText=JSON.stringify({schema:'omnicpq.private_documents.v1',documentVersion:'v17',files:{[guide]:{...spec,base64:fixture.base.toString('base64')}}});
  const expected={bundleSha256:hash(privateText),files:{[guide]:spec}};
  const handler=makeDocumentHandler({auth:owner,reader:async()=>privateText,expected,visualRenderer:item=>renderVisualGuide(item,fixture.release)});
  for(const name of [guide,'b2b-vodic-v18.html']){
    const r=await handler(request('GET',{},name));assert.equal(r.status,200);assert.equal(await r.text(),fixture.rendered);
    assert.equal(r.headers.get('x-document-version'),'v18');assert.equal(r.headers.get('x-document-sha256'),hash(fixture.rendered));
    assert.ok(r.headers.get('content-security-policy').includes(createHash('sha256').update('document.title="VISUAL SYNTHETIC";').digest('base64')));
  }
  const head=await handler(request('HEAD',{},guide));assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),String(Buffer.byteLength(fixture.rendered)));
  const closed=makeDocumentHandler({auth:owner,reader:async()=>privateText,expected,visualRenderer:()=>{throw Error('VISUAL_DOCUMENT_INTEGRITY')}});
  const r=await closed(request('GET',{},guide));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('SYNTHETIC PRIVATE DESCRIPTION'));
});

test('WebP pictures use the same owner gate, exact bytes and MIME, without private-store reads',async()=>{
  let reads=0;const imageName='slike-v18/webp/so.webp';
  const deps={reader:async()=>{reads++;throw Error('NOT_EXPECTED')}};
  const handler=makeDocumentHandler({auth:owner,...deps});
  let r=await handler(request('GET',{},imageName));assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');assert.match(r.headers.get('content-disposition'),/^inline; filename="so.webp"/);
  const bytes=Buffer.from(await r.arrayBuffer());assert.deepEqual(bytes,readVisualAsset(imageName).bytes);assert.equal(r.headers.get('x-document-sha256'),hash(bytes));assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(reads,0);
  r=await handler(request('HEAD',{},imageName));assert.equal(r.status,200);assert.equal(await r.text(),'');assert.equal(r.headers.get('content-length'),String(bytes.length));
  for(const name of [imageName,'b2b-vodic-v17.html']){
    assert.equal((await makeDocumentHandler({auth:async()=>{throw {code:'AUTH_REQUIRED'}},...deps})(request('GET',{},name))).status,401);
    assert.equal((await makeDocumentHandler({auth:async()=>({role:'demo'}),...deps})(request('GET',{},name))).status,403);
    assert.equal((await handler(request('GET',{'sec-fetch-site':'cross-site'},name))).status,403);
  }
  for(const name of ['slike-v18/webp/../visual-release-v18.json','slike-v18/png/so.png','visual-assets-v18.json'])assert.equal((await handler(request('GET',{},name))).status,404);
  assert.equal(reads,0);
});

test('all 64 bundled WebP originals match the runtime data and every picture URL is allowlisted',async()=>{
  assert.equal(Object.keys(visualAssets).length,64);
  for(const [name,item] of Object.entries(visualAssets)){
    const bytes=await readFile(new URL('../../functions/lib/omnicpq/documents/'+name,import.meta.url));
    assert.equal(bytes.length,item.size);assert.equal(hash(bytes),item.sha256);assert.deepEqual(readVisualAsset(name).bytes,bytes);
  }
  const template=await readFile(new URL('../../functions/lib/omnicpq/documents/b2b-vodic-v17.html',import.meta.url),'utf8');
  assert.equal(template,visualRelease.template);assert.equal(hash(template),visualRelease.templateSha256);
  for(const match of template.matchAll(/(?:src|data-normal|data-failed)="(\/\.netlify\/functions\/omnicpq-documents\?file=([^"]+))"/g))assert.ok(Object.hasOwn(visualAssets,decodeURIComponent(match[2])));
  assert.equal((template.match(/data-service=""/g)||[]).length,58);
  assert.equal(Object.keys(visualRelease.fragments).filter(k=>k.startsWith('service-')).length,58);
  assert.ok(!template.includes('drive.google.com'));assert.ok(!template.includes('docs.google.com'));assert.ok(!template.includes('references/services/'));
});
