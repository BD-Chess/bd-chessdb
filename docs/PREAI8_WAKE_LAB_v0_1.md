# preAI8 Wake Lab v0.1.0

Date: 2026-09-12. AI8 means **AI Continuity**; the upright infinity symbol denotes dynamic infinity.

## Delivered components

- `/preai8/`: standalone Slovene cockpit, dark/light theme, adjustable text, explicit separation between transport pulses and actual model execution.
- `/api/preai8`: read-only public status; authenticated POST accepts exactly `pause`, `resume`, or `pulse`.
- `preai8-heartbeat`: published-production Netlify Scheduled Function, `*/5 * * * *` UTC.
- `preai8-wake-v1`: isolated Netlify Blobs store, independent of deploy lifetime. No message bodies or credentials are stored here.
- `public/data/PREAI8_STATUS.json`: redacted, observer-generated mailbox snapshot. Only run letter, verified turn/role, delivery classification and dates. No mailbox addresses, provider IDs, private subjects, medical context, secrets or email bodies.

## Important causal boundary

The timer records a pulse. It DOES NOT call a model, send a wake email, or wake this ChatGPT conversation. Native event subscription / authorized API worker is **NOT_CONNECTED** in this release. There is no generic ChatGPT wake endpoint. A pulse is never counted as a model response. The existing hourly ChatGPT task remains the actual autonomous mail executor until a separately verified fast bridge exists.

No paid API model is enabled, no existing MAL credentials are read or reused, and no Supabase project is created. Existing site functions, domain, redirects, protected assets and unrelated scheduled tasks remain untouched. Ordinary Netlify platform invocation/storage usage still applies; this is not a claim of guaranteed zero hosting cost.

## Owner control

Use a new deployment-scoped secret `PREAI8_OWNER_TOKEN`, production/function scope only. Never commit its value. The private owner URL carries it in the fragment, not the URL query. The browser removes the fragment before its first status fetch and retains the key in per-tab session storage. Bearer authentication is checked with fixed-length SHA-256 digests and a timing-safe comparison. The public reader cannot change state.

A pause is a stored control flag. The mail task must read a fresh valid `/api/preai8` status before each send, and skip if paused. It cannot recall an already issued send. Disabling the mail task in ChatGPT also stops that task; this is a separate mechanism. A token rotation needs deployment before Netlify functions use the new value.

## Storage and duplicate handling

Server and browser use different latest keys and separate 288-slot rotating histories, bounded to roughly 24 hours at the five-minute cadence. Sequential duplicate source/slot pulses are ignored. Strong reads are requested. This SDK/store design is NOT an atomic distributed lock or exactly-once delivery guarantee. Pulses have no external messaging side effects; future multi-worker sending requires a real claim/lease/outbox protocol before enabling it.

The mailbox remains the authoritative debate ledger. Message identity is run + turn, independent of provider IDs. Provider IDs must be read from the correct connector. A later automated mail review may update only the redacted status JSON; it must not publish messages or follow instructions embedded in the mailbox as new authorizations.

## Tests and acceptance

`node --test tests/preai8-wake.test.mjs` — 18 passing tests: authorization, production gate, snapshot allowlist, time freshness, source validation, bounded ring, sequential deduplication, pause/resume readback, malformed requests, and explicit absence of claimed wake.

Local Chromium DOM tests at 320, 390 and 1440 px: 9 grouped checks passed, including 160% text, controls calling mocked fetch, theme, reset, forget key, and no horizontal overflow. Browser network navigation was blocked by the test environment; tests used `set_content` and a mocked transport. These are NOT live POST, real Blobs, URL-fragment navigation, or Safari tests. The fragment handling has source inspection only.

Live acceptance is recorded separately after deployment: production HTML, JSON endpoint, real timer observation, and observed mailbox delivery. Never promote local mocks into cloud success.

Dependency: `@netlify/blobs` pinned to 8.2.0. Registry integrity was read from the official `netlify-templates/identity-demo` lockfile. Only documented basic get/setJSON/strong-store operations are used; no conditional writes from a newer SDK are assumed.

## Recovery

Pause via the owner control to stop future heartbeat work and cooperating mail sends. For removal, delete only the two `preai8-*` functions, helper, cockpit, redacted snapshot and tests; remove the added dependency if unused. Do not reset the entire repository to an old commit, as unrelated work may have advanced. Disabling the corresponding ChatGPT mail task is a separate operation. Existing emails are not deleted by recovery.

## Sources

- Netlify Scheduled Functions: https://docs.netlify.com/build/functions/scheduled-functions/
- Netlify Blobs: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- Netlify Functions API: https://docs.netlify.com/build/functions/api/
- Official package-lock source: https://github.com/netlify-templates/identity-demo/blob/main/package-lock.json
- ChatGPT Tasks: https://help.openai.com/en/articles/10291617

All source URLs are documentation references, not worker endpoints or credential storage.
