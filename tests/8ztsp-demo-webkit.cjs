'use strict';
// »8zTSP in your browser« (/8zTSP/) on WebKit with Playwright's iPhone 15 profile (BD's program, 15 Nov 2026, item c:
// »a Safari/WebKit iPhone-profile smoke of /8zTSP/«). The browser reaches https://www.mdlxdcc.org through a local proxy that
// sends it to a local HTTPS server of public/ (a throw-away self-signed certificate; BD's lock checks the host name, and
// WebCrypto and shared memory need a secure origin). The server sets the /8zTSP/ headers of public/_headers.
// Checked: the lock page (EN + SL access line, the request form, no horizontal scroll), cross-origin isolation, the install
// box (Safari: »Share → Add to Home Screen«), a wrong password (the lock stays; no worker; no solver file requested by the
// page). With DEMO_PASSWORD in the environment (never in the repository) also: unlock, nu3496 with the iPhone default of
// 8 workers, the stop at the known optimum. ENGINE=chromium runs the same steps on a local Chromium (CHROMIUM_PATH).
// usage: node tests/8ztsp-demo-webkit.cjs     (needs playwright@1.58.2 on NODE_PATH, as in start-app.yml)
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), https = require('node:https'), net = require('node:net'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const pw = require('playwright');
const pub = path.join(__dirname, '..', 'public');
const OUT = process.env.DEMO_QA_EVIDENCE || path.join(require('node:os').tmpdir(), 'demo-qa');
fs.mkdirSync(OUT, {recursive: true});
const ENGINE = process.env.ENGINE || 'webkit';
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.tsp': 'text/plain', '.csv': 'text/csv', '.md': 'text/markdown', '.enc': 'application/octet-stream'};
let buildOverride = null;                                                      // dynamic A->B->C PWA update scenarios (after main smoke)
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
function makePwaBuild(tag, opts = {}) {
  const dir = path.join(pub, '8zTSP');
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'precache-manifest.json'), 'utf8'));
  const orig = man.version, version = (tag + '00000000000000000000').slice(0, 20);
  let pwa = fs.readFileSync(path.join(dir, 'pwa.js'), 'utf8').replaceAll(orig, version).replace(/<60000\)/g, '<50)');
  if (opts.builtAt) pwa = pwa.replace(/const BUILT_AT='[^']+';/, `const BUILT_AT='${opts.builtAt}';`);
  let sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8').replaceAll(orig, version);
  if (opts.stuckWorker) {
    sw = sw.replace("if(event.data?.type==='SKIP_WAITING')", "if(false && event.data?.type==='SKIP_WAITING')");
    sw = sw.replace("if(event.data?.type==='STATUS')", "if(false && event.data?.type==='STATUS')");
  }
  const pwaBuf = Buffer.from(pwa, 'utf8'), swBuf = Buffer.from(sw, 'utf8');
  const files = man.files.map(e => e.path === 'pwa.js' ? {path: 'pwa.js', sha256: sha256(pwaBuf)} : e);
  return {version, pwaBuf, swBuf, manBuf: Buffer.from(JSON.stringify({version, files}, null, 2), 'utf8')};
}

// a throw-away certificate for www.mdlxdcc.org (openssl is on the runner)
const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'demo-tls-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=www.mdlxdcc.org',
  '-addext', 'subjectAltName=DNS:www.mdlxdcc.org', '-keyout', path.join(tmp, 'key.pem'), '-out', path.join(tmp, 'cert.pem')], {stdio: 'ignore'});
const requests = [];
// UI-only contract fixture: real app.js, synthetic worker messages, no protected HTML,
// credentials, compiled solver or constructor instrumentation. Never served by production.
const RESULT_ACTIONS_HTML = "<div class=\"row actions result-actions\"><button id=\"download\" type=\"button\" disabled><span class=\"l-en\" lang=\"en\">Download result</span><span class=\"l-sl\" lang=\"sl\">Prenesi rezultat</span></button><button id=\"share\" type=\"button\" disabled><span class=\"l-en\" lang=\"en\">Share result</span><span class=\"l-sl\" lang=\"sl\">Deli rezultat</span></button></div><p class=\"hint\" id=\"resultShareNotice\" role=\"status\" aria-live=\"polite\" hidden></p><button id=\"downloadSame\" type=\"button\" class=\"secondary result-share-fallback\" hidden disabled><span class=\"l-en\" lang=\"en\">Download the same file</span><span class=\"l-sl\" lang=\"sl\">Prenesi isto datoteko</span></button>";
const RESULT_ACTIONS_CSS = ".result-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.result-actions button{min-width:0;min-height:48px;font-size:16px;line-height:1.3;white-space:normal}.result-share-fallback{width:100%;min-height:48px;margin:8px 0}.result-share-fallback[hidden],#resultShareNotice[hidden]{display:none!important}";
const FINLAND_UI_TEXT = "NAME : UI Finland fixture\nTYPE : TSP\nDIMENSION : 5\nEDGE_WEIGHT_TYPE : EUC_2D\nNODE_COORD_SECTION\n1 0 0\n2 10 0\n3 10 10\n4 0 10\n5 5 5\nEOF";
function demoUiFixture(language) {
  const source = fs.readFileSync(path.join(pub, '8zTSP/app.js'), 'utf8');
  const ids = new Set([...source.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]));
  for (const id of ['count', 'seed', 'seconds', 'reference', 'panel-nu', 'panel-rnd', 'panel-file']) ids.add(id);
  ids.delete('replayPlay'); ids.delete('firstSeconds'); ids.delete('secondSeconds');
  for(const id of ['run','stop','download','share','downloadSame','resultShareNotice']) ids.delete(id);
  const tags = [...ids].map(id => {
    if (id === 'map') return '<canvas id="map"></canvas>';
    if (['workers', 'example', 'collection', 'refresh'].includes(id)) return `<select id="${id}">${id === 'refresh' ? '<option value="150">Live</option>' : ''}</select>`;
    if (id === 'passTimes') return '<div id="passTimes"><label>First pass / Prvi prehod<input id="firstSeconds" type="number" step="any" value="5"></label><label>Second pass / Drugi prehod<input id="secondSeconds" type="number" step="any" value="55"></label></div>';
    if (id === 'twoPass') return '<label><input id="twoPass" type="checkbox" checked><span class="l-en">Two passes</span><span class="l-sl">Dva prehoda</span></label>';
    if (['stopOptimum', 'refinement'].includes(id)) return `<input id="${id}" type="checkbox" checked>`;
    if (['count', 'seed', 'seconds', 'reference'].includes(id)) return `<input id="${id}" type="number" value="${id === 'count' ? 5 : id === 'seconds' ? 60 : id === 'seed' ? 1 : ''}">`;
    if (['run', 'stop', 'download', 'replayOpen', 'mapExpand', 'mapClose', 'generate'].includes(id)) return `<button id="${id}">${id}</button>`;
    return `<div id="${id}"></div>`;
  }).join('\n');
  return `<!doctype html><html data-lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px sans-serif;max-width:100%;margin:12px}canvas{width:100%;height:160px}input,select{max-width:100%;box-sizing:border-box}html[data-lang=en] .l-sl,html[data-lang=sl] .l-en{display:none}.result-test{width:360px;max-width:100%}${RESULT_ACTIONS_CSS}</style></head><body>${tags}<section class="result-test"><div class="row actions"><button id="run">Run</button><button id="stop">Stop</button></div>${RESULT_ACTIONS_HTML}</section><script>
  window.Worker=class {
    postMessage(m){
      const send=d=>{if(!this.stopped)this.onmessage?.({data:{token:m.token,...d}});};
      if(m.type==='load'){queueMicrotask(()=>send({type:'ready',name:'UI fixture',coordinates:new Float64Array([0,0,10,0,10,10,0,10,5,5])}));return;}
      if(m.type!=='run')return; window.fixtureRuns=(window.fixtureRuns||0)+1;
      queueMicrotask(()=>{send({type:'budget',plan:{remainingSeconds:m.seconds,firstSeconds:m.firstBudgetSeconds,totalDeadlineEpoch:m.totalDeadlineEpoch}});if(m.twoPass)send({type:'phase',pass:1,length:0,elapsed:0,steps:0,tour:null});});
      const tour=new Uint32Array([0,1,2,3,4]);
      setTimeout(()=>send({type:'best',length:44,elapsed:0.02,steps:1,tour}),20);
      if(m.twoPass)setTimeout(()=>send({type:'phase',pass:2,length:44,elapsed:0.05,steps:1,tour}),50);
      if(!window.fixtureHoldFinish)setTimeout(()=>send({type:'done',length:44,elapsed:0.1,steps:1,tour}),100);
    }
    terminate(){this.stopped=true;}
  };
  </script><script type="module" src="/__demo_ui/app.js"></script></body></html>`;
}
const demoUiLoader = `export const loaderState={status:'ready',metrics:{serial:{sha256:'f'.repeat(64)}}};export const supportsSharedThreads=()=>false;export const solverModule=()=>({});export async function initializeWasm(){}export async function loadLkhWasm(){throw Error("Fixture excludes real solvers");}`;

function serve(req, res) {
  const url = new URL(req.url, 'https://www.mdlxdcc.org'); let p = decodeURIComponent(url.pathname);
  requests.push({method: req.method, path: p, t: Date.now()});
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(202, {'Content-Type': 'application/json'}); res.end('{"ok":true,"test":true}'); return; }
  if (p.startsWith('/__demo_ui/')) {
    const h = {'Cache-Control':'no-store','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin'};
    if (p === '/__demo_ui/index.html') { res.writeHead(200, {...h,'Content-Type':TYPES['.html']}); res.end(demoUiFixture(url.searchParams.get('lang') === 'sl' ? 'sl' : 'en')); return; }
    if (p === '/__demo_ui/examples.mjs') {
      const source=fs.readFileSync(path.join(pub,'8zTSP/examples.mjs'),'utf8').replace('b7ec61035b10949411bf30207b840d5abb28d6d6f3bcfd764aea312919b47e6c',sha256(Buffer.from(FINLAND_UI_TEXT)));
      res.writeHead(200,{...h,'Content-Type':TYPES['.mjs']});res.end(source);return;
    }
    if (p === '/__demo_ui/examples/santa1437195_uef_2cm.tsp.gz') {
      res.writeHead(200,{...h,'Content-Type':TYPES['.tsp']});res.end(FINLAND_UI_TEXT);return;
    }
    if (p === '/__demo_ui/engine-build.mjs') { res.writeHead(200,{...h,'Content-Type':TYPES['.mjs']}); res.end("export const ENGINE_BUILD={webVersion:'0.2',engineRevision:'f'.repeat(40),wasmSha256:{serial:'f'.repeat(64),shared:'f'.repeat(64)}};"); return; }
    if (p === '/__demo_ui/wasm-loader.js') { res.writeHead(200, {...h,'Content-Type':TYPES['.js']}); res.end(demoUiLoader); return; }
    p = p.replace('/__demo_ui/', '/8zTSP/');
  }
  if (/^\/8ztsp\/?$/i.test(p)) p = '/8zTSP/index.html';                       // the forced rule keeps /8zTSP/
  if (buildOverride && (p === '/8zTSP/pwa.js' || p === '/8zTSP/sw.js' || p === '/8zTSP/precache-manifest.json')) {
    const h = {'Cache-Control': 'no-cache', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin'};
    if (p.endsWith('sw.js')) { h['Content-Type'] = TYPES['.js']; h['Service-Worker-Allowed'] = '/8zTSP/'; res.writeHead(200, h); res.end(buildOverride.swBuf); return; }
    if (p.endsWith('pwa.js')) { h['Content-Type'] = TYPES['.js']; res.writeHead(200, h); res.end(buildOverride.pwaBuf); return; }
    h['Content-Type'] = TYPES['.json']; res.writeHead(200, h); res.end(buildOverride.manBuf); return;
  }
  const file = path.join(pub, p.endsWith('/') ? p + 'index.html' : p);
  if (!file.startsWith(pub) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const h = {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache'};
  if (/^\/8ztsp(\/|$)/i.test(p)) Object.assign(h, {'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin'});
  if (/\/8ztsp\/sw\.js$/i.test(p)) h['Service-Worker-Allowed'] = '/8zTSP/';
  res.writeHead(200, h); res.end(fs.readFileSync(file));
}
const tls = https.createServer({key: fs.readFileSync(path.join(tmp, 'key.pem')), cert: fs.readFileSync(path.join(tmp, 'cert.pem'))}, serve);
tls.on('clientError', (_e, sock) => sock.destroy());
tls.on('connection', s => s.on('error', () => {}));
tls.on('secureConnection', s => s.on('error', () => {}));
const proxy = http.createServer((req, res) => { res.writeHead(403); res.end(); });  // only CONNECT to www.mdlxdcc.org:443
proxy.on('clientError', (_e, sock) => sock.destroy());
proxy.on('connection', s => s.on('error', () => {}));
proxy.on('connect', (req, sock, head) => {
  if (req.url !== 'www.mdlxdcc.org:443') { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  const up = net.connect(tls.address().port, '127.0.0.1', () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); up.write(head); up.pipe(sock); sock.pipe(up); });
  up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
});

(async () => {
  execFileSync(process.execPath, ['--test', path.join(__dirname,'8ztsp-time-split.test.mjs'),path.join(__dirname,'8ztsp-run-export.test.mjs')], {stdio:'inherit'});
  await new Promise(r => tls.listen(0, '127.0.0.1', r)); await new Promise(r => proxy.listen(0, '127.0.0.1', r));
  const type = pw[ENGINE];
  const browser = await type.launch({proxy: {server: `http://127.0.0.1:${proxy.address().port}`},
    ...(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH, args: ['--ignore-certificate-errors']} : {})});
  const iphone = pw.devices['iPhone 15'];
  const context = await browser.newContext({...iphone, ignoreHTTPSErrors: true});
  const page = await context.newPage();
  const workers = []; page.on('worker', w => workers.push(w.url()));
  const log = [];
  const ok = (cond, label) => { log.push(`${cond ? 'ok' : 'FAIL'}: ${label}`); console.log(`  ${cond ? 'ok' : 'FAIL'}: ${label}`); return cond; };
  let failed = false; const check = (c, l) => { if (!ok(c, l)) failed = true; };

  // Actual app.js UI on WebKit without moving any demo secret into CI.
  // Solver correctness is a separate serial/shared WASM gate; this fixture checks UI protocol only.
  for (const language of ['en','sl']) {
    const fixture = await context.newPage();
    await fixture.addInitScript(()=>{Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});Object.defineProperty(navigator,'maxTouchPoints',{value:5});});
    await fixture.goto('https://www.mdlxdcc.org/__demo_ui/index.html?lang='+language, {waitUntil:'load'});
    await fixture.waitForFunction(() => window.tsp8zLab?.ready && tsp8zLab.coordinates.length>0);
    await fixture.evaluate(() => tsp8zLab.load(['NAME : ui','TYPE : TSP','DIMENSION : 5','EDGE_WEIGHT_TYPE : EUC_2D','NODE_COORD_SECTION','1 0 0','2 10 0','3 10 10','4 0 10','5 5 5','EOF'].join('\n'),'file'));
    check(await fixture.isChecked('#twoPass'), 'two-pass UI '+language+': checked by default');
    check(await fixture.locator('#passMode option').count()===3,'stateful choice '+language+': all three modes');
    check(await fixture.locator('#tsp-engine option[value=8ztsp]').textContent()==='8zTSP Web 0.2' &&
      await fixture.locator('#tsp-engine option[value=ortools]').textContent()==='Google OR-Tools Routing 9.15',
      'engine choices '+language+': web and OR-Tools versions');
    const splits = await fixture.locator('#finlandPreset option').allTextContents();
    check(splits.join('|') === [language === 'sl' ? 'Izberi razdelitev časa' : 'Choose a time split',
      '2 + 58 min', '5 + 55 min', '10 + 50 min'].join('|'), 'Finland presets '+language+': one dropdown with split labels in minutes');
    const hashes = await fixture.evaluate(async () => {
      const { presetFromHash } = await import('/__demo_ui/pass-mode.mjs');
      return ['120', '300', '600', '240'].map(first => presetFromHash('#finland-stateful-' + first));
    });
    check(hashes.join(',') === '120,300,600,', 'Finland presets '+language+': three deep links and unknown split ignored');
    check(!await fixture.isVisible('#finlandPreset'), 'Finland presets '+language+': hidden with a different map');
    check(await fixture.locator('#passMode option[value=stateful]').textContent()===(language==='sl'?'Dva prehoda z nadaljevanjem':'Two passes with continuation'),'stateful choice '+language+': translated');
    check(await fixture.locator('#passMode option[value=stateful]').evaluate(o=>o.disabled),'stateful choice '+language+': small map refused');
    for(const width of [390,1024]){
      await fixture.setViewportSize({width,height:900});
      const box=await fixture.locator('#passMode').boundingBox();
      check(box.height>=48,'stateful choice '+language+' '+width+': touch target');
      check(await fixture.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'stateful choice '+language+' '+width+': no horizontal overflow');
      await fixture.screenshot({path:path.join(OUT,'stateful-choice-'+language+'-'+width+'.png'),fullPage:true});
    }

    const maximum=await fixture.evaluate(() => {const s=document.getElementById('workers');return s.options[s.options.length-1].value;});
    check(await fixture.inputValue('#workers')===maximum, 'two-pass UI '+language+': maximum worker default');
    await fixture.evaluate(()=>{document.getElementById('seconds').value='3600';document.getElementById('firstSeconds').value='600';document.getElementById('secondSeconds').value='3000';});
    for(const choice of ['one','restart']){
      await fixture.selectOption('#passMode',choice);
      check(await fixture.inputValue('#firstSeconds')==='600' && await fixture.inputValue('#secondSeconds')==='3000','stateful setup '+language+': mode '+choice+' retains 600+3000');
    }
    await fixture.fill('#seconds','60');
    await fixture.fill('#seconds','3600');
    check(await fixture.inputValue('#firstSeconds')==='300' && await fixture.inputValue('#secondSeconds')==='3300', 'time fields '+language+': total edit refreshes system suggestion before manual choice');
    await fixture.fill('#seconds','120');
    check(await fixture.inputValue('#firstSeconds')==='10' && await fixture.inputValue('#secondSeconds')==='110', 'time fields '+language+': suggestions remain automatic until part edit');
    await fixture.fill('#seconds','3600');
    await fixture.fill('#firstSeconds','300');
    check(await fixture.inputValue('#secondSeconds')==='3300', 'time fields '+language+': 300 + 3300 = 3600');
    await fixture.fill('#seconds','4500'); await fixture.fill('#secondSeconds','3600');
    check(await fixture.inputValue('#firstSeconds')==='900', 'time fields '+language+': 900 + 3600 = 4500');
    await fixture.fill('#seconds','5000');
    check(await fixture.inputValue('#firstSeconds')==='1400' && await fixture.inputValue('#secondSeconds')==='3600', 'time fields '+language+': total edit retains manually chosen second part');
    await fixture.fill('#seconds',''); await fixture.locator('#seconds').pressSequentially('5000');
    check(await fixture.inputValue('#firstSeconds')==='1400' && await fixture.inputValue('#secondSeconds')==='3600', 'time fields '+language+': typing total preserves the manual choice through short prefixes');
    await fixture.fill('#firstSeconds','1200'); await fixture.fill('#seconds','6000');
    check(await fixture.inputValue('#firstSeconds')==='1200' && await fixture.inputValue('#secondSeconds')==='4800', 'time fields '+language+': latest edited part becomes the retained part');
    await fixture.fill('#secondSeconds','4800'); await fixture.setChecked('#twoPass',false);
    await fixture.fill('#seconds','7000'); await fixture.setChecked('#twoPass',true);
    check(await fixture.inputValue('#firstSeconds')==='2200' && await fixture.inputValue('#secondSeconds')==='4800', 'time fields '+language+': off/restore retains manually chosen second part');
    await fixture.evaluate(() => tsp8zLab.load('NAME : ui\nTYPE : TSP\nDIMENSION : 5\nEDGE_WEIGHT_TYPE : EUC_2D\nNODE_COORD_SECTION\n1 0 0\n2 10 0\n3 10 10\n4 0 10\n5 5 5\nEOF','random'));
    check(await fixture.inputValue('#firstSeconds')==='0.1' && await fixture.inputValue('#secondSeconds')==='9.9', 'time fields '+language+': preset clamps the manual second part to the available budget');
    await fixture.fill('#seconds','7000');
    check(await fixture.inputValue('#firstSeconds')==='2200' && await fixture.inputValue('#secondSeconds')==='4800', 'time fields '+language+': original manual value returns when the budget permits');
    await fixture.fill('#seconds','4'); await fixture.fill('#firstSeconds','1.2345');
    check(await fixture.inputValue('#secondSeconds')==='2.7655', 'time fields '+language+': decimal precision');
    await fixture.setChecked('#twoPass',false);
    check(!await fixture.isVisible('#passTimes'), 'time fields '+language+': hidden when off');
    await fixture.fill('#seconds','5'); await fixture.setChecked('#twoPass',true);
    check(await fixture.inputValue('#firstSeconds')==='1.2345' && await fixture.inputValue('#secondSeconds')==='3.7655', 'time fields '+language+': restored after off and total edit');
    await fixture.fill('#seconds','0.1');
    check(await fixture.inputValue('#firstSeconds')==='0.05' && await fixture.inputValue('#secondSeconds')==='0.05', 'time fields '+language+': short budget');
    await fixture.fill('#seconds','2'); await fixture.fill('#firstSeconds','0.5');
    for (const enabled of [false,true]) {
      await fixture.setChecked('#twoPass',enabled);
      await fixture.evaluate(() => { window.uiRun=tsp8zLab.start({workers:1,recording:false}); });
      const state=await fixture.evaluate(async () => {const r=await window.uiRun;return {enabled:r.twoPass,phases:r.passEvents.map(x=>x.pass)};});
      check(state.enabled===enabled && state.phases.join(',')===(enabled?'1,2':''), 'two-pass UI '+language+': '+(enabled?'enabled transitions':'off baseline'));
    }
    await fixture.evaluate(() => tsp8zLab.load('NAME : ui\nTYPE : TSP\nDIMENSION : 5\nEDGE_WEIGHT_TYPE : EUC_2D\nNODE_COORD_SECTION\n1 0 0\n2 10 0\n3 10 10\n4 0 10\n5 5 5\nEOF','file'));
    check(await fixture.isChecked('#twoPass'), 'two-pass UI '+language+': reload restores checked default');
    check(await fixture.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1), 'two-pass UI '+language+': no horizontal overflow');
    // The exact visible result controls from the protected page; only the solver is synthetic.
    check(await fixture.isDisabled('#download') && await fixture.isDisabled('#share'), 'result controls '+language+': both disabled without a tour');
    const runsBefore=await fixture.evaluate(()=>window.fixtureRuns||0);
    await fixture.selectOption('#collection','selected');
    await fixture.waitForFunction(()=>!document.getElementById('run').disabled);
    await fixture.fill('#seconds','4500'); await fixture.fill('#secondSeconds','3600'); await fixture.setChecked('#twoPass',false);
    await fixture.selectOption('#collection','country-benchmarks');
    await fixture.waitForFunction(()=>document.getElementById('example').value==='santa1437195_uef_2cm' && !document.getElementById('run').disabled);
    check(await fixture.inputValue('#seconds')==='3600' && await fixture.inputValue('#firstSeconds')==='300' && await fixture.inputValue('#secondSeconds')==='3300' && await fixture.isChecked('#twoPass'), 'Finland collection '+language+': Finland and 3600 / on / 300 + 3300 after manual second/off');
    await fixture.fill('#seconds','4500');await fixture.fill('#firstSeconds','900');await fixture.fill('#seconds','5000');
    check(await fixture.inputValue('#firstSeconds')==='900' && await fixture.inputValue('#secondSeconds')==='4100', 'Finland collection '+language+': ordinary manual override remains available');
    await fixture.selectOption('#collection','selected');await fixture.waitForFunction(()=>!document.getElementById('run').disabled);
    await fixture.fill('#firstSeconds','1.2345');
    await fixture.selectOption('#collection','country-benchmarks');await fixture.waitForFunction(()=>document.getElementById('example').value==='santa1437195_uef_2cm' && !document.getElementById('run').disabled && document.getElementById('seconds').value==='3600' && document.getElementById('firstSeconds').value==='300' && document.getElementById('secondSeconds').value==='3300');
    check(await fixture.inputValue('#seconds')==='3600' && await fixture.inputValue('#firstSeconds')==='300' && await fixture.inputValue('#secondSeconds')==='3300', 'Finland collection '+language+': every new collection choice resets the manual anchor');
    check(await fixture.evaluate(()=>window.fixtureRuns||0)===runsBefore, 'Finland collection '+language+': never auto-starts');
    check(await fixture.isVisible('#finlandPreset'), 'Finland presets '+language+': visible on the competition map');
    await fixture.evaluate(() => document.getElementById('p-file').click());
    check(!await fixture.isVisible('#finlandPreset'), 'Finland presets '+language+': hidden on the file tab');
    await fixture.evaluate(async()=>{await tsp8zLab.load(['NAME : export fixture','TYPE : TSP','DIMENSION : 5','EDGE_WEIGHT_TYPE : EUC_2D','NODE_COORD_SECTION','1 0 0','2 10 0','3 10 10','4 0 10','5 5 5','EOF'].join('\n'),'file');window.fixtureHoldFinish=true;window.exportTestRun=tsp8zLab.start({seconds:30,workers:1,recording:false}).catch(()=>null);});
    await fixture.waitForFunction(()=>tsp8zLab.hasResult && tsp8zLab.liveWorkers>0);
    check(await fixture.isEnabled('#download') && await fixture.isEnabled('#share'), 'result controls '+language+': both enabled on first best tour while search is still running');
    await fixture.evaluate(()=>tsp8zLab.stop());
    let downloads=0;fixture.on('download',()=>downloads++);
    const downloaded=async(selector,label)=>{
      const [d]=await Promise.all([fixture.waitForEvent('download'),fixture.click(selector)]);
      const file=path.join(OUT,'export-'+language+'-'+label+'.json');await d.saveAs(file);
      check(d.suggestedFilename()==='8ztsp-run.json','result export '+language+': filename '+label);
      const body=fs.readFileSync(file,'utf8'),r=JSON.parse(body);
      check(r.tour.join(',')==='1,2,3,4,5' && r.tourLength===44 && !!r.passPlan && !!r.inputSha256,'result export '+language+': full JSON and route '+label);
      return body;
    };
    const downloadBody=await downloaded('#download','download');
    await fixture.evaluate(()=>{
      window.shareMode='success';window.shareCalls=[];window.shareChecks=[];
      document.getElementById('share').addEventListener('click',e=>{window.shareTrusted=e.isTrusted;},true);
      Object.defineProperty(navigator,'canShare',{configurable:true,value(data){window.canShareFile=data.files?.[0];window.shareChecks.push(Object.keys(data));return window.shareMode!=='unsupported';}});
      Object.defineProperty(navigator,'share',{configurable:true,value(data){
        const file=data.files?.[0];window.shareCalls.push({keys:Object.keys(data),name:file?.name,type:file?.type,size:file?.size,realFile:file instanceof File,sameFile:file===window.canShareFile,trusted:window.shareTrusted,activation:navigator.userActivation?.isActive??null});
        window.shareText=file.text();
        if(window.shareMode==='cancel')return Promise.reject(new DOMException('cancelled','AbortError'));
        if(window.shareMode==='rejected')return Promise.reject(new DOMException('blocked','NotAllowedError'));
        return Promise.resolve();
      }});
    });
    await fixture.click('#share');await fixture.waitForFunction(()=>!document.getElementById('share').disabled);
    const success=await fixture.evaluate(async()=>({call:window.shareCalls.at(-1),text:await window.shareText}));
    check(success.call.keys.join(',')==='files' && success.call.realFile && success.call.sameFile && success.call.trusted && success.call.activation!==false, 'Web Share '+language+': trusted direct click passes only the same real File');
    check(success.call.name==='8ztsp-run.json' && success.call.type==='application/json' && success.text===downloadBody,'Web Share '+language+': identical full download/share JSON bytes');
    check(downloads===1 && !await fixture.isVisible('#downloadSame'),'Web Share '+language+': success does not auto-download');
    for(const mode of ['unsupported','rejected']){
      await fixture.evaluate(m=>window.shareMode=m,mode);const beforeCalls=await fixture.evaluate(()=>window.shareCalls.length);
      await fixture.click('#share');await fixture.waitForFunction(()=>!document.getElementById('downloadSame').hidden);
      const sameBody=await downloaded('#downloadSame',mode);
      const attempted=await fixture.evaluate(async()=>await window.canShareFile.text());
      check(sameBody===attempted && sameBody===downloadBody,'Web Share '+language+': '+mode+' fallback downloads the same complete File');
      check((await fixture.textContent('#resultShareNotice')).includes(language==='sl'?'Datotekah':'Files'),'Web Share '+language+': '+mode+' shows Files/Downloads guidance');
      if(mode==='unsupported')check(await fixture.evaluate(()=>window.shareCalls.length)===beforeCalls,'Web Share '+language+': unsupported files never invoke share');
    }
    await fixture.evaluate(()=>window.shareMode='cancel');const beforeCancel=downloads;
    await fixture.click('#share');await fixture.waitForFunction(()=>!document.getElementById('share').disabled);
    check(!await fixture.isVisible('#downloadSame') && downloads===beforeCancel && (await fixture.textContent('#resultShareNotice')).includes(language==='sl'?'preklicano':'cancelled'),'Web Share '+language+': cancellation respected with no fallback or auto-download');
    for(const width of [390,1024]){
      await fixture.setViewportSize({width,height:900});await fixture.locator('#download').scrollIntoViewIfNeeded();
      const dimensions=await fixture.evaluate(()=>{const d=document.getElementById('download'),s=document.getElementById('share'),stop=document.getElementById('stop');return {d:d.getBoundingClientRect().toJSON(),s:s.getBoundingClientRect().toJSON(),stop:stop.getBoundingClientRect().toJSON(),buttons:d.tagName==='BUTTON'&&s.tagName==='BUTTON',overflow:document.documentElement.scrollWidth>innerWidth+1};});
      check(dimensions.buttons && dimensions.d.height>=48 && dimensions.s.height>=48 && dimensions.d.top>=dimensions.stop.bottom && dimensions.d.right<=width && dimensions.s.right<=width && !dimensions.overflow,'result controls '+language+': visible real buttons below Run/Stop at '+width+'px');
      await fixture.screenshot({path:path.join(OUT,'result-actions-'+language+'-'+width+'.png'),fullPage:true});
    }
    await fixture.screenshot({path:path.join(OUT,'two-pass-ui-'+language+'.png'),fullPage:true});
    await fixture.close();
  }
  if (process.env.DEMO_UI_ONLY==='1') {
    await browser.close(); tls.closeAllConnections();tls.close();proxy.closeAllConnections();proxy.close();
    fs.writeFileSync(path.join(OUT,'result.txt'),log.join('\n')+'\n');process.exit(failed?1:0);
  }

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
  const bar0 = await page.evaluate(() => { const b = document.getElementById('tsp8zUpdateBar'); const cs = b ? getComputedStyle(b) : null; return {display: cs?.display, h: b ? Math.round(b.getBoundingClientRect().height) : -1, hidden: b?.hidden}; });
  check(bar0.display === 'none' && bar0.h === 0 && bar0.hidden === true, `up-to-date lock page: orange update bar is truly hidden (display=${bar0.display}, h=${bar0.h})`);
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
    const d = await page.evaluate(() => ({workers: document.getElementById('workers').value, maximum: document.getElementById('workers').options[document.getElementById('workers').options.length-1].value, iso: self.crossOriginIsolated}));
    check(d.workers === d.maximum, `iPhone: maximum ${d.maximum} workers by default (${d.workers})`);
    const r = await page.evaluate(() => window.tsp8zLab.start({seconds: 240}).then(r => ({length: r.length, reached: r.optimumReached, topology: r.topology})));
    check(r.length === 96132 && !!r.reached, `nu3496 stopped at the known optimum (${r.reached ? r.reached.solverSeconds.toFixed(1) + ' s, ' + r.topology : r.length})`);
    await page.screenshot({path: path.join(OUT, 'demo_iphone15.png')});
    check(await page.inputValue('#tsp-engine') === '8ztsp', '8zTSP is the default motor');
    const sample = fs.readFileSync(path.join(__dirname, 'fixtures/tsp-rivals/syn_hier_64.tsp'), 'utf8');
    const coordinates = sample.split('NODE_COORD_SECTION')[1].trim().split(/\r?\n/)
      .filter(line => /^\d/.test(line)).map(line => line.trim().split(/\s+/).slice(1, 3).map(Number));
    await page.evaluate(text => window.tsp8zLab.load(text, 'file'), sample);
    for (const engine of ['lkh', 'eax', 'ortools']) {
      await page.selectOption('#tsp-engine', engine);
      check(await page.isEnabled('#run') && !await page.isEnabled('#workers') && await page.inputValue('#workers') === '1', 'rival ' + engine + ': shared Run button in single worker mode');
      const result = await page.evaluate(() => window.tsp8zLab.start({seconds: 8, seed: 1}));
      assert.equal(result.executionLocation, 'browser-wasm-local');
      assert.equal(result.tour.length, 64);
      assert.deepEqual([...result.tour].sort((a,b) => a-b), coordinates.map((_,i)=>i+1));
      const length = result.tour.reduce((total, id, i) => {
        const a = coordinates[id-1], b = coordinates[result.tour[(i+1)%result.tour.length]-1];
        return total + Math.round(Math.hypot(a[0]-b[0], a[1]-b[1]));
      }, 0);
      check(result.tourLength === length && result.lengthMatchesVerifier, 'rival ' + engine + ': independent closed tour ' + length);
    }
    check(requests.some(r => r.path.endsWith('/lkh_3_0_14.wasm.enc')) &&
      !requests.some(r => r.path.endsWith('/lkh_3_0_14.wasm')), 'LKH runtime is loaded from an encrypted envelope');
  } else console.log('  (no DEMO_PASSWORD: the unlocked demo is not tested here)');
  // ======== PWA update & orange-banner checks (A->B, stuck worker rescue, unlocked non-pullback, dismiss, 2 consecutive builds)
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const barInfo = p => p.evaluate(() => {
    const b = document.getElementById('tsp8zUpdateBar'), cs = b ? getComputedStyle(b) : null, r = b ? b.getBoundingClientRect() : {height: 0};
    let diagObj = null; try { diagObj = JSON.parse(sessionStorage.getItem('tsp8z-diag') || 'null'); } catch {}
    return {visible: !!b && cs.display !== 'none' && r.height > 0, display: cs?.display, h: Math.round(r.height),
      locked: !!document.getElementById('pw'), unlocked: !document.getElementById('pw') && !!document.getElementById('run'),
      build: document.getElementById('tsp8zBuild')?.textContent?.trim() || '', diag: document.getElementById('tsp8zDiag')?.textContent?.trim() || '',
      diagN: diagObj?.n || 0, mark: window.__pwaMark || null, url: location.pathname + location.search};
  });
  const ctx2 = await browser.newContext({...iphone, ignoreHTTPSErrors: true});
  const p2 = await ctx2.newPage();
  const p2Errors = []; p2.on('pageerror', e => p2Errors.push(String(e)));
  buildOverride = makePwaBuild('aaaa1111aaaa1111aaaa', {builtAt: '2026-11-19T15:01'});
  await p2.goto('https://www.mdlxdcc.org/8zTSP/?lang=en', {waitUntil: 'load'});
  await p2.waitForSelector('#pw', {timeout: 20000});
  await p2.waitForFunction(async () => { const r = await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller && r.active?.state === 'activated'; }, null, {timeout: 30000});
  await sleep(600);
  const pa = await barInfo(p2);
  check(!pa.visible && pa.display === 'none' && pa.h === 0, `PWA A up-to-date: bar hidden (display=${pa.display}, h=${pa.h})`);
  // Build A -> B on lock page: auto-updates once (fresh document, BUILT_AT 15:02, diag n=1), no loop, bar stays hidden
  await p2.evaluate(() => { window.__pwaMark = 'A'; });
  let reloads = 0; const onNav = f => { if (f === p2.mainFrame()) reloads++; }; p2.on('framenavigated', onNav);
  buildOverride = makePwaBuild('bbbb2222bbbb2222bbbb', {builtAt: '2026-11-19T15:02'});
  await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p2.waitForFunction(() => (document.getElementById('tsp8zDiag')?.textContent || '').includes('15:02') && (document.getElementById('tsp8zBuild')?.textContent || '').includes('bbbb2222'), null, {timeout: 30000}).catch(() => {});
  await sleep(2500); p2.off('framenavigated', onNav);
  const pb = await barInfo(p2);
  console.log('  [PWA A->B]', JSON.stringify(pb), 'navs=', reloads);
  check(pb.build.includes('bbbb2222') && pb.diag.includes('15:02') && pb.mark === null && pb.diagN === 1 && reloads <= 1 && !pb.visible,
    `PWA A->B lock: auto-updated once to bbbb2222/15:02 (mark=${pb.mark}, n=${pb.diagN}, navs=${reloads}), bar hidden (visible=${pb.visible})`);
  // Build B -> C with stuck waiting worker (ignores SKIP_WAITING & STATUS): rescue() clears caches & lands cleanly on C
  buildOverride = makePwaBuild('cccc3333cccc3333cccc', {builtAt: '2026-11-19T15:03', stuckWorker: true});
  await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p2.waitForFunction(() => (document.getElementById('tsp8zDiag')?.textContent || '').includes('15:03'), null, {timeout: 30000}).catch(() => {});
  await sleep(2000);
  const pc = await barInfo(p2);
  check(pc.diag.includes('15:03') && !pc.visible && !pc.url.includes('_u='), `PWA B->C stuck worker rescue: landed on 15:03, bar hidden (visible=${pc.visible}), clean URL (${pc.url})`);
  // If DEMO_PASSWORD is set: test unlocked non-pullback, dismiss (x), and two consecutive builds D -> E
  if (process.env.DEMO_PASSWORD) {
    // Switch to clean C first so SW activates normally before unlock
    buildOverride = makePwaBuild('cccc3333cccc3333cccc', {builtAt: '2026-11-19T15:03'});
    await p2.goto('https://www.mdlxdcc.org/8zTSP/?lang=en', {waitUntil: 'load'});
    await p2.waitForSelector('#pw', {timeout: 20000});
    await p2.waitForFunction(async () => !!navigator.serviceWorker.controller, null, {timeout: 30000});
    await p2.fill('#pw', process.env.DEMO_PASSWORD); await p2.click('#unlock');
    await p2.waitForFunction(() => !!window.tsp8zLab?.ready, null, {timeout: 120000});
    buildOverride = makePwaBuild('dddd4444dddd4444dddd', {builtAt: '2026-11-19T15:04'});
    await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await p2.waitForFunction(() => { const b = document.getElementById('tsp8zUpdateBar'); return !!document.getElementById('pw') || (b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height > 0); }, null, {timeout: 25000}).catch(() => {});
    await sleep(1500);
    const pd = await barInfo(p2);
    check(pd.unlocked && !pd.locked && pd.visible, `PWA C->D unlocked: stays unlocked (unlocked=${pd.unlocked}), bar shown (visible=${pd.visible})`);
    if (pd.unlocked && pd.visible) {
      await p2.click('#tsp8zUpdateClose'); await sleep(400);
      const pdClose = await barInfo(p2);
      check(pdClose.unlocked && !pdClose.visible, `PWA dismiss: bar hidden and still unlocked (visible=${pdClose.visible})`);
      // Two consecutive builds: D was waiting, E deploys before tap
      buildOverride = makePwaBuild('eeee5555eeee5555eeee', {builtAt: '2026-11-19T15:05'});
      await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await p2.waitForFunction(() => { const b = document.getElementById('tsp8zUpdateBar'); return b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height > 0; }, null, {timeout: 25000}).catch(() => {});
      await p2.click('#tsp8zUpdateNow');
      await p2.waitForFunction(() => (document.getElementById('tsp8zBuild')?.textContent || '').includes('eeee5555'), null, {timeout: 30000}).catch(() => {});
      await sleep(2000);
      const pe = await barInfo(p2);
      check(pe.build.includes('eeee5555') && !pe.visible, `PWA 2 consecutive builds D->E tap: landed on eeee5555, bar hidden (visible=${pe.visible})`);
    }
  }
  check(p2Errors.length === 0, `PWA update checks: no page errors (${p2Errors.length})`);
  await ctx2.close();
  buildOverride = null;
  fs.writeFileSync(path.join(OUT, 'result.txt'), log.join('\n') + '\n');
  await browser.close(); tls.close(); proxy.close();
  console.log(failed ? '8zTSP DEMO WEBKIT: FAILED' : '8zTSP DEMO WEBKIT: OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
