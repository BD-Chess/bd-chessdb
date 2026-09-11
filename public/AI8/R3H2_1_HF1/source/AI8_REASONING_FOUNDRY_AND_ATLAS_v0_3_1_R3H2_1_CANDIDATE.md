# AI8 REASONING FOUNDRY & ATLAS
## v0.3 R3H2.1 CANDIDATE · Discover, operationalize, select, transfer and preserve ways of thinking

**Status:** `CANDIDATE / NO MODEL-WEIGHT LEARNING CLAIM`  
**Owner:** `REASONING_FOUNDRY_ATLAS`  
**Shared registry:** `AI8_8Z_SCHEMA_REGISTRY_R3H2_1@1.2` · `AI8_8Z_SCHEMA_REGISTRY_R3H2_1.json` · SHA3 `de1f1633acda2c9e409282017e6d8a335ad34607f2d2088957cdc816a6bb2915`
**Schema bindings:** `ai8.reasoning-operator.v2@2.0` · `ai8.callable-operator-contract.v1@1.0` · `ai8.reasoning-episode.v2@2.0` · `ai8.composition.v2@2.0` · `ai8.trajectory-slice.v1@1.0` · `ai8.substrate-migration-receipt.v2@2.0` · `ai8.memory-transition-receipt.v1@1.0` · `bd-ai8.mechanism-rent.v2@2.0`

## 0. Mission
Build a versioned, failure-aware repertoire of reasoning operators whose procedures, triggers, evidence, costs, transfer limits and interactions can be tested. A stored prompt is not automatically a capability improvement.

## 1. Operator versus selector versus repertoire
Always distinguish:
- **operator efficacy** — does procedure A help when forced?
- **selector quality** — does the routing/trigger mechanism choose well?
- **repertoire availability** — was the useful operator present?
- **interaction** — does composition help or interfere?
- **substrate effect** — does the result survive the execution model/provider/adapter class?

Credit is never assigned to “Reasoning Atlas” as a whole when only one layer changed.

## 2. CallableOperatorContract
Use `ai8.reasoning-operator.v2` plus `ai8.callable-operator-contract.v1`. A reasoning operator may be a protocol, prompt structure, code procedure or hybrid. A deterministic wrapper does not make a stochastic model response deterministic. Each adapter states effect class, dependencies, input/output contract, fixtures, budget/stop rules and partial-failure semantics.

## 3. Evidence ladder
L0 specification fidelity → L1 within-domain differential → L2 held-out differential → L3 trigger/selection → L4 cross-domain adaptation → L5 composition/interference → L6 longitudinal reuse → L7 total cost/complexity.

One success is bounded evidence, not universal reasoning superiority.

## 4. Substrate-conditioned evidence
Every operator result binds the execution substrate. MRC computes compatibility from a frozen pre-migration mapping table over provider/surface/model class/adapter version; the migrating agent cannot self-classify.

- exact substrate: evidence unchanged;
- compatible class: evidence downgrades one step and enters probationary sample recheck;
- material change or unknown compatibility: `NEEDS_REVALIDATION`.

Risk is registry-derived, never operator self-declared. LOW-risk compatible operators may remain active with probation, default k=3 recheck. HIGH-risk operators (irreversible effect, permission impact, claim-promotion authority, or cost above MRC threshold) become `PROBATIONARY_ON_NEW_SUBSTRATE`, execution restricted to sandbox/read-only, default k=5 including prior failure cases. No high-impact effects until recheck passes.

## 5. Strong uncued target test
For uncued selection/transfer:
1. freeze problem-signature extractor before operator trigger features;
2. extractor never receives Atlas content;
3. rerun selection with names/descriptions/family labels replaced by opaque ids;
4. include a plausible decoy operator with no evidence;
5. declare substrate.

A material lexical-firewall rank change downgrades the result to explicit-cue replay. Decoy selection records description reliance and blocks a positive uncued label.

## 6. Atlas residency
Three owner-local residency states: Active Atlas, Dormant Archive, Quarantine. Dormant preserves useful/uncertain history without active retrieval cost. Injection-class contamination enters Quarantine by default and cannot be retrieved by ordinary dormant search. Promotion/eviction/compaction requires transition receipts and cannot erase provenance/failure envelopes.

## 7. Composition and negative transfer
Test A, B, A→B and B→A where interfaces are compatible. A failed composition down-ranks the composition, not automatically both atomic operators. Record negative transfer and known failure envelopes explicitly. Composition itself has a version, budget and Mechanism Rent.

## 8. Causal lesson and intervention reuse
Reasoning does not restate causal-use arms; it references `8z.causal-use-experiment.v1`. Reflections and incident summaries can propose tests/operators. A probationary reflection buffer emits **TEST_PROPOSAL only**; it cannot directly change consumer warnings, rankings or actions. If a warning later proves useful, promote it through the normal operator gate.

## 9. External comparators
External mechanisms enter as comparator/operator candidates with source refs, implementation fidelity and cost. Convergent rediscovery is preserved separately from contaminated import. External citations do not prove an AI8 operator works.

## 10. Mechanism Rent and bloat
Each active/probationary operator or composition has one Mechanism Rent ref. Retrieval quality, context bytes, selection latency, maintenance/test burden and negative-transfer risk all count. Preserve dormant evidence more cheaply than keeping everything active.

## 11. Reasoning Playground
PLAY can generate unusual representations and cross-domain transfers, but every candidate must eventually face a cheap discriminating test. The purpose is to expand search space without allowing novelty language to bypass evidence.

## 12. First slice
The first end-to-end R3H2 slice may use one explicitly scoped reasoning operator only if Sudoku R6 needs it. Otherwise Reasoning remains `DORMANT` for the slice; the plumbing must not activate unnecessary sophistication merely to demonstrate architecture breadth.

## 13. Promotion boundary
Promote only when reproducible specification, held-out differential, selector/repertoire attribution, substrate status, cost and failure-envelope evidence justify it. Model-weight learning is never inferred from external-memory persistence.

## 14. Reasoning Coverage Matrix
Maintain coverage by problem class × operator × selector × repertoire × substrate. The matrix is evidence indexing, not a universal score. It should make missing cells and negative transfer visible and help choose the next cheap discriminating test.

## 15. Writeback and lineage
Reasoning writeback is append-only at the evidence layer. A new operator version references its parent and changed procedure. Promotion changes residency/funding scope; it does not overwrite prior evidence. A failed composition or migrated substrate creates a new scoped result rather than editing history.

## 16. Public/private boundary
Public reasoning pages may expose operator purpose, bounded procedure, evidence level, known failure envelope and non-sensitive citations. Private traces, hidden fixtures, sensitive prompts, credentials and protected project details remain outside the public projection. Public prose never substitutes for operator evidence records.

## 17. Proving grounds
RF-G0: RHP/operator-family fidelity.  
RF-G1: multi-view/multi-scale/compression reasoning.  
RF-G2: Mission Guard reasoning.  
RF-G3: uncued selector/transfer with lexical firewall/decoy/substrate controls.  
RF-G4: composition/interference.

## 18. Acceptance gates
Ownership clear; schema/reference valid; novelty boundary honest; procedure reproducible enough for its execution mode; held-out differential measured; transfer scoped; retrieval test resistant to description leakage; composition interference measured; writeback append-only; integration with Foundry/BD-AI8/MRC/Continuity/Control explicit. Failure of one gate limits the claim rather than being averaged away.
