# GODS10 aggregation: pre-registered specification

- Version: **v1.0, 2026-10-27**. Implementation: `gods10_aggregate.py`. Own-set table: `own_set_table.json` (v1.0).
- Source of requirements: section 3 (3.2-3.8) of `SESTRA_GODS10_AUDIT_ZORA_20261027.md` (Zora, msg ZH-20261027-GODS10-AUDIT-01).
- This document, the script and the own-set table are frozen by their SHA-256 values (`HASHES.txt`) **before any judge is run**.
  Any change after the key is opened is reported as **post hoc**, next to the pre-registered result.
- Constants: seed `20261027`; bootstrap B = 10000; randomization/permutation draws R = 10000; minimum rule 5 judges / 3 families;
  incoherence threshold rho < 0.5; best-answer margin 2 votes; winner threshold P(rank=1) >= 0.5; self-preference flag d >= 0.2 and p < 0.05.

## 1. Inputs

| Input | Content | Rules |
|---|---|---|
| Sealed key (JSON) | `{"mapping": {judge: {letter: canonical_set_id}}}` | N = number of letters, taken from the key (A..W for 23 sets, A..Y for 25). Every judge's mapping must be a bijection from letters A..(N) to the same N set IDs, else abort. |
| Presentation order | position 1..N of each letter per judge | From `key.presentation_order` if present; else from `--prompts DIR` (order of `Set X` headers in `PROMPT_<judge>.txt`); else letter order (the builder assigns letters in presentation order: first shown = Set A). |
| Replies dir | `<judge>.txt`, optional `<judge>.retry.txt` | At most one retry. If a retry exists, only the retry is parsed; both files are hashed. No file = dropout "missing reply". Other files are listed as ignored. |
| `own_set_table.json` | judge group / family / model cluster, set families / model, explicit own-set lists for levels 1-3 | The script recomputes all three levels from the rules and aborts if they differ from the explicit lists, if levels are not nested, or if any judge or set of the key is missing (25 sets = new table version). |

## 2. Order of operations (Zora 3.8)

1. Publish SHA-256 of this spec, the script and the own-set table (`HASHES.txt`) before any judge is run.
2. Collect all replies, then run the **pre-key** mode without the key:
   `gods10_aggregate.py --parse-only --n-sets N --replies DIR --out OUT_PREKEY`.
   It writes `REPLIES_MANIFEST.sha256` (SHA-256 of every reply file), the manifest hash, and `GODS10_PREKEY_PARSE.json/.md`
   (valid/invalid per judge). Publish the manifest hash and the parse result **before** the key is opened.
3. Open the key, check its SHA-256 (`--expect-key-sha256 FULL` or `PREFIX...SUFFIX`; mismatch aborts) and run the unchanged script:
   `gods10_aggregate.py --key KEY.json --replies DIR --own own_set_table.json --out OUT --seed 20261027`.
4. All outputs are create-only. An existing output file is never overwritten; the run aborts instead.

## 3. Parser (strict; Zora 3.2)

The parser works in letter space and needs only the list of valid letters, so validity is fixed before the key is opened.

**Line normalisation.** En/em dashes and minus signs become `-`. Markdown emphasis characters (`*`, `_`, backtick) and leading `#`/`>` are removed.

**Sections.** A line that starts with `TABLE`, `RANKING` (also `FINAL RANKING`, `OVERALL RANKING`), `BEST ANSWER` or `JUSTIFICATION` (any case) opens that section. Score rows are accepted anywhere except inside JUSTIFICATION.

### 3.1 Score table
- **Candidate row.** The line starts with a set label (`A`, `Set A`, `(A)`, `A.`, `A:`) and at least 3 of its cells are numeric. Cells are split on `|` if the line contains one, otherwise on whitespace, `,`, `;` or `=`.
- **Valid row.** All of the following hold; anything else (decimals, `8/10`, extra columns, empty cells) makes the row invalid:
  - the label is a known uppercase letter;
  - there are exactly 5 score cells plus an optional 6th total cell;
  - each score is an integer from 1 to 10.
- **Column order.** The order given in the prompt is used. If a header line names all five criteria in a different order, the columns are remapped and the remap is logged.
- **Total.** The total is always recomputed from the five scores. A reported total that is wrong or not an integer is only logged.
- **Duplicates.** Identical duplicate rows are accepted once and logged. If duplicates conflict, or any of them is invalid, the letter is invalid.
- **Table validity.** The table is valid only with exactly N valid rows. A judge with fewer than N valid rows is excluded from all score metrics. Nothing is imputed.

### 3.2 RANKING
- **Text read.** The ranking is the text after `RANKING...:` plus continuation lines. Reading stops at the first blank line after at least one letter, at the next section, or at a score row.
- **Letters.** Letters are standalone single uppercase letters; the word "Set" is ignored.
- **Validity.** A valid ranking is a strict permutation of all N letters with no tie notation (`=`, `~`, "tie"). Its rank is the list position (1 = best).
- **Invalid or missing ranking.** If the table is valid, the ranking is derived from the recomputed totals (descending, average ranks for ties) and flagged `derived_from_totals`. Otherwise the judge has no ranking.

### 3.3 Best answer per question
- **Block.** The block runs from the BEST ANSWER header to the next section. A range token such as `Q1-Q10` is removed first.
- **With `Qn` labels.** The answer is the first standalone letter after the label. If a second letter is joined to it by `/ , & + or and`, that Q is invalid. If no letter follows the label directly, the Q is valid only when its segment contains exactly one standalone letter.
- **Without `Qn` labels.** Exactly 10 standalone letters are read in order as Q1..Q10; any other count makes all 10 invalid.
- **Validity.** Each Q is valid on its own when it has exactly one known letter; a repeated Q with different letters is invalid. An invalid Q is dropped, not the judge. Best answers count even when the judge's table is invalid.

### 3.4 Dropouts, consistency, constant judges
- **Dropout.** A reply with no candidate rows, no RANKING line and no valid Q is a dropout ("no parseable content (refusal or abort)"). It is listed with its reason.
- **Internal consistency.** This needs an explicit valid ranking, a valid table and non-constant totals. rho is the Spearman correlation between the explicit ranks and the average ranks of the totals. If rho < 0.5 the judge is flagged **incoherent**. The judge stays in every analysis, and an extra variant `no_incoherent` is added.
- **Constant totals.** If a judge's totals have sd = 0, the judge is excluded from every z-based quantity (primary metric, median/trimmed z, criterion z, bootstrap, position effect, self-preference) and logged. The judge stays in the raw mean and in rankings and Borda. If a single criterion is constant, it is excluded only from that criterion's z.

## 4. Scores and metrics (Zora 3.4)

Letters are mapped to canonical set IDs through the key before any computation.

- **z-score.** z_js = (total_js - mean_j) / sd_j over judge j's N sets (population sd, ddof = 0). Criterion z is computed the same way.
- **Primary metric.** The mean z over the variant's judges, after own-set exclusion where the variant has one.
- **Secondary metrics.**
  - raw mean total;
  - per criterion: raw mean, raw sum and mean z;
  - **Borda**: the mean over rank-valid judges of (N - rank), with average ranks for ties and derived rankings included;
  - median z;
  - trimmed mean z (drop the single highest and lowest judge per set; needs at least 3 judges);
  - number of first places (judges whose rank is 1).
- **Order and tie-break (publication).** Sets are ordered by the primary metric, then Borda, then the number of first places. Sets equal on all three share a place (competition ranking).
- **Family weighting.** In the family-weighted variant, every mean (primary, raw, Borda, criteria) weights a judge by 1 / (number of its family's judges contributing to that set), so each family has weight 1. Medians, trimmed means and counts are unweighted.

## 5. Variants and minimum rule (Zora 3.3, 3.5)

| Variant | Judges | Own-set exclusion | Weighting |
|---|---|---|---|
| `all` (primary) | all valid | - | judge |
| `own_l3` (primary bias control) | all valid | level 3 (family) | judge |
| `own_l2`, `own_l1` (sensitivity) | all valid | level 2 / level 1 | judge |
| `free` / `api` / `local` | group (judge-name prefix) | - | judge |
| `no_claude_gpt` | families other than anthropic and openai | - | judge |
| `family_weighted` | all valid | - | family weight 1 |
| `no_incoherent` | all except judges flagged incoherent | - | judge |

- **Own-set exclusion.** The exclusion works on cells: set s is scored only by judges for which s is not "own" at that level, so the judge set differs per set. The report publishes n judges and n families per set.
- **Own-set levels (`own_set_table.json`).**

  | Level | Meaning | Detail |
  |---|---|---|
  | 1 | Exact | Judge ID == set ID. |
  | 2 | Same API model at any effort | Free and local judges are matched only to their own set. |
  | 3 | Same family | `RHP11`, `AI8_family` and `BD+AI8` are own for both anthropic and openai. `BD` is own for nobody. |

  The B6 clusters (Zora) are covered only insofar as they fall within one family.
- **Minimum rule.** A variant is **ranked** only if every set has at least 5 judges with valid z from at least 3 families. Otherwise it is **descriptive**: values are shown, but no places, winner or leading group are declared. As a consequence:
  - `api` is always descriptive, because it has 2 families;
  - `local` is ranked only if all 5 local judges are valid (they come from 4 families).

  This also covers Zora's rule "local with <4 valid judges is descriptive only".

## 6. Uncertainty (Zora 3.6)

- **Cluster bootstrap.** Judges are clustered by **model** (`judge_model`: the high/max or high/ultra efforts of one API model form one cluster; 15 clusters for 19 judges). Only clusters with at least one judge contributing valid z to the variant are resampled. K clusters are drawn with replacement, each draw bringing in all of its judges, and the variant's primary metric is recomputed with the same weighting and own-set exclusion. B = 10000. The random stream is `SeedSequence([20261027, h("boot"), h(variant), h("model")])`, where h is the first 32 bits of SHA-256.
- **Reported per set.**
  - 95% percentile CI of the primary metric;
  - rank interval = 2.5th (lower) to 97.5th (higher) percentile of the competition rank (1 + number of sets strictly higher; NaN ranks last);
  - P(rank = 1) = share of replicates in which the set is first (a shared first counts).
- **Declaration.** In a ranked variant, the point leader (after tie-breaks) is declared **winner** only if its P(rank = 1) >= 0.5. Otherwise the **leading group** is reported: the sets whose rank interval includes 1.
- **Sensitivity.** The same bootstrap clustered by **family** is reported for `all` and `own_l3`.

## 7. Agreement (Zora 3.5)

- **Spearman between group means.** Group mean z is computed without own-set exclusion. Pairs: local vs api, local vs free, free vs api, plus a supplementary claude_gpt vs no_claude_gpt pair.
  - The 95% CI comes from a **stratified** cluster bootstrap: each group is resampled within its own model clusters, with independent streams, B = 10000.
  - Every result carries the note that all API judges are Anthropic/OpenAI, so api vs local is also Claude/GPT vs others.
- **Kendall's W** (tie-corrected, with chi-square p-value), computed for free, api, local, claude_gpt, no_claude_gpt and all. It uses the rank vectors of rank-valid judges, explicit or derived.
- **Mean pairwise Spearman** between judges' rank vectors, within free/api/local, between each pair of groups, and over all judges.

## 8. Best answer per question (Zora 3.5)

- Votes for each set are counted per Q. Share = votes / valid votes for that Q.
- A Q winner is declared only if it has at least 2 more votes than the runner-up; otherwise there is no winner.
- Totals over Q1-Q10 are reported.
- Variant `own_l3`: a judge's votes for its own level-3 sets are dropped.

## 9. Position and label effect (Zora 3.7)

- **Data.** Cells from all judges with valid z. Set fixed effects are applied by demeaning:
  - z' = z - (set mean of z);
  - p' = position - (set mean of position).
- **Linear.** Slope beta = sum(z' p') / sum(p'^2), reported together with beta x (N - 1), the first-minus-last difference.
- **Categorical.** Statistic = sum over positions of (sum of z' at that position)^2 / J. The report also gives the mean z' at each position 1..N.
- **Inference.** A **randomization test** re-draws every judge's presentation order uniformly at random (R = 10000). This is exact under H0, because the order was randomized by design. p = (1 + #extreme) / (R + 1); the test is two-sided for the slope.
- **Label.** If letters coincide with presentation order, as in the current build, the label effect is *identical* to the categorical position effect. It is reported as such: it is no longer confounded with set content, but it cannot be separated from position. Otherwise the same categorical test is run on letter index.

## 10. Self-preference (Zora 3.3)

- **Per judge.** For levels L = 1, 2, 3:
  - D_js = z_js - mean of z_ks over judges k != j with valid z for whom s is not own at level L;
  - d_j = mean of D_js over j's own sets.
- **Significance.** p is the share of R = 10000 random subsets of j's N sets, of the same size as j's own set list, whose mean D is >= d_j; p = (1 + #) / (R + 1).
- **Flag.** d >= 0.2 and p < 0.05. This is uncorrected: about 1 false flag per 20 tests is expected, and the report says so.
- **Family.** d is the cell-weighted mean over the members' own cells, and the null is built from the members' random subsets jointly.

## 11. Outputs

- **Full mode.** `REPLIES_MANIFEST.sha256`, `GODS10_AGG_RESULTS.json` (everything, machine-readable) and `GODS10_AGG_REPORT.md`. The report contains:
  - input SHA-256s (script, key with expected-hash check, own table, every reply file, manifest);
  - the parse log and issues;
  - all variants (per-criterion tables for `all` and `own_l3`) and the family-bootstrap sensitivity;
  - agreement, best per question, position/label effect and self-preference.
- **Pre-key mode.** `REPLIES_MANIFEST.sha256` and `GODS10_PREKEY_PARSE.json/.md`.

## 12. Self-test

`gods10_aggregate.py --selftest` never reads a real key. It builds a synthetic key from the canonical IDs in `own_set_table.json`, with a random permutation per judge (seeded). It then writes synthetic replies in 4 formats:
- planted quality ordering and planted best set `free_Gemini`, plus judge bias and scale, criterion noise and a planted primacy effect;
- one judge with planted self-preference (`api_gpt-6-sol_high`, +2.5 per criterion on its level-3 sets);
- one malformed reply (score 11, unknown letter, missing row, duplicated/missing letters in RANKING, unknown letter in Q4);
- one broken RANKING with a valid table and a wrong reported total;
- one incoherent (reversed) ranking, one constant judge (sd = 0), one refusal followed by a retry, one missing reply and one remapped column order.

It runs the pre-key mode and the full pipeline and asserts parser behaviour, a score round trip, pre-key/full agreement, the planted best ranking first (and declared winner), self-preference detected for the planted judge, the bootstrap (finite CIs, reproducible with the same seed, 15 model clusters), the minimum rule, the position effect and the outputs. Five hand-written parser unit cases (6 checks) are included. It prints PASS/FAIL per check and overall.

## 13. Decisions beyond, or differing from, Zora section 3

1. **Composite sets.** `RHP11`, `AI8_family` and `BD+AI8` are own (level 3) for **both** anthropic and openai. Zora 3.3 lists BD+AI8 as own for Claude only. This follows BD's brief (written/reviewed by Claude and GPT/Codex agents) and is more conservative, since it excludes more judges.
2. **Label effect.** It cannot be separated from position, because the B1 fix assigns letters in presentation order. One combined position/label factor is reported (linear and categorical).
3. **Scale of median and trimmed mean.** Not specified by Zora. They are computed on z, the primary scale; the raw mean is reported separately.
4. **Bootstrap rank.** Competition ("min") rank is used; P(rank = 1) counts shared firsts.
5. **Group-comparison CI.** A stratified cluster bootstrap is used, so a group can never be empty in a replicate.
6. **Self-preference.** "Other judges" are those for whom the set is not own at the same level. A permutation p-value and the flag rule (d >= 0.2, p < 0.05) are added.
7. **Position inference.** A design-based randomization test is used instead of OLS standard errors.
8. **Minimum rule.** The rule (>= 5 judges with valid z, >= 3 families per set) also covers Zora's "local < 4 → descriptive". The API group is therefore always descriptive.
9. **File conventions.** `--parse-only` was added for Zora 3.8 step 3. The retry file is `<judge>.retry.txt`.
10. **Level 2 kept conservative.** Free web and local judges match only their own set, because the model behind a free web account cannot be verified.
