import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/Trip/new/app.js', import.meta.url), 'utf8');
const matrixSource = readFileSync(new URL('../public/Trip/new/road-matrix.js', import.meta.url), 'utf8');
const sample = 'Nova Gorica START\nLjubljana\nMaribor\nNovo Mesto\nKoper\nPtuj';

function harness(geocode) {
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
    console, google, window: { google }, Map, Set, performance: {now: () => clock},
    document: { body:{classList:{remove(){},toggle(){}}}, createElement: () => ({style:{}, dataset:{}, appendChild() {}, querySelector:()=>({dataset:{},textContent:''})}), getElementById: element, querySelector: () => element('panel'), querySelectorAll: () => [], addEventListener() {} },
    localStorage: { setItem() {} },
    Worker: class { constructor() {workers.push(this);} postMessage(msg) {jobs.push(msg);} terminate() {this.terminated=true;} },
    setTimeout(fn, ms) { if (ms === 250) { queueMicrotask(fn); return 0; } const id = ++nextTimer; timerJobs.set(id, fn); return id; },
    clearTimeout(id) { timerJobs.delete(id); }
  });
  vm.runInContext(readFileSync(new URL('../public/Trip/new/ui-text.js', import.meta.url), 'utf8'), context);
  vm.runInContext(matrixSource, context);
  vm.runInContext(readFileSync(new URL('../public/Trip/new/brute-force.js', import.meta.url), 'utf8'), context);
  element('chkDirect').checked = true;
  // Test-only access to the real closure: no production debug API or duplicate parser.
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, [
    'window.test = { showSavings, resumeAvailable, refreshBruteMap, refreshBruteInfo, requestCancel, handleWorkerMessage, clearComparison, cancelWork, parseStops, normalizeTripEditorText, geocodeMissingPoints, run, setStatus, updateMapVisualization, routeErrorInfo,',
    'setMap(value) { map = value; }, setMode(value) { currentTravelMode = value; }, setDirect(km) { lastDirectKm = km; }, setMiles(value) { useMiles = value; } };',
    '})();'
  ].join('\n')), context);
  return { api: context.window.test, elements, element, jobs, google, timerJobs, workers, doc:context.document, tick(ms){clock += ms;} };
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

test('manual Brute Force is available through 16; 17 disables it without starting another algorithm', async()=>{
  const h=harness(()=>{throw new Error('No geocoding expected');});
  const input=n=>Array.from({length:n},(_,i)=>`Place ${i} | ${46+i/100}, ${14+i/100}${i===2?' START':''}`).join('\n');
  h.element('input').value=input(16);
  h.api.refreshBruteInfo();
  assert.equal(h.element('chkBrute').disabled,false);assert.equal(h.element('chkBrute').checked,false);
  assert.match(h.element('bruteInfo').textContent,/1,307,674,368,000/);
  h.element('chkBrute').checked=true;
  await h.api.run('standard');assert.equal(h.jobs[0].profile,'brute');assert.equal(h.jobs[0].startIdx,2);
  assert.equal(h.element('btnDeep').hidden,true);
  h.api.cancelWork();assert.equal(h.workers[0].terminated,true);
  h.element('input').value=input(17);h.element('chkBrute').checked=true;
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
  const air=workers.at(-1);assert.equal(air.message.profile,'deep');assert.equal(air.message.distanceMatrix,undefined);
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
  await h.api.run('standard');const first=h.jobs.at(-1);
  const state={engine:{checked:37},elapsedMs:250};
  h.api.handleWorkerMessage({data:{type:'result',algorithm:'brute',jobId:first.jobId,
    checked:37,total:120,cancelled:true,exact:false,resumeState:state,elapsedMs:250,
    totalKm:100,baseKm:150,directKm:100,metric:'direct',pointsSorted:first.points}});
  assert.equal(h.element('btnStandard').textContent,'Resume Brute Force');
  h.tick(3_600_000);await h.api.run('standard');
  const resumed=h.jobs.at(-1);
  assert.equal(resumed.resumeState,state);assert.equal(resumed.points,first.points);
  assert.notEqual(resumed.jobId,first.jobId);assert.equal(resumed.startIdx,first.startIdx);
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

test('live map refresh is adaptive, improved-only, visible-only, and preserves the camera',async()=>{
  let calls=0;
  const h=mapHarness(async req=>{calls++;return {routes:[{path:[req.origin,req.destination],distanceMeters:100000}]};});
  const job={profile:'brute',mode:'DRIVING',roundTrip:false,direct:false,mapPending:false,mapBestKm:Infinity,lastMapRefresh:0};
  const msg={checked:10,total:100,elapsedMs:1000,totalKm:100,baseKm:200,directKm:80,pointsSorted:twoStops};
  h.tick(29999);h.api.refreshBruteMap(msg,job);assert.equal(calls,0);
  h.tick(1);h.api.refreshBruteMap(msg,job);
  await new Promise(r=>setImmediate(r));
  assert.equal(calls,1);assert.equal(h.cameraChanges(),0);
  h.tick(30000);h.api.refreshBruteMap(msg,job);assert.equal(calls,1); // unchanged best
  h.doc.hidden=true;h.api.refreshBruteMap({...msg,totalKm:99},job);assert.equal(calls,1);
  h.doc.hidden=false;
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
