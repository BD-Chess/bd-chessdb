# 8zSudoku unified LAB / APP — capability and storage matrix

Date: 2026-10-02
Base before Sudoku edits: 8ba850618494e811245cb3576f546de8da791917
Backup checkpoint: a99922723ddd9c0b88642cb641144718005edc9c
Concurrent main incorporated before active edits: 4a44313a2b377c9e7827b17b1b0b7221c7165bfd (Flip4M only)

## Architecture
One active Sudoku development/game source lives under public/S/new/. Desktop LAB uses the same app.html without APP presentation attributes. Real phone / installed LAB PWA / future native direct load selects the mobile presentation. Desktop APP simulation uses /S/new/?view=app and forces the same mobile presentation into a 402 px phone frame. public/S/app/ is recovery/migration only and contains no active gameplay.

## Preserved capability matrix
| Capability | Prior LAB | Prior APP | Unified owner |
| --- | --- | --- | --- |
| Certified engine, Play/Learn/Lab, research panels | YES | donor-derived | /S/new/app.html |
| Desktop LAB | YES | no | /S/new/ default |
| Mobile dock / AI Assist / More | no | YES | /S/new/presentation/app-ui.js |
| Coach + number-pad + text/tip settings | no | YES | /S/new/presentation/app-ui.js |
| Hold/slide picker + filled-cell magnifier | YES | YES/donor | canonical /S/new/app.html |
| AI/Human Solve Review + sensors + fullscreen guide | no | YES | /S/new/presentation/app-solve-playback.js |
| Desktop APP phone simulation | no | YES | /S/new/?view=app |
| PWA save/update safety | YES | YES | /S/new/ channel worker + outer client |
| Native-facing safe-area/mobile layout | partial | YES | /S/new/presentation/app.css |

Sensors Cplx/Gini/Powr/Dens/ADSR remain structural review instruments. They are not an intelligence score or a validated solver ranking.

## Storage / recovery
Canonical gameplay namespace remains ai8SudokuNavigatorV020, preserving existing LAB saves. Old ai8SudokuAppV030 and ai8SudokuNavigatorV020PWA namespaces are never deleted. Migration copies only into empty canonical slots. If a canonical slot is already non-empty, it wins and old bytes remain recoverable. APP-specific UI preferences map to canonical 8zSudoku.ui.* keys. The legacy /S/app/ shell exports old APP/PWA namespaced bytes before an old installation is removed.

## Immutable pre-change snapshots
- public/S/new/old/001/ — tree 7862b3b6fe6c64cf5c1c7dff8f3d8c6d6cd00069.
- public/S/app/old/003/ — tree 699d68ec157d0ecee9dc89f4cfb1a632f5b16f7b.
- Existing APP old/001 and old/002 remain untouched.

CURRENT, PREVIOUS, legacy /S/PWA/ recovery identity, and native PR #26 are outside the active-source rewrite.
