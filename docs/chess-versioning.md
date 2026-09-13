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
