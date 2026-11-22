// Samostojni Web Worker in izvajalni gonilnik za `LKH-3.0.14` (`lkh_3_0_14.wasm`)
// - Združljiv z iPad Safari/WebKit in Node.js (za deterministično preverjanje proti native CLI)
// - Vsak tek ustvari svež `WebAssembly.Instance(compiledModule, imports)`, tako da ni nobenega
//   puščanja statičnih C spremenljivk ali pomnilnika med teki.
// - Stenski rok (`deadlineSeconds`) teče od samega začetka priprave (`prepStartMs`).

import {
  parseTsplibEuc2d,
  verifyTourIndependent,
  sha256HexBytes,
  createRunFile,
} from '../common/rival-worker-contract.mjs';
import { buildLkhParText } from './lkh-profiles.mjs';

export async function runLkhWasmInstance({
  wasmBytes,
  wasmModule = null,
  tspText,
  profile = 'default',
  seed = 1,
  deadlineSeconds = 60,
  runStartMs = performance.now(),
  runs = null,
  maxTrials = null,
  optimum = null,
  traceLevel = 1,
  stopSignalI32 = null, // Optional Int32Array(SharedArrayBuffer(4)) where Atomics.load(arr, 0) !== 0 requests Stop
  shouldStopFn = null,
  onBest = null,
  onLog = null,
}) {
  const prepStartMs = runStartMs;
  const prepStartIso = new Date().toISOString();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const tspBytes = encoder.encode(tspText);
  const [inputSha256, wasmSha256] = await Promise.all([
    sha256HexBytes(tspBytes),
    wasmBytes ? sha256HexBytes(wasmBytes) : Promise.resolve('precompiled-module'),
  ]);

  const problem = parseTsplibEuc2d(tspText);
  const compiled = wasmModule ?? (await WebAssembly.compile(wasmBytes));

  let wasmMemory = null;
  let stoppedByUser = false;
  let stoppedAtDeadline = false;
  const milestones = [];
  const logLines = [];
  let latestRawTour0 = null;
  let latestReportedCost = null;

  const checkElapsedSec = () => (performance.now() - prepStartMs) / 1000.0;

  const imports = {
    env: {
      js_math_sin: Math.sin,
      js_math_cos: Math.cos,
      js_math_tan: Math.tan,
      js_math_asin: Math.asin,
      js_math_acos: Math.acos,
      js_math_atan: Math.atan,
      js_math_exp: Math.exp,
      js_math_log: Math.log,
      js_math_log2: Math.log2,
      js_math_log10: Math.log10,
      js_math_pow: Math.pow,
      js_math_atan2: Math.atan2,
      js_now_seconds: () => {
        const el = checkElapsedSec();
        if (el >= deadlineSeconds) {
          stoppedAtDeadline = true;
        }
        return el;
      },
      js_should_stop: () => {
        if (stopSignalI32 && Atomics.load(stopSignalI32, 0) !== 0) {
          stoppedByUser = true;
          return 1;
        }
        if (shouldStopFn && shouldStopFn()) {
          stoppedByUser = true;
          return 1;
        }
        if (checkElapsedSec() >= deadlineSeconds) {
          stoppedAtDeadline = true;
          return 1;
        }
        return 0;
      },
      js_on_better_tour: (costBig, runIdx, trialIdx, solverElapsedSec, tourPtr, len) => {
        const cost = Number(costBig);
        const view = new Uint32Array(wasmMemory.buffer, tourPtr >>> 0, len >>> 0);
        const copy = new Uint32Array(view);
        latestRawTour0 = copy;
        latestReportedCost = cost;
        const wallSec = checkElapsedSec();
        const m = {
          run: runIdx,
          trial: trialIdx,
          cost,
          solverElapsedSeconds: solverElapsedSec,
          wallSecondsIncludingPrep: wallSec,
        };
        milestones.push(m);
        if (onBest) {
          onBest({ ...m, tour0: copy });
        }
      },
      js_on_log: (fd, ptr, len) => {
        const bytes = new Uint8Array(wasmMemory.buffer, ptr >>> 0, len >>> 0);
        const text = decoder.decode(bytes);
        if (logLines.length < 500) logLines.push(text);
        if (onLog) onLog(fd, text);
      },
    },
  };

  const instance = await WebAssembly.instantiate(compiled, imports);
  const exports = instance.exports;
  wasmMemory = exports.memory;

  function writeVirtualFile(path, bytes) {
    const pathBytes = encoder.encode(path);
    const pPtr = exports.lkh_wasm_alloc(pathBytes.length);
    const dPtr = bytes.length > 0 ? exports.lkh_wasm_alloc(bytes.length) : 0;
    new Uint8Array(wasmMemory.buffer, pPtr, pathBytes.length).set(pathBytes);
    if (bytes.length > 0) {
      new Uint8Array(wasmMemory.buffer, dPtr, bytes.length).set(bytes);
    }
    exports.lkh_wasm_put_file(pPtr, pathBytes.length, dPtr, bytes.length);
    exports.lkh_wasm_dealloc(pPtr, pathBytes.length);
    if (dPtr) exports.lkh_wasm_dealloc(dPtr, bytes.length);
  }

  // Remaining wall budget from prepStartMs (shared wall-clock contract!)
  const prepElapsedBeforeSolve = checkElapsedSec();
  const remainingBudgetSec = Math.max(0.05, deadlineSeconds - prepElapsedSecSafe(prepElapsedBeforeSolve));

  const parSpec = buildLkhParText({
    profile,
    problemFile: '/problem.tsp',
    outputTourFile: '/tour-$.tour',
    seed,
    totalTimeLimitSeconds: deadlineSeconds, // GetTime() already returns elapsed since prepStartMs!
    timeLimitSeconds: remainingBudgetSec,
    runs,
    maxTrials,
    optimum,
    traceLevel,
  });

  writeVirtualFile('/problem.tsp', tspBytes);
  writeVirtualFile('/run.par', encoder.encode(parSpec.parText));

  const parPathBytes = encoder.encode('/run.par');
  const parPathPtr = exports.lkh_wasm_alloc(parPathBytes.length);
  new Uint8Array(wasmMemory.buffer, parPathPtr, parPathBytes.length).set(parPathBytes);

  let exitCode = 0;
  let trapMessage = null;
  try {
    exitCode = exports.lkh_wasm_solve(parPathPtr, parPathBytes.length);
  } catch (err) {
    exitCode = exports.lkh_wasm_last_exit_code ? exports.lkh_wasm_last_exit_code() : 1;
    trapMessage = String(err?.stack || err);
  } finally {
    try {
      exports.lkh_wasm_dealloc(parPathPtr, parPathBytes.length);
    } catch (_) {}
  }

  // Fallback check on WASM-stored best tour if callback wasn't retained
  if (!latestRawTour0 && exports.lkh_wasm_best_tour_len() > 0) {
    const n = exports.lkh_wasm_best_tour_len();
    const ptr = exports.lkh_wasm_best_tour_ptr();
    latestRawTour0 = new Uint32Array(new Uint32Array(wasmMemory.buffer, ptr >>> 0, n >>> 0));
    latestReportedCost = Number(exports.lkh_wasm_best_cost());
  }

  const totalWallSeconds = checkElapsedSec();
  const wasmMemoryBytes = wasmMemory.buffer.byteLength;

  if (!latestRawTour0) {
    return {
      ok: false,
      exitCode,
      trapMessage,
      wallSecondsIncludingPrep: totalWallSeconds,
      wasmMemoryBytes,
      logs: logLines.join(''),
    };
  }

  // Independent outside-of-engine permutation & EUC_2D metric verification!
  const verified = verifyTourIndependent(problem, latestRawTour0, false);
  const tourBytes = new Uint8Array(
    verified.tour0.buffer,
    verified.tour0.byteOffset,
    verified.tour0.byteLength
  );
  const tourSha256 = await sha256HexBytes(tourBytes);

  const runRecord = {
    schema: '8ztsp-rival-run.v1',
    solverId: 'LKH',
    solverVersion: '3.0.14',
    executionLocation: 'browser-wasm-local',
    licenseScope: 'research-only-author-reserves-rights',
    profileId: parSpec.profileId,
    parameters: parSpec.parameters,
    instanceName: problem.name,
    dimension: problem.dimension,
    metric: problem.edgeWeightType,
    inputSha256,
    wasmSha256,
    seed: seed >>> 0,
    workers: 1,
    copies: 1,
    startedAtIso: prepStartIso,
    deadlineSeconds,
    prepSeconds: prepElapsedBeforeSolve,
    wallSecondsIncludingPrep: totalWallSeconds,
    stoppedAtDeadline,
    stoppedByUser,
    exitCode,
    solverReportedLength: latestReportedCost,
    verifiedLengthEuc2d: verified.euc2dRoundedLength,
    verifiedExactEuclidean: verified.exactEuclideanLength,
    lengthMatchesVerifier: String(latestReportedCost) === verified.euc2dRoundedLength,
    tourSha256,
    wasmMemoryBytes,
    milestones,
  };

  return {
    ok: true,
    record: runRecord,
    tour0: verified.tour0,
    createExportFile: (fileName = `8ztsp-lkh-${problem.name}-s${seed}.json`) =>
      createRunFile(runRecord, verified.tour0, fileName),
    logs: logLines.join(''),
  };
}

function prepElapsedSecSafe(v) {
  return Number.isFinite(v) && v > 0 ? v : 0;
}
