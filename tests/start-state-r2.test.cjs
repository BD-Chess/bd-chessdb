'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/Start/state.js');

const oldPanels = ['bs-links-panel', 'bs-agenda-panel', 'bs-news-panel', 'bs-weather-panel', 'bs-note-panel', 'bs-reading-panel', 'bs-more-panel', 'bs-data-panel'];
function legacy() {
  return {
    version: 1,
    preferences: { lang: 'sl', theme: 'dark', mode: 'overview', linkGroup: 'daily', newsGroup: 'world', city: 'Ljubljana', scale: 120, calendarDate: '2026-10-31', calendarMonth: '2026-10', openPanels: Object.fromEntries(oldPanels.map(id => [id, true])) },
    links: { daily: [['Moja povezava', 'https://example.com/a', 'MP']], lab: [], markets: [] },
    events: [{ id: 'event-1', title: 'Dogodek', date: '2026-11-02', time: '09:30' }],
    notes: 'Ohrani mojo beležko.', saved: ['w1'], revision: 'old-revision'
  };
}
test('legacy export keeps personal data and gains safe defaults for new panels', () => {
  const old = legacy(), before = JSON.stringify(old), normalized = S.parse(before);
  assert.deepEqual(normalized.links, old.links);
  assert.deepEqual(normalized.events, old.events);
  assert.equal(normalized.notes, old.notes);
  assert.deepEqual(normalized.saved, old.saved);
  assert.equal(normalized.revision, old.revision);
  assert.equal(normalized.preferences.scale, 120);
  assert.equal(normalized.preferences.openPanels['bs-plans-panel'], true);
  assert.equal(normalized.preferences.openPanels['bs-live-news-panel'], true);
  assert.equal(normalized.preferences.openPanels['bs-markets-panel'], false);
  assert.equal(normalized.preferences.favoriteUrls, undefined);
  assert.equal(JSON.stringify(old), before);
});
test('new favorites and category states round-trip through export and import', () => {
  const data = legacy();
  data.preferences.favoriteUrls = ['https://example.com/a', 'https://chatgpt.com/'];
  data.preferences.openGroups = Object.fromEntries(S.categories.map((id, i) => [id, i === 1]));
  const restored = S.parse(JSON.stringify(S.normalize(data)));
  assert.deepEqual(restored.preferences.favoriteUrls, data.preferences.favoriteUrls);
  assert.deepEqual(restored.preferences.openGroups, data.preferences.openGroups);
  assert.equal(restored.notes, data.notes);
  data.preferences.favoriteUrls = [];
  assert.deepEqual(S.normalize(data).preferences.favoriteUrls, [], 'an intentionally empty selection is preserved');
});
test('unsafe, duplicate or oversized favorites and malformed group states are rejected', () => {
  for (const pins of [['javascript:alert(1)'], ['https://a.example/', 'https://a.example/'], Array(9).fill('https://a.example/')]) {
    const data = legacy(); data.preferences.favoriteUrls = pins;
    assert.throws(() => S.normalize(data));
  }
  const data = legacy(); data.preferences.openGroups = { ai: true };
  assert.throws(() => S.normalize(data));
});
