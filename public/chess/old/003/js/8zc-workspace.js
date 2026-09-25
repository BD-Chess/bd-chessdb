/* Optional time displays and local shared-board study games. */
(function (root) {
  'use strict';
  root.ChessWorkspace = { create };
  function create({ Chess, game, settings, onDisplaySettings, analyze, onAnnotations, getAnalysis, isBusy, stopActivities }) {
    const T = root.ChessTime, $ = id => document.getElementById(id), now = () => performance.now();
    const STORAGE = 'chessNewTiming-v1';
    let clock = T.create({ turn: game.turn(), now: now() });
    let records = [], kind = 'analysis', human = false, reviewEpoch = 0, reviewQueue = Promise.resolve();
    let lastReview = null, selectedPly = null, humanStartPly = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (saved?.pgn === game.pgn() && Array.isArray(saved.records)) {
        records = saved.records;
        if (saved.clock) clock = saved.clock;
        kind = saved.kind === 'human' ? 'human' : 'analysis';
        human = kind === 'human'; humanStartPly = saved.humanStartPly || 0;
        clock.running = false; clock.anchor = now();
      }
    } catch (_) {}
    function persist() {
      try { localStorage.setItem(STORAGE, JSON.stringify({ pgn: game.pgn(), records, kind, humanStartPly,
        clock: { ...T.snapshot(clock, now()), running: false } })); } catch (_) {}
    }
    function reset() {
      reviewEpoch++; records = []; lastReview = null; selectedPly = null; human = false; kind = 'analysis';
      clock = T.create({ turn: game.turn(), now: now() });
      $('humanReview').textContent = ''; render(); persist();
    }
    function start(mode = 'analysis', options = {}) {
      reviewEpoch++; kind = mode; human = mode === 'human'; selectedPly = null; lastReview = null;
      humanStartPly = game.history().length;
      clock = T.create({ mode: human && options.seconds > 0 ? 'countdown' : 'elapsed',
        seconds: human ? options.seconds : 0, increment: human ? options.increment : 0, turn: game.turn(), now: now() });
      if (human) {
        game.header('Event', 'ChessBest assisted local study', 'White', options.white || 'Human White', 'Black', options.black || 'Human Black',
          'TimeControl', clock.mode === 'countdown' ? `${options.seconds}+${options.increment}` : '-', 'Result', '*');
        $('humanReview').textContent = 'Both players move on this board. CDB + DCC reviews each move in the background.';
      }
      render(); persist();
    }
    function pause() { T.pause(clock, now()); render(); persist(); }
    function stop() { pause(); human = false; kind = 'analysis'; render(); persist(); }
    function beforeMove() {
      if (human && (!clock.running || clock.flagged)) return false;
      if (!clock.running) { clock.turn = game.turn(); T.resume(clock, now()); }
      T.tick(clock, now()); render();
      return !clock.flagged;
    }
    function recordMove(fen, move, extra = {}) {
      const index = game.history().length - 1;
      if (clock.turn !== move.color) { clock = T.create({ turn: move.color, now: now() }); }
      if (!clock.running && !human) T.resume(clock, now());
      const time = T.move(clock, move.color, game.turn(), now(), new Date().toISOString());
      if (!time) { render(); return null; }
      const row = { ...time, ...extra, fen, afterFen: game.fen(), move: move.from + move.to + (move.promotion || ''), san: move.san };
      records = records.slice(0, index); records[index] = row; selectedPly = null;
      if (game.game_over()) T.pause(clock, now());
      if (human) queueReview(index, row);
      render(); persist(); return row;
    }
    function recordAt(index, move, fen) {
      const row = records[index];
      return row && (!fen || row.fen === fen) && (!move || row.move === move.from + move.to + (move.promotion || '')) ? row : null;
    }
    function history() {
      pause(); selectedPly = game.history().length - 1;
      const row = records[selectedPly];
      if (row?.afterFen === game.fen()) clock = { ...row.after, used: { ...row.after.used }, remaining: { ...row.after.remaining }, running: false, anchor: now() };
      else { clock = T.create({ turn: game.turn(), now: now() }); clock.running = false; }
      render();
    }
    function decorate(td, index, move) {
      if (!settings.showTimestamps) return;
      const row = recordAt(index, move);
      if (!row?.at_utc) return;
      const stamp = document.createElement('time'); stamp.className = 'move-timestamp'; stamp.dateTime = row.at_utc;
      stamp.textContent = new Date(row.at_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      stamp.title = `${row.at_utc} · ${(row.think_ms / 1000).toFixed(1)}s elapsed${Number.isFinite(row.analysis_ms) ? ' · analysis ' + (row.analysis_ms / 1000).toFixed(1) + 's' : ''}`;
      td.appendChild(stamp);
    }
    function render() {
      T.tick(clock, now());
      const bar = $('workspaceTimers');
      bar.hidden = !settings.showTimers || kind === 'lichess';
      for (const side of ['w', 'b']) {
        const node = $(side === 'w' ? 'timerWhite' : 'timerBlack');
        const value = clock.mode === 'countdown' ? clock.remaining[side] : clock.used[side];
        node.querySelector('strong').textContent = T.format(value);
        node.classList.toggle('is-running', clock.running && clock.turn === side);
      }
      $('timerCaption').textContent = (kind === 'sim' ? 'Sim · elapsed · no time limit' : clock.mode === 'countdown' ? 'Local game · time remaining' : 'Elapsed per player · no time limit')
        + (!clock.running ? ' · paused' : '');
      $('humanSession').hidden = !human;
      $('btnHumanPause').textContent = clock.flagged ? 'Continue untimed' : clock.running ? 'Pause game' : 'Resume game';
      $('humanSessionState').textContent = clock.flagged ? `${clock.flagged === 'w' ? 'White' : 'Black'} ran out of time · game paused`
        : game.game_over() ? 'Game over' : clock.running ? `Two players · ${game.turn() === 'w' ? 'White' : 'Black'} to move` : 'Two players · paused';
    }
    function queueReview(index, row) {
      const epoch = reviewEpoch;
      $('humanReview').textContent = `Review queued for ${row.san} · play can continue`;
      reviewQueue = reviewQueue.catch(() => {}).then(async () => {
        if (epoch !== reviewEpoch) return;
        const result = await analyze(row.fen, () => epoch !== reviewEpoch);
        if (epoch !== reviewEpoch || records[index] !== row) return;
        const candidates = result?.allMoves || [], raw = candidates[0];
        const played = candidates.find(c => c.move === row.move);
        const gap = raw && played ? raw.score - played.score : null;
        lastReview = { fen: row.fen, afterFen: row.afterFen, move: row.move, san: row.san, side: new Chess(row.fen).turn(),
          rawBest: raw || null, rawScore: played?.score ?? null, rawGap: gap,
          dccChoice: result?.dcc1Move || null, coverage: result?.receipt?.status || 'unknown' };
        row.review = lastReview;
        if (result) onAnnotations(row.fen, result.candidates.map(c => c.data));
        const toSAN = uci => { try { return new Chess(row.fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san; } catch (_) { return '?'; } };
        $('humanReview').textContent = `${lastReview.side === 'w' ? 'White' : 'Black'} ${row.san}: ${gap === null ? 'CDB move score unknown' : gap + ' cp below CDB best'} · DCC ${lastReview.dccChoice ? toSAN(lastReview.dccChoice) : 'unknown'} · ${lastReview.coverage}`;
        persist();
      }).catch(() => { if (epoch === reviewEpoch) $('humanReview').textContent = `${row.san}: review unavailable; the game can continue.`; });
    }
    ['showTimers', 'showTimestamps'].forEach((key, i) => {
      const input = $(i === 0 ? 'settingShowTimers' : 'settingShowTimestamps');
      input.checked = !!settings[key];
      input.onchange = () => { settings[key] = input.checked; onDisplaySettings(); render(); };
    });
    $('btnTwoPlayers').onclick = () => {
      if (isBusy()) { $('twoPlayersNotice').textContent = 'Pause Sim or stop the current engine session before starting two-player play.'; }
      else $('twoPlayersNotice').textContent = 'Start from the displayed position. Both players use this device; CDB + DCC observes.';
      $('humanStart').disabled = isBusy() || game.game_over();
      $('twoPlayersDialog').showModal();
    };
    $('humanCancel').onclick = () => $('twoPlayersDialog').close();
    $('humanStart').onclick = () => {
      if (isBusy() || game.game_over()) return;
      stopActivities();
      const seconds = Number($('humanMinutes').value) * 60, increment = Number($('humanIncrement').value);
      start('human', { seconds, increment, white: $('humanWhiteName').value.trim().slice(0, 60), black: $('humanBlackName').value.trim().slice(0, 60) });
      $('twoPlayersDialog').close();
    };
    $('btnHumanPause').onclick = () => {
      if (game.game_over()) return;
      if (clock.flagged) {
        clock.mode = 'elapsed'; clock.flagged = null;
        game.header('TimeControl', '-', 'StudyClockChange', 'Continued untimed after timeout');
      }
      if (clock.running) pause();
      else { clock.turn = game.turn(); T.resume(clock, now()); selectedPly = null; render(); persist(); }
    };
    $('btnHumanFinish').onclick = () => { stop(); kind = 'analysis'; };
    setInterval(render, 250);
    window.addEventListener('pagehide', pause);
    return { reset, start, pause, stop, beforeMove, recordMove, recordAt, history, decorate, render,
      isHuman: () => human, isTimed: () => human && clock.mode === 'countdown',
      clockSnapshot: () => ({ kind, ...T.snapshot(clock, now()) }), lastReview: () => lastReview,
      pgnTime: (i, move, fen) => T.pgn(recordAt(i, move, fen)),
      getAnalysis, humanStartPly: () => humanStartPly };
  }
})(window);
