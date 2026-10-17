'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {boot}=require('./source-context-integration.test.cjs');
const tick=()=>new Promise(r=>setImmediate(r));
const settle=async w=>{await tick();await new Promise(r=>w.requestAnimationFrame(r));await tick();};
async function fixture(t,{app=false,storage={}}={}){
  const calls=[];
  const h=await boot(t,{skipReady:true,initialStorage:storage,beforeInit(w){
    if(app){w.document.body.classList.add('app-mobile');w.history.replaceState(null,'','?view=app');}
    const make=mode=>{const c={mode,destroyed:false};calls.push(c);return {prepare:async()=>{},analyze(options){c.options=options;options.onSearchStarted?.({timestamp:w.performance.now()});return new Promise((resolve,reject)=>Object.assign(c,{resolve,reject}));},destroy(){c.destroyed=true;}};};
    const create=w.ChessAnalysisSession.create;w.ChessAnalysisSession.create=config=>create({...config,teardownGraceMs:0,adapterFactory:make});w.ChessAnalysisSession.backendFor=mode=>({create:()=>make(mode)});
  }});
  const deep=name=>h.w.document.querySelector('[data-deep="'+name+'"]');
  const view=name=>h.w.document.querySelector(app?'[data-app-tab="'+name+'"]':'button[data-desktop-view="'+name+'"]').click();
  await settle(h.w);return {...h,calls,deep,view,settle:()=>settle(h.w)};
}
test('P4 B compact Deep summary retains explicit expansion and does not launch work on view/collapse',async t=>{
  const x=await fixture(t);x.view('deep');await x.settle();
  const conf=x.deep('configuration');assert.equal(conf.open,false);assert.match(x.deep('configuration-summary').textContent,/SF Lite.*CPU 1.*Depth.*3 lines.*All root moves/);
  conf.open=true;x.view('moves');x.view('deep');await x.settle();assert.equal(conf.open,true);assert.equal(x.calls.length,0);
  x.w.ChessAnalysisSession.configure({analysisMode:'lc0',deepTimeMs:0,analysisTimeMs:10000});await x.settle();assert.match(x.deep('configuration-summary').textContent,/LC0 10 s/,'neural time fallback is an actual time limit, not fictional depth or visits');
  x.w.ChessAnalysisSession.configure({analysisMode:'all',deepTimeMs:10000});await x.settle();assert.match(x.deep('configuration-summary').textContent,/All Engines.*10 s \/ engine/);
  conf.open=false;x.deep('start').click();await x.settle();assert.equal(x.calls.length,4);assert.equal(conf.open,false);
  for(let i=0;i<12;i++)x.calls[0].options.onInfo({}, {fen:x.calls[0].options.fen,lines:[],nodes:i});await x.settle();assert.equal(conf.open,false);
});
test('P4 B one existing Appearance preference group and shortcut preserve job IDs, budget and results',async t=>{
  const x=await fixture(t);x.view('deep');x.w.ChessAnalysisSession.configure({analysisMode:'all',deepTimeMs:10000});x.deep('start').click();await x.settle();
  const ids=JSON.stringify(x.w.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep').children.map(c=>c.id));
  x.w.document.querySelector('[data-open-appearance]').click();await x.settle();assert(x.el('settingsPanel').classList.contains('open'));assert(x.el('appearanceSettings').open);
  for(const id of ['settingLabWorkspaceWidth','settingFont','settingLabCompact'])assert.equal(x.w.document.querySelectorAll('#'+id).length,1);
  x.el('settingFont').value='18px';x.el('settingFont').dispatchEvent(new x.w.Event('change'));
  x.el('settingTheme').checked=true;x.el('settingTheme').dispatchEvent(new x.w.Event('change'));
  x.el('settingLabWorkspaceWidth').value='500';x.el('settingLabWorkspaceWidth').dispatchEvent(new x.w.Event('change'));
  x.el('settingLabCompact').checked=true;x.el('settingLabCompact').dispatchEvent(new x.w.Event('change'));await x.settle();
  assert.equal(x.calls.length,4);assert(x.calls.every(c=>!c.destroyed&&c.options.movetime===10000));
  assert.equal(JSON.stringify(x.w.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep').children.map(c=>c.id)),ids);
  assert.equal(x.w.document.documentElement.style.getPropertyValue('--analysis-font'),'18px');assert.equal(x.w.ChessLabLayout.getSettings().workspaceWidth,500);assert.equal(x.w.ChessLabLayout.getSettings().compact,true);
  const saved=x.w.localStorage.getItem('ChessBest:LAB:v2:settings'),layout=x.w.localStorage.getItem('ChessBest:LAB:v2:layout');assert.match(saved,/18px/);assert.match(layout,/500/);
});
for(const app of [false,true])test('P4 B '+(app?'APP':'desktop')+' SL→EN→SL restores labels/attributes while preserving game, owner and literal authored data',async t=>{
  const x=await fixture(t,{app});x.view('deep');x.w.ChessAnalysisSession.configure({analysisMode:'all',deepTimeMs:10000});x.deep('start').click();await x.settle();
  const before=JSON.stringify(x.w.ChessLabHost.getReviewGame()),ids=JSON.stringify(x.w.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep').children.map(c=>c.id));
  const authored=x.w.document.createElement('div');authored.className='game-review-detail';authored.textContent='White · Stop · Analysis settings · e4 Nf3';x.el('workspaceDisplay').append(authored);
  const raw=x.w.document.createElement('code');raw.textContent='Depth 24 · 3 lines · bestmove e2e4';x.el('workspaceDisplay').append(raw);
  for(const lang of ['sl','en','sl']){
    x.w.ChessLanguage.apply(lang);await x.settle();assert.equal(x.w.document.documentElement.lang,lang);
    assert.equal(x.el('btnAnalyzeAll').getAttribute('aria-label'),lang==='sl'?'Ustavi vse':'Stop all');
    assert.equal(x.w.document.querySelector('[data-analysis-help]').textContent,lang==='sl'?'Pomoč pri analizi':'Analysis help');
    assert.equal(authored.textContent,'White · Stop · Analysis settings · e4 Nf3');assert.equal(raw.textContent,'Depth 24 · 3 lines · bestmove e2e4');
    assert.equal(JSON.stringify(x.w.ChessLabHost.getReviewGame()),before);assert.equal(JSON.stringify(x.w.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep').children.map(c=>c.id)),ids);assert.equal(x.calls.length,4);
  }
  assert.equal(x.w.localStorage.getItem('ChessBest:LAB:v2:language'),'sl');assert(x.calls.every(c=>!c.destroyed));
});
test('P4 B dynamic status, error prefixes and accessible attributes restore without translating source payloads',async t=>{
  const x=await fixture(t);x.w.ChessLanguage.apply('sl');await x.settle();
  const status=x.deep('status');status.textContent='Analysis failed: upstream fixture 0xC0FFEE';await x.settle();assert.equal(status.textContent,'Analiza ni uspela: upstream fixture 0xC0FFEE');
  x.deep('start').setAttribute('title','New search');await x.settle();assert.equal(x.deep('start').title,'Novo iskanje');
  x.w.ChessLanguage.apply('en');await x.settle();assert.equal(status.textContent,'Analysis failed: upstream fixture 0xC0FFEE');assert.equal(x.deep('start').title,'New search');
});
test('P4 B the existing language preference loads and synchronizes without new stores or changing game state',async t=>{
  const x=await fixture(t,{storage:{'ChessBest:LAB:v2:language':'sl'}});await x.settle();assert.equal(x.w.document.documentElement.lang,'sl');
  const before=JSON.stringify(x.w.ChessLabHost.getReviewGame());x.w.dispatchEvent(new x.w.StorageEvent('storage',{key:'ChessBest:LAB:v2:language',newValue:'en'}));await x.settle();
  assert.equal(x.w.document.documentElement.lang,'en');assert.equal(JSON.stringify(x.w.ChessLabHost.getReviewGame()),before);assert.equal(x.calls.length,0);
});
test('P4 B touch/keyboard help uses one native modal and explains CPU, All, follow, Link, budgets and partial roots',async t=>{
  const x=await fixture(t);x.view('deep');x.w.document.querySelector('[data-analysis-help]').click();
  const help=x.el('analysisHelp');assert.equal(help.open,true);assert.equal(x.w.document.querySelectorAll('#analysisHelp').length,1);
  assert.equal(help.querySelectorAll('dt').length,7);assert.match(help.textContent,/CPU per engine.*All engines.*Each move.*Link and display.*Time and depth.*Partial results.*Restricted roots/);
  x.w.ChessLanguage.apply('sl');await x.settle();assert.match(help.textContent,/CPU na motor.*Vsi motorji.*Vsaka poteza.*Povezava in prikaz.*Čas in globina.*Delni rezultati.*Omejene začetne poteze/);assert.equal(x.calls.length,0);
});
