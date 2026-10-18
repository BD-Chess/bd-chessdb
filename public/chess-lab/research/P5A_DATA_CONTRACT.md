# ChessBest DATA v1

Scope: LAB whole-workspace replacement after read-only validation/preview and
explicit confirmation. PGN, Study and Sim imports keep their own formats.

Envelope: `schema: chessbest-workspace-data`, `version: 1`, UTC `exportedAt`,
source channel/release, exact section versions, manifest and SHA-256. The digest
is over UTF-8 canonical JSON of **payload only**: recursive lexicographic object
keys, array order preserved, JSON scalar spelling, no whitespace. Integrity is
not authentication. Manifest bytes/counts are recomputed independently.

| Logical section | Source and restore adapter |
| --- | --- |
| game | atomic chessbest-game/1, full PGN/RAV/comments, cursor/FEN and Top Pick; validate entire line and cursor |
| preferences | settings, analysis-engine-r3 (legacy analysis-engine recovery), layout, language, preview-width, showTopLine; fixed logical fields only |
| evaluations | eval-cache and sealed in-memory position snapshots, preserved with source receipts |
| studies | chess-lab-studies/1, A/B, both undo slots; existing Study validator plus strict no-truncation limits |
| evidence | exact IDB snapshots, localStorage fallback, retained memory; sealed IDs validated; no put/trim on restore |
| simulation | exact runs/events, existing validators and reference checks; no import ID remapping |
| timing | local workspace clock/records; paused state only |
| recovery | Study pending, Evidence pending/memory, Sim checkpoint, retained legacy fallback/recovery; quarantined drafts, never automatic replay |

All fields are JSON values. No arbitrary key/namespace is accepted. Tokens,
credentials, leases/owner identities, migration receipts, engine assets and
CacheStorage have no export or import adapter. The original quarantined bytes
are retained; unreadable data blocks the complete export with a concrete error.

Limits: total UTF-8 file 64 MiB; Sim 32 MiB (stricter than its standalone
128 MiB import), each Sim record 32 MiB and checkpoint 8 MiB; Evidence 30
snapshots / 16 MiB; Studies 20 / 4.5 MB, per Study 2 MB / 5000 nodes; game
PGN 2 MB; preferences 512 KiB; cache 4 MiB; timing 4 MiB; recovery 16 MiB.
No section is silently trimmed. File.size is checked before text()/JSON.parse.

Save waits at most two seconds for already queued human reviews and flushes the paused Sim task; an unfinished review blocks a complete export/restore without discarding it.

All live adapters resolve a fixed LAB generation at script load. A restore
stages a separate generation, verifies durable contents and a full recovery
snapshot in a bounded journal, then atomically switches one localStorage
pointer. The boot gate resolves incomplete journals before application writers
start. Old tabs keep their original generation; old pending operations cannot
write into the newly selected generation. Web Locks refuse restore while any
other current DATA-capable LAB tab is open. Unsupported locks block restore.
Old pre-DATA tabs retain their old namespace; their later work remains there.
The recovery snapshot is retained until its successor is verified. At most one
unfinished journal, one prior snapshot and two generated workspaces are kept;
the original pre-DATA workspace is preserved. Engines/online sessions/turnaments
are never resumed by a restore. User must reopen to activate the new workspace.

Source: fresh main 87469d421bb5cabfdb91c17179e929648d9d26af,
LAB tree 291be21d8a20d03e83a66a251233494205477e82. P5B/C are separate.

Architect review corrections (2026-10-18): preview includes active Study,
A/B question/pins, collection metadata and both complete undo slots. Only
collection revision/appliedOperations bookkeeping is excluded from that display.
Failed current exports still expose independently validated previous-workspace
and recovery-draft downloads; neither download restores or replaces data.

Timing uses the complete saved ChessTime 1.0.0 shape, with finite nonnegative
numeric times, both sides, valid mode/turn/flag and an explicitly paused top-level
clock. Timing kind/start-ply/PGN and non-null historical move records, their FENs,
times and full after-clocks are checked before any restore journal write.
Historical records can include null gaps and extend past the displayed cursor.
Validation does not call restore's normalizer or mutate the hashed payload.
