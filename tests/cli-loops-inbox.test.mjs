import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {buildRequest,canonical,digest,publicKey,planToken,confirmPlan,envelope,submit,REPOSITORY,BRANCH} from '../functions/lib/cli-loops-inbox.mjs';
import {makeInboxHandler} from '../functions/cli-loops-inbox.mjs';
const {privateKey:key}=generateKeyPairSync('ed25519');
const encodedKey=key.export({format:'der',type:'pkcs8'}).toString('base64');
const basic={host:'WORK',mode:'MAX',collaboration:'',depth:'',limit:'10',topic:'Preveri: A < B; šumniki žčš in emoji 🙂 ostanejo.',build:false,activate:false,calls:'20',tokens:''};
const native=buildRequest(basic);const signed=envelope(native,key);const signedRaw=Buffer.from(canonical(signed));
writeFileSync(new URL('../../SIGNED_FIXTURE.json',import.meta.url),JSON.stringify({request:native,public_key:publicKey(key),envelope:signed,blob:{encoding:'base64',content:signedRaw.toString('base64'),size:signedRaw.length,sha:createHash('sha1').update('blob '+signedRaw.length+'\0').update(signedRaw).digest('hex')}}));
function fakeGitHub({lostReply=false,publicRepo=false}={}){
 const files=new Map();let puts=0;
 const api=async(path,{method='GET',body}={})=>{
  if(path==='')return {private:!publicRepo,full_name:REPOSITORY};
  if(path==='/git/ref/heads/'+BRANCH)return {object:{sha:'a'.repeat(40)}};
  const name=path.replace(/^\/contents\//,'').split('?')[0];
  if(method==='PUT'){
   puts++;assert.equal(body.branch,BRANCH);assert.equal(body.sha,undefined);
   if(files.has(name))throw Object.assign(Error(),{code:'GITHUB_CONFLICT'});
   const raw=Buffer.from(body.content,'base64');files.set(name,{type:'file',encoding:'base64',content:body.content,size:raw.length,sha:createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex')});
   if(lostReply)throw Object.assign(Error(),{code:'GITHUB_UNAVAILABLE'});return {ok:true};
  }
  return files.get(name)||null;
 };
 return {api,files,get puts(){return puts;},fetcher:async(url,opts)=>{try{const result=await api(url.split('/repos/'+REPOSITORY)[1],{method:opts.method,body:opts.body?JSON.parse(opts.body):undefined});return Response.json(result||{}, {status:result?200:404});}catch(e){if(lostReply)throw e;return Response.json({}, {status:409});}}};
}
test('native v5 defaults, exact topic, topology/build and accepted limits',()=>{
 assert.equal(native.max_cli_turns,10);assert.equal(native.max_duration_s,43200);assert.equal(native.topic,basic.topic);assert.equal(native.target_host,'WORK');
 const without={...native};delete without.approval;assert.equal(native.approval.plan_sha256,digest(canonical(without)));
 assert.throws(()=>buildRequest({...basic,mode:'MIN'}),/UNSUPPORTED_PROFILE/);
 assert.throws(()=>buildRequest({...basic,mode:'XHIGH'}),/UNSUPPORTED_PROFILE/);
 assert.equal(buildRequest({...basic,host:'HOME',mode:'XHIGH'}).effort_mode,'XHIGH');
 assert.throws(()=>buildRequest({...basic,limit:'13h'}),/INVALID_LIMIT/);
 assert.throws(()=>buildRequest({...basic,limit:'custom',customLimit:'',customUnit:''}),/INVALID_LIMIT/);
 assert.throws(()=>buildRequest({...basic,topic:'x'.repeat(65537)}),/INVALID_TOPIC/);
 assert.equal(buildRequest({...basic,topic:'x'.repeat(65536)}).topic.length,65536);
 const full=buildRequest({...basic,collaboration:'FullRHP',depth:'DEEP',limit:'2h',build:true,buildProject:' LISTENER ',buildPackage:'r42',activate:true});
 assert.equal(full.skeptics,true);assert.equal(full.full_rhp,true);assert.equal(full.deep,true);assert.equal(full.max_duration_s,7200);assert.equal(full.build_target.project,'LISTENER');
});
test('frozen preview binds user, full request, host and expiry',()=>{
 const token=planToken(native,'owner',key);confirmPlan(native,token,'owner',key,new Date());
 assert.throws(()=>confirmPlan({...native,target_host:'HOME'},token,'owner',key,new Date()),/PLAN_CHANGED/);
 assert.throws(()=>confirmPlan(native,token,'different-owner',key,new Date()),/PLAN_CHANGED/);
 assert.throws(()=>confirmPlan(native,token,'owner',key,new Date(Date.now()+660000)),/PREVIEW_EXPIRED/);
});

test('WORK FullRHP DEEP enables independent Drive discovery with no injected task sources',()=>{
 const topic='Pregled ToE daily in log in če je kaj dobrega za nadgraditi main /CRP/ToE.html';
 const req=buildRequest({...basic,mode:'AUTO',collaboration:'FullRHP',depth:'DEEP',limit:'',topic});
 assert.equal(req.action,'cli_loop_workspace');assert.deepEqual(req.projects,['DRIVE']);
 assert.deepEqual(req.context,[]);assert.deepEqual(req.seed_files,[]);assert.equal(req.full_rhp,true);assert.equal(req.deep,true);assert.equal(req.skeptics,true);
 assert.equal(req.topic,topic);assert.equal(req.max_duration_s,43200);assert.equal(req.max_cli_turns,100);
 const token=planToken(req,'owner',key);confirmPlan(req,token,'owner',key,new Date());
 assert.throws(()=>confirmPlan({...req,projects:[]},token,'owner',key,new Date()),/PLAN_CHANGED/);
 const carrier=envelope(req,key);assert.deepEqual(JSON.parse(Buffer.from(carrier.request_base64,'base64')),req);
 assert.deepEqual(buildRequest({...basic,host:'HOME'}).projects,[]);
 const build=buildRequest({...basic,build:true,buildProject:'LISTENER',buildPackage:'test',activate:false});assert.deepEqual(build.projects,[]);
});
test('create-only retry, concurrent duplicate and lost response produce one stored request',async()=>{
 for(const lostReply of [false,true]){const remote=fakeGitHub({lostReply});const r=await submit(remote.api,native,key);assert.equal(r.state,'QUEUED_GITHUB');const again=await submit(remote.api,native,key);assert.equal(again.blob_sha,r.blob_sha);assert.equal(remote.puts,1);assert.equal(remote.files.size,1);}
 const remote=fakeGitHub();await Promise.all([submit(remote.api,native,key),submit(remote.api,native,key)]);assert.equal(remote.files.size,1);
});
test('private mailbox and conflicting immutable contents fail closed',async()=>{
 await assert.rejects(submit(fakeGitHub({publicRepo:true}).api,native,key),/PRIVATE_INBOX_REQUIRED/);
 const remote=fakeGitHub();await submit(remote.api,native,key);const different={...native,topic:'Changed'};await assert.rejects(submit(remote.api,different,key),/GITHUB_CONFLICT/);assert.equal(remote.puts,1);
});
test('HTTP handler enforces owner, origin, preview token and performs the real create/readback operation',async()=>{
 const remote=fakeGitHub(),getEnv=k=>k==='CLI_LOOPS_GITHUB_TOKEN'?'test-only-not-a-live-token':k==='CLI_LOOPS_INBOX_SIGNING_KEY'?encodedKey:'';
 const handler=makeInboxHandler({auth:async()=>({id:'owner',role:'owner'}),getEnv,fetcher:remote.fetcher});
 const post=body=>new Request('https://www.mdlxdcc.org/.netlify/functions/cli-loops-inbox',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.mdlxdcc.org'},body:JSON.stringify(body)});
 const preview=await (await handler(post({action:'preview',values:basic}))).json();assert.ok(preview.confirmation);
 const response=await handler(post({action:'submit',request:preview.request,confirmation:preview.confirmation}));assert.equal(response.status,200);assert.equal((await response.json()).state,'QUEUED_GITHUB');assert.equal(remote.files.size,1);
 const visitor=makeInboxHandler({auth:async()=>({id:'x',role:'visitor'}),getEnv});assert.equal((await visitor(post({}))).status,403);
 const missing=makeInboxHandler({auth:async()=>{throw Object.assign(Error(),{code:'AUTH_REQUIRED'});},getEnv});assert.equal((await missing(post({}))).status,401);
 const cross=new Request('https://www.mdlxdcc.org/.netlify/functions/cli-loops-inbox',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal((await handler(cross)).status,403);
 assert.equal((await handler(new Request(post({})),{site:{name:'bd-chess'}})).status,404);
});

test('MAL / EXT build request.v6 only when selected and round-trip through confirm',()=>{
 const home={...basic,host:'HOME',mode:'AUTO'};
 const plain=buildRequest(home);assert.equal(plain.schema,'8zlistener.request.v5');assert.equal('external_llms' in plain,false);
 const v6=buildRequest({...home,ext:'all',mal:true});
 assert.equal(v6.schema,'8zlistener.request.v6');assert.equal(v6.external_llms,'all');assert.equal(v6.use_mal,true);assert.equal(v6.ext_max_calls,8);assert.equal(v6.ext_max_usd,'2');
 const malOnly=buildRequest({...home,mal:true});assert.equal(malOnly.external_llms,'none');assert.equal(malOnly.ext_max_calls,0);assert.equal(malOnly.ext_max_usd,'0');
 confirmPlan(v6,planToken(v6,'owner',key),'owner',key,new Date(Date.parse(v6.requested_at_utc)+1000));
 assert.throws(()=>buildRequest({...basic,ext:'gemini'}),{code:'UNSUPPORTED_PROFILE'});
 assert.throws(()=>buildRequest({...home,ext:'minimax'}),{code:'INVALID_PLAN'});
 assert.throws(()=>buildRequest({...home,mal:'yes'}),{code:'INVALID_PLAN'});
});
