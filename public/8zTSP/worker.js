let api, problem, shared, token, wasm, cities=0;
let lastSent = -Infinity, knownOptimum = 0;
const proxies = new Map();
let nextProxy = 0;

// Rayon initializes child Workers asynchronously, then communicates through Wasm
// shared memory. The page owns the actual Worker handles, including all children,
// so Stop can terminate the entire pool while this coordinator is inside Wasm.
function routePoolWorkersThroughPage() {
  self.Worker = class PoolWorkerProxy extends EventTarget {
    constructor(_url, _options) {
      super(); this.id = ++nextProxy; proxies.set(this.id, this);
      self.postMessage({type:'pool-spawn',token,id:this.id});
    }
    postMessage(message) { self.postMessage({type:'pool-post', token, id:this.id, message}); }
    terminate() { self.postMessage({type:'pool-terminate', token, id:this.id}); proxies.delete(this.id); }
  };
}
self.tsp8zProgress = (length, elapsed, steps, tour) => {
  if (shared) {
    const value = BigInt(length);
    let previous = Atomics.load(shared, 0);
    while (value < previous) {
      const actual = Atomics.compareExchange(shared, 0, previous, value);
      if (actual === previous) break;
      previous = actual;
    }
  }
  // Small maps keep every checked best tour, so an external benchmark can stop
  // at a reference without losing its path. Large-map copies stay throttled.
  const draw = tour.length <= 12000 || performance.now() - lastSent >= 200 || (knownOptimum > 0 && length <= knownOptimum);
  // Announce only records with a matching valid tour, including at Stop.
  if (!draw) return;
  if (draw) lastSent = performance.now();
  const path = draw ? tour.slice() : null;
  self.postMessage({type:'best',token,length,elapsed,steps,tour:path,wasmMemoryBytes:wasm.memory.buffer.byteLength}, path ? [path.buffer] : []);
};
self.tsp8zPhase = (pass, length, elapsed, steps, tour) => {
  const path = tour.length ? tour.slice() : null;
  self.postMessage({type:'phase',token,pass,length,elapsed,steps,tour:path,wasmMemoryBytes:wasm.memory.buffer.byteLength}, path ? [path.buffer] : []);
};
self.tsp8zHandoff = summary => {
  self.postMessage({type:'handoff',token,summary:JSON.parse(summary)});
};
self.onmessage = async ({data}) => {
  if (data.type === 'pool-event') {
    proxies.get(data.id)?.dispatchEvent(new MessageEvent('message',{data:data.message}));
    return;
  }
  token = data.token;cities=(data.text?.match(/DIMENSION\s*:\s*(\d+)/i)?.[1]||0)*1;
  try {
    if (!(data.module instanceof WebAssembly.Module)) throw Error('A page-unlocked Wasm module is required');
    const threaded = data.sharedThreads > 1;
    if (threaded && !(data.memory instanceof WebAssembly.Memory)) throw Error('Page-owned shared memory is required');
    api = await import(threaded ? './pkg-shared/tsp8z_web.js' : './pkg/tsp8z_web.js');
    wasm=api.initSync({module:data.module,memory:data.memory});
    if (threaded) self.postMessage({type:'pool-status',token,stage:'module-ready'});
    if (data.type === 'load') {
      problem?.free(); problem = new api.Problem(data.text);
      const coordinates = problem.coordinates();cities=coordinates.length/2;
      self.postMessage({type:'ready',token,name:problem.name(),coordinates},[coordinates.buffer]);
    } else if (data.type === 'run') {
      self.postMessage({type:'memory',token,wasmMemoryBytes:wasm.memory.buffer.byteLength});
      let probe = null;
      if (threaded) {
        routePoolWorkersThroughPage();
        await api.initThreadPool(data.sharedThreads);
        self.postMessage({type:'pool-status',token,stage:'pool-ready'});
        api.configure_pool(data.sharedThreads);
        if (data.probe) probe = Array.from(api.pool_probe());
        self.postMessage({type:'pool-status',token,stage:data.probe ? 'probe-complete' : 'configured'});
      }
      shared = data.shared ? new BigInt64Array(data.shared) : null;
      knownOptimum = data.optimum || 0;
      if (!problem) {problem = new api.Problem(data.text);cities=(data.text.match(/DIMENSION\s*:\s*(\d+)/i)?.[1]||0)*1;}
      const started = performance.now();
      const now = performance.timeOrigin + performance.now();
      const deadline = Number.isFinite(data.totalDeadlineEpoch) ? data.totalDeadlineEpoch : now + data.seconds * 1000;
      const remaining = Math.max(0, (deadline - now) / 1000);
      if (remaining <= 0) return; // Page owns the common deadline and finalizes the saved incumbent.
      const first = Math.max(0, Math.min(remaining, (data.firstDeadlineEpoch - now) / 1000));
      // Explicit candidate harness opt-in only. No public UI or default change.
      const profiles = {'observe-one':0,'observe-restart':1,'preserve':2};
      const profiled = data.phaseProfile !== undefined;
      if (profiled && (!Object.hasOwn(profiles,data.phaseProfile) || cities <= 12000 || typeof problem.solve_phase_profile !== 'function')) {
        throw Error('Unsupported experimental profile');
      }
      const phaseEnabled = profiled ? profiles[data.phaseProfile] !== 0 : !!data.twoPass;
      self.postMessage({type:'budget',token,wasmMemoryBytes:wasm.memory.buffer.byteLength,plan:{remainingSeconds:remaining,firstSeconds:phaseEnabled ? first : 0,totalDeadlineEpoch:data.totalDeadlineEpoch}});
      const result = profiled
        ? problem.solve_phase_profile(remaining,data.seed,data.maxSteps || 0,data.passes || 0,data.refinement,first,profiles[data.phaseProfile])
        : data.twoPass
        ? problem.solve_two_pass(remaining,data.seed,data.maxSteps || 0,data.passes || 0,data.refinement,first)
        : problem.solve(remaining,data.seed,data.maxSteps || 0,data.passes || 0,data.refinement);
      const tour = result.tour();
      const poolStats = threaded ? Array.from(api.pool_stats()) : null;
      const handoffSummary = profiled ? JSON.parse(result.handoff_summary()) : null;
      const transfers = [tour.buffer];
      self.postMessage({type:'done',token,length:result.length,elapsed:result.elapsed,
        wall:(performance.now()-started)/1000,steps:result.steps,tour,poolStats,probe,wasmMemoryBytes:wasm.memory.buffer.byteLength,
        ...(profiled ? {handoffSummary} : {})},transfers);
      result.free();
    }
  } catch (error) {const message=cities>=1000000 ? 'Large-map search stopped. Browser memory may be insufficient; choose a smaller example or fewer workers.' : String(error);self.postMessage({type:'error',token,message});}
};
