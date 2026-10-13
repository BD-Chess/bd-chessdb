'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Deep = require('../js/8zc-deep-engine.js');
const { Chess } = require('../js/chess.min.js');

const START = new Chess().fen();
const BLACK = (() => { const game = new Chess(); game.move('e4'); return game.fen(); })();
const HISTORY = { startFen: START, moves: ['e2e4'] };
const source = fs.readFileSync(path.join(__dirname, '../js/8zc-analysis-session.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture({ hardwareConcurrency = 8, isolated = true, mobile = false, stored = null, legacy=false, indexedDB, crypto, fetch } = {}) {
  const events = new Map(), documentEvents = new Map(), values = new Map();
  let clock = 0;
  if (stored) values.set(legacy?'ChessBest:LAB:v2:analysis-engine':'ChessBest:LAB:v2:analysis-engine-r3', JSON.stringify(stored));
  const root = {
    indexedDB, crypto, fetch,
    navigator: { hardwareConcurrency }, crossOriginIsolated: isolated,
    SharedArrayBuffer: isolated ? SharedArrayBuffer : undefined,
    matchMedia: () => ({ matches: mobile }), innerWidth: mobile ? 390 : 1200,
    document: { baseURI: 'http://localhost/chess-lab/', hidden: false,
      addEventListener: (name, fn) => documentEvents.set(name, fn) },
    addEventListener: (name, fn) => events.set(name, fn),
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    performance: { now: () => (clock += 101) }
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { window: root, module, require: () => Deep,
    URL, Date, Promise, AbortController, setTimeout, clearTimeout }, { filename: '8zc-analysis-session.js' });
  return { Session: module.exports, root, events, documentEvents, values };
}
function adapters() {
  const calls = [], destroyed = [];
  return {
    calls, destroyed,
    factory(id, config) {
      const pending = deferred();
      const call = { id, config, pending, options: null,
        info(value) { this.options.onInfo({}, value); },
        complete(value) { pending.resolve(value); }, fail(message = 'Engine unavailable') { pending.reject(new Error(message)); } };
      calls.push(call);
      return { analyze(options) { call.options = options; return pending.promise; },
        destroy() { destroyed.push(id); } };
    }
  };
}
function preparingAdapters() {
  const calls = [], destroyed = [];
  return {
    calls, destroyed,
    factory(id, config) {
      const ready = deferred(), search = deferred();
      const call = { id, config, ready, search, options: null, prepareCalled: false, destroyed: false,
        complete(value) { search.resolve(value); } };
      calls.push(call);
      return { prepare() { call.prepareCalled = true; return ready.promise; },
        analyze(options) { call.options = options; return search.promise; },
        destroy() { call.destroyed = true; destroyed.push(id); } };
    }
  };
}
function result(fen, move, { depth = 8, score = 22, engine = null } = {}) {
  return { fen, engine, lines: [{ depth, multipv: 1, pv: [move], score: { type: 'cp', white: score, bound: 'exact' } }],
    depth, nodes: 3000, elapsedMs: 50, bestMove: move };
}

test('default is CDB-first, settings do not launch workers, and Full/Berserk remain lazy until analysis', async () => {
  const { Session, values } = fixture();
  const fake = adapters();
  assert.equal(Session.getSettings().analysisMode, 'sf-lite');
  assert.equal(Session.getSettings().boardSource,'cdb');
  assert.equal(Session.getSettings().sfFullThreadsRequested, 1);
  const session = Session.create({ Chess, adapterFactory: fake.factory });
  Session.configure({ analysisMode: 'sf-full', sfFullThreadsRequested: 4 });
  assert.equal(fake.calls.length, 0);
  assert.equal(JSON.parse(values.get('ChessBest:LAB:v2:analysis-engine-r3')).analysisMode, 'sf-full');
  const run = session.analyze({ fen: START, movetime: 100 });
  assert.deepEqual(fake.calls.map(c => c.id), ['sf-full']);
  fake.calls[0].complete(result(START, 'e2e4'));
  assert.equal((await run).status, 'complete');
  session.destroy();
  const restored = fixture({ stored: { analysisMode: 'sf-berserk', sfFullThreadsRequested: 8 } });
  assert.equal(restored.Session.getSettings().analysisMode, 'sf-berserk');
  assert.equal(fake.calls.length, 1, 'restoring settings starts no analysis');
});

test('legacy CDB/auto Deep selections migrate to Lite while the original preference record remains intact',()=>{
  for(const analysisMode of ['auto','cdb','CDB | SF Lite']){
    const stored={analysisMode,sfFullThreadsRequested:'auto',hashMB:32},x=fixture({stored,legacy:true});
    assert.equal(x.Session.getSettings().analysisMode,'sf-lite');assert.equal(x.Session.getSettings().boardSource,'cdb');
    assert.equal(x.Session.getSettings().sfFullThreadsRequested,1);assert.equal(x.Session.getSettings().hashMB,32);
    assert.equal(x.values.get('ChessBest:LAB:v2:analysis-engine'),JSON.stringify(stored));
  }
});

test('dual children start synchronously on identical pinned FEN/history and equal timed budgets', async () => {
  const { Session } = fixture(); Session.configure({ analysisMode: 'sf-berserk' });
  const fake = adapters(), session = Session.create({ Chess, adapterFactory: fake.factory });
  const snapshots = [];
  const run = session.analyze({ fen: BLACK, history: HISTORY, movetime: 100, multiPV: 2,
    onInfo: (_, snapshot) => snapshots.push(snapshot) });
  assert.deepEqual(fake.calls.map(c => c.id), ['sf-full', 'berserk'], 'both loaders entered before either settled');
  await tick();
  assert(fake.calls.every(c => c.options && c.pending.promise), 'both searches active concurrently');
  assert.equal(fake.calls[0].options.fen, BLACK);
  assert.equal(fake.calls[1].options.fen, BLACK);
  assert.deepEqual(plain(fake.calls[0].options.history), HISTORY);
  assert.deepEqual(plain(fake.calls[1].options.history), HISTORY);
  assert.equal(fake.calls[0].options.multiPV, 2);
  assert.equal(fake.calls[1].options.multiPV, 2);
  assert.equal(fake.calls[0].options.movetime, 100);
  assert.equal(fake.calls[1].options.movetime, 100);
  assert.equal(fake.calls[0].options.depth, null);
  fake.calls[0].info(result(BLACK, 'e7e5'));
  fake.calls[1].info(result(BLACK, 'c7c5'));
  assert.equal(snapshots.at(-1).comparison, 'Different first moves (factual comparison)');
  fake.calls[0].complete(result(BLACK, 'e7e5'));
  await tick();
  assert.equal(session.isRunning(), true);
  assert.equal(snapshots.at(-1).dualComplete, false);
  fake.calls[1].complete(result(BLACK, 'c7c5'));
  const complete = await run;
  assert.equal(complete.status, 'complete'); assert.equal(complete.dualComplete, true);
  assert.notEqual(complete.children['sf-full'].jobId, complete.children.berserk.jobId);
  assert.equal(complete.children['sf-full'].lines[0].pv[0], 'e7e5');
  assert.equal(complete.children.berserk.lines[0].pv[0], 'c7c5');
  assert.deepEqual(fake.destroyed.sort(), ['berserk', 'sf-full']);
  session.destroy();
});

test('cold dual load prepares both at once and waits for both before issuing either timed search', async () => {
  const { Session } = fixture(); Session.configure({ analysisMode: 'sf-berserk' });
  const fake = preparingAdapters(), session = Session.create({ Chess, adapterFactory: fake.factory });
  const run = session.analyze({ fen: BLACK, history: HISTORY, movetime: 100 });
  assert.deepEqual(fake.calls.map(c => c.id), ['sf-full', 'berserk']);
  await tick();
  assert(fake.calls.every(c => c.prepareCalled && c.config.readyTimeoutMs === 20000));
  assert(fake.calls.every(c => c.options === null));
  fake.calls[0].ready.resolve(); await tick();
  assert(fake.calls.every(c => c.options === null), 'fast engine waits at barrier rather than consuming its search budget');
  fake.calls[1].ready.resolve(); await tick();
  assert(fake.calls.every(c => c.options !== null), 'both searches were issued after readiness');
  assert(fake.calls.every(c => c.options.movetime === 100));
  assert(fake.calls.every(c => c.options.fen === BLACK));
  fake.calls[0].complete(result(BLACK, 'e7e5'));
  fake.calls[1].complete(result(BLACK, 'c7c5'));
  assert.equal((await run).dualComplete, true);
  session.destroy();
});

test('a failed preparation is partial, and a prepared peer still searches after the barrier', async () => {
  const { Session } = fixture(); Session.configure({ analysisMode: 'sf-berserk' });
  const fake = preparingAdapters(), session = Session.create({ Chess, adapterFactory: fake.factory });
  const seen = [];
  const run = session.analyze({ fen: START, movetime: 100, onInfo: (_, snapshot) => seen.push(snapshot) });
  fake.calls[0].ready.resolve(); await tick();
  fake.calls[1].ready.reject(new Error('Berserk readiness timeout')); await tick();
  assert.equal(fake.calls[0].options.movetime, 100);
  assert.equal(fake.calls[1].options, null);
  assert.equal(session.isRunning(), true);
  assert.equal(seen.at(-1).dualComplete, false);
  fake.calls[0].complete(result(START, 'e2e4'));
  const partial = await run;
  assert.equal(partial.status, 'partial'); assert.equal(partial.dualComplete, false);
  assert.match(partial.children.berserk.error, /readiness timeout/);
  assert.deepEqual(fake.destroyed.sort(), ['berserk', 'sf-full']);
  session.destroy();
});

test('switch while loaders are pending destroys both and prevents a late prepare from starting a search', async () => {
  const { Session } = fixture(); Session.configure({ analysisMode: 'sf-berserk' });
  const fake = preparingAdapters(), session = Session.create({ Chess, adapterFactory: fake.factory });
  const old = session.analyze({ fen: START, movetime: 100 });
  Session.configure({ analysisMode: 'sf-lite' });
  assert.equal((await old).status, 'stopped');
  fake.calls[0].ready.resolve(); fake.calls[1].ready.resolve(); await tick();
  assert(fake.calls.every(c => c.options === null));
  assert.deepEqual(fake.destroyed.sort(), ['berserk', 'sf-full']);
  const fresh = session.analyze({ fen: BLACK, movetime: 100 });
  fake.calls[2].ready.resolve(); await tick();
  assert.equal(fake.calls[2].id, 'sf-lite');
  fake.calls[2].complete(result(BLACK, 'e7e5'));
  assert.equal((await fresh).fen, BLACK);
  session.destroy();
});

test('one failed or blocked loader leaves the other searching, then Stop terminates both', async () => {
  const { Session } = fixture(); Session.configure({ analysisMode: 'sf-berserk' });
  const fake = adapters(), session = Session.create({ Chess, adapterFactory: fake.factory });
  const observed = [];
  const run = session.analyze({ fen: START, nodes: 1000, onInfo: (_, snapshot) => observed.push(snapshot) });
  await tick();
  fake.calls[0].fail('Full loader failed'); await tick();
  assert.equal(session.isRunning(), true);
  assert.equal(observed.at(-1).status, 'partial');
  assert.equal(observed.at(-1).dualComplete, false);
  fake.calls[1].info(result(START, 'd2d4'));
  assert.equal(observed.at(-1).children.berserk.lines[0].pv[0], 'd2d4');
  fake.calls[1].complete(result(START, 'd2d4'));
  const partial = await run;
  assert.equal(partial.status, 'partial'); assert.equal(partial.dualComplete, false);
  assert.equal(partial.children['sf-full'].error, 'Full loader failed');

  const blocked = session.analyze({ fen: START, movetime: 100 });
  await tick();
  fake.calls[3].info(result(START, 'e2e4'));
  assert.equal(session.isRunning(), true);
  session.stop();
  const stopped = await blocked;
  assert.equal(stopped.status, 'stopped'); assert.equal(stopped.dualComplete, false);
  assert(fake.destroyed.includes('sf-full') && fake.destroyed.includes('berserk'));
  fake.calls[2].complete(result(START, 'a2a4')); fake.calls[3].complete(result(START, 'e2e4'));
  await tick(); assert.equal(session.isRunning(), false);
  session.destroy();
});

test('one child terminal result resolves a single session; switch invalidates late events for every subscriber', async () => {
  const { Session } = fixture();Session.configure({analysisMode:'sf-lite'});
  const fake = adapters(), session = Session.create({ Chess, adapterFactory: fake.factory });
  const observed = [];
  const first = session.analyze({ fen: START, depth: 8, onInfo: (_, value) => observed.push(value) });
  assert.equal(fake.calls[0].id, 'sf-lite');
  await tick();
  fake.calls[0].complete(result(START, 'e2e4'));
  const single = await first;
  assert.equal(single.status, 'complete'); assert.equal(single.dualComplete, false);
  assert.equal(Object.keys(single.children).length, 1);
  Session.configure({ analysisMode: 'sf-berserk' });
  const old = session.analyze({ fen: START, infinite: true, onInfo: (_, value) => observed.push(value) });
  await tick();
  const oldInfo = fake.calls[1].options.onInfo;
  Session.configure({ analysisMode: 'berserk' });
  assert.equal((await old).status, 'stopped');
  const fresh = session.analyze({ fen: BLACK, movetime: 100, onInfo: (_, value) => observed.push(value) });
  await tick();
  const count = observed.length;
  oldInfo({}, result(START, 'e2e4'));
  fake.calls[1].complete(result(START, 'e2e4'));
  fake.calls[2].fail('late failure');
  await tick(); assert.equal(observed.length, count);
  assert.equal(session.isRunning(), true);
  assert.equal(fake.calls[3].id, 'berserk');
  fake.calls[3].complete(result(BLACK, 'e7e5'));
  assert.equal((await fresh).fen, BLACK);
  assert(fake.destroyed.includes('sf-full') && fake.destroyed.includes('berserk'));
  session.destroy();
});

test('CPU accounting distinguishes isolated Full threads, non-isolated fallback and mobile dual cap', () => {
  const isolated = fixture({ hardwareConcurrency: 8, isolated: true });
  isolated.Session.configure({ analysisMode: 'sf-berserk', sfFullThreadsRequested: 6 });
  const dual = isolated.Session.capabilities();
  assert.equal(dual.effectiveSFThreads, 6); assert.equal(dual.berserkThreads, 1);
  assert.equal(dual.totalThreads, 7); assert.equal(dual.allocation, 'SF Full · 6 + Berserk · 1');
  const fallback = fixture({ hardwareConcurrency: 8, isolated: false });
  fallback.Session.configure({ analysisMode: 'sf-berserk', sfFullThreadsRequested: 6 });
  const single = fallback.Session.capabilities();
  assert.equal(single.effectiveSFThreads, 1); assert.equal(single.totalThreads, 2);
  assert.match(single.message, /single-thread fallback/);
  const mobile = fixture({ hardwareConcurrency: 4, isolated: true, mobile: true });
  mobile.Session.configure({ analysisMode: 'sf-berserk', sfFullThreadsRequested: 'auto' });
  assert.equal(mobile.Session.capabilities().totalThreads, 2);
  mobile.Session.configure({ analysisMode: 'sf-lite', sfFullThreadsRequested: 8 });
  assert.equal(mobile.Session.capabilities().totalThreads, 1);
});

test('visibility change and pagehide stop all session-owned children; late callbacks stay invisible', async () => {
  const { Session, root, events, documentEvents } = fixture();
  Session.configure({ analysisMode: 'sf-berserk' });
  const fake = adapters();
  const left = Session.create({ Chess, adapterFactory: fake.factory });
  const right = Session.create({ Chess, adapterFactory: fake.factory });
  const seen = [];
  const first = left.analyze({ fen: START, infinite: true, onInfo: (_, snapshot) => seen.push(snapshot) });
  await tick();
  const stale = fake.calls[0].options.onInfo;
  root.document.hidden = true; documentEvents.get('visibilitychange')();
  assert.equal((await first).status, 'stopped');
  const beforeStale = seen.length;
  stale({}, result(START, 'e2e4')); assert.equal(seen.length, beforeStale, 'late info is suppressed');
  root.document.hidden = false;
  const second = right.analyze({ fen: BLACK, infinite: true });
  events.get('pagehide')();
  assert.equal((await second).status, 'stopped');
  assert.equal(left.isRunning(), false); assert.equal(right.isRunning(), false);
  assert.equal(fake.destroyed.length, 4);
  left.destroy(); right.destroy();
});

class UciWorker {
  constructor(id) { this.id = id; this.commands = []; this.terminated = false; }
  postMessage(command) {
    this.commands.push(command);
    if (command === 'uci') queueMicrotask(() => this.emit('id name ' + this.id + '\nuciok'));
    if (command === 'isready') queueMicrotask(() => this.emit('readyok'));
  }
  emit(data) { this.onmessage?.({ data }); }
  terminate() { this.terminated = true; }
}

test('real Deep adapters dispatch simultaneous distinct UCI workers and preserve legal PV, bounds and partial MultiPV', async () => {
  const { Session } = fixture({ isolated: false, crypto: {subtle:{digest:async()=>Buffer.from('9b84c340af7e45f6e07f0046235ccb327f4ae0840c8ee2c4b97b99121e5c5084','hex')}} });
  await Session.loadBerserkNetwork({size:Session.BERSERK_NET.bytes,arrayBuffer:async()=>new ArrayBuffer(Session.BERSERK_NET.bytes)});
  Session.configure({ analysisMode: 'sf-berserk', sfFullThreadsRequested: 4 });
  const workers = [];
  const session = Session.create({ Chess, workerFactory: (url, id) => {
    const worker = new UciWorker(id); worker.url = url; workers.push(worker); return worker;
  } });
  const run = session.analyze({ fen: BLACK, history: HISTORY, movetime: 100, multiPV: 2 });
  await tick();
  assert.deepEqual(workers.map(w => w.id), ['sf-full', 'berserk']);
  assert(workers.every(w => w.commands.includes('position fen ' + START + ' moves e2e4')));
  assert(workers.every(w => w.commands.includes('go movetime 100')));
  assert.match(workers[0].url, /stockfish-19-single\.js(?:\?v=20261013-r9)?$/);
  assert.match(workers[1].url, /berserk-host\.js(?:\?v=20261013-r9)?$/);
  assert(workers.every(w => w.commands.includes('setoption name Threads value 1')));
  workers[0].emit('info depth 10 multipv 1 score mate -3 upperbound nodes 200 pv e7e5 g1f3 g8f6');
  workers[0].emit('info depth 10 multipv 2 score cp 25 nodes 210 pv c7c5 e2e5');
  workers[0].emit('bestmove e7e5');
  await tick(); assert.equal(session.isRunning(), true);
  workers[1].emit('info depth 9 multipv 1 score cp 0 nodes 100 pv c7c5');
  workers[1].emit('bestmove c7c5');
  const done = await run, full = done.children['sf-full'], berserk = done.children.berserk;
  assert.equal(done.dualComplete, true);
  assert.notEqual(full.engine.id, berserk.engine.id);
  assert.equal(full.completeMultiPV, false, 'bounded rank is not an exact comparable MultiPV set');
  assert.deepEqual(plain(full.lines[0].pv), ['e7e5', 'g1f3', 'g8f6']);
  assert.deepEqual(plain(full.lines[1].pv), ['c7c5']); // illegal continuation was trimmed by Chess
  assert.equal(full.lines[0].score.type, 'mate');
  assert.equal(full.lines[0].score.white, 3);
  assert.equal(full.lines[0].score.whiteBound, 'lower');
  assert.equal(berserk.lines[0].score.white, 0);
  assert(workers.every(w => w.terminated));
  session.destroy();
});

test('local NNUE survives a new session, is reverified, and removal preserves Studies and settings', async () => {
  const { IDBFactory } = require('fake-indexeddb');
  const indexedDB=new IDBFactory();
  let digests=0;
  const crypto={subtle:{digest:async()=>{digests++;return Buffer.from('9b84c340af7e45f6e07f0046235ccb327f4ae0840c8ee2c4b97b99121e5c5084','hex');}}};
  const first=fixture({indexedDB,crypto});
  await first.Session.loadBerserkNetwork({size:first.Session.BERSERK_NET.bytes,arrayBuffer:async()=>new ArrayBuffer(first.Session.BERSERK_NET.bytes)});
  assert.equal(first.Session.getSettings().berserkNetworkPersistent,true);
  const next=fixture({indexedDB,crypto});next.values.set('ChessBest:LAB:v2:studies','untouched');
  next.Session.configure({analysisMode:'sf-berserk',sfFullThreadsRequested:4});
  await next.Session.restoreBerserkNetwork();
  assert.equal(next.Session.getSettings().berserkNetworkReady,true);
  assert.equal(digests,2,'restored bytes must be verified again');
  await next.Session.clearBerserkNetwork();
  assert.equal(next.Session.getSettings().berserkNetworkReady,false);
  assert.equal(next.Session.getSettings().analysisMode,'sf-berserk');
  assert.equal(next.values.get('ChessBest:LAB:v2:studies'),'untouched');
  const removed=fixture({indexedDB,crypto});await removed.Session.restoreBerserkNetwork();
  assert.equal(removed.Session.getSettings().berserkNetworkState,'missing');
});

test('wrong NNUE is rejected; unavailable storage still allows the verified network for this visit', async () => {
  const bad=fixture({crypto:{subtle:{digest:async()=>new Uint8Array(32)}}});
  await assert.rejects(bad.Session.loadBerserkNetwork({size:bad.Session.BERSERK_NET.bytes,arrayBuffer:async()=>new ArrayBuffer(bad.Session.BERSERK_NET.bytes)}),/does not match/);
  assert.equal(bad.Session.getSettings().berserkNetworkReady,false);
  const good=fixture({crypto:{subtle:{digest:async()=>Buffer.from('9b84c340af7e45f6e07f0046235ccb327f4ae0840c8ee2c4b97b99121e5c5084','hex')}}});
  await good.Session.loadBerserkNetwork({size:good.Session.BERSERK_NET.bytes,arrayBuffer:async()=>new ArrayBuffer(good.Session.BERSERK_NET.bytes)});
  assert.equal(good.Session.getSettings().berserkNetworkReady,true);
  assert.equal(good.Session.getSettings().berserkNetworkPersistent,false);
});


test('automatic original NNUE is lazy, verified and reused from the local cache', async () => {
  const {IDBFactory}=require('fake-indexeddb');const indexedDB=new IDBFactory();let fetched=0,digests=0;
  const crypto={subtle:{digest:async()=>{digests++;return Buffer.from('9b84c340af7e45f6e07f0046235ccb327f4ae0840c8ee2c4b97b99121e5c5084','hex');}}};
  const first=fixture({indexedDB,crypto,fetch:async(url,opts)=>{fetched++;assert.match(url,/v14-5b8d6c93\/berserk-9b84c340af7e\.part[012]\.nn$/);assert.equal(opts.cache,'force-cache');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(url.includes('part2')?4230404:10485760)};}});
  first.Session.configure({analysisMode:'berserk'});assert.equal(fetched,0);
  await first.Session.ensureBerserkNetwork(new AbortController().signal);assert.equal(fetched,3);assert.equal(first.Session.getSettings().berserkNetworkPersistent,true);
  const second=fixture({indexedDB,crypto,fetch:async()=>{throw new Error('Cached bytes must avoid a download');}});
  await second.Session.ensureBerserkNetwork(new AbortController().signal);assert.equal(fetched,3);assert.equal(digests,2);
});

test('automatic NNUE rejects incorrect bytes and a stopped download never becomes ready', async () => {
  const wrong=fixture({crypto:{subtle:{digest:async()=>new Uint8Array(32)}},fetch:async url=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(url.includes('part2')?4230404:10485760)})});
  await assert.rejects(wrong.Session.ensureBerserkNetwork(),/does not match/);assert.equal(wrong.Session.getSettings().berserkNetworkReady,false);
  const pending=deferred(),controller=new AbortController();
  const aborted=fixture({fetch:async(_u,opts)=>new Promise((_yes,no)=>{pending.resolve();opts.signal.addEventListener('abort',()=>no(Object.assign(new Error('Cancelled'),{name:'AbortError'})),{once:true});})});
  const run=aborted.Session.ensureBerserkNetwork(controller.signal);await pending.promise;controller.abort();
  await assert.rejects(run,{name:'AbortError'});assert.equal(aborted.Session.getSettings().berserkNetworkReady,false);
});
