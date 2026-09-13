import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import handler from '../functions/gemini.mjs';
import {LAB_VERSION, labOptions, interactionResult} from '../functions/lib/trip-lab-ai.mjs';
const read=n=>readFileSync(new URL('../public/Trip/new/'+n,import.meta.url),'utf8');
const air=vm.createContext({});vm.runInContext(read('air-distance.js'),air);
const A=air.TripAirDistance;
test('great-circle distance handles global geometry, symmetry, poles and antipodes',()=>{
  const q=Math.PI*A.radius/2;
  assert.ok(Math.abs(A.meters({lat:0,lon:0},{lat:0,lon:90})-q)<1e-7);
  assert.ok(Math.abs(A.meters({lat:0,lon:179},{lat:0,lon:-179})-Math.PI*A.radius/90)<1e-6);
  assert.ok(A.meters({lat:90,lon:0},{lat:90,lon:170})<1e-6);
  assert.ok(Math.abs(A.meters({lat:0,lon:0},{lat:0,lon:180})-Math.PI*A.radius)<1e-7);
  assert.equal(A.meters({lat:45,lon:15},{lat:45,lon:15}),0);
  assert.throws(()=>A.meters({lat:91,lon:0},{lat:0,lon:0}),/Invalid/);
  const D=A.matrix([{lat:0,lon:0},{lat:45,lon:45},{lat:-30,lon:100}]);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.equal(D[i][j],D[j][i]);
});
test('Deep Air uses the same great-circle metric as Direct Line and retains START',()=>{
  const result=[];const c=vm.createContext({performance,postMessage:m=>result.push(m),self:{postMessage:m=>result.push(m)}});
  for(const file of ['tsp-metric.js','air-distance.js','brute-force.js','worker.js'])vm.runInContext(read(file),c);
  const points=[{lat:0,lon:179},{lat:0,lon:-179},{lat:1,lon:180},{lat:-1,lon:180}];
  c.self.onmessage({data:{type:'solve',points,startIdx:2,roundTrip:true,profile:'deep',jobId:1}});
  const r=result.at(-1);assert.equal(r.type,'result');assert.equal(r.metric,'direct');assert.equal(r.totalKm,r.directKm);assert.equal(r.pointsSorted[0].lat,1);
  let meters=0;for(let i=0;i<4;i++)meters+=A.meters(r.pointsSorted[i],r.pointsSorted[(i+1)%4]);
  assert.ok(Math.abs(meters/1000-r.totalKm)<1e-6);assert.ok(r.totalKm<1000);
});
globalThis.Netlify={env:{get(){}}};
const req=(language,query)=>new Request('https://www.mdlxdcc.org/.netlify/functions/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:query,query,language,guiVersion:LAB_VERSION})});
const standard={candidates:[{finishReason:'STOP',content:{parts:[{text:'Test response'}]}}]};
function setup(t, fn) {t.mock.method(Netlify.env,'get',k=>k==='GEMINI_API_KEY'?'test-key':undefined);t.mock.method(globalThis,'fetch',fn);}
test('LAB SL enables Search with Slovenian instructions and no native Maps',async t=>{
  setup(t,async(url,opts)=>{const b=JSON.parse(opts.body);assert.match(String(url),/:generateContent$/);assert.deepEqual(b.tools,[{google_search:{}}]);assert.match(b.systemInstruction.parts[0].text,/Respond in Slovenian/);assert.match(b.systemInstruction.parts[0].text,/2–20/);return Response.json(standard);});
  const r=await(await handler(req('sl','Priporoči kosilo v Ljubljani'))).json();assert.equal(r.ok,true);assert.equal(r.mapsEnabled,false);
});
test('English place queries use stateless Maps + Search and expose only final text and safe citations',async t=>{
  setup(t,async(url,opts)=>{const b=JSON.parse(opts.body);assert.match(String(url),/\/interactions$/);assert.equal(b.store,false);assert.deepEqual(b.tools,[{type:'google_maps'},{type:'google_search'}]);return Response.json({status:'completed',steps:[{type:'thought',content:[{type:'text',text:'private'}]},{type:'model_output',content:[{type:'text',text:'Try this restaurant.',annotations:[{type:'place_citation',name:'Cafe',url:'https://maps.google.com/?cid=123'},{type:'url_citation',title:'City',uri:'https://example.org'},{type:'place_citation',name:'bad',url:'javascript:evil()'}]}]}]});});
  const r=await(await handler(req('en','Where can I eat in Ljubljana?'))).json();assert.equal(r.ok,true);assert.equal(r.mapsEnabled,true);assert.equal(r.sources.length,2);assert.equal(r.sources[0].provider,'Google Maps');assert.doesNotMatch(r.text,/private/);
});
test('GUI help never needs Maps; legacy 15-stop version retains its original contract',()=>{
  assert.equal(labOptions({guiVersion:LAB_VERSION,language:'en',query:'How do I use the Trip Editor?'}).maps,false);
  assert.equal(labOptions({guiVersion:'road-matrix-brute15',language:'en',query:'Where can I eat?'}).lab,false);
});
test('429 falls back once per model and reports Search-only fallback honestly',async t=>{
  let count=0;setup(t,async(url,opts)=>{count++;if(count===1)return Response.json({error:{message:'Quota exceeded'}},{status:429});assert.match(String(url),/3.1-flash-lite:generateContent$/);assert.deepEqual(JSON.parse(opts.body).tools,[{google_search:{}}]);return Response.json(standard);});
  const r=await(await handler(req('en','Suggest nearby restaurants'))).json();assert.equal(r.ok,true);assert.equal(r.fallbackUsed,true);assert.equal(r.mapsEnabled,false);assert.equal(count,2);
});
test('incomplete Maps output never applies a partial itinerary; project-wide cap stops fallback',async t=>{
  assert.equal(interactionResult({status:'incomplete',steps:[]}).error,'RESPONSE_TRUNCATED');
  let calls=0;setup(t,async()=>{calls++;return Response.json({error:{message:'Project spending limit reached'}},{status:429});});
  const r=await(await handler(req('en','Suggest hotels nearby'))).json();assert.equal(r.error.code,'PROJECT_USAGE_LIMIT');assert.equal(calls,1);
});
