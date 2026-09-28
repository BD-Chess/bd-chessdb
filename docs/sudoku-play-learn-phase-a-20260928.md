# 8zSudoku LAB Play / Learn — Phase A checkpoint, 2026-09-28 R1

Status: **PHASE_A_READY_FOR_BROAD_TESTING**. This is a frozen implementation candidate, not a published or browser-accepted release.

Mandate: Drive `12Gv72wL5ElFrowEEQJQJG30uCbMbIy5E`, `NEXT_FOR_GPT_WORK_20260928_SUDOKU_LAB_PLAY_LEARN_R1.md`, especially §9. Phase B requires BD to manually select **GPT-6 Luna / Max** and send **CONTINUE_TESTS**, or explicitly override this task's model gate. Actual model selection has not been independently verified; no automatic switch or delegated verification is claimed. Phase A evidence is from this same builder session. Substantive B failures route to Sol / Extra High; publication follows successful mandatory tests through a separate LAB PR.

## Source and scope

- Initial fresh main: `382eec3bd799629057f8225ccecb52861979be74`.
- Reconciled main before freeze: `6778c1e42f9b0c19e0379f1135959b5ce8fb852a`. The intervening Chess header commit touched no Sudoku code or tests; it was retained by a fast-forward, without overwriting concurrent work.
- Prior LAB app blob: `5067e27a455d89ae769509973939e164c5ec3b34`; SHA-256 `2f5e6bf38f35db866802fca0bfb31be107636c6e90d0e0a6bd1ea0bfc4b5e6ca` (PR #47 source).
- Branch: `work/sudoku-lab-play-learn-20260928`. Full candidate commit and exact file hashes are in the external Phase A result/manifest, avoiding a recursive self-hash.
- Runtime changes: only `public/S/new/app.html` and `public/S/new/index.html`. Additional delta: scoped Sudoku tests, two fixtures, this note. No dependency or workflow edits.
- APP PR #26 remains draft/open at `17609ba66d1eb9190b648436d0eb6f5e30b9caa9`. No APP build, donor update, tag, signing, upload, PWA regeneration or TestFlight operation was performed. Sudoku PWA and stable files are unchanged relative to reconciled main.
- Routing v2026-09-24-R1 SHA-256: `10005c845d5dfbee44f6e012441b5c859c87f3e21d8fc9be791dd1613f780bcd`; COMMANDS R33 hash: `9aa3dd9d67ec6d637c4eb6662fd8e0b631cf584f4e2d977979c3c17fbc769c90`.

## Implementation and boundaries

| Checkpoint | Implemented behavior |
|---|---|
| CP1 / A, B, D | One game behind Play / Learn / Lab; Play default; research hidden from normal play. Optional isolated tutorial and release notice acknowledgment. Dark / Light / System, larger Notes, hidden timer without stopping it, reduced motion, keyboard labels/focus. |
| CP2 / C, E | None / Direct conflicts use visible values. Answer comparison is explicit and records help only upon confirmation. Automatic reviews and hints do not consult the construction answer. Number-first is opt-in; modal/game changes and Escape disarm it. Redo uses enriched existing history for values, Notes, erasure and checked eliminations. Optional peer Notes cleanup defaults Off and is part of the same transaction. |
| CP3 / F, G | Eight checked technique examples feed existing exercises/profile/review. Return to original game is available in Learn and More. Tutor persistence remains consented; no-consent outcomes work in memory. Deterministic checked profiles from givens replace clue-only labels for new ordinary puzzles. Unfulfilled requests leave current play intact. |
| CP4 / H | Up to 12 saved attempts / 2.8 MB library, Favorites, Resume, read-only Review, explicit per-game/all-data deletion, current/previous migration and recovery exports. Immutable eight-puzzle UTC daily catalog, recent seven days, repeats disclosed. Strict givens-only fragment sharing with confirmation, uniqueness qualification and text fallback. |

The canonical implementation stays in the self-contained app, with one core, input owner and board. The added `product` closure owns appearance, optional entry state, enriched history, archive/daily/share operations; existing core/worker/checker and mobile geometry remain authoritative. There are no new external runtime assets, servers or frameworks.

## Versions, rating and data contracts

| Boundary | Contract |
|---|---|
| Product release | `LAB-PLAY-LEARN-20260928-R1`; exact source bound externally. |
| Engine / session | Engine `0.3.0`, core/session version `0.2.0`, `AI8_SUDOKU_NAV_SESSION_V1` retained with additive `historyVersion:2`, redo, completion, return-game and daily fields. Unknown session fields survive. |
| Proof codec | Existing `SUDOKU_LITERAL_PROOF_U8_V1` checker/codec retained; use the exported `core.CODEC` as exact runtime identity. |
| Rating | `SUDOKU_PROFILE_V1`: P0/P1/P2/P3 map to Easy/Medium/Hard/Evil. First checked consequence in deterministic enumerator order; each lower tier must finish STALLED, requested tier SOLVED. This is a solvability profile under that evaluator, not necessity for all humans. |
| Rating budgets | Completed count-to-two uniqueness at 300,000 nodes; 1,600,000 work ticks per tier, at most 730 steps. Fresh replay through encode/decode/checker and comparison with certified result. LIMIT is UNRATED_LIMIT; unsupported, multiple, invalid and unfulfilled are not rated. |
| Generation | Eight construction attempts per ordinary request by default, maximum 12 if explicitly configured. Clue count is only a construction setting. Every attempted status retained. Practice remains PATH_CONTAINS_TECHNIQUE, not a claim the technique is unavoidable. |
| Library | `AI8_SUDOKU_LIBRARY_V2`, established LAB namespace `ai8SudokuNavigatorV020`; current `.session` mirror and `.previousGame` retained. No automatic eviction. |
| Persistence | Read revision guard, optional Web Locks for ordinary async writes, per-tab recovery first, previous-generation backup, canonical write/readback, mirror. Synchronous lifecycle fallback uses optimistic revision checks. No multi-key atomicity is claimed. At most three outstanding recovery copies. Real simultaneous-tab arbitration remains a B browser check. |
| Deletion | Epoch marker invalidates old tabs, pending workers and trace/stat/lifecycle writes. Other edition namespaces are untouched. Scoped game deletion also removes matching legacy mirrors so migration cannot resurrect it. |
| Knowledge | Assistance, completion identity and finished practice are outside reversible board transactions. Older restore merges known assistance. Imported unknown assistance is marked unknown. Time does not rewind on Undo/Redo. |
| Human trace | `AI8_SUDOKU_HUMAN_EVENT_V1`, engine `8Z_SUDOKU_HTML_HUMAN_TRACE_V1_3_0`: adds Redo and optional visible peer-Notes deltas. V1_2_0 reads remain accepted, with origin engine recorded when continuing. Hash-checked replay covers each event. Trace boot now occurs after core initialization. Matching session retains game identity; mismatched trace/session is blocked with both copies retained. |
| Daily | `SUDOKU_DAILY_CATALOG_V1`; UTC date → epoch-day modulo 8. Actual givens are saved. Pool is existing exposed HF4 development material, not a holdout. Repeats every eight days, no account or streak. |
| Sharing | `#s=1.` + exactly 81 ASCII digits; maximum 100 fragment characters. Only original givens. Ordinary wrapper forwards fragment to app. Imports are bounded and confirmed before replacing play; no arbitrary URLs or evaluation. |

PR #47 session fixture was captured retrospectively from the exact old blob using its actual DOM/worker and frozen before final candidate verification. It was **not** frozen before implementation; this procedural deviation is recorded rather than backdated. Its values, Notes, reviews, time and legacy Undo pass a focused migration test. Broader malformed/versioned/concurrent and physical upgrade coverage remains due.

## Old controls → retained location

| Original control/capability | Location and owner after change |
|---|---|
| Board, Numbers, Notes, Erase, Undo; keyboard | Play / Learn / Lab, existing single input owner; Redo in More and desktop button, Ctrl/Cmd+Shift+Z or Ctrl+Y. |
| New difficulty / welcome buttons | Existing New game flow / difficulty buttons. Requested profile may fail visibly; current play retained. |
| Mobile eight actions | Board → Numbers → Notes / Erase / Undo / New game → Hint / Why? / AI Solve / More; original controls are moved, not copied. |
| At cell / Keep context visible; three sizes; Candidate Assist | More → Settings and retained desktop Settings entry; same preference elements and geometry. |
| Proof Coach nudge/explain/reveal | Existing Navigator in Learn/Lab; Play Hint/Why? use the same checked path. Hidden old coach panel remains an adapter, not a second solver. |
| Goal, technique, new practice, check elimination, keep elimination | Learn/Lab Navigator; Return to my game in Learn and More. |
| Compare paths, alternative witnesses, review row, slider/time-machine | Learn/Lab Navigator and existing review dialog. Play More → Review. |
| Review export/clear | Learn/Lab Game Review; export also in More. Clearing rows preserves assistance exposure. |
| Learning profile, suggest practice, tutor consent | Learn, moved original `navProfile`, `navSuggest`, `navTutor` nodes. |
| Digit slice, DCC/OFF/ordinary/SHAM, deep specialist | Lab → Views, learning & laboratory, original selectors. |
| Machine memory consent, learning modes, controller comparison | Lab, original controls; opening the view runs no work. |
| Human trace consent/continue/pause/export/ignore/delete | Lab → Human Trace; recording stays opt-in. |
| Fast/random/MRV/naked/full/human strategies; Solve/Step/Reset/Compare All; speed | Lab right panel; reversible AI demonstration also on main toolbar. |
| Sensors, stats, comparisons, collapsible research/history/author links | Lab, retained original material. Historical claims are not new product claims. |
| Import/export/delete/privacy and Help | More in every view; existing Lab export/import/delete adapters also remain. Tutorial/news replay from About. |

This inventory is a source/DOM mapping. Actual rendered reachability, clipping and focus behavior across breakpoints still require Phase B.

## Narrow verification completed

Environment: Linux x86_64, Node v24.19.0, jsdom 26.1.0, real shipped Blob worker code executed in Node worker_threads. Synthetic DOM/event/rectangle tests are not real browser or iOS evidence.

`NODE_PATH=./tests/sudoku/node_modules node --test tests/sudoku-play-learn.test.cjs`

Final narrow run: **24/24 PASS**, no skipped/cancelled cases. Raw TAP is saved with the external result. Seven inline scripts execute through the harness; source syntax and `git diff --check` are also checked. Prior two failing narrow cases exposed early trace boot before the core and a wrong test API name; both were corrected and rerun. No broad or physical PASS is claimed.

Coverage includes all four profile-positive fixtures, proof replay, limits, all eight daily catalog entries, all eight examples, old/new history, sticky-picker ghost clicks, actual exercise return, archive quota/interruption/stale writer, transformed entry bound, corrupt bytes, exact PR47 migration, trace/cleanup/Redo reload, cross-tab deletion, forged rating and cancelled generation.

Existing test changes are semantic and scoped:

- `sudoku-engine-ui`: LAB review expects NOT_CHECKED; PWA still expects CORRECT. Import roundtrip uses Easy to avoid conflating bounded Medium profile fulfillment with persistence.
- `sudoku-mobile-ux`: LAB hint completes without hidden answer correction; PWA retains its old correction expectation. Archive failure accepts the new truthful message.
- `sudoku-engine-core`: 12 fixed requests retain unfulfilled denominator; accepted results still require exact requested profile and independent uniqueness. No weakened proof assertions.

## Acceptance evidence / pending Phase B

N = narrow executed predicate only. **Pending means not PASS**. Every row must be resolved against the frozen candidate before publication.

| ID | Phase A evidence and remaining work |
|---|---|
| L01 | Source/ref reconciliation and scoped diff; final commit/remote equality in external manifest. Recheck before PR/merge. |
| L02 | N shared board/view state, source control map. Pending rendered old-control reachability/uncluttered Play. |
| L03 | N no view-triggered worker; real practice archive/return preserves Notes/history/time. Pending rendered focus and menus. |
| L04 | N optional isolated tutorial/Skip, recovery/storage warning. Pending full fresh/returning notices and hold demonstration browser check. |
| L05 | N preferences and hidden timer invariant. Pending actual Light/Dark/System contrast and reduced motion. |
| L06 | Source labels, focus/Escape handling. Pending 200% zoom/text, clipping and keyboard rendered checks; VoiceOver physical only. |
| L07 | Geometry/gesture owner retained. Pending full inherited picker/settings suites and geometry matrix. |
| L08 | Pending all-digit and actual/restored Easy preference matrix including new themes. |
| L09 | N no answer leakage in hints/reviews. Pending inherited picker hidden-answer/worker traps. |
| L10 | N sticky hold/loupe/ghost-click exactly-once. Pending full inherited hold/jitter/gap/original-target matrix. |
| L11 | N automatic feedback separate from assist; poisoned solution does not drive hints; explicit check cancel records nothing. |
| L12 | N arm/exit/filled/given/Escape/modal; pending full keyboard/Notes/new/import/reload combination matrix. |
| L13 | N armed digit × held picker × loupe × ghost click passes. Physical touch still pending. |
| L14 | N values/Notes/cleanup/proof Undo/Redo, branch invalidation, reload and legacy Undo; pending full replacement/erase matrix. |
| L15 | N help survives history and older restore; trace restore retains identity. Pending completion/tutor/machine dedup matrix. |
| L16 | N opt-in cleanup no retro edit and exact reversal. Pending explicit conflicting-entry case in broad suite. |
| L17 | N eight checked examples, real independent exercise and return. Pending consent/revocation/profile/review workflow matrix. |
| L18 | UNKNOWN_REASONING and conditional pre-state logic preserved; pending existing proof/review/alternative suites. |
| L19 | N four deterministic positive profiles, complete lower closure, independent replay and uniqueness. |
| L20 | N LIMIT/unsupported/multiple/invalid/unfulfilled and forged saved rating rejection. |
| L21 | Frozen 80-request validation JSON + runner; **not run**. N generation cancellation. Full outcome/performance report pending. |
| L22 | N exact PR47 session + previous migration, unknown fields, damaged bytes. Pending larger migration/version matrix. |
| L23 | N multiple games/Favorites, exercise return, quota block. Pending daily/import/new archive and Review workflow breadth. |
| L24 | N 12-entry bound, interrupted write/recovery, stale writer, epoch deletion; pending true simultaneous-tab and Web Locks browser test. |
| L25 | N UTC equivalence, invalid date, eight-day repeat and resume identity. Pending UTC midnight/clock-back/upgrade/completion dedup. |
| L26 | N givens-only strict fragment and wrapper forwarding source check. Pending ordinary browser roundtrip/clipboard fallback. |
| L27 | N malformed/oversized/nonunique share leaves board/storage unchanged. Pending complete file-import fuzz/version coverage. |
| L28 | N stale generation cancelled on view switch; review/control guards in source. Pending all async races and idle/performance benchmark. |
| L29 | DOM startup and real worker action/reload N. **Rendered browser startup/action/reload pending.** |
| L30 | Self-contained app and wrapper source retained. **Ordinary/direct/file/offline rendered paths pending.** |
| L31 | **NOT PUBLISHED**. No LAB PR/merge/Pages/live candidate evidence yet. |
| L32 | This map, source manifest/raw narrow evidence and physical checklist checkpoint saved externally. Final published SHA/live results still due. |

## Frozen Phase B execution

Fresh-read remote main/branch and handoff/routing; verify commit/blob hashes. Do not silently edit a frozen candidate. Test additions are allowed; substantive repair returns `TEST_FAILURE_NEEDS_SOL` and refreezes under the mandated build phase.

```sh
npm ci --prefix tests/sudoku --ignore-scripts --no-audit --no-fund
NODE_PATH=./tests/sudoku/node_modules node --test \
  tests/sudoku-picker-settings.test.cjs tests/sudoku-mobile-touch.test.cjs \
  tests/sudoku-desktop-hold.test.cjs tests/sudoku-mobile-ux.test.cjs \
  tests/sudoku-engine-ui.test.cjs tests/sudoku-engine-core.test.cjs \
  tests/sudoku-engine-proof.test.cjs tests/sudoku-play-learn.test.cjs
node tests/sudoku-mobile-geometry-matrix.cjs
node tests/sudoku-play-learn-profile-matrix.cjs
git diff --check
```

The profile matrix freezes 20 requests per label, eight attempts, 12 seconds/request and 240 seconds total. Every rejection, timeout, error and total-budget-not-run record stays in the 80-request denominator. All admitted puzzles undergo the frozen independent count-to-two reference plus proof replay. Seeds are disjoint from explicit tuning/fixture seeds; uncontrolled interactive seeds are not claimed globally disjoint. It is engineering coverage, not a statistical human-difficulty scale.

Use the browser skill for real browser verification. Required viewports: 320×568, 390×844, 402×874, 740×402 landscape, 760/761 breakpoint and wide/tablet; include safe area, partial scroll and 200% zoom/large text. Exercise Notes/Undo/Redo/reload, new/return/tutorial, theme semantics, two tabs, profile rejection, daily/share wrapper/direct, cancellation and offline downloaded copy. Compare startup/generation/hint timings with exact old app in the same environment; report bounds and unresolved environments honestly. Keep synthetic geometry feasible/fallback counts separate from browser and physical tests.

Do not run `build-sudoku-pwa`. The unchanged PWA is not expected to equal the new LAB. Do not alter global CI to bypass this scope; report an actual required-gate conflict if encountered.

After all release blockers pass: fresh main and open PR checks, separate scoped LAB PR, exact expected head check, merge, actual Pages run, ordinary uncached-by-query URLs and content/resource hashes plus rendered live readiness. Save candidate/head/merge/published SHAs and read back results. Only then use `LAB_PUBLISHED_AWAITING_BD_REVIEW`.

## Future APP donor/adapter map — read-only planning

Read `apps/sudoku-mobile/scripts/build.mjs` at PR #26 head above; blob `26f1a162b432552a15368c43ccd0d0592542ce65`. A literal read-only audit found 23 replaceOnce anchors: 13 still occur once, 10 no longer occur. This is **not** a build or proof of native compatibility.

| Anchor group | Future adaptation required, after new explicit approval |
|---|---|
| Title / welcome heading (#2–3) | Old text replaced with 8zSudoku Play & Learn. Bind exact approved donor; do not relax assertions indiscriminately. |
| Consent revocation (#6–7) | LAB now removes stored tutor/machine data itself. Reconcile native adapters with these semantics, no duplicate logic. |
| Delete all (#12) | Product epoch/delete boundary replaces old function. Native temporary-export cleanup must attach to that boundary and preserve no-resurrection rules. |
| Pagehide (#13), scheduling/persist (#18–19), boot (#20) | Integrate library, recovery, trace/session matching and save queue with native pause/resume. Preserve native origin/storage and legacy migration. |
| Mobile API return (#15) | Export order/API grew (`openSettings`, preferences etc.); attach Back without duplicating input ownership. |
| Retained once (#1,4,5,8–11,14,16,17,21–23) | Viewport/cell semantics, downloads, trace/review export, unload, timer, recovery hook and native shell insertion still match literally; semantics still need testing. Product ARIA must coexist with native button conversion. |
| New routes | Givens share URL should point to public `/S/new/`, not a Capacitor-local origin; native clipboard/share/Files bridges must handle the new library/recovery routes. |
| New saved contracts | Include history V2, library V2, deletion epoch, rating/daily versions and preferences in native migration/recovery tests. Keep assist/proof state separate from Notes. |

Native blank-screen blocker remains open. Publication or green LAB tests is not APP approval. After BD identifies and approves the LAB release actually tried, obtain a new explicit APP mandate; signing/upload still needs the exact new native full SHA approval.

## BD physical checklist (after publication)

Target ordinary URL: `https://bd-chess.github.io/bd-chessdb/S/new/`. Candidate release ID: `LAB-PLAY-LEARN-20260928-R1`. **This candidate is not live yet**; Phase C must replace this warning with verified published SHA and ordinary URL.

1. iPhone 16 Pro: resume old game, values/Notes/Undo/Redo, close/reopen and orientation. Do not clear Safari data.
2. At cell / Keep context visible, all sizes, steady hold/no-slide/gap cancellation, magnifier over Notes.
3. Play/Learn/Lab, Light/Dark/System, readable Notes, hidden timer; tutorial/practice return keeps the game.
4. Optional number-first and Notes cleanup, None/Direct conflicts, explicit Check correctness; help never silently enters a value.
5. Each profile and its label, lesson/review, saved games, daily and share without private progress.
6. Downloaded/offline path separately from first-time URL loading; record Safari/iOS conditions. This is not WKWebView/TestFlight acceptance.
