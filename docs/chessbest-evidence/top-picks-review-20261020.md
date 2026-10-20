# ChessBest LAB — ten source-bound Top Picks reviews

This product extension reuses the existing recorded-game Review. It adds nine
frozen evidence projections and a declarative ten-game registry. The newer
Dreev–Kasparov V4 JSON, its 12 human/AI decision annotations, and both curated
PGNs are unchanged. It does not complete the nine remaining scientific game
reviews or run an engine, CDB collection, DCC campaign, arena or Collector.

The source identifier, root FEN, complete mainline UCI SHA-256 and exact
anchor ply/FEN/move must agree before an allowlisted file is requested.
The registered byte length and SHA-256 are verified before JSON attachment.
Every recorded position, scored candidate and complete saved PV is replayed.
No workspace, mutable Evidence payload, pin or DATA schema is changed by Review.
Failed requests are evicted from the ten-entry memory cache. Each current
review permits an initial request plus two explicit retries. A generation check
prevents a delayed reply from following a different game; cursor navigation
keeps the same verified game identity.

Top Picks initially show identity and an explicit **Reveal saved review** action.
Future notes, result, candidate cards, graph/tooltips and ledger are absent from
the Review DOM before reveal. The existing board, library and recorded game
remain available. The reveal is an in-memory viewing choice, not a recorded
blind human decision. Source-authored notes retain their original language;
new controls, statuses, summaries and accessibility text support SL/EN.

## Frozen evidence and its limits

`top-picks-frozen-20261020.json` selects nine games by the SHA-256 of their
COMPLETE `moves.csv` UCI sequences in
`CBTP_FINAL_20260929T203724Z_dae09ebd.zip` (Drive
`1SzYJgVn-WQc5cS1SLgIkJMmFUlCvglo5`, SHA-256
`d026c44a19fcd33abc4b78c22bfecc410232fe355e35e5d0175b00e07103c8e9`).
The importer checks ZIP CRC, exact members, every EXTRACT_MANIFEST member's
length/hash, full sequence, anchor and original CSV record hashes. The extract
contains parsed CDB position observations, not original HTTP bodies or a new
measurement of the database. Its date is the archive snapshot date. Backend
engine/version and per-query timestamp are unknown.

The generator also reads the already committed September 26 CDB HTTP body and
SF Lite receipts listed in the catalog, verifies their hashes, matches full
FENs and replays all included PVs. Unrelated requests are not imported. Each
depth/restricted-root search and each queryscore/queryall/querypv body remains a
separate dated observation. Two TCEC summaries do not establish an exact
same-search gap: the played move may have been searched separately. TCEC's PGN
and CC BY-SA 3.0 notice are unchanged.

Archive position estimates never manufacture scores for played moves. The
direct CDB and SF ledger counts actual scored candidates, with missing values
distinct from zero. SF coverage is 100 positions in Dreev, one saved anchor in
each of seven other games and zero in Gukesh–Ding/Capablanca–Lasker. Their CDB
projections and DCC anchor receipts still make those reviews useful.

CDB `29973` remains a typed positive mate in 27 plies, approximately M14;
SF mate distance remains in moves. Scores retain their POV. Same-root gaps are
shown only for directly scored, unbounded candidates in a comparable source.
Restricted roots retain their limited denominator. Cross-node observations do
not become move regret. DCC heuristic units use mover POV and are separate from
the raw CDB White-POV column. No playing-strength claim follows from that table.

The graph uses coherent archived position estimates or the existing Dreev
baseline. Missing positions leave gaps and mate stays an edge marker, never a
fabricated centipawn value. Candidate cards and the played-move ledger also work
without an SF series. Legal PV previews own only their small preview board;
closing returns focus without changing the recorded line or host cursor.

## Reproduction and tests

With the exact ZIP available, reproduce the selected input:

```sh
python tools/import-top-picks-frozen.py /path/to/CBTP_FINAL_20260929T203724Z_dae09ebd.zip
node tools/build-top-picks-review.cjs --check
```

For a reviewed regeneration, omit `--check`. Neither command uses a provider or
an engine. `top-picks-review-build-20261020.json` records frozen/source input
hashes and generated output hashes. The existing LAB PWA builder includes the
nine JSONs and registry in its explicit runtime allowlist; CURRENT is unchanged.

`top-picks-review.test.cjs` exercises all ten identities, sparse coverage, POV,
mate units, invalid files/registries, bounded retry, three delayed game changes,
reveal, restricted candidates and independent PV focus/cursor behaviour.
`top-picks-review-browser.cjs` runs the shipped library and Review in disposable
desktop/430px Chromium, uses actual bundled files, verifies all ten openings,
graph keyboard use, PV, SL/EN, and a fresh offline document with retained cursor
and pinned sealed Evidence. Its unsupported ordinary PGN has a recorded-line
fallback. It counts external requests and Worker construction around Review.
The existing DATA/P5BC/resume/update and actual-engine CI gates remain enabled.

Browser emulation is not a physical phone, OS installation, 200% OS/browser zoom,
eviction or endurance test. Those checks and scientific campaigns remain open.
