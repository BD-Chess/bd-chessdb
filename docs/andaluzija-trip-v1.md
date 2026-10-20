# Andaluzija shared POIs / TripOpti V1

Version 1.0.0 · 2026-10-20 · BD × AI Lab · implementation: GPT, on BD's activated R1 mandate.

This extends the existing page, rather than creating a second application. The three authorial variants, guide, map, font controls, source photographs and gallery remain. AI sidebar/skill and DualFrame integration are outside this change. Maintained Trip LAB math is imported unchanged.

## Runtime contract

`window.AndaluzijaTripOptiV1` is the only supported AI-facing interface. See `public/BD/O/izleti/andaluzija-trip-interface-v1.json` for machine-readable method and operation schemas. Day indices are zero based. A mutation always targets the currently selected variant/day/city; select it through the user UI first. Names are data, not executable commands.

- `getState()` returns the planner projection: schema/version/tripId/revision/selection/days. It excludes personal preferences, passwords, cookies, booking details and private HTML.
- `getContext()` returns only selected-city POI IDs, names, inclusion, durations, fixed times, public Maps links and capabilities. Flight times stay unverified. It never reads all of `window`, the DOM, or unlocked personal sections into chat.
- `previewChanges(operations, baseRevision)` validates and returns `preview` with a concrete per-POI before/after diff and order/break changes. No write occurs.
- `applyChanges(operations, baseRevision, requestId)` checks the project auth endpoint, validates revision/scope, applies only a local planner edit and emits `applied_local`. Repeat IDs with identical operations do not apply twice. Then autosave is queued. Await `save()` for durable acknowledgement.
- `optimizeDay({mode:'estimate'|'walking', segment:0, progress?})` uses the same worker as the manual button. Returns a preview; never applies it. `cancelOptimization()` cancels the in-flight job. Google mode additionally requires the visible provider opt-in and user-confirmed geocoding results for the entry and selected stops. Returned Google coordinates/matrices/metrics stay in memory.
- `save()` resolves with `{status:'saved', revision, etag, requestId}` only after a real server acknowledgement. An unchanged state resolves `synced`; errors reject. `sync()` reads the server and preserves a dirty local draft on conflict.
- `undoLastOwnChange()` checks server freshness first and fails instead of overwriting an intervening remote change.
- `mapsForStop(id)` returns `{place,walk}` and `mapsForLeg(a,b)` returns the current pair's URL. IDs resolve in the selected scope. Every rendered stop has direct accessible links; the last enabled stop links back to the entry.

Events: `andaluzija-trip-state` with `{status,revision}`. Statuses distinguish `preview`, `applied_local`, `saving`, `saved`, `synced`, `offline`, `conflict`, `failed`, and `locked`. Exceptions use concrete codes/messages. No token or arbitrary JavaScript execution capability is provided.

## Data and constraints

One independent document `andaluzija-trip-v1`, trip ID `andaluzija-2027`. A day key is `variant:dayIndex:cityId`. Each day has an entry, stable POIs, inclusion, durations, optional `HH:mm`, breaks and confirmed order. The catalogue covers ten cities. Catalogue coordinates and visit durations are authorial planning estimates, not verified walking paths. New or renamed locations remain unresolved until confirmed. Sources are attached; 2027 opening hours/prices are not invented.

Alhambra/Generalife are one complex. Nerja caves are excluded. City/day defaults avoid repeating Alhambra, Mezquita, Sevilla's main paid visits and Ronda's arrival visit. Day 1 Málaga defaults to an optional short waterfront walk; final-day Málaga stays unselected until the flight permits a visit. All suggestions remain editable and distinct from booked events.

Classical DeepSearch optimizes distance for a round trip with fixed START, with the maintained 10-second budget for <=50 points. It does not optimize opening hours or total visit time and does not prove general global optimality. Fixed-time stops stay in position; only a contiguous untimed segment between them is reordered. Each such segment is explicitly a round trip from the selected city entry. Transfer timing and ticket feasibility remain for the user to verify. Cancelled/stale/invalid results never alter the confirmed order.

## Auth, storage and privacy

A project-limited HttpOnly Secure SameSite=Strict cookie is issued after verifying the existing owner passphrase with the existing `verifyOwner` verifier. Both holders have equal project rights; each login gets a random session ID. A valid Guide owner session is also accepted. A Guide visitor is rejected. The verifier's BD_ACCESS_V1 format is not used as a Shield v4 envelope. No new passphrase is invented, no secret manager is read and no credentials enter HTML, argv, URLs or logs.

The state Function gates reads and writes. It uses strong reads and an atomic `onlyIfMatch` / `onlyIfNew` whole-document write, never an unguarded GET→SET. Receipts are bounded to 32; encrypted previous snapshots to 3. One client save queue and persisted request IDs handle uncertain network acknowledgement. A conflict retains the local encrypted draft and shows both selected-day lists; accepting the remote version is explicit. Personal notes/settings from the legacy UI are encrypted with the shared planner; the optional local import only fills absent fields.

Production: site-scoped `andaluzija-2027-live-v1`. Preview/dev: a different store derived from server deploy context/ID. Tests inject an isolated in-memory conditional store and never open Netlify Blobs. The old root SDK 8.2.0 is untouched; this Function imports an isolated `@netlify/blobs-andaluzija` alias pinned to 11.1.4. Run root `npm ci --ignore-scripts` before bundling; lock consistency passed offline dry-run, actual package installation was unavailable in the constrained execution environment.

Both the local fallback and cloud planner snapshots are 8zShield v4 ciphertext. The ShieldCore file is an exact extraction from the stable `/8zS/index.html` (shared product unchanged), with PBKDF2/AES-GCM and domain context `www.mdlxdcc.org`. Public JS/HTML now omit personal trip dates, family/insurance details, purchase facts and confirmed accommodation details. They are preserved in a separate private source outside the publish tree.

The real private source is **SECURE_WRAP_PENDING**. No placeholder ciphertext is passed off as a real owner wrap. The local interactive builder is `node scripts/wrap-andaluzija-private.mjs PRIVATE_INPUT OUTPUT.8zs.json`; it requires a TTY and hidden passphrase input, verifies a roundtrip, and prints only bytes/hash/status. The target static file is `public/BD/O/izleti/andaluzija-private.8zs.json`; until safely produced, the UI clearly says the personal content awaits preparation. The complete original private-section structure was exercised locally under a synthetic test key with external requests blocked. This does not verify the real owner key.

Lock/BFCache navigation clears private DOM, data, drafts in memory, geocoding results and previews. No personal plaintext is restored from localStorage before unlock. Print only includes currently unlocked sections; export produces ciphertext. Previous public Git history and the currently held older Netlify deployment are not retroactively protected by this change.

## Verification and remaining acceptance

Run `node tests/andaluzija-acceptance.mjs` from the repository root with Playwright available and `ANDALUZIJA_TEST_CHROMIUM` pointing to an installed Chromium if needed. The test harness uses synthetic auth and in-memory CAS. Optional `ANDALUZIJA_PRIVATE_FIXTURE` points to a private source for local full-template verification; it must remain outside `public/` and version control. Never point a preview test at the production store.

Narrow acceptance covers catalogue/URLs/IDs, invalid draft retention, asymmetric matrix cost/START, crypto roundtrip/wrong password, negative auth, concurrent CAS, idempotency, bounded receipts/history, two isolated browser contexts, loss of connection, conflict/unsafe undo, private lock/reload, 402px/desktop, font controls/map/gallery, real 10-second worker and cancellation. Inspect the task receipt for exact results and hashes.

**LIVE_ACCEPTANCE_PENDING**: no Netlify release is made outside the established weekly/explicit release window. No production store, paid provider test, real owner passphrase or physical iPhone navigation is verified here. GitHub Pages stays read-only for shared editing and links to the canonical Netlify URL. Existing paid API keys, shared auth, Sef, other applications, schedules and research arenas are unchanged.

## Safe reversal

Revert the task's scoped source commit on fresh main, preserving later unrelated commits. Restore affected files as a new commit and publish through the normal approved window. Do not force-push, rewrite history, rotate keys or restore a previous Netlify deployment. Existing encrypted state remains in its store for recovery; do not delete it.
