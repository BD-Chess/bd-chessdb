#!/usr/bin/env node
/* Bounded same-provider SF18 Lite / ChessDCC 0.8 illustration.
 * This is a sampled tie diagnostic, not an independent strength test.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const app = join(repo, 'public/chess/new');
const vendor = join(app, 'vendor/stockfish');
const pinned = {
  'stockfish-18-lite-single.js': '2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe',
  'stockfish-18-lite-single.wasm': 'a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1',
  'nn-9067e33176e8.nnue': '9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d',
};
for (const [name, sha] of Object.entries(pinned)) {
  const actual = createHash('sha256').update(readFileSync(join(vendor, name))).digest('hex');
  if (actual !== sha) throw new Error(`Pinned SF Lite asset changed: ${name} ${actual}`);
}
const { Chess } = require(join(app, 'js/chess.min.js'));
const Deep = require(join(app, 'js/8zc-deep-engine.js'));
const DCC = require(join(app, 'js/8zc-dcc-core.js'));
const SF = require(join(app, 'js/8zc-sf-provider.js'));

function workerFactory() {
  const child = spawn(process.execPath, [join(vendor, 'stockfish-18-lite-single.js')], {
    cwd: vendor, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  const worker = { onmessage: null, onerror: null, onmessageerror: null, closed: false };
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let stderr = '';
  lines.on('line', line => worker.onmessage?.({ data: line }));
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
  child.on('error', error => { if (!worker.closed) worker.onerror?.({ message: error.message }); });
  child.on('exit', (code, signal) => {
    if (!worker.closed) worker.onerror?.({ message: `SF Lite exited: code=${code} signal=${signal} ${stderr}` });
  });
  child.stdin.on('error', error => { if (!worker.closed) worker.onerror?.({ message: error.message }); });
  worker.postMessage = command => {
    if (!worker.closed) child.stdin.write(`${command}\n`);
  };
  worker.terminate = () => {
    if (worker.closed) return;
    worker.closed = true;
    lines.close(); child.stdin.destroy(); child.kill();
    const timer = setTimeout(() => { if (child.exitCode == null) child.kill('SIGKILL'); }, 1500);
    timer.unref();
  };
  return worker;
}

const cases = [
  { id: 'fischer-radojcic-9', title: 'Fischer–Radojčić, before 9.Nh3',
    fen: 'r1bqkb1r/p4pp1/2p2n1p/n3p1N1/8/8/PPPPBPPP/RNBQK2R w KQkq - 0 9',
    interest: ['g5h3', 'g5f3'] },
  { id: 'vitiugov-kramnik-8', title: 'Vitiugov–Kramnik, before 8.Qb3',
    fen: 'rn1qkb1r/pp3ppp/2p1pnb1/3p4/2PP3N/2N1PP2/PP4PP/R1BQKB1R w KQkq - 1 8',
    interest: ['c1d2', 'd1b3'] },
  { id: 'huebner-kasparov-10', title: 'Hübner–Kasparov, before 10.e4',
    fen: 'rn1q1rk1/pb2bppp/1p1ppn2/8/2PQ4/1PN2NP1/P3PPBP/R1B2RK1 w - - 1 10',
    interest: ['h2h3', 'f1e1'], multiPV: 12 },
  { id: 'kramnik-kasparov-11', title: 'Kramnik–Kasparov, after 11.Rb7',
    fen: 'rn2k2r/1R2ppbp/p5p1/q1p5/3PP1b1/2P1BN2/P2Q1PPP/4KB1R b Kkq - 0 11',
    interest: ['b8c6', 'e8g8'], multiPV: 12 },
];
const requested = process.argv[2] || cases[0].id;
const position = cases.find(row => row.id === requested);
if (!position) throw new Error(`Unknown case ${requested}: ${cases.map(c => c.id).join(', ')}`);
const rootDepth = Number(process.argv[3] || 18);
const probeNodes = Number(process.argv[4] || 20000);
const dccDepth = Number(process.argv[5] || 3);
const outputPath = process.argv[6] || '';
const multiPV = position.multiPV || 8;
if (!Number.isSafeInteger(rootDepth) || rootDepth < 1 || rootDepth > 40 ||
    !Number.isSafeInteger(probeNodes) || probeNodes < 1 || probeNodes > 500000 ||
    !Number.isSafeInteger(dccDepth) || dccDepth < 3 || dccDepth > 10)
  throw new Error('Expected <id> <rootDepth 1..40> <probeNodes 1..500000> <dccDepth 3..10> [output.json]');

const controller = new AbortController();
const timer = setTimeout(() => controller.abort('bounded analysis timeout'), 175000);
const started = Date.now();
const provider = SF.create({ Chess,
  Engine: { create: opts => Deep.create({ ...opts, workerFactory }) }, DCC,
  multiPV, probeNodes });
try {
  await provider.prepare({ signal: controller.signal });
  process.stderr.write(`SF Lite root ${position.id} depth ${rootDepth} MultiPV ${multiPV} ...\n`);
  const root = await provider.root(position.fen, { depth: rootDepth, signal: controller.signal });
  process.stderr.write(`SF Lite root complete=${root.complete}, scored=${root.moves.length}, tie=${root.moves.filter(m => root.moves[0].score - m.score <= 10).map(m => m.move).join(',')} ...\n`);
  const settings = { dccDepth, dccTopCandidates: 8, dccEvalFloor: 10,
    dccPolicy: 'balanced', dccNoDeadline: true, dccDefenseCheck: false,
    dccSensors: { stability: true, floor: true, volatility: true, trend: true, structure: false } };
  const result = await provider.analyzeDCC(position.fen, root, settings, controller.signal);
  const receipt = {
    schema: 'sf-lite-dcc-0.8-tie-probe-v1', createdAt: new Date().toISOString(),
    position, constraints: { rootDepth, rootMultiPV: multiPV, probeNodes, dccDepth,
      secondsLimit: 175, perSearchColdHash: true, history: 'FEN only; earlier repetition history unavailable',
      rootMovePerspective: 'root side to move', continuationProviderPerspective: 'side to move at probed FEN; LAB DCC normalizes to root',
      conclusionLimit: 'Same-provider sampled diagnostic; neither an independent correctness judgement nor an Elo test.' },
    engine: { id: 'Stockfish 18 Lite', jsSha256: pinned['stockfish-18-lite-single.js'],
      wasmSha256: pinned['stockfish-18-lite-single.wasm'], threads: 1, hashMB: 16 },
    dcc: { version: DCC.VERSION, sha256: createHash('sha256').update(readFileSync(join(app, 'js/8zc-dcc-core.js'))).digest('hex') },
    root: { complete: root.complete, unboundedTie: root.unboundedTie,
      achievedDepth: root.result?.linesDepth ?? null, expectedLines: root.result?.expectedLines ?? null,
      scoredLines: root.moves, nodes: root.result?.nodes ?? null },
    analysis: { rawBest: root.moves[0]?.move ?? null, dccPick: result.dcc1Move,
      receipt: result.receipt,
      guardedCandidates: result.candidates.filter(row => row.data?.eligible).map(row => ({
        move: row.move, rawCp: row.raw, dccScore: row.data.dccScore,
        evalSequenceRootCp: row.data.evalSequence,
        contributions: row.data.sensorContributions,
        observedPlies: row.data.observedPlies, targetPlies: row.data.targetPlies,
        status: row.data.status, samples: row.data.samples,
      })) },
    ledger: { ...provider.ledger }, elapsedMs: Date.now() - started,
  };
  if (outputPath) writeFileSync(outputPath, JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(JSON.stringify(receipt) + '\n');
} finally {
  clearTimeout(timer);
  provider.destroy();
}
