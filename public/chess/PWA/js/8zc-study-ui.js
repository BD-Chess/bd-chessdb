/* Saved variations and pinned evidence. Main-board navigation is always explicit. */
(function (root) {
  'use strict';
  const KEY = 'ChessBest:PWA:v2:studies';
  function create(host) {
    const C = root.ChessStudy, Chess = host.Chess || root.Chess;
    if (!C || !Chess || typeof host.getContext !== 'function') throw Error('Study requires ChessStudy, Chess and getContext');
    const mount = host.mount || document.body;
    let storage, draftStorage;
    try { storage = host.storage || root.localStorage; } catch (_) {}
    try { draftStorage = host.draftStorage || root.sessionStorage; } catch (_) {}
    const S = root.ChessStudyStore;
    const store = S.create({ C, Chess, storage, locks: host.locks || root.navigator?.locks });
    const clone = value => JSON.parse(JSON.stringify(value));
    let pending = null, capacity = false, busy = false, deferredNotice = '', confirmation = null, draftNotice = '', destroyed = false, generation = 0;
    const DRAFT_KEY = KEY + ':pending';
    const committedEffects = new Map();
    const operationId = () => 'op-' + (root.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    let state = store.get();
    let recordQueue = Promise.resolve(), recordReservation = null, queuedRecords = 0;
    let persistenceMessage = '', loadWarning = '', tab = 'study', visible = false, priorFocus = null, activePreview = null, previewIndex = 0, treeLimit = 150, unsubscribe = null;
    function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
    function button(text, fn, cls) { const b = el('button', cls || '', text); b.type = 'button'; b.addEventListener('click', () => guard(fn)); return b; }
    const overlay = el('div', 'chess-study-overlay'); overlay.hidden = true;
    const dialog = el('section', 'chess-study-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'chessStudyTitle'); dialog.tabIndex = -1;
    const head = el('header', 'chess-study-header'), heading = el('h2', '', 'Study & compare'); heading.id = 'chessStudyTitle';
    const closeButton = button('Close ✕', close, 'chess-study-close'); head.append(heading, closeButton);
    const tabs = el('nav', 'chess-study-tabs'); tabs.setAttribute('aria-label', 'Study sections');
    const tabButtons = {};
    for (const [id, name] of [['study', 'Variations'], ['compare', 'A / B comparison'], ['preview', 'Preview']]) {
      const b = button(name, () => { tab = id; render(); }); tabs.append(b); tabButtons[id] = b;
    }
    const status = el('p', 'chess-study-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const body = el('div', 'chess-study-body'); dialog.append(head, tabs, status, body); overlay.append(dialog); mount.append(overlay);
    function showError(e) { status.textContent = (e.code ? e.code + ': ' : '') + (e.message || String(e)); status.classList.add('is-error'); }
    function guard(fn) { try { return Promise.resolve(fn()).catch(showError); } catch (e) { showError(e); return Promise.resolve(); } }
    function message(text) { status.textContent = text || persistenceMessage || loadWarning; status.classList.remove('is-error'); }
    function current() { return state.studies.find(s => s.id === state.activeId) || null; }
    loadWarning = store.warning();
    function saveDraft() {
      try {
        const text = JSON.stringify(pending);
        if (S.bytes(text) > S.MAX) throw Error('Draft too large');
        draftStorage.setItem(DRAFT_KEY, text);
        if (draftStorage.getItem(DRAFT_KEY) !== text) throw Error('Draft readback failed');
        draftNotice = 'Pending work is retained for reload in this tab. Export it before closing the tab.';
      } catch (_) { draftNotice = 'Pending work is in memory only. Export it before closing or reloading this tab.'; }
    }
    try {
      const saved = draftStorage?.getItem(DRAFT_KEY);
      if (saved && S.bytes(saved) <= S.MAX) {
        const draft = JSON.parse(saved);
        if (draft && typeof draft.id === 'string' && ['append', 'import', 'record', 'recordAnnotated', 'line', 'annotatePath', 'undo'].includes(draft.type)) {
          pending = draft; saveDraft(); loadWarning = 'Pending Study work from this tab is available in Manage Studies.';
        }
      }
    } catch (_) { loadWarning = 'A pending draft could not be read. Existing Studies were not changed.'; }
    function clearPending() { if (pending) committedEffects.delete(pending.id); pending = null; try { draftStorage?.removeItem(DRAFT_KEY); } catch (_) {} }
    function refresh() { try { state = store.read(); loadWarning = ''; } catch (e) { loadWarning = e.message; } }
    function showManager() {
      refresh(); capacity = true; confirmation = null; host.pause?.();
      if (!visible) priorFocus = document.activeElement;
      visible = true; overlay.hidden = false; render(); dialog.focus();
    }
    async function perform(op, allowPending = true, onCommitted) {
      const request = clone({ id: operationId(), baseRevision: state.revision, ...op }), epoch = generation;
      if (destroyed) return { ok: false, code: 'CANCELLED' };
      if (allowPending && pending && request.id !== pending.id) {
        deferredNotice = 'Another save was deferred. Finish or cancel the retained action, then retry the other save from its source.';
        if (!visible) message(deferredNotice); else render();
        return { ok: false, code: 'PENDING_ACTION' };
      }
      if (typeof onCommitted === 'function') committedEffects.set(request.id, onCommitted);
      let outcome, effect;
      try {
        const response = await store.execute(request, () => destroyed || epoch !== generation);
        if (destroyed) return response;
        state = response.state; persistenceMessage = ''; loadWarning = '';
        effect = committedEffects.get(request.id); committedEffects.delete(request.id);
        if (pending?.id === request.id) clearPending();
        if (visible) render();
        outcome = { ok: true, ...(response.result || {}), duplicate: !!response.duplicate };
      } catch (e) {
        refresh();
        if (e.code === 'CANCELLED') return { ok: false, code: 'CANCELLED' };
        if (allowPending && pending && pending.id !== request.id) { deferredNotice = 'Another save was deferred. Retry it after resolving the retained action.'; return { ok: false, code: 'PENDING_ACTION' }; }
        if (allowPending && ['CAPACITY', 'QUOTA', 'STORAGE_UNAVAILABLE', 'SIZE_LIMIT', 'NODE_LIMIT', 'CONFLICT', 'STALE_OPERATION'].includes(e.code)) {
          pending = request; saveDraft(); showManager(); showError(e);
          return { ok: false, code: e.code, pendingOperationId: request.id };
        }
        committedEffects.delete(request.id); throw e;
      }
      // Host navigation is an effect of a committed save, never part of its retry.
      if (effect) {
        try { await effect(outcome); }
        catch (error) { outcome.completionError = error.message || String(error); showError(Error('Study was saved; opening it failed: ' + outcome.completionError)); }
      }
      return outcome;
    }
    async function persist() {
      const next = clone(state), expectedRevision = state.revision;
      const result = await perform({ type: 'replace', state: next, expectedRevision }, false);
      return result;
    }
    function pendingSlots() {
      if (!pending) return 0;
      if (pending.type === 'import') return Array.isArray(pending.collection?.studies) ? pending.collection.studies.length : 0;
      if (pending.type === 'append') return 1;
      if (pending.type === 'record' || pending.type === 'recordAnnotated' || pending.type === 'line') {
        const study = state.studies.find(x => x.id === pending.studyId);
        return study && (pending.type !== 'line' ? study.rootFen === pending.startFen : study.nodes[pending.parentId]?.fen === pending.fen) ? 0 : 1;
      }
      if (pending.type === 'undo') { try { return JSON.parse(pending.recovery).studies.filter(x => !state.studies.some(y => y.id === x.id)).length; } catch (_) { return 0; } }
      return 0;
    }
    async function resumePending() {
      if (!pending || busy) return;
      busy = true; const op = pending; render();
      try {
        const result = await perform(op);
        if (result.ok) { deferredNotice = ''; capacity = true; render(); message(result.completionError ? 'Study saved. Opening it failed: ' + result.completionError : 'Pending action saved exactly once.'); }
      } finally { const text = status.textContent, failed = status.classList.contains('is-error'); busy = false; if (visible) { render(); status.textContent = text; status.classList.toggle('is-error', failed); } }
    }
    function cancelPending() { generation++; deferredNotice = ''; if (pending) saveDraft(); close(); }
    async function removeStudies(ids, expectedRevision, withoutRecovery = false) {
      try {
        const result = await perform({ type: 'remove', ids, expectedRevision, withoutRecovery }, false);
        if (!result.ok) throw Error('Removal did not commit. Saved Studies were kept.');
        confirmation = null; activePreview = null; render(); message(result.recovery ? 'Removed. One local recovery snapshot is available.' : 'Removed without a verified recovery copy.');
      } catch (e) {
        if (e.code === 'RECOVERY_UNAVAILABLE') { confirmation = { ids, revision: expectedRevision, noRecovery: true }; render(); showError(e); }
        else { confirmation = null; render(); showError(e); }
      }
    }
    function undoLastRemoval() {
      refresh(); const recovery = store.recovery();
      if (!recovery) throw Object.assign(Error('No local removal recovery is available.'), { code: 'NO_RECOVERY' });
      return perform({ type: 'undo', recovery, recoveryOperationId: JSON.parse(recovery).recoveryOperationId });
    }
    function renderManager() {
      const count = state.studies.length, needed = pendingSlots();
      heading.textContent = count >= S.LIMIT ? 'Studies full — ' + count + ' / ' + S.LIMIT : 'Manage Studies — ' + count + ' / ' + S.LIMIT;
      tabs.hidden = true;
      body.append(el('p', '', 'Export keeps a copy; it does not remove Studies or free slots. Removal affects only LAB Studies. Pinned A/B, the workspace game, SIM, Evidence, Library and settings are retained.'));
      if (pending) body.append(el('p', 'chess-study-hint', 'Pending action: ' + pending.type + ' · needs ' + needed + ' free slot(s). ' + draftNotice));
      if (deferredNotice) body.append(el('p', 'chess-study-hint', deferredNotice));
      const actions = el('div', 'chess-study-toolbar');
      actions.append(button('Export original stored bytes', () => download(store.original(), 'chess-lab-original.json', 'application/json')));
      actions.append(button('Export studies', () => { refresh(); download(exportJSON(), 'chess-lab-studies.json', 'application/json'); message('Download requested. Studies were not removed; saving the file to disk is not verified.'); }));
      if (pending) actions.append(button('Export pending work', () => download(JSON.stringify({ schema: 'chess-lab-pending', version: 1, operation: pending }, null, 2), 'chess-lab-pending.json', 'application/json')));
      actions.append(button('Undo last removal', undoLastRemoval), button('Export recovery', () => { const text = store.recovery(); if (!text) throw Error('No recovery snapshot.'); download(text, 'chess-lab-recovery.json', 'application/json'); }));
      body.append(actions);
      const label = el('label', 'chess-study-label', 'Remove particular study'), search = el('input'); search.type = 'search'; search.placeholder = 'Find title or stable ID'; label.append(search); body.append(label);
      const list = el('div', 'chess-capacity-list'), selected = new Set(); list.setAttribute('role', 'group'); list.setAttribute('aria-label', 'Select Studies to remove');
      for (const study of state.studies) {
        const row = el('label', 'chess-capacity-row'), check = el('input'); check.type = 'checkbox'; check.value = study.id;
        check.addEventListener('change', () => { check.checked ? selected.add(study.id) : selected.delete(study.id); remove.disabled = !selected.size; });
        row.append(check, el('span', '', study.title + ' · ' + study.id + ' · ' + Object.keys(study.nodes).length + ' positions')); list.append(row);
      }
      search.addEventListener('input', () => { for (const row of list.children) row.hidden = !row.textContent.toLowerCase().includes(search.value.toLowerCase()); });
      body.append(list);
      const remove = button('Remove selected Studies', () => { confirmation = { ids: [...selected], revision: state.revision }; render(); }); remove.disabled = true;
      const all = button('Remove all studies (' + count + ')', () => { confirmation = { ids: state.studies.map(x => x.id), revision: state.revision }; render(); }, 'chess-study-danger'); all.disabled = !count;
      const removals = el('div', 'chess-study-toolbar'); removals.append(remove, all); body.append(removals);
      if (confirmation) {
        const c = confirmation, box = el('section', 'chess-capacity-confirm'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Confirm Study removal');
        box.append(el('p', '', 'Remove exactly ' + c.ids.length + ' selected LAB Study record(s)? ' + (c.noRecovery ? 'No recovery copy could be verified. Export first. A download alone does not prove you saved a backup.' : 'A verified local undo snapshot will be required. It replaces the previous removal snapshot.')));
        box.append(button('Cancel removal', () => { confirmation = null; render(); }), button(c.noRecovery ? 'Remove without recovery' : 'Confirm removal', () => removeStudies(c.ids, c.revision, !!c.noRecovery), 'chess-study-danger')); body.append(box);
      }
      const footer = el('div', 'chess-study-toolbar'), resume = button('Continue pending action', resumePending, 'chess-study-primary');
      resume.disabled = !pending || busy || state.studies.length + needed > S.LIMIT;
      footer.append(button('Cancel / keep current work', cancelPending), button('Close / retain draft', close), resume);
      if (pending) footer.append(button('Discard pending draft', () => { if (root.confirm('Discard this pending Study draft? The workspace board and saved Studies stay unchanged. Export pending work first if needed.')) { generation++; clearPending(); deferredNotice = ''; render(); } })); body.append(footer);
    }
    function contextLine(context) {
      const ctx = context || host.getContext() || {}, history = ctx.moves || ctx.history;
      if (Array.isArray(history)) return { startFen: ctx.startFen || ctx.rootFen || C.START_FEN, moves: history.map(m => typeof m === 'string' ? m : m.from + m.to + (m.promotion || '')) };
      if (ctx.pgn) {
        const imported = C.parsePGN(Chess, ctx.pgn), moves = []; let n = imported.nodes.root;
        while (n.children.length) { n = imported.nodes[n.children[0]]; moves.push(n.move); if (n.fen === ctx.fen) break; }
        if (ctx.fen === imported.rootFen) moves.length = 0;
        return { startFen: imported.rootFen, moves };
      }
      return { startFen: ctx.fen || C.START_FEN, moves: [] };
    }
    function queueRecord(context, annotation) {
      const ctx = clone(context || host.getContext()), line = contextLine(ctx);
      if (annotation?.moves) line.moves = clone(annotation.moves);
      const checked = C.preview(Chess, line.startFen, line.moves);
      if (ctx?.fen && checked.at(-1).fen !== ctx.fen) throw Error('Study history does not end at the workspace position');
      const selected = current(), epoch = generation;
      let fallbackStudy;
      if (annotation?.sourcePGN) {
        fallbackStudy = C.parsePGN(Chess, annotation.sourcePGN);
        if (fallbackStudy.rootFen !== line.startFen) throw Error('Original PGN has a different starting position');
      } else fallbackStudy = C.create(Chess, { rootFen: line.startFen, title: 'Workspace study' });
      let targetId = selected?.rootFen === line.startFen ? selected.id : null;
      if (!targetId) {
        if (!recordReservation || recordReservation.rootFen !== line.startFen) recordReservation = { rootFen: line.startFen, study: fallbackStudy };
        fallbackStudy = clone(recordReservation.study); targetId = fallbackStudy.id;
      }
      const request = { type: annotation ? 'recordAnnotated' : 'record', studyId: targetId, ...line, fallbackStudy, context: ctx };
      if (annotation) request.comments = clone(annotation.comments || []);
      queuedRecords++;
      const job = recordQueue.then(() => {
        if (destroyed || epoch !== generation) return { ok: false, code: 'CANCELLED' };
        return perform(request);
      });
      recordQueue = job.catch(() => {}).finally(() => { if (--queuedRecords === 0) recordReservation = null; });
      return job;
    }
    function recordPosition(context) { return queueRecord(context); }
    function exportWorkspacePGN(context, options = {}) { return queueRecord(context, clone(options)); }
    function captureContext() { return recordPosition(host.getContext()); }
    function newStudy() {
      const ctx = clone(host.getContext()), line = contextLine(ctx), study = C.create(Chess, { rootFen: line.startFen, title: 'Study ' + (state.studies.length + 1) });
      C.addLine(Chess, study, line.moves, line.startFen); return perform({ type: 'append', study, context: ctx });
    }
    function importPGN(text, options = {}) { return perform({ type: 'append', study: C.parsePGN(Chess, text) }, true, options.onCommitted); }
    function exportPGN() { const study = current(); return study ? C.toPGN(Chess, study) : ''; }
    function exportJSON() { return JSON.stringify(state, null, 2); }
    function importJSON(text) {
      if (typeof text !== 'string' || S.bytes(text) > S.MAX) throw Error('Oversized JSON import');
      const parsed = JSON.parse(text);
      if (parsed.schema === 'chess-lab-pending' && parsed.version === 1 && parsed.operation) {
        if (pending) throw Error('Finish or cancel the existing pending action first.');
        const op = parsed.operation;
        if (!['append', 'import', 'record', 'recordAnnotated', 'line', 'annotatePath', 'undo'].includes(op.type)) throw Error('Unsupported pending operation');
        // Restored draft is reviewed and revalidated by the same transaction; never auto-executed.
        if (typeof op.id !== 'string' || !op.id || !Number.isSafeInteger(op.baseRevision) || op.baseRevision < 0) throw Error('Pending work lacks its original safe-retry identity. Review and import its content as a new Study only after checking saved data.');
        pending = clone(op); saveDraft(); showManager(); return { ok: false, code: 'PENDING_RESTORED' };
      }
      if (parsed.schema === 'chess-lab-study') return perform({ type: 'append', study: C.validate(Chess, parsed) });
      return perform({ type: 'import', collection: S.validate(C, Chess, parsed) });
    }
    function annotatePath({ moves, comments, studyId }) {
      return perform({ type: 'annotatePath', studyId: studyId || state.activeId, moves: clone(moves), comments: clone(comments) });
    }
    function saveLine({ fen, moves, pv, title, comment }) {
      const line = clone(moves || pv || []); C.preview(Chess, fen, line);
      if (!line.length) throw Error('There is no continuation to save');
      const study = current(), parentId = study?.nodes[study.selectedId]?.fen === fen ? study.selectedId : Object.keys(study?.nodes || {}).find(id => study.nodes[id].fen === fen);
      return perform({ type: 'line', studyId: study?.id, parentId, fen, moves: line, title, comment,
        fallbackStudy: C.create(Chess, { rootFen: fen, title: title || 'Analyzed position' }) });
    }
    function download(text, name, type) {
      const url = URL.createObjectURL(new Blob([text], { type })), a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function filename(study, ext) { return (study?.title || 'chess-studies').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 70) + '.' + ext; }
    function linePreview(study, id) {
      const nodes = C.path(study, id); activePreview = { title: study.nodes[id].name || (nodes.at(-1)?.san || 'Starting position'), positions: C.preview(Chess, study.rootFen, nodes.map(n => n.move)), studyId: study.id, nodeId: id };
      previewIndex = activePreview.positions.length - 1;
    }
    function preview({ fen, moves, title, analysis }) {
      const positions = C.preview(Chess, fen, moves || []);
      activePreview = { title: String(title || 'Variation preview').slice(0, 200), positions, originFen: fen, analysis: analysis || null, candidate: positions[1]?.move || null };
      previewIndex = 0; open('preview', false);
    }
    async function navigateStudy(study, id) {
      if (typeof host.navigate !== 'function') throw Error('Workspace navigation is unavailable');
      host.pause?.();
      const saved = await perform({ type: 'select', studyId: study.id, nodeId: id }, false);
      if (!saved.ok) return;
      const selected = saved.study, moves = C.path(selected, id).map(n => n.move);
      host.navigate({ startFen: selected.rootFen, rootFen: selected.rootFen, moves, pgn: C.toPGN(Chess, selected), fen: selected.nodes[id].fen });
      close();
    }
    async function pin(slot, provided) {
      const ctx = host.getContext(), item = provided || C.snapshot(ctx.fen, ctx.analysis, { label: 'Workspace · ' + new Date().toLocaleTimeString() });
      state.comparison = C.pin(state.comparison, slot, item); await persist();
      if (visible) { tab = 'compare'; render(); } return item;
    }
    function render() {
      body.replaceChildren(); message();
      if (capacity) { renderManager(); return; }
      heading.textContent = 'Study & compare'; tabs.hidden = false;
      for (const [id, b] of Object.entries(tabButtons)) { b.classList.toggle('is-active', id === tab); b.setAttribute('aria-pressed', String(id === tab)); }
      if (tab === 'study') renderStudy(); else if (tab === 'compare') renderCompare(); else renderPreview(body);
    }
    function renderStudy() {
      const study = current();
      const toolbar = el('div', 'chess-study-toolbar'), select = el('select'); select.setAttribute('aria-label', 'Saved study');
      for (const s of state.studies) { const option = el('option', '', s.title); option.value = s.id; option.selected = s.id === state.activeId; select.append(option); }
      select.addEventListener('change', () => guard(async () => { const saved = await perform({ type: 'select', studyId: select.value }, false); if (saved.ok) { activePreview = null; render(); } }));
      toolbar.append(select, button('New study from workspace', newStudy), button('Manage Studies', showManager)); body.append(toolbar);
      if (!study) { body.append(el('p', '', 'Open a game or import PGN to begin.')); renderImport(body); return; }
      // Keep the editor's target and base separate from mutable in-memory state.
      // A conflict refreshes that state, while these inputs stay available for review/retry.
      let expectedStudy = JSON.stringify(store.get().studies.find(item => item.id === study.id) ?? null);
      async function editStudy(patch) {
        try { return await perform({ type: 'edit', studyId: study.id, expectedStudy, ...clone(patch) }, false); }
        catch (error) {
          const latest = state.studies.find(item => item.id === study.id);
          expectedStudy = JSON.stringify(latest ?? null);
          if (error.code === 'CONFLICT') {
            const savedText = patch.annotation ? latest?.nodes[patch.nodeId]?.comments?.join(' · ') : latest?.title;
            error.message += ' Your input is retained. Latest saved value: ' + (savedText || '(empty or removed)').slice(0, 300) + '. Review it, then retry to apply your input.';
          }
          showError(error);
          if (error.code === 'CONFLICT') status.append(button('Retry this change', async () => { const saved = await editStudy(patch); if (saved.ok) message('Change saved.'); }));
          return { ok: false, code: error.code };
        }
      }
      const titleLabel = el('label', 'chess-study-label', 'Study name'), title = el('input'); title.value = study.title; title.maxLength = 160;
      title.addEventListener('change', () => guard(async () => { await editStudy({ title: title.value }); })); titleLabel.append(title); body.append(titleLabel);
      body.append(el('p', 'chess-study-hint', 'Click a move to preview it here. “Open position in workspace” is the only action that changes the playing board. Alternate moves remain saved.'));
      const columns = el('div', 'chess-study-columns'), tree = el('div', 'chess-study-tree'); tree.setAttribute('aria-label', 'Saved variations');
      tree.append(button('Starting position', () => { study.selectedId = 'root'; linePreview(study, 'root'); render(); }, 'chess-study-move'));
      const jobs = [...study.nodes.root.children].reverse().map(id => ({ id, depth: 0 })); let shown = 0;
      while (jobs.length && shown < treeLimit) {
        const item = jobs.pop(), n = study.nodes[item.id], parent = study.nodes[n.parentId], bits = parent.fen.split(' ');
        const label = bits[5] + (bits[1] === 'w' ? '. ' : '… ') + n.san + (n.nags.length ? ' ' + n.nags.map(x => ({ 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' }[x] || '$' + x)).join(' ') : '') + (n.name ? ' — ' + n.name : '');
        const row = el('div', 'chess-study-node'); row.style.setProperty('--branch-depth', Math.min(item.depth, 6));
        const move = button(label, () => { study.selectedId = n.id; linePreview(study, n.id); render(); }, 'chess-study-move'); move.classList.toggle('is-selected', study.selectedId === n.id); row.append(move);
        if (n.comments.length) row.append(el('span', 'chess-study-comment-summary', n.comments.join(' · ').slice(0, 160)));
        tree.append(row); shown++;
        for (let i = n.children.length - 1; i >= 0; i--) jobs.push({ id: n.children[i], depth: item.depth + (i > 0 ? 1 : 0) });
      }
      if (jobs.length) tree.append(button('Show 150 more positions', () => { treeLimit += 150; render(); }));
      const detail = el('div', 'chess-study-detail');
      if (!activePreview || activePreview.studyId !== study.id || activePreview.nodeId !== study.selectedId) linePreview(study, study.selectedId || 'root');
      renderPreview(detail, true);
      const selected = study.nodes[study.selectedId] || study.nodes.root;
      const nameLabel = el('label', 'chess-study-label', 'Variation / position name'), name = el('input'); name.value = selected.name; name.maxLength = 160; nameLabel.append(name);
      const commentLabel = el('label', 'chess-study-label', 'Comments'), comment = el('textarea'); comment.value = selected.comments.join('\n'); comment.maxLength = C.LIMITS.comment; comment.rows = 4; commentLabel.append(comment);
      const nagLabel = el('label', 'chess-study-label', 'Move annotation'), nag = el('select');
      for (const [value, label] of [['keep', 'Keep existing glyphs'], ['none', 'Remove glyphs'], ['1', '! — good move'], ['2', '? — mistake'], ['3', '!! — brilliant move'], ['4', '?? — blunder'], ['5', '!? — interesting move'], ['6', '?! — dubious move']]) { const option = el('option', '', label); option.value = value; nag.append(option); }
      nag.disabled = selected.id === 'root'; nagLabel.append(nag);
      detail.append(nameLabel, commentLabel, nagLabel, button('Save annotation', async () => {
        const values = { name: name.value, comment: comment.value };
        if (nag.value !== 'keep') values.nags = nag.value === 'none' ? [] : [Number(nag.value)];
        const saved = await editStudy({ nodeId: selected.id, annotation: values });
        if (saved.ok) message('Annotation saved.');
      }));
      detail.append(button('Open position in workspace', () => navigateStudy(study, selected.id), 'chess-study-primary'));
      if (selected.parentId) detail.append(button('Make this the main variation', () => editStudy({ nodeId: selected.id, main: true })));
      columns.append(tree, detail); body.append(columns);
      const exports = el('div', 'chess-study-toolbar'); exports.append(button('Export PGN + variations', () => download(exportPGN(), filename(study, 'pgn'), 'application/x-chess-pgn')), button('Export all studies + A/B JSON', () => download(exportJSON(), 'chess-lab-studies.json', 'application/json')));
      body.append(exports); renderImport(body);
      body.append(button('Remove this saved study…', () => { showManager(); confirmation = { ids: [study.id], revision: state.revision }; render(); }));
    }
    function renderImport(target) {
      const details = el('details', 'chess-study-import'); details.append(el('summary', '', 'Import PGN / JSON'));
      const text = el('textarea'); text.rows = 5; text.maxLength = C.LIMITS.bytes; text.placeholder = 'Paste one PGN game with variations and comments, or study JSON'; text.setAttribute('aria-label', 'PGN or study JSON');
      const input = el('input'); input.type = 'file'; input.accept = '.pgn,.json,text/plain,application/json'; input.setAttribute('aria-label', 'Import study file');
      input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; if (file.size > 4500000) { message('File too large (4.5 MB maximum).'); return; } try { const value = await file.text(); const result = await (file.name.toLowerCase().endsWith('.json') ? importJSON(value) : importPGN(value)); if (result?.ok) message('Imported as a saved study. Workspace unchanged.'); } catch (e) { message(e.message); } });
      details.append(text, button('Import as saved study', async () => { const result = await (text.value.trim().startsWith('{') ? importJSON(text.value) : importPGN(text.value)); if (result?.ok) message('Imported as a saved study. Workspace unchanged.'); }), input); target.append(details);
    }
    function renderPreview(target, compact) {
      if (!activePreview) { target.append(el('p', '', 'Choose a saved move or a candidate continuation to preview.')); return; }
      const box = el('div', 'chess-study-preview'); box.append(el('h3', '', activePreview.title));
      const position = activePreview.positions[previewIndex], board = el('div', 'chess-study-board'); board.setAttribute('role', 'img'); board.setAttribute('aria-label', 'Preview position, ' + (position.fen.split(' ')[1] === 'w' ? 'White' : 'Black') + ' to move. FEN ' + position.fen);
      const symbols = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
      position.fen.split(' ')[0].split('/').forEach((rank, r) => { let f = 0; for (const piece of rank) { if (/\d/.test(piece)) { for (let k = 0; k < Number(piece); k++) { const square = el('span', (r + f++) % 2 ? 'is-dark' : 'is-light', ''); board.append(square); } } else { const square = el('span', ((r + f++) % 2 ? 'is-dark' : 'is-light') + (piece === piece.toUpperCase() ? ' white-piece' : ' black-piece'), symbols[piece] || ''); board.append(square); } } });
      box.append(board);
      const controls = el('div', 'chess-study-preview-controls');
      for (const [label, index, title] of [['|◀', 0, 'Preview first position'], ['◀', Math.max(0, previewIndex - 1), 'Preview previous move'], ['▶', Math.min(activePreview.positions.length - 1, previewIndex + 1), 'Preview next move'], ['▶|', activePreview.positions.length - 1, 'Preview last position']]) {
        const b = button(label, () => { previewIndex = index; render(); }); b.setAttribute('aria-label', title); b.disabled = index === previewIndex; controls.append(b);
      }
      controls.append(el('span', '', previewIndex + ' / ' + (activePreview.positions.length - 1))); box.append(controls);
      const moves = el('div', 'chess-study-preview-moves'); activePreview.positions.forEach((p, i) => { const b = button(p.san, () => { previewIndex = i; render(); }); b.classList.toggle('is-selected', i === previewIndex); moves.append(b); }); box.append(moves);
      const fen = el('code', 'chess-study-fen', position.fen); box.append(fen);
      if (!compact && activePreview.analysis && activePreview.originFen) {
        const pins = el('div', 'chess-study-toolbar'); for (const slot of ['A', 'B']) pins.append(button('Pin this candidate as ' + slot, () => pin(slot, C.snapshot(activePreview.originFen, activePreview.analysis, { label: activePreview.title, candidate: activePreview.candidate })))); box.append(pins);
      }
      target.append(box);
    }
    function renderCompare() {
      const comparison = state.comparison, label = el('label', 'chess-study-label', 'Question for this position'), question = el('textarea'); question.rows = 2; question.maxLength = 2000; question.placeholder = 'Does this sacrifice survive the strongest defence?'; question.value = comparison.question;
      question.addEventListener('change', () => guard(async () => { state.comparison.question = question.value; await persist(); })); label.append(question); body.append(label);
      body.append(el('p', 'chess-study-hint', 'Pin two candidates or two analysis runs from exactly the same origin position. Snapshots stay unchanged when live analysis updates. DCC rank is not a centipawn evaluation.'));
      if (comparison.originFen) {
        body.append(el('code', 'chess-study-fen', comparison.originFen));
        body.append(button('Open pinned origin in workspace', () => {
          if (typeof host.navigate !== 'function') throw Error('Workspace navigation is unavailable');
          host.pause?.(); const origin = comparison.originFen, study = C.create(Chess, { rootFen: origin, title: comparison.question || 'A/B origin' });
          host.navigate({ startFen: origin, rootFen: origin, moves: [], fen: origin, pgn: C.toPGN(Chess, study) }); close();
        }));
      }
      const columns = el('div', 'chess-study-comparison');
      for (const slot of ['A', 'B']) {
        const panel = el('section', 'chess-study-snapshot'), item = comparison[slot]; panel.append(el('h3', '', slot), button('Pin workspace analysis as ' + slot, () => pin(slot)));
        if (item) {
          panel.append(el('strong', '', item.label || 'Analysis snapshot'), el('p', 'chess-study-hint', item.capturedAt));
          const candidates = Array.isArray(item.analysis.candidates) ? item.analysis.candidates : [], table = el('table'), thead = el('thead'), tr = el('tr');
          const provider = item.analysis.receipt?.provider === 'SF' ? 'SF' : 'CDB';
          for (const title of ['Candidate', `${provider} score`, 'DCC rank', 'Coverage']) tr.append(el('th', '', title)); thead.append(tr); table.append(thead);
          const tbody = el('tbody');
          for (const candidate of candidates.slice(0, 80)) {
            const row = el('tr'), move = candidate.move || candidate.uci;
            if (item.candidate && move !== item.candidate) continue;
            let san = String(move || '?'); try { san = C.preview(Chess, item.fen, [move])[1].san; } catch (_) { /* Malformed provider candidate remains descriptive only. */ }
            const cell = el('td'), pv = Array.isArray(candidate.pv) ? candidate.pv : Array.isArray(candidate.movePath) ? [move, ...candidate.movePath] : Array.isArray(candidate.moves) ? candidate.moves : [move];
            cell.append(button(san, () => {
              let line = pv; if (pv[0] !== move) line = [move, ...pv];
              preview({ fen: item.fen, moves: line, title: slot + ' · ' + san, analysis: item.analysis });
            }));
            const root = item.analysis.allMoves?.find(m => m.move === move);
            const raw = Number.isFinite(candidate.raw) ? candidate.raw : candidate.score;
            const score = root?.scoreType === 'mate' ? `mate #${root.mateIn}` : Number.isFinite(raw) ? `${raw} cp` : 'unknown';
            const data = candidate.data || candidate;
            row.append(cell, el('td', '', score), el('td', '', Number.isFinite(data.dccScore) ? data.dccScore.toFixed(2) : 'unknown'), el('td', '', data.complete === true ? 'sampled path complete' : 'partial / unknown')); tbody.append(row);
          }
          table.append(tbody); panel.append(table);
          const receipt = el('details'); receipt.append(el('summary', '', 'Source and analysis receipt'), el('pre', '', JSON.stringify(item.analysis.receipt, null, 2))); panel.append(receipt);
          panel.append(button('Clear ' + slot, async () => { state.comparison[slot] = null; if (!state.comparison.A && !state.comparison.B) state.comparison.originFen = null; await persist(); render(); }));
        } else panel.append(el('p', '', 'No snapshot pinned.'));
        columns.append(panel);
      }
      body.append(columns);
      body.append(button('Export A/B evidence JSON', () => download(JSON.stringify({ schema: 'chess-lab-studies', version: 1, studies: [], activeId: null, comparison: state.comparison }, null, 2), 'chess-ab-comparison.json', 'application/json')));
      body.append(button('Start a new comparison', async () => { state.comparison = { question: '', originFen: null, A: null, B: null }; await persist(); render(); }));
    }
    function open(which, capture = true) {
      refresh(); capacity = false;
      if (capture && !current() && !pending) guard(captureContext);
      host.pause?.(); tab = ['study', 'compare', 'preview'].includes(which) ? which : 'study';
      if (!visible) priorFocus = document.activeElement;
      visible = true; overlay.hidden = false; render(); dialog.focus();
    }
    function showLoadProblem(error) { showManager(); showError(Error('Game could not be loaded: ' + (error?.message || String(error)) + '. The current game was kept.')); }
    function close() { visible = false; overlay.hidden = true; if (priorFocus?.isConnected) priorFocus.focus(); }
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    function keys(event) {
      if (!visible) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]),input,select,textarea,a[href],[tabindex="0"]')].filter(n => n.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { last.focus(); event.preventDefault(); }
      else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
    }
    document.addEventListener('keydown', keys, true);
    if (host.onChange) unsubscribe = host.onChange(ctx => { if (!pending) guard(() => recordPosition(ctx)); });
    const onStorage = e => { if (e.key === KEY && !busy) { if (visible && !capacity) { message('Studies changed in another tab. Reopen to review; stale edits will not overwrite them.'); } else { refresh(); if (visible) { confirmation = null; render(); message('Studies changed in another tab. Review before removing.'); } } } };
    root.addEventListener('storage', onStorage);
    return { open, close, preview, pin, showLoadProblem, manage: showManager, resumePending, cancelPending, refresh, getPending: () => pending && clone(pending), captureContext, recordPosition: ctx => guard(() => recordPosition(ctx)), importPGN, importJSON, exportPGN, exportWorkspacePGN, exportJSON, newStudy, annotatePath, saveLine,
      getStudy: () => current(), getComparison: () => JSON.parse(JSON.stringify(state.comparison)),
      destroy() { destroyed = true; committedEffects.clear(); root.removeEventListener('storage', onStorage); unsubscribe?.(); document.removeEventListener('keydown', keys, true); overlay.remove(); } };
  }
  root.ChessStudyUI = { create, STORAGE_KEY: KEY };
})(typeof window === 'object' ? window : this);
