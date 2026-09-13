# WL managed candidate

This directory is a review candidate. It does not register a scheduler, change an
existing worker, or enable a provider transport. The owner HTTP endpoints expose
encrypted durable drafts, lifecycle commands, and explicitly scoped memory.

`core.mjs` contains pure reducers. Persist their entire returned state using one
atomic compare-and-set operation before using any permit. `store.mjs` supplies an
AES-GCM aggregate over the pinned conditional Netlify Blobs API. It retains the
canonical journal while bounding the internal response reconciliation cache.
Ordinary intake stops at 3 MiB; the remaining MiB is reserved for server-selected
STOP, pause, delete, expiry and memory revocation. A larger deployment needs an
approved archive/migration; it must never silently discard evidence or reset state.

`service.mjs` constructs owner authority from authentication rather than request
fields. The owner password derives the new store key in memory. A password change
therefore needs an explicit key migration before rotation. No unattended key path
is configured. An existing Legacy/email card is a projection outside managed
control until the actual sole worker is securely bound. Its disabled controls and
null managed window are intentional.

`memory.mjs` provides source/capsule validation, atomic ingestion and cursors,
target-scoped retrieval, correction, revocation and an optional rebuildable index.
The HTTP import adapter accepts only owner-provided partial exports with:

```
acquisition_mode: HUMAN_ASSISTED_EXPORT_IMPORT
source_identity_kind: BRIDGE_SCOPED
provider_session_id: null
source_provider: OWNER_PROVIDED_EXPORT
execution_surface: WL_BD_OWNER_IMPORT_V1
actor_identity_ref: WL_OWNER_PASSWORD_V1
project_membership_evidence_ref: OWNER_EXPLICIT_AI8_WAKE_LAB_IMPORT
project_id: AI8 Wake Lab
```

These identify a current owner import, not verified provider history. A Mission's
frozen source scope must include the exact computed source reference. Quoted
approvals and reported test results never become authority. The endpoint has no
trusted artifact, model or test verifier adapter, so it rejects such verified
claims. Model observation stays null. Retrieval binds current control revision,
epoch and execution grant, including across STOP/reopen races.

Native/email worker and Git journal modules accept injected trusted adapters.
Their tests use synthetic transports. Production adapters must enforce the same
effect boundary with actual scoped credentials and positive sink/provider
readback. In particular, a model invocation or a transport success flag is not
an accepted research result or delivery proof. Unknown effects fence retries.

Run `npm ci --ignore-scripts` and `npm run test:wl`. The local synthetic browser
fixture is `node tests/wl-local-server.mjs`; it must never be deployed or used with
production credentials. Browser/CSP, real sink CAS, existing worker migration,
mailbox cleanup integration and unattended execution remain release gates.
