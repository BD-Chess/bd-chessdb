'use strict';
// »8zTSP in your browser« (/8zTSP/) on WebKit with Playwright's iPhone 15 profile (BD's program, 15 Nov 2026, item c:
// »a Safari/WebKit iPhone-profile smoke of /8zTSP/«). The browser reaches https://www.mdlxdcc.org through a local proxy that
// sends it to a local HTTPS server of public/ (a throw-away self-signed certificate; BD's lock checks the host name, and
// WebCrypto and shared memory need a secure origin). The server sets the /8zTSP/ headers of public/_headers.
// Checked: the lock page (EN + SL access line, the request form, no horizontal scroll), cross-origin isolation, the install
// box (Safari: »Share → Add to Home Screen«), a wrong password (the lock stays; no worker; no solver file requested by the
// page). With DEMO_PASSWORD in the environment (never in the repository) also: unlock, nu3496 with the iPhone default of
// 6 workers, the stop at the known optimum. ENGINE=chromium runs the same steps on a local Chromium (CHROMIUM_PATH).
// usage: node tests/8ztsp-demo-webkit.cjs     (needs playwright@1.58.2 on NODE_PATH, as in start-app.yml)
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), https = require('node:https'), net = require('node:net');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const pw = require('playwright');
const pub = path.join(__dirname, '..', 'public');
const OUT = process.env.DEMO_QA_EVIDENCE || path.join(require('node:os').tmpdir(), 'demo-qa');
fs.mkdirSync(OUT, {recursive: true});
const ENGINE = process.env.ENGINE || 'webkit';
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.tsp': 'text/plain', '.csv': 'text/csv', '.md': 'text/markdown', '.enc': 'application/octet-stream'};

// a throw-away certificate for www.mdlxdcc.org (openssl is on the runner)
const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'demo-tls-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=www.mdlxdcc.org',
  '-addext', 'subjectAltName=DNS:www.mdlxdcc.org', '-keyout', path.join(tmp, 'key.pem'), '-out', path.join(tmp, 'cert.pem')], {stdio: 'ignore'});
const requests = [];
function serve(req, res) {
  const url = new URL(req.url, 'https://www.mdlxdcc.org'); let p = decodeURIComponent(url.pathname);
  requests.push({method: req.method, path: p, t: Date.now()});
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(202, {'Content-Type': 'application/json'}); res.end('{"ok":true,"test":true}'); return; }
  if (/^\/8ztsp\/?$/i.test(p)) p = '/8zTSP/index.html';                       // the forced rule keeps /8zTSP/
  const file = path.join(pub, p.endsWith('/') ? p + 'index.html' : p);
  if (!file.startsWith(pub) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const h = {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache'};
  if (/^\/8ztsp(\/|$)/i.test(p)) Object.assign(h, {'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin'});
  if (/\/8ztsp\/sw\.js$/i.test(p)) h['Service-Worker-Allowed'] = '/8zTSP/';
  res.writeHead(200, h); res.end(fs.readFileSync(file));
}
const tls = https.createServer({key: fs.readFileSync(path.join(tmp, 'key.pem')), cert: fs.readFileSync(path.join(tmp, 'cert.pem'))}, serve);
const proxy = http.createServer((req, res) => { res.writeHead(403); res.end(); });  // only CONNECT to www.mdlxdcc.org:443
proxy.on('connect', (req, sock, head) => {
  if (req.url !== 'www.mdlxdcc.org:443') { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  const up = net.connect(tls.address().port, '127.0.0.1', () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); up.write(head); up.pipe(sock); sock.pipe(up); });
  up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
});

(async () => {
  await new Promise(r => tls.listen(0, '127.0.0.1', r)); await new Promise(r => proxy.listen(0, '127.0.0.1', r));
  const type = pw[ENGINE];
  const browser = await type.launch({proxy: {server: `http://127.0.0.1:${proxy.address().port}`},
    ...(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {})});
  const iphone = pw.devices['iPhone 15'];
  const context = await browser.newContext({...iphone, ignoreHTTPSErrors: true});
  const page = await context.newPage();
  const workers = []; page.on('worker', w => workers.push(w.url()));
  const log = [];
  const ok = (cond, label) => { log.push(`${cond ? 'ok' : 'FAIL'}: ${label}`); console.log(`  ${cond ? 'ok' : 'FAIL'}: ${label}`); return cond; };
  let failed = false; const check = (c, l) => { if (!ok(c, l)) failed = true; };

  await page.goto('https://www.mdlxdcc.org/8zTSP/?lang=en', {waitUntil: 'load'});
  await page.waitForSelector('#pw', {timeout: 20000});
  const lock = await page.evaluate(() => ({ua: navigator.userAgent, iso: self.crossOriginIsolated, access: document.getElementById('req-h')?.textContent || '',
    form: !!document.querySelector('#req') && !!document.getElementById('req-email'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    manifest: !!document.querySelector('link[rel="manifest"]'), install: document.getElementById('pwaInstall')?.textContent || '', installHidden: document.getElementById('pwaInstall')?.hidden}));
  console.log(`${ENGINE} ${await browser.version()} | ${lock.ua.slice(0, 90)}`);
  await page.screenshot({path: path.join(OUT, 'lock_iphone15.png'), fullPage: true});
  check(lock.access.includes('The demo is password-protected; access on request.') && lock.access.includes('Demo je zaščiten z geslom; dostop na prošnjo.'), 'the access line in EN and SL');
  check(lock.form, 'the access-request form is there');
  check(lock.sw <= lock.cw, `no horizontal scroll (${lock.sw}/${lock.cw})`);
  check(lock.iso === true, 'the lock page is cross-origin isolated');
  check(lock.manifest && lock.install.includes('Install the app') && lock.installHidden === false, `the app head and the install button (${lock.install})`);
  await page.click('#pwaInstall');
  check((await page.textContent('#pwaStatus')).includes('Add to Home Screen'), 'the install button tells Safari users how to add it');
  const before = requests.length;
  await page.fill('#pw', 'not-the-password-' + Date.now());
  await page.click('#unlock');
  await page.waitForTimeout(6000);                                             // PBKDF2 600,000 in WebKit
  const after = await page.evaluate(() => ({lock: !!document.getElementById('pw'), error: (document.getElementById('error') || {}).textContent || ''}));
  const pageWasm = requests.slice(before).filter(r => /\.wasm(\.enc)?$/.test(r.path));
  check(after.lock, `a wrong password leaves the lock (${after.error.trim().slice(0, 60)})`);
  check(workers.filter(u => !/sw\.js$/.test(u)).length === 0, 'no worker starts before the unlock');
  check(pageWasm.every(r => r.path.endsWith('.wasm.enc')), `only encrypted solver files are ever requested (${pageWasm.length})`);
  if (process.env.DEMO_PASSWORD) {
    await page.fill('#pw', process.env.DEMO_PASSWORD); await page.click('#unlock');
    await page.waitForFunction(() => window.tsp8zLab?.ready && window.tsp8zLab.coordinates.length === 6992, null, {timeout: 120000});
    const d = await page.evaluate(() => ({workers: document.getElementById('workers').value, iso: self.crossOriginIsolated}));
    check(d.workers === '6', `iPhone: 6 workers by default (${d.workers})`);
    const r = await page.evaluate(() => window.tsp8zLab.start({seconds: 240}).then(r => ({length: r.length, reached: r.optimumReached, topology: r.topology})));
    check(r.length === 96132 && !!r.reached, `nu3496 stopped at the known optimum (${r.reached ? r.reached.solverSeconds.toFixed(1) + ' s, ' + r.topology : r.length})`);
    await page.screenshot({path: path.join(OUT, 'demo_iphone15.png')});
  } else console.log('  (no DEMO_PASSWORD: the unlocked demo is not tested here)');
  fs.writeFileSync(path.join(OUT, 'result.txt'), log.join('\n') + '\n');
  await browser.close(); tls.close(); proxy.close();
  console.log(failed ? '8zTSP DEMO WEBKIT: FAILED' : '8zTSP DEMO WEBKIT: OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
