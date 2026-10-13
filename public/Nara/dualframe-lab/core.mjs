// DualFrame AI LAB v1.0. Concept: Bojan Dobrečevič (BD). Implementation: GPT Work.
export const SCHEMA = 'bd.dualframe.pair.v1';
export const MAX_BYTES = 12 * 1024 * 1024;
export const MAX_PIXELS = 24000000;
export const RATIOS = { landscape: '16:9', portrait: '9:16' };
export const opposite = source => source === 'portrait' ? 'landscape' : 'portrait';
export const orientation = (w, h) => h > w ? 'portrait' : 'landscape';
export async function sha256(value) {
  const data = typeof value === 'string' ? new TextEncoder().encode(value) : value instanceof Blob ? await value.arrayBuffer() : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function geometry(w, h, target, position = 'center', hd = true) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || !RATIOS[target]) throw Error('INVALID_GEOMETRY');
  const [a, b] = target === 'landscape' ? [16, 9] : [9, 16];
  const unit = Math.max(Math.ceil(w / a), Math.ceil(h / b), hd ? 120 : 1);
  const width = a * unit, height = b * unit;
  if (width * height > MAX_PIXELS) throw Error('CANVAS_PIXEL_LIMIT');
  const x = position === 'left' ? 0 : position === 'right' ? width - w : Math.floor((width - w) / 2);
  const y = position === 'top' ? 0 : position === 'bottom' ? height - h : Math.floor((height - h) / 2);
  return { width, height, x, y, source_width: w, source_height: h, scale: 1, no_crop: true };
}
export function deviceOrientation({ device = 'desktop', width = 1280, height = 720, override = 'auto', simulation = 'auto', tablet = 'viewport' } = {}) {
  if (['portrait', 'landscape', 'original'].includes(override)) return override;
  if (simulation === 'phone-p') return 'portrait';
  if (simulation === 'phone-l' || simulation === 'desktop') return 'landscape';
  if (device === 'phone' || (device === 'tablet' && tablet === 'viewport')) return orientation(width, height);
  return 'landscape';
}
export function selectAsset(pair, target, quality = 'hd', dpr = 1) {
  if (target === 'original') return { asset: pair.original, orientation: pair.original.source_orientation, quality: 'original', missing: false };
  const branch = pair.variants[target];
  const wanted = quality === 'auto' ? (dpr > 1.5 && branch?.fourK?.resolution_verified ? '4k' : 'hd') : quality;
  if (wanted === '4k' && branch?.fourK?.resolution_verified) return { asset: branch.fourK, orientation: target, quality: '4k', missing: false };
  if (branch?.hd) return { asset: branch.hd, orientation: target, quality: 'hd', missing: wanted === '4k' };
  return { asset: pair.original, orientation: pair.original.source_orientation, quality: 'original', missing: true };
}
export function sniff(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length >= 24 && [137,80,78,71,13,10,26,10].every((n,i) => b[i] === n)) return 'image/png';
  if (b.length >= 12 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 30 && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP') return 'image/webp';
  throw Error('UNSUPPORTED_OR_CORRUPT');
}
export function headerSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), d = new DataView(b.buffer, b.byteOffset, b.byteLength), mime = sniff(b);
  let w, h;
  if (mime === 'image/png') { w = d.getUint32(16); h = d.getUint32(20); }
  if (mime === 'image/webp') {
    const type = String.fromCharCode(...b.slice(12,16));
    if (type === 'VP8X') { w = 1 + b[24] + (b[25]<<8) + (b[26]<<16); h = 1 + b[27] + (b[28]<<8) + (b[29]<<16); }
    else if (type === 'VP8L' && b[20] === 47) { const v = d.getUint32(21,true); w = (v & 16383) + 1; h = ((v >>> 14) & 16383) + 1; }
    else if (type === 'VP8 ' && b[23] === 157 && b[24] === 1 && b[25] === 42) { w = d.getUint16(26,true)&16383; h = d.getUint16(28,true)&16383; }
  }
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i] !== 255) throw Error('UNSUPPORTED_OR_CORRUPT');
      while (b[i] === 255) i++;
      const m = b[i++];
      if (m === 217 || m === 218) break;
      if (m === 1 || (m >= 208 && m <= 215)) continue;
      if (i + 2 > b.length) break;
      const len = d.getUint16(i);
      if (len < 2 || i + len > b.length) throw Error('UNSUPPORTED_OR_CORRUPT');
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m)) { h = d.getUint16(i+3); w = d.getUint16(i+5); break; }
      i += len;
    }
  }
  if (!w || !h || w * h > MAX_PIXELS) throw Error(w && h ? 'IMAGE_PIXEL_LIMIT' : 'UNSUPPORTED_OR_CORRUPT');
  return { width: w, height: h, mime };
}
export const TRANSITIONS = { PENDING:['RUNNING','CANCELLED','HELD','FAILED'], RUNNING:['READY','FAILED','CANCELLED','HELD'], READY:['ACCEPTED','REJECTED'], FAILED:[], CANCELLED:[], HELD:[], ACCEPTED:[], REJECTED:[] };
export function transition(job, next) {
  if (!TRANSITIONS[job.status]?.includes(next)) throw Error('INVALID_STATE_TRANSITION');
  return { ...job, status: next, updated_at: new Date().toISOString() };
}
export function publicManifest(pair) {
  return JSON.parse(JSON.stringify(pair, (key,value) => ['blob','normalized','thumbnail','candidate','url','upload_id','gateway_job_id'].includes(key) ? undefined : value));
}
export function checkPair(pair) {
  if (pair.schema !== SCHEMA || !/^[a-zA-Z0-9_-]{8,100}$/.test(pair.pair_id) || !/^[a-f0-9]{64}$/.test(pair.original?.sha256)) throw Error('INVALID_MANIFEST');
  if (pair.original.visibility !== 'private') throw Error('PRIVATE_REQUIRED');
  for (const direction of ['portrait','landscape']) for (const [q,a] of Object.entries(pair.variants[direction] || {})) {
    if (!['hd','fourK'].includes(q) || !/^[a-f0-9]{64}$/.test(a.sha256) || orientation(a.width,a.height) !== direction || !a.path || a.width*a.height > MAX_PIXELS) throw Error('INVALID_VARIANT');
    if (q === 'fourK' && (!a.resolution_verified || Math.max(a.width,a.height) < 3840 || Math.min(a.width,a.height) < 2160 || !['native','upscaled'].includes(a.resolution_origin))) throw Error('UNVERIFIED_4K');
  }
  return true;
}
export function comparisonEligibility(pair, web, reference, review = 'equal-canvas-v1') {
  const target = opposite(pair.original.source_orientation), ratio = RATIOS[target];
  const reasons = [];
  for (const output of [web,reference]) {
    if (!output) { reasons.push('MISSING_OUTPUT'); continue; }
    if (!/^[a-f0-9]{64}$/.test(output.sha256 || '')) reasons.push('INVALID_OUTPUT_HASH');
    const validDimensions = Number.isInteger(output.width) && Number.isInteger(output.height) && output.width > 0 && output.height > 0 && output.width * output.height <= MAX_PIXELS;
    if (output.source_sha256 !== pair.original.sha256 || output.lineage_status !== 'SOURCE_VERIFIED') reasons.push('SOURCE_UNVERIFIED');
    if (!validDimensions || output.direction !== target || output.target_ratio !== ratio || Math.abs(output.width / output.height - (target === 'landscape' ? 16/9 : 9/16)) > .003) reasons.push('GEOMETRY_MISMATCH');
    if (output.review_scale_policy !== review) reasons.push('SCALE_POLICY_MISMATCH');
    if (output.provider === 'demo' || output.origin === 'demo' || output.resolution_origin === 'simulation') reasons.push('DEMO_ONLY');
  }
  if (pair.original.demo_fixture) reasons.push('DEMO_ONLY');
  return { eligible: reasons.length === 0, classification: reasons.length ? 'ILLUSTRATIVE_ONLY' : 'SOURCE_VERIFIED', reasons: [...new Set(reasons)] };
}
export async function blindOrder(pairId, seed, outputHashes) {
  const digest = await sha256([pairId,seed,...outputHashes].join('|'));
  return parseInt(digest.slice(0,2),16) % 2 ? ['reference','web'] : ['web','reference'];
}
export function csv(rows) {
  if (!rows.length) return 'comparison_id,original_sha256,eligible\r\n';
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const quote = v => {
    let text = String(v ?? '');
    if (/^[=+@-]/.test(text)) text = "'" + text; // Spreadsheet formula injection guard.
    return '"' + text.replaceAll('"','""') + '"';
  };
  return [keys.map(quote).join(','),...rows.map(r => keys.map(k=>quote(typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k])).join(','))].join('\r\n');
}
