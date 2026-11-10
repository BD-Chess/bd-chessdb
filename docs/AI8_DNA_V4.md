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
full opening; the original upper cap retains the first three Top 8 anchors. Labels show the whole section's count of works (points) and the opening number; the
explanation adds the page count when versions share points.
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

## One point per work, readable names, progressive drawing (2026-11-10)

One point stands for one work. Catalogue pages with the same title are versions
or copies of one work and share a point (`groupWorks` in `dna-sections.mjs`);
the first record in catalogue order is the visible one, so curated records and
BD's selection keep their place. A title that is only a file-derived word
("app", "help") is grouped per top folder and shown as `folder · title`.
Versions with different titles stay separate points. Nothing leaves the
catalogue: every version is listed in the point's description, search still
returns every page and opens the point of its work, and the guide counts both
works and pages. TOP 8 and NEW shortcuts are never grouped.

Names are readable at rest: their size follows the window width
(`clamp(.66rem, .56rem + .16vw, .82rem)`) and their resting opacity is `.68`
(about 5:1 on the page background; it was `.33`, about 2.3:1). A wide window
allows longer names (300px from 1300px, 400px from 1900px). Below 600px a name
takes two lines and does not grow when approached; the growth factor is set by
the script (`--near-zoom`) so hit testing and CSS agree.

The strand is drawn as far as the visitor has travelled. Its end thins into fog
above a small dock at the bottom of the window, which holds a one-time caption
(what the page is, how to use it) and the button "Show the whole strand". Moving
down draws further, animated unless reduced motion is set; points and section
labels beyond the drawn part are `hidden`, so they are neither focusable nor
hit-tested. The page is as long as the drawn part plus one window. Search, the
list of parts, arrow keys, focus and the End key draw as far as they need at
once. A reload or a return from a work restores the place (`sessionStorage`,
`history.scrollRestoration = 'manual'`). Geometry is untouched: the canvas only
stops at the drawn length and lowers alpha inside the fog, and the whole strand
has no fog at all. The native display scene (`?mode=ai8-live`) is managed
elsewhere and keeps the whole strand, without the dock or the list of parts.
The AI Lab finds a record's point through the `ai8-dna:locate` event: the
strand answers with the point (the work's point for a version) and draws that far.

From 1200px a list of the ten parts with their counts stands beside the strand:
it shows which parts are drawn, where the visitor is, and jumps to a part. It
sits left of the longest name and fades while a growing name crosses it.

The top bar carries a visible SL/EN switch; the guide keeps its own for the
native display mode, where the bar is hidden. Every strand text follows the
chosen language (the Slovene section names are NOVO and APLIKACIJE); names and
descriptions of works keep the language of the work. The AI Lab panel is a
separate module and is still English only.

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
the progressive drawing (short first view, fog above the dock, drawing on
scroll, list of parts, restored place, versions in a description, SL/EN switch,
whole strand on request), hover/focus/touch, search, navigation, fallback,
reduced motion, enlarged text, phone/tablet/desktop layout and a pixel comparison
of v3 against base `93c097d4`. The older cases first ask for the whole strand.
It uses emulated touch, not physical-device testing. The data, archive and loop-identity tests
also run in the existing Pages and Netlify release workflows.

The zoom test measures actual canvas stroke segments against DOM nuclei and
category centres during real two-contact Chromium touch gestures, explicit
scale 1 → 2 → 1, zoomed pan and document scroll, with asserted nonzero visual
viewport offsets. It also exercises a labeled Safari-coordinate regression
model on Chromium (visual scroll offsets/height and viewport-driven events).
This is not physical iPhone/Safari testing. The canvas raster of the whole strand
(no fog) must match frozen v3 exactly; enlarged text must preserve every nucleus
position.
