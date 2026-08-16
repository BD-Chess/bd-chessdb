# README FIRST — AI8 v2 R2 provenance sync

This archive contains a directory named `AI8_v2/`.

For website deployment, copy the **contents** of `AI8_v2/` into the deployed `/AI8/` directory. Do not deploy it as `/AI8_v2/` unless that is intentionally your route.

Current Preparation / Genesis execution source:

- package: `AI8_ArenaLoop_D_RRP_TEAM_GENESIS_v0_4_1_EXECUTION_HARDENED_R2.zip`
- SHA3-256: `a0f3137a526c6e71bcd6c994f1b5fc894c20720ce9bed6f8c8e0a6db6592d6b9`
- status: execution-hardened R2, experimental, NOT_RUN
- architecture impact: none; frozen ArenaLoop v0.2.2 remains byte-identical

Before deployment:

1. verify every line in `SHA3SUMS.txt`;
2. validate `arenaloop_public_status.json` against `arenaloop_public_status.schema.json`;
3. confirm the new append-only R1 and R2 release entries in `arenaloop_releases.json`;
4. confirm that no current canonical file still points to the pre-R2 execution package.

This is a provenance and execution-source sync, not a claim promotion.
