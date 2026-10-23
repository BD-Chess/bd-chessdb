import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {cpqPage} from '../../public/OmniCPQ/extension/page.mjs';

const origin='https://cpq-stg.apps.test-ocp.ts.telekom.si';
// Structural reproduction of the observed Material stepper; no customer content.
function fixture({save='disabled',route='/sl/order/details/view/synthetic/info'}={}) {
  const dom=new JSDOM(`<nav><a href="/sl/order">Naročila</a></nav>
    <div role="tablist" class="mat-horizontal-stepper-header-container">
      <mat-step-header role="tab" aria-selected="true"><div class="mat-step-icon"><mat-icon role="img" aria-hidden="true">format_list_bulleted</mat-icon></div><div class="mat-step-text-label">Podatki</div></mat-step-header>
      <mat-step-header id="items" role="tab" aria-selected="false"><div class="mat-step-icon"><span class="cdk-visually-hidden">Editable</span><mat-icon role="img" aria-hidden="true">create</mat-icon></div><div class="mat-step-text-label">Postavke</div></mat-step-header>
      <mat-step-header role="tab" aria-selected="false"><mat-icon aria-hidden="true">topic</mat-icon><div class="mat-step-text-label">Generiranje</div></mat-step-header>
    </div><main><p>Podatki testnega naročila</p></main>
    <button id="save" type="button" ${save==='disabled'?'disabled':save==='aria'?'aria-disabled="true"':save==='fieldset'?'form="disabled-form"':''}><mat-icon role="img" aria-hidden="true">save</mat-icon></button>
    <input type="password" aria-label="Geslo" value="NEVER_READ_PASSWORD">`,{url:origin+route,runScripts:'outside-only'});
  let digestHook;const w=dom.window;
  Object.defineProperty(w,'crypto',{value:{randomUUID:()=>webcrypto.randomUUID(),subtle:{digest:async(...args)=>{const value=await webcrypto.subtle.digest(...args);digestHook?.();return value;}}}});w.TextEncoder=TextEncoder;
  w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{width:10,height:10}];};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
  let clicks=0;w.document.getElementById('items').addEventListener('click',()=>{clicks++;w.document.querySelector('main').innerHTML='<h1>Postavke</h1>';});
  const page=w.eval('('+cpqPage.toString()+')');
  return {w,page,setDigestHook:hook=>{digestHook=hook;},close:()=>w.close(),clicks:()=>clicks,observe:async()=>{const r=await page({type:'observe',origin,scope:'order'});assert(r.ok);return r.observation;}};
}
test('observed Material step labels survive decorative icons and a disabled save does not lock a saved order',async()=>{
  const f=fixture();try{
    const o=await f.observe();assert.equal(o.navigationLocked,false);
    assert.deepEqual(Array.from(o.controls).filter(c=>c.kind==='tab').map(c=>c.label),['Podatki','Postavke','Generiranje']);
    assert(!JSON.stringify(o).includes('NEVER_READ_PASSWORD'));
    const t=o.controls.find(c=>c.label==='Postavke');assert(t);
    const result=await f.page({type:'navigate',origin,scope:'order',action:{schema:'omnicpq.navigation.v1',revision:o.revision,observationId:o.id,targetId:t.id}});
    assert.equal(result.receipt.outcome,'CLICK_DISPATCHED');assert.equal(f.clicks(),1);
    assert.match((await f.observe()).text,/Postavke/);
  }finally{f.close();}
});
test('aria-disabled and native fieldset-disabled save controls do not lock; enabling an icon-only save does',async()=>{
  const f=fixture({save:'aria'});try{
    assert.equal((await f.observe()).navigationLocked,false);
    f.w.document.getElementById('save').removeAttribute('aria-disabled');
    assert.equal((await f.observe()).navigationLocked,true);
    const fieldset=f.w.document.createElement('fieldset');fieldset.disabled=true;f.w.document.body.append(fieldset);fieldset.append(f.w.document.getElementById('save'));
    assert.equal((await f.observe()).navigationLocked,false);
  }finally{f.close();}
});
test('active configurator and enabled confirmation retain the editor departure lock and never offer save/confirm',async()=>{
  const f=fixture({route:'/sl/order/details/view/synthetic/items/item/configure'});try{
    let o=await f.observe();assert.equal(o.navigationLocked,true);assert(!o.controls.some(c=>['tab','link','view'].includes(c.kind)));
    f.w.history.replaceState(null,'','/sl/order/details/view/synthetic/info');
    f.w.document.body.insertAdjacentHTML('beforeend','<button type="button">Potrdi</button>');
    o=await f.observe();assert.equal(o.navigationLocked,true);assert(!o.controls.some(c=>/Shrani|Potrdi|save/i.test(c.label)));
  }finally{f.close();}
});
test('an observed tab becomes unclickable when a save action is enabled or the target is disabled before dispatch',async()=>{
  const f=fixture();try{
    const o=await f.observe(),target=o.controls.find(c=>c.label==='Postavke');assert(target);
    f.w.document.getElementById('save').disabled=false;
    const action={schema:'omnicpq.navigation.v1',revision:o.revision,targetId:target.id};
    assert.equal((await f.page({type:'navigate',origin,scope:'order',action})).error,'CPQ_SCREEN_CHANGED');assert.equal(f.clicks(),0);
    f.w.document.getElementById('save').disabled=true;
    f.w.document.getElementById('items').setAttribute('aria-disabled','true');
    assert.equal((await f.page({type:'navigate',origin,scope:'order',action})).error,'CPQ_SCREEN_CHANGED');assert.equal(f.clicks(),0);
  }finally{f.close();}
});
test('newly enabled saving during the asynchronous revision check blocks departure before the click',async()=>{
  const f=fixture();try{
    const o=await f.observe(),target=o.controls.find(c=>c.label==='Postavke');assert(target);
    f.setDigestHook(()=>{f.w.document.getElementById('save').disabled=false;});
    const result=await f.page({type:'navigate',origin,scope:'order',action:{schema:'omnicpq.navigation.v1',revision:o.revision,targetId:target.id}});
    assert.equal(result.error,'CPQ_SCREEN_CHANGED');assert.equal(f.clicks(),0);
  }finally{f.close();}
});
