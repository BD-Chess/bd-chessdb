import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const matrixSource=readFileSync(new URL('../public/Trip/road-matrix.js',import.meta.url),'utf8');

const source = readFileSync(new URL('../public/Trip/app.js', import.meta.url), 'utf8');
const sample = 'Nova Gorica START\nLjubljana\nMaribor\nNovo Mesto\nKoper\nPtuj';

function harness(geocode, fetcher) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      setAttribute() {}, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, checked: false,
      value: '', innerHTML: '', textContent: '', appendChild() {}, replaceChildren() {}
    });
    return elements.get(id);
  };
  const jobs = [];
  const workers = [];
  const timerJobs = new Map();
  let nextTimer = 0, clock = 0;
  const google = { maps: { Geocoder: class { geocode(req, cb) { return geocode(req, cb); } } } };
  const context = vm.createContext({
    console, crypto:webcrypto, TextDecoder, google, window: { google }, fetch:fetcher, Map, Set, performance: {now: () => clock},
    document: { body:{classList:{remove(){},toggle(){}}}, createElement: () => ({style:{}, dataset:{}, appendChild() {}, querySelector:()=>({dataset:{},textContent:''})}), getElementById: element, querySelector: () => element('panel'), querySelectorAll: () => [], addEventListener() {} },
    localStorage: { setItem() {} },
    Worker: class { constructor() {workers.push(this);} postMessage(msg) {jobs.push(msg);} terminate() {this.terminated=true;} },
    setTimeout(fn, ms) { if (ms === 250) { queueMicrotask(fn); return 0; } const id = ++nextTimer; timerJobs.set(id, fn); return id; },
    clearTimeout(id) { timerJobs.delete(id); }
  });
  vm.runInContext(readFileSync(new URL('../public/Trip/ui-text.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../public/Trip/tsp-metric.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../public/Trip/tsp-catalog.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../public/Trip/tsp-library.js', import.meta.url), 'utf8'), context);
  vm.runInContext(matrixSource, context);
  vm.runInContext(readFileSync(new URL('../public/Trip/brute-force.js', import.meta.url), 'utf8'), context);
  element('chkDirect').checked = true;
  // Test-only access to the real closure: no production debug API or duplicate parser.
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, [
    'window.test = { buildMapsLegLinks, ensureAirComparison, showSolvedRoute, showSavings, resumeAvailable, refreshBruteMap, refreshBruteInfo, requestCancel, handleWorkerMessage, clearComparison, cancelWork, parseStops, normalizeTripEditorText, geocodeMissingPoints, run, setStatus, updateMapVisualization, routeErrorInfo,',
    'setMap(value) { map = value; }, setMode(value) { currentTravelMode = value; }, setDirect(km) { lastDirectKm = km; }, setMiles(value) { useMiles = value; } };',
    '})();'
  ].join('\n')), context);
  return { window:context.window, api: context.window.test, elements, element, jobs, google, timerJobs, workers, doc:context.document, tick(ms){clock += ms;} };
}

const known = {
  'Nova Gorica': [45.956, 13.648], Ljubljana: [46.057, 14.506], Maribor: [46.555, 15.646],
  'Novo Mesto': [45.804, 15.169], Koper: [45.548, 13.73], Ptuj: [46.42, 15.87]
};
function success({ address }, cb) {
  const coords = known[address];
  cb(coords ? [{ geometry: { location: { lat: () => coords[0], lng: () => coords[1] } } }] : [], coords ? 'OK' : 'ZERO_RESULTS');
}

test('the exact six-city input reaches the solver with all cities and Nova Gorica START', async () => {
  const h = harness(success);
  h.element('input').value = sample;
  h.element('chkRoundTrip').checked = true;
  await h.api.run('standard');
  assert.equal(h.jobs.length, 1);
  assert.deepEqual(Array.from(h.jobs[0].points, p => p.name), Object.keys(known));
  assert.equal(h.jobs[0].startIdx, 0);
  assert.equal(h.jobs[0].roundTrip, true);
  assert.equal(h.element('input').value, sample);
});

test('a Google denial stops immediately with an actionable error and no partial route', async () => {
  let count = 0;
  const h = harness((req, cb) => { count++; cb([], 'REQUEST_DENIED'); });
  h.element('input').value = sample;
  await h.api.run('standard');
  assert.equal(count, 1);
  assert.equal(h.jobs.length, 0);
  assert.match(h.element('status').textContent, /Nova Gorica.*enable Geocoding API/);
  assert.equal(h.element('input').value, sample);
  assert.doesNotMatch(h.element('status').textContent, /Need 2/);
});

test('an unresolved earlier stop never drops out or shifts START onto another city', async () => {
  const h = harness(success);
  const input = 'Ljubljana\nUnknown place\nPtuj START\nKoper';
  h.element('input').value = input;
  await h.api.run('standard');
  assert.equal(h.jobs.length, 0);
  assert.match(h.element('status').textContent, /Unknown place.*Place not found/);
  assert.equal(h.element('input').value, input);
});

test('coordinate input works without geocoding and keeps a nonfirst START', async () => {
  const h = harness(() => { throw new Error('Unexpected geocoding'); });
  h.element('input').value = '# Test\nLjubljana | 46.057,14.506\nPtuj | 46.42,15.87 START';
  await h.api.run('standard');
  assert.equal(h.jobs.length, 1);
  assert.equal(h.jobs[0].startIdx, 1);
  h.api.cancelWork();
  h.element('input').value = 'Invalid | 91,14\nPtuj | 46,15 START';
  await h.api.run('standard');
  assert.equal(h.jobs.length, 1);
  assert.match(h.element('status').textContent, /Invalid coordinates/);
});

test('old success timers cannot hide a later lookup error', () => {
  const h = harness(success);
  h.api.setStatus('Ready', 'ok');
  assert.equal(h.timerJobs.size, 1);
  h.api.setStatus('Lookup denied', 'bad');
  assert.equal(h.timerJobs.size, 0);
  assert.equal(h.element('status').style.display, 'block');
});

function mapHarness(computeRoutes) {
  const h = harness(success);
  h.api.setMap({ fitBounds() {} });
  h.element('chkDirect').checked=false;
  const lines = [];
  Object.assign(h.google.maps, {
    Marker: class { addListener() {} setMap() {} },
    Polyline: class {
      constructor(options) { this.options = options; lines.push(this); }
      setMap(map) { this.map = map; }
    },
    LatLngBounds: class { extend() {} },
    event: { trigger() {} },
    importLibrary: async name => { assert.equal(name, 'routes'); return { Route: { computeRoutes } }; }
  });
  return { ...h, lines };
}

test('modern Routes draws ordered waypoints and closes a round trip without reoptimizing', async () => {
  const requests = [];
  const h = mapHarness(async req => { requests.push(req); return { routes: [{ path: [req.origin, req.destination] }] }; });
  h.element('chkRoundTrip').checked = true;
  const pts = Object.entries(known).map(([name, [lat, lon]]) => ({ name, lat, lon }));
  await h.api.updateMapVisualization(pts);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].intermediates.length, 5);
  assert.deepEqual(requests[0].origin, requests[0].destination);
  assert.equal(requests[0].optimizeWaypointOrder, false);
  assert.equal(h.lines.filter(l => l.map).length, 1);
  assert.match(h.element('status').textContent, /Road route displayed/);
});

test('Routes denial stays visible; Direct Line draws the full closed route without an API call', async () => {
  let calls = 0;
  const h = mapHarness(async () => { calls++; throw new Error('Denied with private details'); });
  const pts = Object.entries(known).map(([name, [lat, lon]]) => ({ name, lat, lon }));
  await h.api.updateMapVisualization(pts);
  assert.match(h.element('status').textContent, /Road route could not be drawn/);
  assert.doesNotMatch(h.element('status').textContent, /private details/);
  h.element('chkDirect').checked = h.element('chkRoundTrip').checked = true;
  await h.api.updateMapVisualization(pts);
  assert.equal(calls, 1);
  assert.equal(h.lines.at(-1).options.path.length, 7);
});

