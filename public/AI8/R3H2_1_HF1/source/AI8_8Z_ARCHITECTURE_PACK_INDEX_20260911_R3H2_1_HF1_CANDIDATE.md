# AI8 / 8Z ARCHITECTURE PACK — R3H2.1 HF1 CANDIDATE
## 2026-09-11 · Tisa fixture-data and release-input closure hotfix

**Parent:** `AI8_8Z_ARCHITECTURE_PACK_20260910_R3H2_1_CANDIDATE_TISA.zip` · SHA3 `4d496a040904a429a51d73909beda61f874fd9c031a563be9ea6e699a5a9471c`  
**Claude mechanical re-check:** `AI8_8Z_R3H2_1_MECHANICAL_RECHECK_20260911_R1_CLAUDE_FABLE_5_1_MAX.md` · SHA3 `96e016e6155385867a3944b59528f97f2fe4aadaf8b2d744a6a91aa311178553`

## Terminal status
`RECOMMEND_R3H2_1_HF1_CANDIDATE_FOR_BD_KNOWLEDGE_RELEASE_APPROVAL`

Not canonical. Not deployed. No runtime fixture has been executed. The HTML builder remains paused until a detached non-fixture KnowledgeRelease binds this final package hash, lists exact explanatory inputs, and is explicitly approved by BD.

## Six normative owners
1. `8Z_CONTROL_MASTER_ARCHITECTURE_AND_ROADMAP_20260910_R3H2_1_CANDIDATE.md`
2. `AI8_ARENA_FOUNDRY_SELF_RESEARCH_LOOP_v0_4_1_R3H2_1_CANDIDATE.md`
3. `AI8_CONTINUITY_NODE_PERSISTENT_AGENT_ARCHITECTURE_v0_4_1_R3H2_1_CANDIDATE.md`
4. `BD_AI8_PREAGI_SELF_IMPROVING_RESEARCH_SYSTEM_v0_4_1_R3H2_1_CANDIDATE.md`
5. `AI8_REASONING_FOUNDRY_AND_ATLAS_v0_3_1_R3H2_1_CANDIDATE.md`
6. `AI8_MODEL_RESOURCE_CONTROL_v0_3_1_R3H2_1_CANDIDATE.md`

## Shared normative artifact
`AI8_8Z_SCHEMA_REGISTRY_R3H2_1.json` · owner `8Z_CONTROL` · registry `AI8_8Z_SCHEMA_REGISTRY_R3H2_1@1.2` · SHA3 `de1f1633acda2c9e409282017e6d8a335ad34607f2d2088957cdc816a6bb2915`. It is not a seventh owner.

## HF1 repairs
- one verified R6 baseline hash across constitution, relation and candidate: `63d4d64b960f0765a62ac82329b923ff0aa5d0a85a40dabd71aa79eb539d0725`;
- one verified HF3 release-receipt hash: `08bf29ec5a77d1df1ce52df1bca6b05c319f6c43e870e8de4f9bf6ddd82d617e`;
- one-file/one-hash validator assertion across golden records;
- KnowledgeRelease explanatory inputs are exact pack-member refs with byte-recomputed hashes;
- real detached releases can express `BOUND_AFTER_PACKAGE_CLOSE`; fixture releases remain `TO_BE_BOUND_AFTER_PACKAGE_CLOSE`;
- six owner meanings unchanged; only generated registry/schema binding lines changed.

## Acceptance/support members
- `AI8_8Z_R3H2_1_HF1_GOLDEN_RECORDS_AND_STAGE_A_FIXTURES.json`
- `AI8_8Z_R3H2_1_HF1_REPAIR_CARD_LEDGER_20260911.md`
- `AI8_8Z_R3H2_1_HF1_OPEN_REGISTER_20260911.md`
- `AI8_8Z_R3H2_1_EXTERNAL_SOURCE_RESOLVER_20260910.json`
- `AI8_8Z_R3H2_1_HF1_BRANCH_AND_SOURCE_MANIFEST_20260911.json`
- `AI8_8Z_R3H2_1_HF1_MECHANICAL_VERIFICATION_20260911.json`
- `validate_r3h2_1_hf1_pack.py`
- `SHA3SUMS.txt`

## First slice
`Sudoku R6 frozen program 63d4d64b960f… → Foundry → Continuity → Control → KnowledgeRelease → HTML`

Success still means plumbing fixtures pass. It does **not** mean Sudoku score improvement, Stage-A runtime completion, canonical AI8 promotion, or proof that AI8 works.
