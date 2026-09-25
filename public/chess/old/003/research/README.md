# ChessDCC new — 2026-09-12

Production copy: https://www.mdlxdcc.org/chess/new/
Baseline: BD-Chess/bd-chessdb commit 1ed7041e6d2d70e62107c0203f3bd0f7cb23c8d2, complete public/chess subtree.

This upgrade has one browser decision policy in js/8zc-dcc-core.js. It is used by analysis, local DCC play, automated play and Replay. Historical tools/8zc-headless.js and copied PGN collections remain archival material; their old metrics are not new browser-policy strength evidence.

## RHP delivery record

Compact RHP review: formal (POV, legal moves and guard), physical (API latency and finite coverage), ecological (upstream sources and cache), engineering (shared policy and session lifecycle), falsifier (missing data, stale replies and cooperative PV mate regression), child (plain Help and explicit controls), cartographer (complete isolated copy and accurate links). Implementation and independent review were separated. Tests, rather than role count, decide delivery.

Preserved alternatives: raw engine preference and guarded DCC preference are both visible. Near-tied candidates retain equal funded horizons; wide-window inspection cannot normally widen the 10 cp choice guard. A legally verified immediate checkmate is the explicit exception. Absolute raw scores >=10000 retain the raw choice as decisive/tablebase scores. No Elo improvement is claimed.

## Decision contract

- Full FEN + configuration + request generation bind analysis. Stale responses cannot commit a board move.
- Scores are normalized to the root mover; zero remains a value and unavailable samples remain null.
- Depth counts total half-moves including the candidate. Initial stage is up to 3 plies; close or volatile guarded candidates receive equal extra coverage up to the requested horizon (1–10).
- At most candidates × requested depth PV/score probes; a 20 second soft funding deadline stops issuing new probes, with a 6 second per-request timeout. The initial candidate query is separate. Cache hits still count as logical probes.
- Stability = 1/(1 + mean absolute evaluation change / 20), with at least three observations. Floor, variation, recovery and resulting-FEN LZ structure are auxiliary observations. The numeric heuristic is not a centipawn engine score.
- Unavailable/unequal coverage retains the raw best. Limited/unknown simulations are incomplete, not draws.
- Local settings/game/cache are namespaced separately from the original page. Public Lichess authorization behavior is retained; no credentials are included in this report or tests.

## Sudoku transfer provenance

Static review of Sudoku R6 0.2.0-R1-HF3-HF3 (SHA3-256 03df23c114299366284a9acf9172ef2f8f749f4c05f339ebd5acd58e44b1618b): views.py state-bound SENSOR_ONLY observations; control.py bounded staged funding; learning.py separates pending/limit/error from completed outcomes; engine.py validates an action before commit. These are process-design transfers. Chess sensors and weights require their own controlled evaluation.

## Verification

Run `node --test public/chess/new/research/*test.cjs` from the repository root. All 24 tests passed. Tests use deterministic fixtures and the bundled chess rules library, not external challenges. Full HTML/JS boot was checked with a DOM harness (64 squares, new dialog, SimW/SimB modals, New game). Live browser checks passed on the deployed isolated path: desktop, 390px phone and 768px tablet layouts; dark and light themes; the new dialog; 405-game library search and loading; first/next navigation; actual local SimW engine move e2e4; automated local Sim start/Stop; and completed Replay with annotated PGN export available. No application console errors were observed (browser-extension messages were excluded). No real Lichess challenge is sent by automated tests.

Upstream API references: https://www.chessdb.cn/cloudbookc_api_en.html and https://lichess.org/api .

## Next research steps

Compare raw and DCC under equal compute, fixed openings, paired colors and logged source versions before claiming playing-strength gains. Preserve missing/limited outcomes. Rerun historical EndEval comparisons after explicit POV and zero-value auditing; old descriptive percentages are not independent validation.

## 2026-09-12 follow-up: top five and workspace height

Reproduced the opening-position regression against the original live page. ChessDB's
`queryall&learn=0&showall=1` returned one measured score and 19 unknowns; the matching
`learn=1` response returned 20 measured scores. Restored the original merge: cloud
first, measured verified values override, unknowns do not. Score/rank ties preserve
the provider's order. The same merged legal list feeds board annotations and the
shared DCC/Sim/Replay policy. Each mode has a distinct cache/in-flight key; failures
are retried independently. Version 0.7.1 bypasses the previous cached responses.
This uses two initial candidate requests; the DCC probe budget is unchanged.

Desktop controls stretch to the board frame height, with the available space given
to Moves or DCC. Size containment prevents long lists from stretching the board;
expanded settings remain accessible through scrolling. Below 791px the existing
stacked layout and history-size setting are retained. The new dialog explains both
changes and how to check them.

All 30 deterministic regression tests pass, including six new checks for opening
top-five order, measured/unknown precedence, legality, partial source failures,
separate caches and the annotation-to-DCC integration.

## 2026-09-12 position experiments and New game

Reproduced New game ignoring clicks in a live local SimB session after c4 and an
engine response. The handler returned early for every active session. New game now
ends local activity immediately and invalidates both pending moves and pending
UI cleanup. Sim/Replay activity ownership prevents an old async task from replacing
the new board, history or result panel. Replay settings are scoped to the run.

Sim now plays from the displayed full FEN with a separate CDB top-1 / CDB+DCC choice
for White and Black. The real move history is updated. Clicking a history move
synchronously pauses at that position; opening Sim allows engine reassignment and
a new branch. Pause also opens that dialog. Experiment start snapshots and played
traces are retained for the tab session, with Return to start and PGN/CSV exports.
The author link is mailto:bd@siol.net; Portfolio retains /BD/.

Raw selection preserves provider tie ordering. Both policies observe the shared
DCC analysis, but only the selected policy chooses. The comparison card records
top-1, DCC choice, exact ties, candidates within 10 cp, score gap and coverage.
Exports record actual selected moves, raw/DCC alternatives, full initial FEN,
engine colors, controller configuration and unknown/partial observations. The old
random book warmup and randomized opponent model do not apply to these position
experiments. Pauses, absent evaluations and the 200-ply limit retain result '*'.
Different choices are observations, not evidence of a playing-strength gain;
repeated positions and changing live database responses remain explicit limits.

Verification: 43 deterministic tests pass, including policy routing for both color
assignments, exact/near ties, underpromotion, export round-trips, the reported
SimB reset, history pause, late requests after replacement, and Replay reset.
A full HTML/JavaScript DOM smoke check also passed boot, SimB/c4/New game, engine
swap, automatic history updates, click-to-pause, dialog reopening and final reset.

## 2026-09-12 optional clocks, local human study and Gemini

DCC core 0.7.2 distinguishes a no-deadline Sim contract from the bounded interactive
analysis contract in memo/config identities. Sim has no wall-time analysis or client
request timeout. Pause/New game aborts its pending network requests; candidate/depth
probe budgets remain finite. Database absence/network failures remain incomplete (*).

ChessTime 1.0 uses monotonic elapsed time and separate observed UTC timestamps. Sim
counts up. Only an explicitly configured local human study can count down with
increment. At zero it pauses; no tournament result is inferred. Display toggles are
both false by default and do not invalidate analysis. Real committed local moves
are timestamped; navigating, imported PGNs and Replay never fabricate historical
move times. Current local timing restores paused after reload. Sim export 1.1 logs
analysis_ms (legacy CSV elapsed_ms), pause_ms, turn_ms and per-side elapsed totals.

Two players share the same device. A serial observer queue reviews each played
position independently of subsequent board navigation. Data is bound to full FEN
and the actual recorded move; a replaced game cancels old reviews.

Gemini uses functions/chess-gemini.mjs and its own GEMINI_API_CHESS environment key,
following the Trip server-proxy pattern without modifying Trip. Server-owned
_shared/chess-knowledge.mjs holds the versioned controller/GUI/grounding contract.
Each question carries a labelled current position; no automated move execution or
background chat calls. Chat text is rendered as text, never executable markup.
Quota handling distinguishes temporary/daily/zero-available quota and never exposes
raw provider errors or credentials. Optional CHESS_GEMINI_MODEL defaults to the
verified Gemini 3.5 Flash-Lite identifier (also used by current Trip).

Validation command: node --test public/chess/new/research/*test.cjs public/chess/new/research/*test.mjs
Provider references: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
and https://ai.google.dev/gemini-api/docs/rate-limits .

Pre-deploy verification: 51 deterministic tests passed, including long-wait DCC,
elapsed/countdown clocks, increment, pause accounting, request cancellation and
Gemini quota/secret/grounding tests. Full HTML/JS DOM smoke passed two independent
display switches during Sim, two human colors, timestamps, clock pause/resume,
FEN-grounded chat, safe plain-text rendering and stale-position reply labels.


## 2026-09-12 steady workspace and position evaluation

Player clocks are on by default at the top. Existing pre-layout settings adopt
this default once (timerDisplayDefaults=2), then later choices persist. Timestamps
still default off. Local and Lichess clocks share the top clock slot.

Controls use separate top, central and bottom regions. Only the central reading
area scrolls; navigation is directly above it. Settings and library are exclusive
drawers over this area with close/Escape controls. Automatic Sim/Replay preserves
the reading scroll position; its scrollbar becomes visible on hover/focus. The
previous whole-workspace scrollbar and duplicate Portfolio footer are removed.
Mobile/tablet use a fixed 340px central area; desktop stretches with the board.

The new evaluation bar consumes existing CDB queries, adds no API calls and uses
the full displayed FEN. It normalizes mover scores to White POV, handles unknown
values and actual terminal positions separately, and follows board orientation.
CDB decisive sentinels are labelled W/B, not a fabricated mate distance. The
bounded tanh fill is a visual scale, not a calibrated win probability.

Validation: 55 deterministic tests pass, including score perspective, unknown/decisive
values, terminal outcomes and late-response isolation for the new bar. Full DOM
boot covers the actual presentation helpers, both drawers, timers, SimB/New game,
automatic play, navigation pause, local human play and the assistant.
