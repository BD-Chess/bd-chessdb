import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {bindReaderPreferences,installReaderLayout,ReaderZoom} from '../public/Nara/dualframe-lab/reader-ui.mjs';
import {FIRST_PAGE_PANELS,FIRST_PAGE_OVERVIEW,sourceRect,readingPlace} from '../public/Nara/dualframe-lab/cmarvel-01/first-page.mjs';
const root=new URL('../public/Nara/dualframe-lab/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(new URL('cmarvel-01/manifest.json',root),'utf8'));
const release=JSON.parse(await readFile(new URL('release.json',root),'utf8'));
const edition=JSON.parse(await readFile(new URL(release.cartoons.edition_path,root),'utf8'));
const dimensions=new Map();function collect(v){if(!v||typeof v!=='object')return;if(v.sha256&&v.width_px)dimensions.set(v.sha256,[v.width_px,v.height_px]);for(const x of Object.values(v))collect(x);}collect(manifest);collect(edition);
const wait=async predicate=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('Fixture did not settle');};
function environment(html,url){
 const dom=new JSDOM(html,{url,pretendToBeVisual:true});const w=dom.window,blobs=new Map(),requests=[],draws=[];let counter=0;
 for(const key of ['window','document','localStorage','location','navigator','Image','HTMLElement'])Object.defineProperty(globalThis,key,{value:key==='window'?w:w[key],configurable:true,writable:true});
 globalThis.innerWidth=1024;globalThis.innerHeight=900;Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);
 w.requestAnimationFrame=globalThis.requestAnimationFrame;w.ResizeObserver=globalThis.ResizeObserver;
 URL.createObjectURL=blob=>{const id='blob:fixture/'+ ++counter;blobs.set(id,blob);return id;};URL.revokeObjectURL=id=>blobs.delete(id);
 w.HTMLImageElement.prototype.decode=async function(){const blob=blobs.get(this.src);let size;if(blob)size=dimensions.get(hash(Buffer.from(await blob.arrayBuffer())));if(!size)throw Error('Unknown fixture image '+this.src);Object.defineProperty(this,'naturalWidth',{value:size[0],configurable:true});Object.defineProperty(this,'naturalHeight',{value:size[1],configurable:true});};
 w.HTMLCanvasElement.prototype.getContext=function(){return {drawImage(...args){draws.push(args.slice(1));}};};w.HTMLCanvasElement.prototype.toBlob=function(){throw Error('Runtime WebP re-encoding is forbidden');};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');setTimeout(()=>this.dispatchEvent(new w.Event('close')),0);};
 Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 1000;}});Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 600;}});
 globalThis.fetch=async(url,options={})=>{const u=new URL(url),path=u.protocol==='file:'?u:new URL(u.pathname.replace(/^\/Nara\/dualframe-lab\//,''),root);requests.push({url:u.href,cache:options.cache});const bytes=await readFile(path);return new Response(bytes,{status:200});};
 return {dom,w,requests,draws,blobs,click:id=>{const n=w.document.getElementById(id);assert.ok(n,id+' exists');n.click();},close(){w.dispatchEvent(new w.Event('pagehide'));w.close();}};
}
test('CMarvel renders source crops without encoding and retains panel, language, font, zoom and cached artwork',async()=>{
 const env=environment(await readFile(new URL('cmarvel-01/index.html',root),'utf8'),'https://fixture.test/Nara/dualframe-lab/cmarvel-01/');
 try{
  const source=(await readFile(new URL('cmarvel-01/reader.mjs',root),'utf8')).replace(/^import .*;\n/gm,'');
  const run=new (Object.getPrototypeOf(async function(){}).constructor)('FIRST_PAGE_PANELS','FIRST_PAGE_OVERVIEW','sourceRect','readingPlace','bindReaderPreferences','installReaderLayout','ReaderZoom',source);
  await run(FIRST_PAGE_PANELS,FIRST_PAGE_OVERVIEW,sourceRect,readingPlace,bindReaderPreferences,installReaderLayout,ReaderZoom);
  const $=id=>env.w.document.getElementById(id),ready=()=> $('reader').dataset.ready==='true';assert.equal($('reader').dataset.page,'1');assert.equal($('comic-source').width,2812);assert.equal(env.draws.length,1);assert.equal($('reader').dataset.panel,'');
  $('panel-choices').children[2].click();await wait(()=>ready()&&$('reader').dataset.panel==='CM01-P01-K03');assert.equal($('comic-page').hidden,false);
  env.click('landscape');await wait(()=>ready()&&$('comic-page').alt.toLowerCase().includes('kader 3'));env.w.document.querySelector('[data-reader-lang="EN"]').click();assert.match($('panel-position').textContent,/Panel 3/);env.w.document.querySelector('[data-font-step="10"]').click();assert.equal(env.w.document.querySelector('[data-font-reset]').textContent,'110%');
  env.click('zoom');assert.equal($('page-stage').dataset.zoom,'1.25');env.click('source-toggle');await wait(()=>ready()&&$('comic-source').hidden===false);assert.equal($('reader').dataset.panel,'CM01-P01-K03');assert.equal($('comic-source').width,880);
  env.click('source-toggle');await wait(()=>ready()&&$('comic-page').hidden===false);assert.equal($('page-stage').dataset.zoom,'1.25');env.click('overview');await wait(()=>ready()&&$('reader').dataset.panel==='');assert.equal($('reader').dataset.page,'1');assert.equal($('panel-choices').children[2].getAttribute('aria-pressed'),'true');
  const selectedRequests=env.requests.filter(r=>r.url.includes('/CM01-P01-K03-L.webp'));assert.equal(selectedRequests.length,1,'switching through the original must reuse the validated artwork');assert.equal(selectedRequests[0].cache,'force-cache');assert.match(selectedRequests[0].url,/sha256=/);assert.equal(env.requests.filter(r=>r.url.includes('/CM_01.webp')).length,1,'the first source bitmap stays available for repeated crops');assert.ok(env.blobs.size<=4,'decoded bitmap cache stays bounded');
  assert.ok($('page-stage').compareDocumentPosition($('reader-dock'))&env.w.Node.DOCUMENT_POSITION_FOLLOWING,'all navigation follows the artwork');assert.equal(env.w.document.querySelectorAll('input[type=password]').length,0);
 }finally{env.close();}
});
test('Illuminara keeps source/P-L/text state and returns to the current page after a panel boundary',async()=>{
 const env=environment('<div id="cartoons"></div>','https://fixture.test/Nara/dualframe-lab/index.html?product=cartoons');
 try{
  const {createCartoons}=await import('../public/Nara/dualframe-lab/dfc-reader.mjs');const api=createCartoons({container:document.getElementById('cartoons'),getLanguage:()=> 'sl'});await api.activate();await api.open();await wait(()=>document.getElementById('dfc-reader').dataset.ready==='true');
  const $=id=>document.getElementById('dfc-'+id),ready=()=>$('reader').dataset.ready==='true';api.enterPanel('P01-K06');await wait(()=>ready()&&api.getState().panelId==='P01-K06');env.click('dfc-next');await wait(()=>ready()&&api.getState().panelId==='P02-K01');assert.equal($('page').value,'P02');
  env.click('dfc-source');await wait(()=>ready()&&$('panel-image').alt.includes('Izvorni'));assert.match($('source').textContent,/Ilustracija/);env.click('dfc-source');await wait(()=>ready()&&$('panel-image').alt.includes('DualFrame'));
  document.querySelector('[data-reader-orientation="L"]').click();await wait(()=>ready());env.click('dfc-lang-en');await wait(()=>ready()&&api.getState().language==='EN');assert.equal(api.getState().panelId,'P02-K01');
  env.click('dfc-zoom');assert.equal($('panel-stage').dataset.zoom,'1.25');env.click('dfc-fullscreen');assert.equal($('reader').dataset.immersive,'true');env.click('dfc-fullscreen');assert.equal($('reader').dataset.immersive,'false');
  env.click('dfc-overview-button');await wait(()=>ready()&&api.getState().mode==='overview');assert.equal(api.getState().pageId,'P02');assert.equal($('page').value,'P02');assert.ok($('panel-list').querySelector('[aria-pressed="true"]'));
  assert.ok($('overview').compareDocumentPosition($('dock'))&env.w.Node.DOCUMENT_POSITION_FOLLOWING);assert.equal($('reader').querySelectorAll('[data-font-reset]').length,1);assert.equal($('reader').querySelectorAll('[data-reader-lang]').length,2);api.close();
 }finally{env.close();}
});
