const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'integrations/hmal/app/static');
const html=fs.readFileSync(path.join(app,'hmal.html'),'utf8');
const report={schema:'hmal.smoke_report.v1',finished_utc:'2026-01-01T12:00:00Z',summary:{cases:5,pass:4,fail:1},
 rows:[{model:'mellum2.1',off:{seconds:1.2,level:'off',verdict:'PASS'},on:{seconds:2.3,level:'on',verdict:'PASS'}},
 {model:'gpt-oss',off:{seconds:3.4,level:'low_not_off',verdict:'PASS'},on:{seconds:4.5,level:'high',verdict:'PASS'}},
 {model:'ministral3',off:null,on:{seconds:181,level:'native_only',verdict:'FAIL'}}],
 failure:{model:'ministral3',input_tokens:10,output_tokens:20,context_tokens:32},repeated_cases:3,reused_passes:2,cleanup_pass:6,cleanup_total:6,
 sources:[{label:'Poročilo',url:'https://drive.google.com/'},{label:'bad',url:'javascript:alert(1)'}]};
async function fixture(value){
 const dom=new JSDOM(html,{url:'https://hmal.test/hmal/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window,calls=[];
 w.Headers=Headers;w.setInterval=()=>1;w.clearInterval=()=>{};
 w.fetch=async input=>{calls.push(input);const data=input==='/api/session'?{csrf:'fixture'}:input==='/api/hmal/smoke-results'?value:
  input==='/api/hmal/status'?{build:'SYNTHETIC',enabled:true,catalogue:{models:[]},native:{status:'STOPPED'},runs:[],active_run:null}:null;
  assert(data,'Unexpected API call '+input);return {ok:true,status:200,json:async()=>data};};
 w.eval(fs.readFileSync(path.join(app,'hmal_i18n.js'),'utf8'));w.eval(fs.readFileSync(path.join(app,'hmal.js'),'utf8'));
 for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));
 return {dom,w,calls};
}
test('historical report is collapsed, correctly labelled, safe and localized',async()=>{
 const {dom,w,calls}=await fixture({state:'AVAILABLE',report});try{
  const d=w.document,details=d.querySelector('#hmal-smoke-results');assert(!details.open);assert.match(d.querySelector('#smoke-summary').textContent,/4\/5 PASS/);
  assert.equal(d.querySelectorAll('#smoke-rows tr').length,3);assert.match(d.querySelector('#smoke-rows').textContent,/low \(ni OFF\)/);
  assert.match(d.querySelector('#smoke-failure').textContent,/10 \+ 20 = 30 \/ 32/);assert.match(d.querySelector('#smoke-method').textContent,/6\/6 PASS/);
  assert.equal(d.querySelectorAll('#smoke-links a').length,1);assert.equal(calls.filter(x=>x==='/api/hmal/smoke-results').length,1);
  assert(calls.every(x=>!x.includes('control')&&!x.includes('create')&&!x.includes('memory-clean')));
  details.querySelector('summary').click();assert(details.open);
  d.querySelector('[data-lang=en]').click();assert.match(details.textContent,/low \(not OFF\)/);assert(details.open);
  assert.match(details.textContent,/controller was idle at the end/);
 }finally{dom.window.close();}
});
test('unavailable private report does not block Chat or invent results',async()=>{
 const {dom,w,calls}=await fixture({state:'UNAVAILABLE',report:null});try{
  assert(w.document.querySelector('#smoke-report').hidden);assert.equal(w.document.querySelectorAll('#smoke-rows tr').length,0);
  assert.match(w.document.querySelector('#smoke-unavailable').textContent,/še ni na voljo/);assert(!w.document.querySelector('#send').disabled);
  assert(calls.includes('/api/hmal/status'));
 }finally{dom.window.close();}
});
test('cloud entry forwards to existing HOME authentication and Start links to it',()=>{
 const entry=fs.readFileSync(path.join(root,'public/hmal/index.html'),'utf8'),start=fs.readFileSync(path.join(root,'public/Start/index.html'),'utf8');
 assert.match(entry,/http-equiv="refresh" content="0;url=https:\/\/193\.77\.159\.220\/hmal\/"/);
 assert.match(start,/id="bs-hmal-link"[^>]+href="\.\.\/hmal\/"/);
 assert(!entry.includes('/api/hmal/'));assert(!entry.includes('smoke-results.v1.json'));
 assert(!fs.existsSync(path.join(root,'public/hmal/smoke-results.v1.json')));
});
