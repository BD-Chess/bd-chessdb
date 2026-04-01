
# PROMPT: 8zChess — UCI Engine Wrapper with DCC Governance
## Builder session · AIF8 · March 29, 2026

---

## What 8zChess Is

8zChess is a UCI-compliant chess engine that doesn't calculate
anything itself. It is a GOVERNANCE LAYER that sits between a
chess GUI (Arena, CuteChess, Fritz, Banksia) and one or more
real engines (Stockfish, LCZero, etc.).

The GUI thinks 8zChess is an engine. 8zChess talks UCI on both
sides — to the GUI as an engine, to real engines as a controller.

```
Arena.exe ←UCI→ 8zChess ←UCI→ Stockfish.exe
                        ←UCI→ lc0.exe
                        ←UCI→ any_engine.exe
                        ←HTTP→ ChessDB.cn (if online)
```

8zChess collects candidates from ALL sources, applies DCC
scoring, and returns a single `bestmove` to the GUI.

---

## Requirements

### 1. UCI Protocol Compliance

8zChess MUST behave as a standard UCI engine. The GUI sends:

```
uci          → 8zChess responds: id name 8zChess v1.0
                                  id author AIM3
                                  option name ...
                                  uciok
isready      → readyok
position ... → store internally
go ...       → think, then respond: bestmove e2e4
quit         → clean shutdown
```

8zChess must handle all standard UCI commands:
- `uci`, `isready`, `ucinewgame`
- `position startpos moves e2e4 e7e5 ...`
- `position fen <fen> moves ...`
- `go wtime X btime X winc X binc X` (time management)
- `go depth X`, `go movetime X`, `go infinite`
- `stop` (must respond with bestmove immediately)
- `quit`

### 2. Auto-Detect Engines in Folder

On startup, 8zChess scans its own directory for engine
executables. Detection rules:

```
Windows: *.exe files (exclude 8zChess.exe itself)
Linux:   executable files without extension
```

For each found engine:
- Spawn as child process
- Send `uci`, collect `id name` and `uciok`
- If responds correctly → add to engine pool
- If timeout (5 seconds) → skip

Display found engines in UCI options:
```
option name Engine1 type check default true
option name Engine2 type check default true
...
```

User can enable/disable engines via GUI.

### 3. ChessDB.cn Integration (When Online)

On startup, test connectivity:
```
GET https://www.chessdb.cn/cdb.php?action=queryscore&board=<startpos>
```

If responds → ChessDB is available, add as a source.
If fails → ChessDB unavailable, use only local engines.

UCI option to control:
```
option name UseChessDB type check default true
```

ChessDB query per position:
```
GET https://www.chessdb.cn/cdb.php?action=queryall&board=<fen>&learn=0&showall=1
```
Returns top moves with scores. Parse same as 8zc-headless.js.

For DCC lookahead when ChessDB is available:
```
GET https://www.chessdb.cn/cdb.php?action=querypv&board=<fen>&learn=0
```
Returns principal variation for stability analysis.

### 4. Multi-Engine Query

When GUI sends `go`:

**Step A: Query all engines simultaneously**

For each active engine, send:
```
position fen <current_fen>
go movetime <allocated_time> multipv 5
```

Collect `info` lines, parse:
- `info depth X multipv Y score cp Z pv A B C D ...`
- Store: {engine, move, score, depth, pv}

Wait for `bestmove` from each engine OR timeout.

**Step B: Query ChessDB (if available)**

Send queryall for current position.
Parse top 5 moves with scores.

If time allows, send querypv for top 3 candidates
to get PV for DCC stability analysis.

**Step C: Run in parallel**

Engine queries and ChessDB queries should run
simultaneously. DCC scoring happens after all
sources respond (or timeout).

### 5. DCC Scoring

Collect all unique candidate moves from all sources.
For each candidate:

```javascript
candidate = {
  move: "e2e4",
  sources: [
    { name: "Stockfish", score: 30, depth: 25, pv: [...] },
    { name: "LCZero", score: 35, depth: 20, pv: [...] },
    { name: "ChessDB", score: 28, pv: [...] }
  ]
}
```

**DCC Score computation:**

```
base_score = weighted average of all source scores
           (weight by depth, or equal weight — configurable)

// If PV available from any source, compute DCC metrics:
eval_sequence = walk PV, collect evals at each position
stability = LZ76 compression on eval delta sequence
adsr = ADSR shape analysis (sustained/building/spike/collapse)
momentum = eval acceleration over sequence

dcc_score = base_score
          + stability × 20
          + adsr_bonus (sustained: +10, building: +15, spike: -5, collapse: -20)
          + momentum_bonus (capped at ±5)
          - complexity × 10

// Consensus bonus: more engines agree = higher confidence
consensus = number of sources that rank this move in their top 3
dcc_score += consensus × 5
```

Select move with highest dcc_score → return as `bestmove`.

### 6. DCC Core Functions

Copy these EXACTLY from 8zc-headless.js (proven, tested):

```
lz76(str)              — LZ76 complexity
fenComplexity(fen)     — positional complexity
evalSeqStability(seq)  — eval sequence stability (0 to 1)
adsrAnalysis(seq)      — ADSR shape detection
evalMomentum(seq)      — eval acceleration
detectTunnel(seq)      — tunnel detection
```

DCC weights (same as headless):
```
stability: 20
adsr_sustained: 10, adsr_building: 15
adsr_spike: -5, adsr_collapse: -20, adsr_volatile: -10
momentum_max: 5, complexity: 10
```

### 7. Time Management

8zChess must manage time for its sub-engines. When GUI sends:
```
go wtime 60000 btime 58000 winc 1000 binc 1000
```

8zChess allocates time:
```
my_time = (side == white) ? wtime : btime
move_time = my_time / 30 + increment  // simple allocation
engine_time = move_time × 0.7         // 70% for engines
dcc_time = move_time × 0.2            // 20% for DCC/ChessDB
buffer = move_time × 0.1              // 10% safety
```

Send `go movetime <engine_time>` to each sub-engine.
If ChessDB query takes too long → skip, use only engine data.

### 8. Opening Book Integration

If `openbook.json` exists in 8zChess folder:
```
option name UseOpeningBook type check default true
option name OpeningBook type string default openbook.json
```

On each `go`:
1. Check if current position is in opening book
2. If yes → return book move instantly (0ms think time)
3. If no → proceed with engine + ChessDB + DCC pipeline

Book format is our 8z-openbook.json (tree with move, san,
dcc, raw, endEval per node). Walk the tree following game
moves to find current node, return first child's move.

### 9. Logging

Write analysis log to `8zchess.log`:
```
[2026-03-29 14:32:15] Position: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
[2026-03-29 14:32:15] Sources: Stockfish (depth 25), LCZero (depth 20), ChessDB
[2026-03-29 14:32:15] Candidates:
  e2e4: SF=+30 LC=+35 CDB=+28 → DCC=72 (stab=0.82 sustained)
  d2d4: SF=+28 LC=+32 CDB=+30 → DCC=78 (stab=0.91 sustained) ★
  c2c4: SF=+25 LC=+28 CDB=+22 → DCC=61 (stab=0.74 building)
[2026-03-29 14:32:15] bestmove d2d4 (DCC#1, consensus 3/3)
```

### 10. UCI Info Strings

During analysis, send info to GUI so user can see DCC thinking:
```
info string 8zChess: 3 engines active, ChessDB online
info string DCC: e2e4 stab=0.82 d2d4 stab=0.91* c2c4 stab=0.74
info depth 25 score cp 30 pv d2d4 d7d5 c2c4
```

---

## Implementation Notes

### Language
Bun (TypeScript/JavaScript) or Python. Both can:
- Spawn child processes (engines)
- Read/write stdin/stdout (UCI protocol)
- Make HTTP requests (ChessDB)
- Run concurrently (parallel engine queries)

Python may be simpler for process management (subprocess).
Bun may be faster for HTTP and JSON.

Choose based on what you're comfortable deploying on Windows.

### File Structure
```
8zChess/
├── 8zchess.exe (or 8zchess.py / 8zchess.js)
├── openbook.json          (optional, DCC opening book)
├── 8zchess.log            (auto-created)
├── stockfish.exe           (user places engines here)
├── lc0.exe                 (user places engines here)
└── any_other_engine.exe    (auto-detected)
```

### Packaging for Arena
Arena needs a single .exe or a command line to run the engine.
Options:
- Python: `python 8zchess.py` as engine command in Arena
- Bun: `bun run 8zchess.js` as engine command
- Compiled: use `pkg` or `bun build --compile` for standalone .exe

---

## UCI Options Summary

```
option name UseChessDB type check default true
option name UseOpeningBook type check default true
option name OpeningBook type string default openbook.json
option name DCCWeight type spin default 100 min 0 max 200
option name ConsensusBonus type spin default 5 min 0 max 20
option name ChessDBTimeout type spin default 2000 min 500 max 10000
option name LogFile type string default 8zchess.log
// Plus auto-detected engine toggles:
option name Engine_Stockfish type check default true
option name Engine_LCZero type check default true
```

---

## Existing Code to Reuse

- DCC core: `8zc-headless.js` lines 110-250 (lz76, stability,
  ADSR, momentum, tunnel, complexity, DCC_WEIGHTS)
- ChessDB API: `8zc-headless.js` lines 316-410 (queryall, querypv,
  queryscore parsing)
- Opening book: `8z-openbook.js` output format (JSON tree)

---

## What This Enables

1. Drop any engine(s) into the folder → 8zChess uses them
2. Internet available → ChessDB adds 58B positions of knowledge
3. No internet → pure multi-engine DCC consensus
4. Opening book → first 15 moves instant
5. Arena tournament → 8zChess vs Stockfish alone → measure ELO gain
6. Add new engine → just drop .exe, restart 8zChess

The user's 30-year dream: run multiple engines, governed
intelligently, playing as one. Not weighted average — DCC
structural consensus.

---

*C3 × BD · AIF8 · March 29, 2026* 🌱
