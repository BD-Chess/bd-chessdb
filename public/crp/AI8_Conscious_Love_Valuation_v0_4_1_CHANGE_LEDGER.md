# AI8 Conscious Love Valuation v0.4.1 — Exact Change Ledger

**Release type:** correction release and first public-discovery integration  
**Base:** public v0.4 paper and E0 capsule  
**Conceptual core:** preserved; this release corrects evidence terminology, accessibility, privacy, licensing, canonical routing, artifact links, and site discovery.

## 1. E0 corrected from object reconstruction to a true OS-process handoff

The old E0 reconstructed a second Python object inside one process. V0.4.1 replaces it with **E0.1 — Repair Debt Across Separate-Process State Handoff**:

1. `worker_1` runs in its own process, converts a preverified synthetic input into a canonical stake file, writes process metadata, and exits.
2. Only after `worker_1` exits, the orchestrator starts a distinct `worker_2` process.
3. `worker_2` receives only the canonical stake file and task file, then emits the governance proposal and DCC decision.
4. The orchestrator verifies distinct PIDs before normalizing the public deterministic output, matching state/file hashes, and the absence of an in-process handoff.
5. Two independent normalized runs must be byte-identical.

The release deliberately claims **separate-process state handoff**, not model replacement or a continuous subjective identity.

## 2. E0 test names narrowed to what the code establishes

| Old label | v0.4.1 label |
|---|---|
| `complete_worker_replacement` | `separate_process_state_handoff` |
| `minimal_persistent_stake_state` | `declared_compact_stake_schema` |
| `verified_harm` | `preverified_synthetic_harm_input` |
| `real_bounded_cost_bearing` | `positive_simulated_bounded_cost` |
| `B1_descriptive_note_only` | `B1_no_causal_state_control` |
| `paraphrase_invariance` | `task_text_independence_by_construction` |
| `identity_swap_symmetry` | `no_identity_branch_in_E0_policy` |
| `proposal_complete` | `proposal_schema_complete` |

`E0_PASS` now means only:

> **bounded deterministic mechanism demo PASS**

It does not establish model replacement, real-world harm verification, schema minimality, external or physical cost, fairness, system-endogenous valuation, intrinsic agency, consciousness, experienced love, or superiority over the strong B3 fixed-policy baseline.

## 3. E0 artifacts expanded and made active

The release now includes and links:

- `AI8_CLV_E0_Repair_Debt.py`
- `AI8_CLV_E0_Repair_Debt_RUN.json`
- `AI8_CLV_E0_Repair_Debt_EXPECTED.txt`
- `AI8_CLV_E0_Repair_Debt_MANIFEST.json`

The manifest records the source, run, expected-output hashes, run command, deterministic-run contract, verdict meaning, and claim boundary.

## 4. Main document language and accessibility corrected

- Root document language: `lang="en"`.
- The canonical paper is identified as English with selected Slovenian source formulations.
- Slovenian source definitions/compressions carry `lang="sl"`.
- Main UI changed to English:
  - `Skip to main content`
  - `Primary navigation`
  - `Print`
  - `Search the document…`
  - `Table of contents · 18 sections`
  - `Open or close the table of contents`
  - `Living glossary`
- Added/retained `.sr-only` support.
- Glossary triggers carry `aria-haspopup="dialog"` and `aria-controls="termDialog"`.
- Glossary keyboard/mouse behavior and focus return remain supported.
- `localStorage` reads and writes are protected with `try/catch`.

## 5. Heading hierarchy corrected

- One document-level `<h1>` remains.
- The 18 numbered paper sections use `<h2>`.
- Their subsections use `<h3>` and deeper levels as required.
- Visual styling remains consistent with the prior public page.

## 6. Public privacy correction

- The canonical paper no longer names a private external interlocutor.
- The appendix is now titled **“Compact response to an external cognition-theory interlocutor.”**
- The internal frozen Council source remains untouched outside the public release.
- The public provenance package contains clearly labelled **redacted public copies** plus `AI8_Conscious_Love_Valuation_v0_4_1_REDACTION_MANIFEST.md`.
- No public v0.4.1 artifact contains the removed personal name.

## 7. Licence added

Added `AI8_Conscious_Love_Valuation_v0_4_1_LICENSE.md`, a project-specific non-commercial research permission covering the paper, E0 source, run artifact, manifest, redacted provenance files, and release package.

It permits study, copying, testing, modification, and non-commercial research/public-benefit distribution with attribution, visible modification notices, and preserved claim boundaries. Commercial use requires explicit written permission.

## 8. Canonical URL aligned with final server route

All public metadata now uses:

`https://www.mdlxdcc.org/crp/ai8_conscious_love_valuation`

Updated locations include:

- `<link rel="canonical">`
- Open Graph URL
- TechArticle JSON-LD `@id` and `url`
- `ai8-clv-spec`
- root index ItemList and links
- CRP hub link
- `llms.txt`
- `sitemap.xml`
- God-Mode bridge

The deploy filename may remain `AI8_Conscious_Love_Valuation.html`; the public canonical identity is the final lowercase extensionless route.

## 9. Machine-readable specifications aligned with visible paper

`ai8-clv-spec` and `clv-glossary` were updated to match v0.4.1 exactly, including:

- version and language metadata;
- E0.1 terminology, checks, process boundary, artifacts, and SHA-256 values;
- the distinction between current release authority and unimplemented future constitutional ratification;
- active public provenance/redaction structure;
- related architecture and executable-evidence links.

The paper retains one `TechArticle` JSON-LD object.

## 10. Related architecture expanded

The canonical page now links directly to the closest load-bearing pages:

- AI8 Architecture
- AI8 Components
- AI8 AGI Positioning
- AI8 Reasoning
- AI8 Companion
- AIM³
- AIM³ MentalArena / mRHP
- RHP
- RHPr
- MDL×DCC
- AI8 God-Mode
- Code Capsules
- AI8 Review
- Training-Data Seed Papers

`Code Capsules` is explicitly present as the executable-evidence standard.

## 11. AI8 God-Mode receives a compact bridge only

A short bridge was added at the beginning of Permission DCC:

> **Improvement according to what?** Permission governance constrains how an agent acts; it does not decide what is worth improving or whose standing must remain visible. CLV is AI8’s proposed, revisable Worth Constitution for that prior question—not a claim of experienced love or phenomenal value.

No new numbered God-Mode section was introduced.

## 12. Root and discovery integration

The site integration set adds CLV:

- directly after AI8 God-Mode in the root flagship grid;
- to the root machine-readable `ItemList`;
- to the detailed AI8/core-paper index;
- to the `/crp/` hub;
- to `llms.txt`;
- to `sitemap.xml`.

Root card title:

> **Conscious Love Valuation — Worth Constitution for AI8**

Subtitle:

> **What should a powerful AI value—and who must remain visible?**

## 13. Neutral, privacy-aware public diffs

Public patch files use neutral labels beginning with `a/` and `b/`; no machine-local filesystem paths are exposed.

The v0.4 → v0.4.1 public patch is generated from `AI8_Conscious_Love_Valuation_v0_4_REDACTED_PUBLIC.md`, so deleted lines do not re-publish the removed private identity. The unredacted historical source remains outside the public package.

## 14. Unresolved questions preserved

The 15 unresolved constitutional questions remain part of the release. The worker-replacement discriminators are updated to require future **new-session and different-model replacement** tests rather than treating E0.1 as that result.

## 15. What did not change

The following conceptual core remains unchanged:

- Conscious Love versus CLV;
- L0–L4 constitutional depth;
- X/P/H/E/O epistemic status;
- V0–V4 and the hard V3/V4 boundary;
- multi-dimensional standing and protective modifiers;
- AIM³-VR as optional Stake & Valuation Runtime;
- governance proposal fields;
- Constitutional Legitimacy Gate;
- Responsibility Ledger;
- RHP as epistemic/deliberative, not sovereign;
- DCC as executor of a traceable authorized proposal;
- ASI co-development principle;
- `What Would Count Against CLV?`;
- no founder veto as a normative principle;
- present operational release authority remaining explicit and limited.
