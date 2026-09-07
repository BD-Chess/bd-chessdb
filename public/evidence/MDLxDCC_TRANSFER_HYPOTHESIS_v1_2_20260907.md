# MDL×DCC — prospective transfer hypothesis v1.2

**Date:** 2026-09-07. **Status:** proposed protocol, not a completed experiment or a claim of preregistration.

## Target class

Large structured search spaces where the appropriate representation, model, operator or allocation policy is not known in advance. Promising conditions include reusable regularities, multiple plausible specialists, costly evaluation, changes in the productive strategy, and discoveries that can reduce subsequent search cost.

The six conditions are reasons to select a target, not a post-hoc definition of success. Record eligibility before comparative results are visible. Tiny, unstructured or already-solved allocation problems are useful negative controls; little extra benefit is predicted there.

## What to freeze

Bind the shared mechanism and its version, domain adapter boundaries, target population, allowed tuning, candidate/operator portfolio, seeds, budget, outcome metric and stopping rule before the held-out comparison. Record any deviations separately. A failure on an eligible target must not disappear through retrospective exclusion.

## Comparisons

Use fixed allocation and a strong simple adaptive alternative with the same candidate/operator access. Include MDL-only, controller-only or representation-feedback-off comparisons when they address the specific claim. Match tuning budgets. A new representation must be available to the appropriate controls if the question is allocation; hold allocation constant if the question is representation.

## Complete accounting

Include representation construction, adaptation/setup, failed attempts, runtime, memory, controller work, checking and skill retrieval. Do not add quantities with different units without a declared conversion. Distinguish final instance-solving efficiency from research time/cost to the first useful verified signal.

## Interpretation

Report paired outcomes and uncertainty across held-out cases, failure counts and relevant cost–quality trade-offs. State the minimum useful gain for this domain beforehand. Preserve negative outcomes and simpler winners without relabeling them as success of every named component.

L1 (recurring organization), L2 (implementation), L3 (transfer), L4 (local causal usefulness) and L5 (prospective transfer) answer different questions. They are not a universal certificate or a logical implication chain. Source conformance answers what transferred; controlled measurements answer what it contributed.

## Provenance

This proposal implements the editorial direction approved by BD in the 7 September 2026 conversation. Existing public context is summarized on the technical page and in the v3 public audit-summary package. No new solver or scientific performance result is claimed by this document.
