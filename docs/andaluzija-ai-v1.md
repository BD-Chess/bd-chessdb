# Andaluzija AI v1 · source candidate 2026-10-20

Scope: the existing `public/BD/O/izleti/andaluzija-2027.html`, public skill and authenticated travel endpoint. It shares the manual POI model/validator, DeepSearch worker, Maps functions, encrypted SharedTripStore and server CAS. No second plan or solver. Landing uses the extracted provider transport with unchanged provider/model/reasoning/retry/cost settings.

## Request / execution contract

POST `/.netlify/functions/andaluzija-ai` requires the existing trip cookie or Guide owner cookie, same-origin JSON and the mdlxdcc site. A visitor or a client `role/page` cannot grant rights. An initial request is `{message,provider,epoch,allowChanges,history,context}`. Context is reconstructed by an explicit allowlist: trip, selected variant/day/city, entry and current POIs with durations/fixed times and revision. It never reads DOM, preferences, bookings or personal content. Existing private `/BD/O/` public-reader block remains intact.

Both GPT and Claude load the same packaged `andaluzija-2027-guide` 1.0.0 and selected city reference. All loaded bytes must match registry SHA-256. References are by fixed city ID; there is no arbitrary URL fetch. `included_files` packages the registry/skill with the function, so runtime knowledge does not silently advance to a different GitHub main. Newly verified city hours require opening official links; the package does not claim current live retrieval or future 2027 availability.

Tools: `get_trip_context`, `list_city_visits`, `read_travel_reference`, `propose_visit_changes`, `apply_visit_changes`, `optimize_day_visits`, `save_visit_plan`, `undo_last_own_change`, `get_maps`. Changes are `{op:add|enable|disable|duration,id,minutes}`; use returned catalogue IDs. No arbitrary code, selector, hotel/flight/booking changes or custom coordinates. Fixed-time stops are immutable to AI. Existing `Palacio de Viana` is enabled rather than duplicated. Optional public additions carry a named Maps query and official source; unresolved additions can be previewed/added but cannot be optimised with invented coordinates.

An explicit user imperative is required for mutation. Automatic save of such instructions is enabled by default and can be switched off for preview-only use. Suggestions default to preview. Selecting a prompt only fills the composer; it makes no paid call. Mutation uses a fresh strong read, compares the original baseRevision, and holds the selected scope/generation. No automatic rebase, fallback provider, retry, paid matrix or geocoding. Classical estimate mode reuses approximate manual coordinates, runs a bounded 10s worker on one selected untimed segment, and reports an estimate, not walking distance/arrival feasibility/global optimum. Multi-segment plans need a segment choice.

The server returns `client_action` plus an AES-256-GCM continuation capsule bound to actor/origin/scope/epoch/action/requestId/baseRevision and a 3-minute expiry. It preserves OpenAI reasoning items and Claude signed thinking/system prefix. The capsule is confidential, ephemeral and memory-only. The client executes the actual planner and sends the receipt, then resumes the same provider. A requested action alone never produces a success claim. Browser requestId replay returns the same promise; a changed action with the same ID is rejected. Server save acknowledgements use the storage requestId, revision and ETag and are independently checked against the strong server read before the provider sees `saved`. `synced` is no new write. Execution preview receipts are browser observations, not independent provider or device proof.

The adapter is backward compatible at 1.0.1. `getExecutionState()` returns epoch/generation/write; `applyChanges(ops,baseRevision,requestId,guard?)` checks the optional generation guard after authentication; `optimizeDay({operations?,baseRevision?,mode,segment})` previews candidate POI changes using the same worker without applying them. Existing callers remain unchanged. Source interface file documents these extensions.

The client paints an explicit application receipt independently of model prose. Tool-round prose is withheld until execution is complete. A final unverified success phrase is replaced with a no-confirmation response. This guard supports truthful UI; it is not a formal proof of arbitrary natural-language claims.

## Lifecycle and privacy

Closed initially. Desktop uses a left sidebar; at 402px it uses a full-screen overlay with close/Escape, focus containment and safe-area padding. One conversation keeps provider labels on earlier answers. Toggle preserves the authorised session. Messages, continuation, preview and catalogue cache stay in memory, never plain localStorage or global Guide history. Pagehide/BFCache/lock abort requests/worker, increment epoch, clear chat/composer/preview and ignore late results. Print excludes the sidebar. Existing Shield-protected planner storage remains ciphertext. No owner password is obtained or logged by the AI code.

The private content envelope was completed by the parallel TripOpti session and independently checked on 2026-10-21: `SECURE_WRAP_VERIFIED`, SHA-256 `873c812e4182bcc8e2633e805f1e0ae62665965a40b3f16e927542663616afaa`. Local checks with the authorized owner key cover decryption, the existing owner verifier, wrong-key rejection, real browser unlock/relock/reload and no private data in the model projection or plain cache. Live release, production CAS and real provider response remain separately recorded acceptance items. Desktop Chromium at 402px is not a physical iPhone test, and earlier public history is not retroactively protected.

## Targeted verification

- `node --test tests/andaluzija-ai.test.mjs`: skill hashes, safe context, auth/origin/visitor/forged roles, encrypted continuation, both provider protocols, independently checked server receipt and recommendations.
- `node --test tests/mdlxdcc-guide.test.mjs tests/mdlxdcc-guide-access.test.mjs`: existing public transport, signed thinking, public route denylist and cost/auth invariants.
- `node tests/andaluzija-ai-browser.mjs`: deterministic provider transport, actual browser/crypto/10s worker and isolated strong conditional storage. No paid provider/Google requests.
- `node tests/andaluzija-acceptance.mjs`: existing manual planner checks.

Set `ANDALUZIJA_TEST_CHROMIUM` to an installed Chromium executable. Install Playwright separately for testing; no test package is deployed as a new production dependency. No shared production document is opened by the isolated harness.

Rollback: scoped revert on fresh main, preserve later DualFrame/main commits and encrypted user state. Release only in the existing authorised window, with no manual duplicate deployment.

Authenticated owner sessions can ask public city questions while the Shield remains locked; mutation stays disabled. Expired authentication locks/clears the client on a failed request or the next visible 60-second auth-only check. The planner also clears after its eight-hour project session lifetime, including without a network response. No provider call runs on that check. Physical keyboard validation is pending; the 402×540 case only simulates reduced viewport height.

## Shared email sign-in · 2026-10-21

The travel panel now includes email/password sign-in through the existing `mdlxdcc-guide-auth` endpoint and HttpOnly Guide cookie used by the landing page. An existing landing owner session is reused automatically on the same host. No new account store, provider call, signup flow or permission is introduced. Ordinary visitor accounts remain ineligible for this private trip and receive an explicit explanation and a link to the public landing guide. Project-password authentication remains compatible.

AI sign-in does not decrypt the personal sections or grant planner mutations. Unlocking `Najini ogledi` is still required for Shield data and shared edits. The entered password is cleared after submission, error, panel close and lifecycle reset; it is never persisted or sent to a model. The draft question survives a login attempt. Logout clears both Guide and project sessions, aborts active work, locks private state and clears conversation; a failed logout is displayed and can be retried. GitHub Pages only links to the canonical host and never collects credentials.

The isolated browser checks exercise real Guide session cookies, wrong password, owner/visitor distinction, a locked-Shield conversation, an existing landing session, credential clearing, draft retention, logout and 402px layout. These are deterministic local acceptance checks; production authentication and providers require separate live verification.

## Production receipt · 2026-10-21

BD authorized this scoped production publication. Netlify deploy `6ad7e9f5c51c6be7960efc36` published source `0651335601f1fb0822a9c7bcab08261899b84651` at 00:24 Europe/Ljubljana. It overlays the previously published source and preserves its DGTE update. All 27 existing function digests are unchanged; only `andaluzija-ai`, `andaluzija-auth` and `andaluzija-state` are added. The ordinary manual release policy remains unchanged and the one-shot publication workflow is retired after success.

Validation: 24 targeted tests on the source and composed production candidate, 11 isolated browser scenarios, local real-key Shield checks, and 34 exact public-file hashes (HTML includes the established password-manager preparation and observed pretty-URL rewrites). Connected production Chrome confirms the sign-in form, real owner/project authentication, actual Shield unlock, shared read at revision 0, recognised AI session, the actual 10-second DeepSearch preview without applying it, logout and locked reload; no JavaScript errors were observed. HTTP acceptance separately verifies authenticated provider configuration and encrypted shared-store reads.

Acceptance limits: no paid model or Google calls; no production plan write/CAS experiment; no real email-account form submission; no physical iPhone test. The existing landing email endpoint and signed owner-cookie path are exercised in deterministic local tests. Provider responses and two-device production CAS are still user acceptance items, not asserted by a successful deployment.
