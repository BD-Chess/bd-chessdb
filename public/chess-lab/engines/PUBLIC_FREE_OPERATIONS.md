# ChessBest LAB R8 — public free operations

Candidate status: implementation and local browser verification complete; R8
publication is pending. The existing public URL still serves the prior LAB.
The hosting and engine details below describe the prepared R8 candidate.

Public application: https://bd-chess.github.io/bd-chessdb/chess-lab/

Open the page and click an engine card or Analyze all. No account, installation,
API key, paid inference service, or BD computer is required. Searches execute on
the visitor's device. Choosing the board display source remains idle. Heavy
downloads begin only with explicit analysis, including opting into per-move All.
The optional existing ChessDB service receives positions when its toggle is on;
new engine searches do not send positions or PGNs to a remote inference service.

## Engines and first downloads

| Family | Actual implementation | New cold transfer |
| --- | --- | --- |
| Stockfish | Existing SF18 Lite or SF19 Full single-thread on ordinary Pages | Lite is in the existing PWA shell; Full adds about 110 MB |
| Reckless | Real 0.10.0-dev Rust engine, SIMD WASM, embedded original NNUE, one worker | About 64.5 MB |
| LCZero | Real Maia 1900 Lc0 neural network with browser PUCT, ORT WASM CPU, one thread | About 16.1 MB, including a 3.48 MB model |
| Berserk | Existing Berserk14 WASM and original verified NNUE | About 26 MB |

These are uncompressed payload estimates; actual transfer, cache reuse, startup
and memory depend on the browser. At 10 Mbit/s, 64.5 MB alone takes about 52 s;
at 100 Mbit/s about 5.2 s, before initialization. Progress and Stop remain
available. HTTP cache can reuse downloads, but eviction and disabled storage are
normal. New large assets are excluded from mandatory PWA precaching. The normal
UI, Studies and other engines remain usable after a failed optional download.

LCZero reports native Q/WDL and actual visits, not invented centipawns or an
equivalent Stockfish depth. Maia1900 models human play; its name is not a strength
guarantee. This is **LCZero NN / Maia1900 / browser PUCT**, not native lc0 search.
Only visited root moves receive neural candidate values. The tree is bounded;
transparent frontier compaction preserves sampled root statistics during long
searches. Deep time presets are foreground browser work, not a background
scheduler. Stop and position changes retire obsolete workers and results.

## Hosting, integrity and compatibility

The page, worker scripts, binaries, model and source offers are hosted by the
same owner-controlled GitHub Pages repository. Runtime assets live in pinned
version directories. There is no third-party runtime CDN or server GPU. Same
origin fetches avoid cross-origin worker/CORS dependencies. Reckless assembles
four binary chunks; their original combined WASM SHA-256 is checked. LCZero
checks the actual model and WASM bytes before inference. Per-file hashes and
sizes are in [runtime-assets.json](runtime-assets.json). The corresponding-source
archive is supplied as three small static parts; its source page assembles and
checks the complete archive before download. Runtime downloads are unchanged.

The new engines require modern module Workers, WebAssembly SIMD and enough RAM.
LCZero uses its tested CPU/WASM path and does not require WebGPU. Neither new
engine requires SharedArrayBuffer or cross-origin isolation. SF Full retains the
existing single-thread fallback on Pages. Chromium153 is the verified browser;
mobile Chromium emulation is layout evidence. Physical iPhone/Safari, installed
PWA updates and physical low-memory devices remain unverified. Unsupported or
failed engines show a reason and do not substitute another family's score.

## Free capacity

Standard public-repository GitHub Actions runners are free; these workflows use
only those runners and do not run visitor searches. Larger runners, paid APIs and
metered storage are not enabled. GitHub Pages documents a 1 GB published-site
limit and a 100 GB/month soft bandwidth limit:
https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

A cold Lite-based All session is roughly 115 MB; a Full-based session roughly
215 MB. With no cache reuse, 100 GB corresponds to roughly 850 or 465 such
sessions, before other site traffic. These are planning estimates, not quotas
per user or promises of unlimited free traffic. Monitor transfers and the full
published payload. After the separately completed archive migration, main has
588,572,132 B in its public tree. This R8 candidate has approximately 725,070,882 B
before deploy-time transformations, below the documented 1 GB envelope. Actual
Pages acceptance and transfer capacity are verified separately. A sustained bandwidth or size
problem needs a new free static distribution plan, with owner approval for any
new hosting or billing. No billing-enabled fallback is created automatically.

## Source, authorship and rebuild

| Component | Source and notices |
| --- | --- |
| Reckless / browser package | [Version manifest](reckless/v0.10.0-a6fa482c-r8/manifest.json), [AGPL and exact corresponding source offer](reckless/v0.10.0-a6fa482c-r8/SOURCE.md) |
| LCZero / Maia / browser PUCT | [Version manifest](lc0/v0.32.1-maia1900-r8/manifest.json), [GPL/MIT/BSD notices, original model and build recipe](lc0/v0.32.1-maia1900-r8/README.md) |
| Existing Stockfish and Berserk | [Existing author/source/license notices](../vendor/ENGINE_NOTICES.md) |

Preserve each component's license and authorship. The new standalone engine
modules and their adaptations carry AGPL/GPL source and notices. This release
does not assign those licenses to unrelated repository applications. This
component separation is an engineering distribution choice, not a legal opinion
about every possible future combination.

Public, manual, read-only rebuild workflows are
`.github/workflows/chessbest-reckless.yml` and
`.github/workflows/chessbest-lc0.yml`. They pin engine/converter versions and
produce candidate artifacts with hashes. A transient Actions artifact is not the
runtime host. The shipped verified candidates are committed under this LAB's
version directories and published by the existing whole-site Pages workflow.
The separately completed archive migration and its deployment-check repairs are
preserved from refreshed main. R8 does not change that workflow or unrelated
repository scripts.
For a new release, build, check candidate hashes/runtime, introduce a new version
directory, update the small adapter pin and LAB release metadata, then publish
and test anonymously. No local BD host is needed for these steps.
