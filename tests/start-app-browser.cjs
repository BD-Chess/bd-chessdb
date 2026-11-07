'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
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
  assert.equal(await page.locator('meta[name="bd-start-release"]').getAttribute('content'), '20261107-start-r7');
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
  const edition = Buffer.from(JSON.stringify({ edition_date:'2026-10-31', evidence_mode:'live', sections:[{id:'slovenia',story_ids:['one']},{id:'world',story_ids:['two']},{id:'ai',story_ids:['three']}], stories:[{story_id:'one',title:'Novica Slovenija',source_articles:[{publisher_id:'Vir SI',published_at:'2026-10-31T08:00:00Z'}]},{story_id:'two',title:'Novica Svet',source_articles:[{publisher_id:'Vir Svet'}]},{story_id:'three',title:'Novica AI',source_articles:[{publisher_id:'Vir AI'}]}] }));
  const catalog = { latest_published_date:'2026-10-31', editions:[{date:'2026-10-31',revision:1,path:'days/2026-10-31.json',sha256:crypto.createHash('sha256').update(edition).digest('hex')}] };
  await context.route(/\/news\/catalog\.json(?:\?.*)?$/, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(catalog)}));
  await context.route(/\/news\/days\/2026-10-31\.json(?:\?.*)?$/, route => route.fulfill({status:200,contentType:'application/json',body:edition}));
  // Netlify's HTML processing canonicalizes these links. The stored/default
  // favorites may still use their original .html URLs.
  await context.route(/\/Start\/index\.html(?:\?.*)?$/i, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replaceAll('href="../AI8/browser-loop.html"', 'href="/ai8/browser-loop"').replaceAll('href="../BD-AI-todo.html"', 'href="/bd-ai-todo"');
    await route.fulfill({response,body});
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (new URL(response.url()).pathname.toLowerCase().includes('/start/') && response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  try {
    await ready(page, url);
    assert.equal(await page.locator('#bs-pins a').count(), 8, 'eight suggested favorites');
    assert.match(await page.locator('#bs-pins').textContent(), /Browser Loop · tabla/);
    assert.match(await page.locator('#bs-pins').textContent(), /BD × AI TODO/);
    assert.equal(await page.locator('.bs-category').count(), 6, 'six directory categories');
    await page.getByText('Novica Slovenija', {exact:true}).waitFor({state:'visible'});
    assert.match(await page.locator('#bs-live-news-status').textContent(), /Interpretacije metapodatkov RSS/);
    assert.match(await page.locator('#bs-live-news').textContent(), /Vir SI/);
    await page.locator('.bs-settings > summary').click();
    await open(page, '#bs-links-panel');
    const omniLink = page.locator('#bs-omnicpq-link');
    assert(await omniLink.isVisible(), 'OmniCPQ shortcut is visible');
    assert.equal(await omniLink.getAttribute('href'), '../OmniCPQ/');
    assert.match(await omniLink.innerText(), /AI pomočnik za OmniCPQ/);
    await fit(page, name);
    assert(await page.locator('.bs-toolbar svg').count() >= 2, 'local icons rendered');
    await page.screenshot({ path: path.join(evidence, name + '-light.png'), fullPage: true });
    await page.locator('[data-lang="en"]').click();
    assert.match(await page.title(), /Your world/);
    assert.match(await omniLink.innerText(), /AI assistant for OmniCPQ/);
    await page.locator('[data-theme="dark"]').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    for (let i = 0; i < 4; i++) await page.locator('#bs-scale-up').click();
    assert.equal(await page.locator('#bs-scale-reset').textContent(), '140%');
    assert.equal(await page.locator('#bs-scale-up').isDisabled(), true);
    await fit(page, name + '-140');
    await page.screenshot({ path: path.join(evidence, name + '-dark-140.png'), fullPage: true });
    await page.locator('#bs-scale-reset').click();
    await page.locator('[data-category="research"] > summary').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('bd-start-v1')).preferences.openGroups.research === true);
    await page.locator('#bs-search-input').fill('andaluzija');
    assert.equal(await page.locator('[data-category="research"]').isVisible(), false);
    assert.equal(await page.locator('[data-category="travel"]').evaluate(el => el.open), true);
    await page.locator('#bs-clear-search').click();
    assert.equal(await page.locator('[data-category="research"]').evaluate(el => el.open), true, 'search restores group state');
    assert.equal(await page.locator('[data-category="travel"]').evaluate(el => el.open), false);
    await page.locator('#bs-pins-edit').click();
    await page.getByRole('button', { name:'Move right: ChatGPT', exact:true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('bd-start-v1')).preferences.favoriteUrls[1].includes('chatgpt.com'));
    await page.getByRole('button', { name:'Remove: ChatGPT', exact:true }).click();
    assert.equal(await page.locator('#bs-pins a').count(), 7);
    assert.equal(await page.locator('#bs-pin-select option', {hasText:'Browser Loop · board'}).count(), 0, 'canonicalized favorite is not offered twice');
    await page.locator('#bs-pin-select').selectOption({label:'ChatGPT'});
    await page.locator('#bs-pin-add').click();
    assert.equal(await page.locator('#bs-pins a').count(), 8);
    await page.locator('#bs-pins-edit').click();
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
    await open(page, '#bs-weather-panel');
    await page.locator('#bs-city').selectOption('Koper');
    assert.match(await page.locator('#bs-weather-summary').textContent(), /Koper/);
    const note = 'QA thought\n<img src=x onerror="window.__startInjected=1">';
    await page.locator('#bs-note').fill(note);
    assert.equal((await state(page)).notes, note);
    await open(page, '#bs-agenda-panel');
    await page.locator('#bs-add-event-toggle').click();
    await page.locator('#bs-event-title').fill('QA event <b>literal</b>');
    const today = await page.evaluate(() => { const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const a=Object.fromEntries(p.map(x=>[x.type,x.value]));return a.year+'-'+a.month+'-'+a.day; });
    await page.locator('#bs-event-date').fill(today);
    await page.locator('#bs-event-time').fill('10:30');
    await page.locator('#bs-add-event button[type="submit"]').click();
    assert.match(await page.locator('#bs-agenda-list').textContent(), /QA event <b>literal<\/b>/);
    assert.equal(await page.locator('#bs-agenda-list b').count(), 0);
    assert.equal(await page.locator('#bs-calendar .bs-has-events').count(), 1);
    assert.match(await page.locator('#bs-upcoming').textContent(), /QA event <b>literal<\/b>/);
    await open(page, '.bs-archive');
    await open(page, '#bs-news-panel');
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
    assert.equal(persisted.preferences.favoriteUrls.length, 8);
    assert.equal(persisted.preferences.openGroups.research, true);
    assert.equal(await page.locator('#bs-note-panel').evaluate(el => el.open), false);
    await open(page, '#bs-note-panel');
    assert.equal(await page.locator('#bs-note').inputValue(), note);
    assert.equal(persisted.events.length, 1);
    await page.locator('.bs-settings > summary').click();
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
    const legacy = structuredClone(exported);
    delete legacy.preferences.favoriteUrls; delete legacy.preferences.openGroups;
    delete legacy.preferences.openPanels['bs-plans-panel']; delete legacy.preferences.openPanels['bs-markets-panel']; delete legacy.preferences.openPanels['bs-live-news-panel'];
    await page.locator('#bs-import-file').setInputFiles({name:'old-start.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
    await page.locator('#bs-import-review').waitFor({ state:'visible' });
    await page.locator('#bs-import-confirm').click();
    await sleep(150);
    assert.equal((await state(page)).notes, note, 'legacy import preserves notes');
    assert.equal((await state(page)).events.length, 1, 'legacy import preserves events');
    assert.equal((await state(page)).preferences.favoriteUrls.length, 8);
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
    results.push({ name, status: 'PASS', checks: ['layout', 'icons', 'language', 'theme', 'text scale', 'categorized search and restored group state', 'favorite selection and order', 'source-verified news', 'shortcut CRUD', 'upcoming calendar and CRUD', 'notes', 'reload persistence', 'collapsed sections', 'focus', 'sample chart', 'bookmarks', 'export/import and legacy import', 'invalid import preservation', 'escaped text', 'cross-tab conflict'] });
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
async function newsIntegrity(browser, engine, url) {
  const context = await browser.newContext();
  await context.route(/\/news\/catalog\.json(?:\?.*)?$/, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({latest_published_date:'2026-10-31',editions:[{date:'2026-10-31',revision:1,path:'days/2026-10-31.json',sha256:'0'.repeat(64)}]})}));
  await context.route(/\/news\/days\/2026-10-31\.json(?:\?.*)?$/, route => route.fulfill({status:200,contentType:'application/json',body:'{"edition_date":"2026-10-31","stories":[]}'}));
  const page = await context.newPage();
  await ready(page, url);
  await page.getByText('Zadnja izdaja trenutno ni na voljo.', {exact:true}).waitFor({state:'visible'});
  assert.equal(await page.locator('#bs-live-news a').count(), 0, 'unverified stories are not shown');
  assert.equal(await page.locator('.bs-more-link').getAttribute('href'), '../news/');
  await context.close();
  results.push({name:engine+'-news-integrity',status:'PASS',checks:['hash mismatch rejected','news remains reachable']});
}
// R5/R6: wide and 4K windows use their width; below 1600px the R2 layout stays.
// R6 (BD, 2026-11-07): wide windows hide AI8 News, show "Vreme & promet" under
// "Moje povezave" and open it and the calendar without storing that state.
async function wideLayout(browser, engine, url) {
  const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
  const stored = page => page.evaluate(k => localStorage.getItem(k), key);
  const opened = page => page.evaluate(() => ({ agenda: document.querySelector('#bs-agenda-panel').open, weather: document.querySelector('#bs-weather-panel').open }));
  for (const [width, height, columns] of [[1440, 1000, 1], [1863, 2101, 2], [3816, 2101, 3]]) {
    const name = engine + '-wide-' + width;
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/Ljubljana', locale: 'sl-SI', colorScheme: 'dark' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await ready(page, url);
    if (!await page.locator('.bs-category').evaluateAll(groups => groups.every(group => group.open))) await page.locator('#bs-open-groups').click();
    await page.waitForFunction(k => localStorage.getItem(k), key);
    await fit(page, name);
    const app = await page.locator('#bd-start-proposal').evaluate(box);
    const plans = await page.locator('#bs-plans-panel').evaluate(box);
    const links = await page.locator('#bs-links-panel').evaluate(box);
    const weather = await page.locator('#bs-weather-panel').evaluate(box);
    const day = await page.locator('.bs-personal').evaluate(box);
    const groupColumns = await page.locator('.bs-category').evaluateAll(groups => new Set(groups.map(group => Math.round(group.getBoundingClientRect().left))).size);
    const saved = JSON.parse(await stored(page)).preferences.openPanels;
    if (columns === 1) {
      assert(app.width <= 1320, name + ': the 1260px R2 column is kept below 1600px');
      assert.equal(await page.locator('#bs-live-news-panel').isVisible(), true, name + ': AI8 News stays below 1600px');
      assert.equal(await page.locator('.bs-personal > #bs-weather-panel').count(), 1, name + ': weather stays in Moj dan');
      assert.deepEqual(await opened(page), { agenda: false, weather: false }, name + ': stored panel state applies');
      assert.equal(groupColumns, 1, name + ': one directory column');
    } else {
      assert(app.width >= width - 1, name + ': the page uses the whole window width');
      assert.equal(await page.locator('#bs-live-news-panel').isVisible(), false, name + ': AI8 News is not shown');
      assert.equal(await page.locator('#bs-links-panel + #bs-weather-panel').count(), 1, name + ': Vreme & promet follows Moje povezave');
      assert.deepEqual(await opened(page), { agenda: true, weather: true }, name + ': calendar and weather are open');
      assert.equal(saved['bs-agenda-panel'] || saved['bs-weather-panel'], false, name + ': the wide layout does not store its open panels');
      assert(links.left >= plans.right && Math.abs(links.top - plans.top) < 2, name + ': the right column starts beside the directory');
      assert(Math.abs(weather.left - links.left) < 2 && weather.top > links.bottom, name + ': weather sits under Moje povezave');
      assert.equal(groupColumns, columns, name + ': directory groups side by side');
      if (columns === 3) assert(day.left >= links.right && Math.abs(day.top - plans.top) < 2, name + ': Moj dan has its own column');
      else assert(Math.abs(day.left - links.left) < 2 && day.top > weather.bottom, name + ': Moj dan stacks in the right column');
      // Each column fills independently: the tall directory adds no gaps between the right-column panels.
      const stack = await page.locator(columns === 3 ? '.bs-work > :not(#bs-plans-panel)' : '.bs-work > :not(#bs-plans-panel), .bs-personal').evaluateAll(els => els.filter(el => el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(); return [r.top, r.bottom]; }).sort((a, b) => a[0] - b[0]));
      for (let i = 1; i < stack.length; i++) assert(stack[i][0] - stack[i - 1][1] <= 24, name + ': right column has no stretched rows ' + JSON.stringify(stack));
      // Closing the calendar on a wide window lasts until the next visit and writes nothing.
      const before = await stored(page);
      await page.locator('#bs-agenda-panel > summary').click();
      await sleep(150);
      assert.equal(await page.locator('#bs-agenda-panel').evaluate(el => el.open), false, name + ': the calendar can be closed');
      assert.equal(await stored(page), before, name + ': closing it stores nothing');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('#bd-start-proposal[data-ready="true"]');
      await sleep(150);
      assert.deepEqual(await opened(page), { agenda: true, weather: true }, name + ': both open again on the next visit');
      assert.equal(await stored(page), before, name + ': loading the page stores nothing');
      if (columns === 2) {
        // Narrowing the window restores the R2 places and the stored state, again without a write.
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.waitForFunction(() => document.querySelector('.bs-personal > #bs-weather-panel') && !document.querySelector('#bs-agenda-panel').open && !document.querySelector('#bs-weather-panel').open);
        assert.equal(await page.locator('#bs-live-news-panel').isVisible(), true, name + ': AI8 News returns in a narrower window');
        await page.setViewportSize({ width, height });
        await page.waitForFunction(() => document.querySelector('#bs-links-panel + #bs-weather-panel') && document.querySelector('#bs-agenda-panel').open && document.querySelector('#bs-weather-panel').open);
        await sleep(150);
        assert.equal(await stored(page), before, name + ': resizing stores nothing');
      }
    }
    await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
    assert.deepEqual(errors, [], name + ': no page errors');
    await context.close();
  }
  results.push({ name: engine + '-wide-layout', status: 'PASS', checks: ['1440 keeps the R2 layout', '1863 two columns, groups side by side', '3816 three columns', 'independent column stacking', 'AI8 News hidden on wide windows', 'weather under Moje povezave', 'calendar and weather open without a stored change', 'resize restores the R2 places', 'no horizontal overflow'] });
}
// R7: encrypted sync between two browsers. The API is answered in the test by
// the real handler (functions/lib/bd-start-sync.mjs) over an in-memory store,
// so no run, local or live, ever writes to the production store.
class MemorySyncStore {
  constructor() { this.map = new Map(); this.n = 0; }
  async getWithMetadata(k) { const e = this.map.get(k); return e ? { data: JSON.parse(e.value), etag: e.etag, metadata: {} } : null; }
  async setJSON(k, v, o = {}) { const e = this.map.get(k); if ((o.onlyIfNew && e) || (o.onlyIfMatch !== undefined && (!e || e.etag !== o.onlyIfMatch))) return { modified: false }; const etag = '"' + (++this.n) + '"'; this.map.set(k, { value: JSON.stringify(v), etag }); return { modified: true, etag }; }
  async delete(k) { this.map.delete(k); }
  async list({ prefix = '' } = {}) { return { blobs: [...this.map.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key, etag: this.map.get(key).etag })), directories: [] }; }
}
async function syncAcrossBrowsers(browser, engine, url) {
  const { createStartSync } = await import(require('node:url').pathToFileURL(path.resolve('functions/lib/bd-start-sync.mjs')).href);
  const store = new MemorySyncStore(), handle = createStartSync({ store }), offline = new Set(), contexts = [];
  const password = 'naše skrito geslo 2026';
  const revision = () => { const e = [...store.map.values()][0]; return e ? JSON.parse(e.value).revision : 0; };
  async function waitRevision(n) { for (let i = 0; i < 300 && revision() < n; i++) await sleep(100); assert.equal(revision(), n, engine + ' sync: server revision ' + n); }
  const waitState = (page, s) => page.waitForFunction(s => document.querySelector('#bs-sync').dataset.syncState === s, s, { timeout: 30000 });
  const note = page => page.locator('#bs-note').inputValue();
  const local = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
  async function browserFor(label, colorScheme) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Ljubljana', locale: 'sl-SI', colorScheme });
    contexts.push(context);
    await context.route(/\/api\/bd-start-sync(?:\?.*)?$/, async route => {
      if (offline.has(label)) return route.abort('internetdisconnected');
      const r = route.request(), h = r.headers();
      const res = await handle(new Request('https://www.mdlxdcc.org/api/bd-start-sync', { method: r.method(), headers: { 'x-bd-start-vault': h['x-bd-start-vault'] || '', 'content-type': 'application/json' }, body: ['GET', 'DELETE'].includes(r.method()) ? undefined : r.postData() }));
      await route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
    });
    const page = await context.newPage();
    page.errors = []; page.on('pageerror', error => page.errors.push(error.message));
    await ready(page, url);
    return page;
  }
  async function connect(page, secret) { await open(page, '#bs-data-panel'); await page.locator('#bs-sync-password').fill(secret); await page.locator('#bs-sync-connect').click(); }
  async function syncNow(page) { await open(page, '#bs-data-panel'); await page.locator('#bs-sync-now').click(); }
  try {
    const a = await browserFor('a', 'light');
    await a.locator('#bs-note').fill('Misel A');
    await open(a, '#bs-agenda-panel');
    await a.locator('#bs-add-event-toggle').click();
    await a.locator('#bs-event-title').fill('Sestanek A');
    await a.locator('#bs-event-date').fill(await a.evaluate(() => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const x = Object.fromEntries(p.map(v => [v.type, v.value])); return x.year + '-' + x.month + '-' + x.day; }));
    await a.locator('#bs-event-time').fill('09:15');
    await a.locator('#bs-add-event button[type="submit"]').click();
    await connect(a, password);
    await waitState(a, 'choice');
    assert.match(await a.locator('#bs-sync-choice-text').textContent(), /še ni podatkov/);
    await a.locator('#bs-sync-choice-primary').click();
    await waitState(a, 'synced');
    assert.equal(revision(), 1);
    const sealed = JSON.stringify([...store.map.values()]);
    assert(!sealed.includes('Misel A') && !sealed.includes('Sestanek A'), engine + ' sync: the server holds ciphertext only');
    assert.equal(await a.locator('#bs-sync-password').inputValue(), '', 'the password is not left in the page');
    assert.match(await a.locator('.bs-persistence [data-sync-badge]').textContent(), /sinhronizirano/);

    const b = await browserFor('b', 'dark');
    await b.locator('#bs-note').fill('B lokalno');
    await connect(b, 'napačno geslo 2026');
    await waitState(b, 'choice');
    await b.locator('#bs-sync-choice-cancel').click();
    assert.equal(store.map.size, 1, engine + ' sync: a mistyped password creates nothing');
    await connect(b, password);
    await waitState(b, 'choice');
    assert.match(await b.locator('#bs-sync-choice-text').textContent(), /Na strežniku so podatki/);
    await b.locator('#bs-sync-choice-primary').click();
    await waitState(b, 'synced');
    assert.equal(await note(b), 'Misel A');
    assert.match(await b.locator('#bs-upcoming').textContent(), /Sestanek A/);
    assert.equal(await b.locator('html').getAttribute('data-theme'), 'dark', engine + ' sync: appearance stays per device');
    assert.match(await local(b, 'bd-start-sync-backup-v1'), /B lokalno/, engine + ' sync: replaced local content is kept as a backup');
    await b.locator('#bs-note').fill('Misel B');
    await waitRevision(2);
    await waitState(b, 'synced');

    await a.reload({ waitUntil: 'networkidle' });
    await a.waitForSelector('#bd-start-proposal[data-ready="true"]');
    await waitState(a, 'synced');
    assert.equal(await note(a), 'Misel B', engine + ' sync: the other browser gets the change on its next visit');
    assert.equal(await a.locator('#bs-sync-form').isVisible(), false, engine + ' sync: the browser remembers the password');
    assert.equal(await a.locator('html').getAttribute('data-theme'), 'light');

    offline.add('a');
    await a.locator('#bs-note').fill('A brez povezave');
    await waitState(a, 'offline');
    await b.locator('#bs-note').fill('Misel B2');
    await waitRevision(3);
    offline.delete('a');
    await syncNow(a);
    await waitState(a, 'conflict');
    assert.equal(await a.locator('#bs-sync-alert').isVisible(), true, engine + ' sync: a conflict is shown, nothing is overwritten');
    assert.equal(revision(), 3);
    await a.locator('#bs-sync-take-server').click();
    await waitState(a, 'synced');
    assert.equal(await note(a), 'Misel B2');
    assert.match(await local(a, 'bd-start-sync-backup-v1'), /A brez povezave/);

    offline.add('a');
    await a.locator('#bs-note').fill('A zmaga');
    await waitState(a, 'offline');
    await b.locator('#bs-note').fill('B izgubi');
    await waitRevision(4);
    offline.delete('a');
    await syncNow(a);
    await waitState(a, 'conflict');
    await a.locator('#bs-sync-keep-local').click();
    await waitRevision(5);
    await waitState(a, 'synced');
    await b.reload({ waitUntil: 'networkidle' });
    await b.waitForSelector('#bd-start-proposal[data-ready="true"]');
    await waitState(b, 'synced');
    assert.equal(await note(b), 'A zmaga', engine + ' sync: "keep this device" wins on purpose');

    await open(b, '#bs-data-panel');
    await b.locator('#bs-sync-disconnect').click();
    await waitState(b, 'off');
    assert.equal(await local(b, 'bd-start-sync-v1'), null, engine + ' sync: disconnecting forgets the keys');
    assert.equal(await note(b), 'A zmaga', engine + ' sync: disconnecting keeps the data');
    const final = JSON.stringify([...store.map.values()]);
    assert(!/Misel|A zmaga|B izgubi|Sestanek/.test(final), engine + ' sync: no plain text ever reached the server');
    assert.deepEqual([...a.errors, ...b.errors], [], engine + ' sync: no page errors');
    results.push({ name: engine + '-sync', status: 'PASS', checks: ['create on first browser', 'ciphertext only', 'mistyped password creates nothing', 'adopt server data with backup', 'appearance per device', 'remembered password', 'offline edit kept', 'conflict: load newer', 'conflict: keep this device', 'disconnect keeps data'] });
  } finally { for (const context of contexts) await context.close(); }
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
      try { await suite(browser, engine, url, false); await suite(browser, engine, url, true); await storageFailures(browser, engine, url); await newsIntegrity(browser, engine, url); await wideLayout(browser, engine, url); await syncAcrossBrowsers(browser, engine, url); }
      finally { await browser.close(); }
    }
    console.log('BD_START_BROWSER_PASS', JSON.stringify(results));
  } finally {
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ url, results }, null, 2));
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
