import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/Trip/new/app.js', import.meta.url), 'utf8');
const sample = 'Nova Gorica START\nLjubljana\nMaribor\nNovo Mesto\nKoper\nPtuj';

function harness(geocode) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      style: {}, classList: { add() {}, remove() {} }, checked: false,
      value: '', innerHTML: '', textContent: '', appendChild() {}
    });
    return elements.get(id);
  };
  const jobs = [];
  const timerJobs = new Map();
  let nextTimer = 0;
  const google = { maps: { Geocoder: class { geocode(req, cb) { return geocode(req, cb); } } } };
  const context = vm.createContext({
    console, google, window: { google }, Map, Set,
    document: { getElementById: element, querySelector: () => element('panel'), addEventListener() {} },
    localStorage: { setItem() {} },
    Worker: class { postMessage(msg) { jobs.push(msg); } },
    setTimeout(fn, ms) { if (ms === 250) { queueMicrotask(fn); return 0; } const id = ++nextTimer; timerJobs.set(id, fn); return id; },
    clearTimeout(id) { timerJobs.delete(id); }
  });
  // Test-only access to the real closure: no production debug API or duplicate parser.
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, [
    'window.test = { parseStops, normalizeTripEditorText, geocodeMissingPoints, run, setStatus, updateMapVisualization, routeErrorInfo,',
    'setMap(value) { map = value; }, setMode(value) { currentTravelMode = value; } };',
    '})();'
  ].join('\n')), context);
  return { api: context.window.test, elements, element, jobs, google, timerJobs };
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
  const h = mapHarness(async () => { calls++; throw Object.assign(new Error('not activated'), { code: 'REQUEST_DENIED' }); });
  const pts = Object.entries(known).map(([name, [lat, lon]]) => ({ name, lat, lon }));
  await h.api.updateMapVisualization(pts);
  assert.match(h.element('status').textContent, /Routes API activation/);
  assert.match(h.element('status').textContent, /NOT roads/);
  assert.equal(h.lines[0].options.strokeOpacity, 0);
  assert.equal(h.lines[0].options.icons[0].repeat, '16px');
  h.element('chkDirect').checked = h.element('chkRoundTrip').checked = true;
  await h.api.updateMapVisualization(pts);
  assert.equal(calls, 1);
  assert.equal(h.lines[1].options.path.length, 7);
});

test('SDK programming errors are not reported as missing API permissions; diagnostic keys are redacted', () => {
  const h = harness(success);
  const sdk = h.api.routeErrorInfo(new TypeError('Route.computeRoutes is not a function'));
  assert.match(sdk.message, /code repair/);
  assert.doesNotMatch(sdk.message, /enable|activation/);
  const redacted = h.api.routeErrorInfo(new Error('bad https://maps.example/test?key=AIzaPRIVATE_TOKEN key AIzaPRIVATE_TOKEN'));
  assert.doesNotMatch(redacted.detail, /AIza|https:/);
});

test('the original Directions service draws roads without requiring Routes access', async () => {
  const h = mapHarness(() => { throw new Error('Routes must not be called'); });
  let request;
  h.google.maps.importLibrary = async () => ({
    DirectionsService: class { route(req, callback) {
      request = req;
      callback({ routes: [{ overview_path: [req.origin, { lat: 46, lng: 15 }, req.destination] }] }, 'OK');
    } }
  });
  h.element('chkRoundTrip').checked = true;
  await h.api.updateMapVisualization(Object.entries(known).map(([name, [lat, lon]]) => ({ name, lat, lon })));
  assert.equal(request.optimizeWaypoints, false);
  assert.equal(request.waypoints.length, 5);
  assert.deepEqual(request.origin, request.destination);
  assert.equal(h.lines[0].options.path.length, 3);
  assert.match(h.element('status').textContent, /Road route displayed/);
  assert.equal(h.timerJobs.size, 1); // only the status auto-hide timer remains
});

test('legacy rejection falls back to Routes and handles the SDK rejected promise', async () => {
  const h = mapHarness(() => {});
  let modernCalls = 0;
  h.google.maps.importLibrary = async () => ({
    DirectionsService: class { route(req, callback) {
      callback(null, 'REQUEST_DENIED');
      return Promise.reject(new Error('legacy denied'));
    } },
    Route: { computeRoutes: async req => {
      modernCalls++;
      return { routes: [{ path: [req.origin, req.destination] }] };
    } }
  });
  await h.api.updateMapVisualization(Object.entries(known).map(([name, [lat, lon]]) => ({ name, lat, lon })));
  assert.equal(modernCalls, 1);
  assert.match(h.element('status').textContent, /Road route displayed/);
});
