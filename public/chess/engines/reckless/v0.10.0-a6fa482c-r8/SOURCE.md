# Reckless browser engine — authorship and corresponding source

This is the actual upstream Reckless Rust chess engine compiled to WebAssembly.
All search and neural evaluation run in the visitor's browser, in a dedicated
single-thread worker. There is no paid API, account, installation, or BD computer
dependency. This component requires WebAssembly SIMD and module Web Workers; it
does not require cross-origin isolation or SharedArrayBuffer.

- Engine authors/project: [codedeliveryservice/Reckless](https://github.com/codedeliveryservice/Reckless).
- Engine source commit: `a6fa482c7d46fb81831573f10be396f20a5efdb5` (`0.10.0-dev`).
- Browser package authors/project: [EasternKentuckyDigital/recklesschessweb](https://github.com/EasternKentuckyDigital/recklesschessweb).
- Browser package source commit: `a64199fbd26251914120a8fa6d08c89fa3ac50d6` (`0.1.0`).
- License: [GNU Affero General Public License v3.0](./LICENSE), `AGPL-3.0-only`.
- Matching source offer: [one-click verified source archive](./source-download.html) (three static parts, reassembled and SHA-256 checked).
- Per-file bytes and SHA-256: [manifest.json](./manifest.json).
- Rebuild recipe: [build.sh](./build.sh); cloud rebuild workflow: `.github/workflows/chessbest-reckless.yml` in the public ChessBest repository.

The corresponding-source archive includes the complete upstream Reckless source
and Git commit metadata, its NNUE network, the pinned browser wrapper source,
ChessBest adapter, all local wrapper patches, tests, license, and build recipe.
Unused precompiled Windows vendor link libraries are excluded because the offered
build targets Linux-to-WebAssembly. The redundant compiled `reckless_bg.wasm` is
also omitted from the source archive: the identical runtime is distributed as
the four versioned WASM chunks beside this offer. All source, build inputs and
the original NNUE are retained. The Rust engine is unmodified. The browser wrapper/worker have a small patch that
passes `infinite: true` through to upstream `Engine.go_uci(0, 0, multiPv, callback)`.
ChessBest's adapter adds the existing GUI result schema, White-perspective scores,
history replay, cancellation, and a wall-clock guard when both depth and time are
requested. A depth/time guard terminates the worker and retains the last completed
MultiPV iteration; it is reported as a forced time result rather than a completed
native depth search. User cancellation terminates the worker promptly and ignores
late messages. No Stockfish result is used to imitate Reckless.

Build: Rust `1.93.0`, `wasm-bindgen-cli 0.2.123`, target
`wasm32-unknown-unknown`, `RUSTFLAGS="-C target-feature=+simd128"`, locked Cargo
dependencies, release profile, default/Syzygy features disabled. The embedded
network is `v60-7f587dfb.nnue`, SHA-256
`7f587dfb1fe5d74d53909328afa6fd51650c8c7f45907602db7fbb1e52948c61`.

The combined WASM is 64,453,431 bytes, distributed as four byte-for-byte
sequential chunks of at most 20 MiB. Combined WASM SHA-256:
`928fcba02a40cd317660c99b5b278782d915c45aaf128778e9da535e37cd450f`.
The native TT is 16 MiB and there is one effective thread. First load downloads
about 61.5 MiB; HTTP cache can accelerate subsequent loads. Mobile strength,
initialization time, memory, and battery costs depend on the visitor's device.

The public ChessBest repository carries all GUI adapter source. Engine and browser
component authorship and AGPL notices are preserved; the component makes no claim
of endorsement by Reckless's authors. Original external project names identify
the engine and package only.
