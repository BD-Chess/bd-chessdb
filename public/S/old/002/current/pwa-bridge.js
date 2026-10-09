'use strict';
// A storage/update adapter for the frozen CURRENT game. No engine replacement.
(() => {
  const KEY = '8zSudokuCurrent.pwaSessionV1';
  const encode = value => JSON.stringify(value, (_, v) => v instanceof Set ? {pwaSet: [...v]} : v);
  const decode = text => JSON.parse(text, (_, v) => v && Array.isArray(v.pwaSet) ? new Set(v.pwaSet) : v);
  let seen = null, blocked = false, generating = false;
  const originalNewGame = newGame;
  newGame = function(...args) {
    generating = true;
    try { return originalNewGame(...args); }
    finally { setTimeout(() => { generating = false; }, 200); }
  };
  try { seen = localStorage.getItem(KEY); } catch (_) { blocked = true; }
  function save() {
    if (blocked || generating || aiAnimating) return false;
    try {
      if (localStorage.getItem(KEY) !== seen) return false;
      if (!puzzle) return true;
      if (humanTraceRecorder.hasTrace()) humanTraceRecorder.exportObject();
      const state = encode({puzzle, solution, playerGrid, givenCells, selectedCell, notesMode, notes, history, timerSeconds,
        running: timerInterval !== null, currentDiff, currentStrategy, aiLog, aiStepIndex, aiM, fullLog,
        proofCoachState, proofCoachHighlights, moveReviews});
      const text = JSON.stringify({schema: '8ZSUDOKU_CURRENT_PWA_SESSION_V1', state, sha256: AI8SudokuTruth.sha256(state)});
      if (text.length > 3500000) return false;
      localStorage.setItem(KEY, text); if (localStorage.getItem(KEY) !== text) return false;
      seen = text; return true;
    } catch (_) { return false; }
  }
  try {
    if (seen && !humanTraceRecorder.isLocked()) {
      const record = JSON.parse(seen);
      if (record.schema !== '8ZSUDOKU_CURRENT_PWA_SESSION_V1' || AI8SudokuTruth.sha256(record.state) !== record.sha256) throw Error('Saved game integrity');
      const s = decode(record.state);
      for (const key of ['puzzle','solution','playerGrid']) if (!Array.isArray(s[key]) || s[key].length !== 9 || s[key].some(r => !Array.isArray(r) || r.length !== 9 || r.some(n => !Number.isInteger(n) || n < 0 || n > 9))) throw Error('Saved board');
      ({puzzle, solution, playerGrid, givenCells, selectedCell, notesMode, notes, history, timerSeconds, currentDiff, currentStrategy,
        aiLog, aiStepIndex, aiM, fullLog, proofCoachState, proofCoachHighlights, moveReviews} = s);
      document.getElementById('welcomeOverlay')?.classList.add('hidden');
      document.getElementById('notesBtn').textContent = notesMode ? 'Notes: ON' : 'Notes: OFF';
      document.getElementById('notesBtn').classList.toggle('active', notesMode);
      document.getElementById('timer').textContent = String(Math.floor(timerSeconds / 60)).padStart(2, '0') + ':' + String(timerSeconds % 60).padStart(2, '0');
      if (s.running) resumeTimer(); render(); updateProofProfile();
    }
  } catch (_) { blocked = true; setStatus('Stored CURRENT game needs recovery. Its saved data was kept.', ''); }
  // Save after settled user actions and on leaving; never overwrite another tab.
  let pending;
  const queue = () => { clearTimeout(pending); pending = setTimeout(save, 350); };
  document.addEventListener('pointerup', queue); document.addEventListener('click', queue); document.addEventListener('keydown', queue);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.SudokuCurrentPWA = {flushForUpdate: () => { window.SudokuCurrentHold?.cancel(); return save(); }};
})();
