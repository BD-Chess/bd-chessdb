#!/usr/bin/env node
/**
 * Run the exact Stockfish 18 Lite single-threaded build shipped in ChessBest LAB.
 * stdout: exactly one JSON result on success; stderr and nonzero exit on failure.
 *
 * Example:
 *   node sf_lite_bridge.mjs --root public/chess/new \
 *     --fen 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' \
 *     --depth 15 --multipv 8
 *
 * This deliberately uses ChessBest's existing parser and UCI lifecycle, including
 * the same complete-depth MultiPV snapshot semantics as the browser adapter.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const PINNED = Object.freeze({
  'stockfish-18-lite-single.js': '2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe',
  'stockfish-18-lite-single.wasm': 'a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1',
  'nn-9067e33176e8.nnue': '9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d',
});

function argsOf(argv) {
  const accepted = new Set(['--root', '--fen', '--depth', '--multipv', '--timeout-ms']);
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!accepted.has(key) || key in args || argv[i + 1] == null) {
      throw new Error(`Invalid/duplicate argument ${key ?? '(missing)'}; use --root --fen --depth --multipv [--timeout-ms]`);
    }
    args[key] = argv[i + 1];
  }
  for (const key of ['--root', '--fen', '--depth', '--multipv']) {
    if (!(key in args)) throw new Error(`Missing ${key}`);
  }
  const integer = (key, min, max, fallback) => {
    const raw = args[key] ?? String(fallback);
    if (!/^[1-9]\d*$/.test(raw)) throw new Error(`Invalid ${key}: expected integer in ${min}..${max}`);
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`Invalid ${key}: expected integer in ${min}..${max}`);
    return n;
  };
  return {
    root: resolve(args['--root']), fen: args['--fen'],
    depth: integer('--depth', 1, 128),
    multiPV: integer('--multipv', 1, 256),
    timeoutMs: integer('--timeout-ms', 1000, 3600000, 180000),
  };
}

function verifyAssets(vendor) {
  for (const [file, expected] of Object.entries(PINNED)) {
    const actual = createHash('sha256').update(readFileSync(join(vendor, file))).digest('hex');
    if (actual !== expected) throw new Error(`ChessBest LAB asset mismatch: ${file} SHA-256 ${actual}`);
  }
}

function cliWorker(vendor) {
  const worker = { onmessage: null, onerror: null, onmessageerror: null, closed: false };
  const child = spawn(process.execPath, [join(vendor, 'stockfish-18-lite-single.js')], {
    cwd: vendor, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  let stderr = '';
  const errorMessage = error => {
    if (!worker.closed) worker.onerror?.({ message: error.message || String(error) });
  };
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on('line', line => worker.onmessage?.({ data: line }));
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
  child.on('error', errorMessage);
  child.on('exit', (code, signal) => {
    if (!worker.closed) errorMessage(new Error(`SF Lite exited before bestmove: code=${code}, signal=${signal}${stderr ? `, stderr=${stderr}` : ''}`));
  });
  child.stdin.on('error', errorMessage);
  worker.postMessage = command => {
    if (worker.closed || !child.stdin.writable || !child.stdin.write(`${command}\n`)) {
      // A full pipe can recover asynchronously; merely report a closed pipe.
      if (!worker.closed && !child.stdin.writable) errorMessage(new Error('SF Lite stdin closed'));
    }
  };
  worker.terminate = () => {
    if (worker.closed) return;
    worker.closed = true;
    lines.close();
    child.stdin.destroy();
    child.kill();
    // Abort a stuck child as well. Unref avoids keeping this one-shot CLI alive.
    const hardKill = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 1500);
    hardKill.unref();
  };
  return worker;
}

async function run() {
  const request = argsOf(process.argv.slice(2));
  const vendor = join(request.root, 'vendor', 'stockfish');
  verifyAssets(vendor);
  const { Chess } = require(join(request.root, 'js', 'chess.min.js'));
  const Deep = require(join(request.root, 'js', '8zc-deep-engine.js'));
  const fen = Deep.validateFen(request.fen, Chess);
  const started = performance.now();
  let engine;
  const timeout = AbortSignal.timeout(request.timeoutMs);
  try {
    engine = Deep.create({ Chess, hashMB: 16, workerFactory: () => cliWorker(vendor) });
    const result = await engine.analyze({ fen, depth: request.depth, multiPV: request.multiPV, signal: timeout });
    if (result.stopped || result.forcedStop || !result.lines.length || !result.lines[0].score) {
      throw new Error('SF Lite returned no usable root analysis');
    }
    const scored = result.lines.filter(line => line.pv?.length && line.score).map(line => ({
      rank: line.multipv,
      move: line.pv[0],
      depth: line.depth,
      nodesAtReport: line.nodes ?? null,
      timeMsAtReport: line.time ?? null,
      score: {
        type: line.score.type,
        mover: line.score.root,
        white: line.score.white,
        bound: line.score.bound,
        whiteBound: line.score.whiteBound,
        unit: line.score.unit,
      },
      wdlMover: line.wdl ?? null,
      wdlWhite: line.whiteWdl ?? null,
      pv: line.pv,
    }));
    if (timeout.aborted) throw new Error(`SF Lite exceeded ${request.timeoutMs} ms`);
    const output = {
      schema: 'chessbest-sf-lite-uci-v1',
      engine: {
        id: result.engine.id,
        name: result.engine.reportedName || result.engine.name,
        version: result.engine.version,
        sourceCommit: '31a98753a5d932511693f44775da908377c24513',
        jsSHA256: PINNED['stockfish-18-lite-single.js'],
        wasmSHA256: PINNED['stockfish-18-lite-single.wasm'],
        nnueSHA256: PINNED['nn-9067e33176e8.nnue'],
        nnueRole: 'The separate file is the pinned rebuild input; Lite WASM embeds this network',
        threads: 1, hashMB: 16, multiPV: request.multiPV,
      },
      request: { fen, depth: request.depth, multiPV: request.multiPV, timeoutMs: request.timeoutMs },
      result: {
        bestMove: result.bestMove,
        achievedDepth: result.depth,
        completeMultiPV: result.completeMultiPV,
        linesDepth: result.linesDepth,
        expectedLines: result.expectedLines,
        nodes: result.nodes,
        searchElapsedMs: result.searchElapsedMs,
        lines: scored,
        partialLines: result.partialLines.map(line => ({ rank: line.multipv, move: line.pv?.[0] || null, depth: line.depth })),
      },
      timing: { initializationMs: result.initializationMs, wallMs: performance.now() - started },
      provenance: {
        runtime: 'Node CLI of the same pinned JS/WASM assets as ChessBest LAB',
        positionHistory: result.positionHistory,
        scorePerspective: 'mover = side to move in root FEN; white = White; cp=centipawns, mate=moves',
        comparisonRule: 'Compare only completeMultiPV=true lines at a common linesDepth; otherwise treat as incomplete',
        startedAt: result.startedAt,
      },
    };
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    if (timeout.aborted) throw new Error(`SF Lite timed out after ${request.timeoutMs} ms`, { cause: error });
    throw error;
  } finally {
    engine?.destroy();
  }
}

run().catch(error => {
  process.stderr.write(`sf_lite_bridge: ${error?.message || String(error)}\n`);
  process.exitCode = 1;
});
