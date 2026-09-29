# ChessBest APP PWA

APP is installed in place at `/chess/app/`; the installed start URL is `play.html`.
The `/chess/app/` URL never redirects automatically. Desktop browsers, tablets,
and phone browsers using Request Desktop Site retain the adjustable drawn-phone
preview. Ordinary phone browsing keeps the same URL but removes only the
decorative frame and expands the embedded APP to the viewport, approximating the
future native iOS/Android shell. The installed start URL remains `play.html`.
The APP shell also exposes EN/SL with APP-local language persistence and a compact CDB-first / SF-fallback Top line. Installation and offline readiness appear in **More**. On iPhone use Safari,
Share, Add to Home Screen. Open the direct mobile page before installation.

The APP worker owns only its allowlisted files, relative to its own registration
URL, including on GitHub Pages under `/bd-chessdb/`. It cannot intercept CURRENT,
PREVIOUS, LAB, another application, API calls, or token files. Saved application
data retains the existing `ChessBest:APP:v1:` namespace; installation does not
copy or clear other channels' data. Browser and installed-app storage sharing is
platform-dependent; export important studies before moving between environments.

The offline release includes the board, game library, saved-study UI and local
Stockfish JS/WASM. ChessDB still requires a connection. Offline availability
requires the first successful download; browsers may later evict cached data.

## Updates

Run `python3 tools/build-chess-channel-pwas.py` after changing APP runtime files.
APP uses its own templates; CURRENT and LAB's update behavior is unchanged.
`--check` verifies generated releases. Every APP precache request has SHA-256
integrity, and a failed batch discards only the incomplete new release.

APP deliberately does not call `skipWaiting`, `clients.claim` or reload an open
page. A new version waits until **all APP windows** close. Finish running work,
save any study edits, close all APP windows (including desktop previews), then
reopen. Old release caches are removed only when the browser permits activation.
Uncached allowlisted resources fail with 503 rather than mix deployed versions.
The native Capacitor runtime bypasses registration.

## Validation — 2026-09-29

22 tests pass across APP UI/storage/full boot, APP PWA, existing channel PWA,
and CURRENT/LAB runtime integration. Worker tests cover both root and GitHub
Pages paths, each offline asset, integrity inputs, failed download rollback,
channel isolation, and update activation boundaries. UI tests cover installation
fallback, readiness, waiting update instructions and native bypass.
Physical iPhone Home Screen installation remains a device verification step.
