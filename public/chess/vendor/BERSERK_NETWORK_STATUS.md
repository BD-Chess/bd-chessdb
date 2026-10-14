# Berserk 14 original network — LAB R3, 2026-10-12

Author: Jay Honnold. Upstream GPL-3.0 engine tag 14, commit `8ae895a6151695be4a50d4fb65b0c131659c513a`. Scalar Emscripten donor: `5b8d6c930168cd645dd34d646055f303fae2b5b1`. The engine JS/WASM, upstream GPL text, exact code, donor patch/build recipe and original network are available with this LAB package.

The distributed input is the original `berserk-9b84c340af7e.nn`, packaged by `berserk/v14-5b8d6c93/berserk-9b84c340af7e.manifest.json` and its three exact-byte parts, exactly 25,201,924 bytes. Full SHA-256: `9b84c340af7e45f6e07f0046235ccb327f4ae0840c8ee2c4b97b99121e5c5084`. Original author release: https://github.com/jhonnold/berserk/releases/download/14/berserk-9b84c340af7e.nn . Corresponding code/build archive: `berserk/berserk-14-code-only-source.tar.gz`; the exact weights are a separate input next to that archive. See `ENGINE_NOTICES.md` and `engine-source-provenance.json`.

Publication follows the recorded research `CHESSBEST_BERSERK_NNUE_RESEARCH_20261012_R1.md` (Drive ID `14uKz-z2c8qwfFeqnqqR0Q3zVVumsh3K2`): the author's tagged GPL build downloads and embeds the same author-published release network. This is the GPL engine-package interpretation, not a claim that a separate network LICENSE or training data was verified. No new licensing research campaign was performed.

Opening ChessBest does not download this network or start heavy engines. The first actual Berserk analysis automatically fetches the three same-origin parts and reconstructs the original named file, verifies its full size and SHA-256, then supplies a copied ArrayBuffer to the dedicated Worker. Verified bytes are stored in separate origin-local IndexedDB `ChessBest:LAB:engine-networks:v1` where possible. Restored bytes are verified again. Storage failure leaves a usable session-memory copy; private browsing, eviction or clearing site data may require a new automatic download. The network is excluded from service-worker startup precaching.

The main and Deep toolbars show useful statuses only. Settings → Advanced retains a verified local override and cache-removal control. These affect this network only, without clearing Studies or settings. The original author's network works without manual selection.

Berserk's synchronous WASM search is cancelled by terminating its Worker. Position and job guards reject late callbacks. CPU threads are effectively one. Each engine keeps its own scores, PVs, depth and provenance. DCC does not average evaluations or generate a Composite Score.
