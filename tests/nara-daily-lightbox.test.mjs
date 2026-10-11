import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const script=fs.readFileSync(path.join(root,'public/Nara/assets/js/nara-daily-lightbox.js'),'utf8');

function fixture({fullscreen=true}={}){
  const nodes=[];
  let focused=null,position=null,scrollCalls=0;
  const rootClasses=new Set();
  const listeners=new Map();
  const dispatch=(map,type,event={})=>{
    for(const listener of map.get(type)||[])listener(event);
  };
  class Node {
    constructor(tag){
      this.tag=tag;this.open=false;this.attrs={};this.listeners=new Map();
      this.children=[];this.isConnected=true;
    }
    append(...children){this.children.push(...children);}
    addEventListener(type,listener){
      if(!this.listeners.has(type))this.listeners.set(type,[]);
      this.listeners.get(type).push(listener);
    }
    fire(type,event={}){dispatch(this.listeners,type,event);}
    setAttribute(k,v){this.attrs[k]=v;}
    hasAttribute(k){return Object.hasOwn(this.attrs,k);}
    focus(){focused=this;}
    showModal(){this.open=true;}
    close(){this.open=false;}
    requestFullscreen(options){
      if(this.tag==='dialog')return Promise.reject(new TypeError('Dialog elements are invalid'));
      assert.equal(this.tag,'div','fullscreen must target non-dialog stage');
      assert.equal(options?.navigationUI,'hide');
      if(!fullscreen)return Promise.reject(new Error('Fullscreen unavailable'));
      document.fullscreenElement=this;
      dispatch(listeners,'fullscreenchange');
      return Promise.resolve();
    }
  }
  const one=new Node('img');one.src='scene1.webp';one.currentSrc='scene1.webp';one.alt='Scene one';
  const two=new Node('img');two.src='scene2.webp';two.currentSrc='scene2.webp';two.alt='Scene two';
  const docBody={append(node){nodes.push(node)}};
  const document={
    body:docBody,fullscreenElement:null,
    documentElement:{classList:{add:x=>rootClasses.add(x),remove:x=>rootClasses.delete(x),contains:x=>rootClasses.has(x)}},
    querySelectorAll:s=>s==='.daily-scene-figure img'?[one,two]:[],
    createElement:tag=>new Node(tag),
    addEventListener:(type,fn)=>{
      if(!listeners.has(type))listeners.set(type,[]);
      listeners.get(type).push(fn);
    },
    exitFullscreen(){this.fullscreenElement=null;dispatch(listeners,'fullscreenchange');return Promise.resolve();}
  };
  const window={scrollX:19,scrollY:720,scrollTo(x,y){position={x,y};scrollCalls++;}};
  vm.runInNewContext(script,{document,window,requestAnimationFrame:cb=>cb()});
  assert.equal(nodes.length,1);
  return {one,two,viewer:nodes[0],document,window,
    get focused(){return focused;},get position(){return position;},get scrollCalls(){return scrollCalls;},
    get locked(){return rootClasses.has('nara-lightbox-open');},
    keyboard:(key)=>{let prevented=false;dispatch(listeners,'keydown',{key,preventDefault(){prevented=true;}});return prevented;}
  };
}

test('desktop click opens full-screen, second click closes without losing scroll or focus',()=>{
  const f=fixture();
  assert.equal(f.one.attrs.role,'button');
  assert.equal(f.one.tabIndex,0);
  f.one.fire('click');
  assert.equal(f.viewer.open,true);
  assert.equal(f.document.fullscreenElement,f.viewer.children[0]);
  assert.equal(f.document.fullscreenElement.tag,'div');
  assert.equal(f.viewer.children[0].children[0].children[0].src,'scene1.webp');
  assert.equal(f.locked,true);
  f.viewer.children[0].children[0].fire('click');
  assert.equal(f.viewer.open,false);
  assert.equal(f.document.fullscreenElement,null);
  assert.equal(f.locked,false);
  assert.equal(f.focused,f.one);
  assert.deepEqual(f.position,{x:19,y:720});
});

test('Escape closes both native fullscreen and the dialog',()=>{
  const f=fixture();
  f.two.fire('click');
  assert.equal(f.keyboard('Escape'),true);
  assert.equal(f.viewer.open,false);
  assert.equal(f.focused,f.two);
  assert.equal(f.scrollCalls,1);
});

test('mobile Safari without Fullscreen API retains a viewport-covering modal with tap to close',()=>{
  const f=fixture({fullscreen:false});
  f.one.fire('click');
  assert.equal(f.viewer.open,true);
  assert.equal(f.document.fullscreenElement,null);
  f.viewer.children[0].children[0].fire('click');
  assert.equal(f.viewer.open,false);
  assert.deepEqual(f.position,{x:19,y:720});
});

test('browser exiting fullscreen also closes viewer; Enter/Space keyboard controls work',()=>{
  const f=fixture();
  let prevented=false;
  f.one.fire('keydown',{key:'Enter',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(f.viewer.open,true);
  f.document.exitFullscreen();
  assert.equal(f.viewer.open,false);
  f.two.fire('keydown',{key:' ',preventDefault(){}});
  assert.equal(f.viewer.open,true);
  f.viewer.children[0].children[1].fire('click');
  assert.equal(f.viewer.open,false);
});

test('CSS and generated pages include dynamic orientation-safe lightbox and shared client',()=>{
  const base=path.join(root,'public/Nara');
  const css=fs.readFileSync(path.join(base,'assets/css/nara-daily.css'),'utf8');
  assert.match(css,/\.nara-daily-lightbox\[open\]/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/\.nara-daily-lightbox-stage:fullscreen/);
  assert.match(css,/object-fit:contain/);
  for(const page of ['Nara-AI-daily.html','Nara-AI-2026-10.html']){
    const html=fs.readFileSync(path.join(base,page),'utf8');
    assert.match(html,/assets\/js\/nara-daily-lightbox\.js\?v=2/);
    assert.match(html,/nara-daily\.css\?v=[^"\s]+-lightbox-r2/);
    assert.ok((html.match(/<figure class="daily-scene-figure">/g)||[]).length>=JSON.parse(fs.readFileSync(path.join(root,'public/Nara/daily/illustrations/2026-10-05.json'))).images.length*2);
  }
  const renderer=fs.readFileSync(path.join(root,'scripts/nara-daily.mjs'),'utf8');
  assert.match(renderer,/nara-daily-lightbox\.js\?v=2/);
});
