/* Deterministic offline tests. All credentials and responses are fixtures.
 * Run: node --test tests/api-check.test.cjs
 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../public/AI8/api-check-core.js');
const fixtureKey = 'FAKE-ONLY-test-secret/+=123456';
const nonce = 'BD_API_SMOKE_OK_0123456789abcdef01234567';
const config = id => A.configFor(A.providerFor(id));
const options = (transport='relay',signal) => ({nonce,cap:256,transport,signal});
const response = (status,data) => ({status,text:async () => JSON.stringify(data),headers:new Headers()});
const chat = (text=nonce,finish='stop') => ({id:'fixture-id',model:'fixture-model',choices:[{message:{content:text},finish_reason:finish}],usage:{prompt_tokens:22,completion_tokens:17,total_tokens:39}});

test('all ten MAL slots build native requests, never putting credentials in URLs or model payloads', () => {
  assert.equal(A.PROVIDERS.length,10); assert.equal(new Set(A.PROVIDERS.map(p=>p.id)).size,10);
  for (const p of A.PROVIDERS) {
    const r=A.buildRequest(config(p.id),fixtureKey,nonce,256,false);
    assert.equal(r.method,'POST'); assert(!r.url.includes(fixtureKey)); assert(!JSON.stringify(r.body).includes(fixtureKey));
    assert.equal(r.headers[p.id==='gemini'?'x-goog-api-key':p.id==='claude'?'x-api-key':'authorization'],p.id==='gemini'||p.id==='claude'?fixtureKey:'Bearer '+fixtureKey);
    assert(JSON.stringify(r.body).includes(nonce));
    for (const field of ['console','keys','billing','help']) assert(new URL(p[field]).protocol==='https:');
  }
  assert.equal(A.buildRequest(config('chatgpt'),fixtureKey,nonce,256).body.max_completion_tokens,256);
  assert.equal(A.buildRequest(config('qwen'),fixtureKey,nonce,256).body.max_output_tokens,256);
  assert.equal(A.buildRequest(config('qwen'),fixtureKey,nonce,256).body.store,false);
  assert.equal(A.buildRequest(config('claude'),fixtureKey,nonce,256,true).headers['anthropic-dangerous-direct-browser-access'],'true');
});

test('host, endpoint, API family and empty-key validation blocks dispatch', async () => {
  for (const endpoint of ['http://api.openai.com/v1/chat/completions','https://api.openai.com.evil.example/v1/chat/completions','https://api.openai.com:444/v1/chat/completions','https://secret@api.openai.com/v1/chat/completions','https://api.openai.com/v1/chat/completions?key=secret','https://api.deepseek.com/chat/completions','https://api.openai.com/v1/responses']) assert.throws(()=>A.validate({...config('chatgpt'),endpoint},fixtureKey));
  assert.throws(()=>A.validate(config('chatgpt'),''));
  assert.throws(()=>A.validate({...config('claude'),type:'openai_chat'},fixtureKey));
  assert.throws(()=>A.buildRequest(config('chatgpt'),fixtureKey,nonce,999999));
  let calls=0;
  await assert.rejects(A.perform({...config('chatgpt'),endpoint:'https://evil.example/chat/completions'},fixtureKey,options(),async()=>{calls++;}));
  assert.equal(calls,0);
});

test('native responses normalize text, actual returned identity and token usage', () => {
  const cases=[
    ['openai_chat',chat()],
    ['openai_responses',{model:'returned',status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:nonce}]}],usage:{input_tokens:20,output_tokens:19,total_tokens:39,output_tokens_details:{reasoning_tokens:2}}}],
    ['anthropic_messages',{model:'returned',content:[{type:'thinking',thinking:'not the answer'},{type:'text',text:nonce}],stop_reason:'end_turn',usage:{input_tokens:22,output_tokens:17}}],
    ['gemini_generate',{modelVersion:'returned',candidates:[{content:{parts:[{thought:true,text:'not the answer'},{text:nonce}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:22,candidatesTokenCount:17,totalTokenCount:39,thoughtsTokenCount:0}}]
  ];
  for (const [type,data] of cases) {
    const r=A.classify(200,data,type,nonce); assert.equal(r.state,'pass',type); assert.equal(r.text,nonce); assert.equal(r.usage.total,39); assert(r.actual_model); assert.equal(r.balance,'unknown');
  }
  assert.equal(A.classify(200,chat('I am GPT-5'),'openai_chat',nonce).state,'attention');
  assert.equal(A.classify(200,chat(nonce,'length'),'openai_chat',nonce).state,'attention');
  assert.equal(A.classify(200,{raw:'<html>Login</html>'},'openai_chat',nonce).authentication,'unknown');
  assert.equal(A.classify(200,{content:{}},'anthropic_messages',nonce).state,'attention');
  assert.equal(A.normalize({},'gemini_generate').usage.total,null);
});

test('401,403,404,402,429 and vendor errors lead to different next steps', () => {
  for (const [status,data,expected] of [
    [401,{error:{message:'Unauthorized'}},'authentication'],
    [400,{error:{message:'API key not valid. Please pass a valid API key.'}},'authentication'],
    [403,{error:{message:'Forbidden'}},'permission'],
    [404,{error:{code:'model_not_found'}},'model'],
    [402,{error:{message:'Balance exhausted'}},'billing'],
    [429,{error:{code:'insufficient_quota'}},'billing'],
    [429,{error:{code:'rate_limit_exceeded'}},'rate_limit'],
    [429,{error:{message:'Daily free tier quota exceeded'}},'rate_limit'],
    [400,{error:{message:'Unsupported max_tokens parameter'}},'request'],
    [500,{error:{message:'Internal error'}},'provider_unavailable'],
    [200,{base_resp:{status_code:1004,status_msg:'not authorized'}},'authentication'],
    [200,{base_resp:{status_code:1008,status_msg:'insufficient balance'}},'billing'],
    [200,{base_resp:{status_code:1002,status_msg:'rate limit'}},'rate_limit'],
    [200,{base_resp:{status_code:1001,status_msg:'request timeout'}},'provider_unavailable']
  ]) { const r=A.classify(status,data,'openai_chat',nonce); assert.equal(r.category,expected,JSON.stringify(data)); assert.notEqual(r.state,'pass'); assert(r.next); }
});

test('MAL imports accept split API/Config text files, aliases, env and JSON; unrelated data is ignored', () => {
  assert.deepEqual(A.importMAL('# only key\nAPI_KEY="'+fixtureKey+'"\n','ChatGPT-API.txt'),[{id:'chatgpt',key:fixtureKey}]);
  assert.deepEqual(A.importMAL('MODEL=custom-model\nAPI_TYPE=openai_responses\nENDPOINT=https://api.openai.com/v1/responses','ChatGPT-Config.txt'),[{id:'chatgpt',model:'custom-model',endpoint:'https://api.openai.com/v1/responses',type:'openai_responses'}]);
  assert.equal(A.importMAL(fixtureKey,'Claude-API.txt')[0].key,fixtureKey);
  assert.equal(A.importMAL('OPENAI_API_KEY='+fixtureKey,'keys.env')[0].id,'chatgpt');
  assert.equal(A.importMAL('[DeepSeek]\nAPI_KEY='+fixtureKey,'keys.conf')[0].id,'deepseek');
  assert.equal(A.importMAL(JSON.stringify({keys:{Anthropic:fixtureKey}}),'keys.json')[0].id,'claude');
  assert.equal(A.importMAL(JSON.stringify({providers:[{name:'Moonshot',api_key:fixtureKey,model:'fixture-model'}]}),'keys.json')[0].id,'kimi');
  assert.deepEqual(A.importMAL(JSON.stringify({irrelevant:'private note'}),'x.json'),[]);
  assert.throws(()=>A.importMAL('{' ,'broken.json'));
  assert.throws(()=>A.importMAL('x'.repeat(250001),'x.txt'));
});

test('redaction and export cannot leak keys, encoded keys, headers, or unapproved row fields', () => {
  const r=A.redact({message:'Echo '+fixtureKey+' '+encodeURIComponent(fixtureKey),[fixtureKey]:'key echoed as a field name',nested:[{api_key:fixtureKey,authorization:'Bearer other-secret',url:'https://x/?key=unlisted-secret'}]},[fixtureKey]);
  assert(!JSON.stringify(r).includes(fixtureKey)); assert(!JSON.stringify(r).includes(encodeURIComponent(fixtureKey))); assert(!JSON.stringify(r).includes('unlisted-secret')); assert(!JSON.stringify(r).includes('other-secret'));
  const report=A.exportReport([{id:'chatgpt',state:'error',text:fixtureKey,diagnostic:{headers:{authorization:'Bearer '+fixtureKey}},key:fixtureKey,api_key:fixtureKey,request:{secret:'hidden'},provider_message:'Echo '+fixtureKey}], [fixtureKey],{requests_issued:1});
  const raw=JSON.stringify(report); assert(!raw.includes(fixtureKey)); assert(!raw.includes('hidden')); assert.equal(report.contains_api_keys,false); assert.equal(report.requests_issued,1); assert(!('key' in report.results[0]));
});

test('relay makes exactly one request and unwraps only the provider HTTP status', async () => {
  const seen=[];
  const r=await A.perform(config('chatgpt'),fixtureKey,options(),async (url,init)=>{seen.push({url,init});return response(200,{ok:true,status:200,data:chat()});});
  assert.equal(r.state,'pass'); assert.equal(seen.length,1); assert.equal(seen[0].url,A.RELAY);
  const req=JSON.parse(seen[0].init.body); assert.equal(req.timeout_ms,55000); assert.equal(req.headers.authorization,'Bearer '+fixtureKey);
  assert.equal(seen[0].init.credentials,'omit'); assert.equal(seen[0].init.redirect,'error');
  const bad=await A.perform(config('deepseek'),fixtureKey,options(),async()=>response(402,{ok:false,status:402,data:{error:{message:'Insufficient Balance'}}}));
  assert.equal(bad.category,'billing'); assert.equal(bad.http_status,402);
});

test('network failure, relay timeout, platform denial and abort remain unknown; none retries', async () => {
  for (const transport of ['direct','relay']) {
    let calls=0;
    const r=await A.perform(config('chatgpt'),fixtureKey,options(transport),async()=>{calls++;throw new TypeError('Failed to fetch');});
    assert.equal(calls,1); assert.equal(r.state,'unknown'); assert.equal(r.authentication,'unknown');
  }
  for (const [status,payload] of [[502,{ok:false,error:'Synchronous relay budget exceeded'}],[401,{error:'Platform auth required'}],[200,{raw:'Not the relay envelope'}]]) {
    const r=await A.perform(config('chatgpt'),fixtureKey,options(),async()=>response(status,payload)); assert.equal(r.state,'unknown'); assert.equal(r.category,'transport');
  }
  const controller=new AbortController(); let calls=0;
  const r=await A.perform(config('chatgpt'),fixtureKey,options('relay',controller.signal),async()=>{calls++; controller.abort(); throw new DOMException('Aborted','AbortError');});
  assert.equal(calls,1); assert.equal(r.category,'interrupted'); assert.equal(r.authentication,'unknown');
});

test('page has no persistence, telemetry, dynamic HTML sink or automatic dispatch, and Start favorite preserves state', () => {
  const base=path.join(__dirname,'../public');
  const js=fs.readFileSync(path.join(base,'AI8/api-check.js'),'utf8');
  assert(!/localStorage\s*\.|sessionStorage\s*\.|indexedDB\s*\.|\.innerHTML\s*=|navigator\.sendBeacon|console\.log/.test(js));
  const html=fs.readFileSync(path.join(base,'AI8/api-check.html'),'utf8');
  assert(html.includes('Content-Security-Policy')); assert(!/<script[^>]+src="https?:/.test(html));
  const start=fs.readFileSync(path.join(base,'Start/app.js'),'utf8');
  assert(start.includes("new URL('../AI8/api-check.html',document.baseURI).href"));
  assert(start.includes("index!==-1")); assert(!start.includes('bd-start-api-check-added'));
  for (const url of ['https://www.mdlxdcc.org/Start/index.html','https://bd-chess.github.io/bd-chessdb/Start/index.html']) assert(new URL('../AI8/api-check.html',url).href.endsWith('/AI8/api-check.html'));
});
