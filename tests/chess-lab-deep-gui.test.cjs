const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'../public/chess/new');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');

test('LAB Deep/GUI parity keeps active SF control, desktop arrows and burgundy close actions',()=>{
  const deep=read('js/8zc-deep-ui.js');
  const utils=read('js/8zc-utils.js');
  const css=read('css/8zc-deep.css');
  const styles=read('css/8zc-styles.css');
  const budget=deep.match(/<select data-deep="budget">([\s\S]*?)<\/select>/)?.[1]||'';

  assert.match(deep,/<label>Search depth<select data-deep="budget">/);
  assert.deepEqual([...budget.matchAll(/value="depth:(\d+)"/g)].map(m=>Number(m[1])),[14,18,22,26,30,34,38,42]);
  assert.doesNotMatch(budget,/nodes:/);
  assert.match(budget,/value="infinite">Until I stop/);
  assert.match(deep,/host\.onChange/);
  assert.match(deep,/start\(\{ automatic: true, reveal: false \}\)/);
  assert.match(deep,/deepenOrStop/);
  assert.match(utils,/deepUI\?\.isFollowing\?\.\(\)/);
  assert.match(utils,/deepUI\.deepenOrStop\?\.\(\)/);
  const publisher=utils.match(/function beginDeepAnalysis\([\s\S]*?const labHost/)?.[0]||'';
  assert.match(publisher,/positionEval\.updateSource\(fen, best\.score, 'SF'/);
  assert.doesNotMatch(publisher,/requestId\s*!==\s*annotationRequestId/,
    'normal CDB\/DCC refreshes must not freeze the Deep SF card publisher');
  assert.match(deep,/pendingLiveScroll/);
  assert.match(deep,/preserveViewport: true/);
  assert.match(deep,/followActive = false/);
  assert.match(deep,/if \(followActive\) start\(\{ automatic: true, reveal: false \}\)/);
  assert.match(deep,/press Analyze position to resume Deep analysis/);
  assert.match(utils,/reason === 'deep-panel'/);
  assert.match(utils,/if \(!deepPanelOnly\)/);
  assert.match(deep,/isFollowing: \(\) => followActive/);
  assert.match(utils,/ArrowUp/);
  assert.match(utils,/ArrowDown/);
  assert.match(utils,/e\.key==='ArrowUp' \|\| e\.key==='Home'/);
  assert.match(utils,/e\.key==='ArrowDown' \|\| e\.key==='End'/);
  assert.match(css,/\.deep-pv\{[^}]*height:84px;[^}]*overflow:hidden/s);
  assert.match(css,/\.deep-pv button\{[^}]*height:28px;[^}]*min-height:28px/s);
  assert.match(styles,/#6f263b!important/);
  assert.match(styles,/#btnCloseGames/);
  assert.match(styles,/#deepAnalysisPanel \[data-deep="close"\]/);
});
