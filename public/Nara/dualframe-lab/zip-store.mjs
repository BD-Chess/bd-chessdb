const encoder = new TextEncoder();
const ZIP32_LIMIT = 0xffffffff;
const ZIP_ENTRY_LIMIT = 0xfffe;
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

async function crc32Of(blob) {
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      for (let i = 0; i < value.length; i++) crc = CRC_TABLE[(crc ^ value[i]) & 0xff] ^ (crc >>> 8);
    }
  } finally {
    reader.releaseLock();
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipName(raw) {
  const name = String(raw ?? '').replace(/\\/g, '/');
  if (!name || name.startsWith('/') || /^[a-z]:/i.test(name) || /[\u0000-\u001f\u007f]/.test(name)) throw Error('ZIP_INVALID_NAME');
  if (name.split('/').some(part => !part || part === '.' || part === '..')) throw Error('ZIP_INVALID_NAME');
  return name;
}

function zipTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return {time, day};
}

function localHeader(name, crc, size, stamp) {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, stamp.time, true);
  view.setUint16(12, stamp.day, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  header.set(name, 30);
  return header;
}

function centralHeader(name, crc, size, stamp, offset) {
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, stamp.time, true);
  view.setUint16(14, stamp.day, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  header.set(name, 46);
  return header;
}

export function collectOrientationAssets(pair, direction) {
  if (!pair || !['landscape', 'portrait'].includes(direction)) return [];
  const jobs = Array.isArray(pair.jobs) ? pair.jobs : [];
  const jobTargets = new Map();
  const jobsById = new Map();
  for (const job of jobs) {
    if (!job || !job.target) continue;
    if (job.job_id) {
      jobTargets.set(job.job_id, job.target);
      jobsById.set(job.job_id, job);
    }
    if (job.candidate?.candidate_id) jobTargets.set(job.candidate.candidate_id, job.target);
  }
  const output = [];
  const seen = new Map();
  const add = (asset, inheritedDirection, quality) => {
    if (!asset || typeof asset !== 'object' || asset.origin === 'original') return;
    const target = asset.direction || asset.target || inheritedDirection || jobTargets.get(asset.candidate_id);
    if (target !== direction || (!asset.blob && !asset.remote_url)) return;
    const hash = typeof asset.sha256 === 'string' && asset.sha256 ? asset.sha256.toLowerCase() : '';
    const model = String(asset.model_key || asset.model || asset.model_or_version || asset.provider || '').toLowerCase();
    const key = hash ? `sha256:${hash}|model:${model}` : asset.blob || `url:${asset.remote_url}`;
    if (seen.has(key)) return;
    const entry = {asset, direction, quality: quality || asset.quality || null};
    seen.set(key, entry);
    output.push(entry);
  };

  for (const [quality, asset] of Object.entries(pair.variants?.[direction] || {})) add(asset, direction, quality);
  for (const asset of Array.isArray(pair.candidates) ? pair.candidates : []) { const job = jobsById.get(asset?.candidate_id); add(asset, job?.target || jobTargets.get(asset?.candidate_id), asset?.quality || job?.quality); }
  for (const job of jobs) if (job?.target === direction) add(job.candidate, direction, job.quality);
  add(pair.web_output, pair.web_output?.direction, pair.web_output?.quality);
  add(pair.reference_output, pair.reference_output?.direction, pair.reference_output?.quality);
  return output;
}

export async function zipStore(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw Error('ZIP_EMPTY');
  if (entries.length > ZIP_ENTRY_LIMIT) throw Error('ZIP_TOO_MANY_FILES');

  const normalized = [];
  const names = new Set();
  let archiveSize = 22;
  for (const entry of entries) {
    if (!entry || !entry.blob || typeof entry.blob.size !== 'number' || typeof entry.blob.stream !== 'function') throw Error('ZIP_INVALID_INPUT');
    const name = zipName(entry.name);
    const encodedName = encoder.encode(name);
    if (!encodedName.length || encodedName.length > ZIP_ENTRY_LIMIT || names.has(name)) throw Error(names.has(name) ? 'ZIP_DUPLICATE_NAME' : 'ZIP_INVALID_NAME');
    if (!Number.isSafeInteger(entry.blob.size) || entry.blob.size < 0 || entry.blob.size > ZIP32_LIMIT) throw Error('ZIP_TOO_LARGE');
    names.add(name);
    archiveSize += 30 + encodedName.length + entry.blob.size + 46 + encodedName.length;
    if (archiveSize > ZIP32_LIMIT) throw Error('ZIP_TOO_LARGE');
    normalized.push({name, encodedName, blob: entry.blob});
  }

  const localParts = [];
  const directoryParts = [];
  const stamp = zipTime(new Date());
  let offset = 0;
  for (const entry of normalized) {
    const crc = await crc32Of(entry.blob);
    const size = entry.blob.size;
    localParts.push(localHeader(entry.encodedName, crc, size, stamp), entry.blob);
    directoryParts.push(centralHeader(entry.encodedName, crc, size, stamp, offset));
    offset += 30 + entry.encodedName.length + size;
  }
  const directoryOffset = offset;
  const directorySize = directoryParts.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, normalized.length, true);
  view.setUint16(10, normalized.length, true);
  view.setUint32(12, directorySize, true);
  view.setUint32(16, directoryOffset, true);
  view.setUint16(20, 0, true);
  return new Blob([...localParts, ...directoryParts, end], {type: 'application/zip'});
}
