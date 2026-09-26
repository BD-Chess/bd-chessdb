const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const before = require('./fixtures/sudoku-navigator-v020.cjs');

const html = fs.readFileSync(path.resolve(__dirname, '../public/S/new/app.html'), 'utf8');
const core = html.match(/<script id="navigator-core">([\s\S]*?)<\/script>/);
assert(core, 'standalone page contains its proof engine');
const context = { module: { exports: {} } };
vm.runInNewContext(core[1], context);
const C = context.module.exports;
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

// Fixed positions exercise direct singles, hidden singles and later logical paths.
const puzzles = [
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
  '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
  '200080300060070084030500209000105408000000000402706000301007040720040060004010003',
  '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
  '100007090030020008009600500005300900010080002600004000300000010040000007007000300',
];

test('P0 support index preserves every original certificate and direct review', () => {
  for (const puzzle of puzzles) {
    const s = C.state(puzzle), old = before.state(puzzle);
    const direct = C.enumerate(s, 'P0', new C.Work(100000), 512).out;
    same(direct, before.enumerate(old, 'P0', new before.Work(100000), 512).out);
    if (direct.length) {
      const { c, v } = direct[0];
      const a = before.review(old, c, v), b = C.review(s, c, v);
      assert(a.found && b.found);
      same(a.path, b.path);
      assert.equal(b.reasoning_status, 'UNKNOWN_REASONING');
    }
  }
});

test('all controllers admit independently checked hints; singles skip speculative ranking', () => {
  for (const puzzle of puzzles) {
    const s = C.state(puzzle), results = [];
    for (const policy of ['REAL', 'OFF', 'ORDINARY', 'SHAM']) {
      const r = C.search(s, { policy });
      assert(r.work <= 180000);
      assert.equal(r.work, Object.values(r.counts).reduce((a, b) => a + b, 0));
      assert(r.candidates.length);
      assert.equal(r.measured, 0);
      assert.equal(r.changed, false);
      assert.equal(r.chosen, r.baseline);
      for (const candidate of r.candidates) {
        assert(C.check(s, candidate.q));
        assert(C.check(s, C.decode(candidate.bytes)));
        C.validate(C.apply(s, candidate.q));
      }
      results.push(r);
    }
    assert(results.every(r => r.chosen === results[0].chosen));
    assert.equal(results[0].work, results[3].work, 'REAL and SHAM have matched P0 work');
  }
});

test('logical paths remain valid across successive candidate eliminations', () => {
  let checked = 0;
  for (const puzzle of puzzles) {
    let s = C.state(puzzle);
    for (let step = 0; step < 90; step++) {
      let q = null;
      for (const family of ['P0', 'P1', 'P2', 'P3']) {
        const scan = C.enumerate(s, family, new C.Work(250000));
        if (scan.out.length) { q = scan.out[0]; break; }
      }
      if (!q) break;
      assert(C.check(s, q));
      s = C.apply(s, q);
      C.validate(s);
      checked++;
    }
  }
  assert(checked > 150, 'exercise substantial real proof paths');
});

test('naked and hidden quads have independently checked certificates and reject tampering', () => {
  const naked = C.state(Array(81).fill(0));
  for (let c = 0; c < 4; c++) naked.m[c] = [3, 6, 12, 9][c];
  const hidden = C.state(Array(81).fill(0));
  for (let c = 0; c < 4; c++) hidden.m[c] = [19, 38, 76, 137][c];
  for (let c = 4; c < 9; c++) hidden.m[c] = 496;
  for (const [name, s, technique] of [['naked', naked, 4], ['hidden', hidden, 5]]) {
    C.validate(s);
    const q = C.enumerate(s, 'P2', new C.Work(1000000), 512).out.find(
      q => q.t === technique && q.u === 0 && q.ds.length === 4,
    );
    assert(q, `${name} quad must be found`);
    assert(C.check(s, q));
    assert(C.check(s, C.decode(C.encode(q))));
    C.validate(C.apply(s, q));
    const badDigits = JSON.parse(JSON.stringify(q));
    badDigits.ds[3] = 9;
    assert.equal(C.check(s, badDigits), false);
    const badEffect = JSON.parse(JSON.stringify(q));
    badEffect.es.push([80, 1]);
    assert.equal(C.check(s, badEffect), false);
  }
});

test('zero and partial budgets retain only verified witnesses and censor unfinished observations', () => {
  const s = C.state(puzzles[0]);
  let sawPartial = false;
  for (const budget of [0, 1, 80, 81, 90, 100, 250, 900, 1100, 1500, 2000]) {
    for (const policy of ['OFF', 'REAL', 'SHAM']) {
      const r = C.search(s, { budget, policy });
      assert(r.work <= budget);
      assert.equal(r.work, Object.values(r.counts).reduce((a, b) => a + b, 0));
      if (r.status === 'FOUND_PARTIAL') sawPartial = true;
      for (const candidate of r.candidates) assert(C.check(s, candidate.q));
      for (const event of r.events) {
        if (!event.complete) {
          assert.equal(event.status, 'LIMIT');
          const bank = C.emptyModel();
          C.observe(bank, event);
          assert(bank.models.every(model => model.loss === 0));
        }
      }
    }
  }
  assert(sawPartial, 'test includes budget exhaustion after a valid witness');
  const cap = C.search(C.state(puzzles[3]), { goal: 'PRACTICE', target: 4 });
  assert.equal(cap.status, 'FOUND_PARTIAL');
  assert(cap.candidates.length);
  assert.equal(cap.events[0].status, 'LIMIT', 'proposal-cap truncation is also incomplete');
});

test('legacy observations survive import without fitting incompatible cost measurements', () => {
  assert.equal(C.VERSION, '0.2.0', 'save/import schema remains compatible');
  const event = { id: 'fixture', family: 'P0', ctx: '1.0.0', status: 'FIRE', cost: 200, gain: 3 };
  const legacy = C.restoreModel({ version: C.VERSION, observations: [event] });
  same(legacy.observations, [event]);
  assert(legacy.models.every(model => model.loss === 0));
  const modern = C.emptyModel();
  C.observe(modern, { ...event, costRevision: C.COST_REVISION, complete: true });
  assert(modern.models.every(model => model.loss > 0));
  const truncated = C.emptyModel();
  C.observe(truncated, { ...event, costRevision: C.COST_REVISION, complete: false });
  assert(truncated.models.every(model => model.loss === 0));
  const current = C.search(C.state(puzzles[0]));
  assert(current.events.every(e => e.id.includes(C.COST_REVISION) && e.costRevision === C.COST_REVISION));
});

test('reused consequence scans preserve equal-horizon comparison results', () => {
  let compared = 0;
  for (const puzzle of puzzles) {
    const old = before.state(puzzle), now = C.state(puzzle);
    for (const family of ['P0', 'P1', 'P2']) {
      const q = before.enumerate(old, family).out[0];
      if (!q) continue;
      same(C.consequences(now, q, 3, new C.Work(1000000)), before.consequences(old, q, 3, new before.Work(1000000)));
      compared++;
    }
  }
  assert(compared >= 10);
});
