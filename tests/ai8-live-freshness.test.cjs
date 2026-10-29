'use strict';
// AI8 Live (public/AI8/live/index.html) freshness rules, run with: node tests/ai8-live-freshness.test.cjs
// Heartbeats: »nepotrjeno« after 30 min. Now-list tasks: »nepotrjeno« only after 36 h without evidence.
// Page warning »podatki so morda zastareli«: curated daily document (headline_utc) older than 30 h.
// Based on Lan's freshness R1 view test (test_view.cjs).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'AI8', 'live', 'index.html'), 'utf8');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.value = ''; this.className = ''; }
  set textContent(value) { this.value = String(value); this.children = []; }
  get textContent() { return this.value + this.children.map(c => c.textContent).join(' '); }
  get firstChild() { return this.children[0] || null; }
  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  setAttribute(name, value) { this.attrs[name] = value; }
}
const ids = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Element('div')]));
const document = {
  createElement: tag => new Element(tag),
  createTextNode: text => { const el = new Element('#text'); el.textContent = text; return el; },
  getElementById: id => { assert.ok(ids.has(id), 'Declared DOM id: ' + id); return ids.get(id); }
};
const H = 3600 * 1000, MIN = 60 * 1000;
let now = Date.parse('2026-10-29T20:00:00Z');
const iso = ms => new Date(ms).toISOString();
let rejectFetch = false;
let data;
function fixture() {
  return {
    updated_utc: iso(now - 5 * MIN), headline_utc: iso(now - 12 * H), headline: 'Daily editorial',
    members: [{ name: 'Lan (brat)' }, { name: 'Zora (sestra)' }], done: [], links: [],
    now: [
      { owner: 'Lan', state: 'teče', text: 'Daily task, 12 h old', utc: iso(now - 12 * H) },
      { owner: 'Zora', state: 'čaka', text: 'Daily task, 35 h old', utc: iso(now - 35 * H) },
      { owner: 'Zora', state: 'teče', text: 'Old task, 37 h', utc: iso(now - 37 * H) }
    ],
    hosts: [{ host: 'HOME', observed_utc: iso(now - 10 * MIN), listener_poll_utc: iso(now - 10 * MIN), listener_version: '0.6.7.2', active_debates: 0 }]
  };
}
const window = { document, AI8_NO_AUTOSTART: true, fetch: () => rejectFetch ? Promise.reject(new Error('fixture outage')) : Promise.resolve({ ok: true, json: () => Promise.resolve(data) }) };
class TestDate extends Date { static now() { return now; } }
vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], { window, Intl, Date: TestDate, URL });
const api = window.AI8Live;
(async () => {
  // 1. Daily-curated tasks stay teče/čaka for 36 h; heartbeat fresh (10 min).
  data = fixture();
  await api.load();
  const nowText = ids.get('now').textContent;
  assert.match(nowText, /teče/);
  assert.match(nowText, /čaka/);
  assert.equal((nowText.match(/nepotrjeno/g) || []).length, 1, 'only the 37 h task is unconfirmed');
  assert.match(ids.get('members').textContent, /zdaj: 1 teče · 0 čaka/);
  assert.match(ids.get('members').textContent, /zdaj: 0 teče · 1 čaka · 1 nepotrjeno/);
  assert.match(ids.get('hosts').textContent, /svež utrip/);
  assert.equal(ids.get('pulse').className, 'pulse');
  assert.equal(ids.get('err').textContent, '');

  // 2. Task rule boundaries (36 h), missing/invalid/future stamps.
  assert.equal(api.taskState({ state: 'teče', utc: iso(now - 30 * MIN - 1000) }, now), 'teče', 'tasks ignore the 30 min heartbeat rule');
  assert.equal(api.taskState({ state: 'čaka', utc: iso(now - 36 * H + MIN) }, now), 'čaka');
  assert.equal(api.taskState({ state: 'teče', utc: iso(now - 36 * H - MIN) }, now), 'nepotrjeno');
  assert.equal(api.taskState({ state: 'teče', utc: null }, now, iso(now)), 'nepotrjeno');
  assert.equal(api.taskState({ state: 'teče', utc: 'invalid' }, now), 'nepotrjeno');
  assert.equal(api.taskState({ state: 'teče', utc: iso(now + 2 * H) }, now), 'nepotrjeno');
  assert.equal(api.taskState({ state: 'teče' }, now, iso(now - 20 * H)), 'teče', 'legacy items use the document stamp');

  // 3. Heartbeats keep the 30 min rule.
  assert.equal(api.fresh(iso(now - 29 * MIN), now), true);
  assert.equal(api.fresh(iso(now - 31 * MIN), now), false);
  assert.equal(api.fresh(iso(now + 2 * H), now), false);
  assert.equal(api.fresh('invalid', now), false);
  api.render({ ...data, hosts: [{ ...data.hosts[0], observed_utc: iso(now - 31 * MIN), listener_poll_utc: iso(now - 31 * MIN) }] }, now);
  assert.match(ids.get('hosts').textContent, /nepotrjeno/);
  assert.equal(ids.get('pulse').className, 'pulse stale');
  assert.equal((ids.get('now').textContent.match(/nepotrjeno/g) || []).length, 1, 'stale heartbeat does not touch tasks');
  api.render({ ...data, hosts: [{ ...data.hosts[0], reported_health: 'STALE' }] }, now);
  assert.match(ids.get('hosts').textContent, /nepotrjeno/);

  // 4. Page warning follows the daily document (headline_utc) vs 30 h, not heartbeats or updated_utc.
  assert.equal(api.dataStale({ headline_utc: iso(now - 29 * H), updated_utc: iso(now - 3 * H) }, now), false);
  assert.equal(api.dataStale({ headline_utc: iso(now - 31 * H), updated_utc: iso(now - 1 * MIN) }, now), true);
  assert.equal(api.dataStale({ updated_utc: iso(now - 31 * H) }, now), true, 'falls back to updated_utc');
  assert.equal(api.dataStale({ updated_utc: iso(now - 2 * H) }, now), false);
  data = { ...fixture(), updated_utc: iso(now - 3 * H), hosts: [{ host: 'HOME', observed_utc: iso(now - 3 * H), listener_poll_utc: iso(now - 3 * H) }] };
  await api.load();
  assert.equal(ids.get('err').textContent, '', 'old heartbeats/updated_utc alone give no page warning');
  data = { ...fixture(), headline_utc: iso(now - 31 * H) };
  await api.load();
  assert.equal(ids.get('err').textContent, 'podatki so morda zastareli');

  // 5. Failed refresh keeps last data and re-renders with current time.
  data = fixture();
  await api.load();
  now += 40 * MIN;
  rejectFetch = true;
  await api.load();
  assert.match(ids.get('hosts').textContent, /nepotrjeno/);
  assert.match(ids.get('now').textContent, /teče/);
  assert.match(ids.get('err').textContent, /osvežitev ni uspela/);
  console.log('PASS: tasks 36 h, heartbeats 30 min, page warning 30 h on daily document, failed refresh');
})().catch(error => { console.error(error); process.exitCode = 1; });
