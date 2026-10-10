'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const evidence = process.env.START_QA_EVIDENCE || path.resolve('start-qa-evidence');
fs.mkdirSync(evidence, { recursive: true });
const results = [];
const key = 'bd-start-v1';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(page, url) {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert(response && response.ok(), 'Start document is reachable');
  await page.waitForSelector('#bd-start-proposal[data-ready="true"]');
  assert.equal(await page.locator('meta[name="bd-start-release"]').getAttribute('content'), '20261010-r1');
}
async function state(page) { return page.evaluate(k => JSON.parse(localStorage.getItem(k)), key); }
async function open(page, id) { if (!await page.locator(id).evaluate(el => el.open)) await page.locator(id + ' > summary').click(); }
async function fit(page, label) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(dimensions.scroll <= dimensions.width + 1, label + ': no horizontal overflow ' + JSON.stringify(dimensions));
}
async function suite(browser, engine, url, mobile) {
  const name = engine + '-' + (mobile ? 'mobile' : 'desktop');
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, timezoneId: 'Europe/Ljubljana', locale: 'sl-SI', colorScheme: 'light', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (new URL(response.url()).pathname.toLowerCase().includes('/start/') && response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  try {
    await ready(page, url);
    await fit(page, name);
    assert(await page.locator('.bs-toolbar svg').count() >= 2, 'local icons rendered');
    await page.screenshot({ path: path.join(evidence, name + '-light.png'), fullPage: true });
    await page.locator('[data-lang="en"]').click();
    assert.match(await page.title(), /Your world/);
    await page.locator('[data-theme="dark"]').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    for (let i = 0; i < 4; i++) await page.locator('#bs-scale-up').click();
    assert.equal(await page.locator('#bs-scale-reset').textContent(), '140%');
    assert.equal(await page.locator('#bs-scale-up').isDisabled(), true);
    await fit(page, name + '-140');
    await page.screenshot({ path: path.join(evidence, name + '-dark-140.png'), fullPage: true });
    await page.locator('#bs-scale-reset').click();
    await page.locator('#bs-search-input').fill('ChatGPT');
    assert.equal(await page.locator('#bs-shortcuts a').count(), 1);
    await page.locator('#bs-clear-search').click();
    await page.locator('#bs-add-link-toggle').click();
    await page.locator('#bs-link-name').fill('QA shortcut');
    await page.locator('#bs-link-url').fill('https://example.com/qa');
    await page.locator('#bs-link-submit').click();
    assert.equal(await page.locator('#bs-shortcuts a[href="https://example.com/qa"]').count(), 1);
    await page.locator('#bs-manage-links').click();
    await page.getByRole('button', { name: 'Edit shortcut: QA shortcut', exact: true }).click();
    await page.locator('#bs-link-name').fill('QA shortcut edited');
    await page.locator('#bs-link-submit').click();
    assert.equal(await page.locator('#bs-shortcuts a[href="https://example.com/qa"]').textContent(), 'QAQA shortcut edited');
    await page.getByRole('button', { name: 'Remove: QA shortcut edited', exact: true }).click();
    assert.equal(await page.locator('#bs-shortcuts a[href="https://example.com/qa"]').count(), 0);
    await page.locator('#bs-manage-links').click();
    await page.locator('#bs-city').selectOption('Koper');
    assert.match(await page.locator('#bs-weather-summary').textContent(), /Koper/);
    const note = 'QA thought\n<img src=x onerror="window.__startInjected=1">';
    await page.locator('#bs-note').fill(note);
    assert.equal((await state(page)).notes, note);
    await page.locator('#bs-add-event-toggle').click();
    await page.locator('#bs-event-title').fill('QA event <b>literal</b>');
    await page.locator('#bs-event-date').fill('2026-10-15');
    await page.locator('#bs-event-time').fill('10:30');
    await page.locator('#bs-add-event button[type="submit"]').click();
    assert.match(await page.locator('#bs-agenda-list').textContent(), /QA event <b>literal<\/b>/);
    assert.equal(await page.locator('#bs-agenda-list b').count(), 0);
    assert.equal(await page.locator('#bs-calendar .bs-has-events').count(), 1);
    await page.locator('#bs-news button').first().click();
    assert.equal((await state(page)).saved.length, 1);
    await page.locator('#bs-note-panel > summary').click();
    await sleep(100);
    assert.equal((await state(page)).preferences.openPanels['bs-note-panel'], false);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#bd-start-proposal[data-ready="true"]');
    const persisted = await state(page);
    assert.equal(persisted.preferences.lang, 'en');
    assert.equal(persisted.preferences.theme, 'dark');
    assert.equal(persisted.preferences.city, 'Koper');
    assert.equal(await page.locator('#bs-note-panel').evaluate(el => el.open), false);
    await open(page, '#bs-note-panel');
    assert.equal(await page.locator('#bs-note').inputValue(), note);
    assert.equal(persisted.events.length, 1);
    await page.locator('[data-mode="focus"]').click();
    assert.equal(await page.locator('#bs-news-panel').isVisible(), false);
    assert.equal(await page.locator('#bs-weather-panel').isVisible(), false);
    assert.equal(await page.locator('#bs-note-panel').isVisible(), true);
    await page.locator('[data-mode="all"]').click();
    assert.equal(await page.locator('#bs-news-panel').isVisible(), true);
    assert.equal(await page.locator('#bs-reading-panel').evaluate(el => el.open), true);
    await fit(page, name + '-all');
    await page.locator('#bs-search-input').fill('zzzz-no-match');
    assert.match(await page.locator('#bs-shortcuts').textContent(), /No matches/);
    await page.locator('#bs-clear-search').click();
    await page.locator('[data-asset="SPX"]').click();
    assert.equal(await page.locator('#bs-chart-panel').isVisible(), true);
    assert.equal(await page.locator('#bs-market-chart polyline').count(), 1);
    await page.locator('#bs-chart-close').click();
    const downloaded = page.waitForEvent('download');
    await page.locator('#bs-export').click();
    const download = await downloaded;
    const file = path.join(evidence, name + '-export.json');
    await download.saveAs(file);
    const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(exported.notes, note);
    assert.equal(exported.events.length, 1);
    await page.locator('#bs-note').fill('new temporary note');
    await page.locator('#bs-import-file').setInputFiles(file);
    await page.locator('#bs-import-review').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#bs-note').inputValue(), 'new temporary note');
    await page.locator('#bs-import-confirm').click();
    await sleep(150);
    assert.equal((await state(page)).notes, note);
    const malicious = structuredClone(exported);
    malicious.links.daily[0][1] = 'javascript:alert(1)';
    await page.locator('#bs-import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malicious)) });
    await page.waitForFunction(() => document.querySelector('#bs-data-status').classList.contains('bs-error'));
    assert.equal((await state(page)).notes, note);
    assert.equal(await page.locator('#bs-import-review').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__startInjected || 0), 0);
    await page.getByRole('button', { name: 'Remove: QA event <b>literal</b>', exact: true }).click();
    assert.equal((await state(page)).events.length, 0);
    await page.locator('#bs-reading-list button').first().click();
    assert.equal((await state(page)).saved.length, 0);
    const tab = await context.newPage();
    await ready(tab, url);
    await page.locator('#bs-note').fill('written in first tab');
    await tab.locator('#bs-storage-alert').waitFor({ state: 'visible' });
    await open(tab, '#bs-note-panel');
    await tab.locator('#bs-note').fill('unsaved second tab');
    assert.equal((await state(tab)).notes, 'written in first tab', 'stale tab cannot overwrite newer data');
    await tab.locator('#bs-reload-data').click();
    await sleep(100);
    assert.equal(await tab.locator('#bs-note').inputValue(), 'written in first tab');
    assert.equal(await tab.locator('#bs-storage-alert').isVisible(), false);
    await tab.close();
    assert.deepEqual(errors, [], 'no page or asset errors');
    results.push({ name, status: 'PASS', checks: ['layout', 'icons', 'language', 'theme', 'text scale', 'search', 'shortcut CRUD', 'calendar CRUD', 'notes', 'reload persistence', 'collapsed sections', 'focus', 'sample chart', 'bookmarks', 'export/import', 'invalid import preservation', 'escaped text', 'cross-tab conflict'] });
  } catch (error) {
    await page.screenshot({ path: path.join(evidence, name + '-failure.png'), fullPage: true }).catch(() => {});
    results.push({ name, status: 'FAIL', error: error.stack });
    throw error;
  } finally { await context.close(); }
}
async function storageFailures(browser, engine, url) {
  const context = await browser.newContext();
  await context.addInitScript(() => { try { localStorage.setItem('bd-start-v1', '{corrupt'); } catch (_) {} });
  const page = await context.newPage();
  await ready(page, url);
  await page.locator('#bs-storage-alert').waitFor({ state: 'visible' });
  await page.locator('#bs-note').fill('recoverable note');
  assert.equal(await page.evaluate(k => localStorage.getItem(k), key), '{corrupt', 'corrupt storage is preserved');
  await open(page, '#bs-data-panel');
  await page.locator('#bs-import-file').setInputFiles(path.join(evidence, engine + '-desktop-export.json'));
  await page.locator('#bs-import-review').waitFor({ state: 'visible' });
  await page.locator('#bs-import-confirm').click();
  await sleep(150);
  assert.match((await state(page)).notes, /QA thought/);
  assert.equal(await page.locator('#bs-storage-alert').isVisible(), false, 'explicit valid import recovers corrupt storage');
  await context.close();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } }));
  const p = await blocked.newPage();
  await ready(p, url);
  await p.locator('#bs-note').fill('still usable without storage');
  await p.locator('#bs-storage-alert').waitFor({ state: 'visible' });
  assert.equal(await p.locator('#bs-note').inputValue(), 'still usable without storage');
  assert.equal(await p.locator('#bs-note-save-status').textContent(), 'Samo v tem brskalniku');
  await blocked.close();
  results.push({ name: engine + '-storage-failures', status: 'PASS', checks: ['corrupt data preserved', 'explicit import recovers corrupt storage', 'storage failure visible', 'editable note retained'] });
}
(async () => {
  let server;
  let url = process.env.START_QA_URL;
  if (!url) {
    const publicRoot = path.resolve('public');
    server = http.createServer((req, res) => {
      let relative; try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (_) { res.writeHead(400).end(); return; }
      const file = path.resolve(publicRoot, '.' + relative);
      if (!file.startsWith(publicRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = 'http://127.0.0.1:' + server.address().port + '/Start/index.html';
  }
  try {
    for (const [engine, type] of Object.entries({ chromium, webkit })) {
      const browser = await type.launch({ headless: true });
      try { await suite(browser, engine, url, false); await suite(browser, engine, url, true); await storageFailures(browser, engine, url); }
      finally { await browser.close(); }
    }
    console.log('BD_START_BROWSER_PASS', JSON.stringify(results));
  } finally {
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ url, results }, null, 2));
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
