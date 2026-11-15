// 8zTSP in the browser: the page script of mdlxdcc.org/bd/bd_8ztsp_web (BD × AI Lab, 15 Nov 2026).
// Based on app.js of 8zTSP-web R2 (sha256 27f2465e…; kernel 7f98b90 = main 2a635dd): when the page is cross-origin
// isolated, the workers share one population (one coordinator and compute workers over one WebAssembly memory);
// otherwise several workers are separate tries. Changes for the site, as in R18: English and Slovene texts that follow
// the site's language setting; nu3496 (the site's copy of the Waterloo file) is the default map, with 60 s and its known
// optimum as the reference; the time of the first optimum is shown; no automatic random map. New in R19: the mode that
// runs is shown, and with shared memory the default number of workers follows the computer (the largest offered count
// up to navigator.hardwareConcurrency - 1, at most 7). worker.js, pool-worker.js, pkg/ and pkg-shared/ are R2's, unchanged.
const $ = id => document.getElementById(id);
const root = document.documentElement;
const canvas = $('map'), ctx = canvas.getContext('2d');
const NU = { url: new URL('../nu3496.tsp', import.meta.url), name: 'nu3496', optimum: 96132, seconds: 60 };
const COUNTS = [1, 2, 4, 7];
const canShare = (() => {
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') return false;
  try { return new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }).buffer instanceof SharedArrayBuffer; } catch { return false; }
})();
let text = '', coords = new Float64Array(), tour = null, pool = [], loading = null;
let generation = 0, best = Infinity, started = 0, timer, active = false, runRecord = null, shownElapsed = 0, rejectActive = null;
let mapName = '', inputHash = '', lastDraw = 0, preset = '', tab = 'nu', statusKey = ['wasm'];
const lang = () => root.dataset.lang === 'sl' ? 'sl' : 'en';
const group = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang() === 'sl' ? '.' : ',');
const dec = (x, d) => { const s = x.toFixed(d); return lang() === 'sl' ? s.replace('.', ',') : s; };
const pct = x => `${dec(x, 3)}${lang() === 'sl' ? ' %' : '%'}`;
const slPlural = (n, one, two, few, many) => { const m = n % 100; return m === 1 ? one : m === 2 ? two : m === 3 || m === 4 ? few : many; };
const T = {
  en: {
    wasm: 'Loading WebAssembly…', nuLoading: 'Loading nu3496…', reading: 'Reading the map…',
    readyWin: 'Ready · window search with 3-opt (maps over 12,000 cities).',
    readyPop: 'Ready · population search with diversity selection.',
    searching: (n, sharing) => n === 1 ? 'Searching with 1 worker…' : `Searching · ${n} workers · ${sharing ? 'one shared population' : 'separate tries'}…`,
    complete: (s, opt) => 'Complete · tour checked in Rust.' + (s === null ? '' :
      ` ${opt ? 'Optimum' : 'Reference'} first reached after ${dec(s, 1)} s of solver time.`),
    stopped: 'Stopped · the last tour shown is kept.',
    stoppedErr: m => `Search stopped: ${m}`, workerFail: m => `Worker failed: ${m}`,
    noSolver: m => `Unable to load the solver: ${m}`,
    nuFail: 'nu3496 could not be loaded; try random points or your own file.',
    needShare: 'Shared workers need shared memory, which this browser does not offer here.',
    cities: n => `${group(n)} ${n === 1 ? 'city' : 'cities'}`,
    range: (label, lo, hi) => `${label}: enter a number from ${group(lo)} to ${group(hi)}`,
    integers: 'Cities and seed must be whole numbers', seedInt: 'The seed must be a whole number',
    workers: 'Choose 1, 2, 4 or 7 workers', loadFirst: 'Load a map before running', fileLimit: 'File limit: 32 MB',
    gapOpt: 'ABOVE THE OPTIMUM', gapRef: 'ABOVE THE REFERENCE', reachOpt: 'OPTIMUM FIRST REACHED', reachRef: 'REFERENCE FIRST REACHED',
    count: 'Random cities', seed: 'Seed', seconds: 'Seconds', reference: 'Reference length',
    placeholder: 'for the gap and the first-reach time', canvas: 'Points and the best tour',
    modeShared: 'Mode: shared memory. The workers share one population (on maps over 12,000 cities, one group of windows).',
    modeOne: 'Mode: one worker. With more workers they would share one population.',
    modeSeparate: 'Mode: separate tries. This browser offers no shared memory here, so each worker has its own population and seed; the page shows the best.',
    modeChosen: 'Mode: separate tries, as chosen; each worker has its own population and seed.',
    modeOneNoShare: 'Mode: one worker. This browser offers no shared memory here, so more workers would be separate tries.',
  },
  sl: {
    wasm: 'Nalagam WebAssembly…', nuLoading: 'Nalagam nu3496…', reading: 'Berem zemljevid…',
    readyWin: 'Pripravljeno · iskanje z okni in 3-opt (zemljevidi z več kot 12.000 mesti).',
    readyPop: 'Pripravljeno · populacijsko iskanje z izbiro z raznolikostjo.',
    searching: (n, sharing) => n === 1 ? 'Iskanje teče · 1 delavec…' :
      `Iskanje teče · ${n} ${slPlural(n, 'delavec', 'delavca', 'delavci', 'delavcev')} · ${sharing ? 'skupna populacija' : 'ločeni poskusi'}…`,
    complete: (s, opt) => 'Končano · pot preverjena v Rustu.' + (s === null ? '' :
      ` ${opt ? 'Optimum' : 'Referenca'} prvič dosežen${opt ? '' : 'a'} po ${dec(s, 1)} s časa reševalnika.`),
    stopped: 'Ustavljeno · zadnja prikazana pot ostane.',
    stoppedErr: m => `Iskanje se je ustavilo: ${m}`, workerFail: m => `Delavec je odpovedal: ${m}`,
    noSolver: m => `Reševalnika ni bilo mogoče naložiti: ${m}`,
    nuFail: 'nu3496 se ni naložil; poskusite z naključnimi točkami ali s svojo datoteko.',
    needShare: 'Delavci si lahko delijo populacijo le s skupnim pomnilnikom, ki ga ta brskalnik tu ne ponuja.',
    cities: n => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}`,
    range: (label, lo, hi) => `${label}: vnesite število od ${group(lo)} do ${group(hi)}`,
    integers: 'Število mest in seme morata biti celi števili', seedInt: 'Seme mora biti celo število',
    workers: 'Izberite 1, 2, 4 ali 7 delavcev', loadFirst: 'Pred zagonom naložite zemljevid', fileLimit: 'Omejitev datoteke: 32 MB',
    gapOpt: 'NAD OPTIMUMOM', gapRef: 'NAD REFERENCO', reachOpt: 'OPTIMUM PRVIČ DOSEŽEN', reachRef: 'REFERENCA PRVIČ DOSEŽENA',
    count: 'Naključna mesta', seed: 'Seme', seconds: 'Sekunde', reference: 'Referenčna dolžina',
    placeholder: 'za odmik in čas prvega dosega', canvas: 'Točke in najboljša pot',
    modeShared: 'Način: skupni pomnilnik. Delavci si delijo eno populacijo (na zemljevidih z več kot 12.000 mesti eno skupino oken).',
    modeOne: 'Način: en delavec. Več delavcev bi si delilo eno populacijo.',
    modeSeparate: 'Način: ločeni poskusi. Ta brskalnik tu ne ponuja skupnega pomnilnika, zato ima vsak delavec svojo populacijo in seme; stran pokaže najboljši izid.',
    modeChosen: 'Način: ločeni poskusi, kot izbrano; vsak delavec ima svojo populacijo in seme.',
    modeOneNoShare: 'Način: en delavec. Ta brskalnik tu ne ponuja skupnega pomnilnika, zato bi več delavcev pomenilo ločene poskuse.',
  },
};
const t = (key, ...args) => { const v = T[lang()][key]; return typeof v === 'function' ? v(...args) : v; };
const english = (key, ...args) => T.en[key] instanceof Function ? T.en[key](...args) : T.en[key];
class Message extends Error { constructor(key, ...args) { super(english(key, ...args)); this.key = [key, ...args]; } }
const status = (...key) => { statusKey = key; $('status').textContent = t(...key); };
const isOptimum = () => preset === 'nu3496' && Number($('reference').value) === NU.optimum;
function number(id, low, high) {
  const value = Number($(id).value);
  if (!Number.isFinite(value) || value < low || value > high) throw new Message('range', T[lang()][id], low, high);
  return value;
}
function modeKey() {
  const run = active && runRecord;
  const n = run ? run.workers : Number($('workers').value);
  if (n === 1) return canShare ? 'modeOne' : 'modeOneNoShare';
  if (!run) return canShare ? 'modeShared' : 'modeSeparate';
  return run.topology.startsWith('shared') ? 'modeShared' : canShare ? 'modeChosen' : 'modeSeparate';
}
function render() {
  $('length').textContent = Number.isFinite(best) ? group(best) : '—';
  const reference = runRecord?.reference || Number($('reference').value);
  $('gap').textContent = reference > 0 && Number.isFinite(best) ? pct((best / reference - 1) * 100) : '—';
  $('gapLabel').textContent = t(isOptimum() ? 'gapOpt' : 'gapRef');
  $('reachLabel').textContent = t(isOptimum() ? 'reachOpt' : 'reachRef');
  $('reach').textContent = runRecord?.firstReach ? `${dec(runRecord.firstReach.solverSeconds, 1)} s` : '—';
  $('elapsed').textContent = `${dec(shownElapsed, 1)} s`;
  $('cityCount').textContent = coords.length ? t('cities', coords.length / 2) : '';
  $('reference').placeholder = t('placeholder');
  $('mode').textContent = t(modeKey());
  canvas.setAttribute('aria-label', t('canvas'));
  $('status').textContent = t(...statusKey);
}
function draw() {
  const ratio = devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  if (!coords.length) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < coords.length; i += 2) {
    minX = Math.min(minX, coords[i]); maxX = Math.max(maxX, coords[i]);
    minY = Math.min(minY, coords[i + 1]); maxY = Math.max(maxY, coords[i + 1]);
  }
  const scale = Math.min((w - 24) / Math.max(1, maxX - minX), (h - 24) / Math.max(1, maxY - minY));
  const ox = (w - (maxX - minX) * scale) / 2, oy = (h - (maxY - minY) * scale) / 2;
  const point = id => [ox + (coords[id * 2] - minX) * scale, h - oy - (coords[id * 2 + 1] - minY) * scale];
  if (tour?.length) {
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = coords.length > 20000 ? .5 : 1;
    ctx.beginPath(); tour.forEach((id, i) => { const p = point(id); i ? ctx.lineTo(...p) : ctx.moveTo(...p); });
    ctx.closePath(); ctx.stroke();
  }
  ctx.fillStyle = '#e7eef9';
  const radius = coords.length > 20000 ? .6 : coords.length > 3000 ? 1 : 1.8;
  ctx.beginPath();
  for (let i = 0; i < coords.length / 2; i++) { const [x, y] = point(i); ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, Math.PI * 2); }
  ctx.fill(); lastDraw = performance.now();
}
new ResizeObserver(() => draw()).observe(canvas);
function killPool() {
  for (const worker of pool) { worker.terminate(); if (runRecord) runRecord.workersTerminated++; }
  pool = [];
}
function controls() {
  $('run').disabled = active || !!loading || !coords.length;
  $('stop').disabled = !active;
  ['file', 'count', 'seed', 'generate', 'seconds', 'workers', 'tep', 'reference', 'p-nu', 'p-rnd', 'p-file'].forEach(id => $(id).disabled = active);
  $('download').disabled = !runRecord?.tour;
}
function acceptBest(data, worker) {
  runRecord.history.push({ worker, length: data.length, seconds: data.elapsed, steps: data.steps });
  if (runRecord.reference && data.length <= runRecord.reference && runRecord.firstReach === null) {
    runRecord.firstReach = { worker, solverSeconds: data.elapsed, pageSeconds: (performance.now() - started) / 1000 };
  }
  if (data.length <= best) {
    const improved = data.length < best;
    best = data.length;
    if (data.tour && (improved || data.length === best)) {
      tour = data.tour; runRecord.tour = Array.from(tour, x => x + 1); runRecord.tourLength = data.length;
      if (performance.now() - lastDraw > 150 || data.type === 'done') draw();
    }
    render();
  }
}
function finish(...key) {
  clearInterval(timer); active = false;
  if (runRecord) { runRecord.pageSeconds = (performance.now() - started) / 1000; runRecord.status = english(...key); shownElapsed = runRecord.pageSeconds; }
  killPool(); rejectActive = null; controls(); status(...key); render(); draw();
}
async function load(value, which) {
  if (active) return;
  loading?.terminate(); killPool();
  const token = ++generation;
  loading = { terminate() {} };
  controls();
  try {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    if (token !== generation) return;
    inputHash = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    if (token === generation) { loading = null; controls(); }
    throw error;
  }
  text = value; coords = new Float64Array(); tour = null; best = Infinity; runRecord = null; shownElapsed = 0; preset = which;
  if (which === 'nu3496') { $('reference').value = NU.optimum; $('seconds').value = NU.seconds; }
  else $('reference').value = '';
  if (which === 'random') $('seconds').value = 10;
  render();
  const worker = loading = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  controls(); status('reading');
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.token !== generation) return;
      loading = null; worker.terminate();
      if (data.type === 'error') { status('noSolver', data.message); controls(); reject(Error(data.message)); return; }
      mapName = data.name; coords = data.coordinates;
      $('mapName').textContent = mapName;
      status(coords.length / 2 > 12000 ? 'readyWin' : 'readyPop');
      render(); draw(); controls(); resolve();
    };
    worker.onerror = event => { loading = null; worker.terminate(); status('noSolver', event.message); controls(); reject(Error(event.message)); };
    worker.postMessage({ type: 'load', text, token });
  });
}
async function start(options = {}) {
  if (active || loading || !coords.length) throw new Message('loadFirst');
  const seconds = options.seconds ?? number('seconds', .1, 600);
  const seed = options.seed ?? number('seed', 0, 4294967295);
  if (!Number.isInteger(seed)) throw new Message('seedInt');
  const workers = options.workers ?? Number($('workers').value);
  if (!COUNTS.includes(workers)) throw new Message('workers');
  const execution = options.topology ?? 'auto';
  if (!['auto', 'shared', 'independent'].includes(execution)) throw Error('Unknown execution mode');
  if (execution === 'shared' && workers > 1 && !canShare) throw new Message('needShare');
  const sharedThreads = workers > 1 && execution !== 'independent' && canShare;
  const topology = workers === 1 ? 'single solver' : sharedThreads ? 'shared population/windows' : 'independent seeds (fallback; no shared population)';
  const reference = options.reference ?? (Number($('reference').value) || null);
  const tep = options.tep ?? $('tep').checked;
  active = true; best = Infinity; tour = null; started = performance.now(); shownElapsed = 0;
  runRecord = { schema: '8ztsp-web-run-v1', name: mapName, inputSha256: inputHash, cities: coords.length / 2, seconds, seed,
    workers, topology, requestedTopology: execution, poolWorkersCreated: 0, workersTerminated: 0,
    tep, reference, maxSteps: options.maxSteps || 0, passes: options.passes || 0,
    history: [], results: [], firstReach: null, tour: null, userAgent: navigator.userAgent, page: 'mdlxdcc.org/bd/bd_8ztsp_web' };
  render();
  let shared;
  if (crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined') {
    shared = new SharedArrayBuffer(8);
    Atomics.store(new BigInt64Array(shared), 0, 9223372036854775807n);
  }
  const token = ++generation; controls(); status('searching', workers, sharedThreads);
  timer = setInterval(() => { shownElapsed = (performance.now() - started) / 1000; $('elapsed').textContent = `${dec(shownElapsed, 1)} s`; }, 100);
  return new Promise((resolve, reject) => {
    rejectActive = reject;
    let done = 0;
    const coordinators = sharedThreads ? 1 : workers;
    for (let i = 0; i < coordinators; i++) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); pool.push(worker);
      const children = new Map();
      const fail = message => { finish('stoppedErr', message); reject(Error(message)); };
      worker.onmessage = ({ data }) => {
        if (data.token !== generation || !active) return;
        if (data.type === 'pool-status') { runRecord.poolPhase = data.stage; return; }
        if (data.type === 'pool-spawn') {
          let child;
          try { child = new Worker(new URL('./pool-worker.js', import.meta.url), { type: 'module', name: '8ztsp-compute' }); }
          catch (error) { fail(String(error)); return; }
          children.set(data.id, child); pool.push(child); runRecord.poolWorkersCreated++;
          child.onmessage = event => {
            if (data.token !== generation || !active) return;
            if (event.data?.type === 'pool-error') { fail(event.data.message); return; }
            worker.postMessage({ type: 'pool-event', id: data.id, message: event.data });
          };
          child.onerror = event => { if (data.token !== generation || !active) return; event.preventDefault(); fail(`Pool worker: ${event.message}`); };
          return;
        }
        if (data.type === 'pool-post') {
          try { const child = children.get(data.id); if (!child) throw Error('Unknown pool worker'); child.postMessage(data.message); }
          catch (error) { fail(String(error)); }
          return;
        }
        if (data.type === 'pool-terminate') { children.get(data.id)?.terminate(); return; }
        if (data.type === 'error') { fail(data.message); return; }
        acceptBest(data, i);
        if (data.type === 'done') {
          runRecord.results.push({ worker: i, seed: (seed + i) >>> 0, length: data.length, elapsed: data.elapsed, steps: data.steps, poolStats: data.poolStats, probe: data.probe });
          done++;
          if (done === coordinators) {
            runRecord.length = best;
            finish('complete', runRecord.firstReach ? runRecord.firstReach.solverSeconds : null, isOptimum());
            resolve(structuredClone(runRecord));
          }
        }
      };
      worker.onerror = event => { if (token !== generation || !active) return; finish('workerFail', event.message); reject(Error(event.message)); };
      worker.postMessage({ type: 'run', token, text, seconds, seed: (seed + i) >>> 0, tep, shared, sharedThreads: sharedThreads ? workers : 0,
        probe: !!options.probe, maxSteps: options.maxSteps, passes: options.passes });
    }
  });
}
function generate() {
  const n = number('count', 5, 200000), seed = number('seed', 0, 4294967295);
  if (!Number.isInteger(n) || !Number.isInteger(seed)) throw new Message('integers');
  let state = seed >>> 0 || 0x12345678;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const lines = [`NAME : random-${n}-seed${seed}`, 'TYPE : TSP', `DIMENSION : ${n}`, 'EDGE_WEIGHT_TYPE : EUC_2D', 'NODE_COORD_SECTION'];
  for (let i = 0; i < n; i++) lines.push(`${i + 1} ${Math.floor(random() * 1000000)} ${Math.floor(random() * 1000000)}`);
  lines.push('EOF'); return load(lines.join('\n'), 'random');
}
async function loadNu() {
  status('nuLoading');
  let value;
  try {
    const response = await fetch(NU.url);
    if (!response.ok) throw Error(String(response.status));
    value = await response.text();
  } catch (_) { throw new Message('nuFail'); }
  await load(value, 'nu3496');
}
const safely = fn => async () => {
  try { await fn(); } catch (error) { if (error?.key) status(...error.key); else { statusKey = ['stoppedErr', String(error?.message || error)]; render(); } }
};
function stop() {
  const reject = rejectActive;
  generation++;
  if (runRecord?.tour) { best = runRecord.tourLength; runRecord.length = best; }
  finish('stopped');
  reject?.(new Message('stopped'));
}
function choose(which) {
  tab = which;
  ['panel-rnd', 'panel-file'].forEach(id => { $(id).hidden = id !== `panel-${which}`; });
  [['p-nu', 'nu'], ['p-rnd', 'rnd'], ['p-file', 'file']].forEach(([id, v]) => $(id).setAttribute('aria-pressed', String(v === tab)));
}
$('p-nu').onclick = () => { choose('nu'); safely(loadNu)(); };
$('p-rnd').onclick = () => choose('rnd');
$('p-file').onclick = () => choose('file');
$('generate').onclick = safely(generate);
$('run').onclick = safely(() => start());
$('stop').onclick = stop;
$('file').onchange = safely(async () => {
  const file = $('file').files[0]; if (!file) return;
  if (file.size > 32 * 1024 * 1024) throw new Message('fileLimit');
  await load(await file.text(), 'file');
});
$('reference').oninput = render;
$('workers').onchange = render;
$('download').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(runRecord, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = '8ztsp-run.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('workers').value = String(canShare ? Math.max(1, ...COUNTS.filter(c => c <= Math.min(7, (navigator.hardwareConcurrency || 1) - 1))) : 1);
window.MDLxDCCLocale?.subscribe(() => render());
// The same QA hook as in R1/R2: it drives the same UI and worker path.
window.tsp8zLab = { load, start, stop, loadNu, generate, canShare, get record() { return runRecord; }, get coordinates() { return coords; }, get liveWorkers() { return pool.length; } };
choose('nu');
render();
await safely(loadNu)();
