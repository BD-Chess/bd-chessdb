// 8zTSP in the browser: the page script of mdlxdcc.org/bd/bd_8ztsp_web (BD × AI Lab, 14 Nov 2026).
// Based on app.js of 8zTSP-web R1 (sha256 4e554a6b…; kernel 673813b = main 9f7670a). Changes for the site: English and
// Slovene texts that follow the site's language setting; nu3496 (the site's copy of the Waterloo file) is the default map,
// with 60 s and its known optimum as the reference; the time of the first optimum is shown; no automatic random map.
// worker.js and pkg/ are the R1 files, unchanged.
const $ = id => document.getElementById(id);
const root = document.documentElement;
const canvas = $('map'), ctx = canvas.getContext('2d');
const NU = { url: new URL('../nu3496.tsp', import.meta.url), name: 'nu3496', optimum: 96132, seconds: 60 };
let text = '', coords = new Float64Array(), tour = null, pool = [], loading = null;
let generation = 0, best = Infinity, started = 0, timer, active = false, runRecord = null, shownElapsed = 0;
let mapName = '', inputHash = '', lastDraw = 0, preset = '', tab = 'nu', statusKey = ['wasm'];
const lang = () => root.dataset.lang === 'sl' ? 'sl' : 'en';
const group = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang() === 'sl' ? '.' : ',');
const dec = (x, d) => { const s = x.toFixed(d); return lang() === 'sl' ? s.replace('.', ',') : s; };
const pct = x => `${dec(x, 3)}${lang() === 'sl' ? ' %' : '%'}`;
const slPlural = (n, one, two, few, many) => { const m = n % 100; return m === 1 ? one : m === 2 ? two : m === 3 || m === 4 ? few : many; };
const T = {
  en: {
    wasm: 'Loading WebAssembly…', nuLoading: 'Loading nu3496…', reading: 'Reading the map…',
    readyWin: 'Ready · window search with 3-opt (maps over 12,000 cities).',
    readyPop: 'Ready · population search with diversity selection.',
    searching: n => `Searching with ${n} worker${n === 1 ? '' : 's'}…`,
    complete: (s, opt) => 'Complete · tour checked in Rust.' + (s === null ? '' :
      ` ${opt ? 'Optimum' : 'Reference'} first reached after ${dec(s, 1)} s of solver time.`),
    stopped: 'Stopped · the last tour shown is kept.',
    stoppedErr: m => `Search stopped: ${m}`, workerFail: m => `Worker failed: ${m}`,
    noSolver: m => `Unable to load the solver: ${m}`,
    nuFail: 'nu3496 could not be loaded; try random points or your own file.',
    cities: n => `${group(n)} ${n === 1 ? 'city' : 'cities'}`,
    range: (label, lo, hi) => `${label}: enter a number from ${group(lo)} to ${group(hi)}`,
    integers: 'Cities and seed must be whole numbers', seedInt: 'The seed must be a whole number',
    workers: 'Choose 1, 2, 4 or 7 workers', loadFirst: 'Load a map before running', fileLimit: 'File limit: 32 MB',
    gapOpt: 'ABOVE THE OPTIMUM', gapRef: 'ABOVE THE REFERENCE', reachOpt: 'OPTIMUM FIRST REACHED', reachRef: 'REFERENCE FIRST REACHED',
    count: 'Random cities', seed: 'Seed', seconds: 'Seconds', reference: 'Reference length',
    placeholder: 'for the gap and the first-reach time', canvas: 'Points and the best tour',
  },
  sl: {
    wasm: 'Nalagam WebAssembly…', nuLoading: 'Nalagam nu3496…', reading: 'Berem zemljevid…',
    readyWin: 'Pripravljeno · iskanje z okni in 3-opt (zemljevidi z več kot 12.000 mesti).',
    readyPop: 'Pripravljeno · populacijsko iskanje z izbiro z raznolikostjo.',
    searching: n => `Iskanje teče · ${n} ${slPlural(n, 'delavec', 'delavca', 'delavci', 'delavcev')}…`,
    complete: (s, opt) => 'Končano · pot preverjena v Rustu.' + (s === null ? '' :
      ` ${opt ? 'Optimum' : 'Referenca'} prvič dosežen${opt ? '' : 'a'} po ${dec(s, 1)} s časa reševalnika.`),
    stopped: 'Ustavljeno · zadnja prikazana pot ostane.',
    stoppedErr: m => `Iskanje se je ustavilo: ${m}`, workerFail: m => `Delavec je odpovedal: ${m}`,
    noSolver: m => `Reševalnika ni bilo mogoče naložiti: ${m}`,
    nuFail: 'nu3496 se ni naložil; poskusite z naključnimi točkami ali s svojo datoteko.',
    cities: n => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}`,
    range: (label, lo, hi) => `${label}: vnesite število od ${group(lo)} do ${group(hi)}`,
    integers: 'Število mest in seme morata biti celi števili', seedInt: 'Seme mora biti celo število',
    workers: 'Izberite 1, 2, 4 ali 7 delavcev', loadFirst: 'Pred zagonom naložite zemljevid', fileLimit: 'Omejitev datoteke: 32 MB',
    gapOpt: 'NAD OPTIMUMOM', gapRef: 'NAD REFERENCO', reachOpt: 'OPTIMUM PRVIČ DOSEŽEN', reachRef: 'REFERENCA PRVIČ DOSEŽENA',
    count: 'Naključna mesta', seed: 'Seme', seconds: 'Sekunde', reference: 'Referenčna dolžina',
    placeholder: 'za odmik in čas prvega dosega', canvas: 'Točke in najboljša pot',
  },
};
const t = (key, ...args) => { const v = T[lang()][key]; return typeof v === 'function' ? v(...args) : v; };
class Message extends Error { constructor(key, ...args) { super(T.en[key] instanceof Function ? T.en[key](...args) : T.en[key]); this.key = [key, ...args]; } }
const status = (...key) => { statusKey = key; $('status').textContent = t(...key); };
const isOptimum = () => preset === 'nu3496' && Number($('reference').value) === NU.optimum;
function number(id, low, high) {
  const value = Number($(id).value);
  if (!Number.isFinite(value) || value < low || value > high) throw new Message('range', T[lang()][id], low, high);
  return value;
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
function killPool() { pool.forEach(w => w.terminate()); pool = []; }
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
  if (runRecord) { runRecord.pageSeconds = (performance.now() - started) / 1000; runRecord.status = T.en[key[0]] instanceof Function ? T.en[key[0]](...key.slice(1)) : T.en[key[0]]; shownElapsed = runRecord.pageSeconds; }
  killPool(); controls(); status(...key); render(); draw();
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
  if (![1, 2, 4, 7].includes(workers)) throw new Message('workers');
  const reference = options.reference ?? (Number($('reference').value) || null);
  const tep = options.tep ?? $('tep').checked;
  active = true; best = Infinity; tour = null; started = performance.now(); shownElapsed = 0;
  runRecord = { schema: '8ztsp-web-run-v1', name: mapName, inputSha256: inputHash, cities: coords.length / 2, seconds, seed,
    workers, topology: workers === 1 ? 'single solver' : 'independent seeded solvers (no shared population)',
    tep, reference, maxSteps: options.maxSteps || 0, passes: options.passes || 0,
    history: [], results: [], firstReach: null, tour: null, userAgent: navigator.userAgent, page: 'mdlxdcc.org/bd/bd_8ztsp_web' };
  render();
  let shared;
  if (crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined') {
    shared = new SharedArrayBuffer(8);
    Atomics.store(new BigInt64Array(shared), 0, 9223372036854775807n);
  }
  const token = ++generation; controls(); status('searching', workers);
  timer = setInterval(() => { shownElapsed = (performance.now() - started) / 1000; $('elapsed').textContent = `${dec(shownElapsed, 1)} s`; }, 100);
  return new Promise((resolve, reject) => {
    let done = 0;
    for (let i = 0; i < workers; i++) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); pool.push(worker);
      worker.onmessage = ({ data }) => {
        if (data.token !== generation || !active) return;
        if (data.type === 'error') { finish('stoppedErr', data.message); reject(Error(data.message)); return; }
        acceptBest(data, i);
        if (data.type === 'done') {
          runRecord.results.push({ worker: i, seed: (seed + i) >>> 0, length: data.length, elapsed: data.elapsed, steps: data.steps });
          worker.terminate(); done++;
          if (done === workers) {
            runRecord.length = best;
            finish('complete', runRecord.firstReach ? runRecord.firstReach.solverSeconds : null, isOptimum());
            resolve(structuredClone(runRecord));
          }
        }
      };
      worker.onerror = event => { finish('workerFail', event.message); reject(Error(event.message)); };
      worker.postMessage({ type: 'run', token, text, seconds, seed: (seed + i) >>> 0, tep, shared, maxSteps: options.maxSteps, passes: options.passes });
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
$('stop').onclick = () => {
  generation++;
  if (runRecord?.tour) { best = runRecord.tourLength; runRecord.length = best; }
  finish('stopped');
};
$('file').onchange = safely(async () => {
  const file = $('file').files[0]; if (!file) return;
  if (file.size > 32 * 1024 * 1024) throw new Message('fileLimit');
  await load(await file.text(), 'file');
});
$('reference').oninput = render;
$('download').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(runRecord, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = '8ztsp-run.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.MDLxDCCLocale?.subscribe(() => render());
// The same QA hook as in R1: it drives the same UI and worker path.
window.tsp8zLab = { load, start, loadNu, generate, get record() { return runRecord; }, get coordinates() { return coords; } };
choose('nu');
await safely(loadNu)();
