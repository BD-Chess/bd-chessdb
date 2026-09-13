# Trip LAB16 — 2026-09-13

Published channel: /trip/new/. CURRENT /trip/ and PREVIOUS /trip/old/ retain their behavior. All three selectors use CURRENT · LAB · PREVIOUS. No archive files are changed.

- Brute Force remains manual, accepts 2–16 stops including START, enumerates (n−1)! directed orders, and keeps the best route on cancellation. 16 stops = 1,307,674,368,000 orders. The numerical live counter remains exact below Number.MAX_SAFE_INTEGER.
- Direct Line now consistently uses Haversine/great-circle surface distances (mean Earth radius 6,371,008.8 m). All local solvers in that selected mode use this metric. Road mode still uses directed road distances.
- Exactly one additional comparison row, Our Optimize (Deep · Air), independently searches great-circle costs. It does not change the map route, is not compared with a road optimum, and is not an additional Brute Force run. It starts after the main timed calculation; input changes invalidate it.
- Mobile order: editor, calculation controls, map, comparison, detailed enumeration progress, route details/library. Mini progress beside Run Brute Force uses the same reported counters.
- Demo is an in-page LAB tab at /trip/new/#demo. EU14 and EU15 results are historical screenshots from BD's Drive. EU15 Deep 4ms/9801.35km, BF57min/9801.35km; Fast10177.43km. Rounded timer readings and benchmark limits are disclosed. Presets reproduce city names, not original coordinate or road-table bytes.
- Site shared SL/EN preference is reused. LAB chat uses Google Search; English geographic questions can use Google Maps + Search via stateless Interactions requests. An older model fallback uses Search only and reports that mode. CURRENT/PREVIOUS request contracts and configured search setting remain unchanged.
- Project-wide usage/spend caps stop fallback. A new key/model is not represented as a quota guarantee. Sources immediately follow generated output; Maps citations retain Google Maps attribution.

Sources checked 2026-09-13:
- https://ai.google.dev/gemini-api/docs/maps-grounding
- https://ai.google.dev/gemini-api/docs/migrate-to-interactions
- https://ai.google.dev/api/interactions-api
- https://science.nasa.gov/universe/overview/

Source baseline: GitHub main 1c961013b08c3f0345008bde0e88538f723d367d; Trip assets matched Drive package BD_TRIP_VERSIONING_ece3267.zip. Original Drive Mobile Screenshots folder: 1bD0-4ousXgiYaRODYKNdf__Tzatpsnwe.

Validation: node --test tests/*.test.mjs. Additional responsive inspection: public/Trip/new/research/responsive-check.html?width=393 (and width=852). Full enumeration of 16 stops is intentionally not run as a test; small cases are checked against an independent exact oracle, and 16-stop progress/cancel are tested.
