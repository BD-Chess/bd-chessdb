# Mobile Play UX R2 — frozen candidate testing

Authority: Drive `1ypieTlxtvb_iXnVjamNOpnT_apaJlIT-` (2026-09-26).
This checklist is prepared in phase A. It is not a completed phase B report.

Before executing this matrix, BD must switch to **GPT-6 Luna / Max** and send
**CONTINUE_TESTS**, or explicitly override that named handoff gate. A substantive
fix requires **TEST_FAILURE_NEEDS_SOL** and GPT-6 Sol / Extra High; refreeze the
affected candidate before resuming evidence. Do not launch parallel agents.

## Frozen code and input ownership

- LAB `public/S/new/app.html` owns UI/controller changes. Engine/checker code is unchanged.
- PWA comes only from `node scripts/build-sudoku-pwa.cjs`; `--check` must pass.
- `mobileUX` owns gesture, cards, menus and isolated demo display. Ordinary input
  delegates to the existing move/erase/undo/trace adapters.
- Idle: normal input, hold arming, menus, new-game confirmation and help.
- Armed: native early scroll remains available; movement above 10 px cancels.
- Picker: one frozen placement; release on a real digit rectangle commits once.
  All cancellation paths invalidate the timer and perform zero transactions.
- Help/menu: one dialog, keyboard play blocked, focus/selection restored on close.
  Pending Hint→Why escalates one checked job; closing cancels stale completion.
- Demo preparing/running/stopped: canonical game remains untouched. Only Stop and
  Return are active. Pending review settles and original session is read back
  before reveal. First reveal records assistance once; Return does not erase it.
- Pagehide/update: discard transient UI, return canonical game, then save. Update
  still refuses pending certification, generation/review or failed persistence.
- Settings move existing controls into the dialog and restore their exact slots.
  Desktop Notes/Erase/Undo/Solve controls return to original homes at 761 px.

## Known capability gate

Phase A used Chromium rendered DOM and normal clicks plus Node/jsdom/real worker
computation. Synthetic Touch Events assertions only check the controller contract.
The available browser interface did **not** provide a documented native touch
long-press/release sequence or WebKit engine. G09 real early-pan vs activated-hold
arbitration is **NOT_RUN / RELEASE BLOCKER**. The scoped Touch Events adapter is a
candidate, not an experimentally established Safari fix. Do not publish an
enabled gesture until real touch evidence resolves this gate. Do not replace it
with a two-tap picker or disable native scrolling/zoom to manufacture a pass.

## Commands

Use the locked jsdom dependency in `tests/sudoku/package-lock.json`. If absent,
restore with `npm ci --prefix tests/sudoku` (do not commit node_modules).

```sh
NODE_PATH=./tests/sudoku/node_modules node --test tests/sudoku-engine-core.test.cjs tests/sudoku-engine-proof.test.cjs tests/sudoku-engine-ui.test.cjs tests/sudoku-mobile-ux.test.cjs tests/sudoku-pwa.test.cjs
NODE_PATH=./tests/sudoku/node_modules SUDOKU_APP_LANE=PWA node --test tests/sudoku-engine-ui.test.cjs tests/sudoku-mobile-ux.test.cjs
node tests/sudoku-mobile-geometry-matrix.cjs
node scripts/build-sudoku-pwa.cjs --check
git diff --check
```

## Geometry and browser matrix

Run all 81 synthetic targets per case; retain each viewport's feasible/fallback
count, minimum digit size, full footprint including shadow, row/column clearance,
stable row-major mapping and sample travel distances. The script deliberately
does not infer candidates/givens. Record genuine infeasibility, including partly
offscreen boards. A high ordinary-portrait fallback rate is a failed prototype.

Then verify **rendered** rectangles and actual hit-testing separately. Minimum
viewports: 402×874, 390×844, 320×568, 740×402, 760×900, 761×900, 1440×900.
Test direct app, LAB entry iframe and PWA entry iframe; reduced available height,
safe areas, default/enlarged text, zoom, coarse/fine pointers and rotation.
Transformed/inaccessible iframe geometry deliberately refuses the picker.

| Check | Required evidence |
| --- | --- |
| Header→board→Numbers→2×4 controls | Rectangles, no overflow, >=44 px controls; record portrait fit and constrained reflow |
| Early board drag | Native page scroll, no picker/value/history event |
| Hold ~300 ms then continuous slide | Same physical contact; stable popup; row/column fully unobscured |
| Release on each 1–9 / gap / origin / outside | Exactly one normal transaction or zero on cancel |
| Cancellation | Pointer cancel/lost capture, Esc, second contact, button change, blur/visibility/pagehide, resize/orientation, scroll, new modal/puzzle, stale target |
| Compatibility click | No extra selection/entry; subsequent real tap and keyboard still work |
| Desktop | Compare to base screenshots/styles/positions; all original control homes restored |

Never label emulation as a physical iPhone or synthetic events as native input.
Record unavailable engine/device combinations as NOT_RUN.

## Bounded integrated sequence and recovery

Perform at least 20 mixed normal/picker values and notes on a certified fixture,
with wrong entry, erase/undo, Hint→Why, close and continued play. Check one normal
history/trace transaction per committed gesture. Notes-only undo must also work
after bounded durable recovery. Do not change consent to make a test pass.

Exercise New Cancel, replacement confirmation, failure and successful generation;
More→Review (including empty), Help, Settings, export/import/file Cancel and bad
import. Selected values/notes must survive all canceled/failed actions. Data
deletion remains separately confirmed. Check no duplicate IDs/handlers.

For demo, begin with notes, multiple undo steps, reviewed moves, candidate lineage,
practice state and both running/paused timer variants. Confirm/cancel; stop during
review settling/preparation/animation; complete; Return once; undo after Return.
Compare full in-session canonical state, identity/givens, selection, notes mode,
history/lineage/reviews/settings and timer. The intended delta is truthful help
attribution and `practice.assisted` after an actually shown step. No win, best time,
played count or tutor success may arise from the demo display.

Test quota/readback failure, stale callbacks, pagehide/reload, background, offline
restart and deliberate PWA Save & update while picker/help/demo are active.
Bounded persisted history/reviews retain their documented limits; do not describe
reload as restoration of unbounded in-session history.

## Publication and physical acceptance

After all gates pass, fresh-read main, open PRs and affected path hashes. Preserve
concurrent Chess work. Never force-update main or touch APP, PR #26 or TestFlight.
Use scoped review/merge, then verify a successful Pages run, both entry shells,
served source/PWA SHA-256 and generated release ID. A commit is not live evidence.

BD's physical iPhone checklist remains separate: early scroll vs hold-slide,
several corner/center cells, Notes/Undo, 20 mixed inputs, Hint/Why without jump,
demo Stop/Return, rotation/background, deliberate Save & update, offline reopen.
Do not claim BD's installed PWA updated without device evidence.

Persist the phase B/C result in Sudoku Handoffs
`11473EeNwNohmMyNo9Wu2gsj1-b1om7cL` with exact source/ref, results, gaps and raw
readback/hash. Keep main/Pages status separate from device acceptance.
