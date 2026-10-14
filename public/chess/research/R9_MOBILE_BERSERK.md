# ChessBest LAB R9 — mobile controls and bounded Berserk search

R9 starts from main `de873fa572e5cfe3cb07bb654cfa0ee4382dcc1b`. Only active `/chess-lab/` changes. The final deployment SHA, release ID, public verification and physical-device limitations are recorded in the delivery receipt saved with the ChessBest project.

## Diagnosis and fix

The R8 card path had no external timed-search deadline. It waited for native `bestmove`; the earlier session-wide ceiling was also removed. Berserk's compiled `command()` executes synchronously, so an ordinary queued UCI `stop` cannot interrupt a blocked command. Missing/delayed native completion could leave a card and the serialized mobile All queue in Analyzing indefinitely. This is a demonstrated missing guard, not proof of the exact failure inside the owner's physical iPhone.

A timed UCI search now has a deadline starting after readiness/setup: requested movetime plus a documented grace of 1–2 seconds. Overrun calls `Worker.terminate()`, settles the promise and records `time-watchdog`, `forcedStop`, actual elapsed time and the last complete legal MultiPV iteration. Infinite/depth-only searches do not acquire an unintended time cap. Cards also guard silent adapters and preparation (120 seconds); Stop, position/history changes, visibility changes and failure dispose owned resources and ignore late callbacks.

Mobile cards remain serialized. One successfully prepared SF Lite/Full or Berserk worker may be retained; changing engine evicts it and gives the browser 350 ms to retire memory. Reckless and LCZero workers are released after a card job. A queued card also retires an intervening local DCC probe before allocating its engine. A card does not retain a second heavy worker while a local DCC provider owns that lane. No DCC scoring, sensors, candidate policy or engine/model version changes.

A repeated completed card doubles its existing time budget. A retained UCI worker is reused, but `ucinewgame` resets the search: no continuation of an old search tree is claimed. `workerReused` and `preparedEngineReused` distinguish actual reuse from a first search after preparation. Transport labels use ResourceTiming evidence: network body transfer = Downloading, local/cached work = Preparing engine, uncertain transport = Loading files. Analyzing starts at the actual search. Versioned transport URLs prevent an old cached wrapper hiding progress after an update.

## Interface

SF Full, All four engines / Stop all and the existing optional per-move checkbox precede Refresh evals. Following remains default OFF. SIM sits immediately after DCC analysis; mobile uses SIM and desktop uses Sim / Play. The legend remains available through the adjacent information control. DCC measured/Analyzing/unavailable status lives in its card; CDB position-data status lives in CDB. Other diagnostics remain available in Settings. Controls wrap at narrow widths and retain 44 px mobile action targets. The existing single card/All time selector and saved choices remain; changing only that time no longer erases the current CDB/DCC context.

## Verification

Run the focused mechanism/UI tests and `research/r9-browser-acceptance.cjs` with Playwright and the Chromium runtime. `--browser=webkit` runs Linux WebKit; it does not simulate the hardware, memory limits or installed PWA state of a physical iPhone. `--cdb-fixture` supplies deterministic legal online-provider answers for reproducible DCC/status and prepared-card tests; every WASM/NNUE engine remains actual. The explicit fault test changes only its test worker's Berserk `go movetime` into `go infinite`, proving hard termination of ongoing native work and recovery.

Coverage includes SF Lite, SF Full, Reckless, LCZero, Berserk alone/after other engines, mobile All, repeat, Stop, new FEN, injected overrun, manual follow, SIM and layouts at 320/393/430/1024/1440 px. Review V4 and Studies use the existing shipped acceptance. PWA shell generation is LAB-only; optional heavy engines stay outside mandatory precaching. The physical iPhone 16 Pro review belongs to the owner after publication.
