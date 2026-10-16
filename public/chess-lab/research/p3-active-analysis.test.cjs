'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {boot}=require('./source-context-integration.test.cjs');
const Registry=require('../js/8zc-engine-registry.js');
const tick=()=>new Promise(r=>setImmediate(r)),wait=ms=>new Promise(r=>setTimeout(r,ms));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function cardsFixture(t,{mobile=false,hold=false}={}){
  let clock=0,serial=0,fen='a',history=null,available=true;
  const timers=new Map(),events=new Map(),calls=[],published=[];
  const root={performance:{now:()=>clock},document:{hidden:false,addEventListener:(n,f)=>events.set(n,f),removeEventListener(){}},addEventListener:(n,f)=>events.set(n,f),removeEventListener(){}};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/8zc-engine-cards.js'),'utf8'),{window:root,module,AbortController,Date,Promise,
    setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id)});
  const cards=module.exports.create({registry:Registry,session:{capabilities:()=>({mobile,hardwareConcurrency:4}),getSettings:()=>({})},teardownGraceMs:0,
    getContext:()=>({fen,positionHistory:history,canAnalyze:available&&!root.document.hidden,settings:{sfCardMode:'sf-full',analysisTimeMs:3600000}}),
    backendFor:mode=>({create(){const c={mode,ready:deferred(),search:deferred(),destroyed:false};calls.push(c);
      if(!hold)c.ready.resolve();
      return {prepare:()=>c.ready.promise,analyze:options=>{c.options=options;return c.search.promise;},destroy(){c.destroyed=true;}};}}),onResult:v=>published.push(v)});
  t.after(()=>cards.destroy());
  return {cards,calls,published,root,events,async advance(ms){clock+=ms;for(const[id,v]of [...timers])if(v.at<=clock){timers.delete(id);v.fn();}await tick();},
    change(f=fen,h=history){fen=f;history=h;cards.positionChanged();},lock(){available=false;cards.positionChanged();}};
}

test('P3 Cards Stop all before info retires follow through navigation, history change, page return and explicit new search',async t=>{
  const x=cardsFixture(t);x.cards.setFollowing(true);await x.advance(100);assert.equal(x.calls.length,4);
  x.cards.stopAll();assert.equal(x.cards.isFollowing(),false);assert.equal(x.cards.isRunning(),false);
  assert(x.cards.activitySnapshot().children.every(c=>c.state==='stopped'&&c.searchElapsedMs===null));
  x.change('b');x.change('b',{startFen:'root',moves:['g1f3']});x.root.document.hidden=true;x.events.get('visibilitychange')();
  x.root.document.hidden=false;x.events.get('visibilitychange')();await x.advance(1000);assert.equal(x.calls.length,4);
  const fresh=x.cards.analyzeAll();await tick();assert.equal(x.calls.length,8);assert.equal(x.cards.isFollowing(),false);
  assert(x.calls.slice(4).every(c=>c.options.movetime===3600000));x.cards.stopAll();await fresh;
  x.cards.setFollowing(true);await x.advance(100);assert.equal(x.calls.length,12);assert.equal(x.cards.isFollowing(),true);
});
test('P3 one-family Stop during preparation disarms Cards but healthy already-started families finish',async t=>{
  const x=cardsFixture(t,{hold:true});x.cards.setFollowing(true);await x.advance(100);const old=x.calls.slice();
  x.cards.stopRole('SF');assert.equal(x.cards.isFollowing(),false);assert.equal(old[0].destroyed,true);assert(old.slice(1).every(c=>!c.destroyed));
  for(const c of old)c.ready.resolve();await tick();assert.equal(old[0].options,undefined);
  for(const c of old.slice(1)){assert(c.options);c.options.onSearchStarted({timestamp:100});c.search.resolve({fen:'a',lines:[],actualSearchMs:20});}
  await tick();assert.equal(x.cards.isRunning(),false);assert.equal(x.cards.activitySnapshot().children.filter(c=>c.state==='complete').length,3);
  x.change('b');await x.advance(1000);assert.equal(x.calls.length,4);
});
test('P3 Stop drains a queued phone lane without pumping another child or accepting old prepare callbacks',async t=>{
  const x=cardsFixture(t,{mobile:true,hold:true});
  const a=x.cards.analyze('sf-full'),b=x.cards.analyze('reckless'),c=x.cards.analyze('berserk');
  assert.equal(x.calls.length,1);assert.equal(x.cards.activitySnapshot().children.filter(c=>c.state==='queued').length,2);
  x.cards.stopAll();await Promise.all([a,b,c]);x.calls[0].ready.resolve();await tick();await x.advance(10000);
  assert.equal(x.calls.length,1);assert.equal(x.calls[0].options,undefined);assert.equal(x.cards.isRunning(),false);
});
test('P3 rapid follow navigations select only latest history; stale info/progress/error/finally cannot replace its activity or results',async t=>{
  const x=cardsFixture(t);x.cards.setFollowing(true);await x.advance(100);const old=x.calls.slice();
  x.change('b',{startFen:'root',moves:['a']});x.change('c',{startFen:'root',moves:['b']});x.change('c',{startFen:'other',moves:['b']});
  await x.advance(100);assert.equal(x.calls.length,8);const fresh=x.calls.slice(4),ids=JSON.stringify(x.cards.activitySnapshot().children.map(c=>c.id));
  assert(fresh.every(c=>c.options.fen==='c'&&c.options.history.startFen==='other'));
  for(const c of old){c.options.onProgress({loaded:999,total:999});c.options.onInfo({}, {fen:'a',lines:[{depth:99,pv:['a']}]});c.search.reject(Error('old error'));}
  await tick();assert.equal(x.published.length,0);assert.equal(JSON.stringify(x.cards.activitySnapshot().children.map(c=>c.id)),ids);
  for(const c of fresh){c.options.onSearchStarted({timestamp:200});c.search.resolve({fen:'c',lines:[],actualSearchMs:15});}
  await tick();assert(x.cards.activitySnapshot().children.every(c=>c.state==='complete'));
});

async function integrated(t,{app=false,hold=false}={}){
  const calls=[];let runner=null;
  const h=await boot(t,{skipReady:true,beforeInit(w){
    if(app){w.document.body.classList.add('app-mobile');w.history.replaceState(null,'','?view=app');}
    const make=mode=>{const c={mode,ready:deferred(),search:deferred(),destroyed:false};calls.push(c);if(!hold)c.ready.resolve();
      return {prepare:()=>c.ready.promise,analyze(options){c.options=options;options.onSearchStarted?.({timestamp:w.performance.now()});return c.search.promise;},destroy(){c.destroyed=true;}};};
    const create=w.ChessAnalysisSession.create;
    w.ChessAnalysisSession.create=config=>create({...config,teardownGraceMs:0,adapterFactory:make});
    w.ChessAnalysisSession.backendFor=mode=>({create:()=>make(mode)});
    const createRunner=w.ChessSimRunner.create;
    w.ChessSimRunner.create=config=>(runner=createRunner(config));
  }});
  const {w,el}=h;await tick();await new Promise(r=>w.requestAnimationFrame(r));
  const frame=async()=>{await tick();await new Promise(r=>w.requestAnimationFrame(r));};
  const view=name=>w.document.querySelector(app?'[data-app-tab="'+name+'"]':'[data-desktop-view="'+name+'"]')?.click();
  const deep=name=>w.document.querySelector('[data-deep="'+name+'"]');
  const snapshot=()=>w.ChessLabHost.getAnalysisActivity();
  const stop=()=>w.document.querySelector('[data-activity="stop"]').click();
  const setFollow=checked=>{deep('follow').checked=checked;deep('follow').dispatchEvent(new w.Event('change'));};
  const quickFollow=checked=>{el('analysisAllMoves').checked=checked;el('analysisAllMoves').dispatchEvent(new w.Event('change'));};
  const finish=()=>{for(const c of calls.filter(c=>c.options&&!c.destroyed))c.search.resolve({fen:c.options.fen,lines:[],nodes:10,actualSearchMs:10000,completeMultiPV:false});};
  const startDeep=async()=>{view('deep');w.ChessAnalysisSession.configure({analysisMode:'all',deepTimeMs:10000,boardSource:'cdb'});deep('start').click();await frame();};
  return {...h,calls,frame,view,deep,snapshot,stop,setFollow,quickFollow,finish,startDeep,runner:()=>runner};
}

for(const app of [false,true])test(`P3 ${app?'APP':'desktop'} Deep keeps identical jobs across views, Library and Settings; shared Stop reaches hidden owners`,async t=>{
  const x=await integrated(t,{app}),{w,el}=x;await x.startDeep();assert.equal(x.calls.length,4);
  const ids=JSON.stringify(x.snapshot().owners.find(o=>o.owner==='deep').children.map(c=>c.id));
  const before=JSON.stringify(w.ChessLabHost.getReviewGame());
  for(const name of app?['board','moves','review','dcc','deep']:['moves','review','dcc','deep']){
    x.view(name);await x.frame();assert.equal(x.calls.length,4,name);
    assert.equal(JSON.stringify(x.snapshot().owners.find(o=>o.owner==='deep').children.map(c=>c.id)),ids,name);
    assert.match(el('analysisActivity').textContent,/Deep/);assert.equal(w.document.querySelector('[data-activity="stop"]').disabled,false);
  }
  if(app)el('appGames').click();else el('btnGames').click();await x.frame();assert.equal(x.calls.length,4);
  if(app)el('appMore').click();el('btnSettings').click();await x.frame();
  assert(el('settingsPanel').contains(el('analysisActivity')));assert.equal(el('analysisActivity').closest('[inert]'),null);
  x.stop();await x.frame();assert(x.calls.every(c=>c.destroyed));assert(x.snapshot().owners.every(o=>!o.running&&!o.following));
  el('btnCloseSettings').click();x.view('moves');await x.frame();assert.equal(JSON.stringify(w.ChessLabHost.getReviewGame()),before);
  assert.equal(el('analysisSource').value,'cdb');assert.equal(hErrors(x),'');
});
const hErrors=x=>x.errors.join('\n');

test('P3 Quick All projects the same four jobs in APP Board/Moves/Review/DCC/Library and stops from Settings',async t=>{
  const x=await integrated(t,{app:true});x.el('btnAnalyzeAll').click();await x.frame();assert.equal(x.calls.length,4);
  const ids=JSON.stringify(x.snapshot().owners.find(o=>o.owner==='cards').children.map(c=>c.id));
  for(const view of ['moves','review','dcc','board']){x.view(view);await x.frame();assert.equal(JSON.stringify(x.snapshot().owners.find(o=>o.owner==='cards').children.map(c=>c.id)),ids);}
  x.el('appGames').click();await x.frame();x.el('appMore').click();x.el('btnSettings').click();await x.frame();
  x.stop();await x.frame();assert(x.calls.every(c=>c.destroyed));assert.equal(x.calls.length,4);assert.equal(x.el('analysisAllMoves').checked,false);
});

test('P3 shared Stop leaves a running Sim actor intact and no follow can start analysis under Sim ownership',async t=>{
  const x=await integrated(t),{w,el}=x;
  el('btnSim').click();el('simWhiteEngine').value='reckless';el('simBlackEngine').value='reckless';el('simStartBtn').click();
  await x.until(()=>x.calls.some(c=>c.mode==='reckless'&&c.options),'actual Sim actor started');
  const actor=x.calls.find(c=>c.options),before=w.ChessLabHost.getContext();assert.equal(before.simRunning,true);
  w.ChessLabHost.stopAnalysis();assert.equal(actor.destroyed,false);assert.equal(w.ChessLabHost.getContext().simRunning,true);
  x.quickFollow(true);x.view('deep');x.setFollow(true);await wait(150);assert.equal(x.calls.length,1,'no interactive worker while Sim owns work');
  const legal=new w.Chess(actor.options.fen).moves({verbose:true})[0];
  actor.search.resolve({fen:actor.options.fen,bestMove:legal.from+legal.to+(legal.promotion||''),lines:[{depth:4,pv:[legal.from+legal.to],score:{type:'cp',root:10,white:10,bound:'exact'}}]});
  await x.until(()=>w.ChessLabHost.getReviewGame().cursor===1,'Sim can still commit a legal move after shared Stop');
  const archiveSaved=new Promise(resolve=>w.addEventListener('chess-sim-collections',resolve,{once:true}));
  await x.runner().pause('fixture complete');w.ChessLabHost.stopAnalysis();
  for(const c of x.calls)c.search.resolve({fen:c.options?.fen,lines:[]});
  await x.runner().settled();await archiveSaved;await x.frame();await x.frame();
});

test('P3 shared Stop preserves a human game and its running turn clock',async t=>{
  const x=await integrated(t),{w,el}=x;
  el('btnTwoPlayers').click();el('humanStart').click();await x.frame();
  assert.equal(el('humanSession').hidden,false);const before=w.ChessLabHost.getReviewGame();
  w.ChessLabHost.stopAnalysis();await x.frame();assert.equal(el('humanSession').hidden,false);
  assert.equal(el('btnHumanPause').textContent,'Pause game');
  x.drop('e2','e4','wP');await x.frame();assert.equal(w.ChessLabHost.getReviewGame().cursor,before.cursor+1);
  el('btnHumanFinish').click();
});

test('P3 shared Stop does not cancel Replay and neither follow owner can search during Replay',async t=>{
  const x=await integrated(t),{w,el}=x;w.ChessLabHost.navigate({moves:['e2e4','e7e5','g1f3']});
  let activity=null;w.document.addEventListener('chess:activity',e=>activity=e.detail);
  el('btnReplay').click();el('replaySpeed').value='0';el('replayStart').click();
  assert.equal(activity?.kind,'replay');w.ChessLabHost.stopAnalysis();x.quickFollow(true);x.view('deep');x.setFollow(true);
  await x.until(()=>activity?.kind!=='replay','Replay reaches its own completion after shared Stop');
  assert.equal(w.ChessLabHost.getReviewGame().totalPly,3);assert.equal(x.calls.length,0);
  w.ChessLabHost.stopAnalysis();
});

test('P3 Quick→Deep→Quick atomically retires the other follow owner; Stop then Analyze never re-arms it',async t=>{
  const x=await integrated(t);x.quickFollow(true);await wait(130);assert.equal(x.calls.length,4);assert.equal(x.snapshot().owners.find(o=>o.owner==='cards').following,true);
  const quick=x.calls.slice();await x.startDeep();assert(quick.every(c=>c.destroyed));assert.equal(x.el('analysisAllMoves').checked,false);
  x.setFollow(true);assert.equal(x.snapshot().owners.find(o=>o.owner==='deep').following,true);
  x.el('btnAnalyzeAll').click();await x.frame();assert.equal(x.deep('follow').checked,false);assert(x.calls.slice(4,8).every(c=>c.destroyed));
  x.quickFollow(true);x.stop();await wait(160);const count=x.calls.length;
  x.w.ChessLabHost.navigate({moves:['e2e4']});x.w.ChessLabHost.navigate({moves:['e2e4','e7e5']});x.view('deep');await wait(160);
  assert.equal(x.calls.length,count);assert.equal(x.el('analysisAllMoves').checked,false);assert.equal(x.deep('follow').checked,false);
  x.deep('start').click();await x.frame();assert.equal(x.calls.length,count+4);assert.equal(x.deep('follow').checked,false);
});
test('P3 a Deep follow burst starts only the latest root/history and old callbacks cannot publish',async t=>{
  const x=await integrated(t);await x.startDeep();x.setFollow(true);const old=x.calls.slice();
  x.w.ChessLabHost.navigate({moves:['e2e4']});x.w.ChessLabHost.navigate({moves:['e2e4','e7e5']});x.w.ChessLabHost.navigate({moves:['e2e4','e7e5','g1f3']});
  await wait(150);assert.equal(x.calls.length,8);assert(x.calls.slice(4).every(c=>c.options.history.moves.join(' ')==='e2e4 e7e5 g1f3'));
  const ids=JSON.stringify(x.snapshot().owners.find(o=>o.owner==='deep').children.map(c=>c.id));
  for(const c of old){c.options.onInfo({}, {fen:c.options.fen,lines:[{depth:99,pv:['e2e4']}]});c.search.resolve({fen:c.options.fen,lines:[]});}
  await x.frame();assert.equal(JSON.stringify(x.snapshot().owners.find(o=>o.owner==='deep').children.map(c=>c.id)),ids);
  x.setFollow(false);assert.equal(x.deep('follow').checked,false);assert.equal(x.calls.filter(c=>!c.destroyed).length,4,'off lets the current Deep request finish');
  x.finish();await x.frame();x.w.ChessLabHost.navigate({moves:['d2d4']});await wait(150);assert.equal(x.calls.length,8);
});
test('P3 preparing-only Deep Stop has no fictional elapsed search; late readiness cannot launch',async t=>{
  const x=await integrated(t,{hold:true});await x.startDeep();assert.equal(x.calls.length,4);
  const children=x.snapshot().owners.find(o=>o.owner==='deep').children;
  assert(children.every(c=>c.state==='loading'&&c.searchElapsedMs===null));x.stop();
  for(const c of x.calls)c.ready.resolve();await x.frame();assert(x.calls.every(c=>c.options===undefined&&c.destroyed));
  assert(x.snapshot().owners.every(o=>!o.running&&!o.following));
});
test('P3 completed/failed children and armed-idle status are factual; reading/subscribing never launches work',async t=>{
  const x=await integrated(t);await x.startDeep();x.setFollow(true);x.deep('follow').checked=true;
  x.calls[0].search.reject(Error('fixture engine failed'));
  for(const c of x.calls.slice(1))c.search.resolve({fen:c.options.fen,lines:[],actualSearchMs:1234});
  await x.frame();const deep=x.snapshot().owners.find(o=>o.owner==='deep');
  assert.equal(deep.running,false);assert.equal(deep.following,true);assert.equal(deep.children.filter(c=>c.state==='failed').length,1);
  assert.equal(deep.children.filter(c=>c.state==='complete').length,3);assert.equal(x.w.document.querySelector('[data-activity="stop"]').disabled,false);
  const ids=JSON.stringify(deep.children.map(c=>c.id));
  for(let i=0;i<10;i++){x.snapshot();x.view(i%2?'moves':'dcc');}await x.frame();assert.equal(x.calls.length,4);assert.equal(JSON.stringify(x.snapshot().owners.find(o=>o.owner==='deep').children.map(c=>c.id)),ids);
  x.stop();await wait(150);assert.equal(x.calls.length,4);
});
test('P3 entering Deep/Settings with display link enabled does not select a different display source or start engines',async t=>{
  const x=await integrated(t);x.el('analysisLink').checked=true;x.el('analysisLink').dispatchEvent(new x.w.Event('change'));
  x.w.ChessAnalysisSession.configure({boardSource:'cdb',analysisMode:'all'});x.el('analysisSource').value='cdb';
  x.view('deep');await x.frame();x.el('btnSettings').click();await x.frame();x.el('btnCloseSettings').click();
  assert.equal(x.el('analysisSource').value,'cdb');assert.equal(x.w.ChessAnalysisSession.getSettings().boardSource,'cdb');assert.equal(x.calls.length,0);
});
test('P3 status is quiet, preserves focused controls and history bytes, and uses the existing SL/EN path',async t=>{
  const x=await integrated(t,{app:true});await x.startDeep();x.view('moves');await x.frame();
  x.el('workspaceDisplay').scrollTop=111;const selected=x.w.document.querySelector('[data-app-tab="moves"]');selected.focus();
  const before=x.w.localStorage.getItem('ChessBest:LAB:v2:game');
  for(let i=0;i<20;i++)x.calls[0].options.onInfo({}, {fen:x.calls[0].options.fen,lines:[],nodes:i});await x.frame();
  assert.equal(x.w.document.activeElement,selected);assert.equal(x.el('workspaceDisplay').scrollTop,111);assert.equal(x.w.localStorage.getItem('ChessBest:LAB:v2:game'),before);
  assert.equal(x.w.document.querySelector('[data-activity="brief"]').closest('[aria-live]'),null);
  x.w.document.querySelector('[data-app-lang="sl"]').click();await x.frame();assert.match(x.el('analysisActivity').textContent,/Ustavi analizo/);
  x.w.document.querySelector('[data-app-lang="en"]').click();await x.frame();assert.match(x.el('analysisActivity').textContent,/Stop analysis/);
});
