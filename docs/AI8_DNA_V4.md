# AI8 DNA v4

Current navigation and the current featured catalogue enter `/ai8-dna-v4.html`
(Netlify also serves `/ai8-dna-v4`). The explicit v1 `/ai8-dna.html`, v2 and v3
addresses remain available. The home page's other sections are unchanged.

`dna-sections.mjs` assigns every public catalogue record a primary category and
preserves its original groups, kind, descriptions, URL, ID and related IDs.
Curated IDs have reviewed assignments; wider entries use their actual title and
path, with unmatched material placed in LAB. Generic generated descriptions are
not used to infer acronym meanings. Secondary subject matches are retained.
Research variants can have LAB as their primary home while retaining a secondary
subject. No classification changes a page's research status or protection.

The strand has ten ordered sections. TOP 8 uses the eight `FEATURED_IDS` as
shortcut display instances of the same project objects. Search and page counts
use the underlying catalogue, never the display instances. Case-distinct pages
and unverified aliases retain the catalogue's existing independent identities.
Search results show paths to distinguish separate pages with the same title.
Destination deduplication runs again after the current DNA URL mapping. The v4
`.html` and clean URL share one destination; the curated record and ID win when
the public index includes that destination. Case, fragments and other paths are
retained.

NEW is the second labeled ellipse, immediately after TOP 8. Its up to eight shortcuts
reuse existing catalogue records and keep their subject homes. The editorial
selection in `dna-new-points.mjs` currently contains two recent highlights: the
Nov 8 DNA update and Bogastvo obstoja. The latter has one canonical shared catalogue
record, also used in its consciousness subject home. Nov 6 is explicitly its
Start feature date, verified by public commit `b951225e`; it is not an inferred
essay publication date. The DNA date comes from the published Lab digest.
These are not file modification times or an automatic current-news feed. Unavailable
records are omitted from the fallback. Canonical IDs and normalized destinations
exclude the current TOP 8 and duplicate NEW shortcuts. Normalization reuses verified
catalogue aliases, retains path case, and ignores query strings, fragments and a
final slash only for this shortcut comparison. Search and related-page navigation
continue to open the original subject instance.

Each section spans as many half turns as needed, with up to eight points per
full opening; the original upper cap retains the first three Top 8 anchors. Labels show the whole section's page count and the opening number.
Hover or focus highlights only that physical opening, its label, its strand
segment and the points on it. Touch or click pins that opening; clicking another
opening switches directly, while a second click on the same one or Escape clears it.
Stable category-local loop IDs survive full catalogue expansion and resize; reused
node buttons receive their current physical membership on every render. The
three-point top cap is separate from the five-point full TOP 8 opening; its
section counter and all eight shortcut entries remain unchanged. Larger central titles
keep the desktop `.56rem` and mobile `.5rem` count lines small. Long explanations
sit above or below the same physical ellipse, beyond its start or end boundary,
so its highlighted project labels remain clear. The note flips when a viewport
edge is tight, and scrolls within the available vertical space. A fully offscreen
ellipse, or a viewport with less than 32px outside either edge, hides its note
until space returns; the pinned selection is retained.
The compact CFH title also applies below 1100px, so enlarged text stays clear
of the nuclei in the narrower native/tablet openings; its full name remains in
the accessible label and description. Font sizes and helix geometry are unchanged.
Text enlargement changes text without moving anchors or changing the helix pitch.

The curve uses the original v3 amplitude, 460px full turn and `.62` opening phase,
including its broad upper cap. An absolute canvas tile occupies only the visible
document rectangle (`visualViewport.pageLeft/pageTop/width/height`). Its raster
transform uses that same document origin as the DOM nodes and category labels,
and updates on visual viewport resize/scroll as well as ordinary scrolling.
Pinch zoom remains native and unrestricted. Offscreen nuclei do not animate. Reduced motion disables animations and transitions.

V3 loads only `assets/ai8-entry/archive-v3/` for its entry scripts, styles,
catalogue and search snapshot. `manifest.json` records source and frozen hashes.
The sole source-byte change inside this copy is the catalogue's index URL,
redirected to the frozen snapshot. V1/v2 source files are untouched.

Validation:

```sh
node --test tests/ai8-dna-v4.test.mjs
# Requires playwright-core and Chromium; accepts CHROMIUM_PATH and DNA_EVIDENCE.
node tests/ai8-dna-v4-browser.mjs
# Local-loop membership, canvas alpha and late-catalogue regression.
node tests/ai8-dna-loop-browser.mjs
node tests/ai8-dna-new-tooltip-browser.mjs
node tests/ai8-dna-v4-zoom-browser.mjs
```

The browser test serves local fixtures, blocks external requests and verifies
hover/focus/touch, search, navigation, fallback, reduced motion, enlarged text,
phone/tablet/desktop layout and a pixel comparison of v3 against base `93c097d4`.
It uses emulated touch, not physical-device testing. The data, archive and loop-identity tests
also run in the existing Pages and Netlify release workflows.

The zoom test measures actual canvas stroke segments against DOM nuclei and
category centres during real two-contact Chromium touch gestures, explicit
scale 1 → 2 → 1, zoomed pan and document scroll, with asserted nonzero visual
viewport offsets. It also exercises a labeled Safari-coordinate regression
model on Chromium (visual scroll offsets/height and viewport-driven events).
This is not physical iPhone/Safari testing. The initial canvas raster must match
frozen v3 exactly; enlarged text must preserve every nucleus position.
