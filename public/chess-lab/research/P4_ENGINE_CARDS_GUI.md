# LAB engine cards and P4 interface

This continues the P3 controller/cancellation contract. The bulky status panel
was rejected in visual review. Its DOM, reserved slot and APP height offset are
removed; no replacement status strip or scheduler is added.

## Cards and ownership

The existing six cards remain under the board. Active local cards have four
concise lines: actual engine/variant and owner, move and typed score when known,
measured search time/selected limit (or known loading bytes), and depth/PV or LC0
visits. `d` is depth and `PV` counts observed lines. Small cards abbreviate this
telemetry; accessible action descriptions retain the full owner/state/metrics.
Preparation has no invented elapsed search time. Older roots/history are labelled.
Completed/stopped cards regain prominent move/score in the same grid geometry.
An empty or failed request never invents a score or completeness.

Projection uses the existing snapshots. Clock-only paints do not rebuild board
history. The All action shows Stop all for any active/armed interactive owner and
calls the shared Stop facade. A Deep-owned card explicitly stops its Deep group;
Cards-family Stop cancels only that family and Cards follow. Already-started
healthy peers can finish. Neither action silently launches another request.
Manual Stop disarms future follow; an explicit new search does not re-arm it.
Both follow controls default OFF. Sim/tournament/Replay/human actors stay separate.

APP uses its existing header's compact Stop and a marker on the Deep tab. Settings
and Tools use their own headers. Native modal isolation takes priority. There are
no nested card buttons or clickable controls over a native modal.

## P4 interface and preferences

Deep configuration uses native details, initially collapsed. Its summary reports
mode, effective CPU, time/depth and neural time fallback, requested lines and root
restriction policy. Analyze/Stop/Each move/results stay outside the collapse.
The explicit open/closed choice survives streaming paints and view changes.

The existing font, workspace-width, compact and theme controls are grouped in
Display / Appearance. A Deep shortcut opens this same group. Their original IDs,
state and persistence are reused. Presentation changes do not reset engines or
their budgets. APP remains the phone presentation on a desktop and through resize.

A native help dialog explains CPU per engine, All, follow/Stop/new search, Link
versus analysis owner, time versus depth, partial results and supported roots.
Buttons support touch/keyboard; native Escape closes help first and restores its
launcher without closing underlying Settings.

## SL/EN coverage and protected content

`8zc-language.js` extracts and extends the existing APP dictionary/source-text
mechanism to both LAB presentations. It reuses `ChessBest:LAB:v2:language`, restores
original source text on EN, observes changed UI nodes/accessible attributes, and
synchronizes the existing preference across tabs. Language changes call no engine
or game mutation API. Alert/confirm/prompt wrappers translate known UI messages
while preserving arguments and unknown provider text.

Coverage: Board/card controls; Moves/Review/Deep/DCC controls and statuses; Library,
Study and Evidence controls/empty/error states; Settings/Tools/storage controls;
existing Sim/replay/tournament setup/history UI; touch help and accessible labels.
Static catalog inspection and representative SL→EN→SL real-browser flows accompany
source-preservation and live-owner tests. Dynamic counts/times/status prefixes use
explicit patterns rather than translating arbitrary substrings.

Preserved verbatim: PGN/SAN/UCI/FEN, imported annotations, game/player titles,
authored curated Library/Review text, receipts/JSON, engine/protocol identifiers,
historical papers/release prose and unrecognized upstream/provider error payloads.
Such source text may retain its authored language; this is not a translated chess
content/research campaign. UI error prefixes and known owned errors are localized.
No external machine translation or provider calls are used for this audit.

## Verification boundaries

Focused controller/DOM regressions retain P3 Stop/follow/history races, locks and
Sim/human/Replay independence. Chromium checks mixed family states, stable grid
geometry, natural Settings focus and native help, preferences/locale without job
replacement, ordinary-file cursor retention, desktop/short/4K, APP375/402/430 and
landscape, and APP desktop preview resizing. The 200% case is explicitly a desktop
layout emulation (640×400 CSS pixels at DPR2 for a 1280×800 physical surface).

The existing bounded shipped All4/CPU1/10s-per-engine scenario is retained, as are
the complete ordinary-game unit and browser update/profile-reopen paths. Controlled
loader/race cases are labelled. Required CI keeps existing checks and adds the
P4 files. Final CI/release/public-byte evidence belongs in the delivery receipt.

Physical iPhone, OS-installed PWA, true offline/eviction and long endurance require
separate device evidence. This package does not promote CURRENT or activate P5,
native/Cockpit/research work. Exact baseline/forward/reverse patches and source
identities are retained in the scoped delivery evidence. Rollback must first
compare affected current files to avoid overwriting subsequent work.

SL/EN regression checks include the actual accessible Link/card-group names,
refresh and disabled-CPU help, human-name placeholders and composed evaluation
descriptions. The same checks run on desktop and APP during active work, alongside
literal move/error-payload preservation. The shared language module uses the
`20261017-p4-r3` source marker. Idle Deep/follow state, PWA readiness and measured
DCC coverage/prefixes are included. Result-receipt reason prose and unknown
provider payloads remain literal data in SL as well as EN; translated surrounding
labels do not rewrite stored analysis/Evidence records.
