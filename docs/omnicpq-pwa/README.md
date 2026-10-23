# OmniCPQ standalone v16

The private shared skill is v16 / v0.1.6. Exact distribution identity:

- ZIP SHA-256 2468eaec7724c2f0db684b8948843b5cabcaa6fa9319fc0f8f586f40fdab0318
- Manifest SHA-256 bc9ca72ecbf7094f72c683148c841806ae80931f5ad9a26e8a1fa435c7c2c92a

The application retains the existing owner login, private server knowledge and transactional demo invitations. Product sources and the source Excel files remain outside this public repository. The UI now has exactly 12 BD-approved host starters in starters.mjs: ten CPQ/B2B tasks, ECM Jira penultimate, test scenarios last. Mode order is work, jira, plm. A separate server/client hash checks these twelve. The private v16 pack and its original 19 canonical prompt messages remain pinned for compatibility and integrity; no product rules or private payload are repackaged by this host release.

V16 adds exact-code/name lookup over verified private B2B catalog rows, explicit SO relation retrieval, source provenance and selected paraphrased diagnostic evidence. A catalog entry is not full configuration support. All original price rows for a selected code are retained with workbook, sheet and row references. No B2B relation is inferred from categories. SO prices are not in the new export.

The existing database RPC uses a fixed legacy slot called v15. Its label is not the payload version: verifyPack requires the exact current ZIP hash, manifest hash and every source hash. No authentication or accounting function is changed for this release. Blobs, when explicitly configured instead, use a version-specific private key. Neither private storage mode allows public/client data access.

Local preview is explicitly simulated and makes no provider requests:

```
node scripts/omnicpq/prepare-knowledge.mjs EXTRACTED_SKILL ORIGINAL_ZIP .private/omnicpq/knowledge.json
node scripts/omnicpq/materialize-icons.mjs
node scripts/omnicpq/build-prompts.mjs .private/omnicpq/knowledge.json
node scripts/omnicpq/build-shell.mjs
node scripts/omnicpq/preview.mjs --demo
```

Deployment follows docs/NETLIFY_DEPLOYMENT.md and the existing automatic GitHub Actions prebuilt release. Live activation, login, model response, demo budget and Copilot import are separately evidenced. A simulated preview or green code test never proves a live AI answer or CPQ E2E.

## R6: real local browser navigation

ChatGPT Glance uses ChatGPT's Browser tool. An API call from this PWA does not inherit that tool or the ChatGPT session. R6 supplies a distinct Manifest V3 extension and an authenticated-PWA adapter instead of claiming that prompts create browser access. A development ZIP and the 12 starters TXT are reproduced by build-shell.mjs without dependencies or private input. The extension is not published in the Edge store; installation and pairing are explicit user actions described in public/OmniCPQ/browser-help.html.

The extension uses activeTab, scripting and session storage only. There are no persistent host permissions, tabs/history/debugger/cookies/network permissions, remote code or extension-side HTTP calls. Its toolbar must be invoked on the actual CPQ tab. Pairing is bound to an explicit requesting top-level PWA tab at https://www.mdlxdcc.org/omnicpq/, the selected CPQ tab, its exact STAGE/PROD origin, the selected order/quote scope and a 30-minute expiry. Temporary browser permission is additionally enforced by Chromium. Only the internal popup can pair; an arbitrary external page cannot choose a target or issue code. A manifest public key keeps the unpacked extension ID stable; it is not a secret or a signing private key.

Observation is visible DOM, bounded field values excluding passwords and hidden fields, plus a restricted list of navigation targets. It remains local until the user sends a question. Server validation marks it client-reported, never server-attested. Product evidence, GUI observation and action receipts remain distinct. The API has no internal CPQ fetch and does not receive the extension token.

The model may propose one omnicpq_navigation block containing a target ID from the exact observation and its revision. It cannot supply selectors, scripts or arbitrary URLs. The local extension recomputes the visible revision, checks the paired origin and scope and excludes submit controls, save/confirm/delete/create actions and departures from an editor with possible unsaved changes. Click attempts are recorded before dispatch, and an uncertain outcome is not retried. The UI rereads the actual page afterward. CLICK_DISPATCHED is not success at the business goal. Default execution uses a visible button; opt-in automatic guidance allows up to five clicks and at most six separately budgeted model calls. Cancellation, disconnect, logout or account changes stop continuation. Existing demo accounting and authentication are unchanged.

browser-r6.test.mjs exercises an integrated synthetic UI → real handler → simulated model proposal → extension boundary → actual DOM click → new observation. CI also checks stale screens, submit/editor exclusion, scope, external sender/frame rejection, pairing tokens, expiry and duplicate attempts. These tests do not prove installation or execution of the new extension on a user's real Edge/CPQ session; that requires the explicit live pairing and a separate receipt.

## Independent review R1 findings, resolved in R6

The 2026-10-23 review and its evidence ZIP were read and their eleven internal hashes verified. Main and production still pointed to 89c76e5 / deploy 6adb0f38 when implementation began. Confirmed findings were fixed without changing the pinned v16 knowledge or its canonical prompts:

- F01: final build-shell now runs after password-manager HTML transformations. The final copied artifacts are independently checked by verify-shell inside the release preparer; mismatched final HTML blocks publication. The full shell list is shared with the builder and checked against the actual worker. Integrity is retained. Public pwa-r6 tests exercise corrupt install, valid fresh install, old-worker update, opt-in activation and cache/API isolation under three path scopes. The live worker can report its version and release through a MessageChannel without business data.
- F02: New conversation defaults to a fresh business context, clearing prompt ID, service, environment, manual URL, excerpt, image, capture tracks and browser pairing. An explicit same-context action retains selected context but ends automatic-navigation consent. Unsaved drafts alone trigger the choice.
- F03: sentence-ending full stops are distinct from internal code punctuation. Exact-code lookup still refuses extended identifiers and retains every alternative price row. A short price follow-up may carry one exact prior/current-context code; unknown/ambiguous current context and a new explicit service cannot silently inherit an old product.
- F04: an occupied draft requires Add, Replace or Keep; the same path covers starter cards and pilot questions.
- F05: comparison evidence, ZIP hash and responses belong to the selected Copilot, ChatGPT or API partner. Changing partner cannot reuse another partner's confirmation. Frozen comparisons require a frozen input. Records remain user-reported, never automatically PASS.
- F06: identity.mjs supplies the generated public version.mjs consumed by core.mjs and the worker. A version mismatch prevents sending and asks for a safe update. Exports retain the public production marker's source SHA/fingerprint when available, otherwise UNKNOWN.

Desktop/mobile changes include a compact disconnected browser panel, larger mobile privacy text and touch targets, visible login/knowledge/API/service/environment status and a GET-only refresh. Native PWA installation, mobile keyboard behavior and real extension installation require separate device checks and are not implied by synthetic tests.

