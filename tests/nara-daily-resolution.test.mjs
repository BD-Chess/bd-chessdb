import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=fs.readFileSync(path.join(root,'public/Nara/assets/js/nara-daily-resolution.js'),'utf8');
function device(sw,sh,dpr){
  const listeners={};
  const el={attrs:{src:'HD.webp'},dataset:{naraImageHd:'HD.webp',naraImage4k:'4K.webp'},
    getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;}};
  const window={screen:{width:sw,height:sh},devicePixelRatio:dpr,addEventListener(type,fn){listeners[type]=fn;}};
  const document={querySelectorAll(selector){
    assert.equal(selector,'img[data-nara-image-hd][data-nara-image-4k]');
    return [el];}};
  vm.runInNewContext(code,{window,document});
  return {window,el,fire(name){assert.ok(listeners[name]);listeners[name]();}};
}
test('physical pixels select HD or 4K independently of CSS viewport width',()=>{
  for(const [w,h,dpr,expected] of [
    [1920,1080,1,'HD.webp'],[1919,1080,1,'HD.webp'],[1080,1920,1,'HD.webp'],
    [2560,1440,1,'4K.webp'],[1600,900,1.5,'4K.webp'],
    [402,874,3,'4K.webp'],[874,402,3,'4K.webp'],[402,874,1,'HD.webp']
  ]){
    const {el}=device(w,h,dpr);
    assert.equal(el.getAttribute('src'),expected,w+'x'+h+'@'+dpr);
    assert.equal(el.dataset.naraResolution,expected==='4K.webp'?'4k':'hd');
  }
});
test('rotation keeps 4K and a change of physical display selects a single new source',()=>{
  const d=device(402,874,3);
  assert.equal(d.el.attrs.src,'4K.webp');
  d.window.screen.width=874;d.window.screen.height=402;d.fire('orientationchange');
  assert.equal(d.el.attrs.src,'4K.webp');
  d.window.screen.width=1920;d.window.screen.height=1080;d.window.devicePixelRatio=1;d.fire('resize');
  assert.equal(d.el.attrs.src,'HD.webp');
});
test('both pages and generator load selector before reader and lightbox',()=>{
  const n=path.join(root,'public/Nara');
  for(const name of ['Nara-AI-daily.html','Nara-AI-2026-10.html']){
    const html=fs.readFileSync(path.join(n,name),'utf8');
    const selector=html.indexOf('assets/js/nara-daily-resolution.js?v=1');
    const reader=html.indexOf('assets/js/nara-daily-reader.js');
    const lightbox=html.indexOf('assets/js/nara-daily-lightbox.js');
    assert.ok(selector>=0&&reader>selector&&lightbox>reader,name);
    const figures=(html.match(/<figure class="daily-scene-figure">/g)||[]).length;
    if(name==='Nara-AI-daily.html')assert.equal(figures,0,'Daily titles only');
    else assert.ok(figures>=6,'archive preserves the artwork');
  }
  const generator=fs.readFileSync(path.join(root,'scripts/nara-daily.mjs'),'utf8');
  assert.ok(generator.indexOf('nara-daily-resolution.js?v=1')>=0);
});
