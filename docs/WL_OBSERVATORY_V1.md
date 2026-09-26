# Wake Lab / AMAIL observatory v1

2026-09-14 · BD-authorized presentation and read-only projection upgrade.

## Pages and scope

`/WL/` is the technical overview: all eight email lines, actual counts and frontiers, last event and elapsed time, within-line average interval, scheduler observation, rejected WL attempt, private journal verification, recent intervals and aggregate CSV export. `/WL/BD/` explains each mission, expected output, current launch limitations, capsule/multiresolution method and the boundary on self-modification. The prior explanatory material and encrypted cumulative summary remain under an explicitly historical disclosure.

Both use the existing in-tab WL unlock. No credential, email body or private WL plaintext is added to the public aggregate. No journal event, vault, research rules, writer, underlying cryptography, or runtime control is changed. Existing pause/resume/pulse controls remain on the technical page. Lowercase entry URLs redirect to the original uppercase paths.

## Evidence model

`public/data/AMAIL_STATUS.json` has schema `amail.observatory.v1`. Each row identifies A–H, run_id, logical message count, highest observed turn, first/last provider timestamps, last role, interval count, mean and optional median, up to eight recent timestamps, scheduler state/target interval/last invocation, workspace status and blockers. No private mailbox/provider/task/folder identifiers, addresses or message subjects are published. The root contains generation time, source coverage, refresh policy, a minimal WL scheduler/trigger observation and additive totals.

Counts exclude drafts and quoted history. Sent and recipient copies are one logical message. A/B historical search coverage and subsequent contiguous deltas are reused explicitly; this release is not a new full-body audit of every historical turn. Latest outbound visibility does not assert recipient delivery. Mean interval is (last minus first)/(count minus one) only for the observed contiguous sequence. Cross-line gaps are never pooled as sequential events. One seed has zero intervals and null mean, not a zero-second cadence. Unknown medians stay null.

The browser separately decrypts and verifies the accepted WL event chain using the existing local session key. It verifies ciphertext SHA-256, AES-GCM, canonical plaintext hashes, parent/sequence consistency, the authorized e000009 recovery exclusion and receipt versions. These are structural/integrity checks, not proof of research truth. WL intervals use `created_at` of accepted automated events, explicitly not GitHub publication times or heartbeat cadence. The original WL reader retains its fuller rules receipt checks.

## Freshness and uncertainty

Mailbox statistics are a derived snapshot. Browser polling every minute reads that snapshot; it does not access Gmail. Target source refresh is hourly; after two hours the UI shows STALE. An enabled schedule is not a delivered turn. An invocation is not a successful research step. Missing control data displays unverified. D–H at launch review are SEEDED_NOT_CONTINUING; missing state files and inactive/absent executors are visible. This UI release does not silently restart those tasks or repair their launch. A/B/C workspace migration remains unfinished.

The existing stats refresher should maintain this third aggregate output alongside its existing A/B-compatible status and encrypted summary. No new task slot is required. Do not regress a newer frontier or relabel an old source as freshly checked. Preserve current GitHub main immediately before writing. A source failure retains previous values with their original time and explicit error/coverage status.

## RHP decision record

The practical review combined user-first scan hierarchy, engineering integration, falsification of green-status shortcuts, privacy/lock review, and empirical component checks. Alternatives retained: one large all-purpose page versus two complementary views; client-side current WL verification versus a stale server projection; separate sender repair versus coupling it to the page launch. Chosen: two views, shared aggregate contract, locally verified private journal, and visible sender blockers. No claim of independent model reviewers or measured DCC superiority.

## Verification and limitations

Actual tests are in the accompanying private release receipt: Node syntax; preserved original main reader; exact production JavaScript journal verifier using Node WebCrypto and pinned historical ciphertext; corrupt-envelope rejection; null single-event intervals; reversed-time rejection; offline Chromium component rendering at 1440/390/320, light/dark, font controls, filters, stale display and DOM clearing on lock. The local fixture has 19 accepted events through e000020, not the live release frontier.

Environment browser navigation was blocked by administrator even for a local preview. Consequently offline render tests used an explicitly isolated about:blank harness with mocked storage and no network. These are not a live browser unlock, CSP enforcement, or actual mobile Safari test. Do not label them so. Production deployment and post-deploy HTTP/browser checks have separate verdicts.

## Snapshot repair and observation semantics — 2026-09-26

The public JSON repair preserves historical observations and adds separate source-check and refresh timestamps. A new `generated_at`/`refreshed_at` does not refresh `sources.email.checked_at`. Workspace checks retain their original dates when not rechecked. A scheduler registration or invocation is not research or mail delivery evidence.

`count_kind: LOWER_BOUND` means only an observed subset of logical turns is counted. The browser prefixes such counts and totals with ≥; it does not infer a count from the highest turn. Missing search results are coverage gaps, not proof of absent mail. Full-sequence interval count and mean remain null when coverage is incomplete. The recent cadence chart uses a contiguous observed suffix. Historical metrics remain separately available. CSV includes count kind and source-check time.

Operational badges distinguish a reported transport failure, valid input wait, pause, stale observation, recent contribution, and the expired Legacy WL window. A reported failure does not diagnose Microsoft, Gmail, a connector, or an approval gate. A valid wait is not counted as recent activity. Missing timestamps do not produce a healthy label. No WL key, encrypted journal, authorization, or control endpoint changes are made by this projection.

Before publication, serialize the complete pair, parse it back, and run:

```sh
node scripts/validate-amail-status.mjs
node --test tests/amail-status.test.mjs
```

Publish against a freshly reread base, preserve concurrent changes, then read back complete bytes and compare their hash. Re-run parsing and validation on readback. If validation or exact readback fails, retain the last valid snapshot and its observation timestamps; do not mark refresh successful. The validator is a callable gate for the external producer, not a new scheduler or an automatic post-commit repair.

