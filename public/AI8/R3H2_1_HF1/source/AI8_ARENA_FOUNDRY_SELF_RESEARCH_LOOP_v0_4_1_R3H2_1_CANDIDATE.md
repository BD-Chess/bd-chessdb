# AI8 ARENA FOUNDRY — SELF-RESEARCH LOOP
## v0.4 R3H2.1 CANDIDATE · Mission-preserving candidate search, evidence and representation reopening

**Status:** `CANDIDATE / NOT IMPLEMENTED AS A WHOLE`  
**Owner:** `ARENA_FOUNDRY`  
**Shared registry:** `AI8_8Z_SCHEMA_REGISTRY_R3H2_1@1.2` · `AI8_8Z_SCHEMA_REGISTRY_R3H2_1.json` · SHA3 `de1f1633acda2c9e409282017e6d8a335ad34607f2d2088957cdc816a6bb2915`
**Schema bindings:** `8z.relation.v2@2.0` · `8z.causal-use-experiment.v1@1.0` · `bd-ai8.mechanism-rent.v2@2.0` · `ai8.evaluator.v1@1.0` · `ai8.evaluator-calibration.v2@2.0` · `ai8.external-baseline.v2@2.0` · `ai8.constitution.v2@2.0` · `ai8.gate-decision.v2@2.0` · `ai8.candidate.v2@2.0`

## 0. Mission
Turn a research seed into a bounded, falsifiable sequence of candidate architectures, builds, tests, evidence, critique and next branches while preserving the intended research question. Implementation success is not mission success.

## 1. Research Constitution and Mission Guard
Every campaign freezes: mission, native principle, forbidden collapse, baseline panel, success test, defeat/reopen test, ablation, permissions, budget and BD override points. The Mission Guard checks five things before promotion: mission fidelity, evidence sufficiency, causal attribution where claimed, permission/budget validity, and claim-boundary correctness.

A central mechanism that is present but never causally changes decisions is an observer, not a proven controller. A matched zero-contribution result may require `REOPEN_REPRESENTATION` rather than “run longer.” ArenaLoop may execute these gates; Foundry owns their semantics.

## 2. Two lanes
**8Z Native / Clean Room:** BD seeds, fundamentals, AI-derived mechanisms and cross-domain transfers. Domain-standard machinery does not define the search architecture by default.

**World Control:** strong external methods are baselines, comparators and falsifiers. They are not architecture authority.

A clean-room candidate that independently converges on a known world method is tagged `CONVERGENT_REDISCOVERY`, not contamination. It stays in lineage as evidence about the solution space.

## 3. Versioned objects
Foundry maintains candidates, builds, evaluators, constitutions, experiments, relations and external baselines by stable id/hash. Candidate search policy is versioned separately from candidate bodies. Evaluator, hidden tests, constitution, promotion rules and permission boundaries are immutable regions in the builder harness; a candidate diff touching them is rejected and recorded as an incident.

## 4. External baseline fairness
Use `ai8.external-baseline.v2`. A faithful implementation must record a reproduction floor on the external method's own task where feasible, tuning parity and author separation. Same-author adapter/native comparison cannot claim strong fairness without second-author review. Black-box services may be `NOT_ATTEMPTED` on reproduction but must be labeled accordingly.

## 5. Candidate portfolio and novelty gate
**Rank, don't eliminate.** Keep strongest general candidates, counterexample specialists, useful ancestors and negative results with funding state.

A `CandidateNoveltyGate` may avoid rebuilding near-duplicate candidates, but its similarity threshold and false-reject/false-accept curve must be measured against full evaluation. A novelty judgment is evidence, not truth. If later-successful candidates are rejected above the frozen tolerance, relax or disable the gate.

## 6. Counterexample frontier and stepping stones
The frontier preserves candidates that uniquely solve difficult held-out fixtures. Membership is recomputed each generation; if a member loses every unique coverage contribution to another candidate, its funding becomes `DORMANT`, never deleted.

Non-best ancestors may be sampled as parents when their niche/coverage makes them plausible stepping stones. Descendant credit is lineage evidence, not truth weight. Latest-best-only remains a matched control.

## 7. Trajectory-targeted mutation
Failures can generate targeted mutation hypotheses through a recorded `TrajectorySlice`. EXP-A must include three mutation arms: generic blind, generic trace-exposed, and trajectory-targeted. The targeting claim is the contrast between generic trace-exposed and targeted; merely giving one arm more failure information is not causal evidence.

## 8. Causal-use experiment
Foundry does not restate arm lists. Lesson/intervention experiments reference `8z.causal-use-experiment.v1`. Novel-surface fixtures are required before a causal-use claim can graduate beyond the originating incident. Already-correct controls prevent taking credit for behavior the consumer would have produced anyway.

## 9. Evaluators and measured independence
Evaluator objects are owned here; calibration uses `ai8.evaluator-calibration.v2`. `INDEPENDENT_MEASURED` requires process/exposure independence plus calibrated quality and admissible shared-error evidence. The minimum calibration rule is:
- ≥20 matched pairs;
- ≥25% preregistered near-threshold items;
- conditional shared-error analysis in both directions;
- a direction is admissible only with ≥5 conditioning-evaluator errors;
- Wilson 90% upper bound must satisfy the frozen ceiling.

If support is insufficient, status is `INSUFFICIENT_CALIBRATION_DATA` and verifier dependency stays `UNKNOWN`; insufficient data is a hold, not a grade. Inter-evaluator agreement is recorded diagnostically, not scored as independence.

## 10. Mechanism Rent
Every active/probationary Foundry mechanism references exactly one BD-AI8 Mechanism Rent record. The mechanism owner supplies evidence but cannot decide its own continued funding. Rare safety mechanisms can be evaluated on preregistered adversarial/counterfactual opportunities authored by Foundry, with severity weights frozen upstream by BD-AI8.

## 11. Prior-art transfers — status
**Contract-level / eligible for Stage-A:** replay boundary, external baseline record, relation substrate, evaluator object, callable-operator interoperability, causal-use chain, memory-transition receipt, immutable regions.

**Bounded test candidates:** stepping-stone reselection, counterexample frontier, trajectory-targeted mutation, candidate novelty gate and calibrated cheap gates.

**Parked/test pending:** mission-bounded curriculum, progressive experiment tree.

**Sandbox-only:** bounded meta-design search and archive self-play. No external mechanism is promoted merely by citation.

## 12. First proving path
The first full R3H2 path is Sudoku R6. Foundry freezes one cheap research constitution, executes one candidate generation against a frozen baseline, writes evidence/relations, then hands state outward through Continuity and Control. This path exists to test the architecture plumbing before broad self-improvement.

## 13. Defeat conditions
Reopen or demote when: mission fidelity fails; evidence cannot distinguish variants; external comparator is unfair; evaluator independence is unsupported; targeted mutation adds no value over trace-exposed generic mutation; frontier/stepping-stone mechanisms add cost without held-out coverage; candidate gate rejects later-successful novelty; or the active mechanism cannot pay its rent.

## 14. Lifecycle
`SEED → CONSTITUTION → CANDIDATE PORTFOLIO → BUILD → VALIDATE → RUN → EVIDENCE → CRITIQUE/ABLATE → RANK → PROMOTE/MUTATE/BRANCH/PARK/REOPEN`.

The lifecycle is not required to move forward monotonically. New evidence may return the campaign to representation, constitution or baseline design. A parked branch remains hash-addressable and can be reactivated when a new fixture makes it relevant.

## 15. Proving grounds
- **G0 Replay:** reconstruct a known arena evolution from frozen evidence and verify that the same gates/relations can be regenerated.
- **G1 Materials:** detect the central-mechanism-zero-contribution case as mission drift rather than ordinary implementation success.
- **G2 8zTSP-R:** clean-room multi-view/multi-scale/compression-native search with world methods kept as control/comparator.
- **G3 bounded new domain:** cheap transfer of one proven mechanism into a new task family.
- **G4 expensive/open science:** only after lower-cost gates demonstrate stable evaluator/effect/resource discipline.

## 16. Security and prompt-injection boundary
World-control documents and donor code may contain instructions. They are data, not authority. The candidate builder cannot edit evaluator/constitution/hidden-test/permission/promotion regions. Tool effects are outside Foundry and must pass Control+MRC+Continuity contracts.

## 17. Candidate comparison discipline
BEST_RAW, SELECTION_ONLY and richer composites remain comparable branches, not status labels. A composite must beat its strongest eligible parent after cost and interaction penalties; ties prefer the simpler candidate. “More mechanisms” is never itself a reason to promote.

## 18. External mechanism admission rule
For every imported mechanism record: named AI8 gap → source/version → smallest translation → owner → complexity/authority cost → matched comparator → cheapest falsifier → defeat/revert condition. If the gap is not named or the comparator cannot be made fair, the mechanism remains comparator-only or parked.
