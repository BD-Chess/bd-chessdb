import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');

test('8zC-Hutter page, hutter-data.json, redirects, headers and 8zC-results F1 banner are valid and CSP-safe', () => {
  const hutterHtml = read('public/8zC-Hutter/index.html');
  const hutterData = JSON.parse(read('public/8zC-Hutter/hutter-data.json'));
  const resultsHtml = read('public/8zC-results/index.html');
  const headers = read('public/_headers');
  const redirects = read('public/_redirects');

  // Verify no inline script or style blocks violate script-src 'self'
  assert.doesNotMatch(hutterHtml, /<script(?![^>]*\bsrc=)/i, 'no inline scripts allowed');
  assert.match(hutterHtml, /8zHutter3/);
  assert.match(hutterHtml, /126\u202f836 B/);
  assert.match(hutterHtml, /174\u202f545 B/);
  assert.match(hutterHtml, /178\u202f231 B/);

  // Verify bilingual EN | SL spans
  assert.match(hutterHtml, /<span lang="sl">/);
  assert.match(hutterHtml, /<span lang="en">/);

  // Verify 8zC-results top F1 banner links to /8zC-Hutter/
  assert.match(resultsHtml, /id="hutter-f1-banner"/);
  assert.match(resultsHtml, /href="\/8zC-Hutter\/"/);

  // Verify hutter-data.json schema and key runs
  assert.equal(hutterData.project, '8zC-Hutter');
  assert.equal(hutterData.enwik6_matrix_1mb.raw_bytes, 1000000);
  assert.ok(hutterData.enwik6_matrix_1mb.runs.length >= 10);

  // Verify redirects and headers
  assert.match(headers, /\/8zC-Hutter\/\*/);
  assert.match(redirects, /\/8zc-hutter \/8zC-Hutter\/ 301!/);
  assert.match(redirects, /\/8zHutter \/8zC-Hutter\/ 301!/);
  assert.match(redirects, /\/8zhutter \/8zC-Hutter\/ 301!/);
});
