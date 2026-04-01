# PROMPT: 8zChess — Minimal Real UCI Wrapper v1 (Hybrid of GPT + Claude, improved by Ari)
## Builder session · AIF8 · March 29, 2026

---

## Mission

Build **8zChess** as a **standalone UCI wrapper / proxy engine**.

Implementation should be **Python-first**, with a clean path to later packaging as a **Windows `.exe`** once behavior is stable.

From the chess GUI's perspective (Arena, Cute Chess, Banksia, Fritz), 8zChess must behave like a normal UCI engine.
Internally, it will:

- speak UCI to the GUI
- launch and control one or more real backend UCI engines
- optionally query **ChessDB.cn**
- collect candidate moves / evals / PVs
- apply our **DCC governance / tie-break logic**
- return one final `bestmove`

**Do not fork or modify Stockfish or any engine source.**
8zChess must be a separate wrapper layer.

---

## Core Idea

8zChess is **not a new search engine**.
It is a **governance layer** over existing chess intelligence.

Architecture:

```text
Arena / GUI  <->  8zChess  <->  Stockfish / other UCI engines
                          <->  ChessDB.cn (optional)
                          <->  optional opening book (later)
```

8zChess wins only if it does the boring part right first:
- clean UCI behavior
- robust subprocess control
- correct parsing
- safe fallbacks
- useful logs

DCC should start narrow:
- do **not** replace engine search
- do **not** invent a giant framework
- do **not** override obvious best moves
- only govern **near-tied candidate choices**

---

## Hard Goal for v1

Build the **smallest real implementation** that can actually sit between Arena and a local engine.

### v1 must do these 7 things

1. Behave as a valid UCI engine to the GUI
2. Launch at least **one** local backend UCI engine
3. Request and parse **MultiPV** candidate lines from that engine
4. Optionally query **ChessDB.cn** as a second candidate source
5. Apply a **DCC tie-break** only when candidates are near-equal
6. Return one final `bestmove`
7. Fail safely and fall back to backend engine bestmove if anything goes wrong

---

## Strict Priority Order

Build in this order. Do not skip ahead.

### Phase 1 — UCI shell that really works
- `uci`
- `isready`
- `ucinewgame`
- `setoption`
- `position`
- `go`
- `stop`
- `quit`

### Phase 2 — single backend engine
- launch one local engine
- set engine options
- send position
- send go command
- receive and return `bestmove`

### Phase 3 — MultiPV parsing
- set backend `MultiPV` using **`setoption name MultiPV value N`**
- parse `info ... multipv ... score ... pv ...`
- store top candidates cleanly

### Phase 4 — DCC tie-break on near-equal candidates
- if top candidate is clearly best, pass it through
- if top candidates are within threshold, run DCC governance

### Phase 5 — optional ChessDB integration
- add ChessDB as optional source
- if unavailable, skip it cleanly

### Phase 6 — multi-engine hybrid (optional in v1, stronger in v1.5)
- second backend engine
- cross-source candidate merge
- consensus bonus

If time runs out, stop after a strong Phase 4 or 5. That is already a real v1.

---

## Non-Goals for v1

Do **not** overbuild these in v1:

- no full engine framework
- no GUI of our own
- no pondering
- no distributed search
- no opening book unless almost free
- no engine tournaments manager
- no perfect time manager
- no large config system
- no cloud dependency

Nice ideas can be listed for v1.5+, but keep the shipped code small.

---

## Preferred Implementation Style

### Language
Prefer **Python 3** first.

Reasons:
- easiest for UCI subprocess management
- easiest to inspect and patch quickly
- standard library is enough for most of this
- fastest path to a working Windows prototype

Use standard library where possible.
Avoid heavy dependencies.

### Code size target

### Packaging path
- develop and debug as normal Python files first
- only after behavior is stable, package to Windows `.exe`
- do **not** optimize for packaging before UCI behavior is solid

The `.exe` is a delivery format, not the primary design target for v1.
Aim for a small modular structure with the project-wide Python filename prefix **`8zc_`** so files stay grouped cleanly in folders.

Recommended v1 file names:
- `8zc_main.py`
- `8zc_uci_backend.py`
- `8zc_dcc_core.py`
- `8zc_chessdb.py`
- `8zc_logging.py`

Keep it modular, but do **not** explode it into too many files in v1.
No giant framework.

---


## File Naming Rule

All Python source files for this project must use the prefix **`8zc_`**.

Why:
- keeps related files visually grouped in folders
- makes copying between sessions and builders cleaner
- avoids generic filenames like `main.py` or `utils.py` getting lost among unrelated project files

Use this rule consistently for:
- runtime files
- helpers
- tests
- optional later modules

Examples:
- `8zc_main.py`
- `8zc_uci_backend.py`
- `8zc_dcc_core.py`
- `8zc_chessdb.py`
- `8zc_logging.py`
- `8zc_tests.py`

## UCI Contract Requirements

8zChess must correctly support at least:

- `uci`
- `isready`
- `ucinewgame`
- `setoption name X value Y`
- `position startpos moves ...`
- `position fen <fen> moves ...`
- `go depth X`
- `go movetime X`
- `go wtime X btime X winc X binc X`
- `go infinite`
- `stop`
- `quit`

### Correct behavior expectations

- `uci` → respond with `id`, `option` lines, `uciok`
- `isready` → always return `readyok`
- `stop` → return best known move immediately
- `quit` → terminate children cleanly
- never hang the GUI
- never crash if ChessDB fails

---

## UCI Options to Expose

At minimum:

```text
option name UseDCC type check default true
option name UseChessDB type check default false
option name BackendMode type combo default local var local var chessdb var hybrid
option name Engine1Path type string default stockfish.exe
option name Engine2Path type string default 
option name MultiPV type spin default 5 min 1 max 10
option name DCCTieThresholdCp type spin default 15 min 0 max 100
option name DCCLookaheadPlies type spin default 8 min 0 max 20
option name ChessDBTimeoutMs type spin default 1500 min 100 max 10000
option name LogFile type string default 8zchess.log
option name VerboseInfo type check default true
```

Optional later:
- `ConsensusBonus`
- `UseOpeningBook`
- per-engine enable toggles

---

## Backend Engine Handling

### v1 minimum
Support one primary engine first.

### Good v1 extension
Support optional second engine.

### Engine launch rules
Each backend engine should have:
- path
- enabled/disabled
- timeout
- configured `MultiPV`

### Important technical note
Do **not** send `multipv` as part of the `go` command.
For UCI engines, `MultiPV` should be set via:

```text
setoption name MultiPV value 5
```

Then use normal `go ...` commands.

### Auto-detection
Auto-detecting every `.exe` in folder is optional and risky.
For v1, prefer:
- explicit `Engine1Path`
- optional `Engine2Path`
- if auto-detect is added, only use it as convenience, not as the only mechanism

---

## Position Flow

For every `position` command from GUI:

1. store the current position internally
2. preserve move history if provided
3. on `go`, send the exact same position to backend engine(s)
4. keep one normalized internal record of:
   - FEN if available
   - move list
   - side to move
   - last known legal backend bestmove

---

## Search Flow on `go`

### Local mode
1. send current position to engine(s)
2. wait for `info` lines
3. collect MultiPV candidates
4. wait for `bestmove` or timeout
5. if DCC inactive or no tie → return backend bestmove
6. if tie threshold met → apply DCC to candidates

### ChessDB mode
1. query ChessDB candidates for current position
2. build candidate list
3. if valid candidates exist → DCC or raw ranking selects
4. if ChessDB fails → no crash; if no local engine in this mode, return the best available valid move if one exists, otherwise fail gracefully and log why

### Hybrid mode
1. query local engine(s)
2. query ChessDB in parallel if enabled
3. merge candidates by move key
4. compute DCC / consensus scores
5. choose final move
6. if hybrid logic fails → fall back to primary engine bestmove

---

## ChessDB Integration

ChessDB must be **optional**.

Use it only as an additional signal source.
Do not make network access mandatory.

### Minimal useful calls
- candidate moves: `queryall`
- optional PV lookup: `querypv`
- optional score check: `queryscore`

### Rules
- timeout fast
- parse defensively
- if response is bad, ignore it
- do not block local engine play waiting forever on network

### ChessDB usage strategy for v1
- first get candidate moves from `queryall`
- only call `querypv` for top few moves if needed for DCC lookahead
- cap total network cost tightly

---

## Candidate Data Model

Normalize all sources into one structure:

```python
candidate = {
    "move": "e2e4",
    "sources": [
        {"name": "Stockfish", "score_cp": 30, "depth": 24, "pv": ["e2e4", "e7e5", "g1f3"]},
        {"name": "ChessDB",    "score_cp": 28, "depth": None, "pv": ["e2e4", "e7e5", "g1f3"]}
    ],
    "raw_best_cp": 30,
    "consensus_count": 2,
}
```

The merge key should be the **UCI move string**.

---

## DCC Governance — v1 Scope

Keep DCC narrow, safe, and explainable.

### Trigger rule
Only apply DCC when top candidates are near-equal.

Example:
- if top move beats runner-up by more than `DCCTieThresholdCp`, trust raw engine choice
- otherwise run DCC governance

### v1 DCC inputs can include
- candidate move
- source evals
- source PVs
- consensus across sources
- optional ChessDB support
- simple stability and collapse detection

### DCC decision spirit
- prefer stronger cross-source support under ambiguity
- prefer moves with more stable continuation shape
- avoid brittle or collapse-prone lines when raw evals are tied
- do not brute-force override obvious tactical winners

---

## Existing DCC Code to Reuse

Reuse the proven logic already present in the project where possible.

Target functions / logic to port or wrap from existing 8zc code:
- `lz76(...)`
- `fenComplexity(...)`
- `evalSeqStability(...)`
- `adsrAnalysis(...)`
- `evalMomentum(...)`
- `detectTunnel(...)`
- DCC weight constants
- ChessDB parsing helpers already used in site/headless code

Important:
- keep the **logic** faithful
- do not force a literal copy if language changes require adaptation
- preserve behavior, not superficial syntax

---

## Suggested v1 DCC Scoring

Start simple and transparent.

```text
base_score      = best available raw score for candidate
consensus_bonus = number of supporting sources * small bonus
stability_bonus = derived from eval sequence stability if PV exists
adsr_bonus      = sustained/building positive, collapse negative
momentum_bonus  = small capped modifier
complexity_pen  = optional small penalty for unstable complexity

final_dcc_score = base_score
                + consensus_bonus
                + stability_bonus
                + adsr_bonus
                + momentum_bonus
                - complexity_pen
```

### Safe defaults
- keep bonuses modest
- let raw engine score remain dominant
- DCC is a tie-breaker, not a dictator

---

## Time Management

Keep time management simple in v1.

If GUI sends `go movetime X`, use that directly.
If GUI sends clock time:

```text
my_time = side_to_move_time
move_time = max(min(my_time / 30 + increment, configured_cap), configured_floor)
```

Then roughly split internally:
- majority to local engine search
- small slice to DCC / ChessDB
- safety buffer

Example only:
- 70% engine
- 20% DCC / ChessDB
- 10% buffer

Do not get fancy yet.

---

## Stop / Infinite Search Behavior

This matters.

### For `go infinite`
- start backend search
- keep collecting info
- wait until GUI sends `stop`

### For `stop`
- immediately stop backend engines
- use best fully known candidate set so far
- if DCC cannot finish in time, return backend bestmove

The wrapper must feel robust to Arena.

---

## Fail-Safe Rules

If anything goes wrong:
- backend engine missing
- subprocess timeout
- bad UCI parse
- ChessDB timeout
- malformed ChessDB response
- DCC exception
- no merged candidate set

then:
- log the problem clearly
- fall back to primary engine bestmove if available
- never crash the GUI session

8zChess must always act like a stable engine process.

---

## Logging

Logging is mandatory.

Write a readable log file containing:
- timestamp
- current FEN / position
- active mode
- backend engines used
- ChessDB availability / timeout
- candidate list by source
- merged candidates
- DCC score per candidate
- final selected move
- whether fallback was used
- timing breakdown

Example style:

```text
[2026-03-29 14:32:15] mode=hybrid fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
[2026-03-29 14:32:15] source=Stockfish depth=24 multipv=5
[2026-03-29 14:32:15] source=ChessDB online=true latency_ms=183
[2026-03-29 14:32:15] cand e2e4 raw=30 stab=0.82 adsr=sustained consensus=2 dcc=46
[2026-03-29 14:32:15] cand d2d4 raw=29 stab=0.91 adsr=sustained consensus=2 dcc=49
[2026-03-29 14:32:15] bestmove d2d4 reason=DCC_tiebreak fallback=false
```

---

## UCI `info` Output to GUI

During thinking, emit useful but minimal `info string` lines.
Do not spam too much.

Examples:

```text
info string 8zChess mode=hybrid engines=1 chessdb=online
info string DCC tie window hit: evaluating 3 candidates
info string DCC best=d2d4 stab=0.91 consensus=2
```

If possible, also send one standard `info depth ... score ... pv ...` line for the currently preferred final move.

---

## Opening Book

Opening book is **not required** for v1.

If it is nearly free to add and already exists in project files, you may wire it as an optional early-return stage.
But do not delay the wrapper for it.

If included:
- `UseOpeningBook`
- `OpeningBookPath`
- return book move instantly before backend search

Otherwise list it under v1.5.

---

## Deliverables Required

Please produce all of these:

1. short architecture explanation
2. file list
3. full code for v1
4. how to run it from Arena / Cute Chess on Windows
5. example UCI options / config
6. small local test plan
7. short list of v1.5 improvements

---

## Acceptance Criteria

The build counts as successful only if these are true:

### A. UCI basics
- Arena can load 8zChess as an engine
- `uci` / `isready` / `quit` work reliably

### B. Local backend pass-through
- 8zChess can launch Stockfish from disk
- with DCC off, it can behave as a pass-through engine and return legal moves

### C. MultiPV
- top candidate lines are parsed and stored correctly

### D. DCC tie-break
- in at least one known near-tie position, DCC can choose a different move than raw top-1
- that choice is logged clearly

### E. Fail-safe
- if ChessDB is unplugged or times out, local engine mode still works
- if DCC throws, primary engine bestmove is still returned

If these five pass, v1 is real.

---

## Suggested Test Plan

### Smoke tests
1. load in Arena
2. `isready`
3. new game
4. play 10 moves manually
5. confirm legal bestmoves come back every time

### Pass-through test
- DCC off
- ChessDB off
- confirm wrapper behaves like plain backend engine

### Tie-break test
- use a known near-equal FEN
- MultiPV = 5
- DCC on
- confirm selected move and logged reasoning

### Network failure test
- enable ChessDB, then disconnect network
- confirm no crash, clean fallback

### Stop test
- run `go infinite`
- send `stop`
- confirm immediate `bestmove`

---

## v1.5 / Next-Step Ideas

Only suggest these after v1 works:

- stronger hybrid consensus across 2+ engines
- optional auto-discovery of engines in folder
- opening book integration from existing `openbook_*.json`
- replay/debug mode from saved FEN lists
- case-study export for DCC decisions
- better clock management
- tournament harness for A/B tests: raw Stockfish vs 8zChess wrapper
- optional Rust/C++ port once behavior is stable

---

## Final Build Philosophy

Do not overbuild.
Do not chase elegance before function.
Do not get lost in “future architecture”.

Build the smallest **real** thing that can:
- load in Arena
- call a backend engine
- parse MultiPV
- apply DCC on ties
- return `bestmove`
- survive failures

That is enough to make 8zChess real.

---

*Hybrid base: GPT prompt + Claude prompt*
*Improved and tightened by Ari*
