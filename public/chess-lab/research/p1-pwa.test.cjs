const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
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
