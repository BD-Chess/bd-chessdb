#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const base = path.join(root, 'public/S/PWA');
const sourcePath = 'public/S/new/app.html';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const source = fs.readFileSync(path.join(root, sourcePath), 'utf8');
const engine = source.match(/const ENGINE_REVISION='([^']+)'/)[1];

function transform(source) {
  let app = source.replaceAll('ai8SudokuNavigatorV020', 'ai8SudokuNavigatorV020PWA');
  const apply = (a, b) => { if (!app.includes(a)) throw Error('PWA source contract changed: ' + a); app = app.replace(a, b); };
  apply('This is a product preview at <code>/S/new/</code>.', 'This is the installable edition at <code>/S/PWA/</code>, built from LAB.');
  apply("version.innerHTML='Engine '+C.ENGINE_REVISION", "version.innerHTML='PWA · Engine '+C.ENGINE_REVISION");
  // Only behavioral adapter: synchronous save gate for explicit updates.
  // The engine script stays byte-identical to LAB; existing PWA keys survive.
  apply('async function restoreSession(s){', 'let pwaRestoreInFlight=0,pwaPendingReviews=0;\nasync function restoreSession(s){pwaRestoreInFlight++;try{return await restoreSessionBody(s);}finally{pwaRestoreInFlight--;}}\nasync function restoreSessionBody(s){');
  apply('reviewQueue=reviewQueue.catch(()=>{}).then(async()=>{', 'pwaPendingReviews++;reviewQueue=reviewQueue.catch(()=>{}).then(async()=>{');
  apply('if(gameId===taskGame){renderReviews();scheduleSave();}});}', 'if(gameId===taskGame){renderReviews();scheduleSave();}}).finally(()=>{pwaPendingReviews--;});}');
  apply('window.SudokuNavigator={version:C.VERSION,', "window.SudokuNavigator={flushForUpdate(){if(booting||genJob||pwaRestoreInFlight||pwaPendingReviews||jobs.size||aiAnimating)return false;cancelSolve();resetAnalysis();clearTimeout(saveTimer);return puzzle?persist('session',snapshot()):true;},version:C.VERSION,");
  return app.trimEnd() + '\n';
}

const app = transform(source);
const assets = ['index.html', 'app.html', 'pwa.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const digests = Object.fromEntries(assets.map(name => [name, sha(name === 'app.html' ? app : fs.readFileSync(path.join(base, name)))]));
const workerPath = path.join(base, 'sw.js');
const oldWorker = fs.readFileSync(workerPath, 'utf8');
const releaseBlock = /\/\/ BEGIN GENERATED RELEASE\n[\s\S]*?\/\/ END GENERATED RELEASE/;
if (!releaseBlock.test(oldWorker)) throw Error('Worker release marker missing');
const normalizedWorker = oldWorker.replace(releaseBlock, '// BEGIN GENERATED RELEASE\nconst RELEASE = null;\n// END GENERATED RELEASE');
const workerRuntimeHash = sha(normalizedWorker);
const releaseId = sha(JSON.stringify({ assets: digests, worker_runtime_sha256: workerRuntimeHash }));
const release = { id: releaseId, engine, assets: digests };
const worker = normalizedWorker.replace(releaseBlock, '// BEGIN GENERATED RELEASE\nconst RELEASE = ' + JSON.stringify(release, null, 2) + ';\n// END GENERATED RELEASE');
const manifest = {
  schema: '8ZSUDOKU_PWA_RELEASE_V1', engine_revision: engine,
  source: { path: sourcePath, sha256: sha(source) },
  transform: 'SUDOKU_PWA_TRANSFORM_V1',
  release_id: releaseId, worker_runtime_sha256: workerRuntimeHash,
  assets_sha256: digests, worker_sha256: sha(worker)
};
const outputs = { 'app.html': app, 'sw.js': worker, 'release.json': JSON.stringify(manifest, null, 2) + '\n' };
const check = process.argv.includes('--check');
for (const [name, text] of Object.entries(outputs)) {
  const destination = path.join(base, name);
  if (check) { if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== text) throw Error('PWA out of date: ' + name + '; run node scripts/build-sudoku-pwa.cjs'); }
  else fs.writeFileSync(destination, text);
}
console.log(JSON.stringify({ status: 'PASS', mode: check ? 'check' : 'build', release_id: releaseId, source_sha256: manifest.source.sha256, assets: assets.length }));
