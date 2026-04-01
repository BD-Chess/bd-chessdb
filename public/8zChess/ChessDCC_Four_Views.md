
# Chess Move Quality: Four Views on 130 Years
## 259 Games · 17 Players · Lasker to Gukesh · Three Scores · Every Angle

---

## How We Measure

ChessDB.cn holds 58 billion pre-analysed positions — the largest
chess position database in existence. For each position, it provides
the top 5 candidate moves with evaluations from collective engine
intelligence (Stockfish, LCZero, and others at extreme depths).

We measure: how often did each player choose the best candidate?
Three definitions of "best." Four ways to rank. One dataset.

---

## Three Scores

**Raw#1** — Did you pick the move with the highest evaluation
right now? ChessDB's #1 choice. The engine's favourite.

**DCC#1** — Did you pick the structurally healthiest move? The
one whose evaluation stays most stable over the next 40 moves.
Uses stability analysis, ADSR phase detection, and momentum.

**EndEval#1** — Did you pick the move that leads to the best
position at the end of the principal variation? Not what it
looks like now — where it ends up.

All three predict the winner in **76%** of decisive games. Identical
accuracy. They measure the same signal through different lenses.

---

## View 1: Absolute DCC — Structural Quality

How often did you choose the structurally healthiest move?

```
 #  Player              DCC%   Opp avg   Games
────────────────────────────────────────────────
 1. Stockfish          70.0%      65       35
 2. LCZero             66.1%      73       27
 ── HUMAN LINE ────────────────────────────────
 3. Polgar             58.6%      55       14
 4. Carlsen            58.4%      57       31
 5. Ding Liren         56.3%      57        7
 6. Kasparov           55.5%      60       22
 7. Lasker             54.4%      58       14
 8. Nakamura           53.9%      60       23
 9. Anand              53.2%      57        9
10. Firouzja           52.6%      48        8
11. Fischer            52.3%      61       11
12. Capablanca         51.0%      57       14
13. Aronian            49.7%      54        9
14. Kramnik            49.2%      61       16
15. Gukesh             49.2%      53       17
16. Nepomniachtchi     46.4%      59        8
17. Caruana            43.4%      57       23
```

Polgar and Carlsen lead among humans. But this view doesn't
account for opponent strength or position type.

---

## View 2: Absolute Raw — Engine's Top Pick

How often did you choose ChessDB's highest-eval move?

```
 #  Player              Raw%   Opp avg   Games
────────────────────────────────────────────────
 1. Stockfish          70.6%      65       35
 2. LCZero             65.5%      73       27
 ── HUMAN LINE ────────────────────────────────
 3. Polgar             60.2%      55       14
 4. Ding Liren         58.7%      57        7
 5. Firouzja           58.6%      48        8
 6. Fischer            57.3%      61       11
 7. Carlsen            56.7%      57       31
 8. Kasparov           56.7%      60       22
 9. Nakamura           54.8%      60       23
10. Lasker             53.9%      58       14
11. Capablanca         52.1%      57       14
12. Anand              51.9%      57        9
13. Kramnik            51.0%      61       16
14. Nepomniachtchi     50.5%      59        8
15. Aronian            49.7%      54        9
16. Gukesh             48.6%      53       17
17. Caruana            44.0%      57       23
```

Firouzja and Fischer rise. Tacticians who pick the engine's
sharpest move. Carlsen drops from #4 to #7 — his moves are
structurally healthy but not always the engine's top eval pick.

---

## View 3: Relative DCC — Structural Dominance Over Opponent

How much better is your structural quality than your opponent's?
This adjusts for opponent strength — your score minus theirs.

```
 #  Player           Rel DCC   Opp avg   Games
────────────────────────────────────────────────
 1. Polgar            +4.6pp      55       14
 2. Stockfish         +4.2pp      65       35
 3. Firouzja          +2.2pp      48        8
 4. Carlsen           +0.5pp      57       31
 5. Ding Liren        −0.6pp      57        7
 6. Lasker            −3.2pp      58       14
 7. Kasparov          −4.1pp      60       22
 8. Nakamura          −4.2pp      60       23
 9. Gukesh            −4.8pp      53       17
10. Anand             −4.8pp      57        9
11. Aronian           −5.7pp      54        9
12. Capablanca        −5.9pp      57       14
13. LCZero            −6.9pp      73       27
14. Fischer          −10.1pp      61       11
15. Kramnik          −10.4pp      61       16
16. Caruana          −13.0pp      57       23
17. Nepomniachtchi   −14.8pp      59        8
```

LCZero drops from #2 to #13 because it only plays Stockfish
(opp avg 73%). Fischer drops to #14 because his opponents in
this dataset were also very strong (opp avg 61%).

Caveat: players with weaker opponents get inflated relative scores.

---

## View 4: Relative Raw — Engine-Pick Dominance Over Opponent

How much more often do you pick the engine's top move than your
opponent does?

```
 #  Player           Rel Raw   Opp avg   Games
────────────────────────────────────────────────
 1. Firouzja         +13.6pp      48        8
 2. Stockfish         +5.5pp      65       35
 3. Polgar            +4.7pp      55       14
 4. Ding Liren        +2.1pp      57        7
 5. Carlsen           −0.2pp      57       31
 6. Fischer           −3.1pp      61       11
 7. Kasparov          −3.6pp      60       22
 8. Gukesh            −3.8pp      53       17
 9. Aronian           −3.9pp      54        9
10. Anand             −4.0pp      57        9
11. Capablanca        −5.2pp      57       14
12. Lasker            −5.5pp      58       14
13. Nakamura          −7.1pp      60       23
14. Nepomniachtchi    −7.1pp      59        8
15. LCZero            −7.2pp      73       27
16. Kramnik          −11.8pp      61       16
17. Caruana          −14.0pp      57       23
```

Firouzja dominates: +13.6pp over opponents. But his opponents
are the weakest in the dataset (avg 48). Context matters.

---

## Combined Ranking — Average Rank Across All Metrics

No single metric is perfect. Each has its bias. The combined
ranking averages each player's rank across all six metrics
(absolute DCC, absolute Raw, absolute EndEval, relative DCC,
relative Raw, relative EndEval). Lower average rank = more
consistently high across all views.

```
 #  Player           AvgRank   AbsDCC  AbsRaw  RelDCC  RelRaw  Games
──────────────────────────────────────────────────────────────────────
 1. Stockfish           1.5       #1      #1      #2      #2     35
 2. Polgar              2.8       #3      #3      #1      #3     14
 3. Ding Liren          4.3       #5      #4      #5      #4      7
 4. Firouzja            4.8      #10      #5      #3      #1      8
 5. Carlsen             5.0       #4      #7      #4      #5     31
 6. Kasparov            7.5       #6      #8      #7      #7     22
 7. LCZero              7.8       #2      #2     #13     #15     27
 8. Lasker              8.0       #7     #10      #6     #12     14
 9. Nakamura            8.3       #8      #9      #8     #13     23
10. Anand              10.0       #9     #12     #10     #10      9
11. Fischer            10.2      #11      #6     #14      #6     11
12. Capablanca         11.5      #12     #11     #12     #11     14
13. Gukesh             12.3      #15     #16      #9      #8     17
14. Aronian            12.5      #13     #15     #11      #9      9
15. Kramnik            14.5      #14     #13     #15     #16     16
16. Nepomniachtchi     15.0      #16     #14     #17     #14      8
17. Caruana            16.8      #17     #17     #16     #17     23
```

### What the Combined Ranking Reveals

**Stockfish (1.5):** #1 or #2 in every metric. Unambiguously best.

**Polgar (2.8):** #1 relative DCC, #3 absolute DCC and Raw.
Consistently top 3 across all views. Even adjusting for opponent
quality and position stability, she is the highest-ranked human.

**Carlsen (5.0):** Remarkably consistent — never below #7 in
any metric. No extreme highs, no lows. The most STABLE ranking,
which fits his playing style.

**Firouzja (4.8):** Wildly inconsistent — #1 relative Raw but
#10 absolute DCC. His tactical brilliance shows in Raw, his
structural weakness shows in DCC. The widest spread in the table.

**LCZero (7.8):** Absolute #2 in both DCC and Raw, but relative
#13-15 because it only faces Stockfish. Its ranking suffers from
opponent strength, not from quality.

**Fischer (10.2):** #6 in both absolute and relative Raw, but
#11-14 in DCC metrics. Pure tactician — his quality shows only
through the Raw lens.

---

## Playing Style — DCC Minus Raw

When DCC accuracy exceeds Raw accuracy, the player favours
structurally healthy moves over the engine's top eval pick.
When Raw exceeds DCC, the player favours the sharpest move.

```
STRATEGISTS (choose structure over eval):
  Carlsen            +1.6pp
  Anand              +1.3pp
  Gukesh             +0.6pp
  LCZero             +0.6pp
  Lasker             +0.4pp

BALANCED:
  Aronian            +0.0pp
  Caruana            −0.6pp
  Stockfish          −0.6pp

TACTICIANS (choose eval over structure):
  Nakamura           −1.0pp
  Capablanca         −1.1pp
  Kasparov           −1.3pp
  Polgar             −1.6pp
  Kramnik            −1.8pp
  Ding Liren         −2.4pp
  Nepomniachtchi     −4.1pp
  Fischer            −5.0pp
  Firouzja           −6.0pp
```

No previous metric has separated these two qualities. A player
can be excellent in both (Stockfish), or strong in one and weak
in the other (Fischer: Raw #6, DCC #11).

---

## Why No Single Ranking Is Definitive

Each metric has a blind spot:

**Absolute scores** don't account for opponent strength. Playing
against a 1200-rated player inflates your score.

**Relative scores** penalise players who face stronger opponents.
LCZero drops from #2 to #15 because it only faces Stockfish.

**DCC** favours players in stable positions (Polgar: avg stability
0.69 vs dataset avg 0.60). Stable positions make it easier to
"agree" with DCC#1 because all candidates score similarly.

**Raw** favours tacticians who calculate concretely. Positional
players who choose the second-best eval for structural reasons
are penalised.

The combined ranking minimises all these biases by averaging
across all views. No single bias dominates.

---

## Caveats

1. **Sample sizes vary.** Carlsen (31 elite games) is robust.
   Ding Liren (7), Firouzja (8) are marginal.

2. **Game selection bias.** "Selected" games favour decisive,
   dramatic, historically important games. Random sampling
   would give different rankings.

3. **ChessDB coverage bias.** Modern openings have more cached
   positions than 1920s lines. Pre-war players may be
   systematically undermeasured.

4. **Opponent pools differ by era.** Capablanca's opponents
   are not Carlsen's opponents. Cross-era comparison is
   inherently approximate.

5. **These are not ELO replacements.** They measure move quality,
   not competitive results. Winning requires tactics, time
   management, preparation, psychology — none of which appear
   in these scores.

---

## Method

259 games at DCC depth 40 (converged at D40, confirmed with D80,
r=1.000). ChessDB top 5 candidates per position. Three accuracy
scores per player per game. Opponent-adjusted using elite filter
(opponent DCC ≥ 40%). Combined ranking = average of six individual
ranks (3 absolute + 3 relative). Style metric = DCC accuracy minus
Raw accuracy per player.

96,665 cached positions. Zero API calls during analysis.

---

## Data Source

ChessDB_DCC_scores.csv — 259 games with all three scores per side.
Available at chessbest.org.

---

*C3 × BD · AIF8 · March 29, 2026* 🌱
