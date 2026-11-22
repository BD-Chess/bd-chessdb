import { parseTsplibEuc2d, verifyTourIndependent, sha256HexBytes } from './common/rival-worker-contract.mjs';
import { RIVALS } from './choice.mjs';

const now = () => performance.timeOrigin + performance.now();
const distance = (p, a, b) => Math.floor(Math.hypot(p.xs[a] - p.xs[b], p.ys[a] - p.ys[b]) + 0.5);
const releases = {
  lkh: ['LKH', '3.0.14'],
  eax: ['GA-EAX', '1.0 Normal (015dfbe9f)'],
  ortools: ['Google OR-Tools Routing', '9.15 (or-tools-wasm 2.2.0)'],
};

function finish(record, verified) {
  const tour = verified.tour0;
  record.verifiedLengthEuc2d = verified.euc2dRoundedLength;
  record.verifiedExactEuclidean = verified.exactEuclideanLength;
  postMessage({ type: 'result', record, tour }, [tour.buffer]);
}

function eaxInput(p) {
  const rows = ['TYPE : TSP', 'DIMENSION : ' + p.dimension, 'EDGE_WEIGHT_TYPE : EUC_2D', 'NODE_COORD_SECTION'];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < p.dimension; i++) {
    const x = p.xs[i], y = p.ys[i];
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    rows.push(`${i + 1} ${x} ${y}`);
  }
  // Upstream sums both incident edges per city with a signed 32-bit accumulator.
  // A city's farthest bounding-box corner bounds both of its incident edges.
  let upperBound = 0;
  for (let i = 0; i < p.dimension; i++) {
    const dx = Math.max(p.xs[i] - minX, maxX - p.xs[i]);
    const dy = Math.max(p.ys[i] - minY, maxY - p.ys[i]);
    upperBound += 2 * Math.ceil(Math.hypot(dx, dy));
  }
  if (upperBound >= 2147483647) throw Error('Coordinate range exceeds GA-EAX integer limits');
  return rows.concat('EOF', '').join('\n');
}

async function solve(data) {
  const { engine, text, seed, started, seconds, profile, wasmBytes, reference, optimum, stopAtOptimum } = data;
  const { min: minCities, max: maxCities } = RIVALS[engine];
  const problem = parseTsplibEuc2d(text);
  if (problem.dimension < minCities || problem.dimension > maxCities) {
    throw Error(`${releases[engine][0]}: ${minCities}–${maxCities} cities`);
  }
  const deadline = started + seconds * 1000;
  const elapsed = () => (now() - started) / 1000;
  const expired = () => now() >= deadline;
  const checkDeadline = () => { if (expired()) throw Error('Time expired during preparation'); };
  const [solverId, solverVersion] = releases[engine];
  const meta = {
    schema: '8ztsp-rival-run.v1', solverId, solverVersion,
    executionLocation: 'browser-wasm-local', instanceName: problem.name,
    dimension: problem.dimension, metric: 'EUC_2D', workers: 1, copies: 1,
    seed: engine === 'ortools' ? null : seed, deadlineSeconds: seconds,
    startedAtIso: new Date(started).toISOString(),
    inputSha256: await sha256HexBytes(new TextEncoder().encode(text)),
  };
  let reportedMemory = 0;
  const reportMemory = bytes => {
    if (bytes > reportedMemory) {
      reportedMemory = bytes;
      postMessage({ type: 'memory', wasmMemoryBytes: bytes });
    }
  };
  let bestLength = Infinity;
  let latest = null;
  function publish(order, length) {
    const seenAt = elapsed();
    if (!Number.isSafeInteger(length) || length >= bestLength || seenAt > seconds) return;
    bestLength = length;
    const verified = verifyTourIndependent(problem, order);
    if (verified.euc2dRoundedNumber !== length) throw Error('Reported and independently verified lengths differ');
    latest = { verified, length, seenAt };
    finish({ ...meta, solverReportedLength: length,
      wallSecondsIncludingPrep: seenAt, lengthMatchesVerifier: true }, verified);
  }

  if (engine === 'lkh') {
    const { runLkhWasmInstance } = await import('./lkh-wasm/lkh-worker.mjs');
    meta.profileId = profile;
    meta.wasmSha256 = await sha256HexBytes(wasmBytes);
    checkDeadline();
    const result = await runLkhWasmInstance({
      wasmBytes, tspText: text, profile, seed, deadlineSeconds: seconds,
      runStartMs: started - performance.timeOrigin, traceLevel: 1,
      onBest: ({ tour0, cost }) => publish(tour0, cost),
      onMemory: reportMemory,
    });
    if (!result.ok && !latest) throw Error(result.logs?.trim().split('\n').at(-1) || 'LKH returned no tour within the time budget');
    if (latest && result.ok) {
      const { parameters, wasmMemoryBytes, stoppedAtDeadline } = result.record;
      // The latest transferred tour already has the independent verification.
      postMessage({ type: 'details', details: { parameters, wasmMemoryBytes, stoppedAtDeadline } });
    }
  } else if (engine === 'eax') {
    const { default: createEax } = await import('./gaeax/gaeax.mjs');
    const eax = await createEax({ onBest: publish, deadlineReached: expired });
    checkDeadline();
    eax.FS.writeFile('/problem.tsp', eaxInput(problem));
    meta.parameters = { population: 100, offspring: 30, rngSeed: seed };
    eax._solve(seed);
  } else {
    const { RoutingIndexManager, RoutingModel, FirstSolutionStrategy, LocalSearchMetaheuristic } =
      await import('./ortools/browser/routing.js');
    const { loadRoutingRuntime } = await import('./ortools/browser/runtime/routing.js');
    const runtime = await loadRoutingRuntime();
    reportMemory(runtime.HEAPU8?.byteLength);
    const n = problem.dimension;
    const manager = new RoutingIndexManager(n, 1, 0);
    const model = new RoutingModel(manager);
    // The WASM binding already materializes this cost matrix. Avoid retaining
    // a second JS matrix and the binding's array-of-BigInts snapshot.
    model.setArcCostEvaluatorOfAllVehicles(model.registerTransitCallback(
      (a, b) => distance(problem, manager.indexToNode(a), manager.indexToNode(b)),
    ));
    // Materialize the pinned Routing adapter's matrix once. Set the search
    // budget after that preparation so the final route can arrive on time.
    const transitMatrix = model.buildTransitMatrix();
    model.buildTransitMatrix = () => transitMatrix;
    checkDeadline();
    let firstReferenceSeconds = null;
    let firstOptimumSeconds = null;
    const canInterrupt = stopAtOptimum && self.crossOriginIsolated &&
      runtime.HEAPU8.buffer instanceof SharedArrayBuffer;
    const interruptAddress = canInterrupt ? runtime.ccall('routing_interrupt_address', 'number', [], []) : null;
    const solveOptions = {
      executor: 'direct',
      signal: canInterrupt ? new AbortController().signal : undefined,
      onEventSync(event) {
        if (event.type !== 'solution' || event.unchecked) return;
        reportMemory(runtime.HEAPU8.byteLength);
        const length = Number(event.objectiveValue);
        const seenAt = elapsed();
        if (reference > 0 && length <= reference) firstReferenceSeconds ??= seenAt;
        if (optimum > 0 && length === optimum) {
          firstOptimumSeconds ??= seenAt;
          // Request a native stop while preserving its returned assignment.
          if (interruptAddress !== null) Atomics.store(runtime.HEAPU8, interruptAddress, 1);
        }
      },
    };
    const timeLimit = (cap = Infinity) => {
      const ms = Math.max(1, Math.floor(Math.min(cap, deadline - now())));
      return { seconds: BigInt(Math.floor(ms / 1000)), nanos: ms % 1000 * 1000000 };
    };
    meta.parameters = { firstSolution: 'PATH_CHEAPEST_ARC', improvement: 'GUIDED_LOCAL_SEARCH' };
    function publishAssignment(assignment) {
      if (!assignment) return;
      const route = [];
      for (let index = model.start(0); !model.isEnd(index); index = assignment.value(model.nextVar(index))) {
        if (route.length >= n) throw Error('Invalid OR-Tools route');
        route.push(manager.indexToNode(index));
      }
      // Read a complete tour from the returned assignment. The callback only carries its objective.
      const verified = verifyTourIndependent(problem, route);
      const length = Number(assignment.objectiveValue());
      if (verified.euc2dRoundedNumber !== length) throw Error('OR-Tools objective differs from verified length');
      if (length >= bestLength) return;
      bestLength = length;
      latest = { verified };
      finish({ ...meta, solverReportedLength: length, wallSecondsIncludingPrep: elapsed(),
        firstReferenceSeconds, firstOptimumSeconds, lengthMatchesVerifier: true }, verified);
    }
    const initialStrategy = FirstSolutionStrategy.PATH_CHEAPEST_ARC;
    let initial = null;
    // A short descent lets small maps draw a verified route before the longer search.
    // Large maps reuse a single native solve and only return the full route at the end.
    if (n <= 256 && deadline - now() > 400) {
      meta.parameters.preview = 'GREEDY_DESCENT (up to 300 ms)';
      initial = await model.solveWithParameters({
        firstSolutionStrategy: initialStrategy,
        localSearchMetaheuristic: LocalSearchMetaheuristic.GREEDY_DESCENT,
        timeLimit: timeLimit(300),
      }, solveOptions);
      publishAssignment(initial);
    }
    if (!expired() && !(stopAtOptimum && optimum > 0 && bestLength === optimum)) {
      const parameters = {
        firstSolutionStrategy: initialStrategy,
        localSearchMetaheuristic: LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH,
        timeLimit: timeLimit(),
      };
      const bestAssignment = await (initial
        ? model.solveFromAssignmentWithParameters(initial, parameters, solveOptions)
        : model.solveWithParameters(parameters, solveOptions));
      publishAssignment(bestAssignment);
    }
    reportMemory(runtime.HEAPU8?.byteLength);
  }
  if (!latest) throw Error('No complete tour within the time budget');
}

self.onmessage = async ({ data }) => {
  try {
    await solve(data);
    postMessage({ type: 'done' });
  } catch (error) {
    postMessage({ type: 'error', message: String(error?.message ?? error) });
  }
};
