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
  physicalDevice: false, externalProvidersCalled: false, cases: [], navigation: [], qualityFloors: [],
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
                      label: document.querySelector('#cap-label').textContent,
                      qualityFloor: document.querySelector('#qf-sel').value,
                      floorLabel: document.querySelector('#qf-label').textContent,
                      floorBox: (() => { const b = document.querySelector('#qf-sel').getBoundingClientRect(); return { x: b.x, right: b.right, height: b.height }; })()
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
                  assert.equal(result.qualityFloor, '50');
                  assert.equal(result.floorLabel, language === 'sl' ? 'Prag kakovosti' : 'Quality floor');
                  assert.ok(result.floorBox.height >= 44, 'floor select touch target');
                  assert.ok(result.floorBox.x >= -1 && result.floorBox.right <= width + 1, 'floor select fits viewport');
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
          const suffix = '&v=Anthropic,Google&top=1&cat=coding&s=price.a&cs=overall.d&q=gpt&qf=70#skupno';
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
            for (const key of ['v', 'top', 'cat', 's', 'cs', 'q', 'qf']) assert.equal(after.searchParams.get(key), before.searchParams.get(key), key);
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


        // Real menu changes on both captures exercise every supported floor
        // and both Value sort directions, without mutating the source data.
        for (const date of [captures.latest, historical]) {
          const s = await session(browser, date === captures.latest ? 320 : 1280,
            date === captures.latest ? 'sl' : 'en', date === captures.latest ? 'dark' : 'light');
          try {
            await s.page.goto(captureURL(date)); await ready(s.page);
            await s.page.locator('#all-toggle').click();
            await s.page.locator('#overall [data-sort="value"]').click();
            const models = data[date].models.filter(m => m.overall_rank);
            const byId = Object.fromEntries(models.map(m => [m.model_id, m]));
            for (const floor of [0, 40, 50, 60, 70, 80]) {
              await s.page.locator('#qf-sel').selectOption(String(floor));
              assert.equal(new URL(s.page.url()).searchParams.get('qf'), floor === 50 ? null : String(floor));
              const value = m => m.price && m.price.blended_3to1 > 0 && m.overall >= floor
                ? (m.overall - floor) / m.price.blended_3to1 : null;
              for (const direction of ['descending', 'ascending']) {
                const result = await s.page.locator('#overall tbody tr:not(.detail)').evaluateAll(rows => rows.map(tr => ({
                  id: tr.querySelector('.mid').textContent,
                  dim: tr.hasAttribute('data-belowq'),
                  badge: !!tr.querySelector('.pareto')
                })));
                assert.equal(result.length, models.length);
                if (date === captures.latest) {
                  const geometry = await s.page.locator('#overall').evaluate(table => {
                    const box = table.parentElement;
                    const name = table.querySelector('tbody .mid').getBoundingClientRect();
                    const visible = box.getBoundingClientRect();
                    return { scrollWidth: box.scrollWidth, width: box.clientWidth,
                      nameX: name.x, nameRight: name.right, left: visible.x, right: visible.right };
                  });
                  if (geometry.scrollWidth > geometry.width + 1) {
                    report.mobileOverflow = { engine, date, floor, direction, ...geometry,
                      headers: await s.page.locator('#overall th').evaluateAll(cells => cells.map(c => ({ text: c.textContent, width: c.clientWidth, scroll: c.scrollWidth }))) };
                    await s.page.screenshot({ path: path.join(out, engine + '-mobile-overflow.png') });
                  }
                  assert.ok(geometry.scrollWidth <= geometry.width + 1, 'mobile table fits after Value click: ' + JSON.stringify(geometry));
                  assert.ok(geometry.nameX >= geometry.left - 1 && geometry.nameRight <= geometry.right + 1, 'mobile name remains visible');
                }

                const eligible = result.filter(r => value(byId[r.id]) !== null);
                assert.deepEqual(result.slice(0, eligible.length).map(r => r.id), eligible.map(r => r.id), 'unknown values last');
                for (let i = 1; i < eligible.length; i++) {
                  const a = value(byId[eligible[i - 1].id]), b = value(byId[eligible[i].id]);
                  assert.ok(direction === 'descending' ? a >= b - 1e-9 : a <= b + 1e-9, 'Value order');
                }
                for (const row of result) assert.equal(row.dim, byId[row.id].overall < floor);
                const pareto = result.filter(r => r.badge).map(r => r.id).sort();
                assert.ok(pareto.every(id => byId[id].overall >= floor));
                if (floor === 50) {
                  const priced = models.filter(m => value(m) !== null);
                  const want = priced.filter(m => !priced.some(other => {
                    const cheaper = other.price.blended_3to1 < m.price.blended_3to1;
                    const sameCost = other.price.blended_3to1 === m.price.blended_3to1;
                    return (cheaper && other.overall >= m.overall) || (sameCost && other.overall > m.overall);
                  })).map(m => m.model_id).sort();
                  assert.deepEqual(pareto, want, 'Pareto badges match the selected capture');
                  if (direction === 'descending') {
                    const top = priced.sort((a, b) => value(b) - value(a) || a.overall_rank - b.overall_rank)
                      .slice(0, 10).map(m => m.model_id);
                    assert.deepEqual(result.slice(0, 10).map(r => r.id), top);
                  }
                }
                report.qualityFloors.push({ engine, date, floor, direction, rows: result.length,
                  pricedEligible: eligible.length, firstModel: result[0].id, pareto });
                await s.page.locator('#overall [data-sort="value"]').click();
              }
              if (floor === 50 || floor === 80) {
                await s.page.locator('#qf-pick').scrollIntoViewIfNeeded();
                await s.page.screenshot({ path: path.join(out, [engine, 'quality', date, floor].join('-') + '.png') });
              }
            }
            // Zero survives a real reload and date navigation with search.
            await s.page.locator('#qf-sel').selectOption('0');
            await s.page.locator('#q').fill('gpt');
            await s.page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'gpt');
            await s.page.reload(); await ready(s.page);
            assert.equal(await s.page.locator('#qf-sel').inputValue(), '0');
            assert.equal(await s.page.locator('#q').inputValue(), 'gpt');
            const target = date === captures.latest ? historical : captures.latest;
            await Promise.all([s.page.waitForNavigation({ waitUntil: 'domcontentloaded' }), s.page.locator('#cap-sel').selectOption(target)]);
            await ready(s.page);
            assert.equal(await s.page.locator('#qf-sel').inputValue(), '0');
            assert.equal(await s.page.locator('#q').inputValue(), 'gpt');
          } finally { await s.context.close(); }
        }

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
    assert.equal(report.qualityFloors.length, 48);
    report.status = 'PASS';
    console.log('LLMS_CAPTURES_BROWSER_PASS: 64 layouts; 48 floor/sort checks; 2 engines; date, search, zero floor, preferences and fallback.');
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
