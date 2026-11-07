# 8zSudoku APP / LAB parity — phase A checkpoint

2026-09-27 · continuation of draft PR #26, not a new app.

## Scope and provenance

Mandate: `NEXT_FOR_GPT_WORK_20260927_SUDOKU_APP_LAB_PARITY_R1.md`, Drive `1fK3mnnK624bv8YC1Sq8FZowhVwf6iuo8`. Source code remains descended from app head `4a6d0bc19dd2ac2de06c89aecaf3748f5d8630c2`.

LAB source is frozen at main `16d4b88562fc047ac6a4b3fe39e321e4d9a0ee73`, path `public/S/new/app.html`, blob `e929d6a47032c1bfe52fcb12dd7272ef0eae24ed`, SHA-256 `707872643063d6da9bd0246d828f15e76a7c7d09cbfc8e385fb322f85c01e435`. This is the same Sudoku donor as the mandate's PR #43 snapshot; the newer main also contains unrelated Chess work. A fresh Pages HTTP read matched this hash. The complete, unchanged donor is checked in at `apps/sudoku-mobile/donor/app.html`. No public web file, Pages/Netlify setting or unrelated source is changed.

The old native HTML was regenerated before changes and matched historical SHA-256 `c122e92d04e8c02182ccb70964bed678672c083e32f3d5d298e7b4b82536eb53`. The migration fixture was produced by playing an actual disposable game in that generated page, enabling machine/tutor consent, requesting a checked hint, completing a practice move, adding Notes and saving through its native lifecycle adapter. It contains nonempty legacy machine/tutor data, review proof, Undo, elapsed time and previousGame. No BD progress was used.

## Transformation ledger

Every exact transform uses the retained fail-fast one-occurrence check; `build-transforms.json` records applied anchors/counts. Donor and icon SHA-256 AND Git blob checks remain mandatory.

| Old transform / concern | Decision | Current implementation / assertion |
|---|---|---|
| Donor path | Adapt | App-local immutable snapshot; sourceCommit/sourcePath retain upstream identity. |
| Viewport cover | Retain | Exact viewport replacement; supports safe area. |
| Old title | Adapt | Exact Engine 0.3.0 donor title → 8zSudoku. Original old builder failure reproduced. |
| Welcome heading | Retain | Existing 8zSudoku name transform. |
| Mobile cell sizing replacement | Remove: already in LAB | Donor sizing and bright digits retained. No old native header/layout CSS. |
| Grid cell div → button | Retain | Same click handler, explicit type=button, current labels/pressed state. |
| Relative external links | Retain, tighten | Seven reviewed href occurrences; absolute user-initiated links, noopener. |
| Machine/tutor revocation | Adapt | Retain new demo guard, clear only optional stored/live records on revocation. |
| Generic download / trace / review | Retain | Three existing JSON export routes go through compiled Filesystem/Share bridge. |
| Share cache cleanup | Repair | Android chooser completion is not consumer completion. Keep owned cache files until explicit local deletion/OS eviction. Deletion waits for pending writes and blocks late Share. No success claim for cancellation. |
| Trace beforeunload | Retain | Deletion flag prevents resurrection. |
| Delete All | Adapt | Clean transient demo/gestures/jobs before namespace/cache deletion; pause/autosave/unload cannot recreate data. |
| Old pagehide adapter | Replace | One native lifecycle adapter cooperates with mobileUX.prepareUpdate, closes cards/holds/demo, flushes canonical state, suspends/resumes one timer. |
| Donor duplicate pagehide cleanup | Remove from native transform | Native adapter owns ordering; donor file remains unchanged. |
| Android Back | Adapt | Pending/active gesture → card/menu → demo return → legacy help/details → existing exit. |
| Failed session restore | Repair | Invalid JSON/version/rejected session retained; explicit recovery export/discard; automatic overwrite blocked. No schema relabeling. |
| Native touch-action CSS | Remove | LAB remains the sole touch recognizer; ordinary scrolling contract retained. |
| Native safe-area/accessibility CSS | Retain, narrow | Insets on all four sides, real-button appearance reset, focus/reduced motion. Actual native geometry remains phase B/device acceptance. |
| Bridge keypad placement | Remove: already in LAB | Generated-page phone/tablet/phone test asserts one panel and toolbar. |
| Engine / geometry / gesture algorithms | Preserve | Core and geometry script bytes equal donor. Touch arbitration and mouse/pen support are imported intact. |
| Module bridge injection | Retain | Local compiled bridge; no iframe, remote server.url, PWA worker or updater. |
| Output directory | Tighten | Rebuild clears only generated web/, eliminating stale assets. Explicit closure is index.html, bridge.js, icon.png. |
| Platform asset verification | Extend | Both synced platforms byte-match all three assets and preserve identity/config; iOS bundle check now includes icon.png. |

## Identity, versions and storage

Name and ID remain **8zSudoku / org.chessbest.eightzsudoku**. Icons and native entitlements are unchanged. Config stays `webDir:web`, `server:{androidScheme:https}`. Installed Capacitor source defaults are iOS `capacitor://localhost`, Android `https://localhost`; the storage namespace remains `ai8SudokuNavigatorV020`. No uninstall or origin migration is needed. The DOM harness uses https://localhost because JSDOM does not provide native custom-scheme storage; native-origin acceptance is still pending.

Engine revision is **0.3.0**; evaluator/export compatibility version remains **0.2.0**, with `AI8_SUDOKU_NAV_SESSION_V1` and the existing export/proof schemas. Old observation costs are retained but censored by the donor when their cost revision is obsolete; they are not falsely relabeled as new engine performance.

iOS marketing version remains **1.0**. Preserve the existing CI CFBundleVersion formula; allocate from actual future run/attempt after checking recent releases. Previous verified signed run: **36254855860**, run 2 attempt 1, old source `4a6d0bc1`, successful. No new upload is approved. Android versionCode advances **1 → 2**, versionName remains **1.0**. No signed Android build is claimed.

Old native snapshots never serialized selectedCell, notesMode or timerRunning. Their live prior values cannot be recovered. The new donor defaults absent selection/Notes mode to null/OFF and resumes the old saved game; stored pencil marks, timer seconds, Undo and proofs remain. New snapshots retain all three additional fields, checked through a second restart. No automatic browser/PWA → native data transfer is claimed.

Capacitor's pinned iOS default has zoom disabled. The task does not change that setting and does not claim pinch-to-zoom acceptance. Safe-area handling remains CSS-driven with the unchanged native inset configuration.

## Phase A evidence and limits

- Old builder with the new pinned donor failed at the exact stale title assertion before repair.
- `npm ci` succeeded. Adding test-only jsdom 26.1.0 changed no existing lockfile package entries or runtime dependency versions.
- Generated native integration **N01–N09: 9/9 PASS**. Real generated HTML and compiled bridge; actual worker computation; synthetic DOM rectangles/events and OS plugin boundary. Not WebKit/device proof.
- Retained input/consent/offline checks **4/4 PASS**, plus core/geometry byte-parity check **1/1 PASS**.
- Modified iOS bundled-asset check **1/1 PASS** with synthetic app files; not Xcode compilation.
- `npm run sync` and `npm run verify:package`: all three files match both platforms; two builds produce identical runtime bytes.
- Three old extracted adapter tests were replaced by stronger generated-page tests N03–N05/N08. The layout owner legitimately moved into LAB; lifecycle/delete now depend on that owner. No failing behavioral assertion was removed to obtain green. The remaining extracted consent test gained only the new demo-guard dependency.
- A test-harness defect initially prevented static inline Undo click handlers in JSDOM's outside-only mode; binding the real donor handler restored the browser behavior. Test teardown now drains queued review/export work before closing its isolated DOM.
- Full parity suite, rendered viewport/safe-area tests, iOS cloud compile/simulator and physical phone acceptance **NOT RUN in phase A**. Android SDK was not present at the standard checked paths and SDK environment variables are unset; available Java is 17, below the existing route's JDK 21 requirement. **ANDROID_NATIVE_BUILD_PENDING**, no APK.

## Resume at the manual gate

Status: **PHASE_A_READY_FOR_BROAD_TESTING**. The mandate §9 explicitly requires the manual switch to **GPT-6 Luna / Max** and **CONTINUE_TESTS** before this matrix or an app-branch push. No app branch push, signing-secret access, release tag or upload is part of this checkpoint.

1. Restore the durable commit/checkpoint and verify source/build hashes. Re-read PR #26/app head, main donor and concurrent work. Do not reset branches. A changed relevant donor/head requires reconciliation, not automatic substitution.
2. Run `npm ci`, `npm run verify:donor`, `npm run sync`, `npm run verify:package`, `npm test`, and `python3 -m unittest discover -s test -p 'test_ios_ci.py' -v` from apps/sudoku-mobile. Preserve logs. `npm test` now includes the frozen upstream UI, UX, touch and desktop tests against GENERATED native HTML plus compiled bridge.
3. Run `node test/upstream/sudoku-mobile-geometry-matrix.cjs`. Its only source adaptation is the generated-native input path. Record feasible and fallback totals/reasons separately. Do not count deliberate infeasible positions as successful popup openings.
4. Render the generated native page at 402×874, 390×844, 320px width and tablet/rotation; inspect digits, Notes, toolbar, help/demo, focus, overflow and insets. Synthetic geometry does not certify safe areas. Use real WKWebView gesture automation if supported; record exact browser/OS/input provenance.
5. Parity tests in test/upstream are pinned by SOURCE.json. The native harness substitutes only the generated input and native Share observations. One immediate-export assertion now awaits the native async write; its one-export assertion is preserved. PWA-only update tests remain PWA-only. No engine arena/benchmark is included.
6. Before pushing, inspect the resulting draft-PR diff and require all new changes to be inside apps/sudoku-mobile/. Keep main/public web unchanged. Push one validated update to **feat/8zsudoku-mobile** only after the gate; preserve current remote head by fast-forward or reviewed reconciliation. No force push and no merge.
7. Inspect the ACTUAL triggered iOS workflow run and exact source SHA. Verify Xcode compile, asset check, simulator install/launch/relaunch and screenshot. A branch commit or screenshot alone is not a gameplay gesture PASS.
8. Android: if JDK 21 + SDK 36 become available, build with `cd android && ./gradlew assembleDebug` (Windows: gradlew.bat assembleDebug) and inspect APK assets. Otherwise retain the synchronized project and explicit pending status; no new cloud workflow or signing setup.
9. Any substantive failure: **TEST_FAILURE_NEEDS_SOL**, reproduce/repair with Sol / Extra High, refreeze and repeat only affected checks before continuing.
10. After phase B, emit **READY_FOR_NEW_TESTFLIGHT_APPROVAL**, with full tested SHA, actual CI evidence and next-version plan. Only a fresh exact-candidate BD approval can unlock the protected one-shot release path. Never reuse/move the historical TestFlight tag or use the old GO. The next instructions must reuse the existing environment/BD group and guide TestFlight **Update**, not reinstall.

Required physical checks after separately approved upload: natural stationary holds and jitter, short tap/early pan, picker all digits/Notes/Undo, fixed moving-content magnifier across edges, Hint/Why, demo Stop/Return, background/relaunch, export/import and airplane-mode cold launch. Delete only disposable test data. Until then: **PARTIAL_DEVICE_ACCEPTANCE_PENDING**.

## Remaining concrete risks

- Any pre-activation touchmove still yields to scrolling. No unmeasured jitter tolerance was added. Physical iPhone/WKWebView validation must determine practical hold usability.
- Native safe areas/keyboard, modal focus and actual OS Share/Files/Back require platform evidence beyond mocked calls.
- Boot recovery dialog failure paths and delayed restore/background interactions belong in the broader matrix. Invalid records are never silently reset.
- Source-only PR descriptions retain historical statements until the phase B push/update; this checkpoint and subsequent exact receipts supersede those setup claims.

No Apple processing, Ready to Test state, new phone installation or public store release is claimed.

## Phase B continuation — 2026-09-27

BD invoked `CONTINUE_TESTS`. The Drive Git bundle restored the exact phase-A
commit `c70671b2b0bbd133b153fbf676698fb6fcc2ed87`; its runtime hashes reproduced.

The first broad run returned 45/48 passing checks. All three failures came from
the upstream adapter silently changing JSDOM's default viewport (1024×768) to
the native harness's phone default (402×874). Thus desktop engine tests opened
mobile New game / AI demonstration confirmations instead of invoking the
desktop actions they were written to exercise. A pending New game dialog also
correctly blocked the subsequent import. The adapter now preserves upstream
defaults, with a new regression covering both default and explicit phone
viewports. No game code or existing assertion was changed or skipped.

The affected engine/adapter run passed 12/12. Synthetic geometry passed all
invariants across 1,215 cases: 783 feasible openings and 432 explicit fallbacks
(405 clipped-board cases, 27 constrained-space cases). Normal 402×874 and
390×844 portrait and the synthetic safe-area case each have 81/81 feasible
positions; 320×568 has 54/81. These totals are not native rendering evidence.

The cloud browser refused the local generated-page preview with
`ERR_BLOCKED_BY_CLIENT`; no rendered-browser or physical gesture PASS is
claimed. Android SDK 36 and JDK 21 are still unavailable here. Native iOS CI,
its screenshot and the final broad-run result are recorded in the subsequent
phase-B receipt, not inferred from this source checkpoint.
