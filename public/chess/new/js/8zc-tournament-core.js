/* Pure tournament scheduling, opening extraction and completed-result accounting.
   Interrupted games remain unscored. Engine IDs are stable across exported records. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessTournament = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0-lab';
  const ENGINES = ['raw', 'dcc', 'sf', 'sf-dcc'];
  const LABELS = { raw: 'CDB/SF', dcc: 'CDB/SF + DCC', sf: 'SF', 'sf-dcc': 'SF + DCC' };
  const integer = (value, fallback, low, high) => Number.isFinite(Number(value)) ? Math.min(high, Math.max(low, Math.trunc(Number(value)))) : fallback;
  const uniqueEngines = values => [...new Set((Array.isArray(values) ? values : []).filter(value => ENGINES.includes(value)))];
  function normalizeConfig(input = {}) {
    const format = ['round-robin', 'roundRobin', 'roundrobin'].includes(input.format || input.mode) ? 'round-robin' : 'duel';
    if (input.engines != null && !Array.isArray(input.engines)) throw new Error('Tournament engines must be a list.');
    const specified = input.engines?.length ? input.engines : format === 'round-robin' ? ENGINES :
      [input.white || input.whiteEngine || 'raw', input.black || input.blackEngine || 'dcc'];
    if (specified.some(engine => !ENGINES.includes(engine))) throw new Error('Unknown tournament engine.');
    const engines = uniqueEngines(specified);
    if (engines.length < 2) throw new Error('Choose at least two different engines.');
    if (format === 'duel' && engines.length !== 2) throw new Error('A duel requires exactly two different engines.');
    const openingMode = ['auto', 'fullmoves', 'current'].includes(input.openingMode) ? input.openingMode : 'auto';
    return { ...input, format, engines, rounds: integer(input.rounds ?? input.repetitions, 1, 1, 1000), pairedColors: true,
      openingMode, fullmoves: integer(input.fullmoves ?? input.openingFullmoves, 9, 0, 500) };
  }
  function createSchedule(input, openings = []) {
    const config = normalizeConfig(input), schedule = [], pairs = [];
    for (let a = 0; a < config.engines.length; a++) for (let b = a + 1; b < config.engines.length; b++) pairs.push([config.engines[a], config.engines[b]]);
    if (config.rounds * openings.length * pairs.length * 2 > 10000) throw new Error('Tournament exceeds the 10,000-game limit. Reduce openings or rounds.');
    for (let repeat = 0; repeat < config.rounds; repeat++) for (let openingIndex = 0; openingIndex < openings.length; openingIndex++) {
      const opening = openings[openingIndex];
      for (let pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
        const pairId = `r${repeat + 1}-o${openingIndex + 1}-p${pairIndex + 1}`;
        for (let color = 0; color < 2; color++) {
          const pair = pairs[pairIndex];
          schedule.push({ id: schedule.length + 1, round: repeat + 1, pair: pairIndex + 1, pairId, colorGame: color + 1,
            openingId: opening.id || `opening-${openingIndex + 1}`, openingIndex, opening,
            startFen: opening.startFen, startPgn: opening.startPgn || '', openingPlies: opening.openingPlies ?? opening.bookPlies ?? 0,
            white: pair[color], black: pair[1 - color], state: 'queued', result: '*' });
        }
      }
    }
    return schedule;
  }
  const completed = game => game && game.state === 'complete' && ['1-0', '0-1', '1/2-1/2'].includes(game.result);
  const pointsFor = (result, side) => result === '1/2-1/2' ? 0.5 : result === (side === 'w' ? '1-0' : '0-1') ? 1 : 0;
  function standings(games = [], engines = []) {
    const ids = uniqueEngines([...engines, ...games.flatMap(game => [game.white, game.black])]);
    const rows = ids.map(engine => ({ engine, id: engine, label: LABELS[engine], played: 0, wins: 0, draws: 0, losses: 0, points: 0, score: 0, scheduled: 0, interrupted: 0, pending: 0 }));
    const byId = Object.fromEntries(rows.map(row => [row.engine, row]));
    for (const game of games) for (const [side, engine] of [['w', game.white], ['b', game.black]]) {
      const row = byId[engine]; if (!row) continue;
      row.scheduled++;
      if (!completed(game)) {
        if (['incomplete', 'interrupted', 'paused', 'stopped', 'error', 'aborted'].includes(game.state)) row.interrupted++;
        else row.pending++;
        continue;
      }
      const points = pointsFor(game.result, side);
      row.played++; row.points += points; row.score = row.points;
      if (points === 1) row.wins++; else if (points === 0.5) row.draws++; else row.losses++;
    }
    rows.sort((a, b) => b.points - a.points || b.wins - a.wins || ids.indexOf(a.engine) - ids.indexOf(b.engine));
    return rows.map((row, index) => ({ ...row, rank: index + 1, percent: row.played ? row.points / row.played * 100 : null }));
  }
  function crosstable(games = [], engines = []) {
    const rows = standings(games, engines), ids = rows.map(row => row.engine), matrix = {};
    for (const engine of ids) {
      matrix[engine] = {};
      for (const opponent of ids) matrix[engine][opponent] = engine === opponent ? null : { played: 0, points: 0, wins: 0, draws: 0, losses: 0, results: [] };
    }
    for (const game of games.filter(completed)) for (const [side, engine, opponent] of [['w', game.white, game.black], ['b', game.black, game.white]]) {
      const cell = matrix[engine]?.[opponent]; if (!cell) continue;
      const points = pointsFor(game.result, side);
      cell.played++; cell.points += points; cell.results.push({ id: game.id, side, result: game.result, points });
      if (points === 1) cell.wins++; else if (points === 0.5) cell.draws++; else cell.losses++;
    }
    return { engines: ids, rows: rows.map(row => ({ ...row, opponents: matrix[row.engine] })), matrix };
  }
  // Read comments independently because the bundled chess.js intentionally discards them.
  // Variations and their comments never affect mainline book-boundary detection.
  function tokens(text) {
    const output = [];
    let index = 0, variation = 0;
    while (index < text.length) {
      const char = text[index];
      if (/\s/.test(char)) { index++; continue; }
      if (char === '{') {
        const end = text.indexOf('}', index + 1), next = end < 0 ? text.length : end + 1;
        if (!variation) output.push({ type: 'comment', value: text.slice(index + 1, end < 0 ? text.length : end) });
        index = next; continue;
      }
      if (char === ';') {
        const end = text.indexOf('\n', index), next = end < 0 ? text.length : end;
        if (!variation) output.push({ type: 'comment', value: text.slice(index + 1, next) });
        index = next; continue;
      }
      if (char === '(') { variation++; index++; continue; }
      if (char === ')') { variation = Math.max(0, variation - 1); index++; continue; }
      if (char === '[') {
        let end = index + 1, quoted = false, escaped = false;
        while (end < text.length) {
          const next = text[end++];
          if (escaped) { escaped = false; continue; }
          if (next === '\\') { escaped = true; continue; }
          if (next === '"') quoted = !quoted;
          if (next === ']' && !quoted) break;
        }
        if (!variation) output.push({ type: 'header', value: text.slice(index, end) });
        index = end; continue;
      }
      let end = index + 1;
      while (end < text.length && !/[\s{}();\[\]]/.test(text[end])) end++;
      if (!variation) output.push({ type: 'token', value: text.slice(index, end) });
      index = end;
    }
    return output;
  }
  function splitGames(pgn) {
    const games = []; let current = [], hasMoves = false, ended = false;
    for (const token of tokens(String(pgn || '').replace(/^\uFEFF/, ''))) {
      if ((token.type === 'header' && hasMoves) || (ended && token.type === 'token')) {
        if (current.length) games.push(current);
        current = []; hasMoves = false; ended = false;
      }
      current.push(token);
      if (token.type === 'token') {
        hasMoves = true;
        if (['1-0', '0-1', '1/2-1/2', '*'].includes(token.value)) ended = true;
      }
    }
    if (current.length) games.push(current);
    return games;
  }
  const escapeTag = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
  const positionKey = fen => String(fen).split(/\s+/).slice(0, 4).join(' ');
  function extractOpenings(Chess, pgn, options = {}) {
    const mode = options.mode || options.openingMode || 'auto';
    const fullmoves = integer(options.fullmoves ?? options.openingFullmoves, 9, 0, 500);
    const openings = [], rejected = [], seen = new Set(); let duplicates = 0;
    const defaultFen = new Chess().fen();
    function accept(opening) {
      const key = positionKey(opening.startFen);
      if (seen.has(key)) { duplicates++; return; }
      seen.add(key); openings.push({ ...opening, id: `opening-${openings.length + 1}` });
    }
    if (mode === 'current') {
      try {
        const board = new Chess();
        if (options.currentPgn || pgn) {
          if (!board.load_pgn(options.currentPgn || pgn)) throw new Error('Current PGN is invalid.');
          const variant = board.header().Variant;
          if (variant && !/^(standard|normal|chess|orthodox)$/i.test(variant)) throw new Error('Only orthodox chess is supported.');
          if (options.currentFen && board.fen() !== options.currentFen) throw new Error('Current PGN does not match the current position.');
        } else if (options.currentFen && !board.load(options.currentFen)) throw new Error('Current position is invalid.');
        const history = board.history({ verbose: true });
        accept({ name: options.name || 'Current position', startFen: board.fen(), startPgn: board.pgn(),
          openingPlies: history.length, bookPlies: history.length, history: history.map(move => move.from + move.to + (move.promotion || '')),
          sourceHeaders: { ...board.header() }, boundary: 'current', sourceIndex: 0 });
      } catch (error) { rejected.push({ index: 0, reason: error.message }); }
      return { openings, rejected, duplicates };
    }
    splitGames(pgn).forEach((gameTokens, index) => {
      try {
        const headers = {}, moveTokens = [], comments = [];
        for (const token of gameTokens) {
          if (token.type === 'header') {
            const match = token.value.match(/^\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\]$/);
            if (!match) throw new Error('Malformed PGN header.');
            headers[match[1]] = match[2].replace(/\\([\\"])/g, '$1');
          } else if (token.type === 'comment') {
            if (moveTokens.length) comments[moveTokens.length - 1] = (comments[moveTokens.length - 1] || '') + ' ' + token.value;
          } else {
            const value = token.value.replace(/^\d+\.(?:\.\.)?/, '').replace(/\$\d+/g, '');
            if (!value || /^\.+$/.test(value) || ['1-0', '0-1', '1/2-1/2', '*'].includes(value)) continue;
            moveTokens.push(value);
          }
        }
        if (headers.Variant && !/^(standard|normal|chess|orthodox)$/i.test(headers.Variant)) throw new Error('Only orthodox chess is supported.');
        if (headers.FEN && headers.FEN !== defaultFen) throw new Error('Opening PGNs must begin from the orthodox starting position.');
        if (!moveTokens.length && fullmoves > 0) throw new Error('PGN contains no mainline moves.');
        const board = new Chess(), moves = [];
        for (const token of moveTokens) {
          const played = board.move(token, { sloppy: true });
          if (!played) throw new Error('Illegal or unsupported mainline move: ' + token);
          moves.push(played);
        }
        let bookPlies = 0;
        while (bookPlies < moves.length && /(?:\bbook\b|\[%book\b)/i.test(comments[bookPlies] || '')) bookPlies++;
        const useBook = mode === 'auto' && bookPlies > 0;
        const count = useBook ? bookPlies : Math.min(moves.length, fullmoves * 2);
        const openingBoard = new Chess();
        for (const [key, value] of Object.entries(headers)) if (!['Result', 'FEN', 'SetUp'].includes(key)) openingBoard.header(key, value);
        openingBoard.header('Result', '*');
        for (const move of moves.slice(0, count)) openingBoard.move({ from: move.from, to: move.to, promotion: move.promotion });
        const name = headers.Opening || [headers.White, headers.Black].filter(Boolean).join(' – ') || headers.Event || `Opening ${index + 1}`;
        accept({ name, startFen: openingBoard.fen(), startPgn: openingBoard.pgn(), openingPlies: count, bookPlies: count,
          history: moves.slice(0, count).map(move => move.from + move.to + (move.promotion || '')),
          sourceHeaders: headers, boundary: useBook ? 'book-comments' : 'fullmoves', sourceIndex: index,
          availablePlies: moves.length, detectedBookPlies: bookPlies, requestedFullmoves: useBook ? null : fullmoves });
      } catch (error) { rejected.push({ index, reason: error.message }); }
    });
    return { openings, rejected, duplicates };
  }
  return { VERSION, ENGINES: ENGINES.slice(), LABELS, normalizeConfig, createSchedule, standings, crosstable, completed, extractOpenings, positionKey };
});
