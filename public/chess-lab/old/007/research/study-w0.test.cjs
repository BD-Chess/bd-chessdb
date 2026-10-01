const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const base = path.resolve(__dirname, '..');
const KEY = 'ChessBest:LAB:v2:studies';
function lockManager() {
  let queue = Promise.resolve();
  return { request(name, options, fn) { const task = queue.then(fn || options); queue = task.catch(() => {}); return task; } };
}
function memory() {
  const map = new Map();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map };
}
function setup({ storage = memory(), locks = lockManager(), saved, draftStorage = memory() } = {}) {
  const dom = new JSDOM('<!doctype html><body><button id="trigger">Study</button></body>', { url: 'https://fixture.test/chess/new/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  for (const name of ['chess.min.js', '8zc-study-core.js', '8zc-study-store.js', '8zc-study-ui.js']) w.eval(fs.readFileSync(path.join(base, 'js', name), 'utf8'));
  if (saved) storage.setItem(KEY, saved);
  const main = new w.Chess(), downloads = [];
  w.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:synthetic'; }; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  const context = () => ({ fen: main.fen(), startFen: main.header().FEN || w.ChessStudy.START_FEN, history: main.history({ verbose: true }), pgn: main.pgn(), analysis: { receipt: { fen: main.fen() }, candidates: [] } });
  const ui = w.ChessStudyUI.create({ Chess: w.Chess, mount: w.document.body, storage, draftStorage, locks, getContext: context });
  return { dom, w, ui, main, context, storage, locks, draftStorage, downloads,
    state: () => JSON.parse(ui.exportJSON()), close: () => { ui.destroy(); w.close(); } };
}
function button(h, text) { const b = [...h.w.document.querySelectorAll('button')].find(x => x.textContent === text); assert(b, text); return b; }
async function tick() { await new Promise(r => setTimeout(r, 0)); }
async function fill(h, count = 20) { for (let i = 0; i < count; i++) assert((await h.ui.importPGN('[Event "Duplicate"]\n1. e4 {original} (1. d4 $1) *')).ok); }
async function remove(h, ids, all = false) {
  h.ui.manage();
  if (all) button(h, `Remove all studies (${h.state().studies.length})`).click();
  else {
    for (const id of ids) { const c = [...h.w.document.querySelectorAll('.chess-capacity-row input')].find(x => x.value === id); c.checked = true; c.dispatchEvent(new h.w.Event('change')); }
    button(h, 'Remove selected Studies').click();
  }
  button(h, 'Confirm removal').click(); await tick();
}
test('19/20/21 capacity: direct actions, original pending line, exactly-once resume, reload', async t => {
  const h = setup(); t.after(h.close); await fill(h, 19); assert.equal(h.state().studies.length, 19);
  await h.ui.newStudy(); h.main.move('d4'); assert.equal(h.state().studies.length, 20);
  const result = await h.ui.newStudy(); assert.equal(result.code, 'CAPACITY');
  for (const name of ['Export studies', 'Remove selected Studies', 'Remove all studies (20)', 'Cancel / keep current work', 'Continue pending action']) button(h, name);
  const op = h.ui.getPending(); h.main.move('d5'); const board = h.main.fen();
  await remove(h, [h.state().studies[0].id]);
  await Promise.all([h.ui.resumePending(), h.ui.resumePending()]);
  assert.equal(h.state().studies.length, 20); assert.equal(h.main.fen(), board);
  const added = h.state().studies.find(x => x.id === op.study.id);
  assert(added); assert.match(h.w.ChessStudy.toPGN(h.w.Chess, added), /d4/); assert.doesNotMatch(h.w.ChessStudy.toPGN(h.w.Chess, added), /d5/);
  assert.equal(h.ui.getPending(), null);
  const second = setup({ storage: h.storage, locks: h.locks }); t.after(second.close);
  assert.deepEqual(second.state().studies, h.state().studies);
});
test('export in capacity popup produces complete bytes, A/B and branches; no deletion/resume', async t => {
  const h = setup(); t.after(h.close); await fill(h); await h.ui.pin('A'); await h.ui.newStudy();
  const before = h.ui.exportJSON(); button(h, 'Export studies').click(); await tick();
  const reader = new h.w.FileReader(); const text = await new Promise(resolve => { reader.onload = () => resolve(reader.result); reader.readAsText(h.downloads[0]); });
  assert.deepEqual(JSON.parse(text), JSON.parse(before)); assert.equal(h.state().studies.length, 20); assert(h.ui.getPending());
  const fresh = setup(); t.after(fresh.close); assert((await fresh.ui.importJSON(text)).ok);
  assert.deepEqual(fresh.state().studies, h.state().studies); assert.deepEqual(fresh.state().comparison, h.state().comparison);
});
test('selected stable ID deletion, cancel, all-delete scope, A/B retention and undo', async t => {
  const h = setup(); t.after(h.close); await fill(h, 3); await h.ui.pin('A');
  const untouched = ['chessLabStudy-v1', 'ChessBest-sim-v1-fallback', '8zc.evidence.v1', 'chessLabSettings-v8', 'ChessBest:LAB:v2:sim-fallback', 'ChessBest:LAB:v2:evidence'];
  untouched.forEach(k => h.storage.setItem(k, 'sentinel:' + k)); const comparison = h.state().comparison;
  h.ui.manage(); button(h, 'Remove all studies (3)').click(); button(h, 'Cancel removal').click(); assert.equal(h.state().studies.length, 3);
  const before = h.state().studies, id = before[1].id;
  await remove(h, [id]); assert.deepEqual(h.state().studies.map(x => x.id), [before[0].id, before[2].id]);
  button(h, 'Undo last removal').click(); await tick(); assert.equal(h.state().studies.length, 3);
  await remove(h, [], true); assert.equal(h.state().studies.length, 0); assert.deepEqual(h.state().comparison, comparison);
  untouched.forEach(k => assert.equal(h.storage.getItem(k), 'sentinel:' + k));
  button(h, 'Undo last removal').click(); await tick(); assert.equal(h.state().studies.length, 3); assert.deepEqual(h.state().comparison, comparison);
  await remove(h, [], true);
  const reloaded = setup({ storage: h.storage, locks: h.locks }); t.after(reloaded.close);
  reloaded.ui.manage(); button(reloaded, 'Undo last removal').click(); await tick();
  assert.equal(reloaded.state().studies.length, 3); assert.deepEqual(reloaded.state().comparison, comparison);
});
test('atomic multi-import validates later corrupt record before commit; capacity retains entire import', async t => {
  const donor = setup(); t.after(donor.close); await fill(donor, 2); const collection = donor.state();
  const h = setup(); t.after(h.close); await fill(h, 19); const original = h.storage.getItem(KEY);
  const bad = JSON.parse(JSON.stringify(collection)); bad.studies[1].nodes.root.fen = 'bad';
  assert.throws(() => h.ui.importJSON(JSON.stringify(bad))); assert.equal(h.storage.getItem(KEY), original);
  assert.equal((await h.ui.importJSON(JSON.stringify(collection))).code, 'CAPACITY'); assert.equal(h.storage.getItem(KEY), original);
  await remove(h, [h.state().studies[0].id]); await h.ui.resumePending(); assert.equal(h.state().studies.length, 20);
});
test('existing branch allowed at capacity; Deep, new, PGN, JSON and context capture share manager', async t => {
  for (const kind of ['new', 'pgn', 'json', 'line', 'record', 'capture']) {
    const h = setup(); t.after(h.close); await fill(h);
    assert((await h.ui.saveLine({ fen: h.w.ChessStudy.START_FEN, moves: ['c2c4'] })).ok);
    assert.equal(h.state().studies.length, 20);
    const other = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
    if (kind === 'capture') h.main.load(other);
    const actions = {
      new: () => h.ui.newStudy(), pgn: () => h.ui.importPGN('1. c4 *'),
      json: () => h.ui.importJSON(JSON.stringify(h.w.ChessStudy.create(h.w.Chess))),
      line: () => h.ui.saveLine({ fen: other, moves: ['g6g7'] }),
      record: () => h.ui.recordPosition({ fen: other, startFen: other, moves: [] }),
      capture: () => h.ui.captureContext()
    };
    assert.equal((await actions[kind]()).code, 'CAPACITY', kind); assert(h.w.document.querySelector('[role=dialog]').textContent.includes('Export studies'));
  }
});
test('stale-tab removal fails safely and retry succeeds; simultaneous adds serialize without loss', async t => {
  const storage = memory(), locks = lockManager(), a = setup({ storage, locks }), b = setup({ storage, locks }); t.after(a.close); t.after(b.close);
  await fill(a, 2); a.ui.manage(); const id = a.state().studies[0].id;
  const c = a.w.document.querySelector('.chess-capacity-row input'); c.checked = true; c.dispatchEvent(new a.w.Event('change'));
  button(a, 'Remove selected Studies').click(); await b.ui.importPGN('1. d4 *');
  button(a, 'Confirm removal').click(); await tick(); assert.equal(a.state().studies.length, 3); assert(a.state().studies.some(x => x.id === id));
  assert.match(a.w.document.body.textContent, /CONFLICT/);
  await remove(a, [id]); assert.equal(a.state().studies.length, 2);
  await Promise.all([a.ui.importPGN('1. c4 *'), b.ui.importPGN('1. Nf3 *')]); a.ui.refresh(); assert.equal(a.state().studies.length, 4);
});
test('quota, read failure and unavailable locks never claim durable save or overwrite original', async t => {
  for (const mode of ['quota', 'read', 'locks']) {
    const storage = memory(), h = setup({ storage, locks: mode === 'locks' ? {} : lockManager() }); t.after(h.close);
    const set = storage.setItem; if (mode === 'quota') storage.setItem = () => { throw Object.assign(Error('full'), { name: 'QuotaExceededError' }); };
    if (mode === 'read') storage.getItem = () => { throw Error('read disabled'); };
    const result = await h.ui.newStudy(); assert.equal(result.ok, false); assert.equal(result.code, mode === 'quota' ? 'QUOTA' : 'STORAGE_UNAVAILABLE');
    assert(h.ui.getPending()); storage.setItem = set; assert(!storage.map.has(KEY));
  }
});
test('recovery-write failure requires separate explicit confirmation; original remains until then', async t => {
  const h = setup(); t.after(h.close); await fill(h, 2); const original = h.storage.getItem(KEY), set = h.storage.setItem;
  h.storage.setItem = (k,v) => { if (k.includes(':undo:')) throw Error('full'); return set(k,v); };
  await remove(h, [], true); assert.equal(h.storage.getItem(KEY), original); button(h, 'Export studies');
  button(h, 'Cancel removal').click(); assert.equal(h.storage.getItem(KEY), original);
  await remove(h, [], true); button(h, 'Remove without recovery').click(); await tick(); assert.equal(h.state().studies.length, 0);
});
test('pending draft reload, cancellation, focus return and background modal deduplication', async t => {
  const h = setup(); t.after(h.close); await fill(h); h.w.document.getElementById('trigger').focus();
  await Promise.all([h.ui.newStudy(), h.ui.newStudy()]); const op = h.ui.getPending();
  assert(op); assert.equal(h.w.document.querySelectorAll('[role=dialog]').length, 1);
  const next = setup({ storage: h.storage, locks: h.locks, draftStorage: h.draftStorage }); t.after(next.close);
  assert.equal(next.ui.getPending().id, op.id); next.ui.manage(); button(next, 'Cancel / keep current work').click();
  assert.equal(next.ui.getPending().id, op.id); assert.equal(next.state().studies.length, 20);
  next.w.confirm=()=>true; next.ui.manage(); button(next, 'Discard pending draft').click(); assert.equal(next.ui.getPending(),null);
  h.ui.close(); assert.equal(h.w.document.activeElement.id, 'trigger');
});
test('malformed restored draft cannot write an invalid Study or delete a collection', async t => {
  const h = setup(); t.after(h.close); await fill(h, 1); const original = h.storage.getItem(KEY);
  assert.throws(() => h.ui.importJSON(JSON.stringify({ schema:'chess-lab-pending',version:1,operation:{type:'remove',ids:[h.state().studies[0].id]} })));
  h.ui.importJSON(JSON.stringify({schema:'chess-lab-pending',version:1,operation:{type:'append',id:'invalid-draft-1',baseRevision:1,study:{id:'bad'}}}));
  await assert.rejects(h.ui.resumePending()); assert.equal(h.storage.getItem(KEY), original);
});
test('importing legacy Studies preserves source bytes and old-reader compatibility', async t => {
  const donor = setup(); t.after(donor.close); await fill(donor, 2); const old = donor.ui.exportJSON();
  const h = setup(); t.after(h.close); h.storage.setItem('chessLabStudy-v1', old); assert.equal(h.state().studies.length, 0);
  assert((await h.ui.importJSON(old)).ok);
  assert.equal(h.state().studies.length, 2); assert.equal(h.storage.getItem('chessLabStudy-v1'), old);
  const legacy = new JSDOM('<body/>',{url:'https://fixture.test/chess/',runScripts:'outside-only'});
  t.after(()=>legacy.window.close());
  for (const name of ['chess.min.js','8zc-study-core.js','8zc-study-ui.js']) legacy.window.eval(fs.readFileSync(path.resolve(base,'../js',name),'utf8'));
  legacy.window.localStorage.setItem('chessLabStudy-v1',old);
  const ui=legacy.window.ChessStudyUI.create({getContext:()=>({fen:new legacy.window.Chess().fen(),moves:[]})});
  assert.equal(JSON.parse(ui.exportJSON()).studies.length,2); ui.destroy();
});
module.exports = { setup, lockManager, memory, fill, tick };
test('baseline reproduction: CURRENT 21st Study is a dead-end limit; source stays at 20', t => {
  const dom = new JSDOM('<body/>', { url: 'https://fixture.test/chess/', runScripts: 'outside-only' }); t.after(() => dom.window.close());
  const w = dom.window;
  for (const name of ['chess.min.js', '8zc-study-core.js', '8zc-study-ui.js']) w.eval(fs.readFileSync(path.resolve(base, '../js', name), 'utf8'));
  const ui = w.ChessStudyUI.create({ getContext: () => ({ fen: new w.Chess().fen(), moves: [] }) }); t.after(ui.destroy);
  for (let i = 0; i < 20; i++) ui.importPGN('1. e4 *');
  assert.throws(() => ui.importPGN('1. d4 *'), /20|limit/i);
  assert.equal(JSON.parse(ui.exportJSON()).studies.length, 20);
  assert.doesNotMatch(w.document.body.textContent, /Continue pending action/);
});
test('queued position captures keep one Study and retain both frozen move paths', async t => {
  const h = setup(); t.after(h.close);
  h.main.move('e4'); const first = h.ui.captureContext();
  h.main.move('e5'); const second = h.ui.captureContext();
  assert((await first).ok); assert((await second).ok); assert.equal(h.state().studies.length, 1);
  assert.match(h.ui.exportPGN(), /e4 1\.\.\. e5/);
});

test('PGN host completion runs once after immediate save and deferred resume, even when it throws', async t => {
  const h = setup(); t.after(h.close); const calls = [];
  assert((await h.ui.importPGN('1. e4 *', { onCommitted: result => calls.push(result.ok) })).ok);
  assert.deepEqual(calls, [true]); await fill(h, 19);
  const result = await h.ui.importPGN('1. d4 d5 *', { onCommitted: () => { calls.push('resumed'); throw Error('host refused'); } });
  assert.equal(result.code, 'CAPACITY'); assert.equal(calls.length, 1);
  await remove(h, [h.state().studies[0].id]);
  await Promise.all([h.ui.resumePending(), h.ui.resumePending()]);
  assert.deepEqual(calls, [true, 'resumed']); assert.equal(h.state().studies.length, 20); assert.equal(h.ui.getPending(), null);
  assert.match(h.w.document.body.textContent, /saved.*failed/i);
});
test('pending save does not hide a failed removal or a recovery failure', async t => {
  const h = setup(); t.after(h.close); await fill(h); await h.ui.newStudy();
  const original = h.storage.getItem(KEY), set = h.storage.setItem;
  h.storage.setItem = (k,v) => { if (k.includes(':undo:')) throw Error('full'); return set(k,v); };
  await remove(h, [], true);
  assert.equal(h.storage.getItem(KEY), original); assert(h.ui.getPending());
  button(h, 'Remove without recovery'); assert.match(h.w.document.body.textContent, /RECOVERY_UNAVAILABLE/);
  button(h, 'Cancel removal').click();
});
test('quota during multi-import leaves exact durable and visible collection unchanged', async t => {
  const donor = setup(); t.after(donor.close); await fill(donor, 2);
  const h = setup(); t.after(h.close); await fill(h, 2);
  const original = h.storage.getItem(KEY), visible = h.ui.exportJSON(), set = h.storage.setItem;
  h.storage.setItem = (k,v) => { if (k === KEY) throw Object.assign(Error('quota'), { name:'QuotaExceededError' }); return set(k,v); };
  const result = await h.ui.importJSON(donor.ui.exportJSON());
  assert.equal(result.code,'QUOTA'); assert.equal(h.storage.getItem(KEY),original); assert.equal(h.ui.exportJSON(),visible);
  h.storage.setItem = set; await h.ui.resumePending(); assert.equal(h.state().studies.length,4);
});
test('readback failure never acknowledges a missing durable write', async t => {
  const h = setup(); t.after(h.close); const set = h.storage.setItem;
  h.storage.setItem = (k,v) => { if (k !== KEY) set(k,v); };
  const result = await h.ui.importPGN('1. e4 *'); assert.equal(result.ok,false); assert.equal(result.code,'STORAGE_UNAVAILABLE');
  assert.equal(h.state().studies.length,0); assert(h.ui.getPending());
});
test('failed deletion keeps prior committed undo, while no-recovery removal cannot expose it as new undo', async t => {
  const h = setup(); t.after(h.close); await fill(h,3); await remove(h,[h.state().studies[0].id]);
  const original = h.storage.getItem(KEY), set = h.storage.setItem;
  h.storage.setItem = (k,v) => { if (k === KEY) throw Object.assign(Error('quota'),{name:'QuotaExceededError'}); return set(k,v); };
  await remove(h,[h.state().studies[0].id]); assert.equal(h.storage.getItem(KEY),original);
  h.storage.setItem=set; button(h,'Undo last removal').click(); await tick();
  assert.equal(h.state().studies.length,3, 'prior committed removal remains recoverable after a later failed deletion');
  h.storage.setItem=(k,v)=>{if(k.includes(':undo:'))throw Error('full');return set(k,v);};
  await remove(h,[],true);button(h,'Remove without recovery').click();await tick();
  assert.equal(h.state().studies.length,0);button(h,'Undo last removal').click();await tick();assert.equal(h.state().studies.length,0);
});

test('uncertain committed save cannot duplicate after its bounded receipt history is evicted', async t => {
  const storage = memory(), locks = lockManager(), h = setup({ storage, locks }); t.after(h.close);
  const set = storage.setItem, get = storage.getItem; let failReadback = false, armed = true;
  storage.setItem = (k,v) => { set(k,v); if (k === KEY && armed) { armed = false; failReadback = true; } };
  storage.getItem = k => { if (k === KEY && failReadback) { failReadback = false; throw Error('readback interrupted'); } return get(k); };
  const uncertain = await h.ui.importPGN('1. d4 d5 *'); assert.equal(uncertain.code,'STORAGE_UNAVAILABLE');
  const op = h.ui.getPending(); assert.equal(op.baseRevision,0); assert.equal(JSON.parse(get(KEY)).studies.length,1);
  const peer = setup({ storage, locks }); t.after(peer.close);
  for (let i=0;i<65;i++) await peer.ui.pin('A');
  const before = get(KEY); assert.equal(JSON.parse(before).appliedOperations.length,64); assert(!JSON.parse(before).appliedOperations.includes(op.id));
  await h.ui.resumePending();
  assert.equal(get(KEY),before); assert.equal(h.state().studies.length,1); assert.equal(h.ui.getPending().id,op.id);
  assert.match(h.w.document.body.textContent,/STALE_OPERATION/);
});
test('uncertain save within receipt window resumes without duplicating the record', async t => {
  const h=setup();t.after(h.close);const set=h.storage.setItem,get=h.storage.getItem;let fail=false,armed=true;
  h.storage.setItem=(k,v)=>{set(k,v);if(k===KEY&&armed){armed=false;fail=true;}};
  h.storage.getItem=k=>{if(k===KEY&&fail){fail=false;throw Error('readback');}return get(k);};
  let completed=0;assert.equal((await h.ui.importPGN('1. e4 *',{onCommitted:()=>completed++})).code,'STORAGE_UNAVAILABLE');
  await h.ui.resumePending();assert.equal(h.state().studies.length,1);assert.equal(h.ui.getPending(),null);assert.equal(completed,1);
});

test('queued capture remains bound to selected Study when active selection changes before lock execution', async t => {
  const h=setup();t.after(h.close);await h.ui.importPGN('[Event "A"]\n1. e4 *');const a=h.state().activeId;
  await h.ui.importPGN('[Event "B"]\n1. d4 *');const b=h.state().activeId;
  h.ui.open('study',false);const select=h.w.document.querySelector('[aria-label="Saved study"]');select.value=a;select.dispatchEvent(new h.w.Event('change'));await tick();
  h.main.move('Nf3');const work=h.ui.recordPosition(h.context());
  const next=h.w.document.querySelector('[aria-label="Saved study"]');next.value=b;next.dispatchEvent(new h.w.Event('change'));
  await work;await tick();h.ui.refresh();
  const A=h.state().studies.find(s=>s.id===a),B=h.state().studies.find(s=>s.id===b);
  assert.match(h.w.ChessStudy.toPGN(h.w.Chess,A),/Nf3/);assert.doesNotMatch(h.w.ChessStudy.toPGN(h.w.Chess,B),/Nf3/);
});
test('exported uncertain pending import preserves operation identity and cannot duplicate an already committed save', async t => {
  const h=setup();t.after(h.close);const set=h.storage.setItem,get=h.storage.getItem;let fail=false,armed=true;
  h.storage.setItem=(k,v)=>{set(k,v);if(k===KEY&&armed){armed=false;fail=true;}};
  h.storage.getItem=k=>{if(k===KEY&&fail){fail=false;throw Error('readback');}return get(k);};
  assert.equal((await h.ui.importPGN('1. e4 *')).code,'STORAGE_UNAVAILABLE');const original=h.ui.getPending();
  const peer=setup({storage:h.storage,locks:h.locks});t.after(peer.close);
  peer.ui.importJSON(JSON.stringify({schema:'chess-lab-pending',version:1,operation:original}));
  assert.equal(peer.ui.getPending().id,original.id);assert.equal(peer.ui.getPending().baseRevision,original.baseRevision);
  await peer.ui.resumePending();assert.equal(peer.state().studies.length,1);assert.equal(peer.ui.getPending(),null);
});
test('workspace PGN capture plus annotations commits atomically to frozen Study and retains alternatives', async t => {
  const h=setup();t.after(h.close);await h.ui.importPGN('[Event "A"]\n1. e4 (1. d4 d5) e5 *');const id=h.state().activeId;
  h.main.move('e4');h.main.move('e5');h.main.move('Nf3');
  const peer=setup({storage:h.storage,locks:h.locks});t.after(peer.close);await peer.ui.importPGN('[Event "B"]\n1. c4 *');
  const result=await h.ui.exportWorkspacePGN(h.context(),{moves:['e2e4','e7e5','g1f3'],comments:['first','','third']});
  assert.equal(result.ok,true);assert.equal(result.studyId,id);assert.match(result.pgn,/d4/);assert.match(result.pgn,/third/);assert.doesNotMatch(result.pgn,/c4/);
  assert.equal(result.pgn,h.w.ChessStudy.toPGN(h.w.Chess,h.state().studies.find(s=>s.id===id)));
  const before=h.storage.getItem(KEY),set=h.storage.setItem;h.main.move('Nc6');
  h.storage.setItem=(k,v)=>{if(k===KEY)throw Object.assign(Error('quota'),{name:'QuotaExceededError'});return set(k,v);};
  const failed=await h.ui.exportWorkspacePGN(h.context(),{comments:['','','','fourth']});
  assert.equal(failed.ok,false);assert.equal(failed.pgn,undefined);assert.equal(h.storage.getItem(KEY),before);assert.equal(h.ui.getPending().type,'recordAnnotated');
});

test('Study edit survives unrelated-tab writes and conflict/review/retry never reports unsaved text as saved', async t => {
  const storage=memory(),locks=lockManager(),a=setup({storage,locks}),b=setup({storage,locks});t.after(a.close);t.after(b.close);
  await a.ui.importPGN('1. e4 *');const id=a.state().activeId;a.ui.open('study',false);
  const field=()=>[...a.w.document.querySelectorAll('.chess-study-label')].find(x=>x.firstChild.textContent==='Comments').querySelector('textarea');
  await b.ui.importPGN('1. d4 *');field().value='survives unrelated tab';button(a,'Save annotation').click();await tick();
  assert(JSON.stringify(JSON.parse(storage.getItem(KEY)).studies.find(x=>x.id===id)).includes('survives unrelated tab'));
  const nodeId=a.state().studies.find(x=>x.id===id).selectedId;
  const C=b.w.ChessStudyStore,store=C.create({C:b.w.ChessStudy,Chess:b.w.Chess,storage,locks});
  await store.execute({id:'peer-edit',baseRevision:store.get().revision,type:'edit',studyId:id,nodeId,annotation:{comment:'peer newer analysis'}});
  const input=field();input.value='my retained analysis';button(a,'Save annotation').click();await tick();
  assert.match(a.w.document.querySelector('.chess-study-status').textContent,/CONFLICT.*peer newer analysis/);
  assert.equal(input.value,'my retained analysis');assert(!JSON.stringify(JSON.parse(storage.getItem(KEY)).studies.find(x=>x.id===id)).includes('my retained analysis'));
  button(a,'Save annotation').click();await tick();
  assert.match(a.w.document.querySelector('.chess-study-status').textContent,/Annotation saved/);
  assert(JSON.stringify(JSON.parse(storage.getItem(KEY)).studies.find(x=>x.id===id)).includes('my retained analysis'));
});
test('pending Undo freezes its original removal even when freeing capacity replaces current recovery', async t => {
  const h=setup();t.after(h.close);await fill(h);const [original,other]=h.state().studies.map(s=>s.id);
  await remove(h,[original]);await h.ui.newStudy();h.ui.manage();button(h,'Undo last removal').click();await tick();
  const pending=h.ui.getPending();assert.equal(pending.type,'undo');assert(JSON.parse(pending.recovery).studies.some(s=>s.id===original));
  await remove(h,[other]);await h.ui.resumePending();
  assert(h.state().studies.some(s=>s.id===original));assert(!h.state().studies.some(s=>s.id===other));assert.equal(h.ui.getPending(),null);
});

test('saving a preview annotation or main variation keeps that node selected; title edit preserves it', async t => {
  const h=setup();t.after(h.close);await h.ui.importPGN('1. e4 (1. d4 d5) e5 *');h.ui.open('study',false);
  button(h,'1. d4').click();const selected=h.ui.getStudy().selectedId;
  assert.notEqual(JSON.parse(h.storage.getItem(KEY)).studies[0].selectedId,selected);
  const field=label=>[...h.w.document.querySelectorAll('.chess-study-label')].find(x=>x.firstChild.textContent===label);
  field('Comments').querySelector('textarea').value='selected branch note';button(h,'Save annotation').click();await tick();
  assert.equal(h.ui.getStudy().selectedId,selected);assert.equal(JSON.parse(h.storage.getItem(KEY)).studies[0].selectedId,selected);
  assert.equal(field('Comments').querySelector('textarea').value,'selected branch note');
  const title=field('Study name').querySelector('input');title.value='renamed';title.dispatchEvent(new h.w.Event('change'));await tick();
  assert.equal(h.ui.getStudy().selectedId,selected);button(h,'Make this the main variation').click();await tick();
  const saved=h.ui.getStudy();assert.equal(saved.nodes[saved.selectedId].move,'d2d4');assert.equal(saved.nodes[saved.selectedId].comments[0],'selected branch note');assert.equal(saved.nodes.root.children[0],saved.selectedId);
});
