// Inserted inside the pinned Navigator closure by build.mjs, never loaded alone.
let mobilePaused = false, mobileTimerWasRunning = false;
window.SudokuMobileSession = {
  get paused() { return mobilePaused; },
  get shouldResume() { return mobileTimerWasRunning; },
  requestTimer() { mobileTimerWasRunning = true; },
  pause() {
    if (window.SudokuMobileDeleting || mobilePaused) return;
    mobileTimerWasRunning = mobileUX.timerRunning();
    mobilePaused = true;
    mobileUX.prepareUpdate(); // Returns the demo copy before saving the canonical game.
    cancelSolve();
    if (genJob) { genJob.cancel(); genJob = null; generationToken++; }
    navJob?.cancel(); navJob = null;
    stopTimer(); clearTimeout(saveTimer);
    if (puzzle && !booting) persist('session', snapshot());
  },
  resume() {
    if (window.SudokuMobileDeleting || !mobilePaused) return;
    mobilePaused = false;
    const resume = mobileTimerWasRunning;
    mobileTimerWasRunning = false;
    if (resume && puzzle && playerGrid && !booting && !tracePaused && !recoveryAwaitingContinue) resumeTimer();
  },
  back() {
    if (mobileUX.back()) return true;
    if ($('helpModal')?.style.display === 'flex') { hideHelp(); return true; }
    const open = [...document.querySelectorAll('details[open]')].at(-1);
    if (open) { open.open = false; return true; }
    return false;
  },
  deleteAll
};
window.addEventListener('pagehide', () => window.SudokuMobileSession.pause());
window.addEventListener('pageshow', () => window.SudokuMobileSession.resume());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) window.SudokuMobileSession.pause();
  else window.SudokuMobileSession.resume();
});
