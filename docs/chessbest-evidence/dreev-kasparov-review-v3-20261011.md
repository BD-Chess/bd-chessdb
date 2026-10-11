# Dreev–Kasparov Review V3

**Status:** LAB review draft on a feature branch; not merged or publicly deployed.  
**Game:** Alexey Dreev–Gary Kasparov, Moscow PCA-GP blitz, Round 2.3, 1996, 0–1.  
**Reviewed line:** 99 recorded half-moves; 12 annotated decision markers.  
**Evidence cut:** frozen R4 `refreshed_02`, `learn=0`, cut 27,381 at 2026-10-10 13:26:57 UTC.  
**Independent engine source:** separate local Stockfish review dated 2026-10-01. R4 ran zero local Stockfish jobs.

## Reading the evidence

R4 root scores shown below use the side to move's perspective and are dated cache observations. Baseline and final values are separate snapshots, not a controlled before/after experiment. A candidate score is not a direct comparison with the played move unless the same root answer contains both moves.

The R4 report's `56/99` is an **ordinary centipawn-only** count of directly scored played root moves in the final snapshot. It does not mean only 56 positions have any useful CDB information. R4 reports 59/99 at baseline, 56/99 final, and 61/99 as a cumulative union that received a numeric `learn=0` answer at some point. Its root move-pair count is 188/3,772 → 184/3,772; target child nodes with any ordinary cp move score are 219/229 → 229/229.

The final report identifies three roots (87–89) whose raw top result became a CDB special code, but it does **not** publish a complete all-99 breakdown of cp, mate, tablebase, cursed, unknown, or bound categories. Review V3 therefore reports only the typed figures actually published and marks the global typed breakdown as unavailable. R4's guarded DCC+ branch-plus-trajectory method abstained 500/500 times; the no-trajectory method also abstained 500/500, while the no-branch method chose 7/500 times with only one evaluated root candidate and 2–5% reply coverage. None of these results proves DCC+ selection quality.

### The 45...fxg2 correction

R4's final raw value `29973` is a CDB **encoded mate score**, not `29,973 cp`.

```text
CDB_MATE = 30000
30000 - 29973 = 27 plies
27 plies ≈ mate on Black's 14th move (M14 convention)
```

This is the provider's predicted forced-mate result, not a formal proof over every defense. A separate Stockfish depth-34 analysis also reported M14 and stored a legal principal variation ending in `58...Qh2#`. That Stockfish run is independent and older than R4; it must not be attributed to R4.

## Decision review

| Position | BD's recorded process | Evidence and lesson |
|---|---|---|
| 19...Bxa4 | The moment was pre-revealed. | A 2026-09-29 DCC snapshot tied Bxa4 and Rad8 at −0.10 from Black's perspective. A ten-half-move CDB trajectory heuristic preferred Bxa4, but only 3 of 47 legal moves had root scores. Later deep CDB/Stockfish analysis did not preserve Bxa4 as a unique best choice; Stockfish d36 slightly preferred Nxe2+. Treat this as a dated DCC-method example, not a proof of DCC+ strength. |
| 20...Reb8 | BD proposed it before evaluation; Kasparov played Rac8. | Frozen R4 directly scores Reb8 at 0 cp for Black in baseline and final, but does not directly score Rac8 in that same answer. Separate Stockfish d34 compares Reb8 0.00 with Rac8 −0.42. This is one of BD's best-supported ideas. |
| 22...Rb8 | BD listed Qd8, Re7, Qe7, Rb8 and chose Rb8 before evaluation; Kasparov played Nxe2. | Separate Stockfish d32 (Black POV) scores Rc7 0.00, Nd3 −0.09, Re7 −0.12, Qd8 −0.57, Qe7 −1.26, Nxe2 −1.35, Rb8 −2.37. Some BD candidates were stronger than the played move, but his final choice was not. R4's published root sample scores Rc7 +1 cp; do not combine that with the older SF candidate ranking. |
| 26...f4 | BD considered f4 and fxe4; Kasparov played f4. | Separate Stockfish d33 favors Rf8 0.00 over f4 −0.90 and fxe4 −1.19 (Black POV). The R4 report does not publish a comparable score here. Add a different kind of improving move when two natural pawn moves dominate the candidate list. |
| 29...Nc4 | BD saw Nc4 and Qc7, then chose Qc7; Kasparov played Nc4. | Separate SF d28 scores Nc4 +1.00 vs Qc7 −0.65 (Black POV); an earlier separate CDB review also favors Nc4. The knight move attacks Qd2 with tempo. Kasparov's later ...Qc7 after 30.Qa2 is a different position; move order matters. |
| 31...Rxe5 | BD had Rxe5 in his list before evaluation but chose Bxe5, as Kasparov did. | R4 final `learn=0` records Rxe5 +216 cp for Black (baseline +176); it does not report Bxe5 in that same answer. Separate SF d32 compares Rxe5 +1.98 with Bxe5 +1.40. This is a candidate-ranking miss, not a missed move. |
| 32...Qxa5 | BD listed Nxa5/Qxa5 and chose Nxa5 after GPT confirmed the candidates. | Mark this as AI-influenced, not a clean blind choice. R4 final scores Qxa5 +291 cp for Black, without a same-answer Nxa5 comparison. Separate SF d31 compares Qxa5 +2.90 vs Nxa5 −0.07. After Nxa5, 33.Bb6 attacks Qc7 and Na5 at once. Qxa5 removes the queen from c7 while Nc4 controls b6. |
| 34...Qa5 | GPT had already revealed Qa5; there was no blind BD choice. | R4 baseline/final scores are +412/+383 cp for Black in distinct snapshots. Separate SF d36 compares Qa5 +4.18 with played b5 +0.26. Qa5 attacks Qa2 with tempo while Nc4 controls b6; 35.Qb3 Qxd5 is one saved continuation. |
| 36...Na3 | BD found it in about 15 seconds before evaluation; Kasparov played it. | The knight attacks Qb5 and Rb1 at once. Separate SF d27 scores Na3 +2.98, Ne3 0.00, Nb2 −6.45 (Black POV). Separate the human discovery from the engine ranking. |
| 37...Ra8 | BD did not confirm a final choice between Rxc1/Nxb1; GPT revealed Ra8 first. | Do not count it as a blind find. Separate SF d33 scores Ra8 +3.27, Nxb1 −4.59, Rxc1 −7.00. Ra8 vacates c8 and attacks Qa6 with tempo; in the game 37...Ra8 38.Qd3 Nxb1 39.Rxb1 wins the exchange. |
| 41...h5 | BD wanted h5 one move before the game. | At the exact position after 41.Kh2, separate SF d36 scores h5 +5.36 vs played Rf8 +4.06 (Black POV). This is SF-only in the published R4 report. Kasparov later played ...h5 after 42.Rb6, from a different position. |
| 45...fxg2 | BD chose fxg2 before evaluation; Kasparov played Bxd6. | R4's raw 29973 decodes to 27 plies, about M14 with Black to move. Separate SF d34 compares fxg2 M14 with the played Bxd6 at +9.32 (Black POV) and stores the legal line below. The mate score is not a centipawn score and neither engine result is a formal proof. |

## Saved legal lines

After the game move 32...Nxa5:

```text
33.Bb6 Qc4 34.Nd2 Qxf1+ 35.Nxf1 Nxb3 36.Qxb3
```

The later Stockfish principal variation for the alternative 45...fxg2 is:

```text
45...fxg2 46.Qf3 Qd3 47.Nf5 Qxf3 48.Rg6+ Kf7 49.Rg5 Qxd5
50.h4 f3+ 51.Ng3 Ke8 52.Bf2 Bxg3+ 53.Bxg3 g1=Q+ 54.Kxg1
Qd1+ 55.Kh2 Re2+ 56.Bf2 Rxf2+ 57.Kg3 Qg1+ 58.Kh3 Qh2#
```

The recorded game result is 0–1. The available PGN does not specify resignation, flag fall, or another termination reason, so V3 does not infer one.

## Corrections from V2

- Replace any reading of `29973` as centipawns with CDB mate-distance decoding.
- Keep 20...Reb8 and 22...Rb8 distinct; the same rook idea has a different position and result.
- State that 31...Rxe5 was already in BD's candidate list.
- Mark 32...Nxa5 as AI-influenced after candidate confirmation.
- Mark 34...Qa5 and 37...Ra8 as revealed, not blind choices.
- Keep CDB and Stockfish snapshots separate; R4 included no Stockfish jobs.
- Do not claim DCC+ beat Kasparov or treat the 0–1 result as an unexplained player-quality score.

## Source lineage

- V1/V2 decision history and reveal states: `ChessBest_DK_REVIEW_V3_NEXT_SESSION_SAVE_20261011_R1.md` and review revision ledger.
- Frozen R4 scientific snapshot: `ChessBest_DK_R4_GPT_INDEPENDENT_ANALYSIS_20261011_R1.md`, `refreshed_02`, cut 27,381. Final DB ZIP SHA-256: `669f11e67749770ec7092116f729d01c4394a29166d910f37476eefafd318c55`.
- Independent earlier engine review: `ChessBest_Dreev_Kasparov_CDB_SF_REVIEW_20261001_R1.md`. Its Stockfish depths and evaluations are not R4 results.
- LAB record: `public/chess-lab/Games/ChessBest_Top_Picks.pgn`; structured evidence summary: `public/chess-lab/Games/ChessBest_Top_Picks.catalog.json`.

No CDB enrichment or new Stockfish calculation was run to prepare Review V3.
