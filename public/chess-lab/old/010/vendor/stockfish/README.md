# Local Stockfish deep analysis

This directory distributes **Stockfish.js 18.0.0, Lite, single-threaded**, unchanged from the [maintainer's release](https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0). Stockfish.js is Nathan Rugg/Chess.com's browser port of Stockfish. This compact build is distinct from the full-size Stockfish 18 network.

The page lazily starts `stockfish-18-lite-single.js` in a Web Worker. It loads the adjacent 7,295,411-byte WASM, including its neural network, on demand. No runtime CDN, API token, native installation, SharedArrayBuffer, or cross-origin isolation headers are required. A modern browser with WebAssembly is required. Source downloads below are for rebuilding and are not loaded by the page.

## License and corresponding source

Stockfish.js is copyright 2026 Chess.com, LLC, with the Stockfish authors acknowledged in [AUTHORS](AUTHORS). It is distributed under [GNU GPL version 3](Copying.txt), without warranty. The upstream JavaScript license banner is preserved.

- [Exact source archive served alongside the binaries](stockfish-js-18.0.0-source.zip), from commit `31a98753a5d932511693f44775da908377c24513`.
- [NNUE weights needed to rebuild the Lite engine](nn-9067e33176e8.nnue), also embedded in the distributed WASM. SHA-256: `9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d`.
- [Upstream source tree](https://github.com/nmrugg/stockfish.js/tree/31a98753a5d932511693f44775da908377c24513) and [upstream build instructions](UPSTREAM_README.md).
- Upstream Stockfish commit named by the release: `cb3d4ee9b47d0c5aae855b12379378ea1439675c`.
- [Provenance and exact file hashes](provenance.json).

To build the same flavor, unpack the source archive, place the NNUE file in its `src/` directory, install Emscripten **3.1.7** (the version checked by that source), and run `node build.js --lite --single-threaded --no-split`. The package contains the original build scripts and compiler flags. The shipped binaries are the verified release assets; we have not claimed to reproduce their bytes by rebuilding them locally.

## Analysis contract

`ChessDeepEngine.create({ Chess, workerUrl?, workerFactory?, hashMB? })` creates a lazy adapter. The default hash is 16 MB; a fresh Worker and cold hash are used for every search. Options are sent only after `uciok`, and the position/search only after `readyok`.

```js
const engine = ChessDeepEngine.create({ Chess });
const result = await engine.analyze({
  fen,
  multiPV: 3,
  nodes: 250000, // or depth: 18, or infinite: true
  searchMoves: ['e2e4', 'd2d4'], // optional: legal root moves only
  history: { startFen, moves: ['g1f3', 'g8f6'] }, // optional; must reach fen exactly
  signal,
  onInfo(info, snapshot) { /* render or retain evidence */ }
});
engine.stop();    // user stop: return available analysis
engine.destroy(); // cancel and release worker
```

Omit `history` when unavailable; the result explicitly records that earlier repetitions are unknown. Host UI contexts may supply it as `positionHistory` to avoid conflicting with the workspace's existing history array.

Limits are depth 1–128, MultiPV 1–256, and a positive integer node count. Default depth 14 applies only when no node budget or infinite search is requested. The UI offers depth 14/18, 250k/1M nodes, or “Until I stop,” with 1/3/5/10 lines. Stockfish may exceed a requested node count slightly before its next stop check; record actual reported nodes. It has no overall search timeout. Initialization has a 60-second failure timeout. The 1.2-second stop watchdog starts only after a user requests stop and terminates an unresponsive Worker.

Scores remain typed `cp` or `mate`. `score.root`/`value` are from the side-to-move perspective at the root; `score.white` is from White's perspective. Bounds are retained and inverted for Black's White-perspective scores. A mate score is never converted to centipawns.

`result.nodes` is the largest **aggregate search node count** reported by UCI, not a sum of the per-line counts. Each line retains its own depth, score/bound, PV and reporting-time node count. `lines` contains the last **complete, same-depth, exact MultiPV iteration** when available, indicated by `completeMultiPV`, `linesDepth`, and `expectedLines`. Newer unfinished results appear separately in `partialLines`. If no iteration completes, `completeMultiPV` is false and `lines` is a partial set with duplicate root moves removed. `bestMove` may come from the newer unfinished iteration; it must not silently replace the first move of the completed comparison snapshot.

An AbortSignal or superseding search cancels the actual worker and rejects with `AbortError`; late messages cannot update a new position. User stop resolves a result marked `stopped`; forced termination is marked `forcedStop`. Engine/worker errors reject, rather than producing a fake zero score.

## Research limits and verification

The Lite network is not the full Stockfish network. Deeper results from this same build are useful comparison evidence, but are not an independent engine-family judge or proof of playing-strength improvement. MultiPV and single-PV searches divide an equal node budget differently; record their settings separately. FEN-only analysis does not have earlier repetition history. No tablebase files are shipped.

Tests in `../../research/deep-engine.test.cjs` cover score perspective, mates, bounds, validation, readiness, cancellation, stale replies, partial MultiPV iteration rank changes and exact optional history. `../../research/deep-wasm.test.cjs` verifies the upstream hashes and executes these exact assets in their supported Node CLI mode to check legal targeted MultiPV, mate and infinite-search stop. The UI additionally needs browser Worker and responsive-layout verification.
