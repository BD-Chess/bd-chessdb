# AI8 CLV v0.4.1 — Site Integration README

This folder contains the first public-discovery integration for the corrected CLV release.

## Deploy paths

| Package path | Website path | Purpose |
|---|---|---|
| `SITE/index.html` | `/index.html` | Root flagship card, detailed index entry, and ItemList entry |
| `SITE/crp/index.html` | `/crp/index.html` | CLV paper card in the Core Research Papers hub |
| `SITE/crp/AI8_God_Mode.html` | `/crp/AI8_God_Mode.html` | Compact “Improvement according to what?” bridge to CLV |
| `SITE/llms.txt` | `/llms.txt` | Machine-discovery entry |
| `SITE/sitemap.xml` | `/sitemap.xml` | Final lowercase extensionless canonical URL |

The CLV paper and its evidence artifacts are supplied in the separate CRP release package and should be deployed in `/crp/`.

## Canonical public route

`https://www.mdlxdcc.org/crp/ai8_conscious_love_valuation`

The deploy file may remain `AI8_Conscious_Love_Valuation.html` if the server maps or redirects it to the canonical route.

## Merge caution

- `SITE/index.html` was built from the current root `index.html` supplied in the project context.
- `SITE/crp/index.html`, `SITE/llms.txt`, and `SITE/sitemap.xml` were patched from the supplied `BD_web_slim.zip` snapshot.
- If the live server copies of those three files have changed since that snapshot, diff/merge the CLV additions instead of overwriting newer unrelated changes.

## Minimal CLV deployment in `/crp/`

Required:

- `AI8_Conscious_Love_Valuation.html`
- `AI8_Conscious_Love_Valuation_v0_4_1.md`
- `AI8_CLV_E0_Repair_Debt.py`
- `AI8_CLV_E0_Repair_Debt_RUN.json`
- `AI8_CLV_E0_Repair_Debt_EXPECTED.txt`
- `AI8_CLV_E0_Repair_Debt_MANIFEST.json`
- `AI8_Conscious_Love_Valuation_v0_4_1_CRPPackage.zip`
- `AI8_Conscious_Love_Valuation_v0_4_1_LICENSE.md`

Recommended provenance/evidence companions:

- `AI8_Conscious_Love_Valuation_v0_4_1_CHANGE_LEDGER.md`
- `AI8_Conscious_Love_Valuation_v0_4_1_UNRESOLVED_QUESTIONS.md`
- `AI8_Conscious_Love_Valuation_v0_4_1_VALIDATION.json`
- `AI8_Conscious_Love_Valuation_v0_4_1_BROWSER_TESTS.json`
- `AI8_CLV_AIM3_Good_ASI_CouncilSeed_v0_3_REDACTED_PUBLIC.md`
- `AI8_Conscious_Love_Valuation_CouncilSeed_v0_3_REDACTED_PUBLIC.html`
- `AI8_Conscious_Love_Valuation_v0_4_1_REDACTION_MANIFEST.md`
- `AI8_Conscious_Love_Valuation_v0_4_1_SHA256SUMS.txt`

## Deliberately deferred

This release does not yet add candidate bridges to every AI8/AIM³/MDL×DCC page. The first integration is limited to:

- root discovery;
- CRP discovery;
- the compact God-Mode bridge;
- sitemap and LLM discovery.

Broader candidate-interface bridges remain evidence-gated for the next micro-release.
