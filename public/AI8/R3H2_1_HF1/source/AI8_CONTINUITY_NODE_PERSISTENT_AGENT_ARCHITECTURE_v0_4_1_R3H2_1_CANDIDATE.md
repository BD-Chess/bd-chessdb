# AI8 CONTINUITY NODE — PERSISTENT AGENT ARCHITECTURE
## v0.4 R3H2.1 CANDIDATE · Durable functional continuity under replay, migration and failure

**Status:** `CANDIDATE / FUNCTIONAL CONTINUITY ONLY`  
**Owner:** `CONTINUITY_NODE`  
**Shared registry:** `AI8_8Z_SCHEMA_REGISTRY_R3H2_1@1.2` · `AI8_8Z_SCHEMA_REGISTRY_R3H2_1.json` · SHA3 `de1f1633acda2c9e409282017e6d8a335ad34607f2d2088957cdc816a6bb2915`
**Schema bindings:** `8z.event.v2@2.0` · `8z.replay-mode-contract.v1@1.0` · `8z.sink.v1@1.0` · `8z.action-result.v2@2.0` · `8z.publication.v2@2.0` · `ai8.capsule.v2@2.0` · `ai8.checkpoint.v2@2.0` · `ai8.memory-transition-receipt.v1@1.0` · `ai8.substrate-migration-receipt.v2@2.0` · `bd-ai8.human-intervention-receipt.v2@2.0` · `bd-ai8.non-intervention-receipt.v1@1.0`

## 0. Claim boundary
Continuity means durable functional state, provenance, open obligations and recovery across sessions/models/outages. It does not establish continuous subjective identity or consciousness.

## 1. Continuity capsule
A capsule stores mission/version refs, current committed state revision, open decisions, unresolved effects/liabilities, active permissions, policy versions, relevant evidence pointers, context-residency pointers and next safe wake. It is compact; historical detail lives in append-only logs/registries.

## 2. Event delivery and duplicate suspicion
Primary event identity uses producer + logical event key. A bounded secondary semantic-hash index detects likely re-emission after producer key loss. Material suspected duplicates are held; lowest-tier idempotent noise may be coalesced with a receipt according to event-class policy.

Ordering is explicit per producer where sequence exists; otherwise reducer rules use occurred/ingested time and authority. Backpressure degrades observation cadence before dropping material events.

## 3. Processing cycle
Each cycle is journaled: accepted inputs → deterministic reducer → wake decision → optional model/reasoning proposal → permission/resource checks → effect intent → dispatch → result/reconciliation → commit → checkpoint. No uncommitted narrative becomes state.

## 4. ReplayModeContract
Every replay declares `8z.replay-mode-contract.v1`:
- `DETERMINISTIC_RECOMPUTE` recomputes deterministic reducers/policies from frozen inputs;
- `RECORDED_NONDETERMINISM` reuses recorded model/external responses and receipts rather than pretending stochastic calls are reproducible.

Missing nondeterministic receipts block equivalence claims. Replayability is not effect safety.

## 5. Leases, epochs and fencing
Only the current lease/epoch may propose authoritative transitions. Every effect is fenced again at dispatch through the sink contract. A stale coordinator can reason, but cannot commit or dispatch under an expired epoch.

## 6. Checkpoints and independent recovery anchor
Checkpoint identity includes state hash, event frontier, policy versions, permission/resource/liability summary and prior checkpoint link. At least one recovery anchor must live outside the mutable coordinator state it protects. Recovery never treats a self-reported checkpoint as independently verified solely because the same process wrote it.

## 7. PolicyReplayDiffGate
Before activation of a new wake/reducer/router/selector version, replay a frozen recent history under both replay modes. Every changed decision is classified intended/bug/nondeterminism; unclassified divergence means `HOLD`. This applies even to human-approved policy updates.

## 8. Memory transitions
Context movement uses explicit memory-transition receipts. Active/dormant/quarantine residency never becomes a new truth store. Compaction/eviction must preserve authorities, revocations, unresolved effects/liabilities and hash-addressable provenance.

## 9. Model/substrate migration
Logical continuity can migrate while operator evidence becomes less certain. MRC owns the frozen compatibility map; the migrating agent cannot label itself compatible. Continuity records migration receipt and obeys the resulting probation/revalidation rule.

## 10. Effects and unknown outcomes
Every command carries a sink ref, permission ref, fence and idempotency identity. `UNKNOWN_EFFECT` remains a retained liability until readback/reconciliation or BD decision. Timer expiry never converts uncertainty into no-effect. Late receipts reconcile against the action-ledger union even after rollback.

## 11. Graceful degradation
If preferred models disappear, keep deterministic event intake, state reduction, checkpointing, budget accounting, stale/unknown classification, and BD escalation alive without LLM calls. Model unavailability degrades intelligence routing, not the existence of the control state.

## 12. Human intervention capture
Continuity captures material BD interventions/non-interventions without inferring labels from silence. It provides the frozen pre-state and event context; BD-AI8 owns interpretation; Foundry owns held-out testing.

## 13. First slice
For Sudoku R6, persist one pre-generation capsule, one post-evidence capsule and the KnowledgeRelease handoff reference. No nonessential adaptive mechanism is activated in this slice.

## 14. Acceptance boundary
Before actuation beyond sandbox/read-only: split-brain, stale dispatch, crash-between-effect-and-commit, late receipt, rollback union, policy replay-diff and no-LLM survival fixtures must pass. Architecture text alone is not runtime evidence.

## 15. Wake tiers
A deterministic wake policy should normally distinguish: telemetry-only/no-model handling; lightweight classification; bounded analysis; full coordinator reasoning; BD escalation. Exact tier names are implementation-local, but the principle is fixed: ordinary heartbeats do not spend model calls, and model unavailability never stops deterministic safety/state work.

## 16. Backpressure and dead-letter policy
Under overload, reduce low-value observation frequency and batch idempotent noise before delaying material decisions. Never drop revocations, effect receipts, completion/failure transitions or budget liabilities. Poison events move to a dead-letter record with provenance rather than disappearing.

## 17. Security
Continuity owns neither secrets nor permission policy. It may retain references to secret-bearing adapters, but capsules should contain least-privilege identifiers, not credentials. A recovered node must reacquire current permissions/fence rather than inheriting execution authority from an old capsule.

## 18. Prototype phases
0 passive journal; 1 capsule/state proposals; 2 recommendation-only reasoning; 3 approved sandbox actions; 4 logical coordinator/model migration; 5 cross-provider and long-duration resilience. Progression is evidence-gated; the architecture does not require reaching the later phases to be useful.

## 19. Retained bifurcations
Local-first vs cloud-first node; one preferred coordinator vs replaceable model pool; event sourcing vs snapshot-first storage; automatic action vs recommendation-only. R3H2 fixes continuity semantics, not the final deployment topology.
