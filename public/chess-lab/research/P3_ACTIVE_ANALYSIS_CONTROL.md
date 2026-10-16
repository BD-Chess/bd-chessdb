# Interactive analysis controls

Cards/All and Deep have separate Each move switches. Both default off on a fresh
page. Analyze starts a new search with the current chosen limits. Stopping never
silently re-enables Each move, including after navigation or foreground return.
Retained lines are results of earlier searches; repeating a search with a larger
budget is a new search, not engine-state continuation.

- A card Stop cancels that family's card request and disables Cards/All Each move.
  Other already-started families may finish.
- Cards Stop all cancels the whole batch, preparation/queue and Cards follow.
- Deep Stop cancels all children of that Deep request and disables Deep follow.
- Shared Stop analysis cancels all interactive local owners and their follow work.
  It does not pause a human game, Sim, a tournament or Replay.
- Enabling Cards/All Each move immediately analyzes the eligible current position,
  then the latest position after a short navigation burst. Turning it off cancels
  the current automatic Cards batch. A manual Cards batch can finish.
- Enabling Deep Each move arms Deep, starting the eligible current position when
  idle. Turning it off lets the current request finish and cancels future starts.
- At most one interactive follow owner is armed. Starting Cards retires Deep;
  starting Deep retires Cards. View/Settings entry does not start work or select a
  different display source. Closing Deep with its X explicitly cancels its work.

The shared row reports the actual controllers, independently of the selected
display source. Expand it for per-family position binding, measured search time,
finite budget and known download bytes. No search percentage or ETA is invented.
It moves inside Settings and Tools, preserving modal isolation. Search samples
are coalesced and are not announced individually to assistive technology. The
status and controller handles are ephemeral and never enter the saved game.

Regression commands are required by `.github/workflows/chess-lab-unified.yml`:
`p3-active-analysis.test.cjs` exercises real controllers with controlled adapters;
`p3-active-analysis-browser.cjs` covers Chromium Settings natural focus, responsive
views, one shipped All4/CPU1/10-second-budget run, a labelled controlled APP loading
race, and ordinary imported full-line/cursor reload after P3 interactions. The
existing full-game browser test retains the production-worker update and full
profile reopen cases. Viewport emulation does not prove physical iPhone,
OS-installed PWA, true offline/eviction or endurance behavior.
