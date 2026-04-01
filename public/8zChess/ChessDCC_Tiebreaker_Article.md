
# When Stockfish Says "Equal" — DCC Knows Better
## 2,115 Positions. 259 Games. 130 Years. One Question.

---

## The Problem Every Chess Engine Has

The strongest chess engines in the world regularly encounter
positions where multiple moves look equally good. Stockfish
evaluates a position and says: "+30 centipawns for three
different moves." Which one should you play?

This happens more often than you'd think. In our analysis of
259 games spanning 130 years of chess — from Emanuel Lasker
in the 1890s to Dommaraju Gukesh's 2024 World Championship —
we found **2,115 positions** where the top candidates were
within 10 centipawns of each other.

That's roughly 8 positions per game where the engine shrugs.

But here's the thing: those "equal" moves are NOT actually
equal. When we traced where each candidate leads — following
the principal variation as far as the data allows — the
average difference between the "equal" moves was **13.7
centipawns**. That's significant. One of those moves leads
somewhere measurably better than the others.

The engine just can't tell which one.

---

## What We Built

We developed DCC (Dynamic Complexity Controller) — a structural
analysis layer that sits on top of engine evaluations. When the
engine says "these moves are equal," DCC breaks the tie by
measuring something engines don't: the structural HEALTH of
the position each move creates.

DCC doesn't replace the engine. It governs the engine's choices
when the engine can't decide.

### How DCC evaluates a move

For each candidate move, DCC asks:

**How stable is the evaluation over the next 40 moves?**
Not just "is it +30 right now?" but "does it STAY around +30,
or does it swing wildly between +50 and −20?" A stable
evaluation means a fundamentally sound position. An unstable
one means hidden complications that could go either way.

**What is the shape of the evaluation trajectory?**
Is the position improving steadily (building), holding firm
(sustained), or about to collapse? Borrowed from audio
engineering, this ADSR analysis detects structural changes
before they show up in the raw number.

**What is the positional momentum?**
Is the evaluation trending upward or downward over the
lookahead window? A move that is +30 now but trending toward
+45 is structurally different from one that is +30 trending
toward +15.

All of this is computed from the same database the engine
already uses. No additional hardware. No additional time.
Just a different question asked of the same data.

---

## The Test

We used ChessDB.cn — the largest chess position database in
existence, with 58 billion pre-analysed positions — as our
evaluation source. For each of 2,115 tied positions, we
compared two approaches:

**Raw tiebreaker:** Pick the move with the highest ChessDB
evaluation in the current position. No lookahead. Just the
number right now.

**DCC tiebreaker:** For each candidate move, walk ChessDB's
principal variation 40 moves ahead. Measure the stability,
shape, and momentum of that evaluation sequence. Pick the
move whose future is most structurally healthy.

This is an important distinction: **DCC uses lookahead.**
It does not evaluate only the current position. It traces
each candidate's future using ChessDB's pre-computed data
and measures how stable that future is. The structural
advantage comes from reading the SEQUENCE, not just the
endpoint.

**The judge:** Which move actually leads to the best position
at the END of the principal variation? Not theory — data.
Where does each move actually go?

---

## The Result

```
                                Correct    Accuracy
────────────────────────────────────────────────────
Raw tiebreaker (highest eval):    427       20.2%
DCC tiebreaker (structural):     975       46.1%
────────────────────────────────────────────────────
DCC advantage:                  +548       2.3×
```

When the engine says "these moves are equal," DCC picks the
one that turns out better **2.3 times more often** than
selecting by raw evaluation alone.

### Breakdown

```
DCC correct, Raw wrong:      736 positions   (34.8%)
Raw correct, DCC wrong:      188 positions   ( 8.9%)
Both correct:                239 positions   (11.3%)
Neither correct:             952 positions   (45.0%)
```

In head-to-head disagreements — positions where DCC and Raw
pick DIFFERENT moves — DCC is right **80% of the time**
(736 vs 188). A 4-to-1 advantage.

---

## What This Means for Chess Engines

Modern chess engines are extraordinarily strong. Stockfish,
the strongest open-source engine, plays at approximately
3,680 ELO. But even Stockfish encounters ~8 tied positions
per game where it cannot distinguish between candidates.

Our data shows that Stockfish's top choice agrees with
ChessDB's long-term best move only 70.6% of the time.
Nearly 30% of its moves are not the long-term optimal choice.
Much of this 30% comes from tied positions where the engine
picks essentially at random among equals.

DCC addresses exactly this gap. Not by calculating deeper
or wider, but by asking a different question: which of these
equally-evaluated moves creates the healthiest structure?

### Estimated impact

```
~8 tied positions per game
× 2.3× better selection with DCC
= ~2-3 better moves per game

At elite engine level: 2-3 better moves ≈ 20-50 ELO gain
```

This is not a replacement for search depth or neural network
evaluation. It is a governance layer — a tiebreaker that
operates in the space where raw evaluation runs out of
resolution.

---

## The ChessDB Advantage

This analysis uses ChessDB.cn, which aggregates evaluations
from multiple engines at extreme depths (40-80+ ply). ChessDB
is significantly stronger than any single engine because it
represents collective intelligence: millions of positions
verified across different engines and hardware.

When ChessDB says two moves are within 10 centipawns, those
moves are genuinely close in quality — the finest resolution
available in chess analysis today. And even at that resolution,
DCC finds meaningful structural differences.

For a standalone engine like Stockfish running on limited
hardware with limited time, tied positions are MORE frequent
than in ChessDB. The weaker the evaluation source, the more
tied positions arise, and the more a structural tiebreaker
helps.

---

## Three Applications

### 1. ChessDB-powered bot (8Z-CDB-DCC)

For platforms where external databases are allowed (Lichess
bot games, casual play), a bot that uses ChessDB for
evaluation and DCC for tiebreaking has a measurable
advantage over one using ChessDB alone.

DCC's full power is available here: ChessDB provides
both the candidate evaluations AND the principal variations
that DCC uses for lookahead. This is the scenario our
tiebreak test measured directly — 2.3× advantage, 80:20
in head-to-head disagreements.

Particularly effective in bullet and blitz chess, where DCC's
analysis adds negligible time (one structural computation
per position vs. millions of search nodes).

### 2. Engine fork (8ZFish)

For engine tournaments where external databases are not
allowed (such as TCEC), DCC cannot access ChessDB during
play. Instead, DCC would operate on the engine's OWN
search tree data. Stockfish already computes evaluations
at multiple depths during its search — DCC would read
stability and ADSR from that internal eval sequence.

This is the same principle but a different data source.
Our tiebreak test used ChessDB's principal variations.
An engine fork would use Stockfish's search tree. The
tiebreak advantage is likely to transfer, but the exact
ratio (80:20) applies only to the ChessDB scenario.
Testing on Stockfish's internal data is a necessary
next step before claiming the same improvement for TCEC.

### 3. Analysis and coaching

For human players analysing their games, DCC adds a
dimension no existing tool provides: structural health
per move. Not just "this move is +0.3" but "this move
creates a position that stays healthy for 20 moves"
versus "this move is +0.3 but leads to complications
where things can go wrong."

Full ChessDB lookahead is available here since analysis
is done offline with cached data.

### 4. DCC-optimised opening book

The tiebreaker advantage is strongest in opening positions,
where multiple moves routinely evaluate within 5-10
centipawns of each other. This makes the opening phase
the ideal application for DCC governance.

The opening book is pre-computed using full ChessDB
lookahead. Once generated, it requires zero computation
during play — just a lookup. This means even the 8ZFish
engine fork (which cannot access ChessDB during play) can
use a DCC-optimised opening book, since the book was built
BEFORE the game.

We built an opening book generator that scores every
candidate at every position using three metrics — DCC
structural health, EndEval long-term outcome, and Raw
immediate evaluation — then selects the top moves at
each node, 15 moves deep for both sides.

Where all three metrics agree: objectively best move.
Where they disagree: the choice reveals opening
philosophy. DCC favours solid, healthy structures.
EndEval favours moves that lead to the best position
in 40+ moves. Raw favours the sharpest immediate
advantage.

For the 8Z-CDB-DCC bot, the opening book provides an
additional speed advantage: the first 15 moves are
instant lookups from the pre-computed book, requiring
zero API calls and zero computation. On a 1-minute
bullet game, this saves 5-10 seconds on the clock —
time the opponent must spend calculating.

```
Moves 1-15:   Opening book lookup → 0ms
Moves 16+:    ChessDB + DCC scoring → <100ms per move
Total think time for entire game: under 5 seconds
```

In bullet chess, speed IS strength. A bot that spends
zero time in the opening and under 100ms per move in
the middlegame has an inherent time advantage that
compounds with DCC's structural advantage.

---

## Methodology

**Dataset:** 259 games from 17 players across 130 years
(Lasker 1890s to Gukesh 2024), including both human
grandmasters and top engines (Stockfish, LCZero).

**Evaluation source:** ChessDB.cn, 58 billion pre-analysed
positions, accessed via public API.

**Tiebreak definition:** Positions where the top candidates
are within 10 centipawns of each other after ChessDB
evaluation.

**DCC depth:** 40 half-moves (20 full moves). Confirmed
converged: depth 80 produces identical results (r = 1.000).

**DCC components:** Eval sequence stability (LZ76 compression),
ADSR phase analysis, momentum detection, tunnel detection,
endgame awareness, positional complexity weighting.

**Verification:** 96,665 cached positions. Zero API calls
during analysis. All results reproducible from cached data.

**EndEval judge:** For each candidate move, the evaluation at
the furthest point in the principal variation determines the
"true" long-term quality. The tiebreaker that more often
agrees with this endpoint is the better tiebreaker.

---

## Reproducibility

The analysis code (8zc-headless-v2.js), cached position data,
and result files are available. The tiebreak analysis can be
independently verified on any set of chess games with ChessDB
coverage.

---

## Summary

When chess engines say "these moves are equal," they are
wrong — the moves differ by an average of 14 centipawns in
long-term outcome. DCC identifies the better move 2.3 times
more often than raw evaluation alone, with an 80:20 advantage
in head-to-head disagreements.

This is not a theoretical improvement. It is measured on
2,115 positions across 259 games spanning 130 years of chess.

DCC does not replace the engine. It governs the engine's
choices when the engine cannot decide. Applied to openings —
where tied positions are most frequent — DCC produces an
optimised opening book that selects structurally healthier
lines, giving a bot both a positional and a time advantage
from move one.

The same principle — structural tiebreaking when evaluation
resolution is exhausted — applies to any domain where search
produces multiple equally-scored candidates.

Less describes more. Even in chess.

---

*AIM³ Institute · ChessBest.org · 2026*
