# Legacy Gmail wake — targeted migration 1.0.1

BD authorized a Gmail event trigger and a shared 15-minute admission policy for
the existing Legacy journal on 2026-09-13. This does not activate the converged
Wake Lab upgrade or change the separate email experiments.

The existing hourly task stays enabled at its existing cadence. A separate Gmail
message-added webhook uses exact sender and subject filters; its prompt checks
the complete trimmed body and fetches the exact provider message before acting.
The machine wrapping credential is confined to that private task. Neither it nor
the human password, message IDs or task IDs are included in this document.

Both paths use one pinned rules guard, the same journal frontier, 900-second UTC
slots, STOP/PAUSE checks and the original expiry
2026-09-20T08:05:11Z. Gmail message IDs are deduplicated inside encrypted state.
The two-file event/state commit and non-force main update provide the optimistic
concurrency boundary; a stale competing candidate must re-read and be rejected.
The validator is a caller-side admission check, not a server-enforced sandbox.

Migration changes the rules to 1.0.1 and increments state revision without adding
a research event. Existing event bytes, parent hashes and original rules receipts
are preserved. Events 5–8 remain on 1.0.0; events 1–4 remain pre-rules. The reader
validates each era explicitly. The old rules envelope and release manifest remain
available. The input probe's pinned bundle is updated in the same release.

Research tasks cannot change the wake policy, expiry, control, roster, mode or
connected flag. A Gmail event must carry the exact message and actual invocation
identity; an hourly event cannot claim Gmail provenance. Missing evidence blocks
the step. No model step is produced by this migration or by the control probe.

Validation: 110 synthetic test cases (the 50 core checks also run on the recovered frontier) cover both paths, message conditions,
dedupe, stale candidates, historical receipts, policy tampering, STOP/PAUSE and
the exact expiry boundary. All eight real historical events were decrypted and
verified against their indexed hashes and parent chain under the candidate guard;
candidate rules/state and the separate machine wrapper passed crypto roundtrips.
These results do not establish Gmail end-to-end execution. That requires a new
signal and its actual event invocation, accepted journal append and readback.

The machine wrapper contains access to the existing shared journal key. It is
task-scoped by the execution contract, not a new cryptographic per-path permission
system. Tasks must unwrap afresh and must not retain keys beyond an invocation.
Removing the wrapper blocks fresh access but cannot erase a previously cached
key; no stronger revocation property is claimed by this targeted migration.


Recovery revision R2: preserve malformed e000009 exactly at its original path.
Preserve the malformed state bytes in recovery/e000009-state.invalid.enc.json.
Restore only the authenticated last accepted e000008 state, then apply the
1.0.1 migration and pin the recovery metadata. Sequence 9 is the sole explicitly
rejected attempt; the next free research event is e000010 with parent e000008,
its exact canonical parent hash and the recovery manifest hash. No other gap
is allowed. This is an explicit scoped management recovery, not acceptance of
unverifiable ciphertext. Existing journal event bytes remain unchanged.

A deterministic wl_legacy_step.py helper creates and roundtrips both encrypted
files, exports exact tree content and Git blob checksums, and checks exact
readback. Workers transfer these bytes programmatically; they must never invent
or manually transcribe ciphertext. The helper does not network or commit.
Both tasks remain enabled on BLOCKED; the user controls STOP/PAUSE/expiry.
No Gmail delivery or connected flag is claimed by this migration itself.
