# AI8 Preparation / Genesis Integration Note

Date: 2026-08-16  
Status: EXPERIMENTAL BRANCH / REVIEW  
Provenance sync: R2

## Decision

The execution-hardened RRP / Team Genesis line is integrated into AI8 v2 as a **companion experimental Preparation / Genesis Plane**. It is not adopted into the frozen ArenaLoop Architecture Spec v0.2.2 and is not a fourth top-level loop.

## Current execution source

`AI8_ArenaLoop_D_RRP_TEAM_GENESIS_v0_4_1_EXECUTION_HARDENED_R2.zip`

SHA3-256: `a0f3137a526c6e71bcd6c994f1b5fc894c20720ce9bed6f8c8e0a6db6592d6b9`

R2 is a bounded execution-hardening release. It does not change the architecture or claim boundary.

## What R2 closes

- Draft 2020-12 schema validation is mandatory and fail-closed.
- `RUN_RECORD` links the complete contract, preparation, runtime, Round-1, test, cost, evaluation and reveal chain.
- Exact-byte sidecars, internal self-hashes and direct raw evidence are recomputed.
- C1 is aligned with B0/B1/D1 in the active first causal stage.
- D2 and `P2_MATCHED` are each validated as complete runs before matched comparison.
- The packaged suite contains valid C1, D2 and P2_MATCHED fixtures plus 20 real integration tests against the actual validator.

## AI8 relation

Continuity preserves verified state and constraints. ArenaLoop chooses what to investigate. Preparation / Genesis makes the initial researcher configuration explicit and testable. AIM³/RHP execute differentiated workers. OUTER/INNER generate and test. META may later learn preparation policy only after evidence.

## First causal stage

- B0 — cold single;
- B1 — raw-context single;
- C1 — human-prepared, task-aware and solution-blind single;
- D1 — AI-prepared, task-aware and solution-blind single.

Team coordination is tested later through D2 versus `P2_MATCHED`, with G2/P2 and cold-swap controls.

## Claim boundary

No performance advantage is claimed. The branch is experiment-ready only. Relational / identity preparation remains separate and is not part of the first causal E0 test.

## Frozen baseline

`AI8_ArenaLoop.md` remains byte-identical to Architecture Spec v0.2.2. Its SHA3-256 remains:

`4d8c5c9b91cce6cb80d5165493276c6d16346f7248536d02dd903ae1ec53aaa9`

## Promotion criterion

A future ArenaLoop candidate spec becomes justified only if held-out, leakage-audited, total-budget-matched trials show replicated downstream benefit. Team Genesis additionally needs independently adjudicated, downstream-valid bridge evidence beyond what sealed individual Round-1 outputs already contained.
