'use strict';
// Real-browser acceptance for the shipped LAB. No workers or neural inference
// are replaced. Use --engines after assets are ready; without it only UI runs.
// Example: NODE_PATH=<test deps>:<runtime modules> node r8-browser-smoke.cjs
//   --url=https://bd-chess.github.io/bd-chessdb/chess-lab/ --engines
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium: playwright } = require('playwright');
const chromiumModule = require('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
const option = name => process.argv.find(arg => arg.startsWith('--' + name + '='))?.split('=').slice(1).join('=');
const actualEngines = process.argv.includes('--engines');
const searchMs = Number(option('budget') || 500);
const artifactDir = path.resolve(option('evidence') || process.cwd());
let server, browser;
const report = { schema: 'chessbest.r8.browser-acceptance.v1', startedAt: new Date().toISOString(),
  actualEngines, checks: [], results: {}, pageErrors: [], failedRequests: [] };
function check(name, value) { assert(value, name); report.checks.push(name); }
async function localOrigin() {
  const publicRoot = path.resolve(__dirname, '../..');
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
  server = http.createServer((req, res) => {
    let file;
    try { file = path.join(publicRoot, decodeURIComponent(new URL(req.url, 'http://local').pathname)); }
    catch (_) { res.writeHead(400).end(); return; }
    if (!file.startsWith(publicRoot + path.sep)) { res.writeHead(403).end(); return; }
    try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); }
    catch (_) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.writeHead(404).end()); stream.pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port + '/chess-lab/';
}
async function boot(context, url) {
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push({ url, message: error.message }));
  page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), failure: request.failure() }));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__r8Workers = [];
    window.Worker = new Proxy(NativeWorker, { construct(target, args) {
      const worker = new target(...args), record = { url: String(args[0]), commands: [], requests: [], terminated: false };
      window.__r8Workers.push(record);
      const post = worker.postMessage.bind(worker), terminate = worker.terminate.bind(worker);
      worker.postMessage = (value, ...rest) => {
        if (typeof value === 'string') record.commands.push(value);
        else if (value && typeof value === 'object') record.requests.push({ type: value.type, id: value.id,
          fen: value.fen, movetime: value.movetime, multiPV: value.multiPV });
        return post(value, ...rest);
      };
      worker.terminate = () => { record.terminated = true; return terminate(); };
      return worker;
    } });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForFunction(() => !!window.ChessLabHost && document.querySelectorAll('#allEvalBadges [data-eval-source]').length === 6);
  } catch (error) {
    report.bootDiagnostic = await page.evaluate(() => ({ host: !!window.ChessLabHost,
      cards: document.querySelectorAll('#allEvalBadges [data-eval-source]').length,
      migration: window.ChessLabStorage?.status?.(), text: document.body.innerText.slice(0, 400) }));
    throw error;
  }
  return page;
}
async function analysisDiagnostic(page) {
  return page.evaluate(() => {
    const context = ChessLabHost.getContext();
    const modes = ['sf-lite', 'sf-full', 'reckless', 'lc0', 'berserk'];
    const roles = ['SF', 'RLE', 'LC0', 'BER'];
    return { context: { fen: context.fen, positionHistory: context.positionHistory,
      moves: context.moves, canAnalyze: context.canAnalyze }, settings: ChessAnalysisSession.getSettings(),
      sfFullCheckbox: document.getElementById('analysisSFFull').checked,
      allButtonText: document.getElementById('btnAnalyzeAll').textContent,
      following: document.getElementById('analysisAllMoves').checked,
      states: Object.fromEntries(roles.map(role => [role, ChessLabHost.getEngineCardState(role)])),
      results: Object.fromEntries(modes.map(mode => [mode, ChessLabHost.getEngineCardResult(mode)])),
      workers: window.__r8Workers };
  });
}
async function run() {
  const url = option('url') || await localOrigin(); report.url = url;
  const remote = !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname);
  let proxy;
  if (remote && process.env.HTTPS_PROXY) {
    const address = new URL(process.env.HTTPS_PROXY);
    proxy = { server: address.protocol + '//' + address.host };
    if (address.username) proxy.username = decodeURIComponent(address.username);
    if (address.password) proxy.password = decodeURIComponent(address.password);
  }
  // This cloud runtime trusts its egress-proxy CA for urllib, while bundled
  // Chromium does not. The exception is scoped to this proxied browser test;
  // local tests retain normal certificate checking. No proxy credentials log.
  const contextOptions = { serviceWorkers: 'block', ignoreHTTPSErrors: !!proxy };
  report.network = { proxyConfigured: !!proxy, proxyCertificateException: !!proxy, anonymousFreshContexts: true };
  // Single-process Chromium can share storage partitions between incognito
  // contexts. Keep desktop and fresh-phone visitors genuinely independent.
  const chromiumArgs = chromium.args.filter(arg => arg !== '--single-process' || process.argv.includes('--single-process'));
  browser = await playwright.launch({ executablePath: await chromium.executablePath(), headless: true,
    args: [...chromiumArgs, '--no-sandbox'], proxy, timeout: 60000 });
  report.singleProcess = chromiumArgs.includes('--single-process');
  const context = await browser.newContext({ ...contextOptions, viewport: { width: 1440, height: 1000 } });
  const page = await boot(context, url);
  report.capabilities = await page.evaluate(() => ({ isolated: crossOriginIsolated, hardwareConcurrency: navigator.hardwareConcurrency,
    webgpu: !!navigator.gpu, webassembly: typeof WebAssembly !== 'undefined' }));
  const cards = await page.locator('#allEvalBadges [data-eval-source]').evaluateAll(nodes => nodes.map(node => node.dataset.evalSource));
  assert.deepEqual(cards, ['CDB', 'SF', 'DCC', 'RLE', 'LC0', 'BER']); report.checks.push('six comparison cards retain order');
  check('all-follow is initially off', !await page.locator('#analysisAllMoves').isChecked());
  const sources = await page.locator('#analysisSource option').evaluateAll(nodes => nodes.map(node => node.value));
  assert.deepEqual(sources, ['cdb', 'sf-lite', 'sf-full', 'reckless', 'lc0', 'berserk']); report.checks.push('source-only dropdown retains six choices');
  const workersBefore = await page.evaluate(() => window.__r8Workers.length);
  for (const mode of ['reckless', 'lc0', 'berserk', 'sf-full', 'cdb']) {
    const enabled = await page.locator('#analysisSource option[value="' + mode + '"]').evaluate(node => !node.disabled);
    if (enabled) await page.selectOption('#analysisSource', mode);
    else assert(!actualEngines, mode + ' source must be enabled for engine acceptance');
  }
  await page.waitForTimeout(200);
  check('idle source selection starts no worker', workersBefore === await page.evaluate(() => window.__r8Workers.length));
  check('card time preference defaults to 15 seconds on desktop', await page.locator('#settingAnalysisTime').inputValue() === '15000');
  await page.selectOption('#settingAnalysisTime', '5000', { force: true });
  check('card time preference persists independently', await page.evaluate(() => JSON.parse(localStorage.getItem('ChessBest:LAB:v2:settings')).analysisTimeMs === 5000));

  // Real historical game and Review V4, rather than a synthetic evaluation card.
  await page.locator('#btnGames').click();
  const dreev = page.locator('.library-result').filter({ hasText: /Dreev.*Kasparov/i }).first();
  await dreev.waitFor({ state: 'visible', timeout: 15000 }); await dreev.click();
  await page.locator('#gameReviewGraph').waitFor({ state: 'visible', timeout: 15000 });
  const review = await page.evaluate(() => window.ChessLabHost.getReviewGame());
  check('Dreev–Kasparov Review V4 retains 99 plies', review.totalPly === 99 && review.headers.ChessBestReviewVersion === '4');
  check('Review V4 retains 12 decision cards', await page.locator('.game-review-decision').count() === 12);
  check('Review V4 retains encoded mate explanation', /30000 − 29973 = 27 plies/.test(await page.locator('#gameReviewPanel').textContent()));
  await page.locator('#btnNew').click();
  await page.waitForFunction(() => window.ChessLabHost.getContext().fen === new Chess().fen());
  await page.locator('#btnStudy').evaluate(node => node.click());
  check('Studies manager opens', await page.locator('.chess-study-overlay').isVisible());
  await page.locator('.chess-study-close').click();
  await page.locator('[data-desktop-view="deep"]').click();
  check('Deep retains independent depth and time controls', await page.locator('[data-deep="budget"]').count() === 1 && await page.locator('[data-deep="time"]').count() === 1);
  if (await page.locator('[data-deep="mode"] option[value="lc0"]').evaluate(node => !node.disabled)) {
    await page.selectOption('[data-deep="mode"]', 'lc0');
    check('LCZero hides unsupported depth controls', await page.locator('[data-deep="budget"]').isDisabled());
  }
  await page.locator('[data-deep="close"]').click();

  if (actualEngines) {
    // A short explicit test budget through the real settings handler; the
    // shipped selector choices and defaults above were checked unchanged.
    await page.evaluate(ms => {
      const selector = document.getElementById('settingAnalysisTime');
      selector.append(new Option('Acceptance test budget', String(ms)));
      selector.value = String(ms); selector.dispatchEvent(new Event('change', { bubbles: true }));
    }, searchMs);
    await page.locator('#analysisSFFull').uncheck();
    for (const [mode, role] of [['reckless', 'RLE'], ['lc0', 'LC0']]) {
      check(mode + ' card is enabled', !await page.locator('[data-eval-source="' + role + '"]').isDisabled());
      await page.locator('[data-eval-source="' + role + '"]').click();
      await page.waitForFunction(mode => {
        const result = window.ChessLabHost.getEngineCardResult(mode);
        return result && ['complete', 'failed', 'stopped'].includes(result.status);
      }, mode, { timeout: 120000 });
      const result = await page.evaluate(mode => window.ChessLabHost.getEngineCardResult(mode), mode);
      assert.equal(result.status, 'complete', mode + ': ' + (result.error || result.stopReason));
      assert(result.lines?.length, mode + ' produces a PV');
      const validation = await page.evaluate(result => {
        const board = new Chess(result.fen);
        return result.lines[0].pv.every(move => !!board.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }));
      }, result);
      check(mode + ' principal variation is legal', validation);
      assert.equal(result.requestedTimeMs, searchMs);
      check(mode + ' reports search time and initialization separately', Number.isFinite(result.actualSearchMs) && Number.isFinite(result.initializationMs));
      if (mode === 'reckless') check('Reckless identity is independent', /reckless/i.test(result.engine?.name || result.engine?.reportedName || ''));
      if (mode === 'lc0') check('LCZero records native neural Q', result.lines[0].score.type === 'q' && Number.isFinite(result.lines[0].score.white));
      report.results[mode] = result;
    }
    const previous = await page.evaluate(() => Object.fromEntries(['sf-lite', 'reckless', 'lc0', 'berserk'].map(mode => {
      const value = ChessLabHost.getEngineCardResult(mode);
      return [mode, value ? { jobId: value.jobId || null, startedAt: value.startedAt || null } : null];
    })));
    const workersBeforeAll = await page.evaluate(() => window.__r8Workers.length);
    await page.locator('#btnAnalyzeAll').click();
    try {
      await page.waitForFunction(ms => ['sf-lite', 'reckless', 'lc0', 'berserk'].every(mode => {
        const role = { 'sf-lite': 'SF', reckless: 'RLE', lc0: 'LC0', berserk: 'BER' }[mode];
        const value = ChessLabHost.getEngineCardResult(mode);
        return !ChessLabHost.getEngineCardState(role)?.working && value?.status === 'complete' && value.requestedTimeMs === ms;
      }), searchMs, { timeout: 60000 });
    } catch (error) {
      report.allFailureDiagnostic = await analysisDiagnostic(page); throw error;
    }
    report.results.all = await page.evaluate(() => Object.fromEntries(['sf-lite', 'reckless', 'lc0', 'berserk'].map(mode => [mode, ChessLabHost.getEngineCardResult(mode)])));
    check('Analyze all executes four distinct engines', Object.keys(report.results.all).length === 4);
    check('Analyze all creates a fresh worker for every engine', await page.evaluate(() => window.__r8Workers.length) >= workersBeforeAll + 4);
    for (const mode of ['reckless', 'lc0']) {
      const value = report.results.all[mode];
      check('Analyze all replaces the prior ' + mode + ' analysis', !previous[mode] ||
        value.jobId !== previous[mode].jobId || value.startedAt !== previous[mode].startedAt);
    }
    // All-follow must cancel old workers when rapid navigation replaces a FEN.
    await page.locator('#analysisAllMoves').check();
    await page.evaluate(() => {
      const startFen = new Chess().fen();
      ChessLabHost.navigate({ startFen, moves: ['e2e4'] });
      ChessLabHost.navigate({ startFen, moves: ['d2d4'] });
    });
    try {
      await page.waitForFunction(() => ['sf-lite', 'reckless', 'lc0', 'berserk'].every(mode => {
        const result = ChessLabHost.getEngineCardResult(mode);
        return result?.status === 'complete' && result.fen === ChessLabHost.getContext().fen;
      }), null, { timeout: 60000 });
    } catch (error) {
      report.followFailureDiagnostic = await analysisDiagnostic(page); throw error;
    }
    check('All-follow results remain bound to the latest FEN', true);
    await page.locator('#analysisAllMoves').uncheck();
  }
  report.workers = await page.evaluate(() => window.__r8Workers);
  await page.screenshot({ path: path.join(artifactDir, 'r8-desktop.png'), fullPage: true });
  if (process.argv.includes('--probe-context-isolation')) await page.evaluate(() => {
    const selector = document.getElementById('settingAnalysisTime');
    selector.append(new Option('Context isolation probe', '500')); selector.value = '500';
    selector.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const mobile = await browser.newContext({ ...contextOptions, viewport: { width: 390, height: 844 }, isMobile: true,
    hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
  const phone = await boot(mobile, url);
  check('phone retains mobile APP presentation', await phone.locator('body').evaluate(node => node.classList.contains('app-mobile')));
  check('phone retains five workspace tabs', await phone.locator('#appTabs [data-app-tab]').count() === 5);
  report.mobileTimeDiagnostic = await phone.evaluate(() => ({ value: document.getElementById('settingAnalysisTime').value,
    sessionSettings: ChessAnalysisSession.getSettings(), capabilities: ChessAnalysisSession.capabilities(),
    innerWidth, pointerCoarse: matchMedia('(pointer: coarse)').matches,
    storage: Object.fromEntries(['ChessBest:LAB:v2:settings', 'ChessBest:LAB:v2:analysis-engine-r3'].map(key => [key, localStorage.getItem(key)])) }));
  check('phone search time defaults to five seconds', await phone.locator('#settingAnalysisTime').inputValue() === '5000');
  report.mobileAllControls = await phone.locator('#btnAnalyzeAll').evaluate(node => ({
    buttonDisplay: getComputedStyle(node).display, parentDisplay: getComputedStyle(node.parentElement).display,
    actionRowDisplay: getComputedStyle(node.closest('.board-engine-row')).display,
    bounds: node.getBoundingClientRect().toJSON(), hidden: node.hidden
  }));
  check('phone retains All analysis controls', await phone.locator('#btnAnalyzeAll').isVisible());
  await phone.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  report.mobileAllControlsAfterScroll = await phone.locator('#btnAnalyzeAll').evaluate(node => {
    const bounds = node.getBoundingClientRect(), target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return { bounds: bounds.toJSON(), reachable: node === target || node.contains(target), coveringElement: target?.id || target?.className };
  });
  check('phone All analysis action is reachable after scrolling', report.mobileAllControlsAfterScroll.reachable);
  await phone.screenshot({ path: path.join(artifactDir, 'r8-mobile.png'), fullPage: true });
  const preview = await boot(context, url + (url.includes('?') ? '&' : '?') + 'view=app');
  check('desktop APP preview remains forced mobile', await preview.locator('body').evaluate(node => node.classList.contains('app-preview-desktop')));
  await preview.setViewportSize({ width: 1920, height: 1080 });
  check('desktop APP preview remains forced after resize', await preview.locator('body').evaluate(node => node.classList.contains('app-preview-desktop')));
  check('application has no uncaught errors', report.pageErrors.length === 0);
  report.status = 'PASS';
}
fs.mkdirSync(artifactDir, { recursive: true });
run().catch(error => { report.status = 'FAIL'; report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(artifactDir, 'r8-browser-smoke-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks, error: report.error, evidence: artifactDir }, null, 2));
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve));
});
