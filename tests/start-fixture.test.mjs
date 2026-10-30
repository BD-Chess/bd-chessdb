import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountGameGuide } from '../public/assets/game-guide/game-guide.js';

test('start fixture retains step order and only trusted runtime assets', async () => {
  assert.equal(typeof mountGameGuide, 'function');
  const html = await readFile(new URL('../public/game/_fixture/index.html', import.meta.url), 'utf8');
  const game = JSON.parse(await readFile(new URL('../public/game/_fixture/game.json', import.meta.url), 'utf8'));
  const sections = [...html.matchAll(/<section\b([^>]+)>/g)].map(m => m[1]);
  assert.equal(sections.length, game.steps.length);
  for (const [i, attrs] of sections.entries()) {
    assert.ok(attrs.includes(`id="${game.steps[i].id}"`));
    assert.ok(attrs.includes(`data-kind="${game.steps[i].kind}"`));
    assert.equal(/\bhidden\b/.test(attrs), i > 0);
  }
  assert.match(html, /<div class="g-start" data-gg-start hidden><button type="button" data-gg-action="start">Začniva igro<\/button>/);
  for (const asset of ['<link rel="stylesheet" href="/assets/game-guide/game-guide.css">', '<script type="module" src="/assets/game-guide/game-guide.js"></script>']) assert.equal(html.split(asset).length - 1, 1);
  assert.equal(/\son[a-z]+\s*=|javascript\s*:/i.test(html), false);
});
