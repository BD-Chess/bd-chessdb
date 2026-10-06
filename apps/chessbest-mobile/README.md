# ChessBest iPhone candidate

Status: **PARTIAL — PHASE_A_READY_FOR_BROAD_TESTING**. Source and narrow checks are prepared; no iOS compile, WKWebView launch, Files/Share acceptance or TestFlight upload has been proved. Read `docs/ACCEPTANCE.md` before a native run. This is a development candidate, not an installable beta.

Draft identity: **ChessBest**, `org.chessbest.chessbest`, marketing version `1.0`, placeholder build `1`. Apple availability, team, explicit App ID, app record, profile, monotonic build number and BD's tester role remain unverified. Minimum deployment target: iOS **16.4**, iPhone only; Xcode 26+ CI is prepared. One UIKit scene owns one WKWebView.

## Reproduce

From this directory, with Node 24:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run sync
npm run verify:package
npm run test:narrow
python3 -m unittest discover -s test -p 'test_ios_ci.py' -v
```

`donor.json` pins CURRENT at `ae8df5f7f9216edf7822b06a3e0b37a263f4ce37`. The builder reads the repository's unchanged `public/chess/` subset, checks every source hash plus release manifest, enforces transform cardinality and writes `web/`, `asset-manifest.json` and `transform-ledger.json`. Verification recreates expected bytes and rejects extra/missing assets. Generated `web/` and native `public/` are ignored; never edit them. Changes to the donor require a deliberate reviewed re-pin, not a new URL scrape.

Capacitor core/CLI/iOS are pinned at 8.5.2; four plugins at 8.0.0; npm lockfile is committed. SwiftPM pins the remote Capacitor dependency exactly; plugin packages resolve from locked node_modules. Core sources and releases from this repository remain reproducible at the candidate commit.

## Native contract

- Bundled board, pieces, seven curated Top Picks/collections, local Stockfish single-thread JS/WASM and separate NNUE/source notices. No remote `server.url`, embedded website, service worker or PWA installer.
- Independent `ChessBest:APP:v1:` localStorage/IndexedDB. Fresh boot never reads/imports Safari/CURRENT/LAB data or browser tokens. Startup storage probes fail closed. Native single-scene queue substitutes for absent Web Locks while preserving Study revisions/readback and quota errors; it is not a cross-WebView lock.
- Explicit PGN/JSON import uses existing validated file controls. All explicit Blob download entrypoints route to iOS Files/Share using temporary Cache files, a 32 MiB limit and cancellation/failure feedback. Closing a share sheet is not reported as proof of a saved file. Native behavior remains untested.
- Backgrounding invalidates analysis, stops all local engine controllers and Replay, aborts provider requests, cancels queued local reviews, pauses local clocks without changing two-player mode and checkpoints/pauses tournaments. Training ends with its game retained. Foreground never automatically resumes an engine/tournament. Process-kill atomicity and update retention await native acceptance.
- ChessDB uses its explicit HTTPS endpoint; provider labels remain CDB/SF/DCC. Native CORS/ATS/live fallback is unverified. Gemini, Lichess and Anthropic are unavailable; paid APIs and credential collection are disabled. Lichess is rejected before any game mutation.
- APP info contains local privacy, manual transfer/delete, license and source-export controls. Deletion sets a marker, reloads and completes removal of APP records before normal boot; failure retains the marker for retry. It never deletes browser namespaces.
- Static bundled help uses an in-app dialog; external HTTPS links use the system browser. Safe-area spacing and touch targets are adapted; actual touch/landscape/text-scale acceptance remains open.

## CI and release

`.github/workflows/chessbest-ios.yml` runs narrow checks on this feature branch. Native compilation and semantic simulator probes require a fresh `chessbest-native-check-*` tag **after** BD's manual Luna/Max `CONTINUE_TESTS` gate. The native job is bounded to 20 minutes, each readiness phase to 100 seconds. No tag has been created for this checkpoint.

Simulator success requires visible board/pieces, seven local picks, legal UI navigation with rendered-board agreement, actual Stockfish depth/progress, Study commit and exact full game/cursor restoration after process termination. It records first/relaunch screenshots, timing, sanitized errors, device/runtime and full commit. DOM fixtures and real WASM via Node transport are explicitly narrower evidence.

Signing additionally requires an immutable fresh `chessbest-testflight-*` tag, original repository, full approved SHA equal to tested SHA, explicit upload flag/build number, protected **chessbest-testflight** environment, Chess-only secrets and exact-bundle distribution profile. Current environment protection is unverified. The script never creates Apple IDs or invites testers, uploads once and never retries ambiguous Apple processing. Any source change invalidates approval. No release approval is currently held.

Sudoku reference: read-only `apps/sudoku-mobile/` at `17609ba66d1eb9190b648436d0eb6f5e30b9caa9`. Its cloud signing/profile guard was adapted, while identity, storage, native probe and assets are Chess-specific. No Sudoku files or public web files were changed.
