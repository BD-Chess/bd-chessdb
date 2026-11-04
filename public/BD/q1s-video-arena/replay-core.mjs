// Read-only presentation helpers. No strategy, broker, account mutation or live feed.
export function upperBound(rows, target, get = x => x[0]) {
  let lo = 0, hi = rows.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (get(rows[mid]) <= target) lo = mid + 1; else hi = mid; }
  return lo;
}

export function pathForDisplay(payload) {
  if (!Array.isArray(payload.rows) || !payload.rows.length) throw Error('Empty account path');
  const n = payload.rows.length;
  const p = {t: new Float64Array(n), net: new Float64Array(n), wallet: new Float64Array(n), raw: new Float64Array(n), flat: new Uint8Array(n), fresh: new Uint8Array(n), dd: new Float64Array(n)};
  let peak = 100, worst = 0;
  for (let i = 0; i < n; i++) {
    const r = payload.rows[i];
    if (!Array.isArray(r) || r.length !== 6 || !r.slice(0,4).every(x => Number.isFinite(Number(x))) || (i && +r[0] < p.t[i-1])) throw Error('Invalid account sample');
    p.t[i] = +r[0]; p.net[i] = +r[1]; p.wallet[i] = +r[2]; p.raw[i] = +r[3]; p.flat[i] = +r[4]; p.fresh[i] = +r[5];
    peak = Math.max(peak, p.net[i]); if (peak > 0) worst = Math.max(worst, (peak - p.net[i]) / peak);
    p.dd[i] = worst;
  }
  return p;
}

export function sampleAt(path, seconds) {
  const i = upperBound(path.t, seconds, x => x) - 1;
  if (i < 0) return {index: -1, seconds: 0, net: 100, wallet: 100, raw: 100, flat: true, fresh: false, dd: 0};
  return {index: i, seconds: path.t[i], net: path.net[i], wallet: path.wallet[i], raw: path.raw[i], flat: !!path.flat[i], fresh: !!path.fresh[i], dd: path.dd[i]};
}

export function lineEnvelope(times, values, endCount, buckets = 700) {
  if (endCount <= 0) return [];
  const result = [], width = Math.max(1, Math.ceil(endCount / buckets));
  for (let start = 0; start < endCount; start += width) {
    const end = Math.min(endCount, start + width); let min = start, max = start;
    for (let i = start + 1; i < end; i++) { if (values[i] < values[min]) min = i; if (values[i] > values[max]) max = i; }
    const indices = [...new Set([start, min, max, end - 1])].sort((a,b) => a-b);
    for (const i of indices) result.push([times[i], values[i]]);
  }
  return result;
}

export function candlesForWindow(rows, seconds, span, targetCount = 180) {
  const end = upperBound(rows, seconds), startSecond = Math.max(0, seconds - span);
  const begin = upperBound(rows, startSecond - 1e-9);
  const bucketSeconds = Math.max(1, Math.ceil(span / Math.max(1,targetCount)));
  const bars = []; let current = null;
  for (let i = begin; i < end; i++) {
    const r = rows[i], key = Math.floor((r[0] - startSecond) / bucketSeconds);
    if (!current || key !== current.key) {
      current = {key, t: r[0], first: r[0], open: r[1], high: r[2], low: r[3], close: r[4], trades: r[5]}; bars.push(current);
    } else { current.t = r[0]; current.high = Math.max(current.high,r[2]); current.low = Math.min(current.low,r[3]); current.close = r[4]; current.trades += r[5]; }
  }
  return {bars, bucketSeconds, startSecond, endCount: end};
}

export async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,'0')).join('');
}

export async function decodeVerified(bytes, asset) {
  const compressed = bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const expectedSize = compressed ? asset.bytes : asset.decoded_bytes;
  const expectedHash = compressed ? asset.sha256 : asset.decoded_sha256;
  if (bytes.length !== expectedSize || await sha256(bytes) !== expectedHash) throw Error('Data integrity mismatch');
  let raw = bytes;
  if (compressed) {
    if (!globalThis.DecompressionStream) throw Error('Gzip unsupported in this browser');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    raw = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if (raw.length !== asset.decoded_bytes || await sha256(raw) !== asset.decoded_sha256) throw Error('Decoded integrity mismatch');
  return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(raw));
}

export async function loadVerified(base, asset) {
  if (!/^[A-Za-z0-9_.-]+\.json\.gz$/.test(asset.file) || asset.decoded_bytes > 128_000_000 || asset.bytes > 32_000_000) throw Error('Invalid data file descriptor');
  const response = await fetch(new URL('data/' + asset.file,base), {cache:'no-cache',credentials:'omit',redirect:'error'});
  if (!response.ok) throw Error('Data unavailable: HTTP ' + response.status);
  return decodeVerified(new Uint8Array(await response.arrayBuffer()),asset);
}

export function hhmmss(seconds) {
  const s = Math.max(0,Math.floor(seconds));
  return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,'0')).join(':');
}
