import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source = readFileSync(new URL('../public/Trip/new/app.js', import.meta.url), 'utf8');
const matrixSource = readFileSync(new URL('../public/Trip/new/road-matrix.js', import.meta.url), 'utf8');
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
  vm.runInContext(readFileSync(new URL('../public/Trip/new/ui-text.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../public/Trip/new/tsp-metric.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../public/Trip/new/tsp-catalog.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../public/Trip/new/tsp-library.js', import.meta.url), 'utf8'), context);
  vm.runInContext(matrixSource, context);
  vm.runInContext(readFileSync(new URL('../public/Trip/new/brute-force.js', import.meta.url), 'utf8'), context);
  element('chkDirect').checked = true;
  // Test-only access to the real closure: no production debug API or duplicate parser.
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, [
    'window.test = { buildMapsLegLinks, ensureAirComparison, showSolvedRoute, showSavings, continueDeep, refreshDeepContinue, resumeAvailable, refreshBruteMap, refreshBruteInfo, requestCancel, handleWorkerMessage, clearComparison, cancelWork, parseStops, normalizeTripEditorText, geocodeMissingPoints, run, setStatus, updateMapVisualization, routeErrorInfo,',
    'setMap(value) { map = value; }, setMode(value) { currentTravelMode = value; }, setDirect(km) { lastDirectKm = km; }, setMiles(value) { useMiles = value; } };',
    '})();'
  ].join('\n')), context);
  return { window:context.window, api: context.window.test, elements, element, jobs, google, timerJobs, workers, doc:context.document, tick(ms){clock += ms;} };
}

const known = {
  'Nova Gorica': [45.956, 13.648], Ljubljana: [46.057, 14.506], Maribor: [46.555, 15.646],
  'Novo Mesto': [45.804, 15.169], Koper: [45.548, 13.73], Ptuj: [46.42, 15.87]
};

test('Deep budget button continues the same worker with a new ID and no new lookups',async()=>{
  const h=harness(success);h.element('input').value=sample;await h.api.run('deep');const first=h.jobs.at(-1);
  const result={type:'result',algorithm:'deep',jobId:first.jobId,reason:'budget',canContinue:true,exact:false,elapsedMs:60000,budgetMs:60000,additionalBudgetMs:60000,candidates:39,completed:38,totalKm:100,baseKm:150,directKm:100,metric:'direct',pointsSorted:first.points};
  h.api.handleWorkerMessage({data:result});
  assert.equal(h.element('continueDeep').hidden,false);assert.equal(h.element('continueDeepLabel').textContent,'Continue calculating:');
  h.window.MDLxDCCLocale={current:()=> 'sl'};h.api.refreshDeepContinue();assert.equal(h.element('continueDeepLabel').textContent,'Nadaljuj računanje:');
  h.tick(3600000);h.api.continueDeep(60000);const next=h.jobs.at(-1);
  assert.equal(next.type,'continue-deep');assert.equal(next.previousJobId,first.jobId);assert.notEqual(next.jobId,first.jobId);
  assert.equal(h.jobs.filter(m=>m.type==='solve'&&m.profile==='deep').length,1);assert.equal(h.workers[0].terminated,undefined);
  assert.equal(h.element('continueDeep').hidden,true);assert.equal(h.element('btnDeep').disabled,true);
  assert.match(h.element('searchProgressText').textContent,/Računanje/);
  assert.equal(h.element('searchBudget').textContent,'2,0 min');assert.equal(h.element('searchElapsed').textContent,'1,0 min');
  h.api.continueDeep(60000);assert.equal(h.jobs.at(-1),next,'double click cannot add twice');
  h.api.handleWorkerMessage({data:{...result,jobId:first.jobId}});assert.equal(h.element('continueDeep').hidden,true,'old final response ignored');
  h.api.requestCancel();assert.equal(h.jobs.at(-1).jobId,next.jobId);
  h.api.handleWorkerMessage({data:{...result,jobId:next.jobId,reason:'cancelled',cancelled:true,elapsedMs:62000,budgetMs:120000}});
  assert.equal(h.element('continueDeep').hidden,false);h.api.continueDeep(60000);assert.equal(h.jobs.at(-1).previousJobId,next.jobId);
  h.api.cancelWork();
});

test('Deep continuation is absent after optimum/error; edits and fresh calculations invalidate it',async()=>{
  for(const change of ['optimum','error','stops','mode','direct','round','planar','fresh','clear']){
    const h=harness(success);h.element('input').value=sample;await h.api.run('deep');const first=h.jobs.at(-1);
    h.api.handleWorkerMessage({data:{type:'result',algorithm:'deep',jobId:first.jobId,reason:change==='optimum'?'optimum':'budget',exact:change==='optimum',error:change==='error'?'failure':null,canContinue:true,elapsedMs:10000,budgetMs:10000,additionalBudgetMs:10000,totalKm:100,baseKm:150,directKm:100,metric:'direct',pointsSorted:first.points}});
    if(change==='stops')h.element('input').value+='\nMadrid';
    if(change==='mode')h.api.setMode('WALKING');
    if(change==='direct')h.element('chkDirect').checked=false;
    if(change==='round')h.element('chkRoundTrip').checked=true;
    if(change==='planar')h.element('chkPlanar').checked=true;
    if(change==='fresh')await h.api.run('standard');
    if(change==='clear')h.api.clearComparison();
    h.api.refreshDeepContinue();assert.equal(h.element('continueDeep').hidden,true,change);
    h.api.continueDeep(60000);assert.equal(h.jobs.some(j=>j.type==='continue-deep'),false,change);
    h.api.cancelWork();
  }
});
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
  let cameraChanges=0;
  h.api.setMap({ fitBounds() {cameraChanges++;} });
  h.element('chkDirect').checked = false;
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
  return { ...h, lines, cameraChanges:()=>cameraChanges };
}

test('modern Routes draws ordered waypoints and closes a round trip without reoptimizing', async () => {
  const requests = [];
  const h = mapHarness(async req => { requests.push(req); return { routes: [{ path: [req.origin, req.destination], distanceMeters: 125600 }] }; });
  h.element('chkRoundTrip').checked = true;
  const pts = Object.entries(known).map(([name, [lat, lon]]) => ({ name, lat, lon }));
  await h.api.updateMapVisualization(pts);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].intermediates.length, 5);
  assert.deepEqual(requests[0].origin, requests[0].destination);
  assert.equal(requests[0].optimizeWaypointOrder, false);
  assert.deepEqual(Array.from(requests[0].fields), ["path", "distanceMeters"]);
  assert.equal(h.element("distKm").textContent, "125.60 km");
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
      callback({ routes: [{ overview_path: [req.origin, { lat: 46, lng: 15 }, req.destination], legs: Array.from({length: req.waypoints.length + 1}, () => ({distance: {value: 20000, text: "12.4 mi"}})) }] }, 'OK');
    } }
  });
  h.element('chkRoundTrip').checked = true;
  await h.api.updateMapVisualization(Object.entries(known).map(([name, [lat, lon]]) => ({ name, lat, lon })));
  assert.equal(request.optimizeWaypoints, false);
  assert.equal(request.waypoints.length, 5);
  assert.equal(h.element("distKm").textContent, "120.00 km");
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
      return { routes: [{ path: [req.origin, req.destination], distanceMeters: 125600 }] };
    } }
  });
  await h.api.updateMapVisualization(Object.entries(known).map(([name, [lat, lon]]) => ({ name, lat, lon })));
  assert.equal(modernCalls, 1);
  assert.match(h.element('status').textContent, /Road route displayed/);
});

const twoStops = [{ name: 'Ljubljana', lat: 46.057, lon: 14.506 }, { name: 'Nova Gorica', lat: 45.955, lon: 13.649 }];

test('Prepare distances fetches the road matrix; Optimize sends those local values to the worker', async () => {
  const h = harness(success);
  h.element('chkDirect').checked = false;
  h.element('input').value = sample;
  let calls = 0;
  h.google.maps.importLibrary = async () => ({RouteMatrix:{computeRouteMatrix:async req=>{
    calls++;
    return {matrix:{rows:req.origins.map((_,i)=>({items:req.destinations.map((_,j)=>({condition:'ROUTE_EXISTS',distanceMeters:i===j?0:10000+i*100+j}))}))}};
  }}});
  await h.api.run('prepare');
  assert.equal(calls,1);assert.equal(h.jobs.length,0);
  await h.api.run('standard');
  assert.equal(calls,1);assert.equal(h.jobs.length,1);
  assert.equal(h.jobs[0].distanceMatrix.length,6);
  assert.notEqual(h.jobs[0].distanceMatrix[0][1],h.jobs[0].distanceMatrix[1][0]);
  assert.match(h.element('matrixStatus').textContent,/Reusing 30/);
});

test('a denied matrix request never launches the aerial solver in road mode', async () => {
  const h=harness(success);
  h.element('chkDirect').checked=false;h.element('input').value=sample;
  h.google.maps.importLibrary=async()=>({RouteMatrix:{computeRouteMatrix:async()=>{throw Object.assign(new Error('blocked'),{code:'PERMISSION_DENIED'});}}});
  await h.api.run('standard');
  assert.equal(h.jobs.length,0);assert.match(h.element('status').textContent,/Road optimization has not run/);
});

test('road distance replaces the direct estimate; Direct Line restores it without another request', async () => {
  let calls = 0;
  const h = mapHarness(async req => {
    calls++;
    return { routes: [{ path: [req.origin, req.destination], distanceMeters: 109876 }] };
  });
  h.api.setDirect(67.11);
  await h.api.updateMapVisualization(twoStops);
  assert.equal(h.element('distKm').textContent, '109.88 km');
  assert.equal(h.element('distanceLabel').textContent, 'Road distance (map):');
  h.element('chkDirect').checked = true;
  await h.api.updateMapVisualization(twoStops);
  assert.equal(h.element('distKm').textContent, '67.11 km');
  assert.equal(h.element('distanceLabel').textContent, 'Air distance (great circle):');
  assert.equal(calls, 1);
});

test('multi-request round trips sum each road chunk once and convert the total to miles', async () => {
  const requests = [];
  const h = mapHarness(async req => {
    requests.push(req);
    return { routes: [{ path: [req.origin, req.destination], distanceMeters: requests.length === 1 ? 100000 : 25000 }] };
  });
  h.api.setMiles(true);
  h.api.setMode('WALKING');
  h.element('chkRoundTrip').checked = true;
  const pts = Array.from({ length: 26 }, (_, i) => ({ name: 'Stop ' + i, lat: 46, lon: 14 + i / 100 }));
  await h.api.updateMapVisualization(pts);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].destination, requests[1].origin);
  assert.deepEqual(requests[1].destination, requests[0].origin);
  assert.equal(requests[1].travelMode, 'WALKING');
  assert.equal(h.element('distKm').textContent, '77.67 mi');
  assert.equal(h.element('distanceLabel').textContent, 'Walking distance (map):');
});

test('late road results cannot overwrite a newer Direct Line selection', async () => {
  let resolve;
  let started;
  const requestStarted = new Promise(r => { started = r; });
  const h = mapHarness(() => new Promise(r => { resolve = r; started(); }));
  h.api.setDirect(67.11);
  const pending = h.api.updateMapVisualization(twoStops);
  await requestStarted;
  assert.equal(h.element('distKm').textContent, 'Loading…');
  h.element('chkDirect').checked = true;
  await h.api.updateMapVisualization(twoStops);
  resolve({ routes: [{ path: [{ lat: 46, lng: 14 }], distanceMeters: 109876 }] });
  await pending;
  assert.equal(h.element('distKm').textContent, '67.11 km');
  assert.equal(h.element('distanceLabel').textContent, 'Air distance (great circle):');
  assert.equal(h.lines.filter(l => l.map).length, 1);
});

test('missing or failed road measurements never show a stale road total or an air estimate', async () => {
  let n = 0;
  const h = mapHarness(async req => {
    if (++n === 3) throw new Error('NO_ROUTE');
    return { routes: [{ path: [req.origin, req.destination], distanceMeters: n === 1 ? 109876 : undefined }] };
  });
  h.api.setDirect(67.11);
  await h.api.updateMapVisualization(twoStops);
  assert.equal(h.element('distKm').textContent, '109.88 km');
  await h.api.updateMapVisualization(twoStops);
  assert.equal(h.element('distKm').textContent, '—');
  assert.match(h.element('status').textContent, /did not return a complete distance/);
  await h.api.updateMapVisualization(twoStops);
  assert.equal(h.element('distKm').textContent, '—');
  assert.equal(h.element('distanceLabel').textContent, 'Road distance (map):');
});

test('manual Brute Force is available through 20; 21 disables it without starting another algorithm', async()=>{
  const h=harness(()=>{throw new Error('No geocoding expected');});
  const input=n=>Array.from({length:n},(_,i)=>`Place ${i} | ${46+i/100}, ${14+i/100}${i===2?' START':''}`).join('\n');
  h.element('input').value=input(20);
  h.api.refreshBruteInfo();
  assert.equal(h.element('chkBrute').disabled,false);assert.equal(h.element('chkBrute').checked,false);
  assert.match(h.element('bruteInfo').textContent,/121,645,100,408,832,000/);
  h.element('chkBrute').checked=true;
  await h.api.run('standard');assert.equal(h.jobs[0].profile,'brute');assert.equal(h.jobs[0].startIdx,2);
  assert.equal(h.element('btnDeep').hidden,true);
  h.api.cancelWork();assert.equal(h.workers[0].terminated,true);
  h.element('input').value=input(21);h.element('chkBrute').checked=true;
  await h.api.run('standard');
  assert.equal(h.jobs.length,1);assert.equal(h.element('chkBrute').disabled,true);
  assert.equal(h.element('chkBrute').checked,false);assert.equal(h.element('btnDeep').hidden,false);
  h.element('input').value=input(30);h.api.refreshBruteInfo();
  assert.match(h.element('bruteInfo').textContent,/8,841,761,993,739,701,954,543,616,000,000/);
  assert.match(h.element('bruteInfo').textContent,/2.80 × 10\^17 years/);
});

test('Brute Force cancellation preserves road data for the next Optimize and stale replies are ignored',async()=>{
  const h=harness(success); h.element('input').value=sample;h.element('chkDirect').checked=false;
  let calls=0;
  h.google.maps.importLibrary=async()=>({RouteMatrix:{computeRouteMatrix:async req=>{
    calls++;return {matrix:{rows:req.origins.map((_,i)=>({items:req.destinations.map((_,j)=>({condition:'ROUTE_EXISTS',distanceMeters:i===j?0:10000+i*100+j}))}))}};
  }}});
  h.element('chkBrute').checked=true;await h.api.run('standard');
  const first=h.jobs[0];h.api.requestCancel();
  assert.equal(h.jobs[1].type,'cancel');assert.equal(h.jobs[1].jobId,first.jobId);
  assert.equal(h.workers[0].terminated,undefined);
  // Editing/toggling invalidates this job and terminates its worker immediately.
  h.api.cancelWork();h.element('chkBrute').checked=false;
  await h.api.run('standard');assert.equal(calls,1);
  assert.equal(h.jobs.at(-1).profile,'standard');
  assert.deepEqual(h.jobs.at(-1).distanceMatrix,first.distanceMatrix);
  h.api.handleWorkerMessage({data:{type:'brute-progress',jobId:first.jobId}});
  assert.match(h.element('matrixStatus').textContent,/Reusing 30/);
});

test('LAB adds one independent Deep Air row without comparing it to the road optimum',()=>{
  const elements=new Map();
  const el=()=>({children:[],style:{},dataset:{},classList:{remove(){}},appendChild(c){this.children.push(c);},replaceChildren(){this.children=[];}});
  const get=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);};
  const workers=[];
  const c=vm.createContext({console,window:{},document:{getElementById:get,addEventListener(){},createElement:el},Worker:class{constructor(){workers.push(this);}terminate(){this.stopped=true;}postMessage(m){this.message=m;}},setTimeout,clearTimeout});
  vm.runInContext(readFileSync(new URL('../public/Trip/new/ui-text.js',import.meta.url),'utf8'),c);
  vm.runInContext(matrixSource,c);vm.runInContext(readFileSync(new URL('../public/Trip/new/brute-force.js',import.meta.url),'utf8'),c);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/,`window.test={displayComparison,ensureAirComparison,clearComparison, setKey(k){comparisonKey=k;}};})();`),c);
  const api=c.window.test,job={profile:'deep',mode:'DRIVING',direct:false,roundTrip:true,jobId:1};
  api.setKey('roadA');api.displayComparison({algorithm:'brute',exact:true,totalKm:100,elapsedMs:1000},job);
  api.displayComparison({algorithm:'deep',totalKm:100,elapsedMs:2},job);
  api.ensureAirComparison([{lat:0,lon:0},{lat:0,lon:1}],0,job);
  const air=workers.at(-1);assert.equal(air.message.profile,'air-comparison');assert.equal(air.message.distanceMatrix,undefined);
  air.onmessage({data:{type:'result',totalKm:80,elapsedMs:5}});
  let rows=get('comparisonRows').children.map(r=>r.children.map(c=>c.textContent));
  assert.equal(rows.length,3);assert.equal(rows[0][0],'Our Optimize (Deep)');assert.equal(rows[0][3],'Matches exact optimum');assert.match(rows[2][0],/Deep · Air/);assert.match(rows[2][3],/not proven/);assert.doesNotMatch(rows[2][3],/above exact/);
  api.ensureAirComparison([{lat:0,lon:0},{lat:0,lon:1}],0,job);
  assert.equal(workers.length,2); // Main worker + one cached Air worker; no second Air run.
  api.clearComparison();api.setKey('roadB');api.displayComparison({algorithm:'deep',totalKm:300,elapsedMs:2},job);
  air.onmessage({data:{type:'result',totalKm:80,elapsedMs:5}});
  rows=get('comparisonRows').children;assert.equal(rows.length,1); // Stale Air result is ignored.
});

test('Cancel offers Resume and sends the saved search without new address or matrix lookups',async()=>{
  const h=harness(success);h.element('input').value=sample;h.element('chkBrute').checked=true;
  const pending=h.api.run('standard');
  assert.equal(h.element('btnStandard').disabled,true);
  assert.equal(h.element('btnStandard').textContent,'Preparing route…');
  await pending;const first=h.jobs.at(-1);
  assert.equal(h.element('btnStandard').textContent,'Brute Force running…');
  await h.api.run('standard');assert.equal(h.jobs.length,1);
  h.api.requestCancel();
  assert.equal(h.element('btnStandard').textContent,'Stopping Brute Force…'); // A real first cancellation sets the per-job flag.
  const state={engine:{checked:37},elapsedMs:250};
  h.api.handleWorkerMessage({data:{type:'result',algorithm:'brute',jobId:first.jobId,
    checked:37,total:120,cancelled:true,exact:false,resumeState:state,elapsedMs:250,
    totalKm:100,baseKm:150,directKm:100,metric:'direct',pointsSorted:first.points}});
  assert.equal(h.element('btnStandard').textContent,'Resume Brute Force');
  assert.equal(h.element('btnStandard').disabled,false);
  h.tick(3_600_000);await h.api.run('standard');
  const resumed=h.jobs.at(-1);
  assert.equal(resumed.resumeState,state);assert.equal(resumed.points,first.points);
  assert.notEqual(resumed.jobId,first.jobId);assert.equal(resumed.startIdx,first.startIdx);
  h.api.requestCancel();
  assert.equal(h.jobs.at(-1).type,'cancel');assert.equal(h.jobs.at(-1).jobId,resumed.jobId);
  h.api.cancelWork();
});

test('changing the problem clears Resume, while changing only the algorithm preserves it',async()=>{
  for (const change of ['stops','round','direct','mode','algorithm']) {
    const h=harness(success);h.element('input').value=sample;h.element('chkBrute').checked=true;
    await h.api.run('standard');const first=h.jobs.at(-1);
    h.api.handleWorkerMessage({data:{type:'result',algorithm:'brute',jobId:first.jobId,
      checked:37,total:120,cancelled:true,exact:false,resumeState:{engine:{checked:37},elapsedMs:250},
      elapsedMs:250,totalKm:100,baseKm:150,directKm:100,pointsSorted:first.points}});
    if(change==='stops')h.element('input').value+='\nParis';
    if(change==='round')h.element('chkRoundTrip').checked=true;
    if(change==='direct')h.element('chkDirect').checked=false;
    if(change==='mode')h.api.setMode('WALKING');
    if(change==='algorithm'){h.element('chkBrute').checked=false;h.api.refreshBruteInfo();h.element('chkBrute').checked=true;}
    h.api.refreshBruteInfo();
    assert.equal(h.api.resumeAvailable(),change==='algorithm',change);
    assert.equal(h.element('btnStandard').textContent,change==='algorithm'?'Resume Brute Force':'Run Brute Force');
  }
});

test('live map refresh uses the selected interval, improved-only, visible-only, and preserves the camera',async()=>{
  let calls=0;
  const h=mapHarness(async req=>{calls++;return {routes:[{path:[req.origin,req.destination],distanceMeters:100000}]};});
  const job={profile:'brute',mode:'DRIVING',roundTrip:false,direct:false,mapPending:false,mapBestKm:Infinity,lastMapRefresh:0};
  const msg={checked:10,total:100,elapsedMs:1000,totalKm:100,baseKm:200,directKm:80,pointsSorted:twoStops};
  h.tick(4999);h.api.refreshBruteMap(msg,job);assert.equal(calls,0);
  h.tick(1);h.api.refreshBruteMap(msg,job);
  await new Promise(r=>setImmediate(r));
  assert.equal(calls,1);assert.equal(h.cameraChanges(),0);
  h.tick(30000);h.api.refreshBruteMap(msg,job);assert.equal(calls,1); // unchanged best
  h.doc.hidden=true;h.api.refreshBruteMap({...msg,totalKm:99},job);assert.equal(calls,1);
  h.doc.hidden=false;
  h.element('mapRefreshInterval').value='60000';
  const long={...msg,total:100000,totalKm:99};h.api.refreshBruteMap(long,job);assert.equal(calls,1);
  h.tick(30000);h.api.refreshBruteMap(long,job);await new Promise(r=>setImmediate(r));
  assert.equal(calls,2);assert.equal(h.cameraChanges(),0);
  await h.api.updateMapVisualization(twoStops);assert.equal(h.cameraChanges(),1); // explicit/final display still fits
});

test('savings show the input baseline and percent separately from map distance',()=>{
  const h=harness(success);
  h.api.showSavings({baseKm:19938.45,totalKm:9801.35,metric:'road'});
  assert.equal(h.element('savedKm').textContent,'10,137.10 km (50.84%)');
  assert.match(h.element('savingDetails').textContent,/Entered order: 19,938.45 km · Optimized order: 9,801.35 km/);
  assert.equal(h.element('savingLabel').textContent,'Saving vs entered order:');
});

test('the map caption changes only with committed geometry and ignores stale responses',async()=>{
  const resolve=[];
  const h=mapHarness(()=>new Promise(done=>resolve.push(done)));
  const first={method:'Our Optimize (Deep)',state:'Best found · optimum not proven'};
  const brute={method:'Brute Force',state:'Running · best found'};
  const draw=(context)=>h.api.updateMapVisualization(twoStops,{preview:true,routeContext:context});
  const a=draw(first);await new Promise(r=>setImmediate(r));
  resolve[0]({routes:[{path:[],distanceMeters:999}]});await a;
  assert.equal(h.element('mapRouteState').textContent,'Stop order only · road route unavailable');
  assert.equal(h.element('mapRouteDistance').textContent,'');
  const b=draw(first);await new Promise(r=>setImmediate(r));
  resolve[1]({routes:[{path:[{},{}],distanceMeters:134220}]});await b;
  assert.equal(h.element('mapRouteMethod').textContent,'Our Optimize (Deep)');
  assert.equal(h.element('mapRouteDistance').textContent,'134.22 km');
  const c=draw(brute);await new Promise(r=>setImmediate(r));
  assert.equal(h.element('mapRouteMethod').textContent,'Our Optimize (Deep)');
  assert.equal(h.lines.filter(l=>l.map).length,1);
  h.element('chkDirect').checked=true;h.api.setDirect(80);
  await draw(first);
  resolve[2]({routes:[{path:[{},{}],distanceMeters:200000}]});await c;
  assert.equal(h.element('mapRouteMethod').textContent,'Our Optimize (Deep)');
  assert.equal(h.element('mapRouteDistance').textContent,'80.00 km');
  h.element('chkDirect').checked=false;
  const d=draw(brute);await new Promise(r=>setImmediate(r));
  resolve[3]({routes:[{path:[{},{}],distanceMeters:130000}]});await d;
  assert.equal(h.element('mapRouteMethod').textContent,'Brute Force');
  assert.equal(h.element('mapRouteState').textContent,'Running · best found');
  assert.equal(h.element('mapRouteDistance').textContent,'130.00 km');
});

test('loading either demo stops the old job, clears results and sets its route without a calculation',async()=>{
  const h=harness(success);h.element('input').value=sample;h.element('chkBrute').checked=true;
  await h.api.run('standard');const old=h.jobs.at(-1);const count=h.jobs.length;
  h.window.TripDemo.load('eu15');
  const lines=h.element('input').value.split('\n');
  assert.equal(lines.length,15);assert.equal(lines[0],'Ljubljana, Slovenia START');
  assert.equal(lines[14],'Sofia, Bulgaria');
  assert.equal(lines.filter(l=>l.includes('START')).length,1);
  assert.equal(h.element('chkDirect').checked,false);assert.equal(h.element('chkRoundTrip').checked,true);
  assert.equal(h.element('chkBrute').checked,false);assert.equal(h.api.resumeAvailable(),false);
  assert.equal(h.element('comparisonPanel').hidden,true);assert.equal(h.element('mapRouteCaption').hidden,true);
  assert.equal(h.jobs.length,count);assert.equal(h.workers[0].terminated,true);
  h.api.handleWorkerMessage({data:{type:'result',jobId:old.jobId,pointsSorted:old.points}});
  assert.equal(h.element('input').value.split('\n').length,15);
  h.window.TripDemo.load('eu14');
  assert.equal(h.element('input').value,lines.slice(1).map((l,i)=>l+(i?'':' START')).join('\n'));
  assert.equal(h.jobs.length,count);
  const ctx={window:{}};vm.runInNewContext(readFileSync(new URL('../public/Trip/new/trips.js',import.meta.url),'utf8'),ctx);
  const demos=ctx.window.TRIP_LIBRARY[0].categories.find(c=>c.name==='🧪 Optimization demos');
  assert.deepEqual(Array.from(demos.items,i=>i.demoPreset),['capitals14','capitals15','eu15','eu14']);
});

const tspResponse = async url => { const bytes=readFileSync(new URL('../public/Trip/new/'+url.split('?')[0],import.meta.url)); return {ok:true,json:async()=>JSON.parse(bytes.toString()),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}; };
test('all TSP nodes including coincident coordinates survive the real editor and reach the direct solver',async()=>{
  const h=harness(()=>{throw new Error('TSP must not geocode');},tspResponse);
  for(const id of ['lu980','nu3496']) {
    assert.equal(await h.window.TripTsp.load(id),true);
    assert.equal(h.element('chkDirect').checked,true);
    assert.equal(h.element('chkBrute').disabled,true);
    assert.equal(h.element('tspNotice').hidden,false);
    assert.equal(h.element('tspOriginal').download,id+'.tsp');
    const before=h.jobs.length;
    await h.api.run('standard');
    assert.equal(h.jobs.length,before+1,h.element("status").textContent);
    const job=h.jobs.at(-1);
    assert.equal(job.points.length,id==='lu980'?980:3496);
    assert.equal(new Set(Array.from(job.points,p=>p.name)).size,job.points.length);
    assert.equal(job.startIdx,0);assert.equal(job.distanceMatrix,undefined);assert.equal(job.metric,'tsp-euc2d');assert.ok(job.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    if(id==='lu980') assert.deepEqual([job.points[0].lat,job.points[0].lon],[job.points[1].lat,job.points[1].lon]);
    else assert.ok(job.points.every(p=>p.lat>10&&p.lat<16&&p.lon< -83&&p.lon> -88));
    h.api.cancelWork();
    const workers=h.workers.length;
    h.api.ensureAirComparison(job.points,0,{direct:true,roundTrip:true});
    assert.equal(h.workers.length,workers); // no hidden lengthy Deep search after Fast
  }
  h.element('chkDirect').checked=false;
  const jobs=h.jobs.length;await h.api.run('standard');
  assert.equal(h.jobs.length,jobs);
  assert.match(h.element('status').textContent,/2–100 stops/);
});

test('TSP download does not auto-run, and failed or superseded downloads do not overwrite the editor',async()=>{
  let resolve;
  const h=harness(success,()=>new Promise(r=>{resolve=r;}));
  h.element('input').value='Original START\nSecond';
  const pending=h.window.TripTsp.load('dj38');
  assert.equal(h.jobs.length,0);assert.match(h.element('input').value,/Original/);
  h.window.TripDemo.load('eu15');
  resolve(await tspResponse('tsp/dj38.json'));
  assert.equal(await pending,false);assert.match(h.element('input').value,/Ljubljana/);
  const failed=h.window.TripTsp.load('wi29');resolve({ok:false});
  assert.equal(await failed,false);assert.match(h.element('input').value,/Ljubljana/);
  const loaded=h.window.TripTsp.load('dj38');resolve(await tspResponse('tsp/dj38.json'));
  assert.equal(await loaded,true);assert.equal(h.jobs.length,0);
  assert.equal(h.api.parseStops(h.element('input').value).pts.length,38);
});


test('large TSP counts stay compact and fully translated; node IDs are not Maps place queries',async()=>{
  const h=harness(()=>{throw new Error('No geocoding expected');},tspResponse);
  h.window.MDLxDCCLocale={current:()=> 'sl'};
  await h.window.TripTsp.load('lu980');
  const info=h.element('bruteInfo').textContent;
  assert.ok(info.length<500, info.length);
  assert.match(info,/× 10[⁰¹²³⁴⁵⁶⁷⁸⁹]+/);
  assert.match(info,/Brute Force je nad 20 postanki izklopljen/);
  assert.doesNotMatch(info,/unavailable|years|Infinity/);
  assert.equal(h.element('chkBrute').disabled,true);
  const {pts}=h.api.parseStops(h.element('input').value);
  const links=h.api.buildMapsLegLinks(pts.slice(0,3),true,'DRIVING');
  assert.equal(links[0].urlNames,null);
  assert.match(links[0].urlPins,/origin=49/);
  assert.doesNotMatch(links[0].urlPins,/lu980/);
  const normal=h.api.buildMapsLegLinks([{name:'Ljubljana',lat:46,lon:14},{name:'Koper',lat:45,lon:13}],false,'DRIVING');
  assert.match(normal[0].urlNames,/origin=Ljubljana/);
});


test('new capital sets are localized, alphabetic, distinct and preserve START without auto-running',()=>{
  const h=harness(()=>{throw new Error('No automatic lookup');});
  for(const lang of ['en','sl'])for(const n of [14,15]){
    h.window.MDLxDCCLocale={current:()=>lang};
    assert.equal(h.window.TripDemo.load('capitals'+n),true);
    const {pts,startIdx}=h.api.parseStops(h.element('input').value);
    const names=Array.from(pts,p=>p.name);
    assert.equal(names.length,n);assert.equal(new Set(names).size,n);
    assert.deepEqual(names,names.slice().sort((a,b)=>a.localeCompare(b,lang)));
    assert.match(names[startIdx],n===15?/^Ljubljana,/:/^Amsterdam,/);
    assert.doesNotMatch(names.join('\n'),/Barcelona|Hamburg|Munich|Milan/);
    assert.ok(names.includes(lang==='sl'?'Bratislava, Slovaška':'Bratislava, Slovakia'));
    assert.ok(names.includes(lang==='sl'?'Dunaj, Avstrija':'Vienna, Austria'));
    assert.equal(h.element('chkBrute').checked,false);assert.equal(h.element('chkDirect').checked,false);
    assert.equal(h.element('chkRoundTrip').checked,true);assert.equal(h.jobs.length,0);
  }
  h.window.TripDemo.load('eu15');
  assert.match(h.element('input').value,/Hamburg, Germany/); // Historic benchmark set is unchanged.
});

test('Deep shows time budget and cooperatively returns its last improvement on cancel',async()=>{
  const h=harness(success);h.element('input').value=sample;
  await h.api.run('deep');const job=h.jobs.at(-1);
  const progress={type:'progress',jobId:job.jobId,algorithm:'deep',completed:99,candidates:100,budgetMs:10000,
    elapsedMs:5000,totalKm:120,baseKm:200,directKm:120,metric:'direct',pointsSorted:job.points};
  h.api.handleWorkerMessage({data:progress});
  assert.equal(h.element('searchProgress').hidden,false);
  assert.equal(h.element('searchProgressBar').value,.5);
  assert.equal(h.element('searchStarts').textContent,'100 / 99');
  assert.match(h.element('searchProgressText').textContent,/50.00% time budget used/);
  assert.equal(h.elements.has('busyOverlay'),false);
  h.api.requestCancel();
  assert.notEqual(h.workers[0].terminated,true);
  assert.equal(h.jobs.at(-1).type,'cancel');
  h.api.handleWorkerMessage({data:{...progress,type:'result',reason:'cancelled',cancelled:true,totalKm:119}});
  assert.equal(h.element('searchCancel').disabled,true);
  assert.match(h.element('searchProgressText').textContent,/Cancelled/);
  assert.match(h.element('searchBest').textContent,/119/);
  const stopped=h.element('searchProgressText').textContent;
  h.api.handleWorkerMessage({data:{...progress,completed:200}});
  assert.equal(h.element('searchProgressText').textContent,stopped);
});

test('Deep fallback is bounded and a rapid restart ignores the previous job and timer',async()=>{
  const h=harness(success);h.element('input').value=sample;
  await h.api.run('deep');const first=h.jobs.at(-1);
  const p={type:'progress',jobId:first.jobId,algorithm:'deep',budgetMs:10000,elapsedMs:5,totalKm:120,baseKm:200,directKm:120,pointsSorted:first.points};
  h.api.handleWorkerMessage({data:p});h.api.requestCancel();
  const callbacks=[...h.timerJobs.values()];callbacks.at(-1)();
  assert.equal(h.workers[0].terminated,true);assert.match(h.element('searchProgressText').textContent,/last reported route kept/);
  await h.api.run('deep');const second=h.jobs.at(-1);assert.notEqual(second.jobId,first.jobId);
  h.api.handleWorkerMessage({data:{...p,jobId:second.jobId}});const text=h.element('searchProgressText').textContent;
  h.api.handleWorkerMessage({data:{...p,type:'result',reason:'optimum',exact:true}});
  callbacks.at(-1)();assert.equal(h.element('searchProgressText').textContent,text);
  h.api.cancelWork();
});

test('Deep map preview respects 1 second selection; completion bypasses the interval',async()=>{
  let calls=0;
  const h=mapHarness(async req=>{calls++;return {routes:[{path:[req.origin,req.destination],distanceMeters:100000}]};});
  h.element('mapRefreshInterval').value='1000';
  const job={profile:'deep',mode:'DRIVING',roundTrip:false,direct:false,mapPending:false,mapBestKm:Infinity,lastMapRefresh:0};
  const msg={completed:1,starts:128,elapsedMs:1000,totalKm:100,baseKm:200,directKm:80,pointsSorted:twoStops};
  h.tick(999);h.api.refreshBruteMap(msg,job);assert.equal(calls,0);
  h.tick(1);h.api.refreshBruteMap(msg,job);await new Promise(r=>setImmediate(r));
  assert.equal(calls,1);assert.equal(h.cameraChanges(),0);
  await h.api.showSolvedRoute({...msg,totalKm:99},job);assert.equal(calls,2);
});


test('planar TSP rejects changed coordinates, resets to ordinary mode for a demo, and displays EUC_2D without km',async()=>{
  const h=harness(()=>{throw new Error('No geocoding');},tspResponse);
  await h.window.TripTsp.load('wi29');
  assert.equal(h.element('chkPlanar').checked,true);
  await h.api.run('standard');
  const job=h.jobs.at(-1);assert.ok(job,h.element("status").textContent);
  const order=job.points;
  h.api.handleWorkerMessage({data:{type:'result',jobId:job.jobId,algorithm:'standard',metric:'tsp-euc2d',pointsSorted:order,totalCost:60000,baseCost:70000,totalKm:null,directKm:2000,elapsedMs:2}});
  assert.match(h.element('searchBest').textContent,/60,000 EUC_2D/);
  assert.match(h.element('savingDetails').textContent,/70,000 EUC_2D/);
  assert.doesNotMatch(h.element('searchBest').textContent,/km|mi/);
  h.element('input').value=h.element('input').value.replace('20.8333333','20.8334');
  const count=h.jobs.length;await h.api.run('standard');
  assert.equal(h.jobs.length,count);assert.match(h.element('status').textContent,/TSP stops were changed/);
  h.window.TripDemo.load('capitals14');assert.equal(h.element('chkPlanar').checked,false);
});

test('20-stop UI keeps large checked counts exact and posts the checkpoint on Resume',async()=>{
  const h=harness(success);
  h.element('input').value=Array.from({length:20},(_,i)=>`Node ${i} | ${40+i/100},14${i===0?' START':''}`).join('\n');
  h.element('chkBrute').checked=true;
  await h.api.run('brute');const job=h.jobs.at(-1), checked=9007199254740993n,total=121645100408832000n;
  h.api.handleWorkerMessage({data:{type:'result',jobId:job.jobId,algorithm:'brute',metric:'direct',pointsSorted:job.points,totalKm:5,baseKm:9,directKm:5,checked,total,elapsedMs:1000,cancelled:true,exact:false,resumeState:{engine:{version:2,checked:checked.toString()},elapsedMs:1000}}});
  assert.match(h.element('bruteProgressText').textContent,/9,007,199,254,740,993/);
  assert.equal(h.element('btnStandard').textContent,'Resume Brute Force');
  await h.api.run('brute');assert.equal(h.jobs.at(-1).resumeState.engine.checked,checked.toString());
  h.api.cancelWork();
});

 test('Deep startup fallback reports no result when the worker has not reported any route',async()=>{
 const h=harness(success);h.element('input').value=sample;await h.api.run('deep');h.api.requestCancel();[...h.timerJobs.values()].at(-1)();
 assert.equal(h.workers[0].terminated,true);assert.match(h.element('searchProgressText').textContent,/before a route was reported/);assert.equal(h.element('searchBest').textContent,'—');assert.equal(h.element('searchCancel').disabled,true);
 });

test('all seven extra-time buttons use the selected budget, static label and SL/EN text',async()=>{
  const choices=[[60000,'+1 min','+1 min'],[300000,'+5 min','+5 min'],[900000,'+15 min','+15 min'],[3600000,'+1 hour','+1 ura'],[14400000,'+4 hours','+4 ure'],[43200000,'+12 hours','+12 ur'],[86400000,'+1 day','+1 dan']];
  const html=readFileSync(new URL('../public/Trip/new/index.html',import.meta.url),'utf8');
  assert.match(html,/<span id="continueDeepLabel"/);assert.doesNotMatch(html,/<button id="continueDeep"/);
  for(const [ms,en,sl] of choices){
    const h=harness(success);h.element('input').value=sample;await h.api.run('deep');const first=h.jobs.at(-1);
    h.api.handleWorkerMessage({data:{type:'result',algorithm:'deep',jobId:first.jobId,reason:'cancelled',canContinue:true,exact:false,elapsedMs:2000,budgetMs:10000,candidates:39,completed:38,totalKm:100,baseKm:150,directKm:100,metric:'direct',pointsSorted:first.points}});
    assert.equal(h.element('continueDeep'+ms).disabled,false);assert.equal(h.element('continueDeep'+ms).textContent,en);
    h.window.MDLxDCCLocale={current:()=> 'sl'};h.api.refreshDeepContinue();assert.equal(h.element('continueDeep'+ms).textContent,sl);
    assert.ok(html.includes(`id="continueDeep${ms}"`));
    for(const invalid of [undefined,0,-1,NaN,Infinity,10000,'60000',86400001])h.api.continueDeep(invalid);
    assert.equal(h.jobs.some(j=>j.type==='continue-deep'),false);assert.equal(h.element('continueDeep').hidden,false);
    h.api.continueDeep(ms);const next=h.jobs.at(-1);assert.equal(next.additionalBudgetMs,ms);assert.equal(next.previousJobId,first.jobId);
    assert.equal(h.element('continueDeep'+ms).disabled,true);assert.match(h.element('searchStarts').textContent,/39.*38/);
    assert.equal(h.jobs.filter(j=>j.type==='solve'&&j.profile==='deep').length,1);h.api.cancelWork();
  }
});
