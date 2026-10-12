# Dreev–Kasparov Review V4 — 12 October 2026

Review V4 adds an interactive whole-game trajectory, separate dated CDB/SF
observations, 12 structured decision comparisons, legal saved-PV playback and
a ledger for all 99 recorded half-moves. Existing Review notes, Game Library,
main-board navigation and Study/A-B remain available. The recorded game is not
replaced by a principal variation.

## Frozen sources and reproducibility

`tools/build-dreev-review-evidence.py` is an offline extractor, not an enrichment
runner. It opens the R4 database read-only, verifies the two pinned ZIP hashes,
checks all 453 Stockfish manifest records and checks every SF task against the
full recorded history and position FEN. No CDB requests or new engine searches
are made by the extractor or Review presentation.

| Source | Pin / configuration |
| --- | --- |
| R4 ZIP SHA-256 | `669f11e67749770ec7092116f729d01c4394a29166d910f37476eefafd318c55` |
| R4 SQLite SHA-256 | `ad2044e5af0443b61d20bee0a7db7c806498792af8f2ebf906c760f15e1d91de` |
| R4 cut | `refreshed_02`, sequence 27381, learn=0; 2026-10-10T13:26:57.330207+00:00 |
| SF evidence ZIP SHA-256 | `9ad41967bef2cc883489eec62bf9dbf8697ffdecbb55bb956b8b56da06494cf8` |
| SF engine | Stockfish dev-20260930-49ea5ded; 1 thread, 128 MB hash; full history |
| SF baseline | Unrestricted MultiPV 3, 2,000,000-node budget, all 100 positions |
| SF comparisons | 43 positions; the saved deeper search takes precedence where present |
| Mainline UCI SHA-256 | `aeb4b932828c6c4a1ae70c9abc60650bbd8673e96d1d9126ed713159655cb2b2` (tokens joined by spaces) |
| Generated JSON SHA-256 | `31cf4d3f88ceb5713ec87f2d35013014ccbdb9392f6643d83779cf15df5ad1a8` |

Stockfish run timestamps are stored/displayed in UTC. The original report is
dated 1 October; individual runs can have 30 September UTC timestamps. The R4
database preserves parsed queryall projections and response hashes, not every
complete original HTTP body. Review does not claim fresh live CDB measurements.

## Typed coverage and interpretation

The final R4 queryall observations directly score **58/99 played moves**:
56 ordinary centipawn scores, 2 encoded mate scores, 41 unknown. This recovers
the mate observations already present in the frozen data; it does not represent
a new campaign or a change to the old cp-only count of 56. The older Review V3
metadata is retained as historical report metadata.

The SF baseline estimates every one of the 100 recorded positions, including
the final position. A directly scored historical candidate appears in the
baseline's three moves at 76/99 roots. A position estimate is not automatically
a direct evaluation of the played move; the ledger preserves that distinction.

The graph uses White POV. CDB is the first scored legal move in the saved R4
queryall projection; SF is the unrestricted baseline. Deep/restricted comparison
scores are shown only in their own cards, not silently mixed into the baseline
curve. The displayed axis is capped at ±8 pawns, with exact values below. Unknown
or bound scores leave gaps; mate is a typed edge marker, never 299 pawns or zero.

CDB raw **29973 = 30000 − 27 = mate in 27 plies**, commonly displayed as M14.
At the root before 45...Bxd6, that score belongs to the alternative 45...fxg2,
not to the unscored historical Bxd6. The independent saved SF comparison at
depth 34 reports M14 for fxg2 and +9.32 (Black POV) for Bxd6. Its published
27-ply fxg2 variation is legally replayed and ends with 58...Qh2#.

Review validates the dataset identity, all 100 FENs, every published candidate,
all saved PV moves and coverage counts before attaching the data. A changed
line, another PGN or a late response cannot inherit this game's evidence.
Failure to load the sidecar leaves the original PGN navigation/notes usable.
Imported PGNs can use their own standard `[%eval]` annotations after each move,
but are not given the Dreev-specific data or fabricated engine scores.

## Regression checks

The unified LAB gate covers desktop/mobile/native layout, real Game Library
loading and exact Review/Study navigation, simulation, evaluation bar and Study,
plus typed-score/core and Review V4 lifecycle tests. V4-specific checks include
mate decoding and POV/bounds, data/PV identity, unknown gaps, all 99 ledger
rows, the 41-row missing-score filter, full fxg2 mate playback without changing
the recorded line, stale/failed data responses, blocked navigation and slider
focus. The gate runs 56 tests. PWA artifact and channel-topology checks run on
the full GitHub checkout; the new module and JSON are in the offline allowlist.

Physical iOS/Android installation is not claimed by these automated checks.
Live desktop and forced-phone APP review should be checked after publication.

## R5 remains a proposal

No new CDB enrichment campaign is launched. The next research task is staged
coverage of every historical root/candidate, separate immutable before/after
observations, repeated typed-score stability checks and prioritised independent
SF candidate verification. Newly obtained data must form a new versioned
snapshot; it must not overwrite the R4 evidence or erase unknown/mate distinctions.
