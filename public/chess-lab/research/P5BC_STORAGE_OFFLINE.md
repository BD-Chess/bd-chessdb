# P5BC storage contract

One LAB writer; no CURRENT, archives, engine identities or parent PWA changes.

## Evidence

Sealed chess-evidence/1 snapshots and IDs are immutable. Local pin metadata is
`{version:1,pins:[snapshotId,...]}` with sorted unique IDs, at most 30, and no
dangling IDs. Missing metadata on a legacy archive means no pins.

Evidence IndexedDB moves from version 1 to 2, adding `metadata` (keyPath `id`)
beside `snapshots`. Pin rows are `{id,version:1,pinned:true}`. Snapshot reads,
metadata reads, retention decisions and writes use ONE transaction over BOTH
stores. Existing version-1 connections close on versionchange. Version-1 code
cannot reopen version 2; its fallback cannot modify the version-2 IDB archive.
Blocked/error access never licenses overwriting an inaccessible archive.

The fallback changes from a legacy array to `{version:2,snapshots,metadata}` in
the SAME generation-routed key, with one Web Lock and readback. Old readers
reject this object and preserve its bytes. No safe lock means no durable write.
Every asynchronous effect rechecks the captured DATA generation. Corrupt raw
records are retained and block mutation/export; they are never filtered away.

The 30-item / 16 MiB quota counts canonical UTF-8 bytes of `{snapshots}` plus
the complete `{version:1,pins:[...]}` metadata when pins exist. The empty version
descriptor is bounded framing, so an already valid, exactly-full DATA v1 remains
importable. Status exposes charged bytes, metadata bytes, serialized bytes and
the fixed framing difference; manifest bytes always count the actual full JSON.
All actual pin metadata consumes the quota. New saves retain the incoming snapshot and all pins, evicting
only pre-existing unpinned records, oldest timestamp then ID first. If no valid
fit exists, the entire transaction is refused. At most one unsaved snapshot is
held per store for individual export; another cannot replace it silently.
Failed deletes/pins do not claim durable success. Listing never cleans storage.

## Portable DATA

New exports: envelope version 2, Evidence section version 2; all other sections
remain version 1. Evidence is `{snapshots,metadata}`. DATA v1 remains accepted
only after its ORIGINAL strict schema, manifest and hash validate. Migration
then creates a separate v2 envelope with empty pins; no caller data is mutated.
Preview includes added/removed pins. Restore revalidates before journal effects.
Journal v2 holds v2 recovery; old v1 journals remain recoverable. Original input
hash/version remain distinguishable from the migrated durable hash.

## Offline inspection

Inspection is cache-only and never starts workers/downloads. Asset verification,
capability/route, RAM and derived offline readiness are separate fields. Lite
requires a verified cached shell descriptor and its actual worker closure.
Missing/corrupt bytes override a ready marker. Status refresh is explicit and
bounded; no full-package verification on UI ticks. Origin quota estimates are
separate from exact Evidence accounting. Unsupported APIs report unknown.
