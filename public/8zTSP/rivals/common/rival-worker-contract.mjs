// Skupna pogodba za lokalne iPad Web Worker/WASM reševalnike (LKH-3.0.14, GA-EAX, Google OR-Tools)
// - Neodvisen brskalniški parser EUC_2D .tsp in preverjalnik permutacije + obeh dolžin
// - Izvoz v polnem formatu `8ztsp-run.json` (1-based tura v kosih po 65.536 mest, združljivo z /8zTSP/run-export.mjs)

export async function sha256HexBytes(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(buf).digest('hex');
}

export function parseTsplibEuc2d(text) {
  const lines = text.split(/\r?\n/);
  let name = 'unknown';
  let dimension = 0;
  let edgeWeightType = null;
  let inCoords = false;
  let xs = null;
  let ys = null;
  let count = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx].trim();
    if (!raw || raw === 'EOF') {
      if (raw === 'EOF') break;
      continue;
    }
    if (!inCoords) {
      if (/^NODE_COORD_SECTION\b/i.test(raw)) {
        if (!Number.isSafeInteger(dimension) || dimension < 3 || dimension > 1_500_000) throw new Error('TSPLIB missing positive DIMENSION before NODE_COORD_SECTION');
        xs = new Float64Array(dimension);
        ys = new Float64Array(dimension);
        inCoords = true;
        continue;
      }
      const colon = raw.indexOf(':');
      if (colon !== -1) {
        const key = raw.slice(0, colon).trim().toUpperCase();
        const val = raw.slice(colon + 1).trim();
        if (key === 'NAME') name = val;
        else if (key === 'DIMENSION') dimension = Number(val);
        else if (key === 'EDGE_WEIGHT_TYPE') edgeWeightType = val.toUpperCase();
      }
    } else {
      const parts = raw.split(/\s+/);
      if (parts.length !== 3) throw new Error('Invalid coordinate row');
      if (count >= dimension) throw new Error(`More coordinates than DIMENSION=${dimension}`);
      xs[count] = Number(parts[1]);
      ys[count] = Number(parts[2]);
      if (Number(parts[0]) !== count + 1 || !Number.isFinite(xs[count]) || !Number.isFinite(ys[count])) {
        throw new Error('Expected finite coordinates and consecutive city IDs starting at 1');
      }
      count++;
    }
  }
  if (!inCoords || count !== dimension) {
    throw new Error(`Expected ${dimension} coordinates, parsed ${count}`);
  }
  if (edgeWeightType !== 'EUC_2D') {
    throw new Error(`Unsupported EDGE_WEIGHT_TYPE=${edgeWeightType} (expected EUC_2D)`);
  }
  return { name, dimension, edgeWeightType, xs, ys };
}

/**
 * Neodvisno preveri polno 0-based ali 1-based turo:
 * - bijekcija na 0..n-1 (1 bit / mesto)
 * - TSPLIB EUC_2D celoštevilska dolžina: Math.floor(Math.hypot(dx, dy) + 0.5) = Math.round(...) za pozitivne razdalje
 * - Neumaier-kompenzirana nezaokrožena Evklidska dolžina (za Finsko / UEF primerjave)
 */
export function verifyTourIndependent(problem, rawTour, isOneBased = false) {
  const n = problem.dimension;
  if (!rawTour || rawTour.length !== n) {
    throw new Error(`Invalid tour length: got ${rawTour?.length}, expected ${n}`);
  }
  const tour0 = new Uint32Array(n);
  const seen = new Uint32Array((n + 31) >>> 5);
  for (let i = 0; i < n; i++) {
    const v = isOneBased ? (rawTour[i] - 1) : rawTour[i];
    if (!Number.isInteger(v) || v < 0 || v >= n) {
      throw new Error(`Tour node out of range at index ${i}: ${rawTour[i]}`);
    }
    const word = v >>> 5;
    const mask = 1 << (v & 31);
    if ((seen[word] & mask) !== 0) {
      throw new Error(`Duplicate city ${v} in tour at index ${i}`);
    }
    seen[word] |= mask;
    tour0[i] = v;
  }

  const { xs, ys } = problem;
  let euc2dRounded = 0n;
  let exactSum = 0.0;
  let comp = 0.0;
  for (let i = 0; i < n; i++) {
    const a = tour0[i];
    const b = tour0[i + 1 === n ? 0 : i + 1];
    const dx = xs[a] - xs[b];
    const dy = ys[a] - ys[b];
    const dist = Math.sqrt(dx * dx + dy * dy);
    // TSPLIB nint(x) = (int)(x + 0.5) for non-negative x
    const rounded = BigInt(Math.floor(dist + 0.5));
    euc2dRounded += rounded;

    const t = exactSum + dist;
    if (Math.abs(exactSum) >= Math.abs(dist)) {
      comp += (exactSum - t) + dist;
    } else {
      comp += (dist - t) + exactSum;
    }
    exactSum = t;
  }

  return {
    valid: true,
    dimension: n,
    tour0,
    euc2dRoundedLength: euc2dRounded.toString(),
    euc2dRoundedNumber: Number(euc2dRounded),
    exactEuclideanLength: exactSum + comp,
  };
}

/**
 * Zgradi celoten JSON niz v enakem kosovnem zapisu kot `/8zTSP/run-export.mjs`
 * (1-based `tour` v blokih po 65.536 mest).
 */
export function serializeRunExportParts(record, tour0) {
  if (!record || !tour0?.length) throw new Error('No result to export');
  const cleanMeta = { ...record };
  delete cleanMeta.tour;
  const parts = [JSON.stringify(cleanMeta).slice(0, -1) + ',"tour":['];
  for (let i = 0; i < tour0.length; i += 65536) {
    const sub = tour0.subarray(i, Math.min(tour0.length, i + 65536));
    parts.push((i ? ',' : '') + Array.from(sub, x => x + 1).join(','));
  }
  parts.push(']}');
  return parts;
}

export function createRunFile(record, tour0, fileName = '8ztsp-run.json') {
  const parts = serializeRunExportParts(record, tour0);
  if (typeof File !== 'undefined') {
    return new File(parts, fileName, { type: 'application/json' });
  }
  return { name: fileName, type: 'application/json', text: parts.join('') };
}
