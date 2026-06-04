MDLxDCC.org site architecture bundle — v4
Generated: 2026-06-04
Build marker: mdlxdcc-index-v4-web-slim-pix-art-organization

Upload/overlay these files at the website root.

Included:
- index.html — rebuilt root discovery page with practical demos first, static crawler links, classic collapsible index, visual mindmap, and structured map.
- Art/index.html — new dark-theme responsive gallery page referencing the 26 expected Art images by relative filename.
- crp/index.html — refreshed Core Research Papers hub with PiX promoted as a key CRP page.
- crp/PiX.html — sanitized canonical PiX copy from the provided PiX.html.
- bd/index.html — lightweight lowercase /bd/ alias that forwards to the existing BD/index.html hub.
- sitemap.xml, llms.txt, llms-full.txt — updated crawler/LLM maps with Art and PiX placement.
- site_inventory.csv and site_inventory.json — crawled profile of HTML pages from Web-slim.zip.
- site_organization_audit.json — organization model, exclusions, and quality checks.

Not included / intentionally untouched:
- No audio files.
- No Lichess-API.txt or chess token/API logic.
- No private/protected/vault-looking pages promoted into the visible root index.
- /i.html is not modified; copy index.html to i.html manually only if you still want that mirror.

Important Art note:
The separate Art.txt file and actual 26 image binaries were not present in this runtime or in Web-slim.zip. The gallery was created from the filename list in index_prompt.txt. Before deploying, ensure these files exist in /Art/ next to Art/index.html:
- Bled1.jpg
- Bled2.jpg
- CFH-Brains.png
- CloudyCanyon.jpg
- CloudyCountryside.jpg
- CloudyMountain.jpg
- CloudyRiver.jpg
- Creation1.jpg
- Creation2.jpg
- Creation3.jpg
- DreamyTree1.jpg
- DreamyTree2.jpg
- DreamyTree3.jpg
- DreamyTree4.jpg
- Sailing1.jpg
- Sailing2.jpg
- RainyWoman.jpg
- SunnyForest.jpg
- SunnyRock.jpg
- SunsetMist.jpg
- SunsetRainbow.jpg
- SunsetRainbowD.jpg
- eLandscape1.jpg
- eLandscape2.jpg
- Uni1.jpg
- Uni2.jpg


v4.1 fix:
- Restored top search/filter controls from the earlier root-page pattern.
- Added EN/SL language toggle, with English as the default and Slovenian UI/intro/section text available by click.
- Added expand/collapse/clear controls in the sticky top bar.


V4.2 update — BD Idea Atlas + MAT/Hydrofoils
- Root index reframed as BD Idea Atlas while preserving Trip-first demos, search/filter, EN/SL, classic collapsible index, and maps.
- Added flagship cards, maturity labels, and a top physical engineering pillar.
- Added /crp/Maglev_Assisted_Takeoff.html and /crp/Modular_Hydrofoils.html as canonical CRP physical pages.
- Rebuilt /bd/index.html as a real lowercase BD portfolio hub instead of a redirect.
- Updated /crp/index.html, sitemap.xml, llms.txt, and llms-full.txt.
