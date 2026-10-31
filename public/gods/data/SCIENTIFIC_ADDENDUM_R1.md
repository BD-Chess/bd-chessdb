# GODS10 B_EXT web panel — blinded amendment R1

Frozen after original collection and four authorized technical recovery responses, before any author key was opened. This is not a pre-first-judge preregistration. The original v1.0 specification and parser are preserved.

## Inputs and selection

Exactly 15 web services and the 36 identical answer bodies in MANIFEST_R2. Baseline: 13 complete original FULL tables. Recovered: those 13 plus Nova's three new 12-set packets and Cohere's original P1/P3 plus the single new P2. The four new packets passed 12/12 known, unique codes and integer criteria 1–10. All original files remain available. Each service is one judge, never three observations. No paid calls, score-dependent retries, guessed codes, imputation or answer rewriting.

The two-character adapter changes only four token-width regular expressions. Original rules for totals, duplicate conflicts, valid tables, rank fallback and independently valid Q votes remain. Three SPLIT tables are joined into one 36-score row; population z is computed across all 36, not within each packet. Global SPLIT rank is derived from totals with average ties. No merge of packet rankings into a global ballot.

## Primary and sensitivity analyses

Use the unchanged v1.0 numerical functions: mean judge-normalized z; raw totals, Borda, median and trimmed z, five criteria; model-cluster bootstrap B=10000; seed 20261027. Minimum per set is five valid judges from three families. Winner threshold P(rank1)>=0.5 applies only when all sets meet the minimum. Family bootstrap for all and own_l3. Self-preference tests use R=10000 and the original uncorrected p-values, explicitly exploratory. Judge agreement is descriptive for this web-only campaign; there is no fabricated local/API comparison.

Run baseline and recovered panels separately for 36 sets and core34 excluding web_Perplexity and ext_gpt-6.1-terra_high. For core34, recompute each judge's mean and population SD over 34 scores and compress ranks with average ties; do not delete two rows from already normalized z and call that a new normalization. Retain original sources and EXTRA provenance.

Own levels 1/2 match the same web-service set, including the six free_* legacy IDs. Level 3 uses canonical set families from own_set_table v1.1 and the extension key. Composite families are carried from that table; BD is own for nobody. Copilot is conservatively assigned OpenAI for family control, preserving original Microsoft manufacturer metadata and noting that its exact underlying model is unknown. This correction is frozen before author reveal. Each web service is its own model cluster, because shared exact underlying models are unverified. Family weighting provides a sensitivity check.

## Per-question votes

The primary global Q analysis uses valid original FULL ballots, independently of table validity, as in SPEC v1.0 (140 votes, including Nova). Report own_l3 and complete-original-table-only sensitivities. Nova and Cohere SPLIT selections are local to 12 alternatives and are preserved only as local descriptions. This deliberately supersedes the draft's proposed 1/3 pooling, which would not make local and global choices equivalent. A removed EXTRA vote is absent in core34; never infer a second choice. Winner margin is at least two votes.

## Position, labels and limitations

Original FULL complete judges only are used for the 36-position test. SPLIT packet-local positions are not pooled as if all 36 were seen in one context. Reuse v1.0 position fixed-effect demeaning and R=10000 order randomizations. Remove the old single-alphabet label claim. The separate exploratory two-letter identity statistic is sum_code(sum residual z)^2/count_code, after set-mean demeaning. Under each of R=10000 permutations, each judge retains its actual code pool and randomizes its assignment across sets. Sparse identities limit power; the test does not prove blinding prevented recognition.

Length is a diagnostic: eight of 360 supplied answers exceed 20 whitespace tokens; maximum 35. No retroactive penalties or shortening. FULL vs SPLIT context, recovery time, unequal recorded effort modes, unknown model versions/settings and a fixed nonrandom panel limit generalization. CI and rank probability describe resampling this panel, never metaphysical truth or all future models.

## Old rounds and keys

This release targets the web15 × 36 panel. Sixteen old API/local judges' NEWANCH packets and eight anchors are not collected in these inputs and are not combined or calibrated. The old 25-set campaign is a separate secondary dataset. No old judging is invented and no new API collection is authorized here.

The extension key must match SHA-256 d1b5b08ccd886f1ec4208bae9493a248b7bc6f08b99fd9cb697fc9a8ecc44d24. The original key must match fdb811272d026edca1ae0f90607f806755237dbcd6d6e1d4540fb54880f184b3. Own table must be v1.1 e0688931… and its full actual hash is recorded when available. Canonical old authors must resolve through the old key's free_ChatGPT mapping, never by interpretation of answer style. Fail closed on missing or mismatched mapping/families.

## Freeze and review

PREKEY_SELECTED_PARSE.json binds the exact 13/15-panel selection, original and recovery hashes and packet-local ballots without reading SEALED. SYNTHETIC_CHECKS_R1.json records bounded parser, split-union, code-permutation, family-mask, minimum-coverage and core34 normalization/rank checks. PREKEY_FREEZE_RECEIPT.json binds this addendum, actual executable, source dependency hashes, protocol and all selected parse evidence. Persist and read back the frozen package before key opening. Output per-phase checkpoints are immutable and hash-validated on resume.

