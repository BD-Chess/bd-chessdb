/* W0-R2 SOURCE inventory only. Parsing never executes application scripts.
 * Counts enumerate source instances/construction sites, not unique live controls
 * or browser test passes. Re-run after candidate edits before the GUI matrix. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process'), { JSDOM } = require('jsdom');
const base = path.resolve(__dirname, '..'), out = process.argv[2], matrixOut = process.argv[3];
if (!out) throw Error('Usage: node w0-inventory.cjs INVENTORY.json [RESIDUAL_MATRIX.json]');
const controls = [], generators = [], sourceManifest = [];
const selector = 'button,input,select,option,textarea,a[href],summary,dialog,[role="button"],[role="dialog"],[tabindex],[title]';
const dimensions = {
  themes: ['dark', 'light'], zoom: ['100%', '200%'],
  desktop_viewports: ['1366x768', '1920x1080', '3840x2160'],
  mobile_viewports: ['390x844', '844x390', '430x932', '932x430'],
  physical_devices: ['BD iPhone 16 Pro: Safari portrait/landscape; record actual viewport', 'Android phone: Chrome portrait/landscape; record actual model and viewport'],
  browsers: ['Chrome desktop', 'Edge desktop', 'Firefox desktop', 'Safari on physical iPhone', 'Chrome on physical Android'],
  states: ['default', 'hover where available', 'focus-visible', 'active/selected', 'loading/pending', 'disabled', 'error', 'success/result'],
  input: ['mouse', 'keyboard-only', 'touch', 'screen-reader spot checks']
};
function read(file) {
  const bytes = fs.readFileSync(path.join(base, file));
  sourceManifest.push({ file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  return bytes.toString('utf8');
}
function scan(html, file, kind, offset = 0, sourceLine = 1) {
  const dom = new JSDOM(html); // scripts/resources are not enabled
  for (const node of dom.window.document.querySelectorAll(selector)) {
    controls.push({ id: 'K' + (controls.length + 1), source: file, source_offset: offset, source_line_hint: sourceLine, discovery: kind,
      tag: node.tagName.toLowerCase(), locator: node.id ? '#' + node.id
        : ['data-ui', 'data-action', 'data-eval-source'].find(key => node.hasAttribute(key))
          ? (() => { const key = ['data-ui', 'data-action', 'data-eval-source'].find(k => node.hasAttribute(k)); return '[' + key + '="' + node.getAttribute(key) + '"]'; })() : null,
      label: (node.getAttribute('aria-label') || node.getAttribute('title') || node.getAttribute('placeholder') || node.textContent || node.getAttribute('type') || '').trim().replace(/\s+/g, ' ').slice(0, 160),
      component_hint: node.closest('section,dialog,aside,[role="dialog"]')?.id || file,
      route: '/chess/new/' + (file.endsWith('.html') && file !== 'index.html' ? file : ''),
      runtime_instances: 'UNKNOWN', tested_browser: null, visual_status: 'NOT_RUN' });
  }
  dom.window.close();
}
for (const file of ['index.html', '8zc-help.html']) scan(read(file), file, 'STATIC_SOURCE');
for (const name of fs.readdirSync(path.join(base, 'js')).filter(n => /^8zc-/.test(n) && n.endsWith('.js')).sort()) {
  const file = 'js/' + name, source = read(file);
  // Templates are a source discovery aid; interpolation and nested backticks
  // mean this cannot enumerate every possible generated runtime row/state.
  for (const match of source.matchAll(/`([^`]*<(?:button|input|select|option|textarea|a |summary|dialog)[\s\S]*?)`/g)) {
    scan(match[1], file, 'DYNAMIC_TEMPLATE_SOURCE', match.index, source.slice(0, match.index).split('\n').length);
  }
  for (const match of source.matchAll(/\b(?:button|el|createElement)\s*\(([^\n]{0,200})/g)) {
    if (!/^['"](?:button|input|select|option|textarea|a|summary|dialog)['"]/.test(match[1]) && !match[0].startsWith('button(')) continue;
    generators.push({ id: 'G' + (generators.length + 1), source: file, line: source.slice(0, match.index).split('\n').length,
      expression: match[0].trim(), route: '/chess/new/', discovery: 'DYNAMIC_CONSTRUCTION_SITE', runtime_instances: 'UNKNOWN', visual_status: 'NOT_RUN', tested_browser: null });
  }
}
for (const name of fs.readdirSync(path.join(base, 'css')).filter(name => name.endsWith('.css')).sort()) read('css/' + name);
const surfaces = [
  { id: 'board', component: 'Board, preserved geometry, game title and last-position evaluation indicator', locators: ['#board', '#boardGameTitle', '#positionEval'], states: ['initial', 'pending next position with prior score identified', 'new score', 'flipped', 'height constrained', 'manual variation'] },
  { id: 'sources', component: 'Analysis source and independent DCC controls', locators: ['#analysisSource', '#analysisDCC', '#btnAnalysisDeepen'], states: ['CDB → SF', 'SF', 'DCC on/off', 'Analysis +2 depth', 'stored depth preference'] },
  { id: 'cdb-card', component: 'CDB two-line card below board; click requests data again', locators: ['#allEvalBadges [data-eval-source="CDB"]'], states: ['known', 'pending', 'missing', 'error', 'click refresh', 'both board-source modes'] },
  { id: 'sf-card', component: 'SF two-line card below board; click deepens/stops', locators: ['#allEvalBadges [data-eval-source="SF"]'], states: ['idle', 'computing', 'stop', 'deeper result', 'both board-source modes'] },
  { id: 'dcc-card', component: 'DCC two-line card below board; click toggles Moves/DCC', locators: ['#allEvalBadges [data-eval-source="DCC"]'], states: ['enabled', 'disabled', 'pending', 'complete/partial coverage', 'Moves ↔ DCC', 'three cards remain in one mobile row'] },
  { id: 'workspace', component: 'Moves/DCC/Deep, navigation, More/Tools, settings and focus restoration', states: ['expanded', 'collapsed', 'simulation focus', 'keyboard navigation', 'Deep save line pending/committed'] },
  { id: 'library', component: 'Seven Top Picks, All collections and loaded game title', states: ['initial Top Picks', 'anchored position', 'reload cursor', 'All collections', 'SIM archive collections'] },
  { id: 'migration', component: 'LAB migration gate and retry panel', locators: ['#labStorageProblem'], states: ['copying before app construction', 'complete', 'quota shared by origin', 'Web Locks unavailable', 'IndexedDB unavailable', 'blocked source DB', 'receipt/readback error', 'retry up to three attempts', 'CURRENT export link'] },
  { id: 'study-manager', component: 'Study manager selection, pending operation and recovery', states: ['0/19/20 studies', 'duplicate titles with distinct IDs', 'Export original bytes', 'Export studies', 'Export pending work', 'selective/all removal', 'second confirmation', 'Undo last removal', 'Export recovery', 'Continue pending action', 'Cancel/keep work', 'Close/retain draft', 'Discard pending draft'] },
  { id: 'study-failures', component: 'Study errors, conflicts and atomic persistence', states: ['quota', 'storage unavailable', 'readback failure', 'malformed source', 'size/node limits', 'two tabs', 'stale operation', 'pending reload', 'recovery unavailable and explicit no-recovery confirmation', 'success only after commit'] },
  { id: 'study-analysis', component: 'Study variations, A/B comparison, previews, annotations and imports', states: ['PGN/JSON import', 'tree expansion', 'preview', 'pins A/B', 'source attribution', 'annotation save failure', 'explicit workspace navigation'] },
  { id: 'research', component: 'Evidence, frozen replay and benchmark panels', states: ['empty', 'loaded', 'restore', 'export/import', 'missing evidence', 'budget/cancel/error'] },
  { id: 'gemini', component: 'Gemini panel and analysis-source context', states: ['open/close', 'connection failure', 'empty answer', 'rendered answer', 'CDB/SF/DCC source fidelity', 'send disabled/loading'] },
  { id: 'ordinary-sim', component: 'Simulation, play against engine and DCC replay', states: ['setup', 'CDB/SF', 'CDB/SF + DCC', 'SF', 'SF + DCC', 'untimed ordinary local Sim', 'play as White/Black', 'pause/stop', 'replay completion'] },
  { id: 'matches', component: 'Matches & tournaments setup, result controls and archive', states: ['single', 'paired duel', 'round robin', 'depth/nodes/move-time/game-time', 'opening collection', 'start/running/pause/resume/reload', 'win/checkmate', 'draw/stalemate', 'timeout', 'standings', 'crosstable', 'PGN/CSV/JSON export'] },
  { id: 'stable-readonly', component: 'CURRENT and PWA compatibility inspection', routes: ['/chess/', '/chess/PWA/'], states: ['before/after legacy data equality', 'LAB deletion does not change stable Studies', 'stable settings/game/archive intact', 'no source/service-worker writes or promotion'] },
  { id: 'help', component: 'Help links and accurate source/Sim guidance', routes: ['/chess/new/8zc-help.html'], states: ['keyboard/touch links', 'source modes', 'ordinary Sim untimed vs Matches time controls', 'manager export/removal semantics', 'SF is not privacy mode'] }
];
let head = null;
try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: base, encoding: 'utf8' }).trim(); } catch (_) { /* Useful outside a git checkout too. */ }
const capturedAt = new Date().toISOString();
const result = { schema: 'chessbest.gui-inventory.v2', version: '20260927-W0-R2', captured_at: capturedAt,
  source: { base_commit: head, working_tree: 'uncommitted candidate; source hashes below identify inspected bytes', route: '/chess/new/' },
  coverage: { source_control_instances: controls.length, dynamic_construction_sites: generators.length, source_files_hashed: sourceManifest.length,
    candidate_browser_visual_tested: 0, full_runtime_inventory: 'NOT_RUN', whole_gui_acceptance: 'NOT_RUN',
    note: 'Static/template parsing and construction-site inventory only. Options, repeated templates and controls may overlap. Counts are neither unique runtime controls nor test passes. Application scripts were not executed. No fresh candidate browser or physical-device verification is claimed.' },
  baseline_context: { reference_commit: 'ba23421d9f731377e7a9bf9d421b669afc87689c', note: 'The supplied latest baseline already includes the Matches & tournaments dark-style fix. The older R1 white-button failure is not a finding for this candidate. Visual candidate retest remains NOT_RUN.' },
  required_dimensions: dimensions,
  mandatory_surfaces: surfaces.map(item => ({ ...item, visual_status: 'NOT_RUN', runtime_inventory_status: 'NOT_RUN', evidence: [] })),
  source_manifest: sourceManifest, controls, generators };
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
if (matrixOut) {
  const rows = [
    ['GUI-01', 'All inventory surfaces', 'Exercise every applicable theme, viewport, zoom and interaction state; inventory generated rows while open.'],
    ['GUI-02', 'Board and latest cards', 'Verify fixed board/evaluation geometry, three two-line cards in one horizontal mobile row, source/perspective labels, CDB refresh, SF start/stop, DCC Moves toggle and +2 Analysis depth.'],
    ['GUI-03', 'Navigation and manual variations', 'Check arrow navigation and board variation moves; headings/blank area do not make an analysis move; loaded game title and Top Picks cursor survive reload.'],
    ['GUI-04', 'Dialog accessibility', 'Verify focus entry/trap/return, Escape, keyboard-only operation, touch target size, screen-reader labels, clipping and scroll at 200% zoom.'],
    ['GUI-05', 'Study manager normal/capacity', 'Use 0, 19 and 20 Studies; duplicate names; export without removal; select/delete/confirm/undo; preserve unrelated data and A/B.'],
    ['GUI-06', 'Study pending flows', 'Retain exact pending PGN/import/move/Deep-line operation; close, reload, cancel, export, reopen and continue exactly once; verify the board changes only after successful save.'],
    ['GUI-07', 'Storage failures and conflicts', 'Inject quota/readback/recovery failures and simultaneous tabs; verify clear errors, committed state/rollback behavior, draft retention and no false saved confirmation.'],
    ['GUI-08', 'Fresh migration', 'Use representative legacy settings/game/cache/timing/layout/TopPick/Studies/Evidence/SIM/fallback snapshots; verify all copies and retained originals, IDs and source attribution.'],
    ['GUI-09', 'Migration interruption and retry', 'Interrupt after staged writes, block DB/locks, simulate quota; verify boot gate, visible retry/error, bounded retry, idempotence and no duplicate/resurrected data.'],
    ['GUI-10', 'Existing LAB / concurrent migration', 'Verify existing values, empty state and DB IDs win; two tabs share the Study lock; live legacy runner lease never transfers and checkpoint is not auto-run.'],
    ['GUI-11', 'CDB/SF/DCC persistence and Gemini', 'In both source modes, save/pin/annotate position and inspect Gemini request context; stale-FEN results excluded and each score retains its own source. Use fixtures to avoid unintended external requests.'],
    ['GUI-12', 'Simulation and DCC replay', 'Check setup and all four engine options, ordinary local Sim without a wall-clock limit, play as White/Black from Simulation, pause/stop, replay and current-position continuation.'],
    ['GUI-13', 'Single-game finished results', 'Reach win/checkmate, draw/stalemate/repetition where supported, and timed timeout; inspect every resulting control, result/export text and focus state.'],
    ['GUI-14', 'Paired duel', 'Complete both colors from collection openings; inspect score, game review, result controls, pause/resume/reload and PGN/CSV/JSON export.'],
    ['GUI-15', 'Round robin', 'Complete event; inspect standings, head-to-head/crosstable, saved games, result controls and exports, including mobile overflow.'],
    ['GUI-16', 'Matches contrast', 'Retest Matches & tournaments button and result dialogs in dark/light themes and all interactive states; baseline fix is not a candidate visual pass.'],
    ['GUI-17', 'Physical devices', 'Run critical migration/Study/card/navigation/SIM-result flows on actual iPhone 16 Pro and Android, portrait/landscape. Emulation alone does not close this row.'],
    ['COMPAT-01', 'CURRENT read-only compatibility', 'Capture representative CURRENT storage before LAB first run and after LAB edit/removal/reset; compare bytes/DB records. Inspect CURRENT display without editing, deleting or promoting stable files.'],
    ['COMPAT-02', 'PWA read-only compatibility', 'Inspect existing PWA storage visibility, app startup and source/cache references; verify LAB actions leave legacy PWA data unchanged. Do not regenerate PWA, clear its caches or modify its service worker.'],
    ['GUI-18', 'Help and release scope', 'Confirm Help accurately describes existing controls, distinct Sim timing policies and export/removal semantics; verify changed application files remain LAB-only.']
  ];
  const matrix = { schema: 'chessbest.w0-residual-gui-matrix.v1', version: '20260927-W0-R2', captured_at: capturedAt,
    source_inventory: path.basename(out), base_commit: head, overall_status: 'NOT_RUN', broad_gui_gate: 'OPEN',
    note: 'Residual work only. Narrow automated fixture tests are reported separately and do not close these browser/physical-device rows. No publication or stable-file changes are authorized by this matrix.',
    required_dimensions: dimensions,
    rows: rows.map(([id, surface, acceptance]) => ({ id, surface, acceptance, status: 'NOT_RUN', tested_browser: null, evidence: [], blockers: [] })) };
  fs.mkdirSync(path.dirname(path.resolve(matrixOut)), { recursive: true });
  fs.writeFileSync(matrixOut, JSON.stringify(matrix, null, 2) + '\n');
}
console.log(JSON.stringify({ inventory: out, residual_matrix: matrixOut || null, ...result.coverage }));
