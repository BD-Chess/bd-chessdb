import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {orientation,validateAlbum,mountAlbum} from '../public/shared/dualframe-album.mjs';

const base = new URL('../public/BD/O/izleti/assets/andaluzija-2027/dualframe/', import.meta.url);
const album = JSON.parse(await readFile(new URL('album.json', base), 'utf8'));
const pageURL = 'https://www.mdlxdcc.org/BD/O/izleti/andaluzija-2027.html';
function fixture(width = 1280, height = 800) {
  const dom = new JSDOM('<section><div id="album"></div></section><button id="outside">Outside</button>', {url:pageURL,pretendToBeVisual:true});
  const w = dom.window, d = w.document;
  w.innerWidth = width; w.innerHeight = height;
  w.HTMLDialogElement.prototype.showModal = function(){this.open = true;};
  w.HTMLDialogElement.prototype.close = function(){this.open = false;this.dispatchEvent(new w.Event('close'));};
  const api = mountAlbum(d.getElementById('album'), album, new URL('./assets/andaluzija-2027/dualframe/album.json', pageURL));
  const click = selector => d.querySelector(selector).click();
  const key = value => d.querySelector('dialog').dispatchEvent(new w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
  return {dom,w,d,api,click,key,root:d.getElementById('album')};
}
test('complete 21 pairs, correct orientations, matching file hashes and preserved originals', async()=>{
  validateAlbum(album); assert.equal(album.items.length,21);
  for(const item of album.items){
    assert(item.note.includes('AI')); assert(item.thumbnailP);
    for(const frame of ['L','P']){
      const v=item.variants[frame],bytes=await readFile(new URL(v.src,base));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
      assert.equal(bytes.toString('ascii',8,12),'WEBP');
      assert.equal(v.width>v.height,frame==='L');
      assert.match(v.source_sha256,/^[a-f0-9]{64}$/);
    }
    await readFile(new URL(item.original,base));
    for(const n of [item.thumbnail,item.thumbnailP]) assert((await readFile(new URL(n,base))).length>1000);
  }
});
test('AUTO, manual frames and invalid catalogue checks',()=>{
  assert.equal(orientation('AUTO',402,874),'P');assert.equal(orientation('AUTO',874,402),'L');
  assert.equal(orientation('L',402,874),'L');assert.equal(orientation('P',1280,800),'P');
  const invalid=structuredClone(album);delete invalid.items[0].variants.P;assert.throws(()=>validateAlbum(invalid));
  const duplicate=structuredClone(album);duplicate.items[1].id=duplicate.items[0].id;assert.throws(()=>validateAlbum(duplicate));
});
test('open, next/previous, wrap, Home/End, download and original follow the selected photo',()=>{
  const f=fixture();try{
    f.click('[data-df-index="7"]');const dialog=f.d.querySelector('dialog');assert(dialog.open);
    assert.equal(f.d.querySelector('[data-df-count]').textContent,'8 / 21 · L');
    f.key('ArrowRight');assert(f.d.querySelector('[data-df-title]').textContent.includes('Belo mestno'));
    f.key('Home');f.key('ArrowLeft');assert.equal(f.d.querySelector('[data-df-count]').textContent,'21 / 21 · L');
    f.key('End');f.key('ArrowRight');assert.equal(f.d.querySelector('[data-df-count]').textContent,'1 / 21 · L');
    assert.match(f.d.querySelector('[data-df-original]').href,/nerja-panorama\.webp$/);
    assert.match(f.d.querySelector('[data-df-download]').href,/01-nerja-panorama-L\.webp$/);
    f.click('[data-df-close]');assert(!dialog.open);assert.equal(f.d.activeElement.dataset.dfIndex,'7');
    assert(!f.d.body.classList.contains('df-album-open'));
  }finally{f.dom.window.close();}
});
test('402px rotation preserves the photo; manual L/P survives rotation',()=>{
  const f=fixture(402,874);try{
    f.click('[data-df-index="3"]');assert.equal(f.d.querySelector('[data-df-count]').textContent,'4 / 21 · P');
    f.w.innerWidth=874;f.w.innerHeight=402;f.w.dispatchEvent(new f.w.Event('resize'));
    assert.equal(f.d.querySelector('[data-df-count]').textContent,'4 / 21 · L');
    f.api.setMode('P');assert.match(f.d.querySelector('[data-df-image]').src,/-P\.webp$/);
    f.w.innerWidth=402;f.w.innerHeight=874;f.w.dispatchEvent(new f.w.Event('resize'));assert.equal(f.root.dataset.orientation,'P');
    f.api.setMode('L');assert.match(f.d.querySelector('[data-df-image]').src,/-L\.webp$/);
    assert.equal(f.root.querySelectorAll('[loading="lazy"]').length,21);
  }finally{f.dom.window.close();}
});
test('slideshow advances after image load, pauses on close and does not run in background',async()=>{
  const f=fixture();try{
    let scheduled=null,cancelled=0;
    f.w.setTimeout=(fn,ms)=>{scheduled={fn,ms};return 1;};f.w.clearTimeout=()=>{scheduled=null;cancelled++;};
    f.click('[data-df-open]');f.click('[data-df-play]');assert.equal(scheduled.ms,5000);
    scheduled.fn();assert.equal(f.d.querySelector('[data-df-count]').textContent,'2 / 21 · L');
    f.d.querySelector('[data-df-image]').dispatchEvent(new f.w.Event('load'));assert.equal(scheduled.ms,5000);
    Object.defineProperty(f.d,'hidden',{value:true,configurable:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(scheduled,null);
    f.api.close();assert.equal(scheduled,null);assert(cancelled>0);assert.equal(f.d.querySelector('[data-df-play]').getAttribute('aria-pressed'),'false');
  }finally{f.dom.window.close();}
});
test('fullscreen fallback and double click can return to the album; a failed image stops the slideshow',async()=>{
  const f=fixture();try{
    f.click('[data-df-open]');f.click('[data-df-full]');await Promise.resolve();
    assert(f.d.querySelector('.df-album-viewer').classList.contains('is-immersive'));
    f.d.querySelector('[data-df-image]').dispatchEvent(new f.w.MouseEvent('dblclick',{bubbles:true,cancelable:true}));await Promise.resolve();
    assert(!f.d.querySelector('.df-album-viewer').classList.contains('is-immersive'));
    f.click('[data-df-play]');f.d.querySelector('[data-df-image]').dispatchEvent(new f.w.Event('error'));
    assert.equal(f.d.querySelector('[data-df-play]').getAttribute('aria-pressed'),'false');assert(f.d.querySelector('[data-df-status]').textContent.includes('izvirnik'));
  }finally{f.dom.window.close();}
});
test('touch swipe and double tap; selects keep their own keyboard navigation',async()=>{
  const f=fixture(402,874);try{
    f.click('[data-df-open]');const stage=f.d.querySelector('.df-viewer-stage');
    const touch=(type,x,y)=>{const e=new f.w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,type==='touchstart'?'touches':'changedTouches',{value:[{clientX:x,clientY:y}]});stage.dispatchEvent(e);};
    touch('touchstart',300,200);touch('touchend',100,205);assert.equal(f.d.querySelector('[data-df-count]').textContent,'2 / 21 · P');
    touch('touchstart',100,200);touch('touchend',110,350);assert.equal(f.d.querySelector('[data-df-count]').textContent,'2 / 21 · P');
    touch('touchstart',100,200);touch('touchend',100,200);touch('touchstart',100,200);touch('touchend',100,200);await Promise.resolve();assert(f.d.querySelector('.df-album-viewer').classList.contains('is-immersive'));
    f.d.querySelector('select').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(f.d.querySelector('[data-df-count]').textContent,'2 / 21 · P');
  }finally{f.dom.window.close();}
});
test('embedded module rejects external assets and inserts captions as text',()=>{
  const f=fixture();try{
    const external=structuredClone(album);external.items[0].variants.P.src='https://example.invalid/image.webp';assert.throws(()=>mountAlbum(f.root,external,new URL('./assets/dualframe/album.json',pageURL)));
    assert.equal(f.root.querySelectorAll('button').length,21);assert(!f.d.querySelector('script'));
  }finally{f.dom.window.close();}
});
test('photo-only view delays the place name until two seconds after load and resets on navigation/exit',async()=>{
  const f=fixture();try{
    let now=0,id=0;const pending=new Map();
    f.w.setTimeout=(fn,ms)=>{pending.set(++id,{fn,at:now+ms});return id;};
    f.w.clearTimeout=id=>pending.delete(id);
    const advance=ms=>{now+=ms;for(const [key,t] of [...pending])if(t.at<=now){pending.delete(key);t.fn();}};
    f.click('[data-df-open]');
    const image=f.d.querySelector('[data-df-image]'),caption=f.d.querySelector('[data-df-photo-caption]');
    const double=()=>image.dispatchEvent(new f.w.MouseEvent('dblclick',{bubbles:true,cancelable:true}));
    double();await Promise.resolve();
    assert(f.d.querySelector('dialog').classList.contains('is-photo-full'));
    assert(f.d.querySelector('.df-viewer-controls').inert);
    advance(5000);assert(caption.hidden,'no title while image is loading');
    image.dispatchEvent(new f.w.Event('load'));
    advance(1999);assert(caption.hidden);advance(1);assert(!caption.hidden);
    assert.equal(caption.textContent,album.items[0].title);
    f.key('ArrowRight');assert(caption.hidden);advance(3000);assert(caption.hidden);
    image.dispatchEvent(new f.w.Event('load'));advance(2000);assert(!caption.hidden);
    assert.equal(caption.textContent,album.items[1].title);
    double();await Promise.resolve();assert(caption.hidden);
    assert(!f.d.querySelector('dialog').classList.contains('is-photo-full'));
    assert(!f.d.querySelector('.df-viewer-controls').inert);
    double();await Promise.resolve();advance(1999);assert(caption.hidden);advance(1);assert(!caption.hidden);
    f.api.close();advance(3000);assert(caption.hidden);assert.equal(pending.size,0);
  }finally{f.dom.window.close();}
});
test('native fullscreen exit and synthesized double click after touch do not reopen the photo',async()=>{
  const f=fixture();try{
    const viewer=f.d.querySelector('.df-album-viewer'),stage=f.d.querySelector('.df-viewer-stage');
    Object.defineProperty(f.d,'fullscreenElement',{value:null,writable:true,configurable:true});
    viewer.requestFullscreen=async()=>{f.d.fullscreenElement=viewer;f.d.dispatchEvent(new f.w.Event('fullscreenchange'));};
    f.d.exitFullscreen=async()=>{f.d.fullscreenElement=null;f.d.dispatchEvent(new f.w.Event('fullscreenchange'));};
    const touch=type=>{const e=new f.w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,type==='touchstart'?'touches':'changedTouches',{value:[{clientX:100,clientY:200}]});stage.dispatchEvent(e);};
    const double=()=>{touch('touchstart');touch('touchend');touch('touchstart');touch('touchend');};
    f.click('[data-df-open]');double();await Promise.resolve();assert.equal(f.d.fullscreenElement,viewer);
    stage.dispatchEvent(new f.w.MouseEvent('dblclick',{bubbles:true,cancelable:true}));await Promise.resolve();assert.equal(f.d.fullscreenElement,viewer);
    double();await Promise.resolve();await Promise.resolve();assert.equal(f.d.fullscreenElement,null);assert(!viewer.classList.contains('is-immersive'));
    f.click('[data-df-full]');await Promise.resolve();await f.d.exitFullscreen();assert(!viewer.classList.contains('is-immersive'));
  }finally{f.dom.window.close();}
});
test('locked page and content-refresh integration retain the album without changing Shield',async()=>{
  const html=await readFile('public/BD/O/izleti/andaluzija-2027.html','utf8'),js=await readFile('public/BD/O/izleti/andaluzija-2027.js','utf8');
  assert(html.includes('Spoznaj DualFrame Photos'));assert(html.includes('data-dualframe-album'));
  assert(html.includes('id="potrjeno" class="section private-placeholder"'));
  assert(js.includes("if(!$('photo-gallery').dataset.dualframeReady)"));
  const secret=await readFile('public/BD/O/izleti/andaluzija-private.8zs.json');assert.equal(createHash('sha256').update(secret).digest('hex'),'873c812e4182bcc8e2633e805f1e0ae62665965a40b3f16e927542663616afaa');
  assert(!JSON.stringify(album).includes('drive.google.com'));
  const dom=new JSDOM(html,{url:pageURL,runScripts:'outside-only',pretendToBeVisual:true});
  try {
    const w=dom.window;w.IntersectionObserver=class{observe(){} disconnect(){}};
    w.eval(await readFile('public/BD/O/izleti/andaluzija-2027-data.js','utf8'));w.eval(js);
    const root=w.document.getElementById('photo-gallery');
    mountAlbum(root,album,new URL('./assets/andaluzija-2027/dualframe/album.json',pageURL));
    for(const detail of [{data:JSON.parse(JSON.stringify(w.ANDALUZIJA)),preferences:{}},null]){
      w.dispatchEvent(new w.CustomEvent('andaluzija-content',{detail}));
      assert.equal(root.querySelectorAll('[data-df-index]').length,21);
      assert.equal(w.document.querySelectorAll('.df-album-toolbar').length,1);
      assert.equal(w.document.querySelectorAll('.variant-card').length,3);
    }
  }finally{dom.window.close();}
});
