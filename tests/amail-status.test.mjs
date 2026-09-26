import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validatePair, validateAMAIL } from '../scripts/validate-amail-status.mjs';
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const amail = JSON.parse(read('../public/data/AMAIL_STATUS.json'));
const preai = JSON.parse(read('../public/data/PREAI8_STATUS.json'));
const copy = x => JSON.parse(JSON.stringify(x));

test('published pair has compatible frontiers and honest counts', () => assert.equal(validatePair(amail, preai), true));
test('truncated JSON cannot be parsed', () => assert.throws(() => JSON.parse(JSON.stringify(amail).slice(0, -1)), SyntaxError));
test('incomplete counts cannot masquerade as complete or acquire cadence', () => {
  const d = copy(amail); d.runs[0].mean_interval_seconds = 0;
  assert.throws(() => validateAMAIL(d), /invented cadence/);
  const p = copy(preai); p.email_plane.A.verified_turn--;
  assert.throws(() => validatePair(amail, p), /frontier disagrees/);
});
test('duplicate lines and nonconsecutive recent turns are rejected', () => {
  const d = copy(amail); d.runs[1].id = 'A'; assert.throws(() => validateAMAIL(d), /Duplicate/);
  const e = copy(amail); e.runs[0].recent_turns[1] += 1; assert.throws(() => validateAMAIL(e), /cadence crosses/);
});

function reader() {
  const nodes = new Map(['cpMailCount','cpActive','cpAttention','cpFresh','cpAlert','cpControl'].map(id => [id, { textContent: '' }]));
  nodes.set('cockpit', { dataset: { view: 'technical' } }); nodes.set('app', { hidden: false });
  const context = { TextEncoder, TextDecoder, URL, Date, document: { getElementById: id => nodes.get(id), currentScript: { src: 'https://example.test/WL/cockpit-core.js' } }, location: { href: 'https://example.test/WL/' } };
  // Exercise the real reader functions without starting network polling or decrypting the private journal.
  const code = read('../public/WL/cockpit-core.js').replace("$('cpFilter')?.addEventListener", "globalThis.api={healthy,render,countText,setSnapshot:x=>snapshot=x,setControl:x=>control=x};return;\n$('cpFilter')?.addEventListener");
  vm.runInNewContext(code, context); return { ...context.api, nodes };
}
test('reader distinguishes waits, reported transport block, expiry and activity', () => {
  const r = reader(), data = copy(amail); data.sources.email.checked_at = new Date().toISOString(); r.setSnapshot(data);
  assert.equal(r.healthy(data.runs.find(x => x.id === 'A')).label, 'PRIJAVLJENA BLOKADA');
  assert.equal(r.healthy(data.runs.find(x => x.id === 'D')).label, 'ČAKA NA VHOD');
  assert.equal(r.healthy(data.runs.find(x => x.id === 'D')).active, false);
  assert.equal(r.healthy(data.runs.find(x => x.id === 'F')).label, 'PREMOR');
  assert.equal(r.healthy({ expiry: '2000-01-01T00:00:00Z' }, true).label, 'OKNO POTEKLO');
  const x = copy(data.runs[0]); x.research = {}; x.transport = {}; x.scheduler.state = 'enabled'; x.last_at = null;
  assert.equal(r.healthy(x).label, 'NI PREVERJENO');
});
test('new generation time cannot hide stale source observation; lower bounds render', () => {
  const r = reader(), data = copy(amail); data.generated_at = new Date().toISOString(); data.sources.email.checked_at = '2000-01-01T00:00:00Z';
  r.setSnapshot(data); assert.equal(r.healthy(data.runs[0]).label, 'ZASTAREL POGLED'); r.render();
  assert.match(r.nodes.get('cpMailCount').textContent, /^≥ /);
  assert.equal(r.nodes.get('cpActive').textContent, '0 / 8');
  assert.match(r.nodes.get('cpFresh').textContent, /starost vira/);
  assert.equal(r.nodes.get('cpControl').textContent, 'OKNO POTEKLO');
});
