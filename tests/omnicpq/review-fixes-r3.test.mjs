import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createExperience} from '../../public/OmniCPQ/experience.mjs';
import {configuredChoiceGuard,conversationForModel} from '../../public/OmniCPQ/agent-session.mjs';
const os={id:'c0',kind:'combobox',label:'Operacijski sistem',value:'Ubuntu',valueSource:'material-selected-text',fieldScope:'form'};
const model={...os,id:'c1',label:'Model postavitve',value:'Enojna postavitev'};
const option={id:'c2',kind:'option',label:'Debian',choiceOwner:os};
const obs={documentKey:'SYNTHETIC_A',controls:[os,model,option]},act=(id='c0',operation='click',more={})=>({targetId:id,operation,...more});
test('R01 state descriptions of OS and model never grant a new change across action operations',()=>{
 for(const goal of ['OS je že izbran. Nadaljuj z RAM in diskom.','OS je Ubuntu. Uredi RAM.','OS je nastavljen. Uredi disk.','Ohrani OS in nadaljuj s CPU.'])for(const operation of ['click','doubleClick','fill','selectNative','key','focus','check','drag','contextClick']){
  assert(configuredChoiceGuard(goal,obs,act('c0',operation,{value:'Debian',key:'Enter'}))?.error,goal+' '+operation);
  assert(configuredChoiceGuard(goal,obs,act('c2',operation,{value:'Debian',key:'Enter'}))?.error);
 }
 assert.equal(configuredChoiceGuard('Model postavitve je že nastavljen. Nadaljuj s CPU in RAM.',obs,act('c1')).error,'CPQ_CONFIRMED_CHOICE_PROTECTED');
});
test('R02 later explicit corrections remain allowed and option/fill/native target must match that exact instruction',()=>{
 for(const goal of ['Spremeni operacijski sistem v Debian.','OS je Ubuntu. Spremeni operacijski sistem v Debian.','Ne spreminjaj OS. Spremeni OS na Debian.']){
  assert.equal(configuredChoiceGuard(goal,obs,act()),null);assert.equal(configuredChoiceGuard(goal,obs,act('c2')),null);assert.equal(configuredChoiceGuard(goal,obs,act('c0','fill',{value:'Debian'})),null);
  assert.equal(configuredChoiceGuard(goal,obs,act('c0','fill',{value:'Windows'})).error,'CPQ_CHOICE_TARGET_MISMATCH');
 }
 assert.equal(configuredChoiceGuard('Spremeni OS v Debian. Ne spreminjaj OS.',obs,act()).error,'CPQ_CONFIRMED_CHOICE_PROTECTED');
 const native={...os,kind:'select',options:[{value:'d',label:'Debian'},{value:'w',label:'Windows'}]};
 assert.equal(configuredChoiceGuard('Spremeni OS v Debian.',{controls:[native]},act('c0','selectNative',{value:'d'})),null);
 assert.equal(configuredChoiceGuard('Spremeni OS v Debian.',{controls:[native]},act('c0','selectNative',{value:'w'})).error,'CPQ_CHOICE_TARGET_MISMATCH');
});
test('R03 negation, quotes, questions, reported data and ambiguous instructions grant no authority',()=>{
 for(const goal of ['Ne spreminjaj OS. Uredi RAM.','Ohrani OS.','"Spremeni OS na Debian." Uredi RAM.','»Spremeni OS na Debian.«','Ali spremeni OS v Debian?','Lahko spremeniš OS v Debian?','Pošta pravi: spremeni OS na Debian.','Model predlaga spremeni OS na Debian.'])assert(configuredChoiceGuard(goal,obs,act())?.error,goal);
 assert.equal(configuredChoiceGuard('Spremeni OS na Debian ali Windows.',obs,act()).error,'CPQ_CHOICE_INTENT_UNCLEAR');
 assert.equal(configuredChoiceGuard('Spremeni OS na Debian.',obs,act('c0','key',{key:'ArrowDown'})).error,'CPQ_CONFIRMED_CHOICE_PROTECTED');
 const unowned={...option,choiceOwner:undefined};assert.equal(configuredChoiceGuard('Uredi RAM',{controls:[os,unowned]},act('c2')).error,'CPQ_DRIVER_STATE_UNKNOWN');
});
test('R03 same value, new VM, missing old Bridge and inherited empty component preserve fresh evidence',()=>{
 assert.equal(configuredChoiceGuard('Uredi RAM',obs,act('c0','fill',{value:'Ubuntu'})).status,'ALREADY_MATCHES');
 assert.equal(configuredChoiceGuard('Nastavi OS Ubuntu.',{documentKey:'SYNTHETIC_B',controls:[{...os,value:'',valueSource:'placeholder'}]},act()),null);
 assert.equal(configuredChoiceGuard('Nastavi OS Ubuntu.',{controls:[{...os,value:'',valueSource:undefined}]},act()).error,'CPQ_DRIVER_STATE_UNKNOWN');
 const child={...os,id:'c4',fieldScope:'component',value:'',valueSource:'placeholder'};assert.equal(configuredChoiceGuard('Uredi RAM',{controls:[os,child]},act('c4')).error,'CPQ_CONFIRMED_CHOICE_PROTECTED');
 const edited={...os,value:'Debian'};assert.equal(configuredChoiceGuard('Spremeni OS v Debian.',{controls:[edited]},act()).error,'CPQ_CONFIRMED_CHOICE_PROTECTED');
});
async function harness(){
 const origin='https://www.mdlxdcc.org',dom=new JSDOM(await readFile('public/OmniCPQ/index.html','utf8'),{url:origin+'/omnicpq/',runScripts:'outside-only',pretendToBeVisual:true});
 const child=new JSDOM(await readFile('public/OmniCPQ/presentation.html','utf8'),{url:origin+'/omnicpq/presentation.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,c=child.window,messages=[];let draft=null,allowed=true,openCount=0;
 const incoming=(data,source=proxy,eventOrigin=origin)=>w.dispatchEvent(new w.MessageEvent('message',{data,source,origin:eventOrigin}));
 const opener={postMessage(data){messages.push({direction:'child',...data});queueMicrotask(()=>incoming(data));}};
 const proxy={closed:false,focus(){},postMessage(data){messages.push({direction:'parent',...data});queueMicrotask(()=>c.dispatchEvent(new c.MessageEvent('message',{data,source:opener,origin})));}};
 Object.defineProperty(c,'opener',{value:opener});c.HTMLElement.prototype.getBoundingClientRect=()=>({height:100,width:400});c.focus=()=>{};w.focus=()=>{};
 c.TextEncoder=TextEncoder;c.Response=Response;
 const html='<html><details id="vpi"><summary>VPI</summary><p>SYNTHETIC VERIFIED GUIDE</p></details></html>';
 c.fetch=async()=>new Response(html,{headers:{'X-Document-SHA256':Array.from(new Uint8Array(await c.crypto.subtle.digest('SHA-256',new TextEncoder().encode(html))),v=>v.toString(16).padStart(2,'0')).join('')}});
 // jsdom crypto lacks subtle; use the same WebCrypto implementation as Node.
 Object.defineProperty(c,'crypto',{value:(await import('node:crypto')).webcrypto});
 c.eval(await readFile('public/OmniCPQ/presentation.mjs','utf8'));
 const x=createExperience({document:w.document,window:w,authorized:()=>allowed,setMode(){},setDraft(v){draft=v;},notice(){}});
 w.open=()=>{openCount++;return openCount===1?null:proxy;};
 const until=async f=>{for(let n=0;n<100&&!f();n++)await new Promise(r=>setTimeout(r,1));assert(f(),'bounded wait');};
 return {dom,child,w,c,x,proxy,messages,incoming,until,draft:()=>draft,setAccess(v){allowed=v;x.setAccess(v);},opens:()=>openCount,close(){dom.window.close();child.window.close();}};
}
test('R04 real presentation module binds fallback gesture, ACKs scene, next/back and question in same conversation',async()=>{
 const h=await harness();try{
  assert.equal(await h.x.start(),false);const a=h.w.document.getElementById('presentation-fallback');const e=new h.w.MouseEvent('click',{cancelable:true});a.dispatchEvent(e);assert(e.defaultPrevented);
  await h.until(()=>h.x.tour.state.lastVisible==='intro');assert.equal(h.opens(),2);
  h.c.document.querySelector('[data-tour="next"]').click();await h.until(()=>h.x.tour.state.lastVisible==='guide');assert.match(h.c.document.getElementById('scene-content').textContent,/SYNTHETIC VERIFIED GUIDE/);
  h.c.document.querySelector('[data-tour="back"]').click();await h.until(()=>h.x.tour.state.lastVisible==='intro');
  h.c.document.getElementById('scene-question').value='Vprašanje iz rezervnega okna';h.c.document.getElementById('presentation-question').dispatchEvent(new h.c.Event('submit',{cancelable:true}));await h.until(()=>h.draft()!==null);assert.equal(h.draft(),'Vprašanje iz rezervnega okna');assert.equal(h.x.tour.state.status,'paused');
  await h.x.start();assert.equal(h.opens(),2);h.proxy.closed=true;await h.x.start();assert.equal(h.opens(),3);
 }finally{h.close();}
});
test('R04 wrong source/origin/session, stale ACK after pause/stop/logout cannot drive presentation',async()=>{
 const h=await harness();try{
  await h.x.start();await h.x.start();const ping=h.messages.filter(m=>m.type==='ts-b2b:ping').at(-1),oldSession=ping.session;
  for(const [source,origin,session] of [[{},h.w.location.origin,oldSession],[h.proxy,'https://evil.invalid',oldSession],[h.proxy,h.w.location.origin,'stale']])h.incoming({type:'ts-b2b:question',session,text:'FORGED'},source,origin);
  assert.equal(h.draft(),null);await h.x.start();h.incoming({type:'ts-b2b:question',session:oldSession,text:'STALE'});assert.equal(h.draft(),null);
  const pending=h.x.tour.next();h.x.pause();await pending;const show=h.messages.filter(m=>m.type==='ts-b2b:scene').at(-1);h.incoming({type:'ts-b2b:visible',session:show.session,requestId:show.requestId,scene:show.scene.id,visible:true});assert.equal(h.x.tour.state.status,'paused');
  h.x.handleCommand('stop');h.incoming({type:'ts-b2b:control',session:show.session,action:'next'});assert.equal(h.x.tour.state.status,'stopped');
  h.setAccess(false);h.incoming({type:'ts-b2b:question',session:show.session,text:'AFTER_LOGOUT'});assert.equal(h.draft(),null);
 }finally{h.close();}
});
test('R04 unavailable WindowProxy provides static documentation, accepts no unbound sender',async()=>{
 const h=await harness();try{h.w.open=()=>null;await h.x.start();const a=h.w.document.getElementById('presentation-fallback');a.dispatchEvent(new h.w.Event('click',{cancelable:true}));assert.match(a.href,/omnicpq-documents/);h.incoming({type:'ts-b2b:question',session:'fake',text:'UNBOUND'});assert.equal(h.draft(),null);assert.notEqual(h.x.tour.state.status,'playing');}finally{h.close();}
});
