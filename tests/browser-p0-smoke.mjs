// One bounded loopback browser smoke: actual handler + actual browser assets, mock provider only.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { makeHandler } from '../functions/game-guide.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)), evidence=path.join(root,'evidence');
const profile=path.join(evidence,`browser-profile-${process.pid}`);await mkdir(profile,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const game={schema:'ai8.game.v1',slug:'_fixture',title:'Pet mehanizmov',acts:[1,2,3,4,5].map(act=>({act})),steps:[
 {id:'s1',act:1,kind:'story',title:'Prolog',for_agent:'Začni.',text:'V delavnici preizkušava zamisli.'},
 ...[1,2,3,4,5].flatMap(n=>[
  {id:`c${n}`,act:n,kind:'challenge',title:`Izziv ${n}`,for_agent:'Vprašanje je na strani.',text:`Kako bi preizkusil mehanizem ${n}?`,key_ideas:['Gibanje spremeni stanje.','Preizkus pokaže razliko.'],alternatives_ok:['Katapult in en propeler sta veljavni alternativi.']},
  {id:`h${n}`,act:n,kind:'hint',for:`c${n}`,title:`Namig ${n}`,for_agent:'Premisli o gibanju.',text:'Pomisliva, kaj se premika.'},
  {id:`r${n}`,act:n,kind:'reveal',for:`c${n}`,title:`Razkritje ${n}`,for_agent:'Zgodovinski preizkus.',text:'Gibanje spremeni stanje; preizkus pokaže razliko.'}
 ]),{id:'end',act:5,kind:'epilogue',title:'Epilog',for_agent:'Končala sva.',text:'Vseh pet poti je pred nama.'}
]};
const html=`<!doctype html><html lang="sl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guide smoke</title><link rel="stylesheet" href="/assets/game-guide/game-guide.css"><style>body{margin:0;background:#f3f0e8;color:#20242b;font:18px/1.6 Georgia}main{padding:20px 32px;max-width:850px}.g-step{padding:16px 0 50px;scroll-margin-top:20px}button{font:inherit}h2{line-height:1.2}</style><main data-game-page>${game.steps.map((s,i)=>`<section class="g-step" data-kind="${s.kind}" id="${s.id}" ${i?'hidden':''}><h2>${s.title}</h2><p>${s.text}</p>${i?'':'<div data-gg-start hidden><button type="button" data-gg-action="start">Začniva igro</button></div>'}</section>`).join('')}</main><script type="module" src="/assets/game-guide/game-guide.js"></script></html>`;
let access='owner', modelCalls=0, clientPosts=[], browser, socket, sequence=0;const pending=new Map();
const logID='12345678-1234-4234-8234-123456789abc', logs=[];
const report={kind:'one-bounded-loopback-smoke',checks:[],screenshots:[]};
const handler=makeHandler({accessFactory:async()=>{if(access!=='owner')throw Object.assign(Error(),{code:'AUTH_REQUIRED'});return{role:'owner',id:'fixture'};},
 configured:{claude:true,gpt:true},continuationSecret:()=> 'local-browser-secret-only-'.repeat(3),gameFactory:async()=>structuredClone(game),clientFactory:async()=>({}),budgetFactory:()=>({}),
 logStore:{start:async()=>({id:logID}),append:async(_,events)=>{logs.push(...events);}},
 round:async({provider,system,input,onText})=>{
  modelCalls++;const ctx=JSON.parse(system.split('KONTEKST IGRE (podatki):\n')[1]);
  const message=input.filter(m=>m.role==='user'&&typeof m.content==='string').map(m=>{try{return JSON.parse(m.content).message;}catch{return null;}}).find(Boolean);
  const results=input.flatMap(m=>m.type==='function_call_output'?[JSON.parse(m.output)]:Array.isArray(m.content)?m.content.filter(c=>c.type==='tool_result').map(c=>JSON.parse(c.content)):[]);
  const displayed=results.some(r=>r.visible===true&&!r.already_open), noOp=results.at(-1)?.already_open;
  let text='',calls=[];const use=(name,args)=>calls.push({name,arguments:args,call_id:`call_${modelCalls}`});
  if(displayed)text='**To besedilo modela se ob odprtju ne sme prikazati.** '+('Podvajanje vsebine. '.repeat(20));
  else if(noOp)text='To je odjemalec že odprl.';
  else if(/Markdown/.test(message))text='**Krepko** *poševno* `koda`\n- Prva vrstica\n- <img src=x onerror="window.PWNED=1">\n<script>window.PWNED=1</script>';
  else if(/Ponovi/.test(message))use('open_step',{id:ctx.opened.at(-1).id});
  else if(ctx.sealed_key){
   const id=ctx.sealed_key.challenge;
   if(ctx.learning.cards[id])use('open_step',{id:ctx.sealed_key.reveal[0].id});
   else if(/Namig/.test(message))use('open_step',{id:ctx.sealed_key.hints.find(h=>!ctx.opened.some(s=>s.id===h.id)).id});
   else if(/Razlaga/.test(message))use('assess_challenge',{step:id,card:id==='c2'?'B':'A',achieved:2,stars:id==='c3'?0:2,why:'Preizkus pokaže razliko.',explanation:message,bonus:'none',advantage:''});
   else if(!ctx.learning.asked.includes(id))use('ask_understanding',{step:id,question:'Zakaj bi tvoja zamisel delovala?'});
   else text='Zakaj bi tvoja zamisel delovala?';
  }else if(ctx.next)use('open_step',{id:ctx.next.id});else text='Kaj želiš raziskati?';
  onText(text);
  const response=provider==='claude'?{content:[...(text?[{type:'text',text}]:[]),...calls.map(c=>({type:'tool_use',id:c.call_id,name:c.name,input:c.arguments}))]}:{output:calls.map(c=>({type:'function_call',...c,arguments:JSON.stringify(c.arguments)}))};
  return{text,calls,response};
 }});
const server=createServer(async(req,res)=>{
 try{
  if(req.url.startsWith('/.netlify/functions/')){
   let raw='';for await(const chunk of req)raw+=chunk;
   if(req.method==='POST'){const b=JSON.parse(raw);clientPosts.push(b);}
   const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(raw?{body:raw}:{})});
   const answer=await handler(request);res.writeHead(answer.status,Object.fromEntries(answer.headers));res.end(Buffer.from(await answer.arrayBuffer()));return;
  }
  if(req.url==='/game/_fixture/'||req.url==='/game/_fixture/index.html'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(html);return;}
  if(req.url==='/game/_fixture/game.json'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(game));return;}
  const pathname=new URL(req.url,'http://localhost').pathname, file=path.resolve(root,'public','.'+pathname);
  if(!file.startsWith(path.join(root,'public')+path.sep))throw Error();
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':pathname.endsWith('.css')?'text/css':'text/javascript'});res.end(bytes);
 }catch(error){res.writeHead(500);res.end('fixture error');report.server_error=String(error);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/game/_fixture/`;
async function connect(wsURL){const ws=new WebSocket(wsURL);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});ws.onmessage=e=>{const data=JSON.parse(e.data),p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result);};return ws;}
function send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},5000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression,label){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(25);}throw Error('Timed out: '+label);}
async function navigate(reset=true){if(reset)await evaluate('if(location.protocol==="http:")sessionStorage.clear()');await send('Page.navigate',{url});await pause(50);await until(`document.getElementById('gg-status')&&!document.getElementById('gg-status').textContent.includes('Preverjam')`,'ready');}
async function compose(message){await evaluate(`document.getElementById('gg-input').value=${JSON.stringify(message)};document.getElementById('gg-compose').requestSubmit()`);await until(`!document.getElementById('gg-mode').disabled`,'turn');const status=await evaluate(`document.getElementById('gg-status').textContent`);assert.ok(!/ni dokončan|trenutno ni/.test(status),status);}
async function screenshot(file){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(evidence,file),Buffer.from(r.data,'base64'));report.screenshots.push(file);}
try{
 const exe=process.env.GAME_GUIDE_BROWSER||'C:\\Users\\iemcc\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
 browser=spawn(exe,['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','about:blank'],{windowsHide:true,stdio:'ignore',env:{...process.env,TEMP:profile,TMP:profile}});
 let port;for(let i=0;i<60;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break;}catch{}await pause(50);}assert.ok(port,'browser start');
 const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();socket=await connect(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await navigate();
 assert.equal(await evaluate(`document.getElementById('gg-mode').value`),'IZUMLJAJ');assert.equal(await evaluate(`document.querySelector('label[for=gg-input]').textContent`),'Tvoje sporočilo');await screenshot('guide-390.png');
 await evaluate(`document.querySelector('[data-gg-start] button').click();document.getElementById('gg-start').click()`);await until(`!document.getElementById('gg-mode').disabled`,'start');
 assert.equal(clientPosts.filter(b=>!b.continuation&&!b.operation).length,1,'single first turn');assert.equal(await evaluate(`document.getElementById('c1').hidden`),false);
 const firstReceipt=clientPosts.find(b=>b.continuation)?.receipts[0];assert.equal(firstReceipt.visible,true);assert.equal(firstReceipt.opened,'c1');
 assert.equal(await evaluate(`document.querySelector('#c1 h2').hasAttribute('data-gg-opened')`),true);
 assert.equal(await evaluate(`document.querySelector('[data-gg-start]').hidden`),true);
 assert.equal(await evaluate(`document.querySelector('.gg-message[data-role=assistant]').textContent`),'Na desni se je odprl nov korak. Preberi in mi povej, ko si pripravljen.');
 report.checks.push('both start buttons dispatch once; challenge opens through real handler; actual visible receipt; scroll/title glow; one-line invitation; exact input label; Invent default');
 for(let n=1;n<=5;n++){
  if(n>1)await compose('Naprej.');assert.equal(await evaluate(`document.getElementById('c${n}').hidden`),false);
  if(n===3){await compose('Namig prosim.');assert.equal(await evaluate(`document.getElementById('h3').hidden`),false);}
  await compose('Moja zamisel.');assert.equal(await evaluate(`document.getElementById('r${n}').hidden`),true,'reveal waits for understanding');
  await compose('Razlaga: gibanje spremeni stanje, preizkus pa pokaže razliko med potema.');assert.equal(await evaluate(`document.getElementById('r${n}').hidden`),false);
  assert.match(await evaluate(`document.querySelector('.gg-message[data-role=assistant]:last-child').textContent`),new RegExp(`Kartica ${n===2?'B':'A'}`));
  if(n===3){await navigate(false);const restored=await evaluate(`JSON.parse(sessionStorage.getItem('ai8.game.v1:_fixture:development'))`);assert.ok(!('learning'in restored));}
 }
 await compose('Naprej.');const summary=await evaluate(`document.querySelector('.gg-message[data-role=assistant]:last-child').textContent`);
 for(let n=1;n<=5;n++)assert.ok(summary.includes(`Izziv ${n} · Kartica`));assert.ok(summary.includes('Kartica B · tvoja pot'));
 assert.equal(clientPosts.filter(b=>!b.continuation&&/Razlaga/.test(b.message||'')).length,5);
 report.checks.push('five challenge openings; requested hint only; understanding before reveal; A/B cards; coded final summary has all five cards; development produces no mark_result');
 assert.ok(!logs.some(e=>e.kind==='mark_result'));
 await compose('Markdown prosim.');assert.equal(await evaluate(`!!document.querySelector('.gg-message:last-child strong')`),true);assert.equal(await evaluate(`!!document.querySelector('.gg-message:last-child em')`),true);assert.equal(await evaluate(`!!document.querySelector('.gg-message:last-child code')`),true);assert.equal(await evaluate(`!!document.querySelector('.gg-message:last-child ul')`),true);
 assert.equal(await evaluate(`!!document.querySelector('.gg-message:last-child img,.gg-message:last-child script')`),false);assert.equal(await evaluate(`window.PWNED||0`),0);
 const messages=await evaluate(`document.querySelectorAll('.gg-message').length`);await compose('Ponovi.');assert.equal(await evaluate(`document.querySelectorAll('.gg-message').length`),messages+1,'no assistant bubble for no-op');
 const before=await evaluate(`({id:JSON.parse(sessionStorage.getItem('ai8.game.v1:_fixture:development')).game_session_id,count:document.querySelectorAll('.gg-message').length})`);
 await navigate(false);const after=await evaluate(`({id:JSON.parse(sessionStorage.getItem('ai8.game.v1:_fixture:development')).game_session_id,count:document.querySelectorAll('.gg-message').length})`);assert.deepEqual(after,before);
 const saved=await evaluate(`JSON.parse(sessionStorage.getItem('ai8.game.v1:_fixture:development'))`);assert.ok(!('results'in saved));assert.ok(!('learning'in saved));
 report.checks.push('escaped markdown rendered; no executable HTML; no-op has no new assistant bubble; reload restores conversation/open steps/same game_session_id; no structured development results');
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await screenshot('guide-1366.png');
 access='anonymous';await navigate();const posts=clientPosts.length;const calls=modelCalls;
 await evaluate(`document.getElementById('gg-start').click();document.getElementById('gg-read-yes').click()`);assert.equal(await evaluate(`document.getElementById('c1').hidden`),false);assert.equal(clientPosts.length,posts);assert.equal(modelCalls,calls);
 assert.equal(await evaluate(`document.getElementById('gg-login-details').open`),false);report.checks.push('anonymous reader still warns, opens locally and makes zero POST/provider calls; login folded');
 report.model_calls_mock_only=modelCalls;report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack||error);process.exitCode=1;}
finally{
 if(socket){try{await send('Browser.close');}catch{}socket.close();}if(browser&&browser.exitCode===null){await pause(100);if(browser.exitCode===null)browser.kill();}
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(evidence,'BROWSER_SMOKE.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
