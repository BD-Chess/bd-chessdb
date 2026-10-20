/* Whole-game navigation from the loaded PGN. This module never requests an engine score. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessGameReview = api;
})(typeof window === 'object' ? window : globalThis, function (root) {
  'use strict';
  const VERSION = '2.0.0';
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
  function decodeCdb(raw) {
    if (!Number.isFinite(raw)) return { type: 'unknown' };
    if (Number.isInteger(raw) && Math.abs(raw) >= 29000 && Math.abs(raw) <= 30000)
      return { type: 'mate', raw, sign: raw > 0 ? 1 : -1,
        plies: 30000 - Math.abs(raw), encoding: 'CDB-30000' };
    return Math.abs(raw) < 10000 ? { type: 'cp', cp: raw } : { type: 'special', raw };
  }
  function typedScore(input) {
    if (!input || typeof input !== 'object') return { type: 'unknown' };
    const bound = ['lower', 'upper'].includes(input.bound) ? input.bound : null;
    if (input.type === 'cp' && Number.isFinite(input.cp))
      return { type: 'cp', cp: input.cp, bound, pov: input.pov === 'white' ? 'white' : 'mover' };
    if (input.type === 'mate' && [1, -1].includes(input.sign)) {
      const plies = Number.isSafeInteger(input.plies) && input.plies >= 0 && input.plies <= 1000 ? input.plies : null;
      const moves = Number.isSafeInteger(input.moves) && input.moves >= 0 && input.moves <= 1000 ? input.moves : null;
      if (plies === null && moves === null) return { type: 'unknown' };
      if (input.encoding === 'CDB-30000' && (plies !== 30000 - Math.abs(input.raw) ||
        Math.sign(input.raw) !== input.sign)) return { type: 'unknown' };
      return { type: 'mate', sign: input.sign, plies, moves, raw: input.raw,
        encoding: input.encoding, bound, pov: input.pov === 'white' ? 'white' : 'mover' };
    }
    if (input.type === 'special' && Number.isFinite(input.raw)) return { type: 'special', raw: input.raw };
    return { type: 'unknown' };
  }
  function whiteFactor(score, fen) {
    return score.pov === 'white' || fen.split(' ')[1] === 'w' ? 1 : -1;
  }
  function scoreText(input, fen, perspective = 'mover') {
    const score = typedScore(input);
    const factor = perspective === 'white' ? whiteFactor(score, fen) :
      score.pov === 'white' && fen.split(' ')[1] === 'b' ? -1 : 1;
    if (score.type === 'cp') {
      const cp = score.cp * factor;
      const bound = score.bound ? ((score.bound === 'lower') === (factor === 1) ? '≥' : '≤') : '';
      return bound + (cp > 0 ? '+' : cp < 0 ? '−' : '') + (Math.abs(cp) / 100).toFixed(2);
    }
    if (score.type === 'mate') {
      const distance = score.moves ?? Math.ceil(score.plies / 2);
      return (score.sign * factor < 0 ? '−' : '') + 'M' + distance +
        (score.plies !== null ? ' · ' + score.plies + ' plies' : '');
    }
    return score.type === 'special' ? 'Special code ' + score.raw : 'Unknown';
  }
  function pgnScore(comment) {
    const match = String(comment).match(/\[%eval\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)|#[+-]?\d+)(?:,\s*(\d+))?\s*\]/i);
    if (!match) return null;
    const token = match[1];
    const score = token[0] === '#' ?
      { type: 'mate', sign: Number(token.slice(1)) < 0 ? -1 : 1, moves: Math.abs(Number(token.slice(1))), pov: 'white' } :
      { type: 'cp', cp: Math.round(Number(token) * 100), pov: 'white' };
    const normalized = typedScore(score);
    return normalized.type === 'unknown' ? null : { score: normalized,
      depth: match[2] ? Number(match[2]) : null, source: 'PGN eval annotation' };
  }
  function validatePV(Chess, fen, pv, expectedFirst) {
    if (!Array.isArray(pv) || !pv.length || pv.length > 256 || (expectedFirst && pv[0] !== expectedFirst))
      throw Error('Saved variation does not match its candidate');
    const game = new Chess();
    if (!game.load(fen)) throw Error('Invalid saved variation root');
    const steps = [{ fen, san: null, label: 'Before the candidate', move: null }];
    for (const uci of pv) {
      if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw Error('Invalid saved variation move');
      const before = game.fen();
      const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (!move) throw Error('Saved variation contains an illegal move');
      steps.push({ fen: game.fen(), san: move.san, label: formatMove(before, move.san), move: uci });
    }
    return { steps, checkmate: game.in_checkmate() };
  }
  function hashText(text) {
    const Hash = root.ChessAssetSHA256 ||
      (typeof module === 'object' && module.exports ? require('./8zc-sha256.js') : null);
    if (!Hash) throw Error('Review integrity checker unavailable');
    // The canonical mainline is ASCII UCI joined by a single space.
    return new Hash.SHA256().update(Uint8Array.from(text, c => c.charCodeAt(0))).hex();
  }
  function resolveEvidence(review, registry) {
    if (!registry || registry.schema !== 'chessbest-review-registry/1' ||
      !Array.isArray(registry.entries) || registry.entries.length > 20)
      throw Error('Saved review registry unavailable');
    const claimed = review.headers.ChessBestReviewEvidence;
    const entries = registry.entries.filter(e => claimed ? e.alias === claimed :
      e.source === review.headers.ChessBestSource && Boolean(e.source));
    if (!entries.length) {
      if (claimed) throw Error('Saved review identity mismatch');
      return null;
    }
    const digest = hashText(review.moves.join(' '));
    const matches = entries.filter(e => e.rootFen === review.rootFen && e.mainline_sha256 === digest &&
      e.totalPly === review.totalPly && review.positions[e.anchor?.ply]?.fen === e.anchor?.fen &&
      review.moves[e.anchor?.ply] === e.anchor?.played);
    if (matches.length !== 1) throw Error('Saved review identity mismatch');
    const e = matches[0];
    if (!/^[a-z0-9][a-z0-9_-]{1,100}$/.test(e.id) ||
      !/^config\/(?:review-[a-z0-9_-]+|dreev-kasparov-review)\.json$/.test(e.file) ||
      !/^[a-f0-9]{64}$/.test(e.sha256) || !Number.isSafeInteger(e.bytes) || e.bytes < 1 || e.bytes > 2097152)
      throw Error('Invalid saved review registration');
    return e;
  }
  function attachEvidence(review, evidence, Chess = root.Chess, registration = null) {
    const expectedId = registration?.alias || review?.headers.ChessBestReviewEvidence;
    if (!review || evidence?.schema !== 'chessbest-review-evidence/1' ||
      evidence.id !== expectedId || evidence.rootFen !== review.rootFen ||
      evidence.moves?.length !== review.moves.length ||
      !evidence.moves.every((move, i) => move === review.moves[i]) ||
      evidence.positions?.length !== review.positions.length || review.totalPly > 5000 ||
      (evidence.mainline_sha256 && evidence.mainline_sha256 !== hashText(review.moves.join(' '))) ||
      !Array.isArray(evidence.decisions) || evidence.decisions.length > 256 ||
      !evidence.sources || !['cdb','sf'].every(p => evidence.sources[p] &&
        typeof evidence.sources[p].label === 'string' && evidence.sources[p].label.length <= 180))
      throw Error('Saved analysis belongs to a different recorded line');
    if (registration && (registration.rootFen !== review.rootFen ||
      registration.mainline_sha256 !== hashText(review.moves.join(' ')))) throw Error('Saved review identity mismatch');
    const replayed = play(Chess, review.rootFen, review.moves);
    const positions = evidence.positions.map((row, ply) => {
      const fen = replayed.positions[ply].fen;
      if (row.ply !== ply || row.fen !== fen || row.played !== (review.moves[ply] || null))
        throw Error('Saved analysis position identity mismatch');
      const legal = new Map(new Chess(fen).moves({ verbose: true }).map(m => [m.from + m.to + (m.promotion || ''), m.san]));
      const source = (input, name, nested = false) => {
        if (!input || !Array.isArray(input.candidates) || input.candidates.length > 256) throw Error('Invalid saved source');
        if (input.positionEstimate && nested) throw Error('Nested saved source estimate');
        const candidates = input.candidates.map(candidate => {
          if (!legal.has(candidate.uci)) throw Error('Saved candidate is illegal');
          const score = typedScore(candidate.score);
          if (candidate.score?.pov && !['white', 'mover'].includes(candidate.score.pov)) throw Error('Invalid saved POV');
          if (name === 'cdb' && score.type === 'cp' && Math.abs(score.cp) >= 10000)
            throw Error('Special CDB score mislabeled as centipawns');
          if (candidate.score?.type !== score.type) throw Error('Invalid saved score type');
          const pv = candidate.pv ? validatePV(Chess, fen, candidate.pv, candidate.uci) : null;
          if (candidate.heuristic != null && !Number.isFinite(candidate.heuristic)) throw Error('Invalid saved heuristic');
          return { uci: candidate.uci, san: legal.get(candidate.uci), score, pv, heuristic: candidate.heuristic ?? null };
        });
        if (new Set(candidates.map(c => c.uci)).size !== candidates.length) throw Error('Duplicate saved candidates');
        const positionScore = input.positionScore == null ? null : typedScore(input.positionScore);
        if (positionScore && (positionScore.type !== input.positionScore.type ||
          (input.positionScore.pov && !['white','mover'].includes(input.positionScore.pov)))) throw Error('Invalid saved position score');
        if ((candidates.length || positionScore) && (typeof input.at !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(input.at)))
          throw Error('Missing saved source date');
        if (input.legal_count != null && input.legal_count !== legal.size) throw Error('Saved legal coverage mismatch');
        return { ...input, candidates, positionScore,
          positionEstimate: input.positionEstimate ? source(input.positionEstimate, name, true) : null };
      };
      if (row.observations && (!Array.isArray(row.observations) || row.observations.length > 50)) throw Error('Invalid saved observations');
      return { ...row, cdb: source(row.cdb, 'cdb'), sf: source(row.sf, 'sf'),
        comparison: row.comparison ? source(row.comparison, 'sf') : null,
        observations: (row.observations || []).map(input => {
          if (!['cdb','sf','dcc'].includes(input.provider)) throw Error('Invalid saved provider');
          return source(input, input.provider);
        }) };
    });
    const types = { cp: 0, mate: 0, special: 0, unknown: 0 };
    let sfPlayed = 0;
    for (const row of positions.slice(0, -1)) {
      types[row.cdb.candidates.find(m => m.uci === row.played)?.score.type || 'unknown']++;
      if (row.sf.candidates.some(m => m.uci === row.played && ['cp','mate'].includes(m.score.type))) sfPlayed++;
    }
    for (const [type, count] of Object.entries(types))
      if ((evidence.coverage?.cdb_played_types?.[type] || 0) !== count) throw Error('Saved coverage count mismatch');
    const decisions = evidence.decisions.map(decision => {
      if (!Number.isSafeInteger(decision.ply) || decision.ply < 0 || decision.ply >= review.totalPly)
        throw Error('Invalid saved decision position');
      if (!decision.human || !Array.isArray(decision.human.candidates_san) || decision.human.candidates_san.length > 256 ||
        !decision.human.candidates_san.every(c => typeof c === 'string')) throw Error('Invalid saved human annotation');
      return { ...decision, title: clean(decision.title), lesson: clean(decision.lesson) };
    });
    if (evidence.notes && (!Array.isArray(evidence.notes) || evidence.notes.length > 256)) throw Error('Invalid saved notes');
    const notes = (evidence.notes || []).map(note => {
      if (!Number.isSafeInteger(note.ply) || note.ply < 0 || note.ply >= review.totalPly ||
        typeof note.text !== 'string' || note.text.length > 10000) throw Error('Invalid saved note identity');
      return { ply: note.ply, text: clean(note.text) };
    });
    const scored = value => ['cp','mate'].includes(typedScore(value).type);
    const positionCount = provider => positions.filter(row => scored(row[provider].positionScore) ||
      row[provider].candidates.some(c => scored(c.score))).length;
    return { ...review, evidence: { ...evidence, positions, decisions, notes,
      coverage: { ...evidence.coverage, cdb_played_types: types, sf_played: sfPlayed,
        cdb_scored: types.cp + types.mate, cdb_positions: positionCount('cdb'), sf_positions: positionCount('sf') } } };
  }
  function plotSeries(rows, provider, perspective = 'white') {
    const segments = [];
    let segment = [];
    for (const row of rows) {
      const source = row[provider]?.positionEstimate || row[provider];
      const input = provider === 'pgn' ? row.pgn?.score : source?.positionScore ?? source?.candidates?.[0]?.score;
      const score = typedScore(input);
      if (!['cp', 'mate'].includes(score.type) || score.bound) {
        if (segment.length) segments.push(segment);
        segment = [];
        continue;
      }
      const factor = perspective === 'white' ? whiteFactor(score, row.fen) :
        score.pov === 'white' && row.fen.split(' ')[1] === 'b' ? -1 : 1;
      // Mate stays a typed edge marker. It never becomes a fabricated cp value.
      segment.push({ ply: row.ply, score, cp: score.type === 'cp' ? score.cp * factor : null,
        mateSign: score.type === 'mate' ? score.sign * factor : null });
    }
    if (segment.length) segments.push(segment);
    return segments;
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
    const pgnEvaluations = positions.map(position => ({ ply: position.ply, fen: position.fen, pgn: null }));
    if (annotationsAligned) {
      for (let index = 0; index < mainline.ids.length; index++) {
        const node = study.nodes[mainline.ids[index]], ply = index + 1;
        for (const comment of node.comments || []) {
          const evaluation = pgnScore(comment);
          if (evaluation) pgnEvaluations[ply].pgn = evaluation;
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
      evidence: null, pgnEvaluations,
      analysis: { status: 'not-computed', source: null, evaluations: null } };
  }
  return { VERSION, build, decodeCdb, typedScore, scoreText, validatePV, hashText, resolveEvidence, attachEvidence, plotSeries };
});

