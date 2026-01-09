/* Web Worker: deterministic route optimization (Euclidean on lat/lon via equirectangular projection) */
'use strict';

function fnv1a64(str) {
  // 64-bit FNV-1a as BigInt (deterministic across browsers)
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

function toXYMeters(points) {
  // Equirectangular projection centered on mean latitude
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

function shuffledAllowed(allowed, rng) {
  const arr = allowed.slice();
  // Fisher-Yates deterministic
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.nextFloat() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function nnWithJitter(start, D, allowed, rng, jitterScale) {
  // NN but distance is perturbed slightly to diversify starts (deterministic via rng)
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

function twoOpt(route, D, roundTrip, maxPasses, timeBudgetMs) {
  const n = route.length;
  const t0 = performance.now();
  if (n < 4) return route;

  // Keep start fixed at index 0
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    // i and k are segment endpoints to reverse (i..k)
    for (let i = 1; i < n - 2; i++) {
      const a = route[i-1], b = route[i];
      for (let k = i + 1; k < n - 1; k++) {
        const c = route[k], d = route[k+1];

        const delta = (D[a][c] + D[b][d]) - (D[a][b] + D[c][d]);
        if (delta < -1e-12) {
          // reverse [i..k]
          for (let l = 0, r = k; l < r; l++, r--) {
            if (l < i) continue;
            if (r < i) break;
          }
          // Faster in-place reverse
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

    if (roundTrip) {
      // Also consider edges involving last->first (start fixed)
      // Optional: you can add wraparound 2-opt moves here later.
    }

    if (!improved) break;
  }
  return route;
}

function solve(points, startIdx, profile, roundTrip) {
  // Separate points with coords vs without coords.
  const withCoords = [];
  const without = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (isFinite(p.lat) && isFinite(p.lon)) withCoords.push(i);
    else without.push(i);
  }

  // If some lack coords, keep them appended in input order.
  const coordPoints = withCoords.map(i => points[i]);
  const xy = toXYMeters(coordPoints);
  const D = buildDistanceMatrix(xy);

  // Start index in coordPoints space:
  const startGlobal = startIdx;
  let start = 0;
  if (startGlobal >= 0 && startGlobal < points.length) {
    const pos = withCoords.indexOf(startGlobal);
    start = (pos >= 0) ? pos : 0;
  }

  // Deterministic seed based on input text
  const seedStr = points.map(p => `${p.name}|${p.lat}|${p.lon}`).join('\n') + `|start=${start}|profile=${profile}|rt=${roundTrip}`;
  const rng = new XorShift64Star(fnv1a64(seedStr));

  // Profile params (tuned for browser responsiveness)
  let starts = 1;
  let maxPasses = 3;
  let timeBudgetMs = 350;  // per start
  let jitterScale = 0.03;

  if (profile === 'fast') {
    starts = 1; maxPasses = 3; timeBudgetMs = 250; jitterScale = 0.02;
  } else if (profile === 'balanced') {
    starts = 4; maxPasses = 6; timeBudgetMs = 650; jitterScale = 0.05;
  } else {
    starts = 2; maxPasses = 4; timeBudgetMs = 400; jitterScale = 0.03;
  }

  let bestRoute = null;
  let bestLen = Infinity;

  // Base order length for "saved" metric (using coords-only subset)
  const baseRoute = withCoords.map((_, i) => i); // input order among coords only
  const baseLen = routeLength(baseRoute, D, roundTrip);

  for (let s = 0; s < starts; s++) {
    const allowed = (s === 0) ? withCoords.map((_, i) => i)
                              : shuffledAllowed(withCoords.map((_, i) => i), rng);

    let route = null;
    if (s === 0) route = nearestNeighbor(start, D, allowed);
    else route = nnWithJitter(start, D, allowed, rng, jitterScale);

    route = twoOpt(route, D, roundTrip, maxPasses, timeBudgetMs);

    const L = routeLength(route, D, roundTrip);
    if (L < bestLen - 1e-9) { bestLen = L; bestRoute = route.slice(); }
    else if (Math.abs(L - bestLen) <= 1e-9 && bestRoute) {
      // deterministic tie-break: lexicographic
      for (let i = 0; i < route.length; i++) {
        if (route[i] < bestRoute[i]) { bestRoute = route.slice(); break; }
        if (route[i] > bestRoute[i]) break;
      }
    }

    postMessage({ type: 'progress', text: `Start ${s+1}/${starts}: ${Math.round(L/10)/100} km` });
  }

  // Map bestRoute indices back to original points ordering
  const orderCoordGlobal = bestRoute.map(i => withCoords[i]);

  // Add "without coords" at end in input order (deterministic fallback)
  const orderGlobal = orderCoordGlobal.concat(without);

  // Build pointsSorted in that order
  const pointsSorted = orderGlobal.map(i => points[i]);

  // total length computed on coords subset; if missing coords exist, length is still meaningful for computed part.
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
