# Sudoku LAB Play / Learn — release verification, 2026-09-28

This release continues the frozen Phase A checkpoint after BD explicitly requested production publication: “če nisi tega dal v producijo to daj, da preverim”. This is the task-specific continuation/publication override of the prior manual model gate. No automatic model switch or independent verifier is claimed; verification and repairs ran in the builder session. APP publication remains forbidden without a new explicit BD approval.

## Frozen source and scope

Phase A remote candidate: `0b71091e4d62ec71ece9ed70ce3d858fb8841672`. Fresh main before release: `af1f03e141976c3a0540551e1ebec135f071ecdd`. Concurrent Chess changes are preserved. The runtime delta is confined to `public/S/new/app.html` and `public/S/new/index.html`; other changes are Sudoku tests/fixtures and these release notes. No dependency, workflow, APP, stable Sudoku or Sudoku PWA changes. Draft PR #26 remains at `17609ba66d1eb9190b648436d0eb6f5e30b9caa9`.

Fresh activation pins verified: COMMANDS R33 `9aa3dd9d67ec6d637c4eb6662fd8e0b631cf584f4e2d977979c3c17fbc769c90`; routing v2026-09-24-R1 `10005c845d5dfbee44f6e012441b5c859c87f3e21d8fc9be791dd1613f780bcd`. The Phase A document retains the feature/control/native-adapter inventory and old-source identity. Exact final commit/tree, merged SHA and live evidence are recorded in the external publication receipt to avoid recursive self-hashing.

## Verification and concrete repairs

- Final bounded regression: **87/87 passed**, zero skipped/cancelled, 24.289 seconds. Eight suites: picker/settings, mobile touch, desktop hold, mobile UX, engine UI, engine core, independent engine proof, Play/Learn. Node 24.19.0, jsdom 26.1.0; real shipped Blob workers run in worker_threads. Synthetic DOM evidence is not a real device claim.
- First broad run: 83/84. The one failure assumed a Hard request always succeeds before checking picker preferences. Hard now has honest bounded failure semantics; the unrelated settings scenario uses a certified Easy request. Its narrow rerun passed.
- Desktop Play Hint/Why previously wrote the explanation into the hidden Navigator panel. Both now open the existing checked help card; no duplicate solver. A narrow test checks visibility, Why escalation and board preservation.
- A failed ordinary profile now offers an explicitly disclosed fixed catalog example. It never silently replaces the generator result or hides its rejection. The chosen example is re-rated, must match the requested label and archives the current game before loading. Provenance and possible repetition stay visible. All four labels and archive failure have narrow tests. No fallback for technique-specific practice.
- Those three release tests passed; the final 87-test run includes them.
- Synthetic geometry: **8,505 cases**, 6,642 feasible and 1,863 bounded fallback, across 105 viewport/safe-area/text configurations. Physical touch and actual viewport clipping remain separate.
- Fixed-seed profile matrix: **80 requests**, 20 per label, eight attempts/request, 12-second per-request and 240-second total cap. Easy 20 accepted/0 unfulfilled; Medium 1/19; Hard 4/16; Evil 6/14. Total **31 accepted, 49 PROFILE_UNFULFILLED**, no timeout/error, 20.166 seconds. Every accepted result passed independent exact uniqueness and checked proof replay with the requested profile. This is a fulfillment limitation, not a stronger solver-quality claim. The fixed examples are separate and do not change these denominators.
- All eight daily catalog entries and eight teaching examples are checked. Exact PR #47 save migration, legacy Undo, trace replay/Redo, damaged bytes, quotas, interrupted writes, stale writers and deletion-epoch suppression pass their stated automated predicates.

## Acceptance map

PASS below means the stated automated predicate, not all possible devices/interleavings. Browser/live evidence is appended externally after deployment; physical-only or unavailable conditions stay unverified.

| Row | Evidence and remaining boundary |
|---|---|
| L01 | Fresh refs/pins and exact allowlist; final tree/ref comparison in publication receipt. |
| L02 | One board/state, retained control map, no view-triggered worker; live Play/Learn/Lab inspection required. |
| L03 | View/menu state and actual practice archive/return tested; browser action/reload check required. |
| L04 | Optional isolated tutorial, Skip/replay, restored game and storage warnings tested. |
| L05 | Preferences, unknown-field retention, Notes size and hidden timer invariant tested; physical contrast/accessibility review pending. |
| L06 | Keyboard/Escape/focus predicates tested; actual zoom/VoiceOver not claimed. |
| L07 | Inherited picker/settings suites plus 8,505 synthetic geometry cases pass. |
| L08 | Inherited all-digit/modes/sizes/actual-restored Easy Auto matrix passes. |
| L09 | Hidden-answer/worker traps and Notes preservation pass. |
| L10 | Hold/jitter/gap/original-target/magnifier/ghost-click regression passes; physical iPhone pending. |
| L11 | None/direct conflict and explicit check disclosure pass; hints/reviews do not consult the answer oracle. |
| L12 | Number-first activation/Escape/modal/given/filled-cell predicates pass; physical keyboard combinations pending. |
| L13 | Sticky digit × held picker × magnifier × ghost-click exactly-once test passes. |
| L14 | Placement/Notes/cleanup/proof/legacy Undo and Redo, reload and branch invalidation pass. |
| L15 | Help knowledge survives history/older restore; trace game identity retained. Exhaustive completion/tutor counter interleavings not claimed. |
| L16 | Default-off visible-peer cleanup is one reversible transaction; no retrospective cleanup. |
| L17 | Eight checked lessons, actual generated exercise/return and inherited review/profile logic tested. |
| L18 | Independent proof/review suites retain unknown reasoning and conditional pre-position evidence. |
| L19 | Four positive deterministic profiles, lower-tier completion, uniqueness and replay pass. |
| L20 | LIMIT/unsupported/multiple/invalid/unfulfilled/forged-rating tests pass. |
| L21 | All 80 requests retained, including 49 rejected; cancellation tested. |
| L22 | Exact old save/previous migration, unknown fields and damaged-byte recovery tested; malformed/version coverage is bounded. |
| L23 | Multiple games/Favorites/resume, practice/daily/new archive and quota safety tested. |
| L24 | 12-game bound, interrupted recovery, stale revision and cross-tab deletion tested. Real simultaneous browser-tab write interleavings remain unverified; lifecycle CAS is not atomic. |
| L25 | UTC date equivalence, invalid dates, repeated catalog and daily resume identity pass; manual clock-jump/upgrade acceptance pending. |
| L26 | Strict givens-only sharing and wrapper forwarding tested; live ordinary link roundtrip required. |
| L27 | Malformed/oversized/nonunique fragments preserve current state; bounded file-import validation tested. |
| L28 | Cancelled generation/stale result guards tested. No exhaustive race/performance benchmark claim. |
| L29 | Real shipped worker + synthetic DOM action/reload pass; live browser action/reload required. |
| L30 | Ordinary wrapper/direct app live checks required. Downloaded `file://`/offline runtime remains unverified because the browser tool blocks that protocol; no workaround used. |
| L31 | Exact candidate/PR/merge/Pages/live hashes recorded in final external receipt. |
| L32 | Final result, raw evidence, physical checklist and existing native-adapter map saved/read back externally. |

## BD physical review

1. Open the ordinary `/S/new/` link on iPhone Safari. Check Play layout, all nine picker digits, hold/release, edge cells and large text.
2. Try optional tutorial, Notes, Undo/Redo, number-first and Dark/Light/System. Check that switching Play/Learn/Lab keeps the game.
3. Ask Hint/Why, try a lesson/practice, return to the original game. Confirm only an explicit correctness check compares answers.
4. Try New Medium/Hard/Evil. If the bounded request fails, test the disclosed checked example. Resume the previous game from Library; favorite it; reload.
5. Open Daily and a shared puzzle link. Review the shown UTC date and repeated finite-catalog explanation.

Publishing the LAB is not UX acceptance or APP/PWA promotion. The old native white-screen blocker and adapter drift remain recorded. Before any APP donor change, build, TestFlight operation or PR #26 action, wait for a new explicit BD approval identifying the accepted LAB release.
