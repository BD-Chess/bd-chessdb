# LCZero NN / Maia 1900 / browser PUCT

This independent ChessBest browser engine executes the real CSSLab Maia 1900
Lc0 network, converted by the official Lc0 exporter, with a deterministic PUCT
search over legal chess moves. It runs entirely in a Worker using ONNX Runtime
Web's single-threaded WASM SIMD CPU backend. It works without WebGPU,
SharedArrayBuffer, a login, an engine API, a subscription, or BD's computer.

It is **not a native lc0 UCI binary**. Its search implementation is browser
PUCT; the model, encoder, policy map, and native inference reference are Lc0.
Maia 1900 was trained to model human play. It is not LCZero's strongest model,
and its rating name is not a browser search Elo guarantee.

The displayed result is native neural **Q = W − L**, in [-1,1], and WDL.
White- and side-to-move-oriented values are both retained. No fabricated
centipawn, depth, or unvisited-move value is produced. Candidate lines require
at least one actual visit; coverage records visited versus legal root moves.
Search budgets exclude download, session creation, and warmup. The requested
budget is honored up to four hours; explicit infinite analysis ends on Stop.
One neural inference can finish after the deadline before a final receipt.
Long analysis retains at most about 32,768 tree allocations plus one expansion.
When necessary it compacts deeper frontiers while preserving sampled root and
child N/Q/WDL statistics, then re-evaluates revisited frontiers with the real
network. Receipts expose retained-node and compaction counts.

## Public assets and source

All executable assets and model weights are served alongside the LAB from
owner-controlled GitHub Pages. `worker.mjs` verifies the model and runtime WASM
SHA-256 before creating the session. `manifest.json` pins sizes/hashes of all
distributed files. No third-party runtime CDN is needed after deployment.

| Component | Pin | License |
| --- | --- | --- |
| Maia 1900 weights | CSSLab/maia-chess `749204cf5979ce7f8b0412e804a4ee7c83c49ff8`, `maia_weights/maia-1900.pb.gz` | GPL-3.0 |
| Official Lc0 converter/reference | `v0.32.1`, `fd71a2d921b689c5f479d3227c3806c8e272d9c5` | GPL-3.0-or-later |
| Browser classical encoder/policy map | manthedan/0x88 `5b8d6c930168cd645dd34d646055f303fae2b5b1` | GPL-3.0-or-later |
| ONNX Runtime Web | npm `onnxruntime-web@1.24.1` | MIT |
| chess.js | npm `chess.js@1.4.0` | BSD-2-Clause |
| ChessBest neural bridge/search/adapter | these distributed `.mjs` source files | GPL-3.0-or-later |

Corresponding source for the browser engine is the `.mjs` files and `source/`
folder distributed here. The original Maia weights are supplied in
`source/maia-1900.pb.gz`, with `MAIA-LICENSE.txt`. `GPL-3.0.txt`,
`CHESS-LICENSE.txt`, and `runtime/ORT-LICENSE.txt` preserve the notices. The
upstream projects retain authorship; ChessBest adaptation is by BD × AI Lab.

Changes to the 0x88 encoder: fill missing history beyond a non-start oldest
known position, matching native Lc0 FEN_ONLY; use legal EP rights for repetition
identity while retaining original EP for synthetic double-push history.

## Build and reproduce

The repository also supplies `.github/workflows/chessbest-lc0.yml`, a manual,
read-only build on standard public Ubuntu 24.04 GitHub Actions. It checks out
the exact converter/submodule pins, exports the supplied original model,
retrieves only the pinned runtime files, verifies the candidate against every
manifest hash, and publishes an inspectable candidate archive. Private forks
are skipped. It does not deploy or modify the live repository. Live asset
availability does not depend on the temporary Actions artifact retention.

Build the pinned Lc0 source including its pinned lczero-common submodule.
CPU reference used Meson 1.12.1, Eigen 3.4.0, and native Lc0's BLAS/Eigen backend:

```sh
git clone --branch v0.32.1 https://github.com/LeelaChessZero/lc0.git
cd lc0
git submodule update --init
./build.sh -Dplain_cuda=false -Dopenblas=false -Dgtest=false -Dispc=false -Donnx=false
build/release/lc0 leela2onnx --input=maia-1900.pb.gz --output=maia-1900.onnx --onnx-data-type=f32 --onnx-batch-size=1
```

The ONNX model has input `/input/planes` float32 `[1,112,8,8]`, policy logits
`/output/policy` `[1,1858]`, and already-softmaxed `/output/wdl` `[1,3]`.
The original model is CLASSICAL_112 / SE residual tower / 64 filters / 6 blocks
with convolution policy and WDL value. `rule50` uses the raw halfmove count.
Native default policy temperature 1.359 is explicit in `neural.mjs`.

Regenerate the bundled encoder and policy list from the supplied TypeScript:

```sh
npx --yes esbuild@0.25.12 source/0x88/lc0/encoder112.ts --bundle --format=esm --outfile=encoder.mjs
npx --yes esbuild@0.25.12 source/0x88/lc0/generatedPolicyMap.ts --format=esm --outfile=policy-map.mjs
```

`source/native-reference.py` obtains one-node native legal priors and move
indices for `evidence/corpus.json`. Apply `source/native-raw-output.patch` to
the pinned native source and rebuild to produce exact raw inference samples
with `LC0_PARITY_DUMP=/absolute/path/native-raw.jsonl`. This verification-only
patch exposes inputs, policy logits and WDL before native search compresses
its reported values; it changes no numerical computation. It is not used to
build the shipped ONNX model.

`evidence/probe.html` checks the real browser Worker against those samples and
exercises bounded search, longer budgets, cancellation, infinite Stop,
position changes, explicit UCI history, invalid history, all PV legality,
checkmate, stalemate and threefold repetition. With Playwright and
@sparticuz/chromium installed, run `node source/verify.mjs BASE_URL OUTPUT_JSON`.
Optional `PLAYWRIGHT_MODULE` and `CHROMIUM_MODULE` point at module entry files.
The harness accepts both local and public URLs without sign-in.

No claim of fixed-node search parity with native lc0 is made: browser PUCT is a
separate transparent implementation. The strict parity gate compares actual
encoder tensors and neural inference, including both colors, castling,
en-passant, promotions, check, clocks, explicit history and repetition planes.

## Adapter

`create(config)` returns `prepare({signal,onProgress})`,
`analyze({fen,history,movetime,multiPV,infinite,onInfo,onSearchStarted,signal})`,
`stop()`, and `destroy()`. `history` may be chronological FENs or the existing
ChessBest `{startFen,moves:[UCI...]}` object. Move history is replayed and its
final position must match the requested FEN. Errors fail closed. Each receipt
identifies the actual model, runtime hashes, provider, search type, time,
visits, and cancellation/completion reason. Functions are never serialized
across Worker messages.
