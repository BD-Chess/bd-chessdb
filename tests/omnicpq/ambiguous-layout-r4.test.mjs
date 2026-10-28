import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {webcrypto} from 'node:crypto';
import {cpqPageV2} from '../../public/OmniCPQ/extension/page-v2.mjs';
test('inherited pointer layout cannot become an ambiguous action; concrete children remain available',async()=>{
 const dom=new JSDOM('<div style="cursor:pointer"><div><h3>Add item</h3><button aria-label="Add item">+</button></div><div><h3>Change product</h3><button aria-label="Change product">+</button></div><div role="button" aria-label="Real card">Card</div></div>',{url:'https://cpq-stg.apps.test-ocp.ts.telekom.si/sl/order/details/view/11111111-1111-4111-8111-111111111111/items',runScripts:'outside-only',pretendToBeVisual:true});
 try{
  const w=dom.window;Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;w.CSS={escape:s=>String(s)};
  w.HTMLElement.prototype.getBoundingClientRect=function(){return {x:10,y:10,left:10,top:10,right:210,bottom:50,width:200,height:40};};
  Object.defineProperty(w.document.body,'innerText',{get(){return this.textContent;}});
  const r=await w.eval('('+cpqPageV2.toString()+')')({type:'observe',scope:'order',origin:w.location.origin});
  assert.equal(r.ok,true);const c=r.observation.controls;
  assert(!c.some(x=>x.kind==='control'&&x.label.includes('Add item')&&x.label.includes('Change product')));
  for(const label of ['Add item','Change product','Real card'])assert(c.some(x=>x.label===label),label);
 }finally{dom.window.close();}
});
