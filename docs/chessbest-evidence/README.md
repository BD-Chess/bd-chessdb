# ChessBest Top Picks: curated evidence, 26 September 2026

The LAB Game library opens on **ChessBest Top Picks**. The complete games live in
`public/chess/new/Games/ChessBest_Top_Picks.pgn`; each card opens at the full-FEN
position immediately **before** the move under review. The sidecar
`ChessBest_Top_Picks.catalog.json` pins the original game, index, original file
SHA-256, mainline checksum, score perspective, timestamped engine observations,
and hashes of the raw evidence files here. No original PGN was changed.

| Game and move | Live CDB before → after, normalized to mover | Exact LAB SF 18 Lite move-specific difference | Why it matters |
| --- | --- | --- | --- |
| Gukesh–Carlsen 2025, **44...f6** | Black +4.20 → +0.51; drop **3.69** pawns of evaluation in the 11:40 UTC snapshot | MultiPV8, cold engines: d15 **0.66**, d18 **0.80**, d21 **0.89**. A separate restricted d30 check finds **2.56**. | `...f6` attacks Ng5, but `45.Rf3+` gains a tempo to reroute the knight to e4, ultimately targeting f6. `...Rh8` first activates the rook against h4. Black did not lose the game on this move; `52...Ne2+` was a separate later error. |
| Carlsen–Aronian 2012, **50...g6** | Black −1.41 → −5.39; drop **3.98** | MultiPV8, same warm engine: d15 **1.48**, d18 **1.91**, d21 **3.25**. | Black was already worse. After `...g6`, `hxg6 ...Bxg6` lets White's remaining g-pawn advance. `...f4` offers rook counterplay. |
| Leko–Kramnik 2004, **32.Rad7** | White −0.10 → −4.61; drop **4.51** | MultiPV8 broad screen: d21 about **0.20**; two-root-move controlled run Hash64: d21 **0.18**, d27 **4.28**, d30 **4.70**. | From a7, White's rook can meet `...Rh5` with **Ra6!**, attacking Black's queen on g6. `Rad7` removes that resource, and `...Rh5` becomes dangerous. |

Scores are **evaluation units**, not pieces that actually leave the board.
The positions after a move have the *other* side to move, so their scores must
be negated before comparing with the position before the move. This is why a
CDB white-perspective `−0.71` after Black's move corresponds to **Black +0.71**.
For a reported Black +3.82 before the move, that pair implies a 3.11-pawn
change in Black's evaluation, although a later CDB snapshot can yield a
different number. CDB is mutable: our same-day root/child values changed during
collection. Every raw response has a timestamp and `learn=0` in its URL. CDB
`querypv` depth metadata is not directly comparable with UCI engine depth.

The examples are selected to teach positions and test analysis gaps. They do
**not** establish aggregate ChessBest superiority over Stockfish: selected
positions have selection bias, the local SF Lite search is bounded, the CDB
cache has uneven coverage, and ChessDCC's own historical report missed the
early Gukesh–Carlsen deterioration. The Python arena in
`tools/chessbest_power/` labels unpublished findings as candidates and keeps
historical cache results separate from live data. Its default input is the
active LAB loader, excluding the derived curated file. Of 405 loaded base
records, 248 are non-book game entries; 244 are unique valid games, three
parse as malformed, and one is a duplicate. Explore a run's denominator and
raw receipts before making any aggregate claim.

Run focused verification from the repository root:

```bash
python -m unittest discover -s tools/chessbest_power -p 'test_*.py' -v
node --test tests/chess-top-picks-anchor.test.mjs
python tools/chessbest_power/arena.py run --repo . --run-dir /tmp/chessbest-gukesh-r1 \
  --frozen-cdb /path/to/ChessDCC_HOME_EVIDENCE_SOURCE_PACK_20260904.zip \
  --focus 2025.06.01 --focus-ply 88 --max-positions 3 \
  --sf-lite --max-sf-positions 1 --sf-depths 15 18 21
```

Live CDB is a separate explicit opt-in (`--live-cdb --max-cdb-calls N`). It uses
`learn=0`, a bounded call count, and does not silently retry an interrupted
external request. The arena never writes to source PGNs or the online Game
library; `status` and `extract` read an active run without pausing it.
