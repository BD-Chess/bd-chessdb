import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createExperience} from '../../public/OmniCPQ/experience.mjs';
const INDEX='public/OmniCPQ/index.html';
const CARD='Kartica storitve ni potrjeno vidna. Preveri dostop do zasebne dokumentacije v oknu.';
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
async function fixture({autoReady=true,autoVisible=false,blocked=false}={}){
 const dom=new JSDOM(await readFile(INDEX,'utf8'),{url:'https://www.mdlxdcc.org/omnicpq/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id);
 let network=0,allowed=true,visibility='visible',id=0;const jobs=new Map(),messages=[],drafts=[],modes=[];
 Object.defineProperty(w.document,'visibilityState',{get:()=>visibility,configurable:true});
 w.setTimeout=(fn,ms)=>{const k=++id;jobs.set(k,{fn,ms});return k;};w.clearTimeout=k=>jobs.delete(k);
 w.fetch=()=>{network++;throw Error('SYNTHETIC_NETWORK_FORBIDDEN');};
 const popup={closed:false,focus(){},postMessage(m){messages.push(m);if(m.type==='ts-b2b:ping'&&autoReady)queueMicrotask(()=>emit({type:'ts-b2b:ready',session:m.session,requestId:m.requestId}));if(m.type==='ts-b2b:scene'&&autoVisible!==null)queueMicrotask(()=>ack(m,autoVisible));}};
 function emit(data,{origin=w.location.origin,source=popup}={}){w.dispatchEvent(new w.MessageEvent('message',{origin,source,data}));}
 function ack(m,visible,change={},envelope={}){emit({type:'ts-b2b:visible',session:m.session,requestId:m.requestId,scene:m.scene.id,visible,...change},envelope);}
 w.focus=()=>{};w.open=()=>blocked?null:popup;
 const setNotice=text=>{$('notice').textContent=text;$('notice').hidden=!text;};
 const api=createExperience({document:w.document,window:w,authorized:()=>allowed,setMode:m=>modes.push(m),setDraft:s=>drafts.push(s),notice:setNotice});
 return {api,$,w,popup,messages,drafts,modes,ack,emit,setNotice,get network(){return network;},last:type=>messages.filter(m=>m.type==='ts-b2b:'+type).at(-1),setAutoVisible:v=>autoVisible=v,setAllowed:v=>allowed=v,setVisibility:v=>{visibility=v;w.document.dispatchEvent(new w.Event('visibilitychange'));},async expire(){for(const [k,j]of [...jobs]){jobs.delete(k);j.fn();}await flush();},close(){assert.equal(network,0,'synthetic fixture must never fetch private guide or provider');api.setAccess(false);dom.window.close();}};
}

test('AUDIT_NOTICE delayed visible acknowledgment after pause cannot erase later unrelated notice',async()=>{
 const h=await fixture();try{
  await h.api.openService(); assert.equal(h.$('notice').textContent,CARD);
  h.setAutoVisible(null); const p=h.api.openService(); await flush(); const old=h.last('scene');
  h.api.pause(); h.setNotice('SYNTHETIC_NEW_NOTICE'); h.ack(old,true); await p; await flush();
  assert.equal(h.$('notice').textContent,'SYNTHETIC_NEW_NOTICE');
 }finally{h.close();}
});
test('AUDIT_NOTICE non-boolean visible claim does not clear warning',async()=>{
 const h=await fixture();try{
  await h.api.openService(); assert.equal(h.$('notice').textContent,CARD);
  h.setAutoVisible(null); const p=h.api.openService(); await flush(); const msg=h.last('scene');
  h.ack(msg,'true'); await p; assert.equal(h.$('notice').textContent,CARD);
 }finally{h.close();}
});
test('AUDIT_NOTICE old service acknowledgment after tour starts cannot clear warning',async()=>{
 const h=await fixture();try{
  await h.api.openService(); assert.equal(h.$('notice').textContent,CARD);
  h.setAutoVisible(null); const p=h.api.openService(); await flush(); const old=h.last('scene');
  h.setAutoVisible(true); const t=h.api.start(); await t; await p; h.ack(old,true); await flush();
  assert.equal(h.$('notice').textContent,CARD); assert.equal(h.api.tour.state.status,'playing');
 }finally{h.close();}
});
