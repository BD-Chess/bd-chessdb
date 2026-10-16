# Illuminara reader / source-bound ART continuation

Concept, characters and product authority: Bojan Dobrečevič (BD). APP task `DFC-APP-INTEGRATION-R2`, execution R3. The current sample uses H1's eight real overview pages and 39 unlettered original panel crops with exact bilingual transcripts. Original page geometry and source text are immutable. H2 scaffold geometry, image-content mapping, stable state, navigation, stale render tickets and bounded cache were adapted into the existing shell. Synthetic fixtures remain in tests only.

## Rebuild available media

Install the existing function dependencies (`npm ci --prefix functions`). Materialize the exact H1 ZIP and release identified in the activated R3 handoff. Verify ZIP `2541721d7eacaf1b6f2f472d12874dddb639fe30cad523af9cde0d5bbdaf6ef1`, release `b2f2bf9972f53561849cd7394eda1e3e81026059c3f806c9caca0209b78b9a4d`, and extract into a separate directory. Then:

```sh
node scripts/dfc-build-overviews.mjs /absolute/H1_ROOT /absolute/H1_RELEASE.json
```

The script checks source hashes before deriving WebP quality 96 at unchanged dimensions. Original-panel crops use `panel.art_source.crop_rect_norm` on 1024×1536 art; overview polygons use full 1024×1660 images including heading offsets. No source upscales, new artwork or imagegen calls occur. Canonical source catalog/dialogue/release are copied byte-identically. Outputs are atomic files and the same command safely regenerates them. Keep the previous committed edition for rollback. Do not run the source-only rebuild over a paired edition without preserving its import.

## Import complete real pairs

Fresh-list exact Contuinity folder `1kvhT5evkzbkPT9h-vzyy5toCV5krLSOr`. Find source-bound `DFC_H2_PAIRED_ART_RELEASE_20261016_R2.json` or an explicit validated partial checkpoint/catalog. Fetch its exact Drive IDs; verify the release/catalog hash and phase-two lineage `461cd7cbfb7f8cee9db3c1734414e07a36664aef14c075a43f54cb187af7b06d`. A lone P or L composition is not a pair. Never infer pair availability from archive names. The APP imports only complete reviewed P+L+four-overlay panels; the rest retain source zoom.

Resolve every `delivery_parts[].drive_id` through authenticated Drive **at build time**, materialize those immutable files, and write a temporary map `{ "exact_drive_id": "/absolute/part.zip" }`. This map is private build input and never enters the repository. The reader has no authenticated Drive dependency.

```sh
node scripts/dfc-import-pairs.mjs /absolute/DFC_PAIRED_CATALOG.json /absolute/parts-map.json
node --test tests/dfc-import.test.mjs
```

The importer checks required fields, source H1/catalog/dialogue hashes, IDs/order, part byte counts/SHA, ZIP CRC/bounds/portable paths/collisions, package-member hashes, actual decoded art dimensions/orientation, exact overlay dimensions/text_ids/source text, canonical story-state facts/hash, QA status and provenance binding. No production destination changes until validation finishes. A sibling candidate is swapped in atomically with rollback; the command is idempotent. The accepted catalog schema is `bd.dfc.paired-catalog.v1`; explicit accepted QA labels are PASS/APPROVED/REVIEWED_PASS/QA_PASS, or READY with an accepted pair visual review. Synthetic artwork requires an explicit isolated test option and is rejected by the production CLI. Unsupported or ambiguous shapes fail with an exact `DFC_…` reason; reconcile with actual ART evidence rather than weakening validation.

Canonical story-state keys are `panel_id,page_id,reading_order,story_beat,protected_story_facts` and either `dialogue` (APP) or the observed ART `dialogue_records`; both hold ordered original records with derived `panel_id`, preserving exact SL/EN text. UTF-8 sorted-key compact JSON has no trailing newline. The explicit `dialogue_records` adapter preserves the original ART hash and compares every exact normalized source record. Other containers still fail until reviewed. Do not silently substitute a new hash. SVGs are passive, self-contained images; external resources/active content are rejected. Embedded fonts or outlined lettering must render in an SVG image. Current test acceptance uses actual text nodes and exact decoded source text; all real overlays need visual review at 402×874 and 874×402. A readable separate transcript remains available on paired panels.

After import, update `release.json.cartoons` from actual `edition.json` and `members.json` hashes/counts/readiness. Preserve unrelated release history. Recompute the existing PWA seal with `node scripts/dualframe-pwa-package.mjs`, run the necessary scoped CI/browser checks and use the existing guarded PR/production/Pages paths. Source media are online and excluded from `sw.js` ASSETS. Do not cache the whole story on startup. Reader artwork cache is current/previous/next, at most six bitmaps; stale requests abort and Blob URLs revoke. Source panels have one bitmap each. Physical iPhone/iPad/Safari acceptance is separate.

Scope now: `COMPLETE_OVERVIEW_READER_8P39K__PAIR_IMPORT_READY`, actual 2/39 real pairs imported from verified R2_C008 (P01-K01 and P02-K04). The other 37 retain source zoom. Full scope only after all 39 true pairs: `COMPLETE_DFC_READER_39_REAL_PAIRS`. No monitoring automation, provider calls, comic creation, public accounts or billing is part of this continuation. Keep the same APP owner ledger and source/task identity.

Observed C008 delivery uses all 39 panel records with MISSING slots, per-part JSON manifests with file→SHA maps, namespaced `support/<part>/fonts`, per-orientation provenance and `display_policy.default=fit`. The importer validates those exact shapes, keeps READY pairs only, and verifies the separately hash-bound metadata control ZIP. It checks all control-member hashes but publishes only the source dialogue from that ZIP; build scripts, worker state and proof images are excluded. The four actual art parts are kept under `paired/` with their original bytes, independent manifest hashes and source-native dimensions.
