/* Web Worker: deterministic route optimization (Euclidean on lat/lon via equirectangular projection) */
'use strict';

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
  nextFloat() {
    const u = this.nextU64();
    const top = Number((u >> 11n) & ((1n << 53n) - 1n));
    return top / 9007199254740992;
  }
}

function toXYMeters(points) {
  const R = 6371000.0;
  let latSum = 0;
  let cnt = 0;
  for (const p of points) {
    if (isFinite(p.lat) && isFinite(p.lon)) { latSum += p.lat; cnt++; }
  }
  const lat0 = (cnt ? (latSum / cnt) : 0) * Math.PI / 180.0;
  const cos0 = Math.cos(lat0);

  const xy = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!isFinite(p.lat) || !isFinite(p.lon)) {
      xy[i] = null;
      continue;
    }
    const lat = p.lat * Math.PI / 180.0;
    const lon = p.lon * Math.PI / 180.0;
    const x = R * lon * cos0;
    const y = R * lat;
    xy[i] = { x, y };
  }
  return xy;
}

function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx*dx + dy*dy;
}

function buildDistanceMatrix(xy) {
  const n = xy.length;
  const D = new Array(n);
  for (let i = 0; i < n; i++) D[i] = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    D[i][i] = 0;
    for (let j = i + 1; j < n; j++) {
      const d = Math.sqrt(dist2(xy[i], xy[j]));
      D[i][j] = d;
      D[j][i] = d;
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

function nearestNeighbor(start, D, allowed) {
  const n = allowed.length;
  const used = new Uint8Array(D.length);
  const route = new Array(n);
  route[0] = start;
  used[start] = 1;
  for (let t = 1; t < n; t++) {
    const cur = route[t-1];
    let best = -1;
    let bestD = Infinity;
    for (let idx = 0; idx < n; idx++) {
      const v = allowed[idx];
      if (used[v]) continue;
      const dv = D[cur][v];
      if (dv < bestD || (dv === bestD && v < best)) {
        bestD = dv;
        best = v;
      }
    }
    route[t] = best;
    used[best] = 1;
  }
  return route;
}

function twoOpt(route, D, roundTrip, maxPasses, timeBudgetMs) {
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
        if (delta < -1e-12) {
          let L = i, R = k;
          while (L < R) {
            const tmp = route[L]; route[L] = route[R]; route[R] = tmp;
            L++; R--;
          }
          improved = true;
        }
        if ((performance.now() - t0) > timeBudgetMs) return route;
      }
    }
    if (!improved) break;
  }
  return route;
}

function solve(points, startIdx, profile, roundTrip) {
  const withCoords = [];
  const without = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (isFinite(p.lat) && isFinite(p.lon)) withCoords.push(i);
    else without.push(i);
  }

  const coordPoints = withCoords.map(i => points[i]);
  const xy = toXYMeters(coordPoints);
  const D = buildDistanceMatrix(xy);

  const startGlobal = startIdx;
  let start = 0;
  if (startGlobal >= 0 && startGlobal < points.length) {
    const pos = withCoords.indexOf(startGlobal);
    start = (pos >= 0) ? pos : 0;
  }

  const seedStr = points.map(p => `${p.name}|${p.lat}|${p.lon}`).join('\n') + `|start=${start}|profile=${profile}|rt=${roundTrip}`;
  const rng = new XorShift64Star(fnv1a64(seedStr));

  // --- CONFIGURATION ---
  let starts = 2;
  let maxPasses = 4;
  let timeBudgetMs = 300;

  if (profile === 'standard') {
    starts = 2; maxPasses = 4; timeBudgetMs = 300;
  } else if (profile === 'deep') {
    // UNLEASHED MODE:
    // 1. High start count (100) to ensure we try many random starting points.
    // 2. High time budget (12s) to allow 2-Opt to fully converge on each.
    starts = 100;
    maxPasses = 50; 
    timeBudgetMs = 12000; 
  } else if (profile === 'fast') {
    starts = 1; maxPasses = 3; timeBudgetMs = 250;
  }

  let bestRoute = null;
  let bestLen = Infinity;
  const baseRoute = withCoords.map((_, i) => i); 
  const baseLen = routeLength(baseRoute, D, roundTrip);

  for (let s = 0; s < starts; s++) {
    // REVERTED LOGIC: Use random shuffling like worker2.js
    // This allows exploring the global search space much better than 'jitter'.
    
    let route;
    if (s === 0) {
        // First pass: Greedy Nearest Neighbor (Good Baseline)
        route = nearestNeighbor(start, D, withCoords.map((_, i) => i));
    } else {
        // Subsequent passes: Random Shuffle (Global Exploration)
        // 1. Create indices [0, 1, 2... N-1]
        route = new Array(withCoords.length);
        for(let k=0; k<withCoords.length; k++) route[k] = k;
        
        // 2. Force start point to position 0
        const startPos = route.indexOf(start);
        if (startPos !== 0) { [route[0], route[startPos]] = [route[startPos], route[0]]; }

        // 3. Shuffle the rest (Fisher-Yates on 1..N-1)
        for (let i = route.length - 1; i > 1; i--) {
            const j = 1 + Math.floor(rng.nextFloat() * i);
            [route[i], route[j]] = [route[j], route[i]];
        }
    }

    // Distribute time budget across starts
    const sliceBudget = Math.max(50, timeBudgetMs / starts * 2);
    route = twoOpt(route, D, roundTrip, maxPasses, sliceBudget);

    const L = routeLength(route, D, roundTrip);
    if (L < bestLen - 1e-9) { bestLen = L; bestRoute = route.slice(); }
    else if (Math.abs(L - bestLen) <= 1e-9 && bestRoute) {
      for (let i = 0; i < route.length; i++) {
        if (route[i] < bestRoute[i]) { bestRoute = route.slice(); break; }
        if (route[i] > bestRoute[i]) break;
      }
    }

    // Send visual progress
    if (s % 5 === 0 || s === starts - 1) {
      const pct = Math.min(99, Math.round((s + 1) / starts * 100));
      postMessage({ type: 'progress', text: `Deep Search: ${pct}% complete...` });
    }
  }

  const orderCoordGlobal = bestRoute.map(i => withCoords[i]);
  const orderGlobal = orderCoordGlobal.concat(without);
  const pointsSorted = orderGlobal.map(i => points[i]);
  const totalKm = bestLen / 1000.0;
  const baseKm = baseLen / 1000.0;

  return { orderGlobal, pointsSorted, totalKm, baseKm };
}

onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type !== 'solve') return;
  try {
    const { points, startIdx, profile, roundTrip } = msg;
    const res = solve(points, startIdx, profile, !!roundTrip);
    postMessage({
      type: 'result',
      order: res.orderGlobal,
      pointsSorted: res.pointsSorted,
      totalKm: res.totalKm,
      baseKm: res.baseKm,
    });
  } catch (e) {
    postMessage({ type: 'error', error: String(e && e.stack ? e.stack : e) });
  }
};
