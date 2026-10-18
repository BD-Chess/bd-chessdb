# CMarvel page 01: private pair candidate preparation

Task `DFC-CMARVEL-01-PAGE01-REAL-PAIRS-R2`, base `9ab90a82c751ad527eeee763fffc61f3e1edab8c`.

This is a build-time preparation path. It does not change the live reader,
original manifest, eleven encrypted source pages, vault, PWA or deployment.
All six panel generation requests are currently refused by imagegen; no real
native art bundle exists. Synthetic tests do not establish artistic acceptance.

`scripts/dfc-cmarvel-pair-candidate.mjs` accepts one private ZIP, a separately
reviewed private transcript, the original protected-comic manifest and a private
output directory. It reads a password only through structured stdin, verifies
it against the original source ciphertext, and never logs the password. There
is no fixture switch on the CLI and no public-destination write path.

The ZIP has `bundle.json`, `transcript.json`, and flat files under `art/`,
`overlays/`, `provenance/`. `bundle.json` has schema
`bd.dfc.cmarvel-p01-pairs.v1`, story `CMARVEL_01`, page `CM01-P01`, original
source/catalog hashes, `transcript:{file,sha256}`, a complete `member_hashes`
map (excluding itself), and exactly six panels in the fixed source order.
Each panel has its exact source rectangle, P/L assets, two EN overlays and
five explicit PASS reviews: clean art, anatomy, source moment and both actual
lettered compositions. Art and overlay entries carry file, SHA256 and actual
width/height; art references a hashed provenance JSON. Each provenance binds
source/rect/reference hash, panel/orientation, the actual prompt, tool
`image_gen.imagegen`, derivation `independent-native-composition` and the native
output hash/dimensions. The separate transcript is byte-pinned and visually
reviewed, including speaker attribution and stable ordered text IDs.

The validator rejects incomplete pairs, another story/page/source, invalid
ZIPs/paths, unknown members, malformed or wrong-orientation images, insufficient
native HD, duplicated art, mismatched provenance, unresolved transcripts,
missing visual QA, active SVG, and changed overlay text/geometry. It reuses the
existing strict ZIP/SVG validators rather than relaxing Illuminara import.

The private candidate contains only ciphertext plus a public-safe cipher index.
Dialogue, placement metadata, provenance and private content hashes live inside
encrypted metadata. AES-GCM AAD binds story/schema, original manifest and member
ID. Salt and PBKDF2 iterations come from the unchanged original source manifest.
Every IV is distinct from the eleven original IVs and all other new members.
An immutable existing candidate is decrypted and verified on re-import; another
package is a conflict, not an overwrite. A scoped exclusive lock prevents two
candidate builders from owning the same output.

Remaining work requires real source-bound art: produce and review twelve clean
compositions, lay out twelve actual EN overlays, then connect a validated
encrypted sidecar to the existing protected reader and reuse `dfc-text.mjs`.
Reader loading, cache/revocation, orientation, timing/peek, real-key integration,
CI/review and both-host publication remain unimplemented/unverified here.
Do not merge or deploy this preparation as a completed page. Do not retry a
refused panel through another prompt, orientation or provider.
