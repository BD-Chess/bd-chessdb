# AI8 Public R3H Knowledge Architecture — 2026-09-10 R1

Status: deployed-public-layer build specification and verification note.

## Governing outcome

Keep `/ai8/` as the single canonical AI8 home. Add `/ai8/r3h` as a candidate-system sub-hub with six stable module routes and public source Markdown. Preserve frozen ArenaLoop semantics, Preparation/Genesis experimental status, and existing 8zShield/MAL behavior by not modifying their implementation files.

## Representation comparison

| Candidate | Result | Reason |
|---|---|---|
| WEB-A mega page | PARK | Low URL count, but weak scanability, provenance boundaries and update locality. |
| WEB-B second root-like AI8 home | REJECT | Hard regression: duplicates canonical authority. |
| WEB-C canonical `/ai8/` + `/ai8/r3h` + modular pages + open sources | **SELECT** | Best balance of one authority root, crawlability, stable URLs, provenance, mobile progressive disclosure and MDL/update cost. |

`Rank, don't eliminate` is preserved: WEB-A remains a possible future compressed export; WEB-B is rejected for this public topology because it creates a competing root.

## Public knowledge contract

`Evidence / Truth → Governed Knowledge → Presentation`

The website is a presentation surface. It must not use deployed page text as self-authenticating evidence. R3H claims point upstream to the exact source documents and SHA3 bindings in `r3h_public_manifest.json`.

## Six public owners

1. 8Z Control — committed operational state and shared contracts.
2. Arena Foundry — research workflow and Mission Guard.
3. Continuity Node — time/event coordination and durable functional continuity.
4. BD-AI8 — bounded objective, valuation and promotion policy.
5. Reasoning Foundry & Atlas — reasoning artifact lifecycle and evidence.
6. Model Resource Control — model/provider/resource semantics, budgets and routing receipts.

Only 8Z Control owns the committed operational world. Other registries are typed artifact/resource registries, not competing project state.

## BD acceleration amendment

The public layer states that BD is currently a high-leverage trajectory accelerator through seeds, cross-domain bridges, reframing, mission correction, value judgments and exception authority. BD-AI8 treats repeatable intervention classes as candidates for explicit, tested system-level operators/guards/policies. It does **not** claim completed internalization, model-weight learning, autonomous mission rewriting or replacement of human surprise/value input.

## Image contract

- Source quick-scan pair: `BD-AI8_L1.jpeg` / `BD-AI8_D1.jpeg`; published as optimized 1100px-wide WebP derivatives.
- Source detail pair: `BD-AI8_L2.jpeg` / `BD-AI8_D2.jpeg`; published as optimized 1100px-wide WebP derivatives.
- Theme selection uses `prefers-color-scheme`; HTML restates all load-bearing meaning.
- Source hashes: {"BD-AI8_L2.jpeg": "a5d2f22f02e4f86ae6872c31b663b96f62255d2e2360c17a6549a64cc99b16f9", "BD-AI8_D1.jpeg": "df11008b8c152ad071cd5a6f264ee7bbab9bce833c83131661086170030750bd", "BD-AI8_D2.jpeg": "4614f3ae2efa52b916ffd5b43026e1cf95c2130db3c16f4479378b9d2489eda6", "BD-AI8_L1.jpeg": "4d6ab9acb7e17b3c904ed8082548854b961c040ee6f1fffdbd068443bc9df836"}

## Source availability note

The governing R3 public-build prompt and R1 predecessor prompt were available. The R3 prompt named an R2 public-build prompt and a separate R3H2 synthesis/BD-acceleration amendment as mandatory inputs, but those two exact files were not present in the accessible Project Files or repository at build time. Their explicit R3-amended requirements were therefore followed from the governing R3 prompt itself; no missing text was invented.

## Non-regression contract

The build does not modify `AI8_ArenaLoop.html`, `AI8_ArenaLoop.md`, `AI8_Preparation_Genesis.html`, `index-todo.html`, 8zShield cryptography, MAL functions/secrets, or Netlify environment variables. Existing sitemap contents are preserved byte-identically as a legacy child sitemap while the root becomes a standards-valid sitemap index containing both legacy and R3H sitemaps.

Web derivatives are transport optimizations only. The source-JPEG SHA3 values remain provenance-bound in `r3h_public_manifest.json`.
