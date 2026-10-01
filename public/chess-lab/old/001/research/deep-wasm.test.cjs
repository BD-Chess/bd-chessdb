'use strict';
// Executes the exact browser distribution in its supported Node CLI mode, not a mock engine.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { Chess } = require('../js/chess.min.js');
const Deep = require('../js/8zc-deep-engine.js');
const vendor = path.resolve(__dirname, '../vendor/stockfish');
function cliWorker() {
  const worker = { onmessage: null, onerror: null };
  const child = spawn(process.execPath, [path.join(vendor, 'stockfish-18-lite-single.js')], { stdio: ['pipe', 'pipe', 'pipe'] });
  readline.createInterface({ input: child.stdout }).on('line', line => worker.onmessage?.({ data: line }));
  let errors = ''; child.stderr.on('data', data => errors += data.toString());
  child.on('error', e => worker.onerror?.({ message: e.message }));
  child.on('exit', code => { if (!worker.closed) worker.onerror?.({ message: 'Engine exited: ' + code + ' ' + errors.slice(0, 300) }); });
  worker.postMessage = command => child.stdin.write(command + '\n');
  worker.terminate = () => { worker.closed = true; child.kill(); };
  return worker;
}
test('Pinned official WASM/JS bytes match upstream release digests', () => {
  const expected = { 'stockfish-18-lite-single.js': '2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe',
    'stockfish-18-lite-single.wasm': Deep.ENGINE.wasmSHA256 };
  for (const [file, digest] of Object.entries(expected)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(vendor, file))).digest('hex'), digest);
});
test('Real pinned engine searches multiple targeted roots and returns legal principal variations', { timeout: 30000 }, async () => {
  const engine = Deep.create({ Chess, workerFactory: cliWorker });
  try {
    const fen = new Chess().fen();
    const result = await engine.analyze({ fen, nodes: 20000, multiPV: 2, searchMoves: ['e2e4', 'd2d4'] });
    assert.equal(result.lines.length, 2); assert(result.nodes >= 20000); assert(result.depth >= 3);
    assert(['e2e4', 'd2d4'].includes(result.bestMove));
    for (const line of result.lines) {
      assert(['e2e4', 'd2d4'].includes(line.pv[0]));
      const game = new Chess(fen);
      for (const uci of line.pv) assert(game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }));
      assert.equal(line.score.type, 'cp'); assert.equal(line.score.root, line.score.white);
    }
  } finally { engine.destroy(); }
});
test('Real pinned engine resolves mate and obeys stop in infinite analysis', { timeout: 30000 }, async () => {
  const engine = Deep.create({ Chess, workerFactory: cliWorker });
  try {
    const mate = await engine.analyze({ fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', depth: 5, multiPV: 1 });
    assert.equal(mate.lines[0].score.type, 'mate'); assert.equal(mate.lines[0].score.white, 1);
    const fen = new Chess().fen(); let requestedStop = false;
    const stopped = await engine.analyze({ fen, infinite: true, onInfo(info) { if (info.depth >= 5 && !requestedStop) { requestedStop = true; engine.stop(); } } });
    assert(requestedStop); assert.equal(stopped.stopped, true); assert(stopped.lines.length > 0);
  } finally { engine.destroy(); }
});
