import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {cities,seedDay,initialState,ensureDay,reconcileLines,mapsForStop,mapsForLeg,previewOperations,segments} from '../public/BD/O/izleti/andaluzija-poi.mjs';
import {makeStateHandler,namespace} from '../functions/andaluzija-state.mjs';
import {tripActor,tripCookie,makeTripAuth} from '../functions/lib/andaluzija-access.mjs';
import {sessionCookie} from '../functions/lib/mdlxdcc-guide/access.mjs';
import {MemoryBlobs,server,memory,TEST_PASSWORD} from './andaluzija-local-server.mjs';
const results=[];const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{results.push({name,status:'PASS'});console.log('PASS '+name);},e=>{results.push({name,status:'FAIL',error:e.message});throw e;});
await check('catalogue / stable IDs / invalid draft / Maps every stop and leg',()=>{
 assert.equal(Object.keys(cities).length,10);
 for(const city of Object.keys(cities)){
  const d=seedDay(city,2);assert.equal(new Set([d.entry,...d.stops].map(p=>p.id)).size,d.stops.length+1);
  for(const p of [d.entry,...d.stops]){const m=mapsForStop(p);assert.equal(new URL(m.place).searchParams.get('query'),p.location.query);assert.equal(new URL(m.walk).searchParams.get('travelmode'),'walking');assert.equal(new URL(m.walk).searchParams.get('origin'),null);}
  const route=[d.entry,...d.stops,d.entry];for(let i=1;i<route.length;i++){const u=new URL(mapsForLeg(route[i-1],route[i]));assert.equal(u.searchParams.get('origin'),route[i-1].location.query);assert.equal(u.searchParams.get('destination'),route[i].location.query);}
 }
 const d=seedDay('malaga',0),newText=d.stops.map((p,i)=>i===0?'Teatro · Málaga čšž':p.name).join('\n');const renamed=reconcileLines(d.stops,newText,'malaga');assert.equal(renamed[0].id,d.stops[0].id);assert.equal(renamed[0].location.status,'unresolved');
 const state=initialState();ensureDay(state,'gpt',0,'malaga');const original=JSON.stringify(state);assert.throws(()=>previewOperations(state,[{type:'setBreak',variant:'gpt',day:0,city:'malaga',minutes:-1}],0));assert.equal(JSON.stringify(state),original);
 state.days['gpt:0:malaga'].stops.forEach(p=>p.enabled=true);state.days['gpt:0:malaga'].stops[1].fixedTime='11:30';assert.equal(segments(state.days['gpt:0:malaga']).length,2);
 assert.throws(()=>previewOperations(state,[{type:'reorder',variant:'gpt',day:0,city:'malaga',ids:d.stops.map(p=>p.id).reverse()}],0));
});
await check('directed matrix: each stop once / fixed START / independent full cost',async()=>{
 const ctx=vm.createContext({performance,setTimeout,clearTimeout,console});ctx.globalThis=ctx;for(const f of ['air-distance.js','deep-search.js'])vm.runInContext(await readFile('public/Trip/new/'+f,'utf8'),ctx);
 const r=vm.runInContext('(()=>{const D=[[0,7,9,2],[3,0,1,8],[6,4,0,3],[1,5,2,0]],points=[0,1,2,3].map(i=>({id:String(i),lat:36+i/100,lon:-4})),job=TripDeepSearch.create({points,distanceMatrix:D,startIdx:2,roundTrip:true},{workLimit:1000});while(!job.step(5)){}const s=job.snapshot(),ids=s.pointsSorted.map(p=>Number(p.id));return {ids,cost:s.totalCost,sum:ids.reduce((n,id,i)=>n+D[id][ids[(i+1)%ids.length]],0)};})()',ctx);
 assert.equal(r.ids[0],2);assert.equal(new Set(r.ids).size,4);assert.equal(r.cost,r.sum);
});
let envelope;
await check('8zShield v4 roundtrip / wrong password / no plaintext marker',async()=>{
 const value={kind:'sections',schema:'synthetic-test',marker:'SYNTHETIC_PRIVATE_MARKER'};envelope=await ShieldCore.seal(value,[TEST_PASSWORD],{domain:'www.mdlxdcc.org'});
 assert.deepEqual(await ShieldCore.openEnvelope(envelope,TEST_PASSWORD),value);await assert.rejects(()=>ShieldCore.openEnvelope(envelope,'wrong-test-password'));assert(!JSON.stringify(envelope).includes(value.marker));
});
await check('server auth: anonymous / Guide visitor / wrong password / cross-origin',async()=>{
 const req=(cookie='')=>new Request('https://www.mdlxdcc.org/.netlify/functions/andaluzija-state',{headers:{cookie}});
 const handler=makeStateHandler({openStore:async()=>new MemoryBlobs()});assert.equal((await handler(req())).status,401);
 const visitor=sessionCookie({id:'visitor',email:'visitor@example.invalid',role:'visitor'}).split(';')[0];assert.equal(tripActor(req(visitor)),null);assert.equal((await handler(req(visitor))).status,401);
 const dedicated=tripCookie().split(';')[0];assert(tripActor(req(dedicated)));
 const auth=makeTripAuth({verify:async()=>false});assert.equal((await auth(new Request('https://www.mdlxdcc.org/auth',{method:'POST',headers:{origin:'https://www.mdlxdcc.org','Content-Type':'application/json'},body:JSON.stringify({action:'login',password:'wrong'})}))).status,401);
 assert.equal((await handler(new Request('https://www.mdlxdcc.org/state',{headers:{origin:'https://other.invalid'}}))).status,403);
});
await check('atomic CAS / idempotency / bounded history / preview isolation',async()=>{
 const mem=new MemoryBlobs(),h=makeStateHandler({actor:()=>({id:'synthetic'}),openStore:async()=>mem});
 const put=(id,base,etag,snapshot=envelope)=>h(new Request('https://www.mdlxdcc.org/state',{method:'PUT',headers:{origin:'https://www.mdlxdcc.org','Content-Type':'application/json','If-Match':etag},body:JSON.stringify({requestId:id,baseRevision:base,snapshot})}));
 let r=await put('synthetic-first',0,'"0"');assert.equal(r.status,200);const etag=r.headers.get('etag');
 const race=await Promise.all([put('synthetic-race-a',1,etag),put('synthetic-race-b',1,etag)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(mem.data.revision,2);
 const repeat=await put('synthetic-first',0,'"0"');const body=await repeat.json();assert.equal(body.acceptedRevision,1);assert(body.duplicate);assert.equal(mem.data.revision,2);
 assert.equal((await put('synthetic-first',0,'"0"',{...envelope,data:envelope.data+'AAAA'})).status,409);
 for(let i=0;i<35;i++)assert.equal((await put('synthetic-bounded-'+i,mem.data.revision,mem.etag)).status,200);
 assert.equal(mem.data.history.length,3);assert.equal(mem.data.receipts.length,32);
 assert.notEqual(namespace({deploy:{context:'production'}}),namespace({deploy:{context:'deploy-preview',id:'abc'}}));
});
await check('invalid worker matrix rejected before any result',async()=>{
 const messages=[];const ctx=vm.createContext({postMessage:m=>messages.push(m),setTimeout,clearTimeout,performance,console});ctx.globalThis=ctx;
 ctx.importScripts=(...paths)=>{for(const path of paths)vm.runInContext(requireSource(path),ctx);};
 const sources={};for(const name of ['air-distance.js','deep-search.js'])sources[name]=await readFile('public/Trip/new/'+name,'utf8');function requireSource(path){return sources[path.split('/').at(-1)];}
 vm.runInContext(await readFile('public/BD/O/izleti/andaluzija-worker.js','utf8'),ctx);
 vm.runInContext('onmessage({data:{type:"start",points:[{lat:1,lon:1},{lat:2,lon:2}],distanceMatrix:[[0,-1],[2,0]]}})',ctx);assert.equal(messages[0].type,'failed');
});
const {chromium}=createRequire(import.meta.url)('playwright');
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.ANDALUZIJA_TEST_CHROMIUM||'/tmp/chromium',args:['--no-sandbox']});
const contexts=[],errors=[];let pageA,pageB;
async function page(){const c=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(c);await c.route('https://**/*',r=>r.abort());const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/BD/O/izleti/andaluzija-2027.html');return p;}
async function login(p,password=TEST_PASSWORD){await p.locator('#poi-password').fill(password);await p.locator('#poi-login button').click();await p.waitForFunction(()=>!document.getElementById('poi-lines').disabled);}
try{
 await check('browser: three variants / map / gallery / desktop / 402px',async()=>{
  pageA=await page();assert.equal(await pageA.locator('.variant-card').count(),3);assert.equal(await pageA.locator('.day-card').count(),10);assert.equal(await pageA.locator('#photo-gallery button').count(),21);
  await pageA.locator('[data-map-view="scheme"]').click();assert.equal(await pageA.locator('.city-node').count(),11);
  await pageA.evaluate(()=>window.scrollTo({top:document.getElementById('najini-ogledi').getBoundingClientRect().top+scrollY-150,behavior:'instant'}));await pageA.screenshot({path:'../evidence/planner-desktop.png'});
  await pageA.setViewportSize({width:402,height:874});await pageA.evaluate(()=>window.scrollTo({top:document.getElementById('najini-ogledi').getBoundingClientRect().top+scrollY-140,behavior:'instant'}));assert(await pageA.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await pageA.screenshot({path:'../evidence/planner-402.png'});await pageA.setViewportSize({width:1440,height:1100});
  await pageA.locator('#font-plus').click();assert.equal(await pageA.locator('#font-reset').textContent(),'110%');await pageA.locator('#font-reset').click();
 });
 await check('browser: login / private unlock / bounded assistant context',async()=>{
  await login(pageA);await pageA.waitForFunction(()=>document.getElementById('potrjeno').textContent.includes('SYNTHETIC_PRIVATE_MARKER'));
  const context=await pageA.evaluate(()=>AndaluzijaTripOptiV1.getContext());assert(!JSON.stringify(context).includes('SYNTHETIC_PRIVATE_MARKER'));assert(!('preferences' in await pageA.evaluate(()=>AndaluzijaTripOptiV1.getState())));
 });
 await check('browser: edit -> preview -> apply -> save -> second isolated context',async()=>{
  await pageA.locator('#poi-lines').fill('Teatro Romano · Calle Alcazabilla\nAlcazaba · vhod Calle Alcazabilla\nCatedral de Málaga · Plaza del Obispo\nMuelle Uno');await pageA.locator('#poi-save').click();await pageA.waitForFunction(()=>document.getElementById('poi-status').dataset.state==='saved');
  const original=await pageA.evaluate(()=>AndaluzijaTripOptiV1.getState()),key='gpt:0:malaga',ids=original.days[key].stops.map(p=>p.id).reverse();
  const result=await pageA.evaluate(({ids,revision})=>{const op={type:'reorder',variant:'gpt',day:0,city:'malaga',ids};const preview=AndaluzijaTripOptiV1.previewChanges([op],revision);return {preview,before:AndaluzijaTripOptiV1.getState().days['gpt:0:malaga'].stops.map(p=>p.id)};},{ids,revision:original.revision});assert.equal(result.preview.status,'preview');assert.deepEqual(result.preview.diff[0].orderAfter,ids);assert.notDeepEqual(result.before,ids);
  await pageA.evaluate(async({ids,revision})=>{const ops=[{type:'reorder',variant:'gpt',day:0,city:'malaga',ids}];await AndaluzijaTripOptiV1.applyChanges(ops,revision,'synthetic-ui-request');await AndaluzijaTripOptiV1.applyChanges(ops,revision,'synthetic-ui-request');return AndaluzijaTripOptiV1.save();},{ids,revision:original.revision});
  pageB=await page();await login(pageB);const second=await pageB.evaluate(()=>AndaluzijaTripOptiV1.getState());assert.deepEqual(second.days[key].stops.map(p=>p.id),ids);
  const links=await pageB.locator('#poi-stops .poi-maps a').evaluateAll(a=>a.map(x=>x.href));assert(links.every(x=>new URL(x).searchParams.get('api')==='1'));
 });
 await check('browser: concurrent edits preserve both drafts and block unsafe undo',async()=>{
  await pageA.evaluate(async()=>{const a=AndaluzijaTripOptiV1,s=a.getState();await a.applyChanges([{type:'setBreak',variant:'gpt',day:0,city:'malaga',minutes:55}],s.revision,'synthetic-concurrent-a');await a.save();});
  await pageB.evaluate(async()=>{const a=AndaluzijaTripOptiV1,s=a.getState();await a.applyChanges([{type:'setBreak',variant:'gpt',day:0,city:'malaga',minutes:65}],s.revision,'synthetic-concurrent-b');try{await a.save();}catch{}});
  assert.equal(await pageB.locator('#poi-status').getAttribute('data-state'),'conflict');assert.equal(await pageB.evaluate(()=>AndaluzijaTripOptiV1.getState().days['gpt:0:malaga'].breakMin),65);
  assert.equal(memory.data.revision,await pageA.evaluate(()=>AndaluzijaTripOptiV1.getState().revision));assert.equal(await pageB.evaluate(async()=>{try{await AndaluzijaTripOptiV1.undoLastOwnChange();return false;}catch{return true;}}),true);
  await pageB.locator('#poi-use-remote').click();await pageB.waitForFunction(()=>document.getElementById('poi-status').dataset.state==='synced');assert.equal(await pageB.evaluate(()=>AndaluzijaTripOptiV1.getState().days['gpt:0:malaga'].breakMin),55);
 });
 await check('browser: offline encrypted draft / reconnect / lock and restore privacy',async()=>{
  await pageB.locator('.poi-settings > summary').click();
  await pageB.context().setOffline(true);
  // Manual edit is possible offline; server save reports offline and retains ciphertext.
  await pageB.locator('#poi-breaks').fill('75');await pageB.locator('#poi-breaks').dispatchEvent('change');await pageB.waitForTimeout(650);await pageB.locator('#poi-save').click();await pageB.waitForFunction(()=>document.getElementById('poi-status').dataset.state==='offline');
  const local=await pageB.evaluate(()=>localStorage.getItem('andaluzija-encrypted-draft-v1'));assert(local?.includes('8ZShield'));assert(!local.includes('SYNTHETIC_PRIVATE_MARKER'));assert(!local.includes('Teatro Romano'));
  await pageB.context().setOffline(false);await pageB.evaluate(async()=>{await AndaluzijaTripOptiV1.sync();await AndaluzijaTripOptiV1.save();});
  await pageB.locator('#poi-lock').click();assert(!await pageB.locator('body').textContent().then(x=>x.includes('SYNTHETIC_PRIVATE_MARKER')));assert(await pageB.locator('#poi-lines').isDisabled());
  await pageB.reload();assert(!await pageB.locator('body').textContent().then(x=>x.includes('SYNTHETIC_PRIVATE_MARKER')));await login(pageB);
 });
 await check('browser: real DeepSearch worker / cost / start / preview only / cancellation',async()=>{
  await pageB.evaluate(async()=>{const a=AndaluzijaTripOptiV1,s=a.getState();await a.applyChanges(s.days['gpt:0:malaga'].stops.map(p=>({type:'patchStop',variant:'gpt',day:0,city:'malaga',id:p.id,patch:{enabled:true}})),s.revision,'synthetic-enable-for-worker');await a.save();});
  const before=await pageB.evaluate(()=>AndaluzijaTripOptiV1.getState());
  const p=await pageB.evaluate(()=>AndaluzijaTripOptiV1.optimizeDay({mode:'estimate'}));assert.equal(p.status,'preview');assert.equal(p.receipt.startId,'malaga-entry');assert.equal(p.receipt.exact,false);assert.equal(new Set(p.ids).size,p.ids.length);
  const state=await pageB.evaluate(()=>AndaluzijaTripOptiV1.getState());assert.deepEqual(state.days['gpt:0:malaga'].stops,before.days['gpt:0:malaga'].stops);
  const d=state.days['gpt:0:malaga'],byId=new Map([d.entry,...d.stops].map(x=>[x.id,x]));const route=[d.entry,...p.ids.map(id=>byId.get(id)).filter(x=>x.enabled),d.entry];
  const rad=Math.PI/180;let total=0;for(let i=1;i<route.length;i++){const a=route[i-1].location,b=route[i].location,h=Math.sin((b.lat-a.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;total+=2*6371008.8*Math.asin(Math.sqrt(h));}assert(Math.abs(p.metrics.meters-total)<0.01);
  const cancelled=await pageB.evaluate(async()=>{const promise=AndaluzijaTripOptiV1.optimizeDay({mode:'estimate'});setTimeout(()=>AndaluzijaTripOptiV1.cancelOptimization(),100);try{await promise;return false;}catch{return true;}});assert(cancelled);
  assert.deepEqual(await pageB.evaluate(()=>AndaluzijaTripOptiV1.getState().days['gpt:0:malaga'].stops),d.stops);
 });
 assert.deepEqual(errors,[]);results.push({name:'browser console / page errors',status:'PASS'});
}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile('../evidence/targeted-tests.json',JSON.stringify({status:results.every(x=>x.status==='PASS')?'PASS':'FAIL',scope:'isolated in-memory storage and synthetic auth; no provider or production calls',results},null,2));}
console.log('TARGETED_ACCEPTANCE_PASS '+results.length);
