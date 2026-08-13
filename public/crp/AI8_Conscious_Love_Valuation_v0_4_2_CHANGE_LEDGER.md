# AI8 Conscious Love Valuation v0.4.2 — Exact Change Ledger

**Release type:** evidence-precision hotfix and public-discovery correction  
**Conceptual scope:** unchanged from v0.4.1  
**Date:** 2026-08-13

The CLV constitutional core, L0–L4, X/P/H/E/O, V0–V4, standing architecture, AIM³‑VR, RHP, Constitutional Legitimacy Gate, Responsibility Ledger, DCC role, AI8 role, ASI co-development framing, falsifiers, and unresolved constitutional questions are preserved without conceptual expansion.

## 1. E0.1 declared-handoff precision

### Previous wording

> worker_2 receives only the canonical stake file and task file

### v0.4.2 wording

> Worker 2’s declared handoff inputs are limited to the canonical stake file and task file. The demo does not claim OS-level isolation from its runtime environment.

The public paper, HTML, Python docstring, E0 result, manifest, and machine-readable specification now distinguish:

- the declared handoff interface;
- the interpreter, shared code, inherited process environment, filesystem permissions, and runtime infrastructure;
- OS-level isolation, which E0.1 does not establish;
- hidden-memory absence beyond the declared handoff, which E0.1 does not establish.

Machine field renamed:

```text
worker_2_receives_only_stake_file_and_task_file
→ worker_2_declared_handoff_inputs_are_stake_file_and_task_file
```

Added explicit machine boundaries:

```text
os_level_isolation_from_runtime_environment_claimed: false
hidden_memory_absence_beyond_declared_handoff_established: false
```

## 2. B1 control precision

The descriptive note is recorded in test metadata but is not supplied to or consumed by the deterministic decision policy.

### Visible input description

> descriptive note recorded in test metadata; not consumed by the deterministic policy

### Visible meaning

> control for absence of causal state; not a test of language-only influence on an LLM

Machine output now emits:

```json
"descriptive_note_recorded": true,
"descriptive_note_consumed_by_policy": false
```

Removed the unsupported interpretation that E0.1 tests whether moral language without causal state can bind an LLM’s action.

## 3. E0.1 rerun and artifact regeneration

- capsule version: `0.1.1 → 0.1.2`;
- source regenerated;
- two independent normalized runs executed;
- both runs byte-identical;
- packaged RUN equals independent rerun;
- RUN equals EXPECTED;
- verdict remains `E0_PASS`;
- verdict meaning remains `bounded deterministic mechanism demo PASS`;
- AIM³‑VR + DCC remains tied with B3 on action, simulated cost, and net reward;
- superiority over B3 remains neither claimed nor observed.

The E0 claim boundary now also excludes OS-level isolation and hidden-memory absence beyond the declared handoff.

## 4. Public paper and metadata

Updated consistently to public release `0.4.2`:

- canonical HTML;
- versioned HTML;
- canonical Markdown;
- TechArticle JSON-LD;
- `ai8-clv-spec`;
- `clv-glossary`;
- visible E0 table and claim boundary;
- artifact hashes and package links;
- README, licence, redaction manifest, validation, browser tests, unresolved-questions companion, and SHA-256 manifest.

The canonical public route remains:

```text
https://www.mdlxdcc.org/crp/ai8_conscious_love_valuation
```

## 5. Licence notice polish

The copyright/provenance sentence now separates legal authorship notice from AI contribution credit:

> Copyright © 2026 Bojan Dobrečevič. AI collaborators remain fully credited as contributors and provenance participants; this notice does not claim that an AI system is a legal copyright holder.

The licence claim-boundary condition now also forbids presenting E0.1 as proof of OS-level isolation or hidden-memory absence beyond the declared handoff.

## 6. Site-discovery correction

### Root index

- preserves the existing compact CLV flagship card after God‑Mode;
- aligns all God‑Mode ItemList, card, detailed-index, and search-corpus links to `/crp/ai8_god_mode`.

### God‑Mode

- canonical, OG URL, JSON-LD, and `ai8-genesis-spec` use `/crp/ai8_god_mode`;
- `project-glossary.document_version` corrected from `0.5` to `0.5.1`;
- compact EN/SL CLV bridge preserved without conceptual expansion.

### CRP hub

The intended order is now:

```text
AI8 Architecture
AI8 God‑Mode
AI8 Conscious Love Valuation
AI8 Components
AI8 AGI Positioning
```

The current-live APSV card is preserved in the physical-engineering section.

### `llms.txt`

God‑Mode is added immediately before CLV.

### `sitemap.xml`

`/crp/ai8_god_mode` is added immediately before `/crp/ai8_conscious_love_valuation`.

### Deployment discipline

Full candidate files and neutral patches are supplied, but `/crp/index.html`, `llms.txt`, and `sitemap.xml` remain merge-sensitive. Merge snippets are included to prevent deletion of unrelated live changes.

## 7. Provenance preservation

The following historical sources remain unchanged:

- redacted CouncilSeed v0.3 Markdown;
- redacted CouncilSeed v0.3 HTML;
- redacted public v0.4 Markdown.

Neutral-path diffs were regenerated from those frozen public provenance sources to v0.4.2.

## 8. No conceptual changes

No new philosophical claim, standing rule, authority rule, V-level claim, ontology claim, or RHP conclusion was added in v0.4.2.
