const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function installHarness({standalone=false,userAgent='Mozilla/5.0 Windows NT 10.0 Edg/155.0.0.0'}={}) {
  const nodes=new Map(),events=new EventTarget();
  const node=id=>{if(!nodes.has(id)){const n=new EventTarget();n.getAttribute=()=>null;nodes.set(id,n);}return nodes.get(id);};
  const window={addEventListener:events.addEventListener.bind(events),matchMedia:()=>({matches:standalone})};
  const document={baseURI:'https://example.test/bd-chessdb/chess-lab/',getElementById:node,body:{classList:{contains:()=>true}},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../../tools/chess-pwa/lab-pwa.js'),'utf8'),{window,document,navigator:{onLine:true,userAgent},URL});
  return {node,events};
}
test('LAB install offer remains usable in an app window when this manifest is not installed',async()=>{
  const h=installHarness({standalone:true});let prompts=0;
  const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{prompts++;};e.userChoice=Promise.resolve({outcome:'dismissed'});
  h.events.dispatchEvent(e);
  assert(e.defaultPrevented);
  assert.equal(h.node('chessPwaInstall').hidden,false,'a browser install offer outranks display-mode inference');
  assert.equal(h.node('appPwaInstall').hidden,false);
  h.node('chessPwaInstall').dispatchEvent(new Event('click'));await new Promise(r=>setImmediate(r));
  assert.equal(prompts,1);assert.equal(h.node('chessPwaInstall').hidden,false,'dismissal must not be mistaken for installation');
});
test('confirmed LAB installation hides both buttons even while the original browser tab remains open',()=>{
  const h=installHarness();h.events.dispatchEvent(new Event('appinstalled'));
  assert.equal(h.node('chessPwaInstall').hidden,true);assert.equal(h.node('appPwaInstall').hidden,true);
  const e=new Event('beforeinstallprompt',{cancelable:true});h.events.dispatchEvent(e);
  assert.equal(h.node('chessPwaInstall').hidden,false,'a new offer after uninstall is authoritative');
});
test('Edge install help points to the actual Apps submenu and keeps Safari help separate',()=>{
  const edge=installHarness();edge.node('chessPwaInstall').dispatchEvent(new Event('click'));
  assert.match(edge.node('chessPwaHint').textContent,/More tools.*Apps.*Install this site as an app/);
  const ios=installHarness({userAgent:'iPhone Safari'});ios.node('appPwaInstall').dispatchEvent(new Event('click'));
  assert.match(ios.node('appPwaHint').textContent,/Safari.*Share.*Add to Home Screen/);
});
test('P1 PWA waits for a verified save at activation and again before controller-change reload',async()=>{
  const nodes=new Map(),events=new EventTarget(),worker=new EventTarget();let saved=false,messages=0,reloads=0;
  const node=id=>{if(!nodes.has(id)){const n=new EventTarget();n.getAttribute=()=>null;nodes.set(id,n);}return nodes.get(id);};
  const registration={waiting:{postMessage(){messages++;}},addEventListener(){}};
  worker.controller={scriptURL:'https://example.test/chess-lab/engine-sw.js'};worker.register=async()=>registration;
  const window={addEventListener:events.addEventListener.bind(events),matchMedia:()=>({matches:false}),ChessLabHost:{saveBeforeUpdate:()=>saved},location:{reload(){reloads++;}}};
  const document={baseURI:'https://example.test/chess-lab/',getElementById:node,body:{classList:{contains:()=>false}},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../../tools/chess-pwa/lab-pwa.js'),'utf8'),{window,document,navigator:{serviceWorker:worker,onLine:true},URL});
  events.dispatchEvent(new Event('load'));await new Promise(resolve=>setImmediate(resolve));
  node('chessPwaUpdate').dispatchEvent(new Event('click'));assert.equal(messages,0);
  saved=true;node('chessPwaUpdate').dispatchEvent(new Event('click'));assert.equal(messages,1);
  saved=false;worker.dispatchEvent(new Event('controllerchange'));assert.equal(reloads,0);
  saved=true;worker.dispatchEvent(new Event('controllerchange'));assert.equal(reloads,1);
});
