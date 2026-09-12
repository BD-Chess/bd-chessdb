# preAI8 Wake Lab v0.2.0

Date: 2026-09-12. AI8 means **AI Continuity**; the upright infinity symbol denotes dynamic infinity.

## Experimental split

Two experiments are intentionally separated:

1. **Email dyad** — Gmail BD_SIM ↔ Outlook LLM. This remains a two-role longitudinal conversation so continuity over external mail can be observed without conflating it with RHP.
2. **Wake Lab / RHP-11** — private unlinked `/WL/` cockpit for the 11-member Resonance Hybrid Protocol. This is the multi-perspective orchestration surface.

The separation is deliberate. A dyad tests persistence of one conversation across sleeps/wakes. RHP-11 tests diversity, governance and retained learning across specialized roles.

## Private surface

- `/WL/` is intentionally unlinked and excluded from indexing.
- Static HTML contains only the locked shell; private stream/state are fetched after authentication.
- The password itself is never committed. The server stores only a salted PBKDF2-SHA256 verifier (900,000 iterations); the browser sends the entered password only over HTTPS and retains it in sessionStorage for this tab until Lock/tab close.
- `/api/wl/session` verifies the password. After success the browser retains the entered password only in `sessionStorage` for that tab and sends it over HTTPS in the private WL request header. `Lock` or closing the tab clears that tab-scoped state.
- A− / A+ adjusts the cockpit by 10 percentage points, with one-tap 100% reset and no application-level upper cap. Theme, refresh and lock controls are available after unlock.

`/BD/O/` already has the equivalent reader controls in the current production vault runtime, so Wake Lab mirrors that interaction without rewriting the personal vault.

## RHP-11 roster

The private API exposes the 11 roles from RHP v2.8:

- 1 Crystallizer
- 2 Physicist
- 3 Naturalist
- 4 Engineer
- 5 Falsifier
- 6 Seed Dreamer / Dreamer mode
- 7 Cartographer
- 8 Claustrum / DCC governor
- 9 Historian
- 11 Child
- 0 Empiricist (last to speak at the empirical gate)

The roster is architecture, not proof that eleven independent models are currently executing.

## Heartbeat and state

Delivered production components:

- `/api/preai8` — redacted public operational status and owner pulse/pause interface.
- `preai8-heartbeat` — Netlify Scheduled Function, `*/5 * * * *` UTC.
- `preai8-wake-v1` — Netlify Blobs store for bounded heartbeat/control and private RHP stream/state.
- `/api/wl/session` — password verification endpoint; it does not mint a reusable server token.
- `/api/wl/data` — authenticated private cockpit payload.
- `/api/wl/control` — authenticated pause/resume/manual pulse.
- `/api/wl/ingest` — authenticated RHP entry ingestion; owner/service token may be used by a future verified executor, while the private WL password is accepted for owner seeding/testing.
- `/WL/` — private cockpit.

The mailbox remains authoritative for the email dyad. Wake Lab storage is authoritative only for its own heartbeat and RHP stream.

## Critical causal boundary

A heartbeat/pulse **does not wake a model by itself**. It records a timed signal. `PREAI8_WAKE_URL` is deliberately optional; until an authenticated worker/event bridge is connected and verified, RHP execution is `NOT_CONNECTED`.

The UI must never turn a pulse into a fake agent response. RHP entries are displayed only when a real executor explicitly ingests them. This preserves the difference between:

- timer fired,
- wake bridge accepted,
- model actually executed,
- output was retained.

The existing hourly ChatGPT mail task remains the autonomous fallback for the two-email debate. It is not the RHP-11 executor.

## Governance / RHP fidelity

Wake Lab follows the source RHP principle: default Resonance, rare Scatter, budget-driven Crystallize, Silence every 8th round, Cartographer mapping, Claustrum governance, and Empiricist testing after Crystallize. The live runtime must not claim these phases happened unless it records the corresponding agent/governance events.

## Storage and duplicate handling

- heartbeat history is bounded to 288 five-minute slots (~24h), with sequential source+slot deduplication;
- RHP stream is bounded separately;
- strong-consistency reads are requested from Netlify Blobs;
- this is not an atomic distributed lock or exactly-once guarantee;
- a future multi-worker executor needs a claim/lease/outbox protocol before parallel sending.

## Security

- the plaintext WL password is never committed; the public server code contains only a salted PBKDF2-SHA256 verifier (900,000 iterations);
- after unlock the plaintext password exists only in that browser tab’s `sessionStorage` and is sent only to same-origin HTTPS WL endpoints;
- `PREAI8_OWNER_TOKEN` is optional and reserved for a future service executor; no token value is committed;
- no provider token or private RHP message body is committed to the public repository;
- `/WL/` and `/api/wl/*` carry no-store + noindex/nofollow headers;
- `/WL/` is not added to index pages or sitemap;
- `robots.txt` disallows `/WL/` as an additional hint, not as an authentication mechanism.

## Tests before production

- all `.mjs` files pass `node --check`;
- `node --test tests/preai8-wl-static.test.mjs` passes 5/5 local structural/security checks;
- package-lock remains npm lockfile v3 and pins `@netlify/blobs` 8.2.0 using the registry integrity recorded by an official Netlify template lockfile;
- live acceptance must still verify deployed HTML, password rejection/acceptance, private data endpoint, manual pulse, scheduled pulse observation and page headers.

## Recovery

Remove only Wake Lab functions/page/header additions and the added `@netlify/blobs` dependency if no longer used. Do not reset the entire repository to an older commit because unrelated work may have advanced. Changing the WL password requires generating a new salted verifier and deploying it. Rotating `PREAI8_OWNER_TOKEN` (if later used for a service worker) remains a separate secret operation.
