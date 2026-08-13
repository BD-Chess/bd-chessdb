# AI8 CLV v0.4.2 — Site Integration README

This release corrects the public discovery chain without expanding the conceptual content of CLV or AI8 God‑Mode.

## Canonical routes

```text
https://www.mdlxdcc.org/crp/ai8_god_mode
https://www.mdlxdcc.org/crp/ai8_conscious_love_valuation
```

The physical deploy filenames may remain:

```text
/crp/AI8_God_Mode.html
/crp/AI8_Conscious_Love_Valuation.html
```

provided the server resolves them to the lowercase extensionless canonical routes.

## Full-file deployments

The corrected site-integration package contains two narrow full-file updates that can be deployed after a normal diff check:

| Package path | Deploy path | Change |
|---|---|---|
| `SITE/index.html` | `/index.html` | God‑Mode route normalization; existing God‑Mode → CLV flagship order preserved |
| `SITE/crp/AI8_God_Mode.html` | `/crp/AI8_God_Mode.html` | canonical-route normalization and glossary document-version fix; compact CLV bridge preserved |

## Merge-sensitive files

Do **not** blindly overwrite current live copies of:

```text
/crp/index.html
/llms.txt
/sitemap.xml
```

The package provides:

- full candidate merged files for inspection;
- neutral candidate patches;
- small `MERGE_SNIPPETS/` blocks designed for insertion into the current live files.

Before deployment, diff the candidate against the current live file and preserve every unrelated current-live entry.

## Required ordering

### `/crp/index.html`

```text
AI8 Architecture
AI8 God‑Mode
AI8 Conscious Love Valuation
AI8 Components
AI8 AGI Positioning
```

The APSV card already present on the current public CRP hub must remain present.

### `llms.txt`

God‑Mode must occur immediately before CLV in the Core MDL×DCC / AI8 papers section.

### `sitemap.xml`

`/crp/ai8_god_mode` must occur immediately before `/crp/ai8_conscious_love_valuation`.

## CLV release package filename

Upload the public package under this exact filename:

```text
AI8_Conscious_Love_Valuation_v0_4_2_CRPPackage.zip
```

Do not retain local suffixes such as `(1)` or `(3)`, because the canonical HTML links to the exact filename above.

## Required CLV files in `/crp/`

```text
AI8_Conscious_Love_Valuation.html
AI8_Conscious_Love_Valuation_v0_4_2.html
AI8_Conscious_Love_Valuation_v0_4_2.md
AI8_CLV_E0_Repair_Debt.py
AI8_CLV_E0_Repair_Debt_RUN.json
AI8_CLV_E0_Repair_Debt_EXPECTED.txt
AI8_CLV_E0_Repair_Debt_MANIFEST.json
AI8_Conscious_Love_Valuation_v0_4_2_CRPPackage.zip
AI8_Conscious_Love_Valuation_v0_4_2_LICENSE.md
```

Recommended evidence/provenance companions are listed in the release README.
