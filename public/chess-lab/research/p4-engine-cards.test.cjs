'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {boot}=require('./source-context-integration.test.cjs');
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function fixture(t,{app=false,hold=false}={}){
  const calls=[];
  const h=await boot(t,{skipReady:true,beforeInit(w){
    if(app){w.document.body.classList.add('app-mobile');w.history.replaceState(null,'','?view=app');}
    const make=mode=>{const c={mode,ready:deferred(),search:deferred(),destroyed:false};calls.push(c);if(!hold)c.ready.resolve();
      return {prepare:options=>{c.preparation=options;return c.ready.promise;},analyze(options){c.options=options;options.onSearchStarted?.({timestamp:w.performance.now()});return c.search.promise;},destroy(){c.destroyed=true;}};};
    const create=w.ChessAnalysisSession.create;w.ChessAnalysisSession.create=config=>create({...config,teardownGraceMs:0,adapterFactory:make});
    w.ChessAnalysisSession.backendFor=mode=>({create:()=>make(mode)});
  }});
  const frame=async()=>{await tick();await new Promise(r=>h.w.requestAnimationFrame(r));};await frame();
  const deep=name=>h.w.document.querySelector('[data-deep="'+name+'"]');
  const card=source=>h.w.document.querySelector('[data-eval-source="'+source+'"]');
  const start=async()=>{h.w.document.querySelector(app?'[data-app-tab="deep"]':'button[data-desktop-view="deep"]').click();h.w.ChessAnalysisSession.configure({analysisMode:'all',deepTimeMs:10000,boardSource:'cdb'});deep('start').click();await frame();};
  return {...h,calls,frame,deep,card,start};
}
test('P4 A removes the rejected row/slot; Deep projects its real owner and Stop all never starts Cards',async t=>{
  const x=await fixture(t);await x.start();assert.equal(x.calls.length,4);
  assert.equal(x.w.document.querySelector('#analysisActivity,.analysis-activity-slot'),null);
  const ids=x.w.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep').children.map(c=>c.id);
  for(const view of ['moves','review','dcc','deep']){
    x.w.document.querySelector('button[data-desktop-view="'+view+'"]').click();await x.frame();
    assert.equal(x.card('SF').dataset.analysisOwner,'deep');assert.equal(x.card('SF').classList.contains('is-busy'),true);
    assert.deepEqual(x.w.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep').children.map(c=>c.id),ids);
  }
  assert.equal(x.el('btnAnalyzeAll').dataset.analysisAction,'stop');x.el('btnAnalyzeAll').click();await x.frame();
  assert.equal(x.calls.length,4);assert(x.calls.every(c=>c.destroyed));assert.equal(x.deep('follow').checked,false);
  x.el('btnAnalyzeAll').click();await x.frame();assert.equal(x.calls.length,8);assert.equal(x.el('analysisAllMoves').checked,false);
});
test('P4 A Deep child card explicitly stops its whole group, preserves CDB display and has no nested action',async t=>{
  const x=await fixture(t);await x.start();x.el('analysisLink').checked=true;
  assert.match(x.card('RLE').title,/Stop Deep group/);assert.equal(x.card('RLE').querySelector('button'),null);
  x.card('RLE').click();await x.frame();assert(x.calls.every(c=>c.destroyed));assert.equal(x.calls.length,4);
  assert.equal(x.el('analysisSource').value,'cdb');assert.equal(x.card('RLE').classList.contains('is-busy'),false);
});
test('P4 A a Cards-family touch Stop leaves already-started peers intact and disarms follow',async t=>{
  const x=await fixture(t);x.el('analysisAllMoves').checked=true;x.el('analysisAllMoves').dispatchEvent(new x.w.Event('change'));
  await new Promise(r=>setTimeout(r,130));await x.frame();assert.equal(x.calls.length,4);
  x.card('RLE').dispatchEvent(new x.w.Event('pointerdown'));x.card('RLE').click();await x.frame();
  assert.equal(x.el('analysisAllMoves').checked,false);assert.equal(x.calls.find(c=>c.mode==='reckless').destroyed,true);
  assert(x.calls.filter(c=>c.mode!=='reckless').every(c=>!c.destroyed));
});
test('P4 A preparing Stop is inside existing APP/Settings headers, keeps modal isolation and restores focus',async t=>{
  const x=await fixture(t,{app:true,hold:true});await x.start();
  assert.equal(x.el('appStopAnalysis').parentElement,x.w.document.querySelector('.app-mobile-header'));
  assert.equal(x.el('appStopAnalysis').hidden,false);assert.equal(x.el('appStopAnalysis').disabled,false);
  x.el('appMore').click();x.el('btnSettings').click();await x.frame();
  const b=x.el('settingsStopAnalysis');assert.equal(b.parentElement,x.w.document.querySelector('#settingsPanel .drawer-heading'));
  assert.equal(b.closest('[inert]'),null);b.focus();b.click();await x.frame();assert.equal(x.w.document.activeElement,x.el('btnCloseSettings'));
  for(const c of x.calls)c.ready.resolve();await x.frame();assert(x.calls.every(c=>!c.options));
  x.w.document.activeElement.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(x.el('settingsPanel').classList.contains('open'),false);
});
test('P4 A four card lines use measured search time/typed values and LC0 visits; terminal mode restores the hierarchy',async t=>{
  const x=await fixture(t);await x.start();const board=x.w.ChessLabHost.getContext().fen;
  const sf=x.calls.find(c=>c.mode==='sf-lite'),lc=x.calls.find(c=>c.mode==='lc0');
  sf.options.onInfo({}, {fen:board,linesDepth:21,lines:[{depth:21,pv:['e2e4'],score:{type:'mate',white:3,whiteBound:'lower'}}]});
  lc.options.onInfo({}, {fen:board,visits:612,lines:[{pv:['d2d4'],score:{type:'q',white:0.1}}]});await x.until(()=>x.card('SF').querySelector('.all-eval-score').textContent!=='…','coalesced card info paints');await x.frame();
  assert.match(x.card('SF').querySelector('.all-eval-score').textContent,/≥#3/);assert.match(x.card('SF').textContent,/Depth 21/);
  assert.match(x.card('LC0').textContent,/612 visits/);assert.doesNotMatch(x.card('LC0').textContent,/Depth/);
  assert.match(x.card('SF').textContent,/Searching.*10.0s/);assert.equal(x.card('SF').querySelectorAll('small:not([hidden])').length,2);
  const target=x.card('SF');x.el('btnAnalyzeAll').click();await x.frame();assert.equal(x.card('SF'),target);assert(!target.classList.contains('is-busy'));assert.equal(target.querySelector('.all-eval-detail').hidden,true);
});
test('P4 A pinned older-root card is labelled and its score is never attached to the current board',async t=>{
  const x=await fixture(t);await x.start();const sf=x.calls.find(c=>c.mode==='sf-lite'),fen=sf.options.fen;
  sf.options.onInfo({}, {fen,lines:[{depth:9,pv:['e2e4'],score:{type:'cp',white:37}}]});await x.frame();
  x.w.ChessLabHost.navigate({moves:['d2d4']});await x.frame();
  assert.equal(x.card('SF').dataset.positionScope,'older');assert.match(x.card('SF').textContent,/Older position/);assert.equal(x.card('SF').querySelector('.all-eval-score').textContent,'+0.37');assert.equal(x.calls.length,4);
});
