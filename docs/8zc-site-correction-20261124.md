# 8zC evidence and attribution correction

24 November 2026. Requested by Bojan Dobrečevič (BD); implemented and reviewed by ChatGPT.

## Purpose

The v7 multi-format table contained row values that did not match its frozen result JSON, even though the displayed totals matched that JSON. The browser comparison also substituted an external-codec reference size for the live browser baseline and could associate reference data with a same-name, same-length file whose SHA-256 did not match.

The public attribution reduced BD's role to an early idea. It now records his continuing research ideas, cross-project connections, architecture and RHP contribution, alongside the individual AI contributions and joint development. Planned directions remain distinct from implemented and measured features.

## Changes

- Reconciled all 30 multi-format Dev-15/Holdout-15 rows with the frozen v7 results and checked their sums.
- Corrected sample reference values: DLL 7z 69,406 B; Auto-DCC external ZIP 245 B. Browser measurements stay separate.
- Required exact SHA-256 and size for historical sample matching.
- Used the current browser Deflate measurement for the live baseline, with its ZIP-wrapper estimate explicitly identified.
- Compared restored bytes directly; reported SHA-256 availability and success separately.
- Added bounded regression tests to the existing Pages build, which gates the shared Netlify publisher.

## Evidence

The numeric fixture is a public-field-only projection of:

- `results_cycle13_r4_v7.json`, SHA-256 `0ed33d884b648422f2c91c8c6a0f909d8771ce74a0877f326a201fe078c366b3`.
- `v7_multiformat_rust_vectors.json`, SHA-256 `649dafbfdac7fd024aa0500b8d85c1dbd2d0ad0b524c06e5f5cd967a0398ded4`.
- Original delivery ZIP, SHA-256 `38094ab55058fe982e9d8e07ff35f22421c844d5cfee7a41222de762af5c1979`.

The source files were re-read, and every projected numeric row was compared with the original JSON. Private source paths were excluded.

Attribution was reconciled with the 23 November independent local/Git attribution report, the BD technical matrix and Rust vision, and the RHP source. The named examples are not an exhaustive inventory of BD's ideas. Specific P2-C AI roles remain visible.

## Verification scope

Eight targeted tests pass. The three decisive regressions fail on the original source: replacing the live baseline, matching the wrong file by name and length, and accepting equal-length corrupted output when a digest is unavailable. JavaScript syntax and diff whitespace checks pass.

This change retains v7 / `z8c_core 0.7.0` and the existing WASM binary. It does not claim v8 acceptance or a new 94-archive benchmark. Production status must be checked through the shared publisher receipt and live pages after this commit.
