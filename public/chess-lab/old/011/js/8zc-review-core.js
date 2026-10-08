/* Whole-game navigation from the loaded PGN. This module never requests an engine score. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessGameReview = api;
})(typeof window === 'object' ? window : globalThis, function (root) {
  'use strict';
  const VERSION = '1.0.0';
  const EDITORIAL = /\b(?:critical moment|turning point|key moment|compare|alternative|defen[cs]e|blunder|mistake|decisive|sacrifice|counterplay|missed)\b/i;
  const NAG = { 1: 'Good move', 2: 'Mistake', 3: 'Brilliant move', 4: 'Blunder', 5: 'Interesting move', 6: 'Dubious move' };
  const clean = value => String(value || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  function formatMove(fen, san) {
    const fields = fen.split(' ');
    return (fields[5] || '1') + (fields[1] === 'b' ? '... ' : '. ') + san;
  }
  function play(Chess, rootFen, inputMoves) {
    if (!Array.isArray(inputMoves) || inputMoves.length > 5000) throw Error('Invalid review main line');
    const game = new Chess();
    if (!game.load(rootFen)) throw Error('Invalid review starting position');
    const positions = [{ ply: 0, fen: game.fen(), san: null, move: null, moveLabel: 'Starting position' }];
    const moves = [];
    for (const input of inputMoves) {
      const move = typeof input === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input)
        ? { from: input.slice(0, 2), to: input.slice(2, 4), promotion: input[4] } : input;
      let played;
      try { played = game.move(move, { sloppy: true }); } catch (_) { played = null; }
      if (!played) throw Error('Review main line contains an illegal move');
      const uci = played.from + played.to + (played.promotion || '');
      const previous = positions[positions.length - 1];
      positions.push({ ply: positions.length, fen: game.fen(), san: played.san,
        move: uci, moveLabel: formatMove(previous.fen, played.san) });
      moves.push(uci);
    }
    return { positions, moves };
  }
  function extractMainline(study) {
    const ids = [], moves = [];
    let node = study.nodes.root;
    while (node.children.length) {
      node = study.nodes[node.children[0]];
      ids.push(node.id); moves.push(node.move);
    }
    return { ids, moves };
  }
  function createMoment(positions, ply, title, detail, basis, source, priority) {
    if (!Number.isInteger(ply) || ply < 0 || ply >= positions.length - 1) return null;
    return { id: 'ply-' + ply, ply, fen: positions[ply].fen, moveLabel: positions[ply + 1].moveLabel,
      title: clean(title).slice(0, 180), detail: clean(detail).slice(0, 1800), basis, source, priority };
  }
  function curatedAnchor(headers, positions) {
    const raw = headers.ChessBestAnchorPly;
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return null;
    const ply = Number(raw);
    if (!Number.isSafeInteger(ply) || ply >= positions.length) return null;
    if (headers.ChessBestAnchorFEN && headers.ChessBestAnchorFEN !== positions[ply].fen) return null;
    if (headers.ChessBestAnchorSAN && headers.ChessBestAnchorSAN !== positions[ply].san) return null;
    return ply;
  }
  function fallbackMoments(positions, moments) {
    // These are navigation checkpoints, never purported engine discoveries.
    const total = positions.length - 1;
    const candidates = total < 12 ? [Math.floor(total / 2)] :
      [Math.min(20, Math.floor(total / 3)), Math.floor(total / 2), Math.floor(total * .8)];
    for (const ply of [...new Set(candidates)]) {
      if (ply <= 0 || ply >= total || moments.some(m => Math.abs(m.ply - ply) < 7)) continue;
      moments.push(createMoment(positions, ply, `Position after ${positions[ply].moveLabel}`,
        'Navigation checkpoint. Explore the continuation and analyze this position if it interests you.',
        'Navigation', 'Recorded game', 0));
    }
  }
  function tcecContext(headers) {
    const isTcec = /\bTCEC\b/i.test([headers.Event, headers.Site, headers.ChessBestSourceURL].join(' '));
    const value = key => isTcec ? clean(headers[key]) || null : null;
    return { isTcec, opening: value('Opening'), termination: value('Termination'),
      terminationDetails: value('TerminationDetails'), round: value('Round'),
      engineWhite: value('White'), engineBlack: value('Black'),
      // A paired opening, engine score or PV needs its own source game / record.
      pairedOpening: null, historicEvaluations: null, principalVariations: null };
  }
  function build(input) {
    if (!input || typeof input !== 'object') throw Error('A loaded game is required for review');
    const Chess = input.Chess || root.Chess;
    const Study = input.ChessStudy || root.ChessStudy ||
      (typeof module === 'object' && module.exports ? require('./8zc-study-core.js') : null);
    if (typeof Chess !== 'function') throw Error('Chess is unavailable for review');
    let study = null, mainline = null;
    if (typeof input.pgn === 'string' && input.pgn.trim() && Study?.parsePGN) {
      try { study = Study.parsePGN(Chess, input.pgn); mainline = extractMainline(study); }
      catch (_) { /* A playable host main line remains useful, without PGN annotations. */ }
    }
    const headers = Object.assign(Object.create(null), study?.headers || {}, input.headers || {});
    if (input.lineChanged || input.sourceIsOriginal === false) {
      for (const key of Object.keys(headers)) if (key.startsWith('ChessBest')) delete headers[key];
    }
    const rootFen = input.startFen || study?.rootFen || new Chess().fen();
    const selected = Array.isArray(input.moves) ? input.moves : mainline?.moves;
    if (!selected || !selected.length) throw Error('Load a game with recorded moves to review it');
    const { positions, moves } = play(Chess, rootFen, selected);
    const annotationsAligned = study && study.rootFen === positions[0].fen &&
      mainline.moves.length === moves.length && mainline.moves.every((move, index) => move === moves[index]);
    const sourceStatus = annotationsAligned ? 'PGN main line verified' : 'PGN annotations unavailable';
    const moments = [];
    if (annotationsAligned) {
      for (let index = 0; index < mainline.ids.length; index++) {
        const node = study.nodes[mainline.ids[index]], ply = index + 1;
        for (const comment of node.comments || []) {
          const note = clean(comment).replace(/\[%\w+\s+[^\]]*\]/g, '').trim();
          if (!EDITORIAL.test(note)) continue;
          const critical = /\b(?:critical moment|turning point|key moment)\b/i.test(note);
          const at = critical ? ply : Math.max(0, ply - 1);
          const moment = createMoment(positions, at,
            critical ? `PGN key moment · ${positions[at + 1]?.moveLabel || ''}` : `PGN note · ${positions[at + 1]?.moveLabel || ''}`,
            note, 'PGN annotation', headers.ChessBestTitle ? 'ChessBest curated PGN' : 'Source PGN', critical ? 100 : 65);
          if (moment) moments.push(moment);
        }
        if (node.nags?.length) {
          const labels = [...new Set(node.nags.map(nag => NAG[nag]).filter(Boolean))];
          if (labels.length) {
            const moment = createMoment(positions, index, `${labels.join(' / ')} · ${positions[ply].moveLabel}`,
              `The recorded PGN marks ${positions[ply].moveLabel} with ${labels.join(' / ').toLowerCase()}. Check the alternatives at this position.`,
              'PGN annotation', 'Source PGN glyph', 55);
            if (moment) moments.push(moment);
          }
        }
      }
    }
    // An anchor names an existing position. It only supplies an editorial highlight
    // when it has a matching source comment; a header alone makes no evaluation claim.
    if (annotationsAligned) {
      const anchor = curatedAnchor(headers, positions);
      if (anchor !== null) {
        const original = moments.find(m => m.ply === anchor && m.basis === 'PGN annotation');
        if (original) original.priority = 120;
        else {
          const moment = createMoment(positions, anchor, clean(headers.ChessBestTitle) || 'Curated position',
            clean(headers.ChessBestTeaser) || 'A curated position in the recorded game.',
            'Curated PGN position', 'ChessBest Top Picks', 90);
          if (moment) moments.push(moment);
        }
      }
    }
    const retained = [];
    for (const moment of moments.sort((a, b) => b.priority - a.priority || a.ply - b.ply)) {
      if (retained.some(item => item.ply === moment.ply)) continue;
      retained.push(moment);
      if (retained.length === 12) break;
    }
    fallbackMoments(positions, retained);
    retained.sort((a, b) => a.ply - b.ply);
    return { version: VERSION, rootFen: positions[0].fen, headers, moves, positions,
      moments: retained.map(({ priority, ...moment }) => moment), totalPly: moves.length,
      sourceStatus, tcec: tcecContext(headers),
      analysis: { status: 'not-computed', source: null, evaluations: null } };
  }
  return { VERSION, build };
});
