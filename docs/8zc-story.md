# 8zC origin and full story

## Scope

BD requested publication of the origin and full story as HTML on 24 November 2026, with links from the encoder and results pages. The public reader edition is at `/8zc-story/`. It is a complete Slovenian narrative with chapter navigation, a chronology, source notes and links back to the codec and results. English navigation on the existing pages labels the story `(SL)`.

This change adds the story, updates those navigation links and registers the page in public site search. It does not change the codec, its WASM binary, benchmark data or deployment procedure.

## Source and editorial provenance

The reader edition synthesizes the archived manuscripts `8zC-BDxAI_full_story.md` (8W), `8zC-BDxAI-LAB_full_story.md` (8H, including its 24 November update), and `8zC-BDxAI_full_story_LLMs.md` (GPT), together with the public origin account and results. The reviewed GPT manuscript has SHA-256 `a77b0859761cb8a6dad0fa85842ab29533d18a7e95a8d012efc61b5ffe0d4b26`.

The current codec milestone comes from `e946504a8cc94281af8e308ac36916a483b9211f`: Cycle 13 R5 (v8), `z8c_core v0.8.0`. Historical results keep their original scope and version; they are not relabelled as v8 measurements.

The page preserves BD's continuing intellectual contributions as well as the AI collaborators' ideas, implementation, counterexamples and verification. It distinguishes dated evidence, retrospective accounts, proposals and measured results. Negative results, the 2024/2025 dating discrepancy, shared decoder costs and limits of generalization remain visible. Private archive locators and operational host paths are not part of the public edition.

## Verification and publication

Use the existing 8zC evidence/browser tests, JavaScript syntax checks, secret-boundary check and public-search checks. Review chapter anchors and links on the rendered page. The existing tested-main GitHub Actions publisher remains the only production path; follow `docs/NETLIFY_DEPLOYMENT.md` and retain its release artifacts. A source commit alone does not establish that the page is live.

Prepublication checks on 24 November passed: all eight existing 8zC tests, all three Start search tests, all four search-freshness tests, the secret boundary, syntax checks for app/worker and both inline story scripts, the new page's search registration, 46 unique IDs and all 44 local fragment links. The story contains 13 chapters and approximately 7,006 words of visible text. This validation is separate from the historical compression measurements described in the article.

## 24 November 2026 — bilingual reader and table layout

Owner requested a full English/Slovenian reader with EN | SL, A− / current percentage (reset to 100%) / A+ in the top-right header, and wider tables on the reader, results and encoder pages. English is a translation of the existing Slovenian text, not a new narrative; chapter IDs, historical numbers, sources and attribution are retained. Language links carry the selected locale; the font preference is local. Tables fill the available content width, with horizontal overflow confined to the table on narrow screens. No benchmark values, WASM binaries or compression algorithms change.
