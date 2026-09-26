'use strict';
// DOM integration with real computation in worker_threads. This does not test
// layout, Safari Worker policies, touch input or downloaded-file browser UI.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {Worker:Thread}=require('node:worker_threads');
const {JSDOM,VirtualConsole}=require('jsdom');
const LANE=process.env.SUDOKU_APP_LANE||'LAB';
assert.ok(['LAB','PWA'].includes(LANE),'SUDOKU_APP_LANE must be LAB or PWA');
const appSegment=LANE==='PWA'?'PWA':'new';
const appPath=path.resolve(__dirname,`../public/S/${appSegment}/app.html`);
const NS='ai8SudokuNavigatorV020'+(LANE==='PWA'?'PWA':'');
const fixture='530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const fixtureSolution='534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message,ms=10000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await sleep(10);}assert.ok(fn(),message);}
const plain=x=>JSON.parse(JSON.stringify(x));
function valid(grid,givens){const b=grid.flat(),p=givens.flat();assert.equal(b.length,81);for(let i=0;i<81;i++)if(p[i])assert.equal(b[i],p[i],'givens retained');for(let k=0;k<9;k++){const row=b.slice(k*9,k*9+9),col=Array.from({length:9},(_,i)=>b[i*9+k]),box=Array.from({length:9},(_,i)=>b[(Math.floor(k/3)*3+Math.floor(i/3))*9+(k%3)*3+i%3]);for(const u of [row,col,box])assert.deepEqual(u.slice().sort(),[1,2,3,4,5,6,7,8,9]);}}
async function boot(t,stored={},viewport){
 const errors=[],requests=[],workers=new Set(),urls=new Map(),downloads=[],delayKinds={},resultKinds={},delayedTimers=new Set();let nextUrl=0;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(appPath,'utf8'),{url:`https://mdlxDcc.org/S/${appSegment}/app.html`,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 if(viewport){w.innerWidth=viewport.width;w.innerHeight=viewport.height;}
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 w.alert=s=>errors.push('alert: '+s);w.confirm=()=>true;
 w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLElement.prototype.scrollTo=function(){};
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;},set(v){this.textContent=String(v);},configurable:true});
 w.Blob=class{constructor(parts,opts){this.source=parts.map(x=>typeof x==='string'?x:String(x)).join('');this.size=Buffer.byteLength(this.source);this.type=opts?.type||'';}async text(){return this.source;}};
 w.URL.createObjectURL=blob=>{const key='blob:test-'+(++nextUrl);urls.set(key,blob.source);return key;};w.URL.revokeObjectURL=key=>urls.delete(key);
 w.HTMLAnchorElement.prototype.click=function(){if(this.download)downloads.push({name:this.download,text:urls.get(this.href)});};
 w.Worker=class{
  constructor(url){const source=urls.get(url);assert.equal(typeof source,'string','worker must use actual Blob source');const wrapper=`const {parentPort,workerData}=require('node:worker_threads');const vm=require('node:vm');const sandbox={console,performance,TextEncoder,TextDecoder,Uint8Array,Uint16Array,Uint32Array,Int32Array,ArrayBuffer,DataView,setTimeout,clearTimeout,structuredClone,crypto:require('node:crypto').webcrypto};sandbox.self=sandbox;sandbox.globalThis=sandbox;sandbox.postMessage=m=>parentPort.postMessage(m);vm.createContext(sandbox);vm.runInContext(workerData,sandbox);parentPort.on('message',data=>sandbox.onmessage({data}));`;this.thread=new Thread(wrapper,{eval:true,workerData:source});workers.add(this);this.thread.on('message',data=>{if(resultKinds[this.kind])data=resultKinds[this.kind](data);const delay=delayKinds[this.kind]||0;if(delay){const timer=setTimeout(()=>{delayedTimers.delete(timer);if(!this.stopped)this.onmessage?.({data});},delay);delayedTimers.add(timer);}else this.onmessage?.({data});});this.thread.on('error',e=>{errors.push(e.message);this.onerror?.({message:e.message});});}
  postMessage(data){this.kind=data.kind;requests.push(plain(data));this.thread.postMessage(plain(data));}
  terminate(){this.stopped=true;workers.delete(this);return this.thread.terminate();}
 };
 for(const[k,v]of Object.entries(stored))w.localStorage.setItem(k,v);
 for(const script of w.document.querySelectorAll('script')){assert.ok(!script.src,'app stays self contained');if(!script.type||/javascript/.test(script.type))vm.runInContext(script.textContent,dom.getInternalVMContext());}
 assert.ok(w.SudokuNavigator,'Navigator installed');
 t.after(async()=>{for(const timer of delayedTimers)clearTimeout(timer);for(const wk of workers)await wk.terminate();w.close();});
 return{w,errors,requests,downloads,delayKinds,resultKinds,el:id=>w.document.getElementById(id),get:expression=>plain(w.eval(expression)),store:()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return[k,w.localStorage.getItem(k)];}))};
}
function savedFixture(version){return{schema:'AI8_SUDOKU_NAV_SESSION_V1',version,gameId:'legacy-shape-fixture',diff:'easy',puzzle:[...fixture].map(Number),board:[...fixture].map(Number),notes:Array.from({length:81},()=>[]),time:37,lineage:{base:[...fixture].map(Number),ops:[]},rows:[],assistance:[],recentGains:[],practice:null,history:[],settings:{policy:'REAL',goal:'FLOW',target:1,deep:false}};}

module.exports={boot,savedFixture,fixture,fixtureSolution,sleep,until,plain,valid,NS,LANE};
