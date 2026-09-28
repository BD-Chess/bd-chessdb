/* PWA first-run COPY migration. Earlier PWA keys/databases are strictly read-only.
 * The boot gate stays closed on incomplete migration; retries resume receipts.
 * Namespaces isolate data, not the browser origin's shared storage quota. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    const manager = api.create();
    root.ChessLabStorage = Object.assign(manager, { KEYS: api.KEYS, DATABASES: api.DATABASES });
    manager.ready.catch(() => manager.showFailure());
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const PREFIX = 'ChessBest:PWA:v2:';
  const KEYS = Object.freeze(Object.fromEntries(['settings', 'game', 'eval-cache', 'top-pick', 'timing', 'layout', 'studies', 'studies-recovery', 'evidence-fallback', 'evidence-legacy-fallback', 'sim-fallback', 'sim-legacy-fallback', 'sim-checkpoint', 'sim-legacy-checkpoint', 'sim-lease', 'lichess-token', 'anthropic-token', 'migration', 'sim-fallback-origin'].map(name => [name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), PREFIX + name])));
  const DATABASES = Object.freeze({ evidence: PREFIX + 'evidence', sim: PREFIX + 'sim' });
  const LOCAL = Object.freeze([
    ['chessPwaLabSettings-v1', KEYS.settings], ['chessPwaLabGame-v1', KEYS.game],
    ['chessPwaLabEvalCache-v1', KEYS.evalCache], ['chessPwaLabTopPickCursor-v1', KEYS.topPick],
    ['chessPwaLabTiming-v1', KEYS.timing], ['8zc-pwa-lab-layout-v1', KEYS.layout],
    ['chessPwaLabStudy-v1', KEYS.studies], ['chessPwaLabStudy-v1-recovery', KEYS.studiesRecovery],
    ['8zc.pwa.evidence.v1', KEYS.evidenceFallback], ['ChessBest-pwa-sim-v1-fallback', KEYS.simFallback],
    ['chessPwaLabLichessToken-v1', KEYS.lichessToken], ['chessPwaLabAnthropicKey-v1', KEYS.anthropicToken]
  ]);
  const SPECS = Object.freeze([
    { old: 'ChessDCC-pwa-evidence', name: DATABASES.evidence, stores: ['snapshots'], fallback: KEYS.evidenceFallback, retainedFallback: KEYS.evidenceLegacyFallback },
    { old: 'ChessBest-pwa-sim-v1', name: DATABASES.sim, stores: ['runs', 'events'], fallback: KEYS.simFallback, retainedFallback: KEYS.simLegacyFallback }
  ]);
  function create(options = {}) {
    let storage = options.localStorage;
    if (storage === undefined) { try { storage = root.localStorage; } catch (_) {} }
    const idb = options.indexedDB === undefined ? root.indexedDB : options.indexedDB;
    const locks = options.locks === undefined ? root.navigator?.locks : options.locks;
    const timeoutMs = options.timeoutMs || 10000;
    let current = { phase: 'waiting', complete: false, stage: '', attempts: 0, warnings: [], error: '' }, inFlight;
    const status = () => ({ ...current, warnings: [...current.warnings] });
    function fail(message) { throw Error(message); }
    function readJournal() {
      if (!storage) fail('Browser localStorage is unavailable. No PWA writes were enabled.');
      const text = storage.getItem(KEYS.migration);
      if (text === null) return { version: 1, complete: false, local: {}, databases: {}, checkpoint: false, warnings: [] };
      let value;
      try { value = JSON.parse(text); } catch (_) { fail('The PWA migration receipt is unreadable. It was retained for recovery.'); }
      if (!value || value.version !== 1 || !value.local || !value.databases || !Array.isArray(value.warnings)) fail('The PWA migration receipt is unsupported. It was retained for recovery.');
      return value;
    }
    function writeJournal(journal) {
      const text = JSON.stringify(journal);
      storage.setItem(KEYS.migration, text);
      if (storage.getItem(KEYS.migration) !== text) fail('PWA migration receipt readback failed.');
    }
    function copyLocal(journal, source, target) {
      const resuming = journal.local[target] === 'copying';
      if (Object.hasOwn(journal.local, target) && !resuming) return;
      current.stage = target;
      let result = resuming ? 'copied' : 'preserved';
      if (storage.getItem(target) === null) {
        const value = storage.getItem(source);
        result = value === null ? 'absent' : 'copied';
        if (value !== null) {
          // Persist intent first. A crash after the copy but before its receipt
          // must not misclassify this copied fallback as pre-existing PWA data.
          journal.local[target] = 'copying'; writeJournal(journal);
          if (target === KEYS.simFallback) {
            storage.setItem(KEYS.simFallbackOrigin, 'legacy-copy');
            if (storage.getItem(KEYS.simFallbackOrigin) !== 'legacy-copy') fail('Fallback origin readback failed.');
          }
          // No await between check and write; the outer Web Lock serializes tabs.
          storage.setItem(target, value);
          if (storage.getItem(target) !== value) fail('PWA data copy readback failed.');
        }
      }
      // Receipts contain names and outcomes only, never token values or hashes.
      journal.local[target] = result;
      writeJournal(journal);
    }
    async function names() {
      if (!idb) fail('IndexedDB is unavailable, so existing archives cannot be verified. No PWA writes were enabled.');
      if (typeof idb.databases !== 'function') return null;
      const list = await idb.databases();
      return new Set(list.map(item => item.name));
    }
    async function openExisting(name) {
      const existing = await names();
      if (existing && !existing.has(name)) return null;
      return new Promise((resolve, reject) => {
        let settled = false, missing = false;
        const request = idb.open(name); // Deliberately no version: never upgrade a legacy DB.
        const timer = setTimeout(() => finish(Error('Archive discovery timed out. Close other chess tabs and retry.')), timeoutMs);
        function finish(error, db) {
          if (settled) { db?.close(); return; }
          settled = true; clearTimeout(timer); error ? reject(error) : resolve(db || null);
        }
        request.onupgradeneeded = () => {
          // Older browsers lack databases(). Abort the missing-DB probe before
          // creating a schema; IndexedDB rolls back this provisional database.
          missing = true; request.transaction.abort();
        };
        request.onsuccess = () => finish(null, request.result);
        request.onerror = () => missing ? finish(null, null) : finish(request.error || Error('Could not read an existing archive.'));
        request.onblocked = () => finish(Error('Archive discovery is blocked by another tab.'));
      });
    }
    function all(db, stores) {
      return new Promise((resolve, reject) => {
        if (stores.some(name => !db.objectStoreNames.contains(name))) { reject(Error('An existing archive has an unsupported schema. It was retained.')); return; }
        const result = {}, tx = db.transaction(stores, 'readonly');
        for (const name of stores) {
          const request = tx.objectStore(name).getAll();
          request.onsuccess = () => { result[name] = request.result; };
        }
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(tx.error || Error('Could not read the existing archive.'));
      });
    }
    function openTarget(spec) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const request = idb.open(spec.name, 1);
        const timer = setTimeout(() => finish(Error('PWA archive creation timed out.')), timeoutMs);
        function finish(error, db) {
          if (settled) { db?.close(); return; }
          settled = true; clearTimeout(timer); error ? reject(error) : resolve(db);
        }
        request.onupgradeneeded = () => {
          if (settled) { request.transaction.abort(); return; }
          for (const name of spec.stores) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
        };
        request.onsuccess = () => finish(null, request.result);
        request.onerror = () => finish(request.error || Error('Could not create PWA archive.'));
        request.onblocked = () => finish(Error('PWA archive creation is blocked by another tab.'));
      });
    }
    function addMissing(db, stores, records) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite'), expected = {};
        for (const name of stores) {
          const object = tx.objectStore(name); expected[name] = [];
          for (const value of records[name]) {
            if (value?.id == null) { tx.abort(); reject(Error('Legacy archive record has no ID.')); return; }
            const request = object.get(value.id);
            request.onsuccess = () => {
              if (request.result === undefined) { object.add(value); expected[name].push(value); }
            };
          }
        }
        tx.oncomplete = () => resolve(expected);
        tx.onerror = tx.onabort = () => reject(tx.error || Error('PWA archive copy did not commit.'));
      });
    }
    async function copyDatabase(journal, spec) {
      if (Object.hasOwn(journal.databases, spec.name)) return;
      current.stage = spec.name;
      let source, target;
      try {
        source = await openExisting(spec.old);
        const records = source ? await all(source, spec.stores) : Object.fromEntries(spec.stores.map(name => [name, []]));
        const copiedFallback = journal.local[spec.fallback] === 'copied';
        if (copiedFallback) {
          let value;
          try { value = JSON.parse(storage.getItem(spec.fallback)); } catch (_) { fail('The copied legacy archive fallback is unreadable. It was retained.'); }
          const fallback = spec.name === DATABASES.evidence ? { snapshots: value } : value;
          if (!fallback || spec.stores.some(name => !Array.isArray(fallback[name]))) fail('The copied legacy archive fallback is unsupported. It was retained.');
          for (const name of spec.stores) {
            const combined = new Map(records[name].map(item => [item.id, item]));
            for (const item of fallback[name]) {
              const previous = combined.get(item?.id);
              // Reconcile the two LEGACY representations before copying them.
              // Existing PWA IDs still win unconditionally in addMissing().
              const incomingAt = Date.parse(item?.updatedAt || item?.startedAt || item?.createdAt || '');
              const previousAt = Date.parse(previous?.updatedAt || previous?.startedAt || previous?.createdAt || '');
              if (!previous || (spec.name === DATABASES.sim && Number.isFinite(incomingAt) && (!Number.isFinite(previousAt) || incomingAt > previousAt))) combined.set(item?.id, item);
            }
            records[name] = [...combined.values()];
          }
        }
        const existingLabFallback = journal.local[spec.fallback] === 'preserved' && storage.getItem(spec.fallback) !== null;
        if (!source && !copiedFallback && !existingLabFallback) { journal.databases[spec.name] = { state: 'absent', copied: 0 }; writeJournal(journal); return; }
        target = await openExisting(spec.name);
        if (target) {
          const currentRecords = await all(target, spec.stores);
          // A pre-existing, intentionally empty PWA database is valid state.
          // Never refill it from previous PWA storage. Successful receipts also prevent
          // deleted records returning after any subsequent reload.
          if (spec.stores.every(name => currentRecords[name].length === 0) && !journal.startedDatabases?.[spec.name]) {
            journal.databases[spec.name] = { state: 'preserved-empty', copied: 0 }; writeJournal(journal); return;
          }
        } else {
          // A prior PWA that used localStorage fallback already owns its IDs
          // (and a deliberately empty archive), even without an IndexedDB DB.
          if (existingLabFallback) {
            let value;
            try { value = JSON.parse(storage.getItem(spec.fallback)); } catch (_) { fail('Existing PWA archive fallback is unreadable. It was preserved.'); }
            const saved = spec.name === DATABASES.evidence ? { snapshots: value } : value;
            if (!saved || spec.stores.some(name => !Array.isArray(saved[name]))) fail('Existing PWA archive fallback is unsupported. It was preserved.');
            if (spec.stores.every(name => saved[name].length === 0)) {
              journal.databases[spec.name] = { state: 'preserved-empty-fallback', copied: 0 }; writeJournal(journal); return;
            }
            for (const name of spec.stores) {
              const combined = new Map(records[name].map(item => [item.id, item]));
              for (const item of saved[name]) combined.set(item?.id, item);
              records[name] = [...combined.values()];
            }
          }
          journal.startedDatabases ||= {}; journal.startedDatabases[spec.name] = true; writeJournal(journal);
          target = await openTarget(spec);
        }
        const expected = await addMissing(target, spec.stores, records);
        const actual = await all(target, spec.stores);
        for (const name of spec.stores) {
          const byId = new Map(actual[name].map(value => [value.id, value]));
          for (const value of expected[name]) if (JSON.stringify(byId.get(value.id)) !== JSON.stringify(value)) fail('PWA archive readback failed.');
        }
        journal.databases[spec.name] = { state: 'copied', copied: spec.stores.reduce((n, name) => n + expected[name].length, 0) };
        writeJournal(journal);
      } finally { source?.close(); target?.close(); }
    }
    async function checkpoint(journal) {
      if (journal.checkpoint) return;
      current.stage = KEYS.simCheckpoint;
      const source = storage.getItem('ChessBest-pwa-sim-v1-checkpoint');
      if (source !== null) {
        // Always retain the exact snapshot separately for explicit recovery.
        copyLocal(journal, 'ChessBest-pwa-sim-v1-checkpoint', KEYS.simLegacyCheckpoint);
        let lease, payload;
        try { lease = JSON.parse(storage.getItem('chessPwaSimRunnerLease-v1') || 'null'); payload = JSON.parse(source); }
        catch (_) { journal.warnings.push('The legacy simulation checkpoint needs manual review; its copy was retained.'); }
        const valid = payload?.schema === 'chess-sim-checkpoint' && payload.version === 1 && Array.isArray(payload.records) && payload.records.length <= 2 && Number.isFinite(Date.parse(payload.savedAt));
        const active = lease && Number(lease.expires) > Date.now();
        if (valid && !active && journal.freshSimulation && storage.getItem(KEYS.simCheckpoint) === null) {
          storage.setItem(KEYS.simCheckpoint, source);
          if (storage.getItem(KEYS.simCheckpoint) !== source) fail('Simulation checkpoint copy readback failed.');
        } else if (active) journal.warnings.push('A legacy simulation is still running. Its checkpoint copy is retained for review; PWA will not take over that runner.');
        else if (valid && !journal.freshSimulation) journal.warnings.push('Existing PWA simulation data was preserved; the legacy checkpoint is retained separately for review.');
      }
      journal.checkpoint = true; writeJournal(journal);
    }
    async function migrate() {
      const quick = readJournal();
      if (quick.complete) { current = { ...current, complete: true, phase: 'ready', stage: '', warnings: quick.warnings, error: '' }; return status(); }
      if (!locks?.request) fail('Web Locks are unavailable. Use a browser with Web Locks to safely copy PWA data across tabs. Existing data is unchanged.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await locks.request(KEYS.studies, { mode: 'exclusive', signal: controller.signal }, async () => {
          clearTimeout(timeout);
          const journal = readJournal();
          if (!journal.complete) {
            if (!Object.hasOwn(journal, 'freshSimulation')) {
              journal.emptyArchives = {};
              for (const spec of SPECS) {
                const existing = await openExisting(spec.name);
                try {
                  if (existing) {
                    const values = await all(existing, spec.stores);
                    journal.emptyArchives[spec.name] = spec.stores.every(name => values[name].length === 0);
                  }
                  if (spec.name === DATABASES.sim) journal.freshSimulation = !existing && storage.getItem(KEYS.simFallback) === null && storage.getItem(KEYS.simCheckpoint) === null;
                } finally { existing?.close(); }
              }
              writeJournal(journal);
            }
            for (const [source, target] of LOCAL) {
              const spec = SPECS.find(item => item.fallback === target);
              // Retain a legacy fallback separately when PWA already has a
              // deliberately empty archive; do not reactivate deleted records.
              const destination = spec && journal.emptyArchives?.[spec.name] && storage.getItem(target) === null ? spec.retainedFallback : target;
              // Older PWA ES modules used chessPwaLegacy* before the
              // workspace used chessPwaLab*. Prefer the modern source when
              // present, without moving either earlier PWA record.
              const earlier = target === KEYS.settings ? 'chessPwaLegacySettings-v1'
                : target === KEYS.game ? 'chessPwaLegacyGame-v1' : null;
              const chosen = earlier && storage.getItem(source) === null
                && storage.getItem(earlier) !== null ? earlier : source;
              copyLocal(journal, chosen, destination);
            }
            for (const spec of SPECS) await copyDatabase(journal, spec);
            await checkpoint(journal);
            journal.complete = true; writeJournal(journal);
          }
          current = { ...current, complete: true, phase: 'ready', stage: '', warnings: journal.warnings, error: '' };
          return status();
        });
      } finally { clearTimeout(timeout); }
    }
    function attempt() {
      if (inFlight) return inFlight;
      if (current.attempts >= 3) return Promise.reject(Error('Three migration attempts failed. Resolve the storage issue and reload before retrying.'));
      current = { ...current, phase: 'copying', complete: false, error: '', attempts: current.attempts + 1 };
      inFlight = migrate().catch(error => {
        const message = error?.name === 'QuotaExceededError'
          ? 'The browser origin storage quota is full. PWA and CURRENT share that quota. Original data and completed copies were retained; free space or export data before retrying.'
          : error?.name === 'AbortError' ? 'PWA migration waited too long for another tab. Close that tab and retry.'
            : String(error?.message || 'PWA data migration could not be verified.');
        current = { ...current, phase: 'blocked', complete: false, error: message };
        throw Error(message);
      }).finally(() => { inFlight = null; });
      return inFlight;
    }
    function showFailure() {
      if (!root.document) return;
      if (!root.document.body) { root.document.addEventListener('DOMContentLoaded', showFailure, { once: true }); return; }
      let panel = root.document.getElementById('labStorageProblem');
      if (!panel) {
        panel = root.document.createElement('section'); panel.id = 'labStorageProblem'; panel.setAttribute('role', 'alert');
        panel.style.cssText = 'position:fixed;inset:1rem;z-index:2147483647;max-width:44rem;max-height:80vh;margin:auto;padding:1.5rem;overflow:auto;background:#172033;color:#f7f9ff;border:2px solid #e9b949;border-radius:1rem;font:16px/1.5 system-ui;box-shadow:0 0 0 100vmax #080d18ed;';
        const title = root.document.createElement('h2'); title.textContent = 'PWA data copy needs attention'; panel.appendChild(title);
        const message = root.document.createElement('p'); message.className = 'lab-storage-error'; panel.appendChild(message);
        const help = root.document.createElement('p'); help.textContent = 'The application has not started writing data. Existing data and completed copies are retained. Close other chess tabs or resolve browser storage access, then retry. Your previous PWA data remains in browser storage.'; panel.appendChild(help);
        const button = root.document.createElement('button'); button.type = 'button'; button.textContent = 'Retry copy'; button.style.cssText = 'margin-left:1rem;padding:.6rem 1rem;background:#1e4070;color:white;border:1px solid #92b8e7;border-radius:.4rem';
        button.onclick = async () => { button.disabled = true; try { await attempt(); root.location?.reload(); } catch (_) { showFailure(); button.disabled = current.attempts >= 3; } }; panel.appendChild(button);
        root.document.body.appendChild(panel);
      }
      panel.querySelector('.lab-storage-error').textContent = current.error;
    }
    const ready = attempt();
    // ready remains the initial immutable boot gate. Retry success reloads the
    // app so every consumer obtains the same verified ready gate again.
    ready.catch(() => {});
    return { ready, retry: attempt, status, showFailure };
  }
  return { create, KEYS, DATABASES, LOCAL, SPECS };
});
