# Flip4M Petrol LAB / APP

Version 2.3.0-petrol, 2026-09-30. Design: Bojan Dobrečevič (BD); implementation and verification: GPT. Existing engine authorship is preserved in source.

## Scope

Approved Petrol Night + Gold family design for `public/F4M/new/` and `public/F4M/app/`, one shared engine in `_shared/petrol-2.3.0/`, and a non-destructive legacy `PWA/` migration. CURRENT, PREVIOUS, ChessBest and Sudoku are unchanged by this release. Board size is user-selectable (Standard / Large / Max), with Max as the default; Standard preserves the 2.2 geometry. No Water/Laser, native app or TestFlight change.

## Rebuild / bounded verification

From repository root:

```
python scripts/flip4m_violet/build.py --public public
python -m pip install playwright==1.57.0
python -m playwright install chromium
python scripts/flip4m_violet/verify.py --public public --out flip4m-evidence
```

Build verifies donor Git blob hashes before writes. It reads CURRENT 2.1.2-smart-time and preserves existing rules, search and Sim modules. Maintain templates here, then rebuild; do not independently edit generated channels. Future runtime changes require a new immutable shared directory and cache version. Retain assets referenced by supported open clients.

## Evidence

Prior Violet bounded Chromium CI: 97/97 checks; this Petrol revision adds targeted palette and board-scale checks, no page JavaScript errors. Run 36646466838, source/test commit ad017325deea055b1ba15212dc2640a7517b5bd3, generated verified commit d3a616917cf5b197981606ef9e4a366d160bcbd1. Tests cover gameplay/Undo, actual AI Worker, save/import/readback, APP widths and resize, both offline channels, failed-save update refusal, another tab not reloading, and legacy copy/refusal/export. CI uses disposable browser profiles. This is engineering evidence, not engine-strength evidence. Physical iPhone/Safari installation acceptance has not been performed.

## Channel safety

LAB retains `flip4m-lab-2.1` data; APP uses `flip4m-app-2.2`. Preferences are isolated, with one-time read-only LAB preference migration. PWA scopes and caches are channel-specific. Updates pause and verify persistence before activation; other tabs are not forcibly reloaded. Legacy migration never overwrites an existing LAB checkpoint and leaves old data/export available.

Production note: Petrol 2.3.0 was merged as `eefdcf256217798fcbd9d340b1f6c598f49744b8`; this follow-up commit intentionally triggers the normal GitHub Pages pipeline because the squash message inherited a historical `[skip ci]` token.
