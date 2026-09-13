/* Web Worker: Deterministic Route Optimization (XorShift64+ & 2-Opt) */
'use strict';
let activeJobId;
if (!globalThis.TripBruteForce) importScripts('brute-force.js?v=20260913-brute15-chat1');
let bruteJob = null;

// 1. Deterministic Random Number Generator (XorShift64*)
function fnv1a64(str) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h;
}

class XorShift64Star {
  constructor(seedBig) {
    let x = seedBig & 0xffffffffffffffffn;
    if (x === 0n) x = 0x9e3779b97f4a7c15n;
    this.x = x;
  }
  nextU64() {
    let x = this.x;
    x ^= (x >> 12n);
    x ^= (x << 25n) & 0xffffffffffffffffn;
    x ^= (x >> 27n);
    this.x = x;
    return (x * 2685821657736338717n) & 0xffffffffffffffffn;
  }
  nextFloat() { // [0,1)
    const u = this.nextU64();
    return Number((u >> 11n) & ((1n << 53n) - 1n)) / 9007199254740992;
  }
}

// 2. Geometry Helpers
function toXYMeters(points) {
  const R = 6371000.0;
  let latSum = 0, cnt = 0;
  for (const p of points) { if (isFinite(p.lat) && isFinite(p.lon)) { latSum += p.lat; cnt++; } }
  const lat0 = (cnt ? (latSum / cnt) : 0) * Math.PI / 180.0;
  const cos0 = Math.cos(lat0);

  return points.map(p => {
    if (!isFinite(p.lat) || !isFinite(p.lon)) return null;
    const lat = p.lat * Math.PI / 180.0;
    const lon = p.lon * Math.PI / 180.0;
    return { x: R * lon * cos0, y: R * lat };
  });
}

function buildDistanceMatrix(xy) {
  const n = xy.length;
  const D = new Array(n);
  for (let i = 0; i < n; i++) {
    D[i] = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      if (i === j) D[i][j] = 0;
      else {
        const dx = xy[i].x - xy[j].x;
        const dy = xy[i].y - xy[j].y;
        D[i][j] = Math.sqrt(dx*dx + dy*dy);
      }
    }
  }
  return D;
}

function routeLength(route, D, roundTrip) {
  let sum = 0;
  for (let i = 0; i < route.length - 1; i++) sum += D[route[i]][route[i+1]];
  if (roundTrip && route.length > 1) sum += D[route[route.length-1]][route[0]];
  return sum;
}

// 3. Algorithms
function nearestNeighbor(start, D, allowed) {
  const n = allowed.length;
  const used = new Uint8Array(D.length);
  const route = [start];
  used[start] = 1;

  for (let t = 1; t < n; t++) {
    const cur = route[t-1];
    let best = -1, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const v = allowed[i];
      if (!used[v]) {
        const d = D[cur][v];
        if (d < bestD) { bestD = d; best = v; }
      }
    }
    if (best !== -1) { route.push(best); used[best] = 1; }
  }
  return route;
}

function twoOpt(route, D, roundTrip, maxPasses, timeLimit) {
  const n = route.length, t0 = performance.now();
  // Directed costs: reversing a segment also reverses every interior edge.
  // Restart after acceptance so the prefix differences always match the route.
  for (let pass = 0; pass < maxPasses; pass++) {
    const reverseDelta = new Float64Array(n);
    for (let k = 0; k < n - 1; k++)
      reverseDelta[k+1] = reverseDelta[k] + D[route[k+1]][route[k]] - D[route[k]][route[k+1]];
    let bestDelta = -1e-9, bestI = -1, bestK = -1;
    for (let i = 1; i < n - 1; i++) for (let k = i + 1; k < n; k++) {
      const a = route[i-1], b = route[i], c = route[k];
      let delta = D[a][c] - D[a][b] + reverseDelta[k] - reverseDelta[i];
      if (k < n - 1) delta += D[b][route[k+1]] - D[c][route[k+1]];
      else if (roundTrip) delta += D[b][route[0]] - D[c][route[0]];
      if (delta < bestDelta) { bestDelta = delta; bestI = i; bestK = k; }
    }
    if (bestI < 0) break;
    let L = bestI, R = bestK;
    while (L < R) { [route[L], route[R]] = [route[R], route[L]]; L++; R--; }
    if (performance.now() - t0 > timeLimit) break;
  }
  return route;
}

function solve(points, startIdx, profile, roundTrip, distanceMatrix) {
  const validIndices = points.map((p, i) => (isFinite(p.lat) && isFinite(p.lon)) ? i : -1).filter(i => i !== -1);
  const xy = toXYMeters(validIndices.map(i => points[i]));
  if (validIndices.length !== points.length || points.length < 2) throw new Error('All stops must have valid coordinates.');
  if (distanceMatrix != null && (distanceMatrix.length !== points.length || distanceMatrix.some(row =>
    !row || row.length !== points.length || Array.from(row).some(v => !Number.isFinite(v) || v < 0))))
    throw new Error('Incomplete road distance matrix.');
  const D = distanceMatrix == null ? buildDistanceMatrix(xy) : distanceMatrix;
  const metric = distanceMatrix == null ? 'direct' : 'road';

  // --- SETTINGS (The only change) ---
  let starts = 2, passes = 4, time = 300;
  
  if (profile === 'deep') { 
    // Bounded multistart search; no global-optimum claim.
    starts = distanceMatrix == null ? 2000 : 128; 
    passes = 10; 
    time = 2000; // 2s budget per start (plenty for 2-opt to converge)
  } else if (profile === 'standard') {
    starts = 2; passes = 4; time = 300;
  }

  // Seed Generator
  const seed = points.map(p => `${p.lat},${p.lon}`).join('|') + `|${startIdx}|${profile}|${roundTrip}|${JSON.stringify(distanceMatrix || null)}`;
  const rng = new XorShift64Star(fnv1a64(seed));

  // Compare with the entered order after moving START to the front.
  const fixedStart = startIdx >= 0 && startIdx < points.length ? startIdx : 0;
  const baseline = [fixedStart, ...validIndices.filter(i => i !== fixedStart)];
  const baseLen = routeLength(baseline, D, roundTrip);
  let bestRoute = baseline.slice();
  let bestLen = baseLen;

  // Optimization Loop
  for (let s = 0; s < starts; s++) {
    // 1. Determine Start Node
    let currentStart = 0;
    const globalStart = validIndices.indexOf(startIdx);
    if (globalStart !== -1) currentStart = globalStart;

    // 2. Generate Initial Route
    // Pass 0: Greedy Nearest Neighbor (Good baseline)
    // Pass 1+: Random Shuffle (Global Exploration - logic from worker2.js)
    let route = nearestNeighbor(currentStart, D, validIndices.map((_,i)=>i));
    
    if (s > 0) {
      // Simple shuffle of non-start points (Fisher-Yates)
      for (let i = route.length - 1; i > 1; i--) {
        const j = 1 + Math.floor(rng.nextFloat() * (i));
        [route[i], route[j]] = [route[j], route[i]];
      }
    }

    // 3. Optimize (2-Opt)
    route = twoOpt(route, D, roundTrip, passes, time);
    const len = routeLength(route, D, roundTrip);

    if (len < bestLen) { bestLen = len; bestRoute = route.slice(); }

    // 4. Progress Reporting (Added feature)
    if (s % 50 === 0 || s === starts - 1) {
      const pct = Math.min(99, Math.round((s + 1) / starts * 100));
      postMessage({ type: 'progress', jobId: activeJobId, text: `Search: ${pct}% (${s+1}/${starts})` });
    }
  }

  // Reconstruct
  const finalOrder = bestRoute.map(localIdx => validIndices[localIdx]);
  const sortedPoints = finalOrder.map(i => points[i]);

  return { 
    pointsSorted: sortedPoints, 
    totalKm: bestLen / 1000.0, 
    baseKm: baseLen / 1000.0,
    metric,
    directKm: routeLength(bestRoute, buildDistanceMatrix(xy), roundTrip) / 1000.0 
  };
}

// 4. Cooperative exhaustive search. Yield within ~20ms so Cancel can be handled.
function startBruteForce(msg) {
  if (msg.points.length < 2 || msg.points.length > TripBruteForce.MAX_STOPS)
    throw new Error('Brute Force supports 2–15 stops including START.');
  if (msg.points.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lon)))
    throw new Error('All stops must have valid coordinates.');
  const directD = buildDistanceMatrix(toXYMeters(msg.points));
  const D = msg.distanceMatrix == null ? directD : msg.distanceMatrix;
  const start = Number.isInteger(msg.startIdx) && msg.startIdx >= 0 && msg.startIdx < msg.points.length ? msg.startIdx : 0;
  const job = {msg, directD, engine:TripBruteForce.create(D, start, msg.roundTrip),
    started:performance.now(), lastReport:0, timer:null};
  bruteJob = job;
  function report(final = false, cancelled = false) {
    const state = job.engine.snapshot();
    const elapsedMs = Math.max(0, performance.now() - job.started);
    self.postMessage({type:final ? 'result' : 'brute-progress', jobId:msg.jobId,
      algorithm:'brute', exact:state.done, cancelled:cancelled && !state.done,
      checked:state.checked, total:state.total, elapsedMs,
      metric:msg.distanceMatrix == null ? 'direct' : 'road',
      pointsSorted:state.route.map(i => msg.points[i]), totalKm:state.bestLength/1000,
      baseKm:state.baseLength/1000,
      directKm:routeLength(state.route, directD, msg.roundTrip)/1000});
  }
  job.finish = cancelled => { clearTimeout(job.timer); report(true, cancelled); bruteJob = null; };
  function tick() {
    if (bruteJob !== job) return;
    const until = performance.now() + 20;
    let done;
    do { done = job.engine.step(2048); } while (!done && performance.now() < until);
    if (done) { job.finish(false); return; }
    if (performance.now() - job.lastReport >= 200) { report(); job.lastReport = performance.now(); }
    job.timer = setTimeout(tick, 0);
  }
  report();
  job.timer = setTimeout(tick, 0);
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'cancel') {
    if (bruteJob?.msg.jobId === msg.jobId) bruteJob.finish(true);
    return;
  }
  if (msg.type === 'solve') {
    if (bruteJob) { clearTimeout(bruteJob.timer); bruteJob = null; }
    activeJobId = msg.jobId;
    try {
      if (msg.profile === 'brute') { startBruteForce(msg); return; }
      const started = performance.now();
      const result = solve(msg.points, msg.startIdx, msg.profile, msg.roundTrip, msg.distanceMatrix);
      self.postMessage({type:'result', jobId:msg.jobId, ...result,
        algorithm:msg.profile, exact:false, elapsedMs:performance.now()-started});
    } catch (e) {
      self.postMessage({ type:'error', jobId:msg.jobId, error:e.toString() });
    }
  }
};
