# 8zSudoku /S/new — Engine 0.3.0

Date: 2026-09-26. Author: BD × AI Lab / GPT Work implementation and review.
Scope: `public/S/new/app.html`, its regression fixtures, tests and evidence. The application stays a single self-contained HTML file. `/S/`, CURRENT/PREVIOUS archives, PWA and the mobile draft are outside this change.

## Evidence and decisions

The 26 September Live Extract carries the same HF4 code/results as the 12 September snapshot: 467 tasks, 335 SOLVED, 132 LIMIT, zero ERROR. All 3020 payload hashes and all 335 stored solution grids were checked; no Python campaign was executed. There are 31 distinct exposed main-pilot puzzles, not 467 independent puzzles. Their sanitized regression inputs are in `tests/fixtures/sudoku-arena-31.json`.

The matched constant predictor was about 25% cheaper in task work than MDL_DCC in those pilots; seeded MRV was cheaper still. This release uses that finding: cheap exact solving and checked logic first, bounded adaptive research retained. It does not claim a general MDL/DCC advantage, transfer benefit or measured human learning. The September 17 generator Atlas experiment supports repeated masks of one reference solution; an empty negative Atlas offers no reuse in the current one-pass clue-removal generator, so it was not added to that hot path.

## Changes

- Default **8z Fast**: typed 9-bit occupancy, naked/hidden single propagation, deterministic MRV, reversible trail, explicit node/trace limits. Five original strategies remain available.
- Exact count-to-two uniqueness uses the same optimized kernel. One found solution at a limit is never certified unique. Invalid, UNSAT, MULTIPLE and LIMIT stay distinct.
- Real solve trace with candidate counts, forced-move cascades and rollback events. The UI replays and validates the entire path before animation; solving starts from the currently entered grid.
- Indexed P0 support and direct move review; no speculative path ranking when a checked single already provides progress. Elimination-path DCC comparison retains equal horizons.
- Independently checked naked/hidden quads, reusing the existing subset technique IDs and literal proof format.
- Incomplete family scans/checks are censored LIMIT observations, even when some checked witnesses were found. Old observations remain retained, while incompatible work costs are excluded from fitting. Event IDs include cost revision.
- Solve/reset/cancel and restore/new-game race guards; a completed grid must satisfy Sudoku units before success is shown.
- Storage/export schema remains 0.2.0-compatible; engine revision is separately 0.3.0. Exports carry generation seed, uniqueness and actual/requested clue-count evidence. Clue count is not a calibrated human rating.

## Verification

21 test groups PASS: 9 exact/trace/generator, 7 proof/budget/memory, 5 UI/worker integration. This includes all 31 source puzzles, 12 independently uniqueness-checked generated puzzles, malformed/duplicate/unsatisfiable/multiple boards, actual trace/candidate/rollback replay, quad tampering, 33 bounded proof runs, legacy import, corrupt import rejection and delayed-worker race tests.

The DOM tests execute the shipped inline scripts and their actual Blob worker source using jsdom and Node worker_threads. They do not replace solver computation with fixtures. Real browser layout, Safari/iPhone touch and CSP/Blob-worker behavior remain untested here: the available browser could not reach the local preview (`ERR_BLOCKED_BY_CLIENT`). Netlify deployment/live acceptance is intentionally deferred under BD's instruction; this receipt is for source publication on GitHub.

### Bounded performance measurement

Node v24.19.0; same process, warm-up, alternating order, medians. Details and all samples: `docs/evidence/SUDOKU_ENGINE_030_BENCHMARK_20260926.json`.

| Operation | Previous | Engine 0.3.0 | Ratio |
|---|---:|---:|---:|
| Exact uniqueness, same 31 puzzles | 69.41 ms | 1.31 ms | 53.1× |
| Generate 12 puzzles, same seed/profile inputs | 49.19 ms | 20.03 ms | 2.46× |

The generated instances differ between algorithms. These are development-set kernel measurements, not phone latency, rendering speed, heldout generalization or a causal MDL/DCC result. Proof work revisions have different accounting, so their tick ratios are not CPU speedups. Quad scans cost more than pair/triple-only scans but can prove additional deductions; they remain bounded.

App SHA-256: `9a2d95c312ff2f6bd672ef930ab3100c16d2aeff4af51b4dcc29812b19bcc749`.
Baseline core SHA-256: `52222478e3c454076300b8c96390f2ffb5788d6e7a8cd554331dbd5a50618de3`.

## Reproduce

Node 20 or newer. Pure-core tests have no dependencies:

```sh
node --test tests/sudoku-engine-core.test.cjs tests/sudoku-engine-proof.test.cjs
npm ci --ignore-scripts --prefix tests/sudoku
NODE_PATH=./tests/sudoku/node_modules node --test tests/sudoku-engine-ui.test.cjs
node scripts/benchmark-sudoku-engine.cjs
```

## Remaining project work

- After deployment becomes available: real browser/iPhone game, offline/storage and touch acceptance for this LAB revision.
- Separate heldout matched-budget evaluation of DCC benefit, including cost/yield and changed-selection outcomes.
- Generator Atlas on repeated masks/add-remove-swap and verified transfer experiments, following the existing research TODO.
- Promotion from LAB to CURRENT and mobile release remain separate decisions.
