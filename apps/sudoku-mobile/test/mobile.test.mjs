import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(app, 'web/index.html'), 'utf8');
// Old extracted lifecycle/delete/layout checks are now N03-N05/N08 in
// native-integration.test.mjs: full generated page and compiled bridge.
const native = await readFile(path.join(app, 'src/bridge.js'), 'utf8');
function extract(id) {
  const match = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>'));
  assert.ok(match, 'Missing script ' + id);
  return match[1];
}
const core = { module: { exports: {} } };
vm.runInNewContext(extract('navigator-core'), core, { timeout: 10000 });
const C = core.module.exports;

test('new game is unique, hint and Game Review certify a move', () => {
  const game = C.generate({ diff: 'easy', seed: 82427 });
  assert.equal(game.status, 'GENERATED');
  assert.equal(game.unique, true);
  const cert = C.exact(game.puzzle);
  assert.equal(cert.complete, true);
  assert.equal(cert.count, 1);
  assert.deepEqual([...cert.solution], [...game.solution]);
  const state = C.state(game.puzzle);
  const hint = C.search(state, { policy: 'OFF', budget: 260000, goal: 'FLOW' });
  assert.ok(hint.candidates?.length || hint.chosen || hint.foundConsequences, 'Hint finds a verified deduction');
  const move = C.enumerate(state, 'P0', new C.Work(200000)).out.find(q => q.c >= 0);
  assert.ok(move, 'Puzzle contains a checkable move');
  assert.equal(C.check(state, move), true);
  assert.equal(game.solution[move.c], move.v);
  const review = C.review(state, move.c, move.v, { budget: 150000 });
  assert.equal(review.status, 'FOUND');
  assert.equal(review.reasoning_status, 'UNKNOWN_REASONING');
  assert.equal(C.apply(state, move).b[move.c], move.v);
});

test('entry, notes, undo and asynchronous review wiring remain in mobile donor', () => {
  for (const token of [
    'history.push({r,c,prev,pn,action',
    'notes[r][c].add(n)',
    'notes[r][c].delete(n)',
    'notes[r][c]=new Set(pn)',
    'placeNumber=function(',
    'undoMove=function(',
    'reviewQueue=reviewQueue.catch',
  ]) assert.ok(html.includes(token), 'Missing donor path ' + token);
});

test('entry, pencil note, erase and undo change the same board state', () => {
  const start = html.indexOf('function placeNumber(n,source=');
  const end = html.indexOf('function toggleNotes()', start);
  assert.ok(start > 0 && end > start);
  const runtime = {
    selectedCell: 0, aiAnimating: false, notesMode: true,
    givenCells: Array.from({ length: 9 }, () => Array(9).fill(false)),
    playerGrid: Array.from({ length: 9 }, () => Array(9).fill(0)),
    notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set())),
    history: [], traceHistoryFloor: 0,
    humanTraceRecorder: { isActive: () => false },
    humanCapture: (_action, _source, _payload, mutate) => mutate(),
    maybeFinishHumanTrace: () => {}, resolveHintForPlacement: () => {},
    ignoreCurrentHint: () => {}, render: () => {},
  };
  vm.createContext(runtime);
  vm.runInContext(html.slice(start, end), runtime);
  vm.runInContext('placeNumber(5)', runtime);
  assert.equal(runtime.notes[0][0].has(5), true);
  vm.runInContext('undoMove()', runtime);
  assert.equal(runtime.notes[0][0].size, 0);
  runtime.notesMode = false;
  vm.runInContext('placeNumber(5)', runtime);
  assert.equal(runtime.playerGrid[0][0], 5);
  vm.runInContext('eraseCell()', runtime);
  assert.equal(runtime.playerGrid[0][0], 0);
  vm.runInContext('undoMove()', runtime);
  assert.equal(runtime.playerGrid[0][0], 5);
});

test('turning optional consents off removes machine, tutor and trace records', () => {
  const script = extract('navigator-ui');
  const machine = script.match(/function consentMachine\(\)\{[^\n]*\}/);
  const tutor = script.match(/function consentTutor\(\)\{[^\n]*\}/);
  assert.ok(machine && tutor);
  const items = {
    'ai8SudokuNavigatorV020.machine': 'private',
    'ai8SudokuNavigatorV020.tutor': 'private',
    'ai8SudokuNavigatorV020.trace': 'private',
    'ai8SudokuNavigatorV020.traceConsent': 'yes',
  };
  const storage = {
    getItem: key => items[key] ?? null,
    setItem: (key, value) => { items[key] = value; },
    removeItem: key => { delete items[key]; },
  };
  const ui = Object.fromEntries(['navLearn','navTutor','navLearningMode'].map(k => [k, {}]));
  const scope = {
    mobileUX: { hasDemo: () => false },
    memoryConsent: true, tutorConsent: true, machine: { observations: [1] },
    tutor: { attempts: [1] }, learningMode: 'ONLINE_PREQUENTIAL',
    C: { VERSION: '0.2.0', emptyModel: () => ({ observations: [] }) },
    NS: 'ai8SudokuNavigatorV020', localStorage: storage,
    persist: (key, value) => storage.setItem('ai8SudokuNavigatorV020.' + key, value),
    $: key => ui[key], updateMemory: () => {},
  };
  vm.createContext(scope);
  vm.runInContext(machine[0] + '\n' + tutor[0] + '\nconsentMachine();consentTutor();', scope);
  assert.equal(items['ai8SudokuNavigatorV020.machine'], undefined);
  assert.equal(items['ai8SudokuNavigatorV020.tutor'], undefined);
  assert.equal(scope.machine.observations.length, 0);
  assert.equal(scope.tutor.attempts.length, 0);
  const trace = html.match(/setConsent\(granted\)\{([\s\S]*?)\n    \}\n    hasTrace/);
  assert.ok(trace);
  const ctx = { localStorage: storage, CONSENT_KEY: 'ai8SudokuNavigatorV020.traceConsent', STORAGE_KEY: 'ai8SudokuNavigatorV020.trace' };
  vm.runInNewContext('const recorder={memoryConsent:true,trace:{events:[1]},finished:false,lastClock:1,memoryStored:{},setConsent(granted){' + trace[1] + '\n}};recorder.setConsent(false);', ctx);
  assert.equal(items['ai8SudokuNavigatorV020.trace'], undefined);
  assert.equal(items['ai8SudokuNavigatorV020.traceConsent'], undefined);
});

test('bundle has no automatic external resources or Android network permission', async () => {
  const android = await readFile(path.join(app, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  const ios = await readFile(path.join(app, 'ios/App/App/Info.plist'), 'utf8');
  const gradle = await readFile(path.join(app, 'android/variables.gradle'), 'utf8');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /safe-area-inset-top/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /(?:<script|<link|<img|<iframe)[^>]+(?:src|href)=["']https?:/i);
  assert.doesNotMatch(html, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(/);
  assert.doesNotMatch(android, /android\.permission\.INTERNET/);
  assert.match(gradle, /targetSdkVersion = 36/);
  assert.match(android, /android:label="@string\/app_name"/);
  assert.match(ios, /<key>CFBundleDisplayName<\/key>\s*<string>8zSudoku<\/string>/);
  assert.match(native, /Filesystem\.writeFile/);
  assert.match(native, /Share\.share/);
  assert.doesNotMatch(native, /placeInputPanel|phoneLayout/);
  assert.match(html, /function setupMobileInputPanel/);
  assert.doesNotMatch(native, /\.panel:nth-child/);
});

test('native transforms preserve the entire pinned engine and geometry, without competing touch/layout policy', async () => {
  const donor=await readFile(path.join(app,'donor/app.html'),'utf8');
  for(const id of ['navigator-core','mobile-play-geometry']) {
    const body=donor.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))[1];
    assert.equal(extract(id),body,id+' preserved byte for byte');
  }
  const css=await readFile(path.join(app,'src/native.css'),'utf8');
  assert.doesNotMatch(css,/touch-action|\.header\{|\.title-block\{|\.mobile-input-panel/);
  assert.equal((html.match(/function setupMobileInputPanel/g)||[]).length,1);
});
