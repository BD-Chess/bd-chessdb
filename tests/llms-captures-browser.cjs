'use strict';
// Real local-page rendering in CI. External requests and service workers are
// blocked: this never calls a model, vendor API, analytics or a production app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { chromium, webkit } = require('playwright');

const root = path.resolve('public');
const dir = path.join(root, 'llms');
const out = process.env.LLMS_CAPTURE_EVIDENCE || '/tmp/llms-captures-qa';
fs.mkdirSync(out, { recursive: true });
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const captures = read(path.join(dir, 'captures.json'));
const historical = '2026-10-30';
const files = ['meta_index.json', 'sources.json', 'commentary_sl.json'];
// Approved pre-R2 main d6ce5f37983f, including the PR476 factual correction.
const approvedHistorical = {
  'meta_index.json': '6abfaac9ceca8ce5a5feb8bfe09793511362f99b91431184a5c5232dd4013a1a',
  'sources.json': '71cab72013a238effb08e07cbc852703bac13dccad8f69f406452d2456c65cf7',
  'commentary_sl.json': '25e4f29905f65ec9d3e31e040a43ba64b5642a5297466fe5ca2ed71ac9857f81'
};
const report = {
  physicalDevice: false, externalProvidersCalled: false, cases: [], navigation: [],
  historicalBaseline: 'd6ce5f37983f82ebae0980080344538deb8e9331',
  historicalHashes: {}, errors: []
};
for (const file of files) {
  const bytes = fs.readFileSync(path.join(dir, 'data', historical, file));
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, approvedHistorical[file], 'historical bytes: ' + file);
  report.historicalHashes[file] = hash;
}
const data = Object.fromEntries(captures.captures.map(c => [
  c.date, read(path.join(dir, c.path, 'meta_index.json'))
]));

const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  } catch (_) { res.writeHead(400).end(); }
});

async function session(browser, width, language, theme) {
  const context = await browser.newContext({
    viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block'
  });
  await context.addInitScript(({ language, theme }) => {
    // Seed a fresh visitor once; later navigations must retain the choices
    // made through the actual toolbar rather than reapplying the fixture.
    if (language && !localStorage.getItem('mdlxdcc-lang')) localStorage.setItem('mdlxdcc-lang', language);
    if (theme && !localStorage.getItem('mdlxdcc-theme')) localStorage.setItem('mdlxdcc-theme', theme);
  }, { language, theme });
  const requests = [];
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== base) return route.abort();
    requests.push(u.pathname);
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  return { context, page, requests };
}
async function ready(page) {
  await page.waitForFunction(() => !!window.__llmsReady);
  assert.equal(await page.evaluate(() => window.__llmsReady), true);
  assert.equal(await page.locator('#status').textContent(), '');
}
function captureURL(date) {
  return base + '/llms/' + (date === captures.latest ? '' : '?d=' + date);
}
function downloadPath(date) {
  return '/llms/' + (date === captures.latest ? '' : 'data/' + date + '/') + 'meta_index.json';
}

let base;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [engine, kind] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await kind.launch({ headless: true });
      try {
        for (const width of [320, 390, 800, 1280]) {
          for (const language of ['sl', 'en']) {
            for (const theme of ['dark', 'light']) {
              for (const date of [captures.latest, historical]) {
                const { context, page } = await session(browser, width, language, theme);
                try {
                  await page.goto(captureURL(date), { waitUntil: 'domcontentloaded' });
                  await ready(page);
                  const result = await page.evaluate(() => {
                    const sel = document.querySelector('#cap-sel');
                    const b = sel.getBoundingClientRect();
                    return {
                      lang: document.documentElement.lang,
                      theme: document.documentElement.dataset.theme,
                      viewport: document.documentElement.clientWidth,
                      scrollWidth: document.documentElement.scrollWidth,
                      selected: sel.value, options: [...sel.options].map(o => o.value),
                      selectorVisible: !document.querySelector('#cap-pick').hidden,
                      selector: { x: b.x, right: b.right, width: b.width },
                      oldWarning: !document.querySelector('#strip-warn').hidden,
                      firstModel: document.querySelector('#overall tbody tr .mid')?.textContent,
                      download: document.querySelector('a[data-file="meta_index.json"]').href,
                      dateText: document.querySelector('#strip-text').textContent,
                      label: document.querySelector('#cap-label').textContent
                    };
                  });
                  assert.equal(result.lang, language);
                  assert.equal(result.theme, theme);
                  assert.equal(result.selected, date);
                  assert.deepEqual(result.options, captures.captures.map(c => c.date));
                  assert.equal(result.selectorVisible, true);
                  assert.ok(result.selector.width > 50);
                  assert.ok(result.selector.x >= -1 && result.selector.right <= width + 1, 'capture selector within viewport');
                  assert.ok(result.scrollWidth <= result.viewport + 1, 'no page-wide overflow: ' + JSON.stringify(result));
                  assert.equal(result.oldWarning, date !== captures.latest);
                  assert.equal(result.firstModel, data[date].ranking[0]);
                  assert.equal(new URL(result.download).pathname, downloadPath(date));
                  assert.equal(result.label, language === 'sl' ? 'Datum zajema' : 'Capture date');
                  const screenshot = (width === 320 || width === 1280) &&
                    ((language === 'sl' && theme === 'dark') || (language === 'en' && theme === 'light'));
                  const name = [engine, width, language, theme, date].join('-');
                  if (screenshot) await page.screenshot({ path: path.join(out, name + '.png') });
                  report.cases.push({ engine, version: browser.version(), width, language, theme, date, ...result, screenshot });
                } finally { await context.close(); }
              }
            }
          }
        }

        // A real select change performs navigation. Preserve filters, sorting,
        // language/theme preferences and the hash in both directions.
        const s = await session(browser, 390, 'en', 'light');
        try {
          const suffix = '&v=Anthropic,Google&top=1&cat=coding&s=price.a&cs=overall.d#skupno';
          await s.page.goto(base + '/llms/?d=' + historical + suffix);
          await ready(s.page);
          const before = new URL(s.page.url());
          for (const target of [captures.latest, historical]) {
            await Promise.all([
              s.page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
              s.page.locator('#cap-sel').selectOption(target)
            ]);
            await ready(s.page);
            const after = new URL(s.page.url());
            for (const key of ['v', 'top', 'cat', 's', 'cs']) assert.equal(after.searchParams.get(key), before.searchParams.get(key), key);
            assert.equal(after.hash, '#skupno');
            assert.equal(after.searchParams.get('d'), target === captures.latest ? null : historical);
            assert.equal(await s.page.locator('#cap-sel').inputValue(), target);
          }
          await s.page.locator('[data-ai8-lang="sl"]').click();
          await s.page.waitForFunction(() => document.querySelector('#cap-label').textContent === 'Datum zajema');
          await s.page.locator('[data-ai8-theme="dark"]').click();
          await s.page.reload();
          await ready(s.page);
          assert.equal(await s.page.locator('html').getAttribute('lang'), 'sl');
          assert.equal(await s.page.locator('html').getAttribute('data-theme'), 'dark');
          assert.equal(await s.page.locator('#cap-sel').inputValue(), historical);
          report.navigation.push({ engine, roundTrip: true, filtersPreserved: true, preferencesRetained: true });
        } finally { await s.context.close(); }

        // The existing root URLs keep working when the optional manifest is
        // unavailable; an unknown date also cannot select an arbitrary path.
        for (const missingManifest of [false, true]) {
          const s = await session(browser, 390, null, null);
          try {
            if (missingManifest) await s.context.route('**/llms/captures.json', route => route.fulfill({ status: 404, body: '{}' }));
            await s.page.goto(base + '/llms/?d=1999-01-01');
            await ready(s.page);
            assert.ok(s.requests.includes('/llms/meta_index.json'));
            assert.equal(s.requests.some(p => p.includes('/data/1999-01-01/')), false);
            assert.equal(await s.page.locator('#overall tbody tr .mid').first().textContent(), data[captures.latest].ranking[0]);
            assert.equal(await s.page.locator('html').getAttribute('data-theme'), 'dark');
            assert.equal(await s.page.locator('#cap-pick').evaluate(e => e.hidden), missingManifest);
            report.navigation.push({ engine, missingManifest, fallbackToRoot: true, freshVisitorDark: true });
          } finally { await s.context.close(); }
        }
      } finally { await browser.close(); }
    }
    assert.deepEqual(report.errors, []);
    assert.equal(report.cases.length, 64);
    report.status = 'PASS';
    console.log('LLMS_CAPTURES_BROWSER_PASS: 64 layouts; 2 engines; real date round-trip, preferences and fallback.');
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
