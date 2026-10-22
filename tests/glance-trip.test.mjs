import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {parseGlance,isPublicTripDemo} from '../public/assets/mdlxdcc-guide/routes.mjs';
import {publicPath} from '../functions/lib/mdlxdcc-guide/runtime.mjs';
import {cities,makeStop,mapsForStop,mapsForLeg} from '../public/BD/O/izleti/andaluzija-poi.mjs';
import {mountAlbum} from '../public/shared/dualframe-album.mjs';
const require=createRequire(import.meta.url),ShieldCore=require('../public/BD/O/izleti/andaluzija-shield-core.js');
const read=p=>fs.readFile(new URL('../'+p,import.meta.url),'utf8');
const base='https://www.mdlxdcc.org/BD/O/izleti/andaluzija-2027.html?demo=glance';
test('seven exact routes, help and modifiers; private path remains blocked',async()=>{
 const manifest=JSON.parse(await read('public/assets/mdlxdcc-guide/tour.json'));
 assert.equal(Object.keys(manifest.tours).length,7);
 for(const tour of Object.values(manifest.tours)){assert(parseGlance(tour.command));for(const id of tour.scenes)assert(manifest.scenes[id]);}
 assert.equal(parseGlance('GLANCE TRIP silence').key,'trip');assert(parseGlance('help glance').help);
 for(const bad of ['glance main','glance trip next','glance trip\nstop','"glance trip"','glance unknown'])assert.equal(parseGlance(bad),null);
 assert(isPublicTripDemo(base));assert(isPublicTripDemo('https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027?demo=glance&lang=en'));
 for(const path of [base.replace('?demo=glance',''),base+'&plan=gpt',base+'&demo=glance',base.replace('glance','owner')])assert(!isPublicTripDemo(path));
 assert.throws(()=>publicPath(base));assert.throws(()=>publicPath('/BD/O/izleti/andaluzija-private.8zs.json'));
 assert(!manifest.tours.ai8.scenes.includes('mal'));assert.equal(manifest.mal_reconciliation.status,'PROTECTED_SOURCE_EXCLUDED');
 assert.equal(manifest.tours.main.scenes.filter(x=>x==='andaluzija').length,1);
 assert.equal(manifest.tours.it.scenes.filter(x=>x.startsWith('trip-')).length,3);
});
const sources=Object.fromEntries(await Promise.all(['air-distance.js','deep-search.js'].map(async n=>[n,await read('public/Trip/new/'+n)])));
const workerSource=await read('public/BD/O/izleti/andaluzija-worker.js');
class RealEngineWorker {
 constructor(){
  this.timers=new Set();const schedule=(fn,ms)=>{const id=setTimeout(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);return id;};
  this.ctx=vm.createContext({performance,setTimeout:schedule,clearTimeout,console,postMessage:m=>this.onmessage?.({data:m})});this.ctx.globalThis=this.ctx;
  this.ctx.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(sources[p.split('/').at(-1)],this.ctx));vm.runInContext(workerSource,this.ctx);
 }
 postMessage(data){setTimeout(()=>{this.ctx.data=data;vm.runInContext('onmessage({data})',this.ctx);},0);}
 terminate(){for(const id of this.timers)clearTimeout(id);}
}
for(const width of [1440,402])test('isolated demo, real engine, Maps, album and Shield at '+width+' px',async()=>{
 const dom=new JSDOM('<!doctype html><body><main>owner shell</main></body>',{url:base,pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window;
 Object.defineProperty(w,'innerWidth',{value:width});Object.defineProperty(w,'innerHeight',{value:874});
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.structuredClone=structuredClone;w.ShieldCore=ShieldCore;w.Worker=RealEngineWorker;
 w.localStorage.setItem('real-owner-sentinel','keep');let storageReads=0;
 const originalGet=w.Storage.prototype.getItem;w.Storage.prototype.getItem=function(k){storageReads++;return originalGet.call(this,k);};
 const network=[];w.fetch=async input=>{
  const u=new URL(input);network.push(u.pathname);
  if(u.pathname.endsWith('/album.json'))return Response.json(JSON.parse(await read('public/BD/O/izleti/assets/andaluzija-2027/dualframe/album.json')));
  if(u.pathname.endsWith('/andaluzija-demo.8zs.json'))return Response.json(JSON.parse(await read('public/BD/O/izleti/andaluzija-demo.8zs.json')));
  throw Error('Forbidden demo request: '+u.pathname);
 };
 w.eval(sources['air-distance.js']);
 const source=(await read('public/BD/O/izleti/andaluzija-demo.mjs')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://www.mdlxdcc.org/BD/O/izleti/andaluzija-demo.mjs'));
 w.__deps={cities,makeStop,mapsForStop,mapsForLeg,mountAlbum};
 await w.eval('(async()=>{const {cities,makeStop,mapsForStop,mapsForLeg,mountAlbum}=window.__deps;'+source+'})()');
 const d=w.document,api=w.AndaluzijaGlanceDemo;
 assert.equal(d.body.dataset.demoReady,'true');assert.equal(storageReads,0);
 assert.equal(w.ANDALUZIJA,undefined);assert.equal(w.AndaluzijaTripOptiV1,undefined);
 await assert.rejects(()=>api.save(),/DEMO_CLOUD_WRITE_DISABLED/);
 await api.show('before');assert.equal(api.getReceipt(),null);
 await api.show('optimize');const r=api.getReceipt();assert.equal(r.algorithm,'Classical DeepSearch');
 assert.equal(r.matrix.length,6);assert(r.matrix.every(row=>row.length===6&&row.every(v=>Number.isFinite(v)&&v>=0)));
 assert.equal(new Set(r.order).size,6);assert.equal(r.order[0],'malaga-entry');
 let cost=0;for(let i=0;i<r.order.length;i++)cost+=r.matrix[r.pointIds.indexOf(r.order[i])][r.pointIds.indexOf(r.order[(i+1)%r.order.length])];
 assert(Math.abs(cost-r.afterMeters)<1e-6);assert(r.afterMeters<=r.beforeMeters);
 assert.equal(d.querySelectorAll('#demo-after li').length,5);
 const links=[...d.querySelectorAll('#demo-maps a')].map(a=>new URL(a.href));assert.equal(links.length,12);
 assert(links.every(u=>u.hostname==='www.google.com'&&u.searchParams.get('api')==='1'));
 assert.equal(links.filter(u=>u.pathname==='/maps/dir/'&&u.searchParams.get('travelmode')==='walking'&&u.searchParams.has('origin')&&u.searchParams.has('destination')).length,6);
 assert.equal(d.querySelectorAll('[data-df-index]').length,21);
 d.querySelector('[data-df-index="0"]').click();assert(d.querySelector('dialog').open);
 d.querySelector('dialog [data-df-mode="P"]').click();assert(d.querySelector('[data-df-image]').src.endsWith('-P.webp'));
 d.querySelector('dialog [data-df-mode="L"]').click();assert(d.querySelector('[data-df-image]').src.endsWith('-L.webp'));
 d.querySelector('[data-df-full]').click();assert.equal(d.querySelector('[data-df-full]').getAttribute('aria-pressed'),'true');
 d.querySelector('[data-df-close]').click();assert(!d.querySelector('dialog').open);
 await api.show('shield');assert(d.getElementById('demo-secret').textContent.includes('DEMO-ONLY'));
 d.getElementById('demo-lock').click();assert(!d.getElementById('demo-secret').textContent.includes('DEMO-ONLY'));
 d.getElementById('demo-password').value='wrong';d.getElementById('demo-unlock').click();
 await new Promise(resolve=>setTimeout(resolve,300));assert(!d.getElementById('demo-secret').textContent.includes('DEMO-ONLY'));
 assert.equal(storageReads,0);assert.equal(originalGet.call(w.localStorage,'real-owner-sentinel'),'keep');
 assert(network.every(p=>p.endsWith('/album.json')||p.endsWith('/andaluzija-demo.8zs.json')));
 const publicFiles=['andaluzija-demo.mjs','andaluzija-demo.8zs.json','andaluzija-entry.mjs'];
 for(const name of publicFiles)assert(!(await read('public/BD/O/izleti/'+name)).includes('DEMO-42'));
 dom.window.close();
});
