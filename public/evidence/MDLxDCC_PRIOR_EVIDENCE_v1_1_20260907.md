# MDL×DCC — prior evidence digest · v1.1

**Editorial date:** 2026-09-07. **Evidence relationship:** summary of earlier documented work, not a new benchmark or an independent replication.

[Readable bilingual record](MDLxDCC_PRIOR_EVIDENCE_v1_1_20260907.html)

## Sudoku v1.4

Source: `8z_MDLxDCC_TEHNICNA_MONOGRAFIJA_v1_4_20260905.md`, §§54 and 131–136, retained v1.4 text with V15 refinements. Underlying documented carrier: `AI8_SUDOKU_V140_LIVE_EXTRACT_20260905_123510.zip`.

2,048 puzzles × 50 policies = 102,400 unique rows. The prior report records 96,936 solved rows, 5,464 resource-limit rows and zero missing/duplicate tasks. This is an audit of a completed diagnostic export, not a newly created final report. Source metadata retains `scientific_evidence=false`.

| Candidate / comparator | Mean PAR2 change, A+B | Recorded CPU-sum change |
|---|---:|---:|
| A01 DCC / M04 UCB1 | -10.58% | -27.56% |
| F10 ordinary+DCC / F00 ordinary-fixed | -10.77% | -21.43% |
| A02 MDL×DCC / M08 UCB joint | -9.19% | +57.51% |
| A04 full stack / C05 | +5.82% | +60.53% |

Negative PAR2 change is better. PAR2 measures normalized work with a predeclared penalty for limits, not wall-clock latency. CPU totals are historical recorded sums. These are configuration comparisons, not isolated MDL-sensor effects. A04's primary comparison was NOT_SUPPORTED. R6 is a separate next architecture; these are not R6 results.

## 8zCoding

[Original public evidence](https://www.mdlxdcc.org/crp/8zcoding), page dated 2026-09-04: A0/A1 verifier PASS, 11/11 seeded wrong programs rejected; A2/A3/A5 engineering PASS for controller replay v0.2. A4 oracle interpretation is provisional, DCC and LZ mechanisms not promoted, A6 live coding not yet run in that report. Package identity is not a promise of source download.

## AI8 / ssMDL×DCC / 8zReasoning

Monograph v1.4 §§74–85 and 120–130 provide the first-instrument hypothesis and distinguish implemented work from future reusable reasoning procedures. The intended end-to-end first-signal advantage is not yet claimed as a measured general speedup.

[Monograph reference/access guide](MDLxDCC_MONOGRAPH_READING_GUIDE_20260907.md)

The full source monograph and raw experiment packages are not included here. The source sections were inspected; their experiments were not rerun in this editorial release.
