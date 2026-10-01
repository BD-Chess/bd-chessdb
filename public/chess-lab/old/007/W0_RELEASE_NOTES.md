# W0 R3 — LAB publication, device acceptance pending

This delta implements BD's approved priorities 1–4 on the current LAB. The first
source baseline was `ba23421d9f731377e7a9bf9d421b669afc87689c`; the recovery receipt
records the final rebased parent and candidate commit. No stable-channel files
are part of this delta. This document is not a deployment receipt.

## Data isolation

- LAB uses `ChessBest:LAB:v2:*` keys and separate evidence/simulation databases.
- First boot copies existing data under a cross-tab lock, verifies writes and
  records resumable migration receipts. Original shared storage is never removed.
- Existing LAB values and record IDs win. Intentionally empty LAB state is kept.
  Legacy fallback archives are reconciled before copying; retained recovery
  copies are separate when activating them would restore deleted LAB content.
- A failed or unverifiable migration blocks app startup and offers bounded retry.
  First migration requires working Web Locks, localStorage and IndexedDB.
- Saved connection tokens are copied locally to isolated keys. Diagnostics never
  contain their values or hashes. Runner leases are not copied; a live legacy
  simulation is not taken over or automatically resumed.
- This is namespace isolation, not an independent origin quota or automatic sync.

## Studies

- One validated transaction commits a collection import, capture, edit, removal
  or workspace PGN export. Quota/readback failures are not reported as saved.
- Writers serialize with Web Locks and read the latest collection. Conflicting
  edits/removals require review; a missing safe lock fails closed.
- The manager exports saved/original/pending/recovery content, finds individual
  Studies, confirms selected/all removal and resumes the frozen pending action.
- Removal requires a verified local recovery snapshot or an explicit decision
  to remove without recovery. Undo snapshots are bounded. A/B and unrelated
  storage remain intact.
- Pending operation identities survive draft export/reimport. Uncertain retries
  beyond the bounded receipt window stop for manual review rather than duplicate
  records. Queued captures retain their original target Study.
- A verified per-tab draft can survive reload; a restored draft is resumed
  explicitly. A same-session game-load callback runs only after durable save and
  refuses to replace a workspace that has since changed. After reload, open the
  saved Study manually; JavaScript navigation callbacks are not persisted.

## Source context and Help

The defect was reproduced on the original baseline: selecting SF removed the
CDB/DCC context from Study and Gemini despite the independent visible cards.
The fix keeps CDB, SF and DCC snapshots tied to their measured FEN, history,
generation, perspective and actual provider. The board selector retains its
existing visual role. A FEN-only provider is not described as receiving history.

Help now describes the two analysis choices, three card actions, seven Top Picks,
saved-depth behavior, Study management and the distinction between untimed
observer runs and budget/clock-controlled Matches & tournaments. SF selection
is not a private/local-only mode.

## Release hardening (2026-09-27)

The final review found and reproduced two further cross-tab/recovery defects:
annotation retry could announce success without persisting the edited comment,
and a capacity-blocked Undo could follow a newer removal snapshot. Transactional
edits and frozen recovery payloads address those cases; focused regressions
accompany the fixes. Unrelated edits in another tab are preserved.

## Verification boundary

`research/run-w0-narrow.sh` runs the directed storage, Study, source-context,
Top Pick loading, clock and host integration regressions using deterministic
external provider/worker fixtures. It is not the broad GUI matrix, a physical
device test, a live paid Gemini call or a DCC playing-strength experiment.

`research/w0-inventory.cjs` enumerates known source controls and construction
sites and emits the remaining visual matrix. Counts are not runtime coverage.
The local browser preview was blocked with `ERR_BLOCKED_BY_CLIENT` in this
environment, so candidate screenshots and visual acceptance remain pending.

BD explicitly authorized continuing, completing and publishing this LAB delta on
2026-09-27, superseding the earlier manual pause. No model switch is claimed.
The publication receipt records exact source, tests, deployment and live checks.
Physical devices and any unvisited GUI/zoom states remain explicitly pending;
publication is not a claim that the entire W0 device matrix has passed.
