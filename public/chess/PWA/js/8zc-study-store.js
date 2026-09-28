/* LAB-only transactional Studies. Web Locks serialize writers across tabs.
   Each operation validates a private copy and commits it with one storage write. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessStudyStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'ChessBest:PWA:v2:studies', LIMIT = 20, MAX = 4500000;
  const bytes = text => new Blob([text]).size;
  const copy = value => JSON.parse(JSON.stringify(value));
  const error = (code, message, details) => Object.assign(new Error(message), { code, ...details });
  const empty = () => ({ schema: 'chess-lab-studies', version: 1, studies: [], activeId: null,
    comparison: { question: '', A: null, B: null, originFen: null }, revision: 0, appliedOperations: [], recoveryOperationId: null, recoverySlot: null });
  function validate(C, Chess, value) {
    if (!value || value.schema !== 'chess-lab-studies' || value.version !== 1 || !Array.isArray(value.studies) || value.studies.length > LIMIT)
      throw error('INVALID_IMPORT', 'Invalid study collection (maximum 20 Studies).');
    const studies = value.studies.map(s => { const study = C.validate(Chess, s); if (s.provenance?.importedId) study.provenance = { importedId: String(s.provenance.importedId).slice(0, 160) }; return study; }), ids = new Set(studies.map(s => s.id));
    if (ids.size !== studies.length) throw error('INVALID_IMPORT', 'Duplicate study IDs.');
    let comparison = empty().comparison;
    if (value.comparison) {
      comparison.question = String(value.comparison.question || '').slice(0, 2000);
      for (const slot of ['A', 'B']) if (value.comparison[slot]) {
        const s = value.comparison[slot]; C.preview(Chess, s.fen, []);
        comparison = C.pin(comparison, slot, { ...C.snapshot(s.fen, s.analysis, { label: s.label, candidate: s.candidate }), capturedAt: String(s.capturedAt || '').slice(0, 100) });
      }
    }
    return { ...empty(), studies, activeId: ids.has(value.activeId) ? value.activeId : studies[0]?.id || null,
      comparison, recoverySlot: ['a', 'b'].includes(value.recoverySlot) ? value.recoverySlot : null, recoveryOperationId: typeof value.recoveryOperationId === 'string' ? value.recoveryOperationId : null, revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
      appliedOperations: Array.isArray(value.appliedOperations) ? value.appliedOperations.filter(x => typeof x === 'string').slice(-64) : [] };
  }
  function create({ C, Chess, storage, locks }) {
    let state = empty(), warning = '', raw = null;
    function read() {
      let text;
      try { text = storage?.getItem(KEY) ?? null; if (!storage) throw Error('Browser storage unavailable'); }
      catch (e) { throw error('STORAGE_UNAVAILABLE', e.message); }
      if (text && bytes(text) > MAX) throw error('SIZE_LIMIT', 'Saved Studies exceed the 4.5 MB limit. Original bytes are retained.');
      let parsed;
      try { parsed = text ? validate(C, Chess, JSON.parse(text)) : empty(); }
      catch (e) { throw error(e.code || 'CORRUPT_STORAGE', 'Stored Studies could not be read. Original bytes are retained. ' + e.message); }
      raw = text; state = parsed; warning = ''; return copy(state);
    }
    try { read(); } catch (e) { warning = e.message; }
    function append(s, study) {
      if (s.studies.length >= LIMIT) throw error('CAPACITY', 'Studies full — 20 / 20', { requiredSlots: 1, currentCount: s.studies.length, limit: LIMIT });
      if (s.studies.some(x => x.id === study.id)) {
        study.provenance = { importedId: study.id }; study.id = C.create(Chess).id;
        while (s.studies.some(x => x.id === study.id)) study.id = C.create(Chess).id;
      }
      s.studies.push(study); s.activeId = study.id; return study;
    }
    function apply(s, op) {
      let study = s.studies.find(x => x.id === op.studyId), result;
      if (op.expectedStudy !== undefined && JSON.stringify(study) !== op.expectedStudy)
        throw error('CONFLICT', 'This Study changed in another tab. Review the latest version and retry; nothing was overwritten.');
      switch (op.type) {
        case 'replace': {
          if (op.expectedRevision !== s.revision) throw error('CONFLICT', 'Studies changed in another tab. Review the latest version; nothing was overwritten.');
          const checked = validate(C, Chess, op.state);
          s.studies = checked.studies; s.activeId = checked.activeId; s.comparison = checked.comparison;
          break;
        }
        case 'append': result = append(s, copy(op.study)); break;
        case 'import': {
          const incoming = validate(C, Chess, op.collection);
          if (s.studies.length + incoming.studies.length > LIMIT)
            throw error('CAPACITY', 'Not enough Study slots for the whole import.', { requiredSlots: incoming.studies.length, currentCount: s.studies.length, limit: LIMIT });
          incoming.studies.forEach(x => append(s, x)); s.comparison = incoming.comparison; result = { imported: incoming.studies.length }; break;
        }
        case 'record':
        case 'recordAnnotated': {
          if (!study || study.rootFen !== op.startFen) study = append(s, copy(op.fallbackStudy));
          const nodeId = C.addLine(Chess, study, op.moves, op.startFen);
          if (op.type === 'recordAnnotated') {
            const path = C.path(study, nodeId);
            if (!Array.isArray(op.comments) || op.comments.length > path.length) throw error('INVALID_IMPORT', 'Invalid annotation path.');
            op.comments.forEach((text, i) => { if (text) { const comment = String(text).slice(0, C.LIMITS.comment).replace(/{/g, '(').replace(/}/g, ')'); if (!path[i].comments.includes(comment)) path[i].comments.push(comment); } });
          }
          s.activeId = study.id; result = { studyId: study.id, nodeId }; break;
        }
        case 'line': {
          let parent = study?.nodes[op.parentId]?.fen === op.fen ? op.parentId : null;
          if (!parent) { study = append(s, copy(op.fallbackStudy)); parent = 'root'; }
          let first, id = parent;
          for (const move of op.moves) { id = C.addMove(Chess, study, id, move); if (!first) first = id; }
          if (!first) throw error('EMPTY_LINE', 'There is no continuation to save.');
          const entry = study.nodes[first];
          if (op.title) entry.name = String(op.title).slice(0, 160);
          if (op.comment) { const text = String(op.comment).slice(0, C.LIMITS.comment).replace(/{/g, '(').replace(/}/g, ')'); if (!entry.comments.includes(text)) entry.comments.push(text); }
          study.selectedId = id; s.activeId = study.id; result = { studyId: study.id, nodeId: id, message: 'Continuation saved with its alternatives in ' + study.title }; break;
        }
        case 'annotatePath': {
          if (!study) throw error('CONFLICT', 'The original Study is no longer available.');
          const id = C.addLine(Chess, study, op.moves), path = C.path(study, id);
          if (!Array.isArray(op.comments) || op.comments.length > path.length) throw error('INVALID_IMPORT', 'Invalid annotation path.');
          op.comments.forEach((text, i) => { if (text) { const comment = String(text).slice(0, C.LIMITS.comment).replace(/{/g, '(').replace(/}/g, ')'); if (!path[i].comments.includes(comment)) path[i].comments.push(comment); } }); break;
        }
        case 'edit': {
          if (!study) throw error('CONFLICT', 'Study was removed in another tab.');
          if (op.title !== undefined) study.title = op.title.trim().slice(0, 160) || 'Untitled study';
          if (op.annotation) C.annotate(study, op.nodeId, op.annotation);
          if (op.main) { const n = study.nodes[op.nodeId], siblings = study.nodes[n.parentId].children; siblings.splice(siblings.indexOf(n.id), 1); siblings.unshift(n.id); }
          if (op.annotation || op.main) study.selectedId = op.nodeId;
          s.activeId = study.id; result = { studyId: study.id }; break;
        }
        case 'select': {
          if (!study || (op.nodeId && !study.nodes[op.nodeId])) throw error('CONFLICT', 'The selected Study or position is no longer available.');
          s.activeId = study.id; if (op.nodeId) study.selectedId = op.nodeId;
          result = { study: copy(study) }; break;
        }
        case 'compare': {
          if (op.expected !== undefined && JSON.stringify(s.comparison) !== op.expected) throw error('CONFLICT', 'A/B comparison changed in another tab. Review before editing.');
          if (op.pin) s.comparison = C.pin(s.comparison, op.slot, op.pin);
          if (op.question !== undefined) s.comparison.question = op.question.slice(0, 2000);
          if (op.clear) { s.comparison[op.clear] = null; if (!s.comparison.A && !s.comparison.B) s.comparison.originFen = null; }
          if (op.reset) s.comparison = empty().comparison; break;
        }
        case 'remove': {
          if (op.expectedRevision !== s.revision) throw error('CONFLICT', 'Studies changed in another tab. Review the refreshed list and confirm again.');
          const ids = new Set(op.ids), removed = s.studies.filter(x => ids.has(x.id));
          if (!removed.length) throw error('CONFLICT', 'No selected Study remains.');
          const backup = JSON.stringify({ ...empty(), studies: removed, activeId: ids.has(s.activeId) ? s.activeId : removed[0].id, comparison: s.comparison, recoveryOperationId: op.id });
          // Prepare in the inactive slot: failed deletion cannot destroy the last committed undo.
          const recoverySlot = s.recoverySlot === 'a' ? 'b' : 'a', recoveryKey = KEY + ':undo:' + recoverySlot;
          if (!op.withoutRecovery) {
            try { storage.setItem(recoveryKey, backup); if (storage.getItem(recoveryKey) !== backup) throw Error('Readback failed'); }
            catch (_) { throw error('RECOVERY_UNAVAILABLE', 'A local recovery copy could not be verified. Export first, or explicitly remove without recovery.'); }
          }
          s.recoveryOperationId = op.withoutRecovery ? null : op.id;
          s.recoverySlot = op.withoutRecovery ? null : recoverySlot;
          s.studies = s.studies.filter(x => !ids.has(x.id));
          if (ids.has(s.activeId)) s.activeId = s.studies[0]?.id || null;
          result = { removed: removed.length, recovery: !op.withoutRecovery }; break;
        }
        case 'undo': {
          const backup = op.recovery;
          if (typeof backup !== 'string' || !backup || bytes(backup) > MAX) throw error('NO_RECOVERY', 'The original removal recovery is unavailable. Export pending work for review.');
          const parsed = JSON.parse(backup);
          if (!op.recoveryOperationId || parsed.recoveryOperationId !== op.recoveryOperationId) throw error('INVALID_IMPORT', 'Removal recovery identity does not match the pending undo.');
          const recovered = validate(C, Chess, parsed);
          const missing = [];
          for (const item of recovered.studies) {
            const existing = s.studies.find(x => x.id === item.id);
            if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw error('CONFLICT', 'A recovered Study ID now has different content; export recovery and resolve explicitly.');
            if (!existing) missing.push(item);
          }
          if (s.studies.length + missing.length > LIMIT) throw error('CAPACITY', 'Recovery needs more free Study slots.', { requiredSlots: missing.length, currentCount: s.studies.length, limit: LIMIT });
          s.studies.push(...missing); if (!s.activeId) s.activeId = recovered.activeId;
          result = { restored: missing.length }; break;
        }
        default: throw error('UNKNOWN_OPERATION', 'Unknown Study operation.');
      }
      return result;
    }
    async function execute(input, cancelled = () => false) {
      const op = copy(input); // Freeze before waiting for the cross-tab lock.
      if (!locks?.request) throw error('STORAGE_UNAVAILABLE', 'Safe cross-tab saving is unavailable in this browser. Keep this tab open and export pending work.');
      return locks.request(KEY, { mode: 'exclusive' }, () => {
        if (cancelled()) throw error('CANCELLED', 'Pending save was cancelled.');
        read();
        if (state.appliedOperations.includes(op.id)) return { ok: true, duplicate: true, state: copy(state) };
        // The bounded receipt ledger cannot establish whether an older uncertain save committed.
        // Refuse that retry; silently remapping its record ID could create a duplicate.
        if (!Number.isSafeInteger(op.baseRevision) || op.baseRevision < 0 || op.baseRevision > state.revision || state.revision - op.baseRevision > 64)
          throw error('STALE_OPERATION', 'This pending save is older than the safe retry window. Export it, inspect the saved Studies, then re-import only if it is missing. No new write was made.');
        const next = copy(state); let result;
        try { result = apply(next, op); }
        catch (e) {
          if (!e.code) e.code = /5000|size limit|Study limit/.test(e.message) ? 'NODE_LIMIT' : 'INVALID_IMPORT';
          throw e;
        }
        // Drafts/imports are untrusted. Validate the entire candidate before the sole collection write.
        const checked = validate(C, Chess, next);
        next.studies = checked.studies; next.comparison = checked.comparison;
        if (op.type === 'recordAnnotated') result.pgn = C.toPGN(Chess, next.studies.find(item => item.id === result.studyId));
        if (next.studies.some(x => Object.keys(x.nodes).length > C.LIMITS.nodes)) throw error('NODE_LIMIT', 'Study position limit reached.');
        next.revision++; next.appliedOperations = [...next.appliedOperations, op.id].slice(-64);
        const text = JSON.stringify(next);
        if (bytes(text) > MAX) throw error('SIZE_LIMIT', 'Studies exceed the 4.5 MB collection limit. Export or remove content.');
        // Locks coordinate this namespace. The check also detects unsupported external writers.
        if (storage.getItem(KEY) !== raw) throw error('CONFLICT', 'Studies changed during this operation. Please retry.');
        try { storage.setItem(KEY, text); }
        catch (e) { throw error(e.name === 'QuotaExceededError' ? 'QUOTA' : 'STORAGE_UNAVAILABLE', 'Study was not saved: ' + e.message); }
        let readback;
        try { readback = storage.getItem(KEY); } catch (_) { /* Commit may have happened; retain its operation ID for safe retry. */ }
        if (readback !== text) throw error('STORAGE_UNAVAILABLE', 'Study save could not be verified. Export pending work and reload before retrying.');
        state = next; raw = text;
        return { ok: true, result, state: copy(state) };
      });
    }
    function recovery() {
      if (!state.recoveryOperationId || !state.recoverySlot) return '';
      const text = storage?.getItem(KEY + ':undo:' + state.recoverySlot);
      if (!text) return '';
      try { return JSON.parse(text).recoveryOperationId === state.recoveryOperationId ? text : ''; } catch (_) { return ''; }
    }
    return { execute, read, get: () => copy(state), warning: () => warning,
      recovery, original: () => storage?.getItem(KEY) || '' };
  }
  return { create, validate, empty, bytes, KEY, LIMIT, MAX };
});
