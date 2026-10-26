# OmniCPQ STAGE agent R3

Development continues PR #257 rather than replacing its Full GUI prototype.
PWA `1.7.0-stage-r3`, extension `1.2.0`, GUI protocol `omnicpq.gui.v2`
with capability revision `3`. The existing navigation mode remains the default.
The owner can select the explicitly experimental STAGE agent and approve one
PWA/CPQ tab pair, including the required write scope, in the extension popup.
Stable default enablement requires a representative real STAGE acceptance.

## Behavior

- Local automatic status registration: 4-second visible pending poll and
  30-second connected heartbeat, without model calls. Explicit disconnect stays
  disconnected. Account changes invalidate pairing; a second assistant tab does
  not inherit another tab's grant.
- Visible semantic/icon/div-card controls, Material overlays, targeted/paged
  reads, form constraints and component context, untransformed same-origin
  frames, hit testing and fresh revision/document checks before input.
- Restricted CDP pointer/keyboard input, replace/append/clear, blur commit,
  check/select, hover/context/double click, scroll and semantic drag endpoints.
  User-selected file upload is limited to 2 MB and a freshly observed file
  input. Browser-managed exports remain subject to actual browser behavior.
- Goal execution with configurable action/model/time budgets, no-progress
  detection, bounded replanning and reconciliation of unknown outcomes.
  Stop invalidates requests already waiting on preparation, as well as the
  remaining inputs of an in-flight action. Already dispatched effects are
  reported as uncertain until observed; no network exactly-once guarantee.
- A shared behavioral playbook supplements the unchanged v16 business source.
  Canonical prompts and 12 host starters retain their existing text and order.
  A separate private Copilot candidate is not a claim of installation or tools.

## Private documentation

The repository contains only document names, MIME types, sizes and hashes.
Document bytes and the small dated behavior example are seeded through an
authenticated owner upload into a dedicated EU private store. The immutable key
contains the bundle hash; writes are create-only and read back before success.
GET/HEAD require owner access; demo, anonymous and cross-origin requests are
denied. Missing or altered private bytes return 503. HTML uses a script hash
CSP, no-store headers, no framing and no service-worker caching. No document
content is imported into public source or a deployment artifact.

## Verification and activation

Synthetic tests execute the actual PWA, handler, worker and observer against a
DOM fixture with a simulated model and input transport. This validates effects
and orchestration; it does not validate model intelligence, trusted browser
input, organization policy or real CPQ persistence. Real Edge/CPQ and Copilot
acceptance remain separate evidence fields.

The observer is a serialized isolated function executed per request; the new
worker does not install persistent CPQ content listeners. Reloading the updated
extension can therefore invoke the new observer in the existing CPQ document.
Verify the actual worker/page capability revision and preserved field values;
disk hashes or extension reload alone are insufficient runtime evidence.

Publication uses the existing tested-main GitHub Actions preparation and
`netlify deploy --prod --no-build` pipeline. No new publisher or paid upgrade.
Recovery fixes forward through that pipeline; local extension recovery uses
the verified backup in the same installation directory and preserves its ID.
