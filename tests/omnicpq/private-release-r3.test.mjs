import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeDocumentHandler} from '../../functions/omnicpq-documents.mjs';
import {verifyReleaseDocuments,resolveReleaseName,readReleaseDocument,protectedReleaseRendition} from '../../functions/lib/omnicpq/private-release.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
// Synthetic content only. Real Word, HTML and source bytes stay in private QA.
const guide='b2b-vodic-v19.html',word='B2B_SYNTHETIC_v18.docx',coverage='b2b-pokritost-v18.html';
const html=Buffer.from('<html><body><p>SYNTHETIC PRIVATE RELEASE</p><img src="slike-v18/webp/so.webp"><a href="'+word+'">Word</a><script>document.title="SYNTHETIC R3";</script></body></html>');
const buffers={[guide]:html,[coverage]:html,[word]:Buffer.from('SYNTHETIC DOCX CONTENT')};
const files=Object.fromEntries(Object.entries(buffers).map(([name,b])=>[name,{mime:name.endsWith('.html')?'text/html; charset=utf-8':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:b.length,sha256:sha(b),version:name===guide?'v19':'v18'}]));
const text=JSON.stringify({schema:'omnicpq.private_documents.v1',documentVersion:'v18',files:Object.fromEntries(Object.entries(buffers).map(([name,b])=>[name,{...files[name],base64:b.toString('base64')}]))});
const expected={documentVersion:'v18',bundleSha256:sha(text),files,aliases:{'b2b-vodic-v17.html':guide,'b2b-vodic-v18.html':guide,'b2b-pokritost-v17.html':coverage,'B2B_SYNTHETIC_v17.docx':word}};
const owner=async()=>({role:'owner'});
const get=(name=guide,headers={},method='GET')=>new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-documents?file='+encodeURIComponent(name),{headers,method});
const post=(body=text,headers={})=>new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-documents',{method:'POST',headers:{origin:'https://www.mdlxdcc.org','content-type':'application/json',...headers},body});

test('R07/R09 release resolver keeps every legacy alias, protects relative resources and hashes served rendition',async()=>{
  let legacyReads=0;
  const handler=makeDocumentHandler({auth:owner,currentRelease:expected,currentReader:async()=>text,reader:async()=>{legacyReads++;throw Error('NO_LEGACY_FALLBACK');}});
  for(const name of [...Object.keys(files),...Object.keys(expected.aliases)]){
    const actual=resolveReleaseName(name,expected),item=protectedReleaseRendition(await readReleaseDocument(name,{expected,reader:async()=>text}));
    assert.equal(actual,expected.aliases[name]||name);
    const res=await handler(get(name)),bytes=Buffer.from(await res.arrayBuffer());
    assert.equal(res.status,200);assert.deepEqual(bytes,item.bytes);assert.equal(res.headers.get('x-document-sha256'),sha(bytes));
    assert.equal(res.headers.get('x-document-version'),files[actual].version);assert.match(res.headers.get('cache-control'),/private, no-store/);
    if(name.endsWith('.html')){
      assert.match(bytes.toString(),/src="\/\.netlify\/functions\/omnicpq-documents\?file=slike-v18\/webp\/so.webp"/);
      assert.match(bytes.toString(),/href="\/\.netlify\/functions\/omnicpq-documents\?file=B2B_SYNTHETIC_v18.docx"/);
      assert.ok(res.headers.get('content-security-policy').includes(createHash('sha256').update('document.title="SYNTHETIC R3";').digest('base64')));
    }
    const head=await handler(get(name,{},'HEAD'));assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),String(item.bytes.length));
  }
  assert.equal(legacyReads,0);
});
test('R09 release gate denies anonymous, demo and cross-origin before reading any private bytes',async()=>{
  let reads=0;const opts={currentRelease:expected,currentReader:async()=>{reads++;return text;}};
  for(const [auth,status] of [[async()=>{throw {code:'AUTH_REQUIRED'};},401],[async()=>({role:'demo'}),403]]){
    const h=makeDocumentHandler({...opts,auth});assert.equal((await h(get())).status,status);
  }
  const h=makeDocumentHandler({...opts,auth:owner});
  assert.equal((await h(get(guide,{origin:'https://evil.test'}))).status,403);
  assert.equal((await h(get(guide,{'sec-fetch-site':'cross-site'}))).status,403);
  for(const name of ['../'+guide,'b2b-vodic-v20.html','private-release.json'])assert.equal((await h(get(name))).status,404);
  assert.equal(reads,0);
});
test('R09 absent, stale or corrupt new release fails closed and cannot silently serve old content',async()=>{
  for(const value of [null,text+' ',text.replace('v18','v17')]){
    let legacyReads=0;const h=makeDocumentHandler({auth:owner,currentRelease:expected,currentReader:async()=>value,reader:async()=>{legacyReads++;return text;}});
    const r=await h(get('b2b-vodic-v17.html'));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('SYNTHETIC PRIVATE'));assert.equal(legacyReads,0);
  }
  assert.throws(()=>verifyReleaseDocuments(text,{...expected,bundleSha256:'0'.repeat(64)}),/INTEGRITY/);
  for(const mutate of [d=>d.files[word].base64+='=',d=>delete d.files[word],d=>d.files[word].mime='text/plain',d=>d.documentVersion='v17']){
    const data=JSON.parse(text);mutate(data);const changed=JSON.stringify(data);assert.throws(()=>verifyReleaseDocuments(changed,{...expected,bundleSha256:sha(changed)}),/INTEGRITY/);
  }
});
test('R10 exact owner seed writes once to immutable hash key and requires strong readback',async()=>{
  let stored=null,writes=0;const key='v18/'+expected.bundleSha256+'.json';
  const store={get:async(k,opt)=>{assert.equal(k,key);assert.equal(opt.consistency,'strong');return stored;},set:async(k,value,opt)=>{assert.equal(k,key);assert.equal(opt.onlyIfNew,true);stored=value;writes++;}};
  const h=makeDocumentHandler({auth:owner,currentRelease:expected,storeFactory:async()=>store});
  let r=await h(post());assert.equal(r.status,200);assert.equal((await r.json()).sha256,expected.bundleSha256);assert.equal(writes,1);
  assert.equal((await h(post())).status,200);assert.equal(writes,1);
  assert.equal((await h(post(text+' '))).status,503);assert.equal(writes,1);
  stored='CONCURRENT_OTHER_CONTENT';assert.equal((await h(post())).status,409);assert.equal(writes,1);
  assert.equal((await h(post(text,{origin:'https://evil.test'}))).status,403);
  const failed=makeDocumentHandler({auth:owner,currentRelease:expected,storeFactory:async()=>({get:async()=>null,set:async()=>{}})});
  assert.equal((await failed(post())).status,503);
});
