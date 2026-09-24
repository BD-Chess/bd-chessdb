/* Frozen ChessDCC evidence. SHA-256 checks integrity, not source authenticity.
 * Replay is deliberately offline: a missing captured query stays missing. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessEvidence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0', SCHEMA = 'chess-evidence/1';
  const MAX_BYTES = 16 * 1024 * 1024;
  const kinds = new Set(['moves', 'pv', 'score', 'transport', 'engine']);
  const own = (v, key) => Object.prototype.hasOwnProperty.call(v, key);
  function canonical(value) {
    if (value === null) return 'null';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Evidence contains a non-finite number. Use null for unknown.');
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(v => canonical(v === undefined ? null : v)).join(',') + ']';
    if (!value || typeof value !== 'object') throw new Error('Evidence must contain JSON values only.');
    return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => {
      if (k === '__proto__' || k === 'prototype' || k === 'constructor') throw new Error('Unsafe evidence key.');
      return JSON.stringify(k) + ':' + canonical(value[k]);
    }).join(',') + '}';
  }
  const copy = value => JSON.parse(canonical(value));
  const bytes = value => new TextEncoder().encode(typeof value==='string'?value:canonical(value)).length;
  // Synchronous SHA-256 keeps memoization identity usable before an async fetch.
  function sha256(message) {
    const bytes = new TextEncoder().encode(message), words = [];
    for (let i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] || 0) | bytes[i] << (24 - i % 4 * 8);
    words[bytes.length >> 2] = (words[bytes.length >> 2] || 0) | 0x80 << (24 - bytes.length % 4 * 8);
    const end = ((bytes.length + 8 >> 6) + 1) * 16;
    words[end - 2] = Math.floor(bytes.length / 0x20000000); words[end - 1] = bytes.length * 8;
    const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const r = (x,n) => x >>> n | x << 32 - n;
    for (let offset = 0; offset < end; offset += 16) {
      const w = new Int32Array(64);
      for (let i = 0; i < 16; i++) w[i] = words[offset + i] || 0;
      for (let i = 16; i < 64; i++) {
        const a = w[i-15], b = w[i-2];
        w[i] = w[i-16] + (r(a,7)^r(a,18)^a>>>3) + w[i-7] + (r(b,17)^r(b,19)^b>>>10);
      }
      let [a,b,c,d,e,f,g,z] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = z + (r(e,6)^r(e,11)^r(e,25)) + (e&f^~e&g) + k[i] + w[i] | 0;
        const t2 = (r(a,2)^r(a,13)^r(a,22)) + (a&b^a&c^b&c) | 0;
        z=g;g=f;f=e;e=d+t1|0;d=c;c=b;b=a;a=t1+t2|0;
      }
      [a,b,c,d,e,f,g,z].forEach((v,i) => { h[i] = h[i] + v | 0; });
    }
    return h.map(v => (v >>> 0).toString(16).padStart(8,'0')).join('');
  }
  const digest = value => sha256(canonical(value));
  function candidateDigest(moves) {
    // Arrival order is significant when a provider omits an explicit rank.
    return digest(Array.isArray(moves) ? moves : []);
  }
  function cacheIdentity({ fen, settings = {}, moves = [], version = null, source = null }) {
    return digest({ fen, settings, candidates: candidateDigest(moves), version, source });
  }
  function validFen(fen) {
    if(typeof fen !== 'string'||fen.length>=160||!/^\S+ [wb] (?:-|[KQkq]+) (?:-|[a-h][36]) \d+ [1-9]\d*$/.test(fen))return false;
    const board=fen.split(' ')[0],rows=board.split('/');
    return rows.length===8&&rows.every(row=>/^[prnbqkPRNBQK1-8]+$/.test(row)&&[...row].reduce((n,c)=>n+(/[1-8]/.test(c)?Number(c):1),0)===8)
      &&(board.match(/k/g)||[]).length===1&&(board.match(/K/g)||[]).length===1&&!/[pP]/.test(rows[0]+rows[7]);
  }
  function validate(snapshot) {
    if (!snapshot || snapshot.schema !== SCHEMA || !snapshot.payload || snapshot.integrity?.algorithm !== 'SHA-256') throw new Error('Unsupported evidence snapshot.');
    const { payload } = snapshot;
    if (!validFen(payload.fen) || !Array.isArray(payload.records) || payload.records.length > 2000) throw new Error('Invalid evidence position or record count.');
    if (bytes(snapshot) > MAX_BYTES) throw new Error('Evidence file exceeds 16 MB.');
    if (digest(payload) !== snapshot.integrity.digest || snapshot.id !== snapshot.integrity.digest) throw new Error('Evidence integrity check failed.');
    const ids = new Set();
    for (const record of payload.records) {
      if (!record || !kinds.has(record.kind) || !validFen(record.fen) || !own(record, 'response') || typeof record.id !== 'string' || ids.has(record.id)) throw new Error('Invalid or duplicate evidence record.');
      ids.add(record.id);
      const body = { ...record }; delete body.id;
      if (digest(body) !== record.id) throw new Error('Source record integrity check failed.');
    }
    return snapshot;
  }
  function seal(payload) {
    payload = copy(payload);
    const id = digest(payload);
    return validate({ schema: SCHEMA, id, payload, integrity: { algorithm: 'SHA-256', digest: id } });
  }
  function createCollector({ maxRecords = 600, maxBytes = 10 * 1024 * 1024 } = {}) {
    const records = []; let size = 0, dropped = 0;
    function capture(input) {
      if (!input || !kinds.has(input.kind) || !validFen(input.fen)) return null;
      const record = copy({ kind: input.kind, fen: input.fen, source: input.source ?? null,
        request: input.request ?? null, response: input.response === undefined ? null : input.response,
        startedAt: input.startedAt ?? null, finishedAt: input.finishedAt ?? null,
        cacheHit: typeof input.cacheHit === 'boolean' ? input.cacheHit : null,
        metadata: input.metadata ?? null });
      record.id = digest(record);
      if (records.some(r => r.id === record.id)) return record.id;
      const sizeBytes = bytes(record);
      if (sizeBytes > maxBytes) { dropped++; return null; }
      records.push(record); size += sizeBytes;
      while (records.length > maxRecords || size > maxBytes) { size -= bytes(records.shift()); dropped++; }
      return record.id;
    }
    function snapshot(analysis, { label = '', settings, sourceVersion = null, createdAt = new Date().toISOString(), fen } = {}) {
      const position = fen || analysis?.receipt?.fen;
      if (!validFen(position)) throw new Error('A full FEN is required to freeze analysis.');
      return seal({ version: VERSION, fen: position, label: String(label).slice(0,160), createdAt,
        settings: settings || analysis?.receipt?.config || {}, sourceVersion,
        analysis: analysis || null, records: records.slice(), droppedRecords: dropped,
        selection: 'captured-response-order-per-kind-and-full-fen',
        metadataPolicy: 'Unknown source metadata remains null. Completeness describes captured coverage, not confidence.' });
    }
    return { capture, snapshot, clear() { records.length = 0; size = 0; dropped = 0; },
      stats() { return { records: records.length, bytes: size, dropped }; } };
  }
  function replay(snapshot, { budget = Infinity, mode = 'sequence' } = {}) {
    validate(snapshot);
    const map = new Map(), cursors = new Map(), misses = [], conflicts = new Set(); let calls = 0, hits = 0, denied = 0;
    for (const record of snapshot.payload.records) {
      if (!['moves','pv','score'].includes(record.kind)) continue;
      const key = record.kind + '|' + record.fen;
      const previous=map.get(key)||[];
      if (previous.length && digest(previous[previous.length-1].response) !== digest(record.response)) conflicts.add(key);
      previous.push(record);map.set(key,previous);
    }
    function request(kind, fen) {
      calls++;
      if (calls > budget) { denied++; return null; }
      const key = kind + '|' + fen, sequence = map.get(key);
      if (!sequence) { misses.push({ kind, fen }); return null; }
      let record=sequence[sequence.length-1];
      if(mode==='sequence'&&conflicts.has(key)){
        const index=cursors.get(key)||0;record=sequence[index];cursors.set(key,index+1);
        if(!record){misses.push({kind,fen,reason:'Captured response sequence exhausted.'});return null;}
      }
      hits++; return copy(record.response);
    }
    return { getMoves: async fen => request('moves',fen), getPV: async fen => request('pv',fen), getScore: async fen => request('score',fen),
      peek(kind,fen) { const r = map.get(kind+'|'+fen); return r ? copy(r[r.length-1].response) : null; },
      stats() { return { calls, hits, denied, misses: copy(misses), conflicts: [...conflicts], budget: Number.isFinite(budget) ? budget : null,
        complete: misses.length === 0 && denied === 0 && (mode==='sequence'||conflicts.size===0), mode,
        networkFallback: false }; } };
  }
  function parse(text) {
    if (typeof text !== 'string' || bytes(text) > MAX_BYTES) throw new Error('Evidence file exceeds 16 MB.');
    return copy(validate(JSON.parse(text)));
  }
  function createStore({ maxItems = 30, maxBytes = MAX_BYTES, indexedDB: suppliedIDB, localStorage: suppliedStorage } = {}) {
    const dbProvider = suppliedIDB === undefined ? globalThis.indexedDB : suppliedIDB;
    let storage = suppliedStorage;
    if (storage === undefined) { try { storage = globalThis.localStorage; } catch (_) { storage = null; } }
    const key = '8zc.pwa.evidence.v1', memory = new Map(); let mode = 'memory', dbPromise, fallbackDegraded=false, databaseFailed=false;
    async function db() {
      if (!dbProvider || databaseFailed) return null;
      if (!dbPromise) dbPromise = new Promise(resolve => {
        let request;
        try { request = dbProvider.open('ChessDCC-pwa-evidence',1); } catch (_) { resolve(null); return; }
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('snapshots')) request.result.createObjectStore('snapshots',{ keyPath:'id' }); };
        request.onsuccess = () => { mode='indexedDB'; resolve(request.result); };
        request.onerror = request.onblocked = () => resolve(null);
      });
      return dbPromise;
    }
    async function idbAll(database) {
      return new Promise((resolve,reject) => {
        const req=database.transaction('snapshots','readonly').objectStore('snapshots').getAll();
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
    }
    function fallbackRead() {
      if (storage && !fallbackDegraded) {
        try { const items=JSON.parse(storage.getItem(key)||'[]'); if(Array.isArray(items)) { mode='localStorage'; memory.clear();items.forEach(i=>{if(i?.id)memory.set(i.id,i);});return items; } } catch (_) { fallbackDegraded=true;mode='memory'; }
      }
      return [...memory.values()];
    }
    async function all() {
      let items;
      try { const database=await db(); items=database ? await idbAll(database) : fallbackRead(); } catch (_) { databaseFailed=true;items=fallbackRead(); }
      return items.filter(item=>{ try { validate(item);return true; } catch (_) { return false; } });
    }
    function trim(items,keepId) {
      items.sort((a,b)=>String(b.payload.createdAt).localeCompare(String(a.payload.createdAt)) || a.id.localeCompare(b.id));
      if(keepId){const index=items.findIndex(item=>item.id===keepId);if(index>0)items.unshift(...items.splice(index,1));}
      const kept=[]; let size=0;
      for(const item of items) { const n=bytes(item); if(kept.length<maxItems && size+n<=maxBytes) { kept.push(item);size+=n; } }
      return kept;
    }
    let queue = Promise.resolve();
    function mutate(fn,keepId) {
      const work=queue.then(async()=>{
        const items=trim(fn(await all()),keepId);
        let database; try { database=await db(); } catch (_) { database=null; }
        if(database) {
          try { await new Promise((resolve,reject)=>{ const tx=database.transaction('snapshots','readwrite'), object=tx.objectStore('snapshots');object.clear();items.forEach(i=>object.put(i));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error); });mode='indexedDB';return; } catch (_) { databaseFailed=true; }
        }
        memory.clear();items.forEach(i=>memory.set(i.id,i));mode='memory';
        if(storage) {
          try { if(items.length)storage.setItem(key,canonical(items));else storage.removeItem(key);fallbackDegraded=false;mode='localStorage';return; }
          catch (_) { fallbackDegraded=true;mode='memory'; }
        }
      });
      queue=work.catch(()=>{});return work;
    }
    return { async put(snapshot) { validate(snapshot);if(bytes(snapshot)>maxBytes) throw new Error('Snapshot exceeds local storage budget.');await mutate(items=>[copy(snapshot),...items.filter(i=>i.id!==snapshot.id)],snapshot.id);return { id:snapshot.id,mode,persistent:mode!=='memory' }; },
      async list() { return (await all()).sort((a,b)=>String(b.payload.createdAt).localeCompare(String(a.payload.createdAt))).map(s=>({id:s.id,fen:s.payload.fen,label:s.payload.label,createdAt:s.payload.createdAt,records:s.payload.records.length,bytes:bytes(s)})); },
      async get(id) { return (await all()).find(s=>s.id===id)||null; },
      remove(id) { return mutate(items=>items.filter(s=>s.id!==id)); },
      status() { return { mode,persistent:mode!=='memory',maxItems,maxBytes }; } };
  }
  return { VERSION, SCHEMA, canonical, digest, candidateDigest, cacheIdentity, validFen, validate, seal, parse, createCollector, replay, createStore };
});
