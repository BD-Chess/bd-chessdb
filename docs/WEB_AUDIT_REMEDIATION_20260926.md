# Web audit remediation — 26 September 2026

Status: tested repair branch only. No merge, production deployment, paid API call,
mobile signing, release promotion or consent change was performed.

Base inspected: `086516fffd29680b3c1abd29d1ca5f1c9897fb0c` in
`BD-Chess/bd-chessdb`. No `AGENTS.md` exists in that complete Git tree.
Before publication, main advanced to `644a2f5641fefd9958ff16b696d7d9ce1c697b08`.
All repair-target blob guards still matched. The local branch was safely
fast-forwarded to that base and tests rerun, preserving the concurrent status,
ToE and Chess benchmark changes. Those changes are not credited to this repair.

## Changes

- Flip4M CURRENT: stop the delayed storage-script navigation patch from replacing
  correct Pages/case-aware links with hard-coded `/f4m/` URLs. Derive About, LAB
  and Old links from the actual current directory. Search, rules and storage keys
  are unchanged.
- Trip and Flip4M PWAs: return a successful cached allowlisted static resource
  when the network resolves with HTTP 404/500/503, not only when fetch throws.
  Without a valid cached response, retain the real HTTP failure or thrown network
  error. Failed responses are never written to cache. Bump worker cache versions.
  Trip's no-query/API/encrypted-payload-persistence boundary is unchanged.
- Sudoku active LAB and PWA: correctly attribute the reported Phase 1
  `|rho| = 0.853` to `n_guesses` and `|rho| = 0.786` to `LZ_process`, for
  200 puzzles × 5 strategies. Distinguish correlation from causal improvement or
  domain independence; retain all table values. Bump the PWA shell cache version.
  Frozen CURRENT and historical archives are not silently rewritten.
- MDL×DCC map and AC_AA public summaries: align the Sudoku metric with its table,
  distinguish different evidence types, remove the summary's automatic inference
  from compression to non-coincidental truth, and separate the 50-genome benchmark
  from full structural validation. Original model comments, scores and all other
  domain records remain unchanged; their historical status is now explicit.
- Nara: synchronize the I01 illustrated-release description and inventory of seven
  existing images. Correct eight E03 image alt/aria attributes after the continuity
  reviewer's inspection of the four referenced images. No story, image, character
  canon or historical approval changes. Web8 remains unfrozen; E03 S07 image
  replacement/acceptance remains open.

## Freshness correction: Chess PWA already repaired

The source audit predates the base commit's Chess PWA refresh. Its existing release
manifest now identifies the LAB donor and hashes source/output files. Existing
tests verify coherent offline assets, explicit safe update activation, legacy
local-state retention, Sim and integration features. These files were tested and
left byte-for-byte unchanged; this branch does not claim their prior repair.

## Verification

Node 24.19.0; isolated test dependency `jsdom@26.1.0`.

```sh
npm install --no-save --package-lock=false --ignore-scripts jsdom@26.1.0
node --test tests/web-audit-remediation.test.cjs tests/chess-pwa.test.cjs tests/chess-pwa-integration.test.cjs
node --check public/F4M/f4m-store.js
node --check public/F4M/PWA/sw.js
node --check public/Trip/PWA/service-worker.js
node --check public/S/PWA/sw.js
git diff --check
```

The original 22-test regression suite failed 15 tests against the unmodified
sources (HTTP fallback, invalid cached-response handling, overwritten Pages/case
navigation, and Sudoku claim scope). After repair and added copy checks, 31/31
tests passed, including seven existing Chess PWA tests. Navigation is exercised
on `/bd-chessdb/F4M/`, `/F4M/` and `/f4m/` in CURRENT, LAB and PWA. Their selector
links include PREVIOUS; historical PREVIOUS gameplay is not revalidated here.

The continuation review separately passed 224 scoped structural assertions,
including unrelated PLM documentation checks. This is not 224 web behavior tests.
Its Nara source guards are:

| File under `public/Nara/` | Original Git blob |
| --- | --- |
| `illuminara.html` | `8681feb343077dccac0f60631b95382126b88645` |
| `assets/nara-image-manifest.json` | `3409b28e664c078358272997985bdfb5957b3fb4` |
| `episode-03-what-must-be-allowed-to-fall.html` | `89188f025407c0ba581a28534d03931ce7e8a3f9` |

Metric corrections use the existing Phase 1 table and its explicit measurement
definitions, corroborated by the supplied technical monograph v1.4 §43.3.
No raw experiment was rerun and no new scientific result is claimed.

## Remaining acceptance and publication gates

1. Review/merge this branch only when the existing production-release gate permits
   it. GitHub Pages deploys on main pushes. Netlify's automatic production workflow
   is explicitly paused until 1 October 2026; this repair does not resume it.
2. After authorized publication, verify the actual About/Old links on both hosts
   and update an installed PWA. Local VM/DOM tests are not a physical device test.
3. Complete iPhone/Android offline launch, kill/restore, export/share and existing
   consent/deletion acceptance. This requires devices and signing/distribution
   already governed by the native project; do not build another wrapper.
4. Resolve the existing Nara E03 S07 image/canon acceptance, then full Web8 QA.
5. Scientific generalization, causal controller benefit and pedagogical improvement
   still require their existing matched-cost/held-out tests. This branch corrects
   wording; it cannot substitute for new empirical evidence.
