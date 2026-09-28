/* One native scene owns one WKWebView. This queue is NOT a cross-tab Web Locks polyfill. */
(function (root) {
  'use strict';
  const PREFIX = 'ChessBest:APP:v1:';
  function sceneLocks() {
    const tails = new Map();
    return { kind: 'single-native-scene', request(name, options, callback) {
      if (typeof options === 'function') { callback = options; options = {}; }
      if (!callback || (options?.mode && options.mode !== 'exclusive')) return Promise.reject(Error('Only exclusive native writes are supported'));
      const signal = options?.signal;
      if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
      const previous = tails.get(name) || Promise.resolve();
      const result = previous.then(() => {
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        return callback({ name, mode: 'exclusive' });
      });
      const settled = result.catch(() => {});
      tails.set(name, settled);
      settled.finally(() => { if (tails.get(name) === settled) tails.delete(name); });
      return result;
    } };
  }
  root.ChessNativeStorageAPI = { sceneLocks };
  const locks = root.navigator?.locks || sceneLocks();
  root.ChessNativeLocks = locks;
  const names = ['settings','game','eval-cache','top-pick','timing','layout','studies','studies-recovery','evidence-fallback','evidence-legacy-fallback','sim-fallback','sim-legacy-fallback','sim-checkpoint','sim-legacy-checkpoint','sim-lease','lichess-token','anthropic-token','migration','sim-fallback-origin'];
  const KEYS = Object.freeze(Object.fromEntries(names.map(n => [n.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), PREFIX + n])));
  const DATABASES = Object.freeze({ evidence: PREFIX + 'evidence', sim: PREFIX + 'sim' });
  let state = { phase: 'checking', complete: false, stage: 'native storage', error: '' };
  function showFailure() {
    if (!root.document?.body) return;
    let p = root.document.getElementById('labStorageProblem');
    if (!p) { p = root.document.createElement('p'); p.id = 'labStorageProblem'; p.setAttribute('role','alert'); root.document.body.prepend(p); }
    p.textContent = 'ChessBest storage is unavailable. Existing data was retained. ' + state.error;
  }
  async function check() {
    if (root.localStorage.getItem(PREFIX+'delete-request') === 'yes') {
      for (const name of [DATABASES.evidence,DATABASES.sim,PREFIX+'health']) await new Promise((resolve,reject)=> {
        const timer=setTimeout(()=>reject(Error('Deletion blocked; restart the app to retry')),8000);
        const q=root.indexedDB.deleteDatabase(name);
        q.onsuccess=()=>{clearTimeout(timer);resolve();};
        q.onerror=q.onblocked=()=>{clearTimeout(timer);reject(Error('Deletion blocked; restart the app to retry'));};
      });
      for (const key of Object.keys(root.localStorage)) if(key.startsWith(PREFIX) && key!==PREFIX+'delete-request') root.localStorage.removeItem(key);
      root.localStorage.removeItem(PREFIX+'delete-request');
    }
    // Local namespace only: no Safari keys, legacy databases, or credentials are read.
    const key = PREFIX + 'probe';
    root.localStorage.setItem(key, 'verified');
    if (root.localStorage.getItem(key) !== 'verified') throw Error('localStorage readback failed');
    root.localStorage.removeItem(key);
    await new Promise((resolve, reject) => {
      let done = false;
      const finish = error => { if (done) return; done = true; clearTimeout(timer); error ? reject(error) : resolve(); };
      const timer = setTimeout(() => finish(Error('IndexedDB readiness timed out')), 8000);
      if (!root.indexedDB) return finish(Error('IndexedDB is unavailable'));
      const request = root.indexedDB.open(PREFIX + 'health', 1);
      request.onupgradeneeded = () => { if (done) request.transaction.abort(); else request.result.createObjectStore('probe'); };
      request.onerror = request.onblocked = () => finish(Error('IndexedDB open failed or blocked'));
      request.onsuccess = () => {
        const db = request.result;
        if (done) { db.close(); return; }
        const tx = db.transaction('probe', 'readwrite');
        tx.objectStore('probe').put('verified','probe');
        tx.onerror = tx.onabort = () => { db.close(); finish(Error('IndexedDB write failed')); };
        tx.oncomplete = () => {
          const read = db.transaction('probe','readwrite'); let valid = false;
          const q = read.objectStore('probe').get('probe');
          q.onsuccess = () => { valid = q.result === 'verified'; read.objectStore('probe').delete('probe'); };
          read.oncomplete = () => { db.close(); finish(valid ? null : Error('IndexedDB readback failed')); };
          read.onerror = read.onabort = () => { db.close(); finish(Error('IndexedDB readback failed')); };
        };
      };
    });
    state = { phase: 'ready', complete: true, stage: '', error: '', serialization: locks.kind || 'Web Locks' };
    return { ...state };
  }
  const ready = check().catch(error => { state = { ...state, phase: 'blocked', error: error.message }; showFailure(); throw error; });
  ready.catch(() => {});
  root.ChessLabStorage = { KEYS, DATABASES, ready, status: () => ({ ...state }), showFailure };
})(globalThis);
