/* Chess study trees. No DOM, network or implicit access to the playing board. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessStudy = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const VERSION = '1.0.0', LIMITS = Object.freeze({ bytes: 2000000, nodes: 5000, nesting: 128, comment: 12000, snapshots: 600000 });
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const RESULTS = ['1-0', '0-1', '1/2-1/2', '*'];
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function bounded(value, max, label) {
    if (typeof value !== 'string' || value.length > max || /\u0000/.test(value)) throw Error('Invalid or oversized ' + label);
    return value;
  }
  function gameAt(Chess, fen) {
    bounded(fen, 120, 'FEN'); const game = new Chess();
    if (!game.load(fen)) throw Error('Invalid FEN');
    return game;
  }
  function node(id, parentId, move, san, fen) {
    return { id, parentId, move, san, fen, children: [], comments: [], startingComments: [], nags: [], name: '' };
  }
  function create(Chess, options) {
    const o = options || {}, rootFen = gameAt(Chess, o.rootFen || START_FEN).fen();
    return { schema: 'chess-lab-study', version: 1, id: o.id || ('study-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)),
      title: String(o.title || 'Untitled study').slice(0, 160), rootFen, rootId: 'root', nextId: 1,
      headers: Object.create(null), nodes: { root: node('root', null, null, null, rootFen) }, result: '*', selectedId: 'root' };
  }
  function moveObject(move) {
    if (typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return { from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] };
    return move;
  }
  function play(game, move) {
    try { return game.move(moveObject(move), { sloppy: true }); } catch (_) { return null; }
  }
  function addMove(Chess, study, parentId, move, options) {
    const parent = study.nodes[parentId]; if (!parent) throw Error('Unknown parent position');
    const game = gameAt(Chess, parent.fen), played = play(game, move);
    if (!played) throw Error('Illegal move: ' + String(move));
    const uci = played.from + played.to + (played.promotion || '');
    if (!(options && options.separate)) {
      const same = parent.children.find(id => study.nodes[id].move === uci);
      if (same) return same;
    }
    if (Object.keys(study.nodes).length >= LIMITS.nodes) throw Error('Study limit reached (5000 positions). Export and start another study.');
    const id = 'n' + study.nextId++;
    study.nodes[id] = node(id, parentId, uci, played.san, game.fen()); parent.children.push(id);
    return id;
  }
  function path(study, id) {
    const out = [], seen = new Set(); let n = study.nodes[id];
    if (!n) throw Error('Unknown position');
    while (n.parentId !== null) {
      if (seen.has(n.id) || out.length >= LIMITS.nodes) throw Error('Invalid study tree');
      seen.add(n.id); out.push(n); n = study.nodes[n.parentId]; if (!n) throw Error('Invalid study parent');
    }
    return out.reverse();
  }
  function addLine(Chess, study, moves, startFen) {
    if (startFen && gameAt(Chess, startFen).fen() !== study.rootFen) throw Error('This line has a different starting position');
    if (!Array.isArray(moves) || moves.length >= LIMITS.nodes) throw Error('Invalid move line');
    let id = study.rootId;
    // Validate before mutating, so an invalid trailing move cannot leave a partial line.
    const game = gameAt(Chess, study.rootFen);
    const checked = moves.map(m => { const p = play(game, m); if (!p) throw Error('Illegal move in line: ' + String(m)); return p.from + p.to + (p.promotion || ''); });
    for (const m of checked) id = addMove(Chess, study, id, m);
    study.selectedId = id; return id;
  }
  function scan(text) {
    bounded(text, LIMITS.bytes, 'PGN'); const tokens = []; let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (/\s|\uFEFF/.test(c)) { i++; continue; }
      if (c === '%' && (i === 0 || text[i - 1] === '\n')) { while (i < text.length && text[i] !== '\n') i++; continue; }
      if (c === '{' || c === ';') {
        const end = c === '{' ? text.indexOf('}', i + 1) : text.indexOf('\n', i + 1);
        if (c === '{' && end < 0) throw Error('Unclosed PGN comment');
        const to = end < 0 ? text.length : end;
        const value = bounded(text.slice(i + 1, to), LIMITS.comment, 'comment');
        if (c === '{' && value.includes('{')) throw Error('Nested PGN comment braces are not supported');
        tokens.push({ type: 'comment', value }); i = to + 1; continue;
      }
      if (c === '[') {
        const match = /^\[\s*([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\s*\]/.exec(text.slice(i));
        if (!match || match[1].length > 80 || match[2].length > 2000) throw Error('Invalid PGN tag');
        tokens.push({ type: 'tag', name: match[1], value: match[2].replace(/\\(["\\])/g, '$1') }); i += match[0].length; continue;
      }
      if ('()'.includes(c)) { tokens.push({ type: c }); i++; continue; }
      if (c === '*') { tokens.push({ type: 'word', value: '*' }); i++; continue; }
      if (c === '$') {
        const nag = /^\$\d+/.exec(text.slice(i)); if (!nag) throw Error('Invalid PGN annotation glyph');
        tokens.push({ type: 'word', value: nag[0] }); i += nag[0].length; continue;
      }
      if (c === '}' || c === ']') throw Error('Unexpected PGN delimiter');
      const match = /^[^\s{}();\[\]$*]+/.exec(text.slice(i)); if (!match) throw Error('Invalid PGN character');
      let value = match[0]; i += value.length;
      value = value.replace(/^\d+\.(?:\.\.)?/, '');
      if (value && value !== '...') tokens.push({ type: 'word', value });
      if (tokens.length > LIMITS.nodes * 12) throw Error('Too many PGN annotations');
    }
    return tokens;
  }
  function parsePGN(Chess, text) {
    const tokens = scan(text), headers = Object.create(null); let k = 0;
    while (k < tokens.length && tokens[k].type === 'tag') { headers[tokens[k].name] = tokens[k].value; k++; }
    const study = create(Chess, { rootFen: headers.FEN || START_FEN, title: headers.Event || 'Imported study' });
    study.headers = headers; let current = 'root', stack = [], pending = [], atVariationStart = false, ended = false;
    for (; k < tokens.length; k++) {
      const token = tokens[k], currentNode = study.nodes[current];
      if (token.type === 'tag') throw Error('Import one game at a time');
      if (token.type === '(') {
        if (current === 'root' || ended) throw Error('Variation must follow a move');
        if (stack.length >= LIMITS.nesting) throw Error('PGN variation nesting limit reached');
        stack.push({ current, ended, atVariationStart, pending }); current = currentNode.parentId; ended = false; atVariationStart = true; pending = []; continue;
      }
      if (token.type === ')') {
        if (!stack.length || atVariationStart) throw Error('Empty or unmatched PGN variation');
        const saved = stack.pop(); current = saved.current; ended = saved.ended; atVariationStart = saved.atVariationStart; pending = saved.pending; continue;
      }
      if (token.type === 'comment') {
        const named = /^\[%study_name\s+([^\]]*)\]$/.exec(token.value.trim());
        if (named && !atVariationStart) {
          try { currentNode.name = bounded(decodeURIComponent(named[1]), 160, 'variation name'); } catch (_) { currentNode.comments.push(token.value); }
        } else if (atVariationStart) pending.push(token.value); else currentNode.comments.push(token.value);
        continue;
      }
      const word = token.value;
      if (RESULTS.includes(word)) { if (!stack.length) study.result = word; else currentNode.result = word; ended = true; continue; }
      if (ended) throw Error('Moves after a result: import one game at a time');
      if (/^\$\d+$/.test(word)) { if (current === 'root' || atVariationStart || Number(word.slice(1)) > 255) throw Error('Invalid PGN annotation glyph'); currentNode.nags.push(Number(word.slice(1))); continue; }
      if (/^[!?]{1,2}$/.test(word)) { if (current === 'root' || atVariationStart) throw Error('Annotation without move'); currentNode.nags.push({ '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 }[word]); continue; }
      const suffix = /([!?]{1,2})$/.exec(word), san = suffix ? word.slice(0, -suffix[0].length) : word;
      const parent = current;
      // An imported duplicate RAV may have distinct comments; keep both branches.
      current = addMove(Chess, study, parent, san, { separate: true });
      const added = study.nodes[current]; added.startingComments = pending; pending = []; atVariationStart = false;
      if (suffix) added.nags.push({ '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 }[suffix[0]]);
    }
    if (stack.length) throw Error('Unclosed PGN variation');
    if (!RESULTS.includes(study.headers.Result)) study.headers.Result = study.result;
    else if (study.result !== '*' && study.headers.Result !== study.result) throw Error('PGN header and movetext results disagree');
    else study.result = study.headers.Result;
    study.selectedId = 'root'; return study;
  }
  function annotate(study, id, values) {
    const n = study.nodes[id]; if (!n) throw Error('Unknown study position');
    if (values.name !== undefined) n.name = bounded(values.name, 160, 'variation name');
    if (values.comment !== undefined) {
      const comment = bounded(values.comment, LIMITS.comment, 'comment');
      if (/[{}]/.test(comment)) throw Error('Use parentheses instead of braces in PGN comments');
      n.comments = comment ? [comment] : [];
    }
    if (values.nags !== undefined) {
      if (!Array.isArray(values.nags) || values.nags.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw Error('Invalid annotation glyphs');
      n.nags = [...values.nags];
    }
  }
  const escapeTag = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
  const commentText = value => '{' + String(value).replace(/{/g, '(').replace(/}/g, ')') + '}';
  function tokenFor(study, n) {
    const parent = study.nodes[n.parentId], bits = parent.fen.split(' '), number = bits[5];
    let tokens = n.startingComments.map(commentText);
    tokens.push(number + (bits[1] === 'w' ? '.' : '...'), n.san);
    for (const nag of n.nags) tokens.push('$' + nag);
    if (n.name) tokens.push('{[%study_name ' + encodeURIComponent(n.name).replace(/\]/g, '%5D') + ']}');
    tokens.push(...n.comments.map(commentText)); return tokens;
  }
  function toPGN(Chess, input) {
    const study = validate(Chess, input), headers = Object.assign(Object.create(null), study.headers);
    if (!headers.Event) headers.Event = study.title;
    headers.Result = study.result;
    if (study.rootFen !== START_FEN) { headers.SetUp = '1'; headers.FEN = study.rootFen; } else { delete headers.SetUp; delete headers.FEN; }
    const tags = Object.keys(headers).map(k => '[' + k + ' "' + escapeTag(headers[k]) + '"]').join('\n');
    // Iterative traversal avoids stack overflow for long single-line games.
    const out = study.nodes.root.comments.map(commentText), jobs = [];
    if (study.nodes.root.children.length) jobs.push({ kind: 'siblings', ids: study.nodes.root.children });
    while (jobs.length) {
      const job = jobs.pop();
      if (job.kind === 'text') { out.push(job.text); continue; }
      if (job.kind === 'siblings') {
        const ids = job.ids, first = study.nodes[ids[0]];
        if (first.children.length) jobs.push({ kind: 'siblings', ids: first.children });
        if (first.result) jobs.push({ kind: 'text', text: first.result });
        for (let j = ids.length - 1; j > 0; j--) { jobs.push({ kind: 'text', text: ')' }); jobs.push({ kind: 'line', id: ids[j] }); jobs.push({ kind: 'text', text: '(' }); }
        jobs.push({ kind: 'text', text: tokenFor(study, first).join(' ') });
      } else {
        const n = study.nodes[job.id];
        if (n.result) jobs.push({ kind: 'text', text: n.result });
        if (n.children.length) jobs.push({ kind: 'siblings', ids: n.children });
        jobs.push({ kind: 'text', text: tokenFor(study, n).join(' ') });
      }
    }
    out.push(study.result); return tags + '\n\n' + out.join(' ') + '\n';
  }
  function pathPGN(Chess, study, id) {
    const copy = create(Chess, { rootFen: study.rootFen, title: study.title });
    addLine(Chess, copy, path(study, id).map(n => n.move)); return toPGN(Chess, copy);
  }
  function validate(Chess, input) {
    if (!input || input.schema !== 'chess-lab-study' || input.version !== 1 || !input.nodes || typeof input.nodes !== 'object') throw Error('Unsupported study JSON');
    const serialized = JSON.stringify(input); bounded(serialized, LIMITS.bytes, 'study');
    const study = create(Chess, { rootFen: input.rootFen, title: bounded(input.title, 160, 'title'), id: bounded(input.id, 100, 'study ID') });
    const source = input.nodes, ids = Object.keys(source);
    if (ids.length > LIMITS.nodes || input.rootId !== 'root' || !own(source, 'root') || source.root.parentId !== null) throw Error('Invalid study root');
    if (input.headers && typeof input.headers === 'object') for (const key of Object.keys(input.headers)) {
      if (!/^[A-Za-z0-9_]{1,80}$/.test(key)) throw Error('Invalid PGN tag name');
      study.headers[key] = bounded(input.headers[key], 2000, 'PGN tag');
    }
    if (!RESULTS.includes(input.result)) throw Error('Invalid result'); study.result = input.result;
    const seen = new Set(), jobs = [{ id: 'root', targetId: 'root' }], remap = new Map([['root', 'root']]);
    while (jobs.length) {
      const { id, targetId } = jobs.shift();
      if (typeof id !== 'string' || !own(source, id) || seen.has(id)) throw Error('Study cycle or duplicate child'); seen.add(id);
      const src = source[id], dst = study.nodes[targetId];
      if (!src || src.id !== id || !Array.isArray(src.children) || !Array.isArray(src.comments) || !Array.isArray(src.startingComments) || !Array.isArray(src.nags)) throw Error('Invalid study node');
      if (src.fen !== dst.fen) throw Error('Study position does not match legal move path');
      dst.name = bounded(src.name || '', 160, 'variation name');
      dst.comments = src.comments.map(c => bounded(c, LIMITS.comment, 'comment'));
      dst.startingComments = src.startingComments.map(c => bounded(c, LIMITS.comment, 'comment'));
      if (src.nags.length > 256 || src.nags.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw Error('Invalid annotation glyph'); dst.nags = [...src.nags];
      if (src.result !== undefined) { if (!RESULTS.includes(src.result)) throw Error('Invalid branch result'); dst.result = src.result; }
      for (const child of src.children) {
        if (typeof child !== 'string' || !own(source, child) || source[child].parentId !== id || remap.has(child)) throw Error('Invalid study link');
        const next = addMove(Chess, study, targetId, bounded(source[child].move, 5, 'move'), { separate: true });
        remap.set(child, next); jobs.push({ id: child, targetId: next });
      }
    }
    if (seen.size !== ids.length) throw Error('Unreachable study nodes');
    study.selectedId = remap.get(input.selectedId) || 'root'; return study;
  }
  function importJSON(Chess, text) { bounded(text, LIMITS.bytes, 'JSON'); let input; try { input = JSON.parse(text); } catch (_) { throw Error('Invalid JSON'); } return validate(Chess, input); }
  function preview(Chess, fen, moves) {
    const game = gameAt(Chess, fen), positions = [{ fen: game.fen(), san: 'Start', move: null }];
    if (!Array.isArray(moves) || moves.length > 1000) throw Error('Invalid preview line');
    for (const m of moves) { const p = play(game, m); if (!p) throw Error('Preview contains an illegal move: ' + String(m)); positions.push({ fen: game.fen(), san: p.san, move: p.from + p.to + (p.promotion || '') }); }
    return positions;
  }
  function snapshot(fen, analysis, options) {
    const o = options || {};
    if (!analysis || !analysis.receipt || analysis.receipt.fen !== fen) throw Error('Wait for analysis of this exact position before pinning');
    let copy; try { const text = JSON.stringify(analysis); bounded(text, LIMITS.snapshots, 'analysis snapshot'); copy = JSON.parse(text); } catch (e) { throw Error('Cannot save analysis snapshot: ' + e.message); }
    return { fen, capturedAt: new Date().toISOString(), label: String(o.label || '').slice(0, 160), candidate: o.candidate || null, analysis: copy };
  }
  function pin(comparison, slot, item) {
    if (!['A', 'B'].includes(slot)) throw Error('Invalid comparison slot');
    if (!item || !item.analysis || item.fen !== item.analysis.receipt?.fen) throw Error('Snapshot position mismatch');
    const other = comparison[slot === 'A' ? 'B' : 'A'];
    if (other && other.fen !== item.fen) throw Error('A and B must use the same origin FEN. Return to the pinned position or start a new comparison.');
    return { ...comparison, originFen: item.fen, [slot]: item };
  }
  return { VERSION, LIMITS, START_FEN, create, addMove, addLine, path, parsePGN, toPGN, pathPGN, annotate, validate, importJSON, preview, snapshot, pin };
});
