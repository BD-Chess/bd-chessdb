# 8Z CONTROL — MASTER ARCHITECTURE & ROADMAP
## R3H2.1 CANDIDATE · Truth, evidence, publication, shared contracts and operational state

**Status:** `CANDIDATE / NOT CANONICAL / NOT DEPLOYED`  
**Owner:** `8Z_CONTROL`  
**Shared registry:** `AI8_8Z_SCHEMA_REGISTRY_R3H2_1@1.2` · `AI8_8Z_SCHEMA_REGISTRY_R3H2_1.json` · SHA3 `de1f1633acda2c9e409282017e6d8a335ad34607f2d2088957cdc816a6bb2915`
**Schema bindings:** `8z.event.v2@2.0` · `8z.claim.v2@2.0` · `8z.relation.v2@2.0` · `8z.causal-use-experiment.v1@1.0` · `8z.publication.v2@2.0` · `8z.sink.v1@1.0` · `8z.knowledge-release.v1@1.1` · `8z.evidence.v2@2.0` · `8z.state-change-proposal.v2@2.0` · `8z.permission.v2@2.0` · `8z.action-result.v2@2.0` · `8z.decision.v2@2.0` · `8z.incident-lesson.v2@2.0`

## 0. Core decision
8Z Control owns the committed operational world and the shared schema artifact. It does not own research semantics, reasoning procedures, model routing, or human valuation. There must be one authoritative state transition history and many read-only projections.

**Direction invariant:** `Evidence / Truth → Knowledge → Presentation`. A website claim, page view, email unlock or rendered summary can trigger review; it cannot authenticate itself as evidence.

## 1. Six-owner boundary
- **Control:** truth state, shared schemas, claims, publication, references, decisions, permissions, action results.
- **Foundry:** research constitution, Mission Guard, candidate lineage, proving campaigns, external comparator fairness.
- **Continuity:** durable capsule, event delivery, replay, leases, recovery and wake policy.
- **BD-AI8:** improvement valuation, Human Acceleration, Mechanism Rent policy and BD escalation.
- **Reasoning:** operator bodies, selectors, Atlas residency, transfer/composition evidence.
- **MRC:** provider/surface/model/resource truth, budgets, routing, call receipts and substrate compatibility.

ArenaLoop is an **implementation comparator/executor** of Foundry gate execution where present. It owns no competing gate semantics.

## 2. Shared schema single source
`AI8_8Z_SCHEMA_REGISTRY_R3H2_1.json` is a shared normative schema artifact owned by Control. Shared enum values, field names, null/unknown semantics and versions are written only there. Owner documents reference `schema_id@major.minor` and the registry hash.

Owner documents may contain generated views only when headed with `generated_from`, `registry_hash`, and `NON_NORMATIVE`. Pack validation must regenerate and diff them. R3H2 contains no manually maintained generated enum views.

Registry precedence is narrow: the registry governs names/values/absence semantics; owner documents govern **when and why** a value is emitted.

## 3. State, evidence and reducer
Operational state is reconstructed from accepted events and immutable evidence references, not from UI text. Event identity and semantic identity remain separate: primary dedup uses `(producer_id, logical_event_key)`; a secondary bounded index over `(producer_id, semantic_payload_hash)` may mark `SUSPECTED_DUPLICATE` after producer key-state loss. Material suspected duplicates are held for sequence reconciliation rather than auto-merged.

Evidence reduction uses explicit sort keys `(authority_class, directness, source_revision, occurred_at, ingested_at)`. `UNKNOWN` and stale/absent evidence never upgrade a state. A correction is append-only: earlier claims remain in lineage with supersession links.

## 4. Relations and dependency invalidation
Use `8z.relation.v2` as one relation substrate. Two primary views are rendered from it:
1. candidate genealogy;
2. evidential dependency/revalidation graph.

`INSPIRED_BY` records exposure, not proof dependence. Withdrawal of a `REQUIRES_RESULT` ancestor marks dependent support `NEEDS_REVALIDATION` unless independent support exists. Contradiction edges may form general graphs; derivation/dependency subgraphs must remain acyclic by version/time policy.

## 5. Effect safety and sink contract
Every external effect passes a permission envelope, a current fencing check at dispatch, idempotency handling and an `8z.sink.v1` classification. For `GATEWAY_ENFORCED` sinks, 8Z Agent is a non-normative execution gateway that serializes per sink, validates current fence at dispatch and owns the idempotency table.

A sink with no fencing and irreversible effects is `HOLD`/BD-only. A sink with no readback can close `UNKNOWN_EFFECT` only by explicit reconciliation or BD decision; timers never refund uncertain effects.

## 6. Rollback is a forward revision
Rollback restores content/configuration into a new revision. The rollback revision's action, permission, reservation and liability ledgers are the **union** of revisions from last-known-good through the reverted head. Newer revocations, settled spend and unresolved liabilities cannot be resurrected or erased by restoring old content.

## 7. Publication and Morning Delta
Publication uses `8z.publication.v2`. `publisher_epoch` is the lease epoch of the writer; `fencing_generation` is the fence checked at sink dispatch. `current_fence` comes from committed lease/fence state, while `previous_successful_source_revision` comes from the accepted publication baseline. A successful public baseline advance requires all of:
- readback pass;
- `fencing_generation == current_fence`;
- `source_state_revision > previous_successful_source_revision`.

A stale publisher that readbacks its own older output is recorded as `STALE_PUBLISH_DETECTED`; it does not move the baseline. Morning Delta compares the last successful fenced/monotonic published state against the new successful publication, never adjacent commits.

## 8. KnowledgeRelease — public claim authority
Control produces KnowledgeRelease candidates. `8z.knowledge-release.v1` is the sole authority for the **public claim set, claim status and status transitions**. A release binds the final architecture-pack hash after package close; the pack never contains the release hash. The presentation builder may read only hashes listed in `explanatory_inputs[]` for faithful explanation, design, routing and assets. It may not infer, promote, demote or add a public claim/status outside the release allowlist.

Every build receipt must list input hashes consumed. A rendered status outside `claim_status_map`, or a claim id outside the allowlist, fails the build. This is the architecture-consolidation gate that prevents HTML from becoming an upstream architect.

## 9. Donor intake and circular support
Any donor admitted to an architecture pack gets a provenance scan against self-domains and public-site citations. If its support for a load-bearing claim resolves only to AI8/MDL×DCC public prose, mark `CIRCULAR_SUPPORT`; it may remain as a discussion artifact but cannot strengthen the claim it copied.

## 10. Policy version activation
Wake, reducer, router and selector updates pass a `PolicyReplayDiffGate`: replay a frozen recent history under `DETERMINISTIC_RECOMPUTE` plus `RECORDED_NONDETERMINISM`; classify each decision delta as intended, bug or nondeterminism. Unclassified divergence means `HOLD`.

## 11. Core invariants
1. One committed operational world; many projections.
2. Shared vocabulary has one normative registry.
3. `UNKNOWN` never means pass.
4. Every effect is permissioned, fenced and receipt-aware.
5. Rollback never restores revoked authority or spent money.
6. Publication baseline is monotonic and fenced.
7. Presentation cannot authenticate Truth.
8. Historical negative/rejected/superseded records remain recoverable.
9. ArenaLoop does not own separate gate semantics.
10. A lesson or public correction is not learned until causal downstream use is demonstrated through the shared causal-use contract.

## 12. First end-to-end implementation slice
R3H2 names **Sudoku R6** as the first bounded end-to-end slice because it offers deterministic correctness/scoring and cheap replayable fixtures.

Target path:
`Sudoku R6 frozen baseline → one Foundry generation → one Continuity capsule → Control state revision → one KnowledgeRelease → one HTML/public-safe page build receipt`.

During this first slice, mechanisms not required by this path default to `DORMANT` funding state for implementation purposes. They remain preserved in the architecture and can be reactivated by an improvement proposal. This applies Mechanism Rent to R3H2 itself.

## 13. Acceptance boundary
R3H2 is ready for Stage-A conformance only when the registry validates, golden records parse, publication/rollback/replay-diff/suspected-duplicate fixtures exist, and the mechanical pack validator passes. It is **not** evidence that the runtime works, that external mechanisms help, or that a public HTML build is authorized.

## 14. Public/private/operator projections
Public output is an allowlisted projection, not redaction of a richer blob. Private/operator views may contain machine paths, local compute allocation, internal notes and protected evidence references, but still cannot override Truth. Public `KnowledgeRelease` records must never expose credentials, secret routes, private evidence bytes or security-sensitive control details.

The operational UI may cache presentation state such as collapsed panels, language/theme or search filters. Such UI state is never canonical arena state.

## 15. Source-scope and freshness
Every source adapter declares scope and freshness. Project-chat summaries, RunPulse telemetry, checkpoint files and BD decisions are distinguishable evidence classes. Staleness means “not freshly observed”, not “stopped”. Absence of a process proof can justify `UNKNOWN`/standby handling, not an invented transition.

## 16. Security and authority non-goals
Control does not grant models new authority because they are stronger, more confident or more expensive. Text from a model is always a proposal until a permission/policy path authorizes it. External donor documents, websites and model outputs are untrusted content for evidence purposes until provenance and scope are classified.

## 17. Stage roadmap
**Stage A:** schema registry, golden records and deterministic reducer/publication/rollback fixtures.  
**Stage B:** read-only local telemetry and event journal.  
**Stage C:** recommendation-only Continuity/Foundry integration.  
**Stage D:** approved sandbox effects through sink gateway.  
**Stage E:** bounded public KnowledgeRelease build after BD/Claude architecture approval.  
**Stage F:** broader multi-machine/model-resource operation only after earlier gates pass.

## 18. Bifurcation pairs retained
- one consolidated state database vs typed registries over one commit log;
- Git-backed state vs local transactional store;
- strict single writer vs transactionally fenced multi-writer.

R3H2 does not erase these alternatives. First implementation may choose the simplest form that satisfies the invariants; later evidence may reopen the storage representation without changing ownership semantics.
