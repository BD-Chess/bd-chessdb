import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const fixture = JSON.parse(read('tests/fixtures/8zc-v7-reference.json'));
const appSource = read('public/8zC/app.js');
const workerSource = read('public/8zC/worker.js');
const plain = (html) => html.replace(/<[^>]*>/g, '').replace(/[\u202f\u00a0]/g, '');

test('published v7 rows match frozen evidence and add up to their totals', () => {
  const html = read('public/8zC-results/index.html');
  for (const [cohort, expectedRows] of Object.entries(fixture.cohorts)) {
    const table = html.match(new RegExp(`<table data-benchmark-cohort="${cohort}">([\\s\\S]*?)</table>`))?.[1];
    assert.ok(table, cohort);
    const sums = { zip: [0, 0, 0], '7z': [0, 0, 0] };
    for (const row of expectedRows) {
      const rendered = table.match(new RegExp(`<tr[^>]*data-benchmark-tag="${row.tag}"[^>]*>([\\s\\S]*?)</tr>`))?.[1];
      assert.ok(rendered, row.tag);
      const raw = plain(rendered.match(/<th[^>]*>([\s\S]*?)<\/th>/)[1]).match(/\((\d+) B\)/)?.[1];
      assert.equal(Number(raw), row.raw_B, `${row.tag} input bytes`);
      const cells = [...rendered.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => plain(m[1]));
      for (const [codec, cell] of [['zip', 0], ['7z', 2]]) {
        const actual = cells[cell].match(/^(\d+) → (\d+) → (\d+)$/)?.slice(1).map(Number);
        const expected = ['direct_B', 'v6_B', 'v7_B'].map((key) => row[codec][key]);
        assert.deepEqual(actual, expected, `${row.tag} ${codec}`);
        actual.forEach((n, i) => { sums[codec][i] += n; });
        const difference = row[codec].v7_B - row[codec].direct_B;
        const reported = cells[cell + 1].match(/^([−+]?\d+) B/)[1].replace('−', '-');
        assert.equal(Number(reported), difference, `${row.tag} ${codec} saving`);
      }
    }
    const total = table.match(/<tr[^>]*data-benchmark-total="true"[^>]*>([\s\S]*?)<\/tr>/)[1];
    const totalCells = [...total.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => plain(m[1]));
    for (const [codec, cell] of [['zip', 0], ['7z', 2]]) {
      assert.deepEqual(totalCells[cell].match(/^(\d+) → (\d+) → (\d+)/).slice(1).map(Number), sums[codec], `${cohort} ${codec} total`);
    }
  }
});

class Element {
  constructor() { this.children = []; this.value = ''; }
  set textContent(value) { this.value = String(value); this.children = []; }
  get textContent() { return this.value + this.children.map((child) => child.textContent).join(''); }
  appendChild(child) { this.children.push(child); return child; }
}

function appHarness() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() { return new Element(); },
  };
  const context = vm.createContext({ document, localStorage: { getItem: () => 'en' } });
  // Evaluate the production data and rendering functions without registering browser events.
  vm.runInContext(appSource.slice(0, appSource.indexOf('function setLanguage(')), context);
  return { context, elements };
}

test('sample reference sizes retain their recorded codec and source hash', () => {
  const { context } = appHarness();
  const samples = vm.runInContext('QUICK_SAMPLES', context);
  for (const expected of fixture.samples) {
    const actual = samples.find((sample) => sample.filename === expected.filename);
    assert.ok(actual, expected.filename);
    assert.equal(actual.sha256, expected.sha256);
    assert.equal(actual.raw_B, expected.raw_B);
    assert.equal(actual.zip.direct, expected.zip.direct_B);
    assert.equal(actual.zip.best, expected.zip.v7_B);
    assert.equal(actual.sz7z.direct, expected['7z'].direct_B);
    assert.equal(actual.sz7z.best, expected['7z'].v7_B);
  }
});

function renderComparison({ digest, baseline = 8888, sha256Verified = true }) {
  const { context, elements } = appHarness();
  context.data = {
    inputBytes: 80264, inputDigest: digest, restoredDigest: digest,
    verified: true, sha256Verified, browserZipBytes: baseline, z8cZipBytes: 5000,
    encodeMs: 2, decodeMs: 1,
  };
  vm.runInContext('selected = {name: "00_data_endian.elf"}; renderLiveCompare(data)', context);
  return elements;
}

test('live browser baseline stays live even when the input matches a known sample', () => {
  const hash = '7a08d5a9e1e9b2b3556c866df883e58ddbf1879fd7859a5e33845f6560476bcc';
  const elements = renderComparison({ digest: hash });
  const rows = elements.get('live-compare-body').children;
  assert.equal(rows[0].children[2].textContent, '8,888 B');
  assert.equal(rows[1].children[2].textContent, '15,976 B');
  assert.match(rows[1].children[0].textContent, /Recorded/);
});

test('same filename and length cannot attach another file’s historical results', () => {
  const elements = renderComparison({ digest: '0'.repeat(64) });
  assert.equal(elements.get('live-compare-body').children.length, 1);
});

test('missing browser Deflate or SHA-256 is shown as unavailable', () => {
  const elements = renderComparison({ digest: '', baseline: null, sha256Verified: false });
  const rows = elements.get('live-compare-body').children;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].children[2].textContent, '—');
  assert.match(elements.get('live-verify-line').textContent, /All restored bytes match.*SHA-256 unavailable/);
});

async function workerComparison(restored, withCrypto) {
  const input = new Uint8Array([1, 2, 3, 4]);
  const memory = { buffer: new ArrayBuffer(65536) };
  let size = 0;
  const writeResult = (bytes) => {
    new Uint8Array(memory.buffer, 8192, bytes.length).set(bytes);
    size = bytes.length;
    return 0;
  };
  const api = {
    memory, alloc: () => 1024, free() {}, result_ptr: () => 8192, result_len: () => size,
    encode: () => writeResult(new Uint8Array([80, 75, 3, 4, 5])),
    decode: () => writeResult(new Uint8Array(restored)),
  };
  const messages = [];
  const context = vm.createContext({
    self: { postMessage: (message) => messages.push(message), crypto: withCrypto ? webcrypto : undefined },
    crypto: withCrypto ? webcrypto : undefined,
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
    WebAssembly: { instantiate: async () => ({ instance: { exports: api } }) },
    performance: { now: () => 1 }, TextDecoder, Uint8Array,
  });
  vm.runInContext(workerSource, context, { filename: fileURLToPath(new URL('public/8zC/worker.js', root)) });
  await context.self.onmessage({ data: { mode: 'compare', file: { size: input.length, arrayBuffer: async () => input.buffer } } });
  assert.equal(messages.length, 1);
  return messages[0];
}

test('worker rejects equal-length corruption even when SHA-256 is unavailable', async () => {
  const result = await workerComparison([1, 2, 3, 9], false);
  assert.ok(result.error);
  assert.equal(result.verified, undefined);
});

test('worker verifies every byte without claiming an unavailable digest', async () => {
  const result = await workerComparison([1, 2, 3, 4], false);
  assert.equal(result.verified, true);
  assert.equal(result.sha256Verified, false);
  assert.equal(result.inputDigest, '');
});

test('worker separately records successful SHA-256 comparison', async () => {
  const result = await workerComparison([1, 2, 3, 4], true);
  assert.equal(result.verified, true);
  assert.equal(result.sha256Verified, true);
  assert.match(result.inputDigest, /^[a-f0-9]{64}$/);
  assert.equal(result.inputDigest, result.restoredDigest);
});
