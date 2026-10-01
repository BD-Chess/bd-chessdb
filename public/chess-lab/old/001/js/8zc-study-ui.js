/* Saved variations and pinned evidence. Main-board navigation is always explicit. */
(function (root) {
  'use strict';
  const KEY = 'chessLabStudy-v1';
  function create(host) {
    const C = root.ChessStudy, Chess = host.Chess || root.Chess;
    if (!C || !Chess || typeof host.getContext !== 'function') throw Error('Study requires ChessStudy, Chess and getContext');
    const mount = host.mount || document.body, storage = host.storage || root.localStorage;
    let state = { schema: 'chess-lab-studies', version: 1, studies: [], activeId: null, comparison: { question: '', A: null, B: null, originFen: null } };
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
    function guard(fn) { try { return fn(); } catch (e) { status.textContent = e.message || String(e); status.classList.add('is-error'); return undefined; } }
    function message(text) { status.textContent = text || persistenceMessage || loadWarning; status.classList.remove('is-error'); }
    function current() { return state.studies.find(s => s.id === state.activeId) || null; }
    function persist() {
      try {
        const text = JSON.stringify(state);
        if (text.length > 4500000) throw Error('Saved studies are too large for this browser. Export JSON to keep a copy.');
        storage.setItem(KEY, text); persistenceMessage = '';
      } catch (e) { persistenceMessage = 'Changes are in memory only: ' + (e.message || 'browser storage unavailable') + ' Export JSON before closing.'; message(persistenceMessage); }
    }
    function validatedState(value) {
      if (!value || value.schema !== 'chess-lab-studies' || value.version !== 1 || !Array.isArray(value.studies) || value.studies.length > 20) throw Error('Invalid study collection');
      const studies = value.studies.map(s => C.validate(Chess, s)), ids = new Set(studies.map(s => s.id));
      if (ids.size !== studies.length) throw Error('Duplicate study IDs');
      let comparison = { question: '', A: null, B: null, originFen: null };
      if (value.comparison) {
        comparison.question = String(value.comparison.question || '').slice(0, 2000);
        for (const slot of ['A', 'B']) if (value.comparison[slot]) {
          const s = value.comparison[slot]; C.preview(Chess, s.fen, []);
          comparison = C.pin(comparison, slot, { ...C.snapshot(s.fen, s.analysis, { label: s.label, candidate: s.candidate }), capturedAt: String(s.capturedAt || '').slice(0, 100) });
        }
      }
      return { schema: 'chess-lab-studies', version: 1, studies, activeId: ids.has(value.activeId) ? value.activeId : studies[0]?.id || null, comparison };
    }
    try { const saved = storage.getItem(KEY); if (saved) { if (saved.length > 4500000) throw Error('Oversized saved study collection'); state = validatedState(JSON.parse(saved)); } }
    catch (e) {
      loadWarning = 'Saved studies could not be read: ' + e.message + '. A recovery copy is kept when browser storage allows.';
      try { const damaged = storage.getItem(KEY); if (damaged) storage.setItem(KEY + '-recovery', damaged); } catch (_) { /* Keep current in-memory study usable. */ }
    }
    function appendStudy(study) {
      if (state.studies.length >= 20) throw Error('20 saved studies reached. Export the collection, then remove an unneeded study.');
      if (state.studies.some(s => s.id === study.id)) study.id = C.create(Chess).id;
      state.studies.push(study); state.activeId = study.id; activePreview = null; treeLimit = 150; persist(); return study;
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
    function recordPosition(context) {
      const ctx = context || host.getContext(), line = contextLine(ctx);
      const checked = C.preview(Chess, line.startFen, line.moves);
      if (ctx?.fen && checked[checked.length - 1].fen !== ctx.fen) throw Error('Study history does not end at the workspace position');
      let study = current();
      if (!study || study.rootFen !== line.startFen) study = appendStudy(C.create(Chess, { rootFen: line.startFen, title: state.studies.length ? 'Workspace study ' + (state.studies.length + 1) : 'Workspace study' }));
      C.addLine(Chess, study, line.moves, line.startFen); persist();
      if (visible && tab === 'study') render(); return study.selectedId;
    }
    function captureContext() { return recordPosition(host.getContext()); }
    function newStudy() {
      const ctx = host.getContext(), line = contextLine(ctx), study = C.create(Chess, { rootFen: line.startFen, title: 'Study ' + (state.studies.length + 1) });
      C.addLine(Chess, study, line.moves, line.startFen); appendStudy(study); if (visible) render(); return study.id;
    }
    function importPGN(text) { const study = C.parsePGN(Chess, text); appendStudy(study); if (visible) render(); return study; }
    function exportPGN() { const study = current(); return study ? C.toPGN(Chess, study) : ''; }
    function exportJSON() { return JSON.stringify(state, null, 2); }
    function importJSON(text) {
      if (typeof text !== 'string' || text.length > 4500000) throw Error('Oversized JSON import');
      const parsed = JSON.parse(text);
      if (parsed.schema === 'chess-lab-study') appendStudy(C.validate(Chess, parsed));
      else {
        const incoming = validatedState(parsed);
        if (state.studies.length + incoming.studies.length > 20) throw Error('Import would exceed 20 saved studies; export/remove some first');
        for (const study of incoming.studies) appendStudy(study);
        // A collection import explicitly restores its saved comparison.
        state.comparison = incoming.comparison; persist();
      }
      if (visible) render();
    }
    function annotatePath({ moves, comments }) {
      const study = current(); if (!study) throw Error('No active study');
      const id = C.addLine(Chess, study, moves), path = C.path(study, id);
      if (!Array.isArray(comments) || comments.length > path.length) throw Error('Invalid annotation path');
      comments.forEach((text, i) => { if (text) { const comment = String(text).slice(0, C.LIMITS.comment).replace(/{/g, '(').replace(/}/g, ')'); if (!path[i].comments.includes(comment)) path[i].comments.push(comment); } });
      persist(); if (visible) render();
    }
    function saveLine({ fen, moves, pv, title, comment }) {
      const line = moves || pv || [], positions = C.preview(Chess, fen, line);
      if (positions.length < 2) throw Error('There is no continuation to save');
      let study = current(), parentId = null;
      if (study) {
        if (study.nodes[study.selectedId]?.fen === fen) parentId = study.selectedId;
        else parentId = Object.keys(study.nodes).find(id => study.nodes[id].fen === fen) || null;
      }
      if (!parentId) { study = appendStudy(C.create(Chess, { rootFen: fen, title: title || 'Analyzed position' })); parentId = 'root'; }
      if (Object.keys(study.nodes).length + line.length > C.LIMITS.nodes) throw Error('Study size limit reached; save this continuation in a new study');
      let first = null, id = parentId;
      for (const move of line) { id = C.addMove(Chess, study, id, move); if (!first) first = id; }
      const entry = study.nodes[first];
      if (title) entry.name = String(title).slice(0, 160);
      if (comment) { const safe = String(comment).slice(0, C.LIMITS.comment).replace(/{/g, '(').replace(/}/g, ')'); if (!entry.comments.includes(safe)) entry.comments.push(safe); }
      study.selectedId = id; persist(); if (visible) render();
      return { studyId: study.id, nodeId: id, message: 'Continuation saved with its alternatives in ' + study.title };
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
    function navigateStudy(study, id) {
      if (typeof host.navigate !== 'function') throw Error('Workspace navigation is unavailable');
      host.pause?.(); const moves = C.path(study, id).map(n => n.move);
      study.selectedId = id; persist();
      host.navigate({ startFen: study.rootFen, rootFen: study.rootFen, moves, pgn: C.pathPGN(Chess, study, id), fen: study.nodes[id].fen });
      close();
    }
    function pin(slot, provided) {
      const ctx = host.getContext(), item = provided || C.snapshot(ctx.fen, ctx.analysis, { label: 'Workspace · ' + new Date().toLocaleTimeString() });
      state.comparison = C.pin(state.comparison, slot, item); persist();
      if (visible) { tab = 'compare'; render(); } return item;
    }
    function render() {
      body.replaceChildren(); message();
      for (const [id, b] of Object.entries(tabButtons)) { b.classList.toggle('is-active', id === tab); b.setAttribute('aria-pressed', String(id === tab)); }
      if (tab === 'study') renderStudy(); else if (tab === 'compare') renderCompare(); else renderPreview(body);
    }
    function renderStudy() {
      const study = current();
      const toolbar = el('div', 'chess-study-toolbar'), select = el('select'); select.setAttribute('aria-label', 'Saved study');
      for (const s of state.studies) { const option = el('option', '', s.title); option.value = s.id; option.selected = s.id === state.activeId; select.append(option); }
      select.addEventListener('change', () => { state.activeId = select.value; activePreview = null; persist(); render(); });
      toolbar.append(select, button('New study from workspace', newStudy)); body.append(toolbar);
      if (!study) { body.append(el('p', '', 'Open a game or import PGN to begin.')); renderImport(body); return; }
      const titleLabel = el('label', 'chess-study-label', 'Study name'), title = el('input'); title.value = study.title; title.maxLength = 160;
      title.addEventListener('change', () => { study.title = title.value.trim() || 'Untitled study'; study.headers.Event = study.title; persist(); render(); }); titleLabel.append(title); body.append(titleLabel);
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
      detail.append(nameLabel, commentLabel, nagLabel, button('Save annotation', () => {
        const values = { name: name.value, comment: comment.value };
        if (nag.value !== 'keep') values.nags = nag.value === 'none' ? [] : [Number(nag.value)];
        C.annotate(study, selected.id, values); persist(); render(); message('Annotation saved.');
      }));
      detail.append(button('Open position in workspace', () => navigateStudy(study, selected.id), 'chess-study-primary'));
      if (selected.parentId) detail.append(button('Make this the main variation', () => { const siblings = study.nodes[selected.parentId].children; siblings.splice(siblings.indexOf(selected.id), 1); siblings.unshift(selected.id); persist(); render(); }));
      columns.append(tree, detail); body.append(columns);
      const exports = el('div', 'chess-study-toolbar'); exports.append(button('Export PGN + variations', () => download(exportPGN(), filename(study, 'pgn'), 'application/x-chess-pgn')), button('Export all studies + A/B JSON', () => download(exportJSON(), 'chess-lab-studies.json', 'application/json')));
      body.append(exports); renderImport(body);
      const remove = el('details', 'chess-study-import'); remove.append(el('summary', '', 'Remove this saved study'));
      remove.append(el('p', 'chess-study-hint', 'Export the study first if you need to keep it. This only removes the saved study, not the workspace game.'));
      remove.append(button('Remove “' + study.title + '”', () => { state.studies = state.studies.filter(s => s.id !== study.id); state.activeId = state.studies[0]?.id || null; activePreview = null; persist(); render(); })); body.append(remove);
    }
    function renderImport(target) {
      const details = el('details', 'chess-study-import'); details.append(el('summary', '', 'Import PGN / JSON'));
      const text = el('textarea'); text.rows = 5; text.maxLength = C.LIMITS.bytes; text.placeholder = 'Paste one PGN game with variations and comments, or study JSON'; text.setAttribute('aria-label', 'PGN or study JSON');
      const input = el('input'); input.type = 'file'; input.accept = '.pgn,.json,text/plain,application/json'; input.setAttribute('aria-label', 'Import study file');
      input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; if (file.size > 4500000) { message('File too large (4.5 MB maximum).'); return; } try { const value = await file.text(); if (file.name.toLowerCase().endsWith('.json')) importJSON(value); else importPGN(value); message('Imported as a saved study. Workspace unchanged.'); } catch (e) { message(e.message); } });
      details.append(text, button('Import as saved study', () => { if (text.value.trim().startsWith('{')) importJSON(text.value); else importPGN(text.value); message('Imported as a saved study. Workspace unchanged.'); }), input); target.append(details);
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
      question.addEventListener('input', () => { state.comparison.question = question.value; persist(); }); label.append(question); body.append(label);
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
          for (const title of ['Candidate', 'CDB cp', 'DCC rank', 'Coverage']) tr.append(el('th', '', title)); thead.append(tr); table.append(thead);
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
            row.append(cell, el('td', '', Number.isFinite(candidate.raw) ? String(candidate.raw) : Number.isFinite(candidate.score) ? String(candidate.score) : 'unknown'), el('td', '', Number.isFinite(candidate.dccScore) ? candidate.dccScore.toFixed(2) : 'unknown'), el('td', '', candidate.complete === true ? 'sampled path complete' : 'partial / unknown')); tbody.append(row);
          }
          table.append(tbody); panel.append(table);
          const receipt = el('details'); receipt.append(el('summary', '', 'Source and analysis receipt'), el('pre', '', JSON.stringify(item.analysis.receipt, null, 2))); panel.append(receipt);
          panel.append(button('Clear ' + slot, () => { state.comparison[slot] = null; if (!state.comparison.A && !state.comparison.B) state.comparison.originFen = null; persist(); render(); }));
        } else panel.append(el('p', '', 'No snapshot pinned.'));
        columns.append(panel);
      }
      body.append(columns);
      body.append(button('Export A/B evidence JSON', () => download(JSON.stringify({ schema: 'chess-lab-studies', version: 1, studies: [], activeId: null, comparison: state.comparison }, null, 2), 'chess-ab-comparison.json', 'application/json')));
      body.append(button('Start a new comparison', () => { state.comparison = { question: '', originFen: null, A: null, B: null }; persist(); render(); }));
    }
    function open(which, capture = true) {
      if (capture && !current()) guard(captureContext);
      host.pause?.(); tab = ['study', 'compare', 'preview'].includes(which) ? which : 'study';
      if (!visible) priorFocus = document.activeElement;
      visible = true; overlay.hidden = false; render(); dialog.focus();
    }
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
    if (host.onChange) unsubscribe = host.onChange(ctx => guard(() => recordPosition(ctx)));
    return { open, close, preview, pin, captureContext, recordPosition: ctx => guard(() => recordPosition(ctx)), importPGN, importJSON, exportPGN, exportJSON, newStudy, annotatePath, saveLine,
      getStudy: () => current(), getComparison: () => JSON.parse(JSON.stringify(state.comparison)),
      destroy() { unsubscribe?.(); document.removeEventListener('keydown', keys, true); overlay.remove(); } };
  }
  root.ChessStudyUI = { create, STORAGE_KEY: KEY };
})(typeof window === 'object' ? window : this);
