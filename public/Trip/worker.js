/* Web Worker: Deterministic Route Optimization (XorShift64+ & 2-Opt) */
'use strict';

// 1. Deterministic Random Number Generator (XorShift64*)
// Ensures "Same Input = Same Route" every time.
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
  const n = route.length;
  const t0 = performance.now();
  if (n < 4) return route;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 1; i < n - 2; i++) {
      const a = route[i-1], b = route[i];
      for (let k = i + 1; k < n - 1; k++) {
        const c = route[k], d = route[k+1];
        const delta = (D[a][c] + D[b][d]) - (D[a][b] + D[c][d]);
        if (delta < -1e-9) {
          // Reverse segment [i, k]
          let L = i, R = k;
          while (L < R) { const tmp = route[L]; route[L] = route[R]; route[R] = tmp; L++; R--; }
          improved = true;
        }
        if ((performance.now() - t0) > timeLimit) return route;
      }
    }
    if (!improved) break;
  }
  return route;
}

function solve(points, startIdx, profile, roundTrip) {
  const validIndices = points.map((p, i) => (isFinite(p.lat) && isFinite(p.lon)) ? i : -1).filter(i => i !== -1);
  const xy = toXYMeters(validIndices.map(i => points[i]));
  const D = buildDistanceMatrix(xy);

  // Profile Settings
  let starts = 2, passes = 4, time = 300;
  if (profile === 'deep') { starts = 12; passes = 10; time = 1500; }

  // Seed Generator
  const seed = points.map(p => `${p.lat},${p.lon}`).join('|') + `|${startIdx}|${profile}|${roundTrip}`;
  const rng = new XorShift64Star(fnv1a64(seed));

  let bestRoute = null;
  let bestLen = Infinity;

  // Base Calculation (Unoptimized)
  const baseLen = routeLength(validIndices.map((_, i) => i), D, roundTrip);

  // Optimization Loop
  for (let s = 0; s < starts; s++) {
    // Determine start node relative to validIndices
    let currentStart = 0;
    const globalStart = validIndices.indexOf(startIdx);
    if (globalStart !== -1) currentStart = globalStart;

    let route = nearestNeighbor(currentStart, D, validIndices.map((_,i)=>i));
    
    // Apply Random Jitter for subsequent starts to find new paths
    if (s > 0) {
      // Simple shuffle of non-start points
      for (let i = route.length - 1; i > 1; i--) {
        const j = 1 + Math.floor(rng.nextFloat() * (i));
        [route[i], route[j]] = [route[j], route[i]];
      }
    }

    route = twoOpt(route, D, roundTrip, passes, time);
    const len = routeLength(route, D, roundTrip);

    if (len < bestLen) { bestLen = len; bestRoute = route.slice(); }
  }

  // Reconstruct
  const finalOrder = bestRoute.map(localIdx => validIndices[localIdx]);
  const sortedPoints = finalOrder.map(i => points[i]);

  return { 
    pointsSorted: sortedPoints, 
    totalKm: bestLen / 1000.0, 
    baseKm: baseLen / 1000.0 
  };
}

// 4. Message Handler
self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'solve') {
    try {
      const result = solve(msg.points, msg.startIdx, msg.profile, msg.roundTrip);
      
      // IMPORTANT: This format MUST match what app.js expects
      self.postMessage({
        type: 'result', 
        pointsSorted: result.pointsSorted,
        totalKm: result.totalKm,
        baseKm: result.baseKm
      });
    } catch (e) {
      self.postMessage({ type: 'error', error: e.toString() });
    }
  }
};
