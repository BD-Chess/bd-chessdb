# Illuminara anatomy correction R34

BD reported a reversed left hand in P01-K05 and an overlong arm in P02-K02, then requested a review of all Illuminara hands, correction, and production publication on GitHub Pages. Netlify publication is explicitly excluded.

All 39 panels were inspected as source crops, portrait illustrations and landscape illustrations (117 views). Six panels received edits: P01-K05, P02-K02, P04-K02, P04-K05, P06-K03 and P07-K01. The other 33 panels retain their existing artwork. Natural perspective and occlusion are not by themselves defects.

The 18 selected reference-image edits use the built-in image_gen tool. Three intermediate outputs were rejected: P01-K05 portrait still attached the corrected hand to the crossing opposite arm; the first P06-K03 landscape and source revisions showed only four readable digits. Their replacements were inspected again. No provider API fallback was used.

New art lives at immutable `content/illuminara/art-r34/` paths, with before/after hashes, full prompts, native-output records, review notes and correction lineage. All older art files remain byte-identical. The P/L PNG outputs keep their native dimensions and bytes. Source crops are WebP derivatives in their original geometry; the generator's white letterbox on the ultra-wide P07-K01 crop is removed before fitting it back into the original panel. Full-page patches are clipped inside the original panel boundaries. EN and SL clean pages and lettered page composites use the unchanged original SVG lettering. All story/dialogue, panel order, hotspots, text IDs and overlay bytes remain unchanged.

The release metadata and sealed 36-asset app shell advance to revision 34 / r4.25. New media paths prevent an old bitmap cache from supplying the replaced artwork. Existing installed copies use the normal save-before-update mechanism.

Local validation: 58 focused tests passed across DFC import/integrity, text layers, text timing, hybrid reader behavior and PWA package/update safety. All 1,259 member files passed byte/dimension checks. Original 289 protected art/overlay/source/page files still match the frozen baseline. Ten EN/SL page composites were visually inspected. Runtime browser/CI/deployment evidence is recorded after publication in the project result receipt; these local checks are not a claim of physical iOS/Android testing.

Visual anatomy acceptance is editorial. BD's final review of the corrected art remains pending after deployment.
