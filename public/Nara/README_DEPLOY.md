# Nara web release v1.0

Deploy the contents of this folder to the website directory:

```text
/nara/
```

The public pages are:

```text
/nara/index.html
/nara/episode-01-ordinary-light.html
/nara/sl/index.html
/nara/sl/episode-01-ordinary-light.html
```

Keep the `assets/` folder beside them. The pages use shared CSS and JavaScript, canonical SVG illustrations, social-sharing PNG images, mobile-first text sizing, A−/A+/Reset controls, and a reading-progress bar on Episode 01.

The `source/` folder contains the English canon/origin document, the English Episode 01 Markdown source, and the Slovenian Episode 01 translation. The `archive/` folder preserves the old station-story prototype and earlier concept art; it does not need to be uploaded publicly. `build_site.py` regenerates all four public HTML pages from the current sources.

## Main changes from v0.3

- Removed placeholder and `noindex` status.
- Rebuilt the hub around Nara Okafor as a person, not just a power mechanism.
- Replaced the old station story with the canonical *Kumul Dawn* ferry origin.
- Added separate English and Slovenian routes with direct language switching.
- Added Nara’s wound, human world, moral laws, power progression, Episode 01 feature, and optional mechanics section.
- Replaced noncanonical portraits with original canonical visual direction: dark brown skin, close-cropped hair, faded blue jacket, ordinary harbour light, and subtle gold light beneath injury.
- Added canonical URLs, `hreflang`, Open Graph metadata, JSON-LD, print styling, reduced-motion support, accessible navigation, and responsive large text on phones.

Canonical URL:

```text
https://www.MDLxDCC.org/nara/
```
