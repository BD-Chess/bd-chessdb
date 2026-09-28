const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const chess = path.join(repo, 'public/chess');
const archive = path.join(chess, 'old/005');
const source = '2152f5bd15745287f39d531c76e2ebf8d985d204';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => fs.readFileSync(file, 'utf8');

test('the sealed 005 manifest covers the entire former CURRENT, with no nested channels', () => {
  const manifest = JSON.parse(read(path.join(archive, 'ARCHIVE_MANIFEST.json')));
  const versions = JSON.parse(read(path.join(chess, 'versions.json')));
  const sourceFiles = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', source, '--', 'public/chess'], { cwd: repo, encoding: 'utf8' })
    .split('\0').filter(Boolean).map(name => name.replace(/^public\/chess\//, ''))
    .filter(name => !/^(old|new|PWA)\//.test(name) && name !== 'versions.json');
  assert.equal(manifest.source_commit, source);
  assert.deepEqual(Object.keys(manifest.source_file_sha256).sort(), sourceFiles.sort());
  assert.deepEqual(Object.keys(manifest.file_sha256).sort(), sourceFiles);
  for (const [rel, expected] of Object.entries(manifest.file_sha256)) {
    assert.equal(hash(path.join(archive, rel)), expected, rel);
  }
  assert.equal(versions.archives.at(-1).id, '005');
  assert.equal(versions.archives.at(-1).manifest_sha256, hash(path.join(archive, 'ARCHIVE_MANIFEST.json')));
  assert.equal(versions.latest_promotion.previous_root_preserved, true);
});

test('005 runs its own browser data names and points out of the archive correctly', () => {
  const index = read(path.join(archive, 'index.html'));
  assert.match(index, /href="\.\.\/\.\.\/">CURRENT<\/a>/);
  assert.match(index, /href="\.\.\/">PREVIOUS<\/a>/);
  assert.match(index, /href="\.\.\/\.\.\/new\/">LAB<\/a>/);
  for (const rel of ['js/8zc-utils.js', 'js/8zc-study-ui.js', 'js/8zc-evidence.js', 'js/8zc-sim-store.js']) {
    const js = read(path.join(archive, rel));
    assert.doesNotMatch(js, /chessLab(?:Game|Settings|Study|EvalCache|Timing)|ChessBest-sim-v1|ChessDCC-evidence|8zc\.evidence\.v1/, rel);
  }
  assert.match(read(path.join(archive, 'js/8zc-study-ui.js')), /chessArchive005Study-v1/);
  assert.match(read(path.join(archive, 'js/8zc-sim-store.js')), /ChessBest-archive005-sim-v1/);
});

test('promoted CURRENT exposes the four requested controls and own persistent namespace', () => {
  const index = read(path.join(chess, 'index.html'));
  for (const label of ['Simulation', 'DCC replay', 'DCC analysis', 'Review game', 'New game', 'Game library', 'Deep analysis', 'More ']) {
    assert.ok(index.includes(`>${label}`) || index.includes(`>${label}<`), label);
  }
  assert.match(index, /href="\.\/" aria-current="page">CURRENT<\/a>/);
  assert.match(read(path.join(chess, 'js/8zc-lab-storage.js')), /ChessBest:CURRENT:v2:/);
  assert.match(read(path.join(chess, 'js/8zc-review-ui.js')), /Review/);
});
