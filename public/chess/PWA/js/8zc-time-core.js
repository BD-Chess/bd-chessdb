/* Local clocks use monotonic elapsed time; UTC records use the wall clock.
 * Engine turns explicitly pause outside computation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessTime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create({ mode = 'elapsed', seconds = 0, increment = 0, turn = 'w', now = 0, running = true } = {}) {
    const initial = Math.max(0, Number(seconds) || 0) * 1000;
    return { version: '1.0.0', mode: mode === 'countdown' && initial > 0 ? 'countdown' : 'elapsed',
      initial, increment: Math.max(0, Number(increment) || 0) * 1000, turn,
      used: { w: 0, b: 0 }, remaining: { w: initial, b: initial },
      anchor: now, turnSpent: 0, running: !!running, flagged: null };
  }
  function tick(state, now) {
    if (!state.running) return state;
    const elapsed = Math.max(0, now - state.anchor);
    state.anchor = now;
    const charged = state.mode === 'countdown' ? Math.min(elapsed, state.remaining[state.turn]) : elapsed;
    state.used[state.turn] += charged;
    state.turnSpent += charged;
    if (state.mode === 'countdown') {
      state.remaining[state.turn] = Math.max(0, state.remaining[state.turn] - elapsed);
      if (state.remaining[state.turn] === 0) { state.flagged = state.turn; state.running = false; }
    }
    return state;
  }
  function snapshot(state, now) {
    return tick({ ...state, used: { ...state.used }, remaining: { ...state.remaining } }, now);
  }
  function pause(state, now) { tick(state, now); state.running = false; }
  function resume(state, now) { if (!state.flagged) { state.anchor = now; state.running = true; } }
  function move(state, side, nextSide, now, atUTC, { allowPaused = false, pauseAfter = false } = {}) {
    if ((!state.running && !allowPaused) || state.turn !== side) return null;
    tick(state, now);
    if (state.flagged) return null;
    const record = { at_utc: atUTC, think_ms: Math.round(state.turnSpent),
      white_elapsed_ms: Math.round(state.used.w), black_elapsed_ms: Math.round(state.used.b) };
    if (state.mode === 'countdown') {
      state.remaining[side] += state.increment;
      record.clock_ms = Math.round(state.remaining[side]);
    }
    state.turn = nextSide; state.turnSpent = 0;
    if (pauseAfter) state.running = false;
    record.after = snapshot(state, now);
    return record;
  }
  function restore(saved, now = 0) {
    if (!saved || !['elapsed', 'countdown'].includes(saved.mode) || !['w', 'b'].includes(saved.turn)) throw new Error('Invalid saved clock');
    const number = value => {
      if (!Number.isFinite(value) || value < 0) throw new Error('Invalid saved clock time');
      return value;
    };
    const state = { version: '1.0.0', mode: saved.mode, initial: number(saved.initial), increment: number(saved.increment),
      turn: saved.turn, used: { w: number(saved.used?.w), b: number(saved.used?.b) },
      remaining: { w: number(saved.remaining?.w), b: number(saved.remaining?.b) },
      anchor: now, turnSpent: number(saved.turnSpent), running: false, flagged: saved.flagged ?? null };
    if (state.flagged !== null && !['w', 'b'].includes(state.flagged)) throw new Error('Invalid saved clock flag');
    if (state.mode === 'countdown' && state.remaining[state.turn] === 0) state.flagged = state.turn;
    return state;
  }
  function format(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return (s >= 3600 ? Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') : Math.floor(s / 60))
      + ':' + String(s % 60).padStart(2, '0');
  }
  function pgn(record) {
    if (!record) return '';
    const parts = [];
    if (Number.isFinite(record.think_ms)) parts.push(`[%emt ${(record.think_ms / 1000).toFixed(3)}]`);
    if (Number.isFinite(record.clock_ms)) parts.push(`[%clk ${format(record.clock_ms)}]`);
    if (record.at_utc) parts.push(`[%timestamp ${record.at_utc}]`);
    return parts.join(' ');
  }
  return { create, tick, snapshot, pause, resume, move, restore, format, pgn };
});
