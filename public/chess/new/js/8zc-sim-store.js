/* Durable browser archive for simulation games and tournament schedules. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessSimStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const SCHEMA = 'chess-sim-archive', VERSION = 1;
  const MAX_RECORD_BYTES = 32 * 1024 * 1024, MAX_IMPORT_BYTES = 128 * 1024 * 1024;
  function bytes(text) { return new TextEncoder().encode(text).length; }
  function jsonCopy(value) {
    const text = JSON.stringify(value, (key, item) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw Error('Unsafe archive property.');
      if (typeof item === 'number' && !Number.isFinite(item)) throw Error('Archive numbers must be finite.');
      if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') throw Error('Archive data must be JSON serializable.');
      return item;
    });
    if (text === undefined) throw Error('Missing archive data.');
    return JSON.parse(text);
  }
  function createId(prefix = 'sim') {
    const label = String(prefix).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'sim';
    let suffix;
    if (root.crypto?.randomUUID) suffix = root.crypto.randomUUID();
    else if (root.crypto?.getRandomValues) suffix = Array.from(root.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    else suffix = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
    return label + '-' + suffix;
  }
  function record(value, kind) {
    const item = jsonCopy(value);
    if (!item || Array.isArray(item) || typeof item !== 'object') throw Error('Invalid ' + kind + ' record.');
    if (!['string', 'number'].includes(typeof item.id) || !String(item.id).trim() || String(item.id).length > 200) throw Error('Archive record requires a valid ID.');
    item.id = String(item.id);
    if (item.trace !== undefined && !Array.isArray(item.trace)) throw Error('Invalid game trace.');
    if (kind === 'event' && item.games !== undefined && !Array.isArray(item.games)) throw Error('Invalid event games.');
    if (item.pgn !== undefined && typeof item.pgn !== 'string') throw Error('Invalid game PGN.');
    if (bytes(JSON.stringify(item)) > MAX_RECORD_BYTES) throw Error('Archive record exceeds 32 MB.');
    return item;
  }
  function archive(value, checkReferences = true) {
    if (!value || value.schema !== SCHEMA || value.version !== VERSION || !Array.isArray(value.runs) || !Array.isArray(value.events)) throw Error('Unsupported simulation archive.');
    if (value.runs.length > 50000 || value.events.length > 10000) throw Error('Archive contains too many records.');
    const runs = value.runs.map(item => record(item, 'game')), events = value.events.map(item => record(item, 'event'));
    if (new Set(runs.map(item => item.id)).size !== runs.length || new Set(events.map(item => item.id)).size !== events.length) throw Error('Duplicate IDs in simulation archive.');
    const runIds = new Set(runs.map(item => item.id)), eventIds = new Set(events.map(item => item.id));
    for (const run of runs) if (checkReferences && run.eventId != null && !eventIds.has(String(run.eventId))) throw Error('Game refers to an event absent from this archive.');
    for (const event of events) for (const game of event.games || []) {
      if (!game || typeof game !== 'object' || Array.isArray(game)) throw Error('Invalid event game.');
      if (checkReferences && game.runId != null && !runIds.has(String(game.runId)) && !['pending', 'scheduled'].includes(game.state)) throw Error('Event refers to a game absent from this archive.');
    }
    return { schema: SCHEMA, version: VERSION, runs, events };
  }
  function create(options = {}) {
    const namespace = options.namespace || 'ChessBest-sim-v1', storageKey = namespace + '-fallback', checkpointKey = namespace + '-checkpoint';
    const leaseKey = options.leaseKey || 'chessSimRunnerLease-v1';
    const idb = options.indexedDB === undefined ? root.indexedDB : options.indexedDB;
    let storage = options.localStorage;
    if (storage === undefined) { try { storage = root.localStorage; } catch (_) { storage = null; } }
    const locks = options.locks === undefined ? root.navigator?.locks : options.locks;
    const observed = { runs: new Map(), events: new Map() };
    let mode = 'initializing', warning = '', database = null, readyPromise, queue = Promise.resolve();
    function status() { return { mode, persistent: mode === 'indexedDB' || mode === 'localStorage', warning }; }
    function empty() { return { schema: SCHEMA, version: VERSION, runs: [], events: [] }; }
    function fallbackRead() {
      if (!storage) throw Error('Browser storage is unavailable. Export your games before closing.');
      const text = storage.getItem(storageKey);
      return text ? archive(JSON.parse(text), false) : empty();
    }
    function ready() {
      if (!readyPromise) readyPromise = (async () => {
        let reason = 'IndexedDB is unavailable';
        if (idb) {
          try {
            database = await new Promise((resolve, reject) => {
              let settled = false;
              const request = idb.open(namespace, VERSION);
              request.onupgradeneeded = () => {
                for (const name of ['runs', 'events']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
              };
              request.onsuccess = () => { if (settled) request.result.close(); else { settled = true; resolve(request.result); } };
              request.onerror = () => { if (!settled) { settled = true; reject(request.error || Error('IndexedDB could not open')); } };
              request.onblocked = () => { if (!settled) { settled = true; reject(Error('Archive upgrade is blocked by another open tab')); } };
            });
            mode = 'indexedDB';
            database.onversionchange = () => { database.close(); database = null; mode = 'unavailable'; warning = 'Archive changed in another tab. Reload this page before continuing.'; };
            await migrateFallback(); await startupRecovery(); return status();
          } catch (error) { reason = error.message || 'IndexedDB could not open'; }
        }
        try { fallbackRead(); mode = 'localStorage'; warning = reason + '; using browser localStorage for this archive.'; }
        catch (error) { mode = 'unavailable'; warning = reason + '. ' + (error.message || 'Browser storage is unavailable.'); }
        if (mode !== 'unavailable') await startupRecovery();
        return status();
      })();
      return readyPromise;
    }
    function serial(work) {
      const result = queue.then(async () => {
        await ready();
        if (mode === 'unavailable') throw Error(warning);
        if (locks?.request) return locks.request(namespace + '-archive', work);
        return work();
      });
      queue = result.catch(() => {});
      return result;
    }
    function remember(kind, items, replace = false) {
      for (const item of items) if (replace || !observed[kind].has(item.id)) observed[kind].set(item.id, Number(item._storeRevision) || 0);
      return items;
    }
    function idbRead(kind, id) {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(kind, 'readonly'), store = transaction.objectStore(kind);
        const request = id == null ? store.getAll() : store.get(String(id));
        let result;
        request.onsuccess = () => { result = request.result; };
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = transaction.onabort = () => reject(transaction.error || Error('Could not read simulation archive.'));
      });
    }
    async function read(kind, id) {
      const result = mode === 'indexedDB' ? await idbRead(kind, id) : id == null ? fallbackRead()[kind] : fallbackRead()[kind].find(item => item.id === String(id));
      const items = id == null ? result : result ? [result] : [];
      remember(kind, items, id != null);
      if (id != null) return result ? jsonCopy(result) : null;
      return jsonCopy(items).sort((a, b) => String(b.startedAt || b.createdAt || b.updatedAt || '').localeCompare(String(a.startedAt || a.createdAt || a.updatedAt || '')) || a.id.localeCompare(b.id));
    }
    function revision(kind, incoming, previous) {
      if (previous && (!observed[kind].has(incoming.id) || observed[kind].get(incoming.id) !== (Number(previous._storeRevision) || 0))) throw Error('This ' + (kind === 'runs' ? 'game' : 'event') + ' changed in another tab. Reload it before saving.');
      return { ...incoming, _storeRevision: (Number(previous?._storeRevision) || 0) + 1, updatedAt: new Date().toISOString() };
    }
    function changed(kind, id) {
      if (root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent('chess-sim-store-change', { detail: { kind, id } }));
    }
    function save(kind, value) {
      let incoming;
      try { incoming = record(value, kind === 'runs' ? 'game' : 'event'); } catch (error) { return Promise.reject(error); }
      return serial(async () => {
        let saved;
        if (mode === 'indexedDB') {
          saved = await new Promise((resolve, reject) => {
            const transaction = database.transaction(kind, 'readwrite'), store = transaction.objectStore(kind), request = store.get(incoming.id);
            let failure, result;
            request.onsuccess = () => {
              try { result = revision(kind, incoming, request.result); store.put(result); }
              catch (error) { failure = error; transaction.abort(); }
            };
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = transaction.onabort = () => reject(failure || transaction.error || Error('Could not save simulation archive.'));
          });
        } else {
          const state = fallbackRead(), index = state[kind].findIndex(item => item.id === incoming.id);
          saved = revision(kind, incoming, index < 0 ? null : state[kind][index]);
          if (index < 0) state[kind].push(saved); else state[kind][index] = saved;
          try { storage.setItem(storageKey, JSON.stringify(state)); }
          catch (error) { warning = 'Game archive was not saved: ' + (error.message || 'browser storage is full'); throw Error(warning); }
        }
        remember(kind, [saved], true); changed(kind, saved.id); return jsonCopy(saved);
      });
    }
    function prepareImport(incoming, existing) {
      const maps = { runs: new Map(), events: new Map() };
      for (const kind of ['events', 'runs']) {
        const used = new Set([...existing[kind].map(item => item.id), ...incoming[kind].map(item => item.id)]);
        const conflicts = new Set(existing[kind].map(item => item.id));
        for (const item of incoming[kind]) {
          let id = item.id;
          if (conflicts.has(id)) { do { id = createId(kind === 'runs' ? 'game' : 'event'); } while (used.has(id)); }
          used.add(id); maps[kind].set(item.id, id);
        }
      }
      const events = incoming.events.map(source => {
        const event = jsonCopy(source); event.id = maps.events.get(source.id); event._storeRevision = 1;
        if (event.games) event.games = event.games.map(game => ({ ...game,
          ...(game.runId != null && maps.runs.has(String(game.runId)) ? { runId: maps.runs.get(String(game.runId)) } : {}),
          ...(game.id != null && maps.runs.has(String(game.id)) ? { id: maps.runs.get(String(game.id)) } : {}) }));
        return event;
      });
      const runs = incoming.runs.map(source => ({ ...jsonCopy(source), id: maps.runs.get(source.id), _storeRevision: 1,
        ...(source.eventId != null ? { eventId: maps.events.get(String(source.eventId)) } : {}) }));
      return { runs, events, idMap: { runs: Object.fromEntries(maps.runs), events: Object.fromEntries(maps.events) } };
    }
    function importJSON(text) {
      let incoming;
      try {
        if (typeof text !== 'string' || bytes(text) > MAX_IMPORT_BYTES) throw Error('Simulation archive exceeds 128 MB.');
        incoming = archive(JSON.parse(text));
      } catch (error) { return Promise.reject(error); }
      return serial(async () => {
        let imported;
        if (mode === 'indexedDB') {
          imported = await new Promise((resolve, reject) => {
            const transaction = database.transaction(['runs', 'events'], 'readwrite'), existing = {}, requests = [];
            let result, failure;
            for (const kind of ['runs', 'events']) {
              const request = transaction.objectStore(kind).getAll(); requests.push(request);
              request.onsuccess = () => {
                existing[kind] = request.result;
                if (!existing.runs || !existing.events) return;
                try {
                  result = prepareImport(incoming, existing);
                  for (const name of ['runs', 'events']) for (const item of result[name]) transaction.objectStore(name).add(item);
                } catch (error) { failure = error; transaction.abort(); }
              };
            }
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = transaction.onabort = () => reject(failure || transaction.error || Error('Could not import simulation archive.'));
          });
        } else {
          const existing = fallbackRead(); imported = prepareImport(incoming, existing);
          for (const kind of ['runs', 'events']) existing[kind].push(...imported[kind]);
          try { storage.setItem(storageKey, JSON.stringify(existing)); }
          catch (error) { warning = 'Archive import was not saved: ' + (error.message || 'browser storage is full'); throw Error(warning); }
        }
        for (const kind of ['runs', 'events']) remember(kind, imported[kind], true);
        changed('import', null);
        return { runs: imported.runs.length, events: imported.events.length, idMap: imported.idMap };
      });
    }
    function checkpointSync(run, event) {
      if (!storage) throw Error('Cannot save the active-game checkpoint: localStorage is unavailable.');
      const payload = { schema: 'chess-sim-checkpoint', version: VERSION, savedAt: new Date().toISOString(), records: [] };
      for (const [kind, value] of [['runs', run], ['events', event]]) if (value) {
        const item = record(value, kind === 'runs' ? 'game' : 'event');
        payload.records.push({ kind, value: item, revision: observed[kind].get(item.id) ?? null });
      }
      if (!payload.records.length) throw Error('Checkpoint has no game or event.');
      const text = JSON.stringify(payload);
      if (bytes(text) > 8 * 1024 * 1024) throw Error('Active-game checkpoint exceeds 8 MB.');
      try { storage.setItem(checkpointKey, text); }
      catch (error) { throw Error('Active-game checkpoint was not saved: ' + (error.message || 'browser storage is full')); }
      return { saved: true, savedAt: payload.savedAt };
    }
    async function recoverDirect(owner) {
      if (!storage) return { recovered: 0 };
      const text = storage.getItem(checkpointKey);
      if (!text) return { recovered: 0 };
      const leaseText = storage.getItem(leaseKey), lease = leaseText ? JSON.parse(leaseText) : null;
      if (lease && Number(lease.expires) > Date.now() && lease.owner !== owner) return { recovered: 0, activeElsewhere: true };
      const payload = JSON.parse(text);
      if (!payload || payload.schema !== 'chess-sim-checkpoint' || payload.version !== VERSION || !Array.isArray(payload.records) || payload.records.length > 2 || !Number.isFinite(Date.parse(payload.savedAt))) throw Error('Invalid active-game checkpoint; original checkpoint was retained.');
      const records = payload.records.map(entry => {
        if (!entry || !['runs', 'events'].includes(entry.kind)) throw Error('Invalid checkpoint record.');
        return { kind: entry.kind, value: record(entry.value, entry.kind === 'runs' ? 'game' : 'event'), revision: entry.revision };
      });
      const recovered = [];
      function newer(entry, previous) {
        if (previous && (Date.parse(previous.updatedAt || '') > Date.parse(payload.savedAt) || (Number(previous._storeRevision) || 0) !== entry.revision)) return null;
        const value = { ...entry.value, _storeRevision: (Number(previous?._storeRevision) || 0) + 1, updatedAt: payload.savedAt };
        recovered.push({ kind: entry.kind, value }); return value;
      }
      if (mode === 'indexedDB') {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(['runs', 'events'], 'readwrite');
          for (const entry of records) {
            const object = transaction.objectStore(entry.kind), request = object.get(entry.value.id);
            request.onsuccess = () => { const value = newer(entry, request.result); if (value) object.put(value); };
          }
          transaction.oncomplete = resolve;
          transaction.onerror = transaction.onabort = () => reject(transaction.error || Error('Could not recover the active game.'));
        });
      } else {
        const state = fallbackRead();
        for (const entry of records) {
          const index = state[entry.kind].findIndex(item => item.id === entry.value.id), value = newer(entry, state[entry.kind][index]);
          if (value) { if (index < 0) state[entry.kind].push(value); else state[entry.kind][index] = value; }
        }
        if (recovered.length) storage.setItem(storageKey, JSON.stringify(state));
      }
      for (const entry of recovered) remember(entry.kind, [entry.value], true);
      // Never remove a fresher checkpoint written while recovery was in flight.
      if (storage.getItem(checkpointKey) === text) storage.removeItem(checkpointKey);
      if (recovered.length) changed('recovery', null);
      return { recovered: recovered.length };
    }
    async function migrateFallback() {
      if (!storage) return;
      const migrate = async () => {
        const text = storage.getItem(storageKey);
        if (!text) return;
        const saved = archive(JSON.parse(text), false);
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(['runs', 'events'], 'readwrite');
          for (const kind of ['runs', 'events']) {
            const object = transaction.objectStore(kind);
            for (const incoming of saved[kind]) {
              const request = object.get(incoming.id);
              request.onsuccess = () => {
                const existing = request.result;
                const incomingAt = Date.parse(incoming.updatedAt || incoming.startedAt || incoming.createdAt || '');
                const existingAt = existing && Date.parse(existing.updatedAt || existing.startedAt || existing.createdAt || '');
                // A returning IndexedDB archive may already contain later play.
                // Equal or unknown dates favor that existing durable record.
                if (existing && (!Number.isFinite(incomingAt) || (Number.isFinite(existingAt) && existingAt >= incomingAt))) return;
                const revision = existing ? Math.max(Number(existing._storeRevision) || 0, Number(incoming._storeRevision) || 0) + 1 : Number(incoming._storeRevision) || 1;
                object.put({ ...incoming, _storeRevision: revision });
              };
            }
          }
          transaction.oncomplete = resolve;
          transaction.onerror = transaction.onabort = () => reject(transaction.error || Error('Could not migrate the fallback game archive.'));
        });
        // The entire two-store transaction committed. Keep any concurrent
        // fallback update for the next reload instead of deleting its data.
        if (storage.getItem(storageKey) === text) storage.removeItem(storageKey);
      };
      try {
        if (locks?.request) await locks.request(namespace + '-archive', migrate);
        else await migrate();
      } catch (error) { warning = [warning, 'Fallback archive migration failed; saved fallback was retained: ' + error.message].filter(Boolean).join(' '); }
    }
    async function startupRecovery() {
      try {
        if (locks?.request) await locks.request(namespace + '-archive', () => recoverDirect());
        else await recoverDirect();
      } catch (error) { warning = [warning, 'Active-game recovery failed: ' + error.message].filter(Boolean).join(' '); }
    }
    return { ready, status, createId, checkpointSync, recoverCheckpoint: owner => serial(() => recoverDirect(owner)),
      listRuns: () => serial(() => read('runs')), getRun: id => serial(() => read('runs', id)), saveRun: value => save('runs', value),
      listEvents: () => serial(() => read('events')), getEvent: id => serial(() => read('events', id)), saveEvent: value => save('events', value),
      exportJSON: () => serial(async () => JSON.stringify({ schema: SCHEMA, version: VERSION, exportedAt: new Date().toISOString(), runs: await read('runs'), events: await read('events') }, null, 2)),
      importJSON,
      close: () => serial(() => { database?.close(); database = null; mode = 'unavailable'; warning = 'Archive is closed. Create a new archive connection to continue.'; })
    };
  }
  return { SCHEMA, VERSION, create, createId };
});
