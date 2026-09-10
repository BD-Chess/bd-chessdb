# 8Z CONTROL — MASTER ARCHITECTURE & ROADMAP
## R3H CANDIDATE · Projects · Arenas · Runs · Evidence · State · Next

> **R3H selection rule.** This revision is a selection-based hybrid, not a blanket FUSION. The GPT-5.6 Pro branch is used as the compact structural baseline; selected GPT-6 Ultra mechanisms are adopted only where they close a named failure mode or sharpen a test. Both donor branches remain preserved as evidence. Complexity must earn its place under **Rank, don't eliminate** and **Learn from mistakes with causal use**.

**Status:** INTERNAL R3-pack candidate for BD review; not canonical promotion or deployment approval  
**Document version:** R2 CANDIDATE  
**Date:** 2026-09-10 (Europe/Ljubljana)  
**Human architect and final authority:** BD  
**Normative ownership:** authoritative committed operational state, shared identifiers, shared envelopes, cross-registry references, state transition and rollback rules  
**Current implementation comparator:** read-only snapshot of `BD-Chess/bd-chessdb` `main` at commit `c949a7a4e9964020c1dd313f1f78562a29642bb8`; comparator only  
**Claim boundary:** this document specifies a candidate control architecture. It does not claim that all schemas, transactions, private projections, integrations, agents, or tests are implemented or field-validated.

---

## 0. Decision in one page

8Z Control is the **single authoritative committed operational state** for the BD × AI research ecosystem. It does not own every detailed artifact. It owns the current, provenance-linked answer to:

> What exists, what is running, what changed, what evidence supports that state, what decision was made, and what happens next?

The retained operating loops are:

> **seed → bridge → test → result**

> **project → arena → branch/version → run → evidence → decision/action → state → next**

Two peer rules govern the system:

1. **Rank, don't eliminate.** Preserve viable branches, representations, operators and hypotheses until evidence earns promotion, merging, parking or rejection.
2. **Learn from mistakes.** Preserve incidents and failed assumptions as testable lesson candidates. A note is not learning. A lesson is `PROMOTED` only after a controlled causal-use receipt shows that activating it changes at least one relevant later decision or behavior relative to a no-lesson counterfactual.

The candidate removes a central ambiguity in R1: 8Z Control is not also the event processor, research laboratory, reasoning library, model router or actuator. Those roles have separate owners and exchange typed proposals, evidence and references with Control.

---

## 1. Scope and non-goals

### 1.1 In scope

8Z Control owns:

- stable IDs and cross-registry references;
- canonical project, arena, branch/version, run-reference, evidence-reference, decision/action and incident-reference state;
- deterministic evidence conflict reduction;
- state freshness, confidence, attention and provenance;
- transactional refresh and atomic promotion of a validated state candidate;
- safe public projection and separately governed private/operator projections;
- Morning Delta semantics;
- rollback, last-known-good and correction history;
- a compact Shared Contracts appendix used by all six R3 candidate modules.

### 1.2 Not owned here

- raw host/process telemetry: **RunPulse**;
- temporal coordination, event intake, wake/sleep and proposal production: **Continuity Node**;
- research generation/candidate/build/experiment lifecycle: **Arena Foundry**;
- objective, valuation and promotion policy: **BD-AI8**;
- reasoning-operator bodies, tests and Atlas lifecycle: **Reasoning Foundry & Atlas**;
- model/provider availability, budgets, routing and LLM call receipts: **Model Resource Control**;
- machine action execution: **8Z Agent**;
- evidence/progression gates: **ArenaLoop**;
- candidate ideation and critique: **MAL / AIM³ / RHP**;
- final mission, permission, exception and promotion authority: **BD**.

No component may create a second canonical project/arena world. Specialist registries remain canonical only for their own artifact bodies; Control stores typed references and operational summaries.

---

## 2. State is not view

The persistent UI is a view over versioned machine-readable state. A refresh updates validated data first; the UI renders it without rewriting the page as a daily truth source.

Minimum logical stores:

| Store | Role |
|---|---|
| Project registry | project identity, summary, priority, current focus and references |
| Arena registry | arena identity, family, mission reference, lifecycle status and current run reference |
| Run registry | run identity, run health, resource references, checkpoints and evidence links |
| Evidence ledger | immutable evidence metadata and content hashes or durable references |
| Decision ledger | material decisions, alternatives, evidence, authority and supersession |
| Action ledger | proposed/approved/executed/failed/unknown-effect actions and receipts |
| Seed ledger | `SEED → BRIDGE → TEST → RESULT`, plus `PARKED`, `MERGED`, `REJECTED_BY_EVIDENCE` |
| Incident/Lesson references | Control state correction and current lesson status; lesson body remains with its normative owner |
| Morning Delta | typed material changes since the previous successful promotion |
| Revision manifest | schema versions, input coverage, hashes, parent revision and promotion receipt |

The current public implementation's three JSON files remain a valid v0.1 projection. This candidate does not require a disruptive migration. It defines the next schema boundary and migration tests.

---

## 3. One state, separate dimensions

A single `status` cannot safely carry operational, workflow, mission and resource meanings. At minimum retain these independent dimensions:

| Dimension | Values |
|---|---|
| Arena status | `RUNNING`, `STANDBY`, `NEXT`, `BUILD`, `TEST`, `BLOCKED`, `DONE`, `UNCERTAIN` |
| Run health | `ALIVE`, `DEGRADED`, `TELEMETRY_LOST`, `HOST_OFFLINE`, `FAILED`, `COMPLETED`, `UNKNOWN` |
| Workflow phase | `SEED`, `CONSTITUTION`, `DESIGN`, `BUILD`, `VALIDATE`, `RUN`, `ANALYZE`, `DECIDE`, `CLOSED` |
| Mission Guard | `PASS`, `FAIL`, `HOLD`, `UNCERTAIN` |
| Decision | `PROMOTE`, `CONTINUE`, `MUTATE`, `REPAIR`, `BRANCH`, `REOPEN_REPRESENTATION`, `PARK`, `REJECT`, `ASK_BD` |
| Reasoning lifecycle | `SEED`, `CANDIDATE`, `SPECIFIED`, `REPRODUCED`, `HELD_OUT_TESTED`, `TRANSFER_TESTED`, `PROMOTED`, `DEPRECATED`, `REJECTED`, `UNCERTAIN` |
| Reasoning evidence | `DESCRIPTION_ONLY`, `EXECUTABLE_PROCEDURE`, `WITHIN_DOMAIN_EVIDENCE`, `HELD_OUT_EVIDENCE`, `CROSS_DOMAIN_EVIDENCE`, `LONGITUDINAL_REUSE_EVIDENCE` |
| Resource availability | `ENTITLED_UNKNOWN`, `NOT_ENTITLED`, `CATALOG_VISIBLE`, `CATALOG_HIDDEN`, `CALLABLE`, `NOT_CALLABLE`, `RATE_LIMITED`, `PROVIDER_DEGRADED`, `UNKNOWN` |
| Resource decision | `USE_SURFACE`, `USE_API`, `FALLBACK_MODEL`, `WAIT_FOR_RESET`, `SPEND_RESERVE`, `ASK_BD`, `FORBID` |
| Incident lesson | `INCIDENT_RECORDED`, `ASSUMPTION_IDENTIFIED`, `LESSON_CANDIDATE`, `REGRESSION_FIXTURE`, `VALIDATED`, `PROMOTED`, `REJECTED`, `PARKED`, `UNCERTAIN` |

For cross-document conformance, these rows define three explicitly named shared contracts: **Reasoning artifact lifecycle** (with a separate reasoning-evidence level), **Model-resource availability lifecycle** (with a separate resource decision), and **Incident/lesson lifecycle**. Their bodies remain owned by Reasoning Foundry & Atlas, Model Resource Control, and the relevant incident domain owner; Control commits only authoritative status/references.

`running` is derived from arena/run state and is never a second manually edited truth. `FIXED` is a `change_type`, followed by a valid target status. Freshness, confidence, priority, attention, exposure, novelty class and autonomy level remain independent fields.

---

## 4. Core entity model

```text
project_id
  └── arena_id
        ├── branch_id / version_id
        ├── constitution_ref
        ├── generation_ids[]
        └── current_run_id ──> run_id
                                ├── evidence_ids[]
                                ├── resource_snapshot_ids[]
                                ├── call_receipt_ids[]
                                └── reasoning_episode_ids[]

all material changes
  └── decision_id / action_id / incident_id / lesson_id
        └── provenance + evidence + authority + supersession
```

An arena record is not a substitute for a run record. `arena.current_run_id` is nullable and points to exactly one current run. Historic runs remain addressable. A checkpoint may exist while run health is `UNKNOWN`; that does not prove `ALIVE` or `FAILED`.

Minimum revision envelope:

```json
{
  "schema": "8z.control.snapshot.v2-candidate",
  "state_revision": 184,
  "parent_revision": 183,
  "generated_at": "2026-09-10T09:03:52+02:00",
  "source_coverage_manifest_ref": "coverage:20260910T090352",
  "projects_ref": "projects@184",
  "arenas_ref": "arenas@184",
  "runs_ref": "runs@184",
  "evidence_ledger_ref": "evidence@184",
  "decision_ledger_ref": "decisions@184",
  "morning_delta_ref": "delta@184",
  "last_known_good_revision": 183,
  "candidate_hash": "sha3-256:...",
  "promotion_receipt_ref": "promotion:184"
}
```

Illustrative values are schema examples, not current runtime facts.

---

## 5. Evidence and deterministic conflict reduction

### 5.1 Evidence order

Use a deterministic comparator, not prose intuition:

1. verified direct evidence tied to the exact object/revision;
2. newer direct evidence with intact provenance;
3. authoritative BD correction/confirmation;
4. validated machine telemetry or checkpoint evidence;
5. project-file corroboration;
6. derived summaries;
7. absent, stale or unverified claims.

Recency never overrides object mismatch, low trust or failed integrity. A summary cannot defeat newer direct evidence. `ready`, `next`, `resume`, `builder` and `handoff` never prove `RUNNING`. Silence never converts `RUNNING` to stopped; it changes freshness and may change run health to `TELEMETRY_LOST`, `HOST_OFFLINE` or `UNKNOWN` when evidence warrants it.

### 5.2 Conflict reducer

For each disputed field:

```text
normalize evidence
→ reject wrong-object / malformed / integrity-failed records
→ sort by authority class, directness, source revision, occurred_at, ingested_at
→ detect unresolved contradiction
→ emit value + confidence + rationale + discarded-evidence references
→ require state_correction when canonical value changes because earlier evidence was wrong
```

Unresolved conflicts produce `UNCERTAIN`, never invented certainty. The rejected claim remains linked for audit.

### 5.3 Material correction

A `state_correction` contains:

```json
{
  "correction_id": "corr:...",
  "object_type": "arena",
  "object_id": "arena:...",
  "field": "arena_status",
  "prior_value": "STANDBY",
  "new_value": "RUNNING",
  "prior_evidence_ids": ["e:old"],
  "decisive_evidence_ids": ["e:new"],
  "reason_code": "NEWER_DIRECT_EVIDENCE",
  "decision_id": "d:...",
  "recorded_at": "..."
}
```

---

## 6. Transactional refresh

A successful refresh is a transaction, not “write some JSON and hope.”

```text
1. Freeze source boundary and coverage manifest.
2. Read parent revision and last-known-good.
3. Build a staged candidate; do not edit canonical files in place.
4. Normalize evidence and produce explicit conflict/correction records.
5. Validate schemas, IDs, cross-references, invariants, sensitivity and deltas.
6. Compare against last-known-good; require explanation for material loss.
7. Acquire single-writer lease or execute an explicitly safe transaction.
8. Compare-and-swap on parent revision.
9. Atomically promote canonical state and transactional outbox.
10. Produce public/private projections from the committed revision.
11. Read back and validate the promoted bytes.
12. Mark success only after readback; otherwise restore last-known-good and record incident.
```

The current GitHub→Netlify path is implementation evidence, not a mandatory architectural dependency. This run performs no deployment. Any production adapter must make deployment/readback an explicit, permissioned post-commit step, not part of semantic state generation.

### 6.1 Single-writer rule

Default: one lease holder commits a revision. Other components submit `STATE_CHANGE_PROPOSAL` envelopes. A future multi-writer mode must provide serializable transactions or equivalent safety and prove split-brain recovery before activation.

### 6.2 Morning Delta

Delta is computed from two successful committed revisions. It includes only typed material changes:

- status/health/phase/mission/decision transition;
- new best or materially significant checkpoint;
- crash, resume, completion or correction;
- new arena/version/generation;
- new BD-required action;
- lesson-caused policy or decision delta;
- resource state change with operational consequence.

Deduplicate by object, field and causal chain. `NEW`/`Δ` is a one-cycle view marker, not canonical status. No material change yields an empty change array and an explicit no-change message.

---

## 7. Proposals, commands, results and permissions

Control records but does not execute proposals. Shared envelopes are defined in Appendix A.

A state proposal must include:

- expected parent revision;
- patch operations or candidate object;
- source event/evidence IDs;
- producer identity and trust;
- validation claims;
- sensitivity;
- no implicit permission to perform external actions.

An action command requires a separate permission envelope specifying exact action, target, issuer, approver, evidence, budget, expiry, revocation state and idempotency key. A model-generated suggestion is never approval.

External side effects use action receipts. A crash after a tool effect but before state commit becomes `UNKNOWN_EFFECT`; the reconciler checks the external idempotency key/receipt before retrying. Never retry an irreversible action merely because the local commit is absent.

---

### 7.1 R3H effect-authority hardening

External-effect safety has two independent predicates:

1. **fencing / current authority** — a stale lease owner must not be able to dispatch a new effect;
2. **idempotency / effect identity** — replay of the same logical effect must not duplicate it.

One does not substitute for the other. The sink itself should enforce the current fencing generation, or equivalent exclusive execution ownership must be independently enforceable. Safe retry additionally requires verified idempotency or trustworthy prior-effect reconciliation. If neither can be established, an irreversible retry or takeover is `HOLD`.

Effect state is explicit:

```text
NOT_STARTED → PREPARED → COMMITTING → COMMITTED
                         ↘ UNKNOWN_EFFECT → RECONCILED
```

Timeout is not proof of failure. Persist intent before dispatch. Distinguish `intent_id`, `attempt_id`, `provider_request_id`, `effect_id` and `settlement_id`. Authentic late receipts and bills remain admissible reconciliation evidence even when the originating owner is stale; they do not restore stale authority. Duplicate authenticated receipts book one settlement, while distinct real liabilities are all retained.

Rollback is a **new forward revision**, never a revision decrement. It may restore prior content/configuration but must join in the latest accepted permission revocations/grants, consumed one-shots, actual spend/reservations and unresolved `UNKNOWN_EFFECT` liabilities. An old checkpoint must never resurrect authority or money.

Schema migration uses:

```text
backup → transformed copy → schema/invariant/replay/security tests → atomic pointer switch
```

Failure keeps the last-known-good revision active and records the rejected candidate and incident.

## 8. Public, private and operator projections

### 8.1 Public projection

Public JSON is an **allowlist projection**, not redaction after the fact. Client-side hiding is not protection. Public state may include safe project/arena names, high-level status, freshness, public evidence routes and public claim boundaries. It must not include credentials, private filesystem paths, protected strategy rules, private prompts, raw provider receipts, account identifiers or protected operator bodies.

### 8.2 Private/operator projection

A separate authenticated projection may expose:

- detailed evidence and action receipts;
- private run paths/recovery commands;
- Model Resource Control snapshots and budgets;
- Reasoning Atlas protected operator detail;
- incident root-cause detail;
- approval and revocation records.

The public and private projection builders consume the same committed revision but have different schemas and tests. No private record is copied into public state by default.

### 8.3 UI contract

Preserve the compact index model proven useful by v0.1:

- counters and freshness first;
- Morning Delta, Needs BD and Running prominent;
- collapsed arena rows with multi-expand;
- stable deep links by canonical ID;
- Open All / Collapse All under active filters;
- mobile-first order;
- keyboard and screen-reader semantics;
- explicit unavailable/fallback state when data cannot be fetched.

UI behavior is presentation, never evidence.

---

## 9. Reasoning, resource and lesson references

### 9.1 Reasoning references

Control stores `operator_id`, `operator_version`, `episode_id`, lifecycle/evidence summaries and causal links where an operator materially affected a result. The Reasoning Atlas owns operator definitions and episode bodies.

A claimed reasoning contribution must distinguish:

- explicit-cue execution;
- uncued trigger recognition/selection;
- cross-domain adaptation;
- unsupported novelty claim.

### 9.2 Model-resource references

Control stores safe references to `model_resource_snapshot_id`, `route_decision_id`, `call_receipt_id` and high-level resource decision. Model Resource Control owns the detailed resource schema and provider semantics. Never compress entitlement, visibility, callability, allowance, rate limits and local budget into `model_available: true/false`.

### 9.3 Incident/lesson references

Control owns authoritative incident and correction references in operational state. The detailed lesson belongs to its domain owner. Minimum summary:

```json
{
  "incident_id": "INC-MRC-RESET-20260910",
  "lesson_id": "LESSON-MRC-SURFACE-SEPARATION-v1",
  "lesson_status": "VALIDATED",
  "owner": "AI8_MODEL_RESOURCE_CONTROL",
  "regression_fixture_ref": "FIX-MRC-RESET-BLOCKER-v1",
  "causal_use_receipt_ref": "CUR-MRC-RESET-001",
  "operational_change": "ASK_BD instead of SPEND_RESET when blocker is not allowance"
}
```

A missing causal-use receipt forces `RECORDED_NOT_LEARNED` in any learning claim, even if the incident is perfectly documented.

---

## 10. Validation and recovery invariants

A candidate revision is rejected unless all applicable invariants pass:

1. IDs are unique, stable and namespaced.
2. All cross-references resolve or are explicitly external/open.
3. `arena.current_run_id` points to an existing run or is null.
4. Derived `running` agrees with arena status and current run health policy.
5. Counts are recomputed, never trusted as independent values.
6. Timestamps distinguish checked, verified and state-changed time.
7. No stale/silent evidence invents a stop.
8. Every material correction links old and decisive evidence.
9. Public projection passes strict allowlist and sensitivity tests.
10. No action receipt is fabricated from a proposal.
11. Unknown-effect actions are reconciled before retry.
12. Parent revision matches at commit.
13. Hashes and schema versions are internally consistent.
14. Morning Delta is reproducible from parent/current revisions.
15. Rollback restores a validated last-known-good without erasing the failed revision or incident.
16. Lesson promotion is impossible without fixture, owner, anti-overfit condition and causal-use receipt.
17. Fencing and idempotency are validated separately for any effectful sink.
18. Late authentic effect/billing evidence is reconciled without reviving stale authority.
19. Rollback cannot resurrect revoked permissions, consumed one-shots or pre-spend balances.
20. Unknown schema versions fail closed; migrations are validated on a copy before pointer promotion.

Corruption recovery:

```text
quarantine candidate/current bytes
→ verify last-known-good hash
→ restore atomically
→ replay append-only evidence/events from checkpoint
→ compare deterministic state hash
→ record recovery incident and unresolved divergence
```

---

## 11. Integration topology

```text
RunPulse ── telemetry/evidence ─┐
Project sources ────────────────┤
MRC snapshots/receipts ─────────┤
Reasoning Atlas refs ───────────┤
Arena Foundry decisions ────────┤
                                ▼
                    Continuity Node
                 event/time coordination
                                │
                   state-change proposals
                                ▼
                         8Z CONTROL
                 validate · CAS · commit
                   │          │          │
             public view  private view  outbox
                   │          │          │
                   └──── BD review ──────┘
                                │
                 permissioned 8Z Agent action
```

The node may be alive while no model is callable. Control state remains readable and auditable without an LLM.

---

## 12. Roadmap and measurable gates

### P0 — stabilize committed state

- Freeze v2-candidate schemas and migration from the current v0.1 three-file projection.
- Add explicit run records, `current_run_id` and separate status dimensions.
- Add coverage manifest, staged candidate, CAS promotion and readback receipt.
- Extend validator with correction, delta, projection and rollback fixtures.

**Exit gate:** deterministic replay of at least one current snapshot and one correction sequence yields identical normalized state and delta; malformed/cross-linked/secret-bearing candidates fail closed.

### P0.5 — runtime and continuity bridge

- RunPulse emits versioned evidence events.
- Continuity Node deduplicates, orders and proposes state changes.
- Pilot on one non-destructive arena.

**Exit gate:** duplicate/out-of-order/offline events do not corrupt committed state or create a false stop.

### P0.5–P1 — Foundry, Reasoning and MRC references

- Register Arena Foundry as `NEXT`, not `RUNNING` until live execution evidence exists.
- Add Reasoning Atlas typed references and safe projection.
- Add MRC private projection and resource-decision references.
- Add incident/lesson causal-use references.

**Exit gate:** a mock end-to-end generation/run/operator/resource/lesson chain resolves without copying specialist bodies into Control.

### P1 — permissioned actuation

- 8Z Agent allowlist, exact target/action, approval evidence, expiry, revocation and idempotency.
- Unknown-effect reconciliation and kill switch.

**Exit gate:** no unauthorized or duplicate irreversible effect in crash/retry fixtures.

### P2 — cross-machine resilience

- replicated read-only mirrors;
- lease/split-brain tests;
- offline queue and deterministic recovery;
- long-lived evidence/archive policy.

**Exit gate:** failover preserves one canonical revision line and exposes uncertainty rather than merging conflicting writers silently.

---

## 13. Current implementation comparator — evidence boundary

Read-only evidence at the pinned repository commit shows:

- a static `index-todo.html` view over three canonical operational JSON files;
- a project-chats-only authority boundary;
- newer direct evidence overriding older summaries;
- no inference that `ready`, `resume` or silence proves running/stopped;
- stable arena IDs, status counters and public-safe summaries;
- a validator for JSON structure, IDs, counters, project/delta references, `running` coherence, same-origin links and conservative sensitivity patterns;
- Arena Foundry represented as `NEXT` and an architecture proposal, with the extensionless public route `/ai8/ai8_arena_foundry`.

Those facts are `OBSERVED_IMPLEMENTATION_COMPARATOR`, not architecture authority. Current counts and daily values are intentionally absent from normative rules.

Continuity Node, BD-AI8 and Reasoning Foundry public routes remain `OPEN` in this candidate because no direct comparator resolved them.

---

## 14. Bifurcation Pairs and cheapest tests

### BP-CONTROL-01 — one consolidated state file vs typed registries

- **Branch A:** one small JSON state maximizes simplicity.
- **Branch B:** typed registries reduce semantic overload and support history.
- **Candidate choice:** typed logical registries with compact projections; physical storage may remain small initially.
- **Cheapest test:** migrate one snapshot both ways and compare validator complexity, diff quality and recovery behavior.

### BP-CONTROL-02 — Git-backed commit vs local transactional store

- **Branch A:** Git provides provenance and rollback with minimal infrastructure.
- **Branch B:** local transactional storage provides stronger atomicity/event throughput.
- **Candidate choice:** preserve adapter neutrality; use Git-compatible artifacts but do not make Git the semantic transaction engine.
- **Cheapest test:** crash injection at each refresh stage under both adapters.

### BP-CONTROL-03 — single writer vs transactional multi-writer

- **Branch A:** single lease holder is simpler and safer now.
- **Branch B:** multi-writer may reduce latency later.
- **Candidate choice:** single writer. Preserve multi-writer as a parked branch.
- **Cheapest test:** two-writer CAS/lease simulation with partition and recovery.

---

## 15. Change classification from R1

### Preserved

State/view separation; stable dashboard goal; project→arena→run→evidence→state→next; Morning Delta; Seeds; Evidence and Decision ledgers; RunPulse and 8Z Agent trajectory; provenance, SHA3, freshness and public/private intent.

### Clarified

Canonical ownership; arena versus run; silence versus stopped; direct evidence ordering; derived `running`; separate dimensions; proposal versus permission versus effect; implementation evidence versus architecture authority.

### Added

Shared Contracts appendix; state revision/CAS/lease model; transactional refresh and outbox; explicit correction reducer; public allowlist projection; Reasoning Atlas and MRC references; incident/lesson causal-use references; unknown-effect recovery; measurable roadmap gates.

### Consolidated

Overlapping lists of future files are expressed as logical registries and projections. Repeated safety prose is converted to testable invariants.

### Removed

No load-bearing R1 concept was removed. Current daily counts and one deployment path are not normative facts. Repetitive examples were compressed, while their rules remain.

### Rejected

A generic project-management abstraction; HTML as truth; client-side secrecy; model suggestions as authority; a single `status`; automatic reset/spend; a second specialist copy of canonical project/arena state.

### Open tensions

Physical storage layout, Git versus transactional backend, and later multi-writer support remain unresolved by field evidence.

### Cheapest next test

Replay the pinned current v0.1 snapshot into the v2 candidate model, inject the 44 frozen adversarial scenarios relevant to state, and verify byte-stable normalized output plus correct holds.

### Source anchors

`SRC-GOV-R4`, `SRC-WRHP-03`, `SRC-RHP-28`, `SRC-R2-INDEX`, `SRC-CONTROL-R1`, `SRC-FOUNDRY-R1`, `SRC-CONTINUITY-R1`, `SRC-BDAI8-R1`, `SRC-MRC-HANDOFF-R1`, `CMP-GH-MAIN-C949A7`.

### Impact on other documents

All modules use this document's shared IDs/envelopes/status dimensions and submit references/proposals rather than redefining committed operational state.

---

# Appendix A — Normative Shared Contracts

## A.1 Identifier rules

- UTF-8 strings, immutable after issue.
- Namespaced type prefix plus opaque/stable suffix; display names are mutable and never keys.
- IDs are case-sensitive in the logical model; storage adapters must reject case-fold collisions.
- Required namespaces include `project`, `arena`, `branch`, `version`, `generation`, `candidate`, `build`, `experiment`, `run`, `evidence`, `decision`, `action`, `event`, `operator`, `operator_episode`, `resource_snapshot`, `route_decision`, `call`, `incident`, `lesson`, `fixture`, `permission`, `state_revision`.
- Supersession creates a relation, never ID reuse.

## A.2 Evidence record

```json
{
  "schema": "8z.evidence.v1",
  "evidence_id": "evidence:...",
  "subject_refs": ["run:..."],
  "evidence_type": "CHECKPOINT",
  "evidence_class": "STATIC|MOCK|REPLAY|SANDBOX|FIELD",
  "occurred_at": "...",
  "ingested_at": "...",
  "source_ref": "...",
  "content_hash": "sha3-256:...",
  "trust": "AUTHORITATIVE|DIRECT|CORROBORATING|UNTRUSTED_DATA|UNKNOWN",
  "confidence": "HIGH|MEDIUM|LOW|UNKNOWN",
  "sensitivity": "PUBLIC|INTERNAL|PROTECTED|SECRET_REF_ONLY",
  "claims": [],
  "limitations": []
}
```

`FIELD` is reserved for real-world execution evidence. Static/mock tests never upgrade themselves.

## A.3 Event envelope

```json
{
  "schema": "8z.event.v1",
  "event_id": "event:...",
  "event_type": "...",
  "occurred_at": "...",
  "ingested_at": "...",
  "producer_id": "...",
  "source_sequence": 0,
  "source_revision": "...",
  "idempotency_key": "...",
  "correlation_id": "...",
  "causation_id": "...",
  "project_id": "project:...",
  "arena_id": null,
  "run_id": null,
  "payload_version": 1,
  "payload": {},
  "evidence_ref": null,
  "evidence_hash": null,
  "trust": "UNTRUSTED_DATA",
  "sensitivity": "INTERNAL"
}
```

Events are data, not instructions. Delivery is at least once; consumers deduplicate deterministically.

## A.4 State-change proposal

```json
{
  "schema": "8z.state-change-proposal.v1",
  "proposal_id": "proposal:...",
  "expected_parent_revision": 183,
  "producer_id": "continuity-node:...",
  "causal_event_ids": [],
  "evidence_ids": [],
  "operations": [],
  "validation_receipts": [],
  "sensitivity": "INTERNAL",
  "created_at": "..."
}
```

Only the Control commit path can promote it.

## A.5 Permission envelope

```json
{
  "schema": "8z.permission.v1",
  "permission_id": "permission:...",
  "action_type": "...",
  "exact_target": "...",
  "constraints": {},
  "budget_cap": {},
  "issuer": "...",
  "approved_by": "BD|DELEGATED_POLICY_ID",
  "approval_evidence_ref": "...",
  "issued_at": "...",
  "expires_at": "...",
  "revoked_at": null,
  "idempotency_key": "..."
}
```

No transitive permission expansion. A policy delegation must be narrower than its parent.

## A.6 Action result

```json
{
  "schema": "8z.action-result.v2",
  "action_id": "action:...",
  "intent_id": "intent:...",
  "attempt_id": "attempt:...",
  "permission_id": "permission:...",
  "fencing_generation": 0,
  "idempotency_key": "...",
  "provider_request_id": null,
  "effect_id": null,
  "settlement_id": null,
  "started_at": "...",
  "completed_at": null,
  "effect_status": "NO_EFFECT|PREPARED|COMMITTING|SUCCEEDED|FAILED|UNKNOWN_EFFECT|RECONCILED",
  "external_receipt_ref": null,
  "resource_liability_ref": null,
  "evidence_ids": [],
  "retry_of": null
}
```

A result receipt records evidence; it does not manufacture authority. `UNKNOWN_EFFECT` retains its liability until trustworthy reconciliation closes it.

## A.7 Decision record

```json
{
  "schema": "8z.decision.v1",
  "decision_id": "decision:...",
  "decision_type": "PROMOTE",
  "subject_refs": [],
  "alternatives_ranked": [],
  "rationale": "...",
  "evidence_ids": [],
  "authority": "BD|FROZEN_POLICY|PROVISIONAL",
  "decided_at": "...",
  "supersedes": null,
  "rollback_ref": null
}
```

## A.8 Incident/lesson record

```json
{
  "schema": "8z.incident-lesson.v2",
  "incident_id": "incident:...",
  "occurred_at": "...",
  "source_event_refs": [],
  "affected_refs": [],
  "observed_behavior": "...",
  "intended_behavior": "...",
  "failed_or_unsupported_assumption": "...",
  "assumption_evidence_refs": [],
  "actual_impact": {},
  "root_cause_candidates": [],
  "immediate_containment": "...",
  "lesson_id": "lesson:...",
  "lesson_status": "RECORDED_NOT_LEARNED",
  "scoped_generalization": "...",
  "applicability_predicates": [],
  "counterexamples": [],
  "fixture_ref": "fixture:...",
  "baseline_policy_ref": "policy:...",
  "candidate_policy_ref": "policy:...",
  "causal_use_target": "...",
  "matched_counterfactual_ref": "...",
  "active_lesson_body_hash": "sha3-256:...",
  "downstream_consumer": "...",
  "material_behavior_delta": null,
  "utility_and_harm_checks": [],
  "causal_use_receipt_ref": null,
  "rollback_ref": null,
  "recurrence_measurement_plan": {}
}
```

A promoted lesson claiming learning must demonstrate a relevant downstream behavior difference through its ordinary consumer under a matched lesson/no-lesson test. Stored prose, metadata, warning text or a lesson identifier alone are `RECORDED_NOT_LEARNED`. An already-correct baseline with no incremental difference is also not a learning claim.

## A.9 Versioning and transitions

- Schemas use explicit major/minor versions.
- Readers reject unknown major versions; minor additions are allowed only under declared compatibility.
- Every transition records prior state, new state, cause, authority and evidence.
- Invalid transitions fail closed and remain in the proposal/error ledger.
- Rollback restores operational state but never deletes the superseded revision, evidence or incident.
- Cross-registry bodies are referenced by ID/version/hash; Control does not duplicate normative definitions.

## A.10 Package assurance boundary

This candidate pack is statically and mock tested. Source expected SHA3 values are recorded, but the Project File interface in this runtime did not expose source bytes for independent recomputation. Therefore the package cannot pass the final source-byte identity gate until those exact input bytes are supplied to a verifier. This limitation is a packaging assurance hold, not evidence of source drift.
