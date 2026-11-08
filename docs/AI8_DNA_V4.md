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

The strand has nine ordered sections. TOP 8 uses the eight `FEATURED_IDS` as
shortcut display instances of the same project objects. Search and page counts
use the underlying catalogue, never the display instances. Case-distinct pages
and unverified aliases retain the catalogue's existing independent identities.
Search results show paths to distinguish separate pages with the same title.

Each section spans as many half turns as needed, with up to twelve points per
opening. Labels show the whole section's page count and the opening number.
Hover or focus highlights every point and label of that section; touch or click
pins the explanation, a second click or Escape clears it. Text enlargement adds
vertical room. Canvas drawing is viewport bounded, and offscreen nuclei do not
animate. Reduced motion disables animations and transitions.

V3 loads only `assets/ai8-entry/archive-v3/` for its entry scripts, styles,
catalogue and search snapshot. `manifest.json` records source and frozen hashes.
The sole source-byte change inside this copy is the catalogue's index URL,
redirected to the frozen snapshot. V1/v2 source files are untouched.

Validation:

```sh
node --test tests/ai8-dna-v4.test.mjs
# Requires playwright-core and Chromium; accepts CHROMIUM_PATH and DNA_EVIDENCE.
node tests/ai8-dna-v4-browser.mjs
```

The browser test serves local fixtures, blocks external requests and verifies
hover/focus/touch, search, navigation, fallback, reduced motion, enlarged text,
phone/tablet/desktop layout and a pixel comparison of v3 against base `93c097d4`.
It uses emulated touch, not physical-device testing. The four data/archive tests
also run in the existing Pages and Netlify release workflows.
