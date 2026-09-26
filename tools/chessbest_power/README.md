# ChessBest Power — bounded, reproducible candidate arena

This is a separate research tool for the current `/chess/new/` **Game library**.
It reads the active `gameBuckets` list in `public/chess/new/js/8zc-utils.js`
and only the PGNs named there. It excludes the derived
`ChessBest_Top_Picks.pgn`, preventing self-selection. It does not
modify the PGNs, browser Studies, CURRENT, PWA, or the online Game library.
Use `--include-supplemental` to opt in to all other on-disk PGNs under
`public/chess/new/Games/` that contain games, including additional TCEC and
player files not currently shown in `gameBuckets`. This mode excludes the
derived Top Picks and constructed `Chess_Openings_Top_Lines.pgn`, `TopLines/`
and `Openings/` book files. Existing active files and their ordering remain
unchanged. The run manifest pins hashes and labels each source `active` or
`supplemental`; the summary counts parsed, duplicate, and bad games separately.
Malformed supplementary PGNs are logged and skipped, and the same mainline
encountered again is marked duplicate. A supplemental file over 64 MiB or a
path escaping the Games directory fails closed. Use a new run directory when
adding this option or when any source changes.
Python 3.11+ and `python-chess` are needed; `node` is additionally needed for
the bundled exact Stockfish 18 Lite lane. No token or account is used.

## Commands

```bash
python tools/chessbest_power/arena.py run --repo . --run-dir /path/to/ChessBest_Power_Run \
  --frozen-cdb /path/to/ChessDCC_HOME_EVIDENCE_SOURCE_PACK_20260904.zip \
  --focus 2025.06.01 --focus-ply 88 --max-positions 3
python tools/chessbest_power/arena.py status --run-dir /path/to/ChessBest_Power_Run
python tools/chessbest_power/arena.py extract --run-dir /path/to/ChessBest_Power_Run --out /path/to/ChessBest_Power_LE.zip
```

For an offline scan of all on-disk played/engine PGNs, including supplemental
TCEC files, use a separate run directory:

```bash
python tools/chessbest_power/arena.py run --repo . --run-dir /path/to/ChessBest_Power_All_R1 \
  --include-supplemental --frozen-cdb /path/to/ChessDCC_HOME_EVIDENCE_SOURCE_PACK_20260904.zip \
  --max-positions 0
```

The first command scans the library and may rank *historical triage* from the
September 2026 cache. It makes **zero network or engine calls by default**.
For a small explicit fresh run, add `--live-cdb --max-cdb-calls 15`, and/or
`--sf-lite --max-sf-positions 1 --sf-depths 15 18 21`. CDB is public and
rate-spaced (1.25 seconds between requests by default). A reserved CDB request
interrupted by a crash becomes `ambiguous`, is counted against the request
budget, and is **not silently retried**. A new run with a different policy can
be planned after inspecting the receipt. Local SF interrupted during a search
can safely restart the one affected depth.

Windows example, with quoted paths:

```bat
python "C:\8Z\8z\chessbest\tools\chessbest_power\arena.py" run --repo "C:\8Z\8z\chessbest" --run-dir "C:\8Z\ChessBest Power Runs\Gukesh_R1" --focus 2025.06.01 --focus-ply 88 --max-positions 3 --sf-lite --max-sf-positions 1
python "C:\8Z\8z\chessbest\tools\chessbest_power\arena.py" extract --run-dir "C:\8Z\ChessBest Power Runs\Gukesh_R1" --out "C:\8Z\ChessBest Power Runs\Gukesh_R1_LE.zip"
```

Reissue **the same `run` command** to resume. SQLite WAL+FULL and one
transaction per game / provider observation bound replay to one game or one
local engine depth. An OS advisory writer lock prevents parallel runs yet is
released on forced termination. The run identity pins source SHA-256 hashes,
engine asset hashes, backend/budget policy and Python script version. Changed
inputs/config fail closed in an existing directory; start a new run directory.
`manifest.json.prev` preserves one previous summary. SQLite contains the full
durable source/position and observation index.

## Score and evidence semantics

- Full six-field FEN is the position key in this arena. CDB and SF raw values
  are first converted to **the mover at that root FEN**; white POV is explicit.
- Move-specific regret is `best root move score − played root move score` in
  centipawns **within the same source and the same root FEN**. If CDB does not
  score the played move in `queryall`, `queryscore` after that move is negated.
  A CP from one provider is not itself a verdict on the other provider.
- The **read-only arena** sends `queryall&learn=0` and, if needed,
  `queryscore&learn=0` only. In particular, it never sends `learn=1`, which
  may enable CDB learning. This yields fewer evaluated root candidates than
  the browser's active merge. Unknown scores are not manufactured. Mate-like values
  (`abs(score) >= 29000`) are excluded from centipawn ranking and require a
  separate mate/tablebase review.
- `CDB_SF_GAP_TO_REVIEW` requires current read-only root and played-child CDB
  receipts, a complete local Lite MultiPV search at the compared depth,
  observed CDB regret at least 150 cp and CDB-minus-Lite regret at least
  100 cp. It works with one scored CDB root move, but the case remains
  `CANDIDATE_ONLY_NOT_VERIFIED`: the root `best` is only best **observed**,
  not a guarantee that every legal alternative was evaluated. Each candidate
  includes `cdb.root_coverage`, its explicit caution, `regret_gap_cp` and
  `sf_comparison_depth`. Fresh live discrepancies rank ahead of leads known
  only from the historical cache for manual review; rank is not proof of
  engine strength.
- The frozen older ChessDCC cache used **four-field FEN keys**, may have only
  one move per root, and may differ from current ChessDB data. Its labels are
  `CDB_historical_unverified`, never fresh validation.
- The local SF lane uses the exact pinned LAB JS/WASM Stockfish 18 Lite build,
  one thread, Hash 16 MB and MultiPV 8. Each depth is a fresh process/hash.
  Save achieved depth, complete MultiPV, nodes, wall time, PV and binary hashes.
  A native system Stockfish executable is **not** substituted. Search history,
  hash warmth, MultiPV and hardware can change exact scores.
- ChessDCC is a separate sampled interpreter with its own coverage and
  receipts. This arena does not imply DCC uniquely predicted a tactic. A DCC
  explanation can be added only after testing its actual branch and defense.

## Outputs and curation

`run.sqlite` is the complete checkpoint/evidence store. `manifest.json` pins
configuration and source hashes. `candidates.jsonl` contains a bounded,
diverse shortlist with source file/game number, ply, FEN, played move, CDB and
SF receipts, uncertainty category and `CANDIDATE_ONLY_NOT_VERIFIED` status.
`extract` produces a compact ZIP from a read-only SQLite snapshot while the
arena runs. It separates current live-observation candidates from an optional
prior committed shortlist that may include historical frozen triage; the old
cache itself is deliberately omitted. Recent SF/CDB observation previews and
their hashes are included even when no CDB-based shortlist is available.

The downstream workflow is: candidate → inspect actual root `queryall`, child
score and alternatives → run exact Lite across budgets → independent deeper
or endgame validation when warranted → manually validate explanatory line and
ChessDCC coverage → add reviewed case to the LAB-only
`Games/ChessBest_Top_Picks.pgn` and
`Games/ChessBest_Top_Picks.catalog.json` with source game hash, anchor ply/FEN
and provenance. A selected example is not an unbiased strength benchmark;
report the full corpus and selection method alongside any aggregate claim.

For Gukesh–Carlsen, 44…f6 occurs at **ply 88**. A difference between CDB's
root estimate and Lite's root estimate alone is *valuation divergence*.
Evidence that Lite understates the mistake needs the root move-specific
regret for 44…f6 versus alternatives at each depth, plus a defensible deeper
reference. Historical cached +371 before and −95 after are triage, not
current CDB values.

## Acceptance and limits

```bash
python -m unittest discover -s tools/chessbest_power -p 'test_*.py' -v
```

Tests cover same-command forced-kill recovery, idempotency, data-source change
rejection, active/supplemental provenance and exclusions, malformed/duplicate
supplemental PGNs, perspective conversion, sparse live-root gap triage, paths
with spaces, and a read-only Live
Extract from a paused active process. The CLI does not curate or publish cases,
verify every candidate tactic, supply tablebase proof, or run the ChessDCC
branch checker. Without opt-in CDB and SF measurements, results remain
historical/offline candidates. No claimed Elo or engine-strength improvement
is derived from the selected shortlist.
