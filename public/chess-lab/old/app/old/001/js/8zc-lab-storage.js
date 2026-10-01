/* Browser APP preview starts with its own empty namespace. It never copies
 * CURRENT, LAB, Safari, or native data. Web Locks guard concurrent tabs. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.document) root.ChessLabStorage = api.create();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const PREFIX = 'ChessBest:APP:v1:';
  const names = ['settings', 'game', 'eval-cache', 'top-pick', 'timing', 'layout',
    'studies', 'studies-recovery', 'evidence-fallback', 'sim-fallback',
    'sim-checkpoint', 'sim-lease', 'lichess-token', 'anthropic-token'];
  const KEYS = Object.freeze(Object.fromEntries(names.map(name =>
    [name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), PREFIX + name])));
  const DATABASES = Object.freeze({
    evidence: PREFIX + 'evidence', sim: PREFIX + 'sim', health: PREFIX + 'health'
  });

  function create(options = {}) {
    let state = { phase: 'checking', complete: false, error: '' };
    const status = () => ({ ...state });
    function showFailure() {
      if (!root.document?.body) return;
      let panel = root.document.getElementById('appStorageProblem');
      if (!panel) {
        panel = root.document.createElement('section');
        panel.id = 'appStorageProblem';
        panel.setAttribute('role', 'alert');
        panel.style.cssText = 'position:fixed;inset:1rem;z-index:2147483647;max-width:44rem;max-height:80vh;margin:auto;padding:1.5rem;overflow:auto;background:#172033;color:#f7f9ff;border:2px solid #e9b949;border-radius:1rem;font:16px/1.5 system-ui;box-shadow:0 0 0 100vmax #080d18ed';
        const title = root.document.createElement('h2');
        title.textContent = 'APP preview storage needs attention';
        const detail = root.document.createElement('p');
        detail.className = 'app-storage-error';
        const help = root.document.createElement('p');
        help.textContent = 'The APP preview has not started. Existing data was retained. Enable local storage, IndexedDB and Web Locks, then reload.';
        panel.append(title, detail, help);
        root.document.body.appendChild(panel);
      }
      panel.querySelector('.app-storage-error').textContent = state.error;
    }
    async function check() {
      // These references can throw when browser storage has been disabled.
      const storage = options.localStorage === undefined ? root.localStorage : options.localStorage;
      const idb = options.indexedDB === undefined ? root.indexedDB : options.indexedDB;
      const locks = options.locks === undefined ? root.navigator?.locks : options.locks;
      if (!storage || !idb || !locks?.request)
        throw Error('Local storage, IndexedDB and Web Locks are required for isolated APP saves.');

      const probe = PREFIX + 'probe-' + Math.random().toString(36).slice(2);
      try {
        storage.setItem(probe, 'verified');
        if (storage.getItem(probe) !== 'verified') throw Error('APP localStorage readback failed.');
      } finally {
        storage.removeItem(probe);
      }
      await new Promise((resolve, reject) => {
        let done = false, db = null;
        const finish = error => {
          if (done) return;
          done = true; clearTimeout(timer); db?.close();
          error ? reject(error) : resolve();
        };
        const timer = setTimeout(() => finish(Error('APP IndexedDB readiness timed out.')), 8000);
        let request;
        try { request = idb.open(DATABASES.health, 1); }
        catch (error) { finish(error); return; }
        request.onupgradeneeded = () => {
          try {
            if (!request.result.objectStoreNames.contains('probe')) request.result.createObjectStore('probe');
          } catch (error) { finish(error); request.transaction?.abort(); }
        };
        request.onerror = request.onblocked = () => finish(Error('APP IndexedDB open failed or is blocked.'));
        request.onsuccess = () => {
          db = request.result;
          if (done) { db.close(); return; }
          try {
            const transaction = db.transaction('probe', 'readwrite');
            const entries = transaction.objectStore('probe');
            const key = Math.random().toString(36).slice(2);
            entries.put('verified', key);
            const read = entries.get(key);
            read.onsuccess = () => {
              if (read.result !== 'verified') { transaction.abort(); return; }
              entries.delete(key);
            };
            transaction.oncomplete = () => finish();
            transaction.onerror = transaction.onabort = () => finish(Error('APP IndexedDB readback failed.'));
          } catch (error) { finish(error); }
        };
      });
      state = { phase: 'ready', complete: true, error: '' };
      return status();
    }
    const ready = check().catch(error => {
      state = { phase: 'blocked', complete: false, error: error?.message || String(error) };
      showFailure();
      throw error;
    });
    ready.catch(() => {});
    return { KEYS, DATABASES, ready, status, showFailure };
  }
  return { PREFIX, KEYS, DATABASES, create };
});
