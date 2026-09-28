# 8zSudoku: install CURRENT and LAB in place

BD approved this scope on 2026-09-28. Base main: `d81333434a8d0e0ccf674d4cac7b25c72957c64e`.

CURRENT `/S/` and LAB `/S/new/` are independent installable channels. Their manifests, complete SHA-256 packages and worker cache namespaces are separate. The package helper consumes each channel's own source. It never promotes LAB or copies it into a separate PWA edition. BD subsequently supplied the authoritative original `BD_Sudoku1.html` (48,399 bytes). PREVIOUS `/S/old/index.html` now serves those exact bytes directly, without the later R6 HF3 research section. The later archive `/S/old/001/` remains preserved. The Slovenian view button is named Lab, as in English.

Play/Learn center the board and move news, optional practice and one human status below it. Technical rating remains in Lab. EN/SL changes visible UI, help, tutorials and learning text, persists the choice and preserves machine values, game state and evidence. Historical research prose and technical identifiers retain their original language.

CURRENT's compressed game payload and LAB's navigator-core are unchanged. CURRENT gains a separate validated session adapter (`8zSudokuCurrent.pwaSessionV1`). LAB retains its existing session/library namespace. An update reload requires a completed save, readback and a final state check; generation, animation, quota errors or concurrent writes block it. Other tabs are never automatically reloaded.

The former `/S/PWA/` is a recovery entry with its original manifest identity and byte-identical frozen game. Existing installations and data are preserved. Export the old session and explicitly import it into LAB; verify the imported game before retiring the old installation. iOS may use separate storage containers. No automatic storage migration or deletion occurs.

## Verification

- `node scripts/build-sudoku-pwa.cjs --check`: all three complete packages reproduce exactly.
- `NODE_PATH=./tests/sudoku/node_modules node --test tests/sudoku-pwa.test.cjs`: 16/16 targeted checks pass (about 12 seconds).
- Checks cover both deployment bases, offline dependency closure, request boundaries, mixed/failed installs, evicted assets, cache isolation, explicit activation, save failures, concurrent writers, Notes/Undo/Redo/timer restoration, language changes and tutorial/lesson state preservation.
- `git diff --check` and JavaScript parsing pass.
- These are bounded VM/jsdom/worker tests, not physical-device acceptance. Actual iPhone Home Screen installation, offline relaunch, VoiceOver and mobile zoom remain BD checks.
- Live deployment SHA and public-byte/browser evidence are recorded in the project continuity after publication.

Native APP, draft PR #26, TestFlight and other applications are outside this change. A fresh explicit BD approval is required before a native APP build.
