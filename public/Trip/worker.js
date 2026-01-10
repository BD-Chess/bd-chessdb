/* Web Worker: deterministic route optimization (Euclidean on lat/lon via equirectangular projection) */
'use strict';

// --- SEEDED RNG (Unchanged) ---
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
    // [0,1)
    const u = this.nextU64();
    const top = Number((u >> 11n) & ((1n << 53n) - 1n));
    return top / 9007199254740992;
  }
}

// --- GEOMETRY HELPERS (Unchanged) ---
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

// --- SOLVER COMPONENTS ---

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

function shuffledAllowed(allowed, rng) {
  const arr = allowed.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.nextFloat() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function nnWithJitter(start, D, allowed, rng, jitterScale) {
  const n = allowed.length;
  const used = new Uint8Array(D.length);
  const route = new Array(n);
  route[0] = start;
  used[start] = 1;

  for (let t = 1; t < n; t++) {
    const cur = route[t-1];
    let best = -1;
    let bestScore = Infinity;
    for (let idx = 0; idx < n; idx++) {
      const v = allowed[idx];
      if (used[v]) continue;
      const dv = D[cur][v];
      const noise = (rng.nextFloat() - 0.5) * jitterScale * dv;
      const score = dv + noise;
      if (score < bestScore || (score === bestScore && v < best)) {
        bestScore = score;
        best = v;
      }
    }
    route[t] = best;
    used[best] = 1;
  }
  return route;
}

// FIX: Removed 'timeBudgetMs' and 'performance.now()'
// Added 'moveBudget' to limit calculation count deterministically
function twoOpt(route, D, roundTrip, maxPasses, moveBudget) {
  const n = route.length;
  if (n < 4) return route;

  let movesChecked = 0;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 1; i < n - 2; i++) {
      const a = route[i-1], b = route[i];
      for (let k = i + 1; k < n - 1; k++) {
        
        // Budget Check
        movesChecked++;
        if (movesChecked > moveBudget) return route;

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

  // --- DETERMINISTIC SETTINGS ---
  // Replaced timeBudgetMs with moveBudget (operations count)
  let starts = 2;
  let maxPasses = 4;
  let moveBudget = 200000; // Default budget
  let jitterScale = 0.03;

  if (profile === 'standard') {
    starts = 2; maxPasses = 4; moveBudget = 500000; jitterScale = 0.03;
  } else if (profile === 'deep') {
    starts = 12; maxPasses = 10; moveBudget = 5000000; jitterScale = 0.08; // 10x more effort
  } 
  // Fallbacks
  else if (profile === 'fast') {
    starts = 1; maxPasses = 3; moveBudget = 100000; jitterScale = 0.02;
  } else if (profile === 'balanced') {
    starts = 4; maxPasses = 6; moveBudget = 1000000; jitterScale = 0.05;
  }

  let bestRoute = null;
  let bestLen = Infinity;
  const baseRoute = withCoords.map((_, i) => i); 
  const baseLen = routeLength(baseRoute, D, roundTrip);

  for (let s = 0; s < starts; s++) {
    const allowed = (s === 0) ? withCoords.map((_, i) => i)
                              : shuffledAllowed(withCoords.map((_, i) => i), rng);

    let route = null;
    if (s === 0) route = nearestNeighbor(start, D, allowed);
    else route = nnWithJitter(start, D, allowed, rng, jitterScale);

    route = twoOpt(route, D, roundTrip, maxPasses, moveBudget);

    const L = routeLength(route, D, roundTrip);
    if (L < bestLen - 1e-9) { bestLen = L; bestRoute = route.slice(); }
    else if (Math.abs(L - bestLen) <= 1e-9 && bestRoute) {
      // Tie-breaker: lexicographical check for true stability
      for (let i = 0; i < route.length; i++) {
        if (route[i] < bestRoute[i]) { bestRoute = route.slice(); break; }
        if (route[i] > bestRoute[i]) break;
      }
    }

    postMessage({ type: 'progress', text: `Start ${s+1}/${starts}: ${Math.round(L/10)/100} km` });
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
