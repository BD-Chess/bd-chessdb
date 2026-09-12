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
