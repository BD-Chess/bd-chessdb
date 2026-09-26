# BD application version standard — Chess

| Channel | Public path | Meaning |
|---|---|---|
| CURRENT | `/chess/` | Primary public release |
| PREVIOUS | `/chess/old/` | Immediately preceding stable release |
| LAB | `/chess/new/` | Development release; publicly reachable, not promoted |
| Archive | `/chess/old/001/`, `/002/`, … | Chronological immutable release snapshots |

The three channel entry pages contain the same self-contained selector next to
the title, with a visible active state and `aria-current="page"`. Navigation is
plain links, needs no JavaScript and does not invoke chess actions. Its small CSS
block is copied with the HTML, not loaded from a mutable shared asset. Historical
archives do not receive later selector, styling, bug or content updates.

The 2026-09-13 standard adoption is **not a promotion**. CURRENT and PREVIOUS
retain their existing application code. Only their entry-page selector changes.
The research upgrade is confined to LAB and its separate Gemini endpoint.

## Future promotion transaction

1. Obtain explicit promotion approval. Fetch and read the latest GitHub `main`;
   record commit, chess tree, active release manifests and existing archive IDs.
   Recheck Drive, project artifacts and OneDrive for relevant newer evidence.
2. Run `node tools/chess-versioning.mjs --base <latest-main-sha>` and LAB tests.
   Choose **max existing archive ID + 1**, minimum three digits. Never fill a gap,
   reuse an ID or overwrite a destination. Stop on a hash conflict or overlapping
   concurrent change. The checker is read-only; it does not promote anything.
3. Prepare all copies in a separate staging worktree, not by moving directories
   in the active checkout. Copy the current PREVIOUS's own files into the chosen
   archive directory, excluding its numbered archives. Retain all older archives
   byte-for-byte. Copy CURRENT's own files to PREVIOUS, excluding `old/`, `new/`
   and channel-level `versions.json`. Copy verified LAB's own files to CURRENT.
4. Before sealing the new archive, make all application assets, JS/CSS, data,
   pieces, WASM/NNUE and licenses local to that snapshot. Resolve each asset URL
   relative to its actual file. Rebase references to the release's own assets;
   do **not** blindly replace `/chess/` in navigation, API endpoints or source
   provenance. Pin/download missing static dependencies using verified bytes.
   Treat `fetch`, CSS `url()`, workers, imports and generated asset URLs as well
   as HTML links as dependencies. Test at the final nested archive URL.
5. At creation only, mark the archive with its fixed ID/source release and remove
   the active channel marker (an archive is not today's PREVIOUS). Record a
   SHA-256 manifest of all final files excluding the manifest itself, source
   commit/tree, creation UTC, intentional URL rewrites and remaining external
   service dependencies. Never edit that archive after the sealing commit.
6. Update CURRENT/PREVIOUS active selector markers and channel metadata. Leave
   `/new/` as a real, independent LAB copy for the next cycle, never a forced
   alias to CURRENT. Update `versions.json.archives` chronologically with the
   new ID, path and manifest digest. Do not copy nested `old/` or `new/` trees.
7. Re-read `main` immediately before publishing. Build the smallest scoped tree
   on that exact parent and use a non-force, fast-forward ref update. Preserve
   unrelated concurrent files and redirects. If the parent moved, recheck the
   affected paths and rebuild; never force through the race.
8. Let GitHub → Netlify deploy. Verify all three channels, the newly sealed
   archive's asset closure, board, local interactions and mobile layout. Store
   exact package, manifests, tests and live receipts in `GPT Projects/Chess/`.

## Archive boundary

Self-contained means the static application and its bundled analysis engine are
retained, not that third-party services can be frozen. ChessDB, Lichess and Gemini
can change or become unavailable. Record those external dependencies explicitly;
frozen Evidence exports can reproduce captured CDB answers in LAB. A service
failure does not authorize changing a sealed archive. Offer a new release instead.

No promotion, numbered archive, background deployment or recurring job is
performed just by adopting this standard.

## 2026-09-25 direct CURRENT promotion

BD explicitly requested a copy of CURRENT into the next numbered archive, then
LAB into CURRENT after the two approved UI refinements. Archive `003` therefore
snapshots CURRENT (95 files), rather than PREVIOUS. Existing PREVIOUS, PWA and
archives `001`/`002` stay byte-identical. CURRENT and LAB retain independent copies;
only channel navigation/metadata and repository-relative test imports differ.
`versions.json.latest_promotion` records this transaction. GitHub Pages is the
authorized publication route until 2026-10-01; Netlify remains deferred.

## 2026-09-25 LAB review UI promotion without backup

BD explicitly requested the complete current LAB in CURRENT and waived a backup
for this transaction. LAB source: `a38e0e7a77040b9670dd2a933f464017dd546ae9`.
No archive is created and PREVIOUS is not rotated; existing archives and PWA
remain byte-identical. CURRENT retains its channel links/labels, canonical URLs
and repository-relative test imports. Application assets match LAB; CURRENT's
utils cache key is advanced to load the promoted clock-state integration.
The previous promotion record is retained in `versions.json.promotion_history`.
GitHub Pages remains the active publication route.

## 2026-09-26 Sim tournament promotion with standard backup

The approved Sim games and tournaments release uses the standard rotation; the
previous transaction's one-time backup waiver does not apply. Published LAB
source: `dc58182bdd01d97f260b6d3b6d40ec58e497d144` (repository tree
`afca7f634f4f2e22799d11fb8f7bba76ffefffc6`). Promotion follows verification of that
LAB release; it does not publish the backup preparation as a separate release.

The backup source is main `613121cd272e78b6965c4900e692c43f0bc14715`.
Archive `004` preserves PREVIOUS v0.6.0: 79 source files plus its manifest,
excluding numbered archives. The creation-only changes rebase navigation,
canonical metadata and legacy board-document links, remove the active channel
marker and add the fixed archive label. Source and final SHA-256 file hashes,
rewrites and external service dependencies are recorded in
`public/chess/old/004/ARCHIVE_MANIFEST.json`; its SHA-256 is
`95ac0316b5ac4dfdba7991ca3b5546b3d791d1a16c19b4a968515a20f3279ff8`.

The pre-release CURRENT's 136 own files become PREVIOUS. Its seven HTML channel
navigation/metadata files and two repository-relative test imports are rebased;
runtime JS, CSS, data, pieces and bundled Stockfish assets retain their source
bytes. Verified LAB then becomes CURRENT, retaining CURRENT's channel metadata.
LAB remains an independent copy. Archives `001`–`003` and PWA remain unchanged;
`004` is immutable after the promotion commit. The earlier no-backup promotion
record remains in `versions.json.promotion_history`.

The version gate, backup manifests, static asset closure and the archive's local
DOM boot/Flip/New checks are recorded in the release evidence. Live deployment
and device checks belong to the promotion receipt and are not implied by those
local checks. GitHub Pages remains the publication route; Netlify stays deferred
until 2026-10-01. The next archive is `005`.

Verification corrected exact TCEC book boundaries (the first SuFi opening ends
at 9.Nf3), retained the use-position Collection action, and clarified active-game
date/elapsed labels. Zero-move custom FEN openings remain loadable and exportable.
Fallback history migrates into IndexedDB without replacing newer records and
remains retained if migration fails. Page shutdown checkpoints and pauses the
runner; archive close follows queued work. History refreshes stale running states
when another tab's runner lease expires. All these corrections are included in
the published source commit above. Final promoted LAB subtree:
`56ce0d1426568e18338b819fbc16e12728bf1823`.

## 2026-09-26 PWA refresh from LAB

BD requested an updated `/chess/PWA/` from the working LAB. This is a PWA-only
refresh, not a CURRENT/PREVIOUS promotion. LAB source tree:
`56ce0d1426568e18338b819fbc16e12728bf1823`. CURRENT, LAB, PREVIOUS and numbered
archives remain unchanged. The former PWA is recoverable from parent commit
`be86d9703bcc71132df3a326960343d016b29289`; no numbered archive is consumed.

`tools/refresh-chess-pwa.py` copies an explicit runtime allowlist from LAB,
retains the manifest id/start/scope/icons and existing PWA localStorage and
IndexedDB names, and isolates the new tournament archive/runner lease. It does
not copy token files, development tools or dated test results. The existing
online Lichess token lookup remains external to the PWA cache. Other remote
services remain online-only. Source/final hashes and source tree are retained
in `public/chess/PWA/release.json`. Regeneration is deterministic for these inputs.

The worker precaches 111 files, including bundled Stockfish, pieces, the PGN
library and all SIM modules. It serves a complete release cache first, including
query-versioned URLs, at both root and GitHub Pages nested paths. Updates wait
for old tabs to close or the user to choose `Update ready · reload`. Activation
only removes obsolete caches containing this PWA's entry page. Games, studies,
settings and other applications' caches are not deleted. The first refresh from
the old network-first worker may need an additional close/reopen to complete.

Verification: `node --test tests/chess-pwa.test.cjs
 tests/chess-pwa-integration.test.cjs` (on one line, with jsdom available).
Seven checks cover source hashes, asset closure, offline worker responses at
both paths, update/failure/cache isolation, restored PWA game/settings/study,
actual page script boot, SIM pause/archive review, clocks, PGN, Study, Deep and
Evidence integration. The DOM harness stubs board geometry and SF provider;
the separate LAB `deep-wasm.test.cjs` exercised the byte-identical pinned engine
in four real WASM tests. Offline transport tests simulate network loss; they do
not claim physical iPhone/Android installation or operating-system offline QA.
