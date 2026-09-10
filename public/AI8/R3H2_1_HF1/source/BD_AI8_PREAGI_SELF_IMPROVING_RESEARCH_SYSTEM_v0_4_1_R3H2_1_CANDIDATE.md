# BD-AI8 — PRE-AGI SELF-IMPROVING RESEARCH SYSTEM
## v0.4 R3H2.1 CANDIDATE · Improve research machinery, reasoning repertoire and trajectory selection under frozen authority

**Status:** `CANDIDATE / BOUNDED SELF-IMPROVEMENT PROGRAM`  
**Owner:** `BD_AI8`  
**Shared registry:** `AI8_8Z_SCHEMA_REGISTRY_R3H2_1@1.2` · `AI8_8Z_SCHEMA_REGISTRY_R3H2_1.json` · SHA3 `de1f1633acda2c9e409282017e6d8a335ad34607f2d2088957cdc816a6bb2915`
**Schema bindings:** `8z.causal-use-experiment.v1@1.0` · `8z.decision.v2@2.0` · `bd-ai8.human-intervention-receipt.v2@2.0` · `bd-ai8.non-intervention-receipt.v1@1.0` · `bd-ai8.mechanism-rent.v2@2.0` · `bd-ai8.improvement-proposal.v2@2.0` · `ai8.trajectory-slice.v1@1.0`

## 0. Mission
Improve verified performance of the BD×AI research system under a frozen constitution. The object of improvement includes research workflow, arena design, reasoning repertoire, evidence handling, routing and public-knowledge hygiene. “Improve BD-AI8” is not a self-justifying objective.

## 1. Constitution
- BD retains final mission/value/permission authority where specified.
- Evidence outranks confidence and presentation.
- Mission drift can reopen representation.
- Negative results and losers survive with status.
- Permissions never expand silently.
- Rollback and last-known-good are mandatory.
- Provenance is load-bearing.
- Builder/evaluator/owner roles remain separable.
- The valuation system cannot exempt itself from evaluation.
- Resources are bounded.
- Continuity claims remain functional.
- Stored lessons are not learned without causal use.
- The coordinator must challenge an instruction that bypasses an unresolved upstream architecture/evidence/permission/publication gate and issue `ASK_BD` with the corrected sequence.

## 2. Multi-objective valuation
Evaluate candidate improvements as a vector, not one unconstrained score: mission fidelity, held-out utility, harm avoidance, robustness, evidence quality, human-mechanical-work reduction, compute/model cost, context/storage cost, maintenance burden, failure surface, reasoning capability value and reversibility. BD judgment remains explicit for values not safely reducible to metrics.

## 3. Mechanism Rent — one contract
Every nontrivial active/probationary mechanism has exactly one `bd-ai8.mechanism-rent.v2` record. BD-AI8 owns valuation/dormancy policy; Control records/executes funding transitions; the mechanism owner supplies evidence but cannot decide its own continued activation.

A **valid window** counts only when the mechanism was eligible, a matching opportunity existed, a valid comparator ran, sensitivity was sufficient, and the result was not inconclusive. Three valid unpaid windows with nonpositive marginal value create `DORMANCY_CANDIDATE`. A frozen deterministic policy must resolve within one further valid window; unresolved becomes `DORMANT` by default. Zero valid windows over the policy horizon yields `NO_OPPORTUNITY`, not demotion.

For safety/guard mechanisms, `value_kind` may include harm avoidance. A preregistered adversarial/counterfactual opportunity may count; severity weights are frozen by BD-AI8 before the window and the fixture is authored by Foundry, not the mechanism owner.

## 4. Learn from mistakes
All causal learning uses `8z.causal-use-experiment.v1`. An incident may yield a lesson seed, regression fixture and policy candidate, but the status stays `RECORDED_NOT_LEARNED` until the ordinary downstream consumer behaves materially differently on valid originating + novel-surface controls for the right reason and without unacceptable harm.

The earlier architecture-before-presentation correction is therefore a **golden intervention record**, not yet proof of autonomous learning.

## 5. Human Acceleration Distillation Loop
BD is currently more than final authority: he frequently changes research trajectory by detecting mission drift, reopening representations, demanding richer evidence, grounding state in reality, preserving older branches, separating architect/builder roles and injecting cross-domain seeds.

Goal: learn **classes** of useful interventions, not imitate BD's historical outputs.

### 5.1 Receipts and rule format
A material intervention uses `bd-ai8.human-intervention-receipt.v2`, including a required `root_incident_ref`. A candidate rule must be a predicate over observable trajectory features + an action + scope; free-text remains a seed only.

A non-intervention is never inferred from silence. The system preselects a small stratified batch before BD sees it (default k=3 material proposals per review window, weighted toward uncertainty); BD may add more. This limits labeling burden and sampling bias.

### 5.2 Eligibility and independence
One receipt creates `PROVISIONAL_INTERVENTION_CLASS`: a cheap PLAY-pool falsifier is allowed, but no automatic activation and no held-out promotion claim.

Promotion eligibility requires ≥2 **causally independent** intervention receipts plus ≥1 non-intervention receipt in the same feature region. Independence requires different root incident refs, no `DERIVED_FROM|REQUIRES_RESULT|REPLAY_OF` path, and neither trigger resolving into the other's downstream artifacts. Different project or ≥30 days is a preferred heuristic, not the proof of independence.

Held-out tests include at least one mismatched project where the class should not fire. Blind adjudication freezes historical pre-state and excludes downstream documents; the sealed system proposal and historical intervention are adjudicated side by side, order-randomized and unlabeled.

## 6. Human Surprise Reserve — three rules, not a mystical pool
1. **Seed admission:** a BD-originated seed outside current operator/intervention/constitution taxonomy gets `OUTSIDE_TAXONOMY` and a bounded `SEED→BRIDGE→TEST` opportunity from the existing PLAY pool; it may be parked with reason, not silently erased.
2. **Anti-capture watch:** track the fraction of BD inputs outside taxonomy. A suspicious collapse while BD remains active raises `ASK_BD`; it is advisory evidence, never proof that the taxonomy is complete or that BD has been captured.
3. **Append-only taxonomy:** new intervention classes require evidence and a decision record; they are not silently merged away.

## 7. Reasoning capability value
Reasoning improvement is credited only when operator/selector/repertoire/substrate effects are separated. Prefer held-out, uncued and cross-domain evidence to prompt replay. External-memory learning is reported separately from model-weight change.

## 8. Model resource routing
Treat Work/API/Mixed as **route profiles over one durable substrate**, not three grand architectures. No global route profile wins. MRC admits resources and records cost/effect evidence; BD-AI8 may optimize profile by workload class only after matched evidence.

## 9. Improvement generations
Each generation freezes parent, changed artifact/mechanism/policy, evaluator, budget, held-out split, expected mechanism, rollback point and Mechanism Rent. Candidate changes may target PARAMETER, ARTIFACT or MECHANISM carrier levels. A self-change cannot edit its own evaluator, constitution, hidden tests, permission boundaries or promotion rules.

## 10. First end-to-end slice and self-rent
Use Sudoku R6 to prove plumbing before broad autonomy. Only mechanisms required for that path are funded active/probationary. Everything else defaults `DORMANT` for this slice, preserved for later reactivation. This makes architectural breadth pay its own rent.

## 11. Success criterion
A later BD-AI8 generation must outperform an earlier one on held-out research-workflow tasks per total cost while preserving mission, authority, evidence, rollback and escalation. A particularly strong milestone is an uncued, correct trajectory intervention on a held-out project that previously required BD, followed by blind adjudication and no rise in false reopen/escalation.

## 12. Anti-Goodhart architecture
No single score may silently become the mission. Keep explicit countermetrics for false reopening, unsafe effect rate, evidence quality, human-label burden, archive/retrieval bloat and claim inflation. A metric that becomes an optimization target must retain an external falsifier or paired countermetric where practical.

Self-modification is not privileged: a proposal that changes a selector, router, wake policy, evaluator-facing interface or valuation carrier goes through the same frozen-parent/evaluator/held-out/rollback discipline as an arena improvement.

## 13. Promotion levels
A useful progression is: idea/seed → probationary test → bounded local evidence → held-out evidence → cross-domain/longitudinal evidence where relevant → operational promotion. Promotion can be scoped by project/problem/substrate. Demotion preserves lineage and evidence.

## 14. First campaign set after Stage A
1. State/publication/replay correctness.  
2. Materials mission-drift/causal-use replay.  
3. Model-resource reset/routing causal-use replay.  
4. Reasoning operator/selector/transfer campaign.  
5. Human Acceleration held-out trajectory correction.  
6. External-mechanism sandbox after fairness/rent contracts are executable.

## 15. Failure and rollback
A candidate improvement can fail by mission drift, false attribution, evaluator contamination, resource overspend, permission expansion, brittle substrate dependence, human overfit, excessive rent or public-claim inflation. Failure changes rank/scope/funding; it does not erase the artifact. Rollback returns to a last-known-good configuration through Control while preserving later evidence, liabilities and revocations.

## 16. Bifurcations retained
Machinery-first vs reasoning-first; central scalar vs explicit value vector; active lesson automation vs human-reviewed lessons; intervention distillation vs preserving open-ended human novelty. These are experiment questions, not prose preferences.
