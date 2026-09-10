# AI8 MODEL RESOURCE CONTROL
## v0.3 R3H2.1 CANDIDATE · Resource truth, route profiles, budgets, calls and substrate compatibility

**Status:** `CANDIDATE / NO GLOBAL ROUTE WINNER`  
**Owner:** `MODEL_RESOURCE_CONTROL`  
**Shared registry:** `AI8_8Z_SCHEMA_REGISTRY_R3H2_1@1.2` · `AI8_8Z_SCHEMA_REGISTRY_R3H2_1.json` · SHA3 `de1f1633acda2c9e409282017e6d8a335ad34607f2d2088957cdc816a6bb2915`
**Schema bindings:** `ai8.model-resource-state.v2@2.0` · `ai8.call-receipt.v2@2.0` · `ai8.route-request.v2@2.0` · `ai8.route-decision.v2@2.0` · `ai8.budget.v2@2.0` · `ai8.substrate-migration-receipt.v2@2.0` · `8z.causal-use-experiment.v1@1.0` · `8z.action-result.v2@2.0` · `8z.sink.v1@1.0`

## 0. Core decision
Model/resource state has multiple orthogonal dimensions. Subscription entitlement, UI visibility, catalog visibility, actual callability, rate limit, provider health, API access, local compute and AI8's own permission/budget are not synonyms.

This module exists partly because treating a UI reset or visible model as equivalent to usable resource can destroy scarce allowance or cause bad routing.

## 1. Normalized resource state
Use `ai8.model-resource-state.v2`. `callability` is only callable/not-callable/unknown; rate limiting and provider degradation live in their own dimensions. Every observation has freshness/TTL and source.

A probe is itself a metered call: it requires reservation + call receipt and its callability evidence expires by policy.

## 2. Budgets, reservations and liabilities
Local AI8 budgets are independent of provider limits. Before a paid/scarce attempt, reserve against every overlapping pool it can charge. Settlement books usage exactly once. `UNKNOWN_EFFECT` or unknown billing remains liability; timer expiry never refunds it.

Late bills attach to the original attempt window. If that window is closed, record a closed-window overrun incident and carry unsettled liability forward until settled. When unresolved liabilities exceed a frozen pool fraction, emit `ASK_BD` with the unresolved attempts.

Pre-reset records include remaining allowance forfeited and justification. Scarce resets are never performed merely because the UI offers them.

## 3. Provider adapter and call receipt
Adapters expose resource identity, capabilities, freshness, callability evidence, cost/usage receipt format, retry/idempotency behavior, data-handling constraints and failure semantics. Each delegated attempt writes `ai8.call-receipt.v2`; intent phase and receipt outcome are distinct.

## 4. One durable substrate, three route profiles
Continuity + MRC + Control form the durable substrate required by all persistent profiles. Compare:
- Work console first;
- API first;
- Mixed.

No global winner. Admission filters unsafe/unavailable routes; preference then optimizes frozen workload criteria and cost. Simpler profile wins a tie. A profile may lose on one workload and remain useful elsewhere.

## 5. Substrate compatibility and migration probation
MRC owns a frozen mapping table over provider, surface, model class and adapter version. It is declared **before** migration and cannot be authored retrospectively by the migrating agent.

Compatibility classes and actions are those in the shared registry. Unmapped changes default to unknown compatibility. Risk tier is derived from effect/permission/claim authority/cost class, not operator declaration. Reasoning owns operator recheck evidence; MRC owns classification and resource facts.

## 6. Reset/lesson causal use
The reset incident remains `RECORDED_NOT_LEARNED` until a shared `8z.causal-use-experiment.v1` shows that the active lesson/policy changes a permission-matched later decision on a novel surface, while stored-only/placebo/already-correct controls do not create false credit.

## 7. Effect and sink integration
External calls are effects under the Control sink contract. Retry cannot rely on provider promises alone; current fence, idempotency capability and reconciliation status remain explicit. A missing receipt is not evidence of no effect.

## 8. Failure/degradation
Provider/model disappearance may change route selection, but must not destroy committed research state. If all models are unavailable, Continuity preserves deterministic observation, accounting, checkpoints, unknown-effect state and BD escalation.

## 9. First slice
For Sudoku R6, use the cheapest already-available route profile that satisfies the frozen slice contract. Do not activate cross-provider routing, automatic resets or advanced bandit routing merely to demonstrate MRC. Those remain dormant/test-pending until a real workload requires them.

## 10. Acceptance boundary
Before paid/autonomous routing: probe accounting, late billing, reset-forfeit, pool-starvation, duplicated call, unknown effect, compatible/high-risk migration and provider outage fixtures must pass. No route-profile superiority is claimed before matched workload evidence.

## 11. Router decision procedure
First **admit** only resources whose permission, callability/freshness, provider health, required capability, effect class and budget reservation can satisfy the request. Then **prefer** among eligible resources by frozen workload policy. Unknown critical dimensions fail closed or trigger a probe/ASK_BD according to cost/risk. Routing cannot infer entitlement from catalog visibility or infer callability from a model name.

## 12. Provider-interface evidence boundary
Provider/product facts are time-sensitive. Adapter observations require source, observed time and TTL. Product documentation or UI screenshots describe an interface state, not the user's actual remaining quota unless that quota is directly observed. Any irreversible reset or allowance-forfeit action requires explicit evidence and permission.

## 13. Security
API keys and credentials never enter Control/public state, architecture packs or model prompts unless a narrowly scoped secure adapter requires them. Provider response text is untrusted input. A route decision cannot widen tool/effect permissions merely because a model supports more tools.

## 14. Prototype phases
0 read-only telemetry; 1 normalized resource state; 2 recommendation-only routing; 3 controlled specialist calls; 4 logical coordinator migration; 5 cross-provider resilience and no-LLM survival integration. Automatic scarce resets are outside the minimal prototype.

## 15. Acceptance gates
Surface separation; orthogonal resource schema; local budgets; reset governance; deterministic admission/preference routing; complete call receipts; adapter freshness; late-liability handling; graceful degradation; security boundary; continuity migration; no preselected route-profile winner.
